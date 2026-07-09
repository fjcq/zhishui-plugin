/**
 * QQ音乐歌曲详情接口
 *
 * 使用 c.y.qq.com 公开接口 fcg_play_single_song.fcg 获取歌曲详情
 * 该接口无需签名，返回完整的 name/singer/album/media_mid 等字段
 *
 * 备用接口：musicu.fcg 的 music.pf_song_detail.SongDetail（需签名，未签名请求返回 code=500003）
 */

import { httpGet } from '../../utils/httpClient.js';
import cache from '../../utils/cache.js';

/** QQ音乐公开详情接口 */
const QQ_SONG_INFO_API = 'https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg';

/** 详情缓存时间（秒） */
const DETAIL_CACHE_TTL = 1800;

/**
 * 获取QQ音乐歌曲详情
 * @param {string} songmid - 歌曲 mid
 * @returns {Promise<object|null>} 歌曲详情（含 mediaMid 字段）
 */
export async function getQQDetail(songmid) {
    if (!songmid) return null;

    const cacheKey = `qq:detail:${songmid}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    // 构造查询参数
    const url = `${QQ_SONG_INFO_API}?songmid=${encodeURIComponent(songmid)}&format=json&platform=yqq.json`;

    const data = await httpGet(url, {
        headers: {
            'Referer': 'https://y.qq.com/',
            'Origin': 'https://y.qq.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });

    // 接口返回 { code: 0, data: [song] }
    const song = data?.data?.[0];
    if (!song) return null;

    const detail = {
        id: song.mid,
        // media_mid 是 vkey 接口构造 filename 的关键字段（M500<media_mid>.mp3）
        // 来自 song.file.media_mid
        mediaMid: song.file?.media_mid || '',
        name: song.name || '',
        artist: song.singer?.map(s => s.name).join(', ') || '未知歌手',
        album: song.album?.name || '',
        duration: song.interval || 0,
        pic: song.album?.mid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${song.album.mid}.jpg` : ''
    };

    cache.set(cacheKey, detail, DETAIL_CACHE_TTL);
    return detail;
}

export default getQQDetail;
