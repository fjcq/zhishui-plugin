/**
 * QQ音乐歌词接口
 * 使用 QQ音乐公开歌词接口
 *
 * 接口：https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg
 * 必需参数：songmid、nobase64=1、format=json、musicid
 */

import { httpGet } from '../../utils/httpClient.js';
import cache from '../../utils/cache.js';

/** QQ音乐歌词接口 */
const QQ_LYRIC_API = 'https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg';

/** 歌词缓存时间（秒） */
const LYRIC_CACHE_TTL = 3600;

/**
 * 获取QQ音乐歌词
 * @param {string} songmid - 歌曲 mid
 * @returns {Promise<object|null>} 歌词信息 { lyric, translation }
 */
export async function getQQLyric(songmid) {
    if (!songmid) return null;

    const cacheKey = `qq:lyric:${songmid}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
        songmid: songmid,
        nobase64: '1',
        format: 'json',
        musicid: '0',
        version: '15',
        platform: 'yqq.json',
        inCharset: 'utf8',
        outCharset: 'utf-8',
        g_tk: '5381'
    });
    const url = `${QQ_LYRIC_API}?${params.toString()}`;

    const data = await httpGet(url, {
        headers: {
            'Referer': 'https://y.qq.com/',
            'Origin': 'https://y.qq.com'
        }
    });

    if (!data || data.code !== 0) return null;

    const result = {
        lyric: data.lyric || '',
        translation: data.trans || ''
    };

    if (!result.lyric) return null;

    cache.set(cacheKey, result, LYRIC_CACHE_TTL);
    return result;
}

export default getQQLyric;
