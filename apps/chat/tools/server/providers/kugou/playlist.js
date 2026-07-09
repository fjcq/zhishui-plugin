/**
 * 酷狗音乐歌单接口
 * 使用酷狗公开歌单接口获取
 */

import { httpGet } from '../../utils/httpClient.js';
import cache from '../../utils/cache.js';
import { generateMid } from './crypto.js';

/** 酷狗歌单接口（mobilecdn 被劫持，改用 msearch） */
const KUGOU_PLAYLIST_API = 'https://msearch.kugou.com/api/v3/special/song';

/** 歌单缓存时间（秒） */
const PLAYLIST_CACHE_TTL = 1800;

/**
 * 获取酷狗歌单
 * @param {string} playlistId - 歌单 ID
 * @param {number} limit - 返回数量限制
 * @returns {Promise<object|null>} 歌单信息
 */
export async function getKugouPlaylist(playlistId, limit = 10) {
    if (!playlistId) return null;

    const actualLimit = Math.min(Math.max(limit, 1), 30);
    const cacheKey = `kugou:playlist:${playlistId}:${actualLimit}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const dfid = '-';
    const params = {
        specialid: playlistId,
        dfid,
        mid: generateMid(dfid),
        appid: '1005',
        clientver: '1070',
        clienttime: Math.floor(Date.now() / 1000),
        page: 1,
        pagesize: actualLimit,
        format: 'json'
    };

    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        query.append(k, String(v));
    }
    const url = `${KUGOU_PLAYLIST_API}?${query.toString()}`;

    const data = await httpGet(url);

    if (!data || data.status !== 1 || !data.data?.info?.length) {
        return null;
    }

    const songs = data.data.info.map((song, index) => ({
        index: index + 1,
        id: song.hash,
        name: song.songname || song.filename?.split(' - ')?.[1] || '',
        artist: song.singername?.split('、').join(', ') || '未知歌手',
        album: song.album_name || '',
        duration: song.duration || 0
    }));

    const result = {
        name: data.data.specialname || '未知歌单',
        description: data.data.intro || '',
        totalCount: data.data.total || songs.length,
        songs
    };

    cache.set(cacheKey, result, PLAYLIST_CACHE_TTL);
    return result;
}

export default getKugouPlaylist;
