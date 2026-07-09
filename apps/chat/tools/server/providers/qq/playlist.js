/**
 * QQ音乐歌单接口
 * 使用 musicu.fcg 接口的 music.srf_diss_info.DissInfo 模块
 */

import { httpPost } from '../../utils/httpClient.js';
import cache from '../../utils/cache.js';

/** QQ音乐 musicu.fcg 接口 */
const QQ_MUSICU_API = 'https://u.y.qq.com/cgi-bin/musicu.fcg';

/** 歌单缓存时间（秒） */
const PLAYLIST_CACHE_TTL = 1800;

/**
 * 获取QQ音乐歌单
 * @param {string} playlistId - 歌单 ID（disstid）
 * @param {number} limit - 返回数量限制
 * @returns {Promise<object|null>} 歌单信息
 */
export async function getQQPlaylist(playlistId, limit = 10) {
    if (!playlistId) return null;

    const actualLimit = Math.min(Math.max(limit, 1), 30);
    const cacheKey = `qq:playlist:${playlistId}:${actualLimit}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const body = {
        'comm': {
            ct: 24,
            cv: 0
        },
        'req_0': {
            module: 'music.srf_diss_info.DissInfo',
            method: 'uniform_get_DissInfo',
            param: {
                disstid: parseInt(playlistId, 10),
                song_num: actualLimit,
                song_begin: 0,
                userinfo: 1,
                tag: 1
            }
        }
    };

    const data = await httpPost(QQ_MUSICU_API, {
        headers: {
            'Referer': 'https://y.qq.com/',
            'Origin': 'https://y.qq.com'
        },
        body
    });

    if (!data?.req_0?.data?.dirinfo) return null;

    const dirinfo = data.req_0.data.dirinfo;
    const songList = data.req_0.data.songlist || [];

    const songs = songList.slice(0, actualLimit).map((song, index) => ({
        index: index + 1,
        id: song.songmid,
        name: song.songname,
        artist: song.singer?.map(s => s.name).join(', ') || '未知歌手',
        album: song.albumname || '',
        duration: song.interval || 0
    }));

    const result = {
        name: dirinfo.title || '未知歌单',
        description: dirinfo.desc || '',
        totalCount: dirinfo.songnum || songs.length,
        songs
    };

    cache.set(cacheKey, result, PLAYLIST_CACHE_TTL);
    return result;
}

export default getQQPlaylist;
