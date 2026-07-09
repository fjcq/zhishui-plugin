/**
 * 酷我音乐歌单接口
 * 使用酷我公开歌单接口
 *
 * 接口：https://www.kuwo.cn/api/www/playlist/playListInfo
 */

import { httpGet } from '../../utils/httpClient.js';
import cache from '../../utils/cache.js';
import { getKuwoToken, buildKuwoHeaders } from './crypto.js';

/** 酷我歌单接口 */
const KUWO_PLAYLIST_API = 'https://www.kuwo.cn/api/www/playlist/playListInfo';

/** 歌单缓存时间（秒） */
const PLAYLIST_CACHE_TTL = 1800;

/**
 * 获取酷我歌单
 * @param {string} playlistId - 歌单 ID
 * @param {number} limit - 返回数量限制
 * @returns {Promise<object|null>} 歌单信息
 */
export async function getKuwoPlaylist(playlistId, limit = 10) {
    if (!playlistId) return null;

    const actualLimit = Math.min(Math.max(limit, 1), 30);
    const cacheKey = `kuwo:playlist:${playlistId}:${actualLimit}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const token = await getKuwoToken();

    const params = new URLSearchParams({
        id: String(playlistId),
        pn: '1',
        rn: String(actualLimit),
        httpsStatus: '1',
        reqId: generateReqId()
    });
    const url = `${KUWO_PLAYLIST_API}?${params.toString()}`;

    const data = await httpGet(url, {
        headers: buildKuwoHeaders(token || '')
    });

    if (!data || data.code !== 200 || !data.data?.musicList?.length) return null;

    const songs = data.data.musicList.map((song, index) => ({
        index: index + 1,
        id: String(song.rid || (song.musicrid || '').replace('MUSIC_', '')),
        name: song.name || '',
        artist: song.artist || '未知歌手',
        album: song.album || '',
        duration: song.duration || 0
    }));

    const result = {
        name: data.data.name || '未知歌单',
        description: data.data.info || '',
        totalCount: data.data.total || songs.length,
        songs
    };

    cache.set(cacheKey, result, PLAYLIST_CACHE_TTL);
    return result;
}

/**
 * 生成 reqId
 * @returns {string} UUID
 */
function generateReqId() {
    const chars = '0123456789abcdef';
    let uuid = '';
    for (let i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) {
            uuid += '-';
        } else if (i === 14) {
            uuid += '4';
        } else if (i === 19) {
            uuid += chars[Math.floor(Math.random() * 4) + 8];
        } else {
            uuid += chars[Math.floor(Math.random() * 16)];
        }
    }
    return uuid;
}

export default getKuwoPlaylist;
