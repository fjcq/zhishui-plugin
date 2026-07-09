/**
 * 酷我音乐播放链接接口
 * 使用酷我 antiserver 老接口，无需 Secret 加密
 *
 * 接口：http://antiserver.kuwo.cn/anti.s
 * 参数：format, rid=MUSIC_<id>, type=convert_url, br
 *
 * 返回：纯文本直链（如 http://xxx.kuwo.cn/resource/xxx.mp3）
 *
 * 注意：
 * - VIP/付费歌曲会返回约 177KB 的版权声明音频（MP3 格式但极小）
 * - 免费歌曲返回完整 3-5MB MP3 文件
 * - 必须通过下载文件头 + 文件大小验证，避免把版权声明当作可播放音频
 */

import cache from '../../utils/cache.js';
import { logger } from '../../../../../../components/index.js';

/** 酷我 antiserver 接口 */
const KUWO_PLAY_API = 'http://antiserver.kuwo.cn/anti.s';

/** 播放链接缓存时间（秒） */
const URL_CACHE_TTL = 1800;

/** 请求超时（毫秒） */
const REQUEST_TIMEOUT = 8000;

/** 音频验证超时（毫秒） */
const VERIFY_TIMEOUT = 10000;

/** 版权声明音频最大大小（200KB 以下视为版权声明/试听片段，酷我版权声明约 177KB） */
const COPYRIGHT_AUDIO_MAX_SIZE = 200 * 1024;

/** 浏览器 User-Agent */
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * 发送 GET 请求并返回纯文本
 * antiserver 返回非 JSON，需要单独处理
 * @param {string} url - 完整请求 URL
 * @returns {Promise<string|null>} 响应文本或 null
 */
async function httpGetText(url) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'User-Agent': DEFAULT_UA,
                'Referer': 'https://www.kuwo.cn/'
            }
        });

        clearTimeout(timer);

        if (!response.ok) return null;

        // 响应可能是 HTML 错误页或纯文本直链
        const text = (await response.text()).trim();
        if (!text || text.startsWith('<') || text.includes('error')) {
            return null;
        }
        return text;
    } catch (error) {
        return null;
    }
}

/**
 * 验证音频 URL 是否为真实可播放的音频文件
 * 通过下载文件并检查文件头字节 + 文件大小，过滤版权声明/试听片段
 * @param {string} url - 音频 URL
 * @returns {Promise<{isValid: boolean, format: string, size: number}>} 验证结果
 */
async function verifyAudioUrl(url) {
    if (!url || !url.startsWith('http')) {
        return { isValid: false, format: '', size: 0 };
    }

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT);

        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: { 'User-Agent': DEFAULT_UA }
        });

        clearTimeout(timer);

        if (!response.ok) {
            return { isValid: false, format: '', size: 0 };
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const header = buffer.subarray(0, 4);
        let format = '';

        // MP3 (ID3v2) - 文件头 "ID3"
        if (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) {
            format = 'MP3';
        }
        // MP3 帧同步
        else if (header[0] === 0xFF && (header[1] & 0xE0) === 0xE0) {
            format = 'MP3';
        }
        // M4A/M4P - "ftyp" 在偏移 4
        else if (buffer.length >= 8 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
            format = 'M4A';
        }
        // FLAC - "fLaC"
        else if (header[0] === 0x66 && header[1] === 0x4C && header[2] === 0x61 && header[3] === 0x43) {
            format = 'FLAC';
        }
        // OGG - "OggS"
        else if (header[0] === 0x4F && header[1] === 0x67 && header[2] === 0x67 && header[3] === 0x53) {
            format = 'OGG';
        }

        // 版权声明/试听片段通常小于 200KB（酷我版权声明约 177KB）
        const isCopyright = buffer.length < COPYRIGHT_AUDIO_MAX_SIZE;
        const isValid = format !== '' && !isCopyright;

        return { isValid, format, size: buffer.length };
    } catch (error) {
        if (error.name !== 'AbortError') {
            logger.error(`[酷我] 音频验证失败: ${error.message}`);
        }
        return { isValid: false, format: '', size: 0 };
    }
}

/**
 * 获取酷我播放链接
 *
 * 流程：
 * 1. 尝试 320kmp3 → 128kmp3 音质
 * 2. 对每个 URL 下载验证文件头和文件大小
 * 3. 版权声明音频（<200KB）会被过滤，标记为不可播放
 *
 * @param {string} id - 歌曲 rid（不带 MUSIC_ 前缀）
 * @returns {Promise<object|null>} 播放链接信息 { url, canPlay, quality }
 */
export async function getKuwoPlayUrl(id) {
    if (!id) return null;

    const cacheKey = `kuwo:url:${id}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    // 尝试多种音质，依次回退
    // 注意：br=2000kflac 会返回试听片段(约180KB)，不能用于实际播放
    // 实测 br=320kmp3/128kmp3 对免费歌曲返回完整 3-5MB MP3 文件
    const qualities = [
        { br: '320kmp3', quality: '320' },
        { br: '128kmp3', quality: '128' }
    ];

    let result = { url: '', canPlay: false, quality: '0' };

    for (const q of qualities) {
        const params = new URLSearchParams({
            format: 'mp3',
            rid: `MUSIC_${id}`,
            type: 'convert_url',
            br: q.br
        });
        const url = `${KUWO_PLAY_API}?${params.toString()}`;

        // antiserver 返回纯文本直链
        const playUrl = await httpGetText(url);
        if (!playUrl || !playUrl.startsWith('http')) continue;

        // 验证是否为真实音频（过滤版权声明）
        const verification = await verifyAudioUrl(playUrl);
        if (!verification.isValid) {
            logger.info(`[酷我] URL 验证失败（格式=${verification.format || '未知'}, 大小=${verification.size}字节），尝试下一音质`);
            continue;
        }

        result = { url: playUrl, canPlay: true, quality: q.quality };
        break;
    }

    cache.set(cacheKey, result, URL_CACHE_TTL);
    return result;
}

export default getKuwoPlayUrl;
