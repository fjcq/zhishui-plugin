/**
 * 酷我音乐歌词接口
 * 使用酷我公开歌词接口
 *
 * 接口：https://m.kuwo.cn/newh5/singles/songinfo?mid=xxx
 * 备选：https://www.kuwo.cn/api/www/music/musicInfo?mid=xxx
 */

import { httpGet } from '../../utils/httpClient.js';
import cache from '../../utils/cache.js';
import { getKuwoToken, buildKuwoHeaders } from './crypto.js';

/** 酷我歌词接口 */
const KUWO_LYRIC_API = 'https://m.kuwo.cn/newh5/singles/songinfo';

/** 歌词缓存时间（秒） */
const LYRIC_CACHE_TTL = 3600;

/**
 * 获取酷我歌词
 * @param {string} rid - 歌曲 rid
 * @returns {Promise<object|null>} 歌词信息 { lyric, translation }
 */
export async function getKuwoLyric(rid) {
    if (!rid) return null;

    const cacheKey = `kuwo:lyric:${rid}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const token = await getKuwoToken();

    const params = new URLSearchParams({
        mid: String(rid)
    });
    const url = `${KUWO_LYRIC_API}?${params.toString()}`;

    const data = await httpGet(url, {
        headers: {
            ...buildKuwoHeaders(token || ''),
            'Referer': 'https://m.kuwo.cn/'
        }
    });

    if (!data || data.status !== 'success' || !data.data) {
        return null;
    }

    const songData = data.data;
    const lyric = songData.lrclines || songData.lyric || '';
    const translation = songData.tranLrc || songData.translation || '';

    if (!lyric) return null;

    const result = { lyric, translation };
    cache.set(cacheKey, result, LYRIC_CACHE_TTL);

    return result;
}

export default getKuwoLyric;
