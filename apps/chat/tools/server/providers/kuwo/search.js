/**
 * 酷我音乐搜索接口
 *
 * 使用酷我旧版 search.kuwo.cn/r.s 接口，无需 CSRF Token/Secret：
 *   http://search.kuwo.cn/r.s?all=<keyword>&ft=music&itemset=web_2013&client=kt&pn=0&rn=<limit>&rformat=json&encoding=utf8
 *
 * 响应说明：
 * - 格式为 Python 风格的单引号 JSON，需转换为标准 JSON 解析
 * - 字段映射：MUSICRID（去 MUSIC_ 前缀）、NAME、ARTIST、ALBUM、DURATION
 *
 * 注：新版 www.kuwo.cn/api/www/search 接口需要复杂 Secret 加密算法，暂不使用
 */

import cache from '../../utils/cache.js';
import { logger } from '../../../../../../components/index.js';

/** 酷我旧版搜索接口 */
const KUWO_SEARCH_API = 'http://search.kuwo.cn/r.s';

/** 搜索结果缓存时间（秒） */
const SEARCH_CACHE_TTL = 600;

/** 请求超时（毫秒） */
const REQUEST_TIMEOUT = 10000;

/** 浏览器 User-Agent */
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * 将酷我返回的 Python 风格单引号 JSON 转换为标准 JSON 并解析
 * 兼容处理：单引号→双引号、True/False/None→true/false/null
 * @param {string} text - 原始响应文本
 * @returns {object|null} 解析后的对象或 null
 */
function parseKuwoResponse(text) {
    if (!text) return null;

    try {
        // 简单转义双引号，然后将单引号替换为双引号
        // 注意：值中可能含单引号，但酷我返回的字段名和值基本不含单引号
        let jsonStr = text
            .replace(/"/g, '\\"')   // 先转义已存在的双引号
            .replace(/'/g, '"')      // 单引号转双引号
            .replace(/\bTrue\b/g, 'true')
            .replace(/\bFalse\b/g, 'false')
            .replace(/\bNone\b/g, 'null');

        return JSON.parse(jsonStr);
    } catch (error) {
        logger.error(`[酷我] 搜索响应解析失败: ${error.message}`);
        return null;
    }
}

/**
 * 酷我搜索歌曲
 * @param {string} keyword - 搜索关键词
 * @param {number} limit - 返回数量限制
 * @returns {Promise<Array|null>} 标准化后的歌曲列表
 */
export async function kuwoSearch(keyword, limit = 5) {
    if (!keyword) return null;

    const actualLimit = Math.min(Math.max(limit, 1), 30);
    const cacheKey = `kuwo:search:${keyword}:${actualLimit}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
        all: keyword,
        ft: 'music',
        itemset: 'web_2013',
        client: 'kt',
        pn: '0',
        rn: String(actualLimit),
        rformat: 'json',
        encoding: 'utf8'
    });
    const url = `${KUWO_SEARCH_API}?${params.toString()}`;

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'User-Agent': DEFAULT_UA,
                'Accept': 'text/plain, application/json, */*'
            }
        });

        clearTimeout(timer);

        if (!response.ok) {
            logger.error(`[酷我] 搜索HTTP失败: ${response.status}`);
            return null;
        }

        const text = await response.text();
        const data = parseKuwoResponse(text);

        if (!data?.abslist?.length) {
            return null;
        }

        const results = data.abslist.map((song, index) => {
            // MUSICRID 形如 "MUSIC_474678847"，提取数字部分作为 id
            const musicrid = song.MUSICRID || '';
            const id = musicrid.replace('MUSIC_', '') || song.DC_TARGETID || '';

            return {
                index: index + 1,
                id: String(id),
                name: song.NAME || '',
                artist: song.ARTIST || '未知歌手',
                album: song.ALBUM || '',
                duration: parseInt(song.DURATION, 10) || 0,
                pic: ''
            };
        }).filter(song => song.id && song.name);

        if (results.length === 0) return null;

        cache.set(cacheKey, results, SEARCH_CACHE_TTL);
        return results;
    } catch (error) {
        if (error.name !== 'AbortError') {
            logger.error(`[酷我] 搜索请求异常: ${error.message}`);
        }
        return null;
    }
}

export default kuwoSearch;
