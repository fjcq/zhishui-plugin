/**
 * 酷狗音乐搜索接口
 * 使用酷狗移动端公开搜索接口，返回标准化的歌曲列表
 */

import { httpGet } from '../../utils/httpClient.js';
import cache from '../../utils/cache.js';

/** 酷狗搜索 API 基础地址（mobilecdn 被劫持，改用 msearch） */
const KUGOU_SEARCH_API = 'https://msearch.kugou.com/api/v3/search/song';

/** 搜索结果缓存时间（秒） */
const SEARCH_CACHE_TTL = 600;

/**
 * 酷狗搜索歌曲
 * @param {string} keyword - 搜索关键词
 * @param {number} limit - 返回数量限制
 * @param {number} page - 页码，从1开始
 * @returns {Promise<Array|null>} 标准化后的歌曲列表
 */
export async function kugouSearch(keyword, limit = 5, page = 1) {
    if (!keyword) return null;

    const actualLimit = Math.min(Math.max(limit, 1), 30);
    const actualPage = Math.max(page, 1);

    // 命中缓存直接返回
    const cacheKey = `kugou:search:${keyword}:${actualLimit}:${actualPage}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const url = `${KUGOU_SEARCH_API}?keyword=${encodeURIComponent(keyword)}&page=${actualPage}&pagesize=${actualLimit}`;

    const data = await httpGet(url);

    if (!data || data.status !== 1 || !data.data?.info?.length) {
        return null;
    }

    const songs = data.data.info;
    const results = songs.map((song, index) => ({
        id: song.hash,
        name: song.songname || song.filename?.split(' - ')?.[1] || '',
        artist: song.singername?.split('、').join(', ') || '未知歌手',
        album: song.album_name || '',
        duration: song.duration || 0,
        pic: song.album_sizable_pic || song.album_pic || '',
        // 酷狗付费信息：pay_type=0 表示免费，privilege=8 通常表示可免费试听 128k
        payType: song.pay_type ?? 0,
        privilege: song.privilege ?? 0,
        // 备选 hash（更高音质）
        hash128: song.hash || '',
        hash320: song['320hash'] || '',
        hashSq: song.sqhash || '',
        albumAudioId: song.album_audio_id ?? 0
    }));

    cache.set(cacheKey, results, SEARCH_CACHE_TTL);

    return results;
}

export default kugouSearch;
