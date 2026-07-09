/**
 * QQ音乐播放链接接口
 *
 * 使用 musicu.fcg 接口的 vkey.GetVkeyServer 模块获取音频直链
 *
 * 接口：https://u.y.qq.com/cgi-bin/musicu.fcg
 * 模块：vkey.GetVkeyServer（注意：不带 music. 前缀）
 * 方法：CgiGetVkey
 *
 * 关键参数：
 * - loginUin: 956581739（参考 jsososo/QQMusicApi 硬编码）
 * - guid: 2796982635（参考 jsososo/QQMusicApi 硬编码）
 * - ct: 24
 * - filename: M500<media_mid>.mp3（注意：使用 media_mid 而非 songmid）
 *
 * filename 格式：
 * - 128k MP3:  M500<media_mid>.mp3
 * - 320k MP3:  M800<media_mid>.mp3
 * - M4A:       C400<media_mid>.m4a
 * - FLAC:      F000<media_mid>.flac
 *
 * 免费歌曲（pay.pay_play=0）会返回真实 purl（音频直链）
 * VIP 歌曲（pay.pay_play=1）purl 为空，未登录时无法获取
 */

import cache from '../../utils/cache.js';
import { logger } from '../../../../../../components/index.js';

/** QQ音乐 musicu.fcg 接口 */
const QQ_MUSICU_API = 'https://u.y.qq.com/cgi-bin/musicu.fcg';

/** 硬编码 loginUin（参考 jsososo/QQMusicApi） */
const LOGIN_UIN = '956581739';

/** 硬编码 guid（参考 jsososo/QQMusicApi） */
const FIXED_GUID = '2796982635';

/** 播放链接缓存时间（秒） */
const URL_CACHE_TTL = 1800;

/** 请求超时（毫秒） */
const REQUEST_TIMEOUT = 10000;

/** 浏览器 User-Agent */
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** 音质优先级（从高到低）：FLAC > 320k MP3 > M4A > 128k MP3 */
const QUALITY_LIST = [
    { prefix: 'F000', ext: 'flac', quality: 'flac' },
    { prefix: 'M800', ext: 'mp3', quality: '320' },
    { prefix: 'C400', ext: 'm4a', quality: 'm4a' },
    { prefix: 'M500', ext: 'mp3', quality: '128' }
];

/**
 * 构造 vkey 请求体
 * @param {string} filename - filename 字符串（如 M500xxx.mp3）
 * @param {string} songmid - 歌曲 mid
 * @returns {object} 请求体
 */
function buildVkeyBody(filename, songmid) {
    return {
        req_0: {
            module: 'vkey.GetVkeyServer',
            method: 'CgiGetVkey',
            param: {
                filename: [filename],
                guid: FIXED_GUID,
                songmid: [songmid],
                songtype: [0],
                uin: LOGIN_UIN,
                loginflag: 1,
                platform: '20'
            }
        },
        comm: {
            uin: Number(LOGIN_UIN),
            format: 'json',
            ct: 24,
            cv: 0
        }
    };
}

/**
 * 构造 vkey 请求 URL（GET 方法，data 参数为 URL 编码的 JSON）
 * 注意：必须手动拼接 URL，使用 URLSearchParams 会双重编码导致 error 500001
 * @param {object} body - 请求体
 * @returns {string} 完整请求 URL
 */
function buildVkeyUrl(body) {
    const dataParam = encodeURIComponent(JSON.stringify(body));
    return `${QQ_MUSICU_API}?-=getplaysongvkey&g_tk=5381&loginUin=${LOGIN_UIN}&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0&data=${dataParam}`;
}

/**
 * 发送 vkey 请求并返回响应
 * @param {string} url - 完整请求 URL
 * @returns {Promise<object|null>} 响应数据或 null
 */
async function fetchVkey(url) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'User-Agent': DEFAULT_UA,
                'Referer': 'https://y.qq.com/',
                'Origin': 'https://y.qq.com',
                'Accept': 'application/json, text/plain, */*'
            }
        });

        clearTimeout(timer);

        if (!response.ok) {
            return null;
        }

        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (_) {
            return null;
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            logger.error(`[QQ] vkey 请求异常: ${error.message}`);
        }
        return null;
    }
}

/**
 * 解析 vkey 响应，返回包含 purl 的信息
 * @param {object} data - 响应数据
 * @returns {{ purl: string, sip: string }} 解析结果
 */
function extractPurl(data) {
    const vkeyData = data?.req_0?.data;
    if (!vkeyData) {
        return { purl: '', sip: '' };
    }
    const midurlinfo = vkeyData.midurlinfo?.[0];
    const sip = vkeyData.sip?.find(s => !s.startsWith('http://ws')) || vkeyData.sip?.[0] || '';
    return {
        purl: midurlinfo?.purl || '',
        sip
    };
}

/**
 * 拼接完整 URL
 * @param {string} purl - purl
 * @param {string} sip - 服务器前缀
 * @returns {string} 完整 URL
 */
function buildFullUrl(purl, sip) {
    if (!purl) return '';
    if (purl.startsWith('http')) return purl;
    return sip + purl;
}

/**
 * 获取单个音质的 vkey
 * @param {string} songmid - 歌曲 mid
 * @param {string} mediaMid - media_mid（构造 filename 的关键字段）
 * @param {string} prefix - 音质前缀（M500/M800/C400/F000）
 * @param {string} ext - 文件扩展名（mp3/m4a/flac）
 * @returns {Promise<{purl: string, sip: string}>} 解析结果
 */
async function fetchVkeyForQuality(songmid, mediaMid, prefix, ext) {
    const filename = `${prefix}${mediaMid}.${ext}`;
    const body = buildVkeyBody(filename, songmid);
    const url = buildVkeyUrl(body);
    const data = await fetchVkey(url);
    if (!data) return { purl: '', sip: '' };
    return extractPurl(data);
}

/**
 * 获取QQ音乐播放链接
 * 按音质优先级依次尝试，返回第一个可用的 purl
 * @param {string} songmid - 歌曲 mid
 * @param {string} mediaMid - media_mid（来自搜索结果）
 * @returns {Promise<object|null>} 播放链接信息 { url, canPlay, quality }
 */
export async function getQQPlayUrl(songmid, mediaMid) {
    if (!songmid) return null;

    // 如果没有 mediaMid，无法构造正确的 filename
    if (!mediaMid) {
        return { url: '', canPlay: false, quality: '0' };
    }

    const cacheKey = `qq:url:${songmid}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    // 按音质优先级依次尝试
    for (const { prefix, ext, quality } of QUALITY_LIST) {
        const { purl, sip } = await fetchVkeyForQuality(songmid, mediaMid, prefix, ext);
        if (!purl) continue;

        const url = buildFullUrl(purl, sip);
        if (!url) continue;

        const result = { url, canPlay: true, quality };
        cache.set(cacheKey, result, URL_CACHE_TTL);
        return result;
    }

    // 所有音质均无 purl，标记为 VIP/版权
    const result = { url: '', canPlay: false, quality: '0' };
    cache.set(cacheKey, result, URL_CACHE_TTL);
    return result;
}

export default getQQPlayUrl;
