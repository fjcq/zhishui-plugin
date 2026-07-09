/**
 * 酷狗音乐歌词接口
 * 使用酷狗公开歌词接口获取
 */

import { httpGet } from '../../utils/httpClient.js';
import cache from '../../utils/cache.js';
import { generateMid } from './crypto.js';

/** 酷狗歌词接口 */
const KUGOU_LYRIC_API = 'https://krcs.kugou.com/lyric';

/** 歌词缓存时间（秒） */
const LYRIC_CACHE_TTL = 3600;

/**
 * 获取酷狗歌词
 * @param {string} hash - 歌曲 hash
 * @returns {Promise<object|null>} 歌词信息 { lyric, translation }
 */
export async function getKugouLyric(hash) {
    if (!hash) return null;

    const cacheKey = `kugou:lyric:${hash}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const dfid = '-';
    const params = {
        hash,
        dfid,
        mid: generateMid(dfid),
        appid: '1005',
        clientver: '1070',
        clienttime: Math.floor(Date.now() / 1000),
        charset: 'utf8',
        band: 0,
        show_copyright: 0,
        format: 'json'
    };

    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        query.append(k, String(v));
    }
    const url = `${KUGOU_LYRIC_API}?${query.toString()}`;

    const data = await httpGet(url);

    if (!data || data.status !== 1 || !data.candidates?.length) {
        return null;
    }

    // 选取第一个候选（最匹配的）
    const candidate = data.candidates[0];
    const lyricUrl = candidate.candidate_content?.url;
    const translationUrl = data.candidates.find(c => c.trans_lang)?.candidate_content?.url;

    let lyricText = '';
    let translationText = '';

    if (lyricUrl) {
        const lyricResp = await httpGet(lyricUrl);
        if (typeof lyricResp === 'string') {
            lyricText = lyricResp;
        } else if (lyricResp?.content) {
            lyricText = lyricResp.content;
        }
    }

    if (translationUrl) {
        const transResp = await httpGet(translationUrl);
        if (typeof transResp === 'string') {
            translationText = transResp;
        } else if (transResp?.content) {
            translationText = transResp.content;
        }
    }

    if (!lyricText) return null;

    const result = { lyric: lyricText, translation: translationText };
    cache.set(cacheKey, result, LYRIC_CACHE_TTL);

    return result;
}

export default getKugouLyric;
