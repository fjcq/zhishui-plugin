/**
 * 酷我音乐歌曲详情接口
 *
 * 由于酷我新版 musicInfo API（www.kuwo.cn/api/www/music/musicInfo）需要 Secret 签名，
 * 即使携带从首页获取的 CSRF token，请求仍会被拒绝（"The request is illegal!"）。
 *
 * 改为请求 play_detail HTML 页面并从 __NUXT__ songinfo 中提取字段：
 *   - 接口：https://www.kuwo.cn/play_detail/<rid>
 *   - 页面内嵌 songinfo:{name:"...",artist:"...",duration:...,album:a,...}
 *
 * 该接口无需签名，公开可访问。
 */

import cache from '../../utils/cache.js';
import { logger } from '../../../../../../components/index.js';

/** 酷我 play_detail HTML 页面 */
const KUWO_PLAY_DETAIL = 'https://www.kuwo.cn/play_detail';

/** 详情缓存时间（秒） */
const DETAIL_CACHE_TTL = 1800;

/** 请求超时（毫秒） */
const REQUEST_TIMEOUT = 10000;

/** 浏览器 User-Agent */
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * 获取酷我歌曲详情
 * 从 play_detail HTML 页面提取 __NUXT__ 中的 songinfo 字段
 * @param {string} rid - 歌曲 rid
 * @returns {Promise<object|null>} 歌曲详情
 */
export async function getKuwoDetail(rid) {
    if (!rid) return null;

    const cacheKey = `kuwo:detail:${rid}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    let html;
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
        const response = await fetch(`${KUWO_PLAY_DETAIL}/${rid}`, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'User-Agent': DEFAULT_UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        clearTimeout(timer);
        if (!response.ok) return null;
        html = await response.text();
    } catch (e) {
        logger.warn(`[酷我] play_detail 请求失败: ${e.message}`);
        return null;
    }

    // 从 songinfo 块中提取字段
    const songinfoBlock = extractSonginfoBlock(html);

    let name = '';
    let artist = '';
    let album = '';
    let duration = 0;

    if (songinfoBlock) {
        name = extractStringField(songinfoBlock, 'name');
        artist = extractStringField(songinfoBlock, 'artist');
        album = extractStringField(songinfoBlock, 'album');
        duration = extractNumberField(songinfoBlock, 'duration');
    }

    // 如果 songinfo 块没有，尝试从 meta description 提取
    if (!name && !artist) {
        const meta = extractFromMetaDescription(html);
        if (meta) {
            name = meta.name;
            artist = meta.artist;
        }
    }

    // 如果仍然没有，尝试从 title 提取
    if (!name && !artist) {
        const title = extractTitle(html);
        if (title) {
            const parts = title.split('_');
            if (parts.length >= 2) {
                name = parts[0];
                artist = parts[1];
            }
        }
    }

    if (!name && !artist) return null;

    const detail = {
        id: String(rid),
        name,
        artist: artist || '未知歌手',
        album,
        duration,
        pic: ''
    };

    cache.set(cacheKey, detail, DETAIL_CACHE_TTL);
    return detail;
}

/**
 * 从 HTML 中提取 songinfo 块（平衡花括号匹配）
 * @param {string} html - HTML 全文
 * @returns {string|null} songinfo 块内容
 */
function extractSonginfoBlock(html) {
    const idx = html.indexOf('songinfo:');
    if (idx < 0) return null;

    let depth = 0;
    const start = html.indexOf('{', idx);
    if (start < 0) return null;

    let i = start;
    while (i < html.length) {
        const ch = html[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) return html.substring(start, i + 1);
        }
        i++;
    }
    return null;
}

/**
 * 从 songinfo 块中提取字符串字段
 * 字段格式：name:"..."（注意 a/b/c/d 是 JS 变量占位符，表示 null/数字）
 * @param {string} block - songinfo 块
 * @param {string} field - 字段名
 * @returns {string} 字段值
 */
function extractStringField(block, field) {
    const re = new RegExp(`${field}:"([^"]+)"`);
    const m = block.match(re);
    if (!m) return '';
    // 解码 \uXXXX 转义（如 \u002F -> /）
    return m[1].replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * 从 songinfo 块中提取数字字段
 * @param {string} block - songinfo 块
 * @param {string} field - 字段名
 * @returns {number} 字段值
 */
function extractNumberField(block, field) {
    const re = new RegExp(`${field}:(\\d+)`);
    const m = block.match(re);
    return m ? Number(m[1]) : 0;
}

/**
 * 从 meta description 中提取歌名和歌手
 * 格式：歌名，由歌手XXX演唱，...
 * @param {string} html - HTML 全文
 * @returns {{name: string, artist: string}|null} 提取结果
 */
function extractFromMetaDescription(html) {
    const m = html.match(/name="description"\s+content="([^"]+)"/);
    if (!m) return null;
    const desc = m[1];
    const nameMatch = desc.match(/^(.+?)，由歌手/);
    const artistMatch = desc.match(/由歌手(.+?)演唱/);
    if (!nameMatch && !artistMatch) return null;
    return {
        name: nameMatch ? nameMatch[1] : '',
        artist: artistMatch ? artistMatch[1] : ''
    };
}

/**
 * 从 <title> 标签提取标题
 * 格式：歌名_歌手_单曲在线试听_酷我音乐
 * @param {string} html - HTML 全文
 * @returns {string|null} 标题
 */
function extractTitle(html) {
    const m = html.match(/<title>([^<]+)<\/title>/);
    return m ? m[1] : null;
}

export default getKuwoDetail;
