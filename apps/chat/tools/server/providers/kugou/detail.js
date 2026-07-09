/**
 * 酷狗音乐歌曲详情接口
 * 基于播放链接接口返回歌曲详情
 *
 * 注：酷狗没有公开的纯详情接口，name/artist/album 建议从搜索接口获取
 * 这里返回 hash 关联的播放链接信息，供客户端补充
 */

import cache from '../../utils/cache.js';
import { getKugouPlayUrl } from './songUrl.js';

/** 详情缓存时间（秒） */
const DETAIL_CACHE_TTL = 1800;

/**
 * 获取酷狗歌曲详情
 * @param {string} hash - 歌曲 hash
 * @returns {Promise<object|null>} 歌曲详情
 */
export async function getKugouDetail(hash) {
    if (!hash) return null;

    const cacheKey = `kugou:detail:${hash}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    // 复用 playUrl 接口返回的信息
    const playInfo = await getKugouPlayUrl(hash);

    const detail = {
        id: hash,
        name: '',
        artist: '未知歌手',
        album: '',
        duration: 0,
        pic: '',
        url: playInfo?.url || '',
        canPlay: playInfo?.canPlay || false,
        quality: playInfo?.quality || '0'
    };

    cache.set(cacheKey, detail, DETAIL_CACHE_TTL);
    return detail;
}

export default getKugouDetail;
