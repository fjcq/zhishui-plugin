/**
 * QQ音乐搜索接口
 * 使用 musicu.fcg 接口搜索歌曲
 *
 * 接口：https://u.y.qq.com/cgi-bin/musicu.fcg
 * 该接口对免费接口可不携带 sign
 */

import { httpPost } from '../../utils/httpClient.js';
import cache from '../../utils/cache.js';

/** QQ音乐 musicu.fcg 接口 */
const QQ_MUSICU_API = 'https://u.y.qq.com/cgi-bin/musicu.fcg';

/** 搜索结果缓存时间（秒） */
const SEARCH_CACHE_TTL = 600;

/**
 * 构造搜索请求体
 * @param {string} keyword - 搜索关键词
 * @param {number} limit - 返回数量
 * @returns {object} 请求体
 */
function buildSearchBody(keyword, limit) {
    return {
        'comm': {
            g_tk: 235530277,
            uin: '0',
            format: 'json',
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            notice: 0,
            platform: 'h5',
            needNewCode: 1,
            ct: 23,
            cv: 0
        },
        'req_0': {
            module: 'music.search.SearchCgiService',
            method: 'DoSearchForQQMusicDesktop',
            param: {
                remoteplace: 'txt.mqq.all',
                searchid: '64237725668973550',
                search_type: 0,
                query: keyword,
                page_num: 1,
                num_per_page: limit
            }
        }
    };
}

/**
 * QQ音乐搜索歌曲
 * @param {string} keyword - 搜索关键词
 * @param {number} limit - 返回数量限制
 * @returns {Promise<Array|null>} 标准化后的歌曲列表
 */
export async function qqSearch(keyword, limit = 5) {
    if (!keyword) return null;

    const actualLimit = Math.min(Math.max(limit, 1), 30);

    const cacheKey = `qq:search:${keyword}:${actualLimit}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const body = buildSearchBody(keyword, actualLimit);

    const data = await httpPost(QQ_MUSICU_API, {
        headers: {
            'Referer': 'https://y.qq.com/',
            'Origin': 'https://y.qq.com'
        },
        body
    });

    if (!data) return null;

    const searchResult = data['req_0']?.data?.body;
    if (!searchResult?.song?.list?.length) return null;

    const songs = searchResult.song.list;
    const results = songs.map((song, index) => ({
        id: song.mid,
        // media_mid 是 vkey 接口构造 filename 的关键字段（M500<media_mid>.mp3）
        mediaMid: song.file?.media_mid || '',
        name: song.name,
        artist: song.singer?.map(s => s.name).join(', ') || '未知歌手',
        album: song.album?.name || '',
        duration: song.interval || 0,
        pic: song.album?.mid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${song.album.mid}.jpg` : '',
        // QQ音乐付费信息：pay.pay_play=0 表示免费可播放，=1 表示 VIP
        payPlay: song.pay?.pay_play ?? 0,
        // 各音质文件大小（用于判断是否可用）
        size128: song.file?.size_128mp3 || 0,
        size320: song.file?.size_320mp3 || 0,
        sizeM4a: song.file?.size_m4a || 0,
        sizeFlac: song.file?.size_flac || 0
    }));

    cache.set(cacheKey, results, SEARCH_CACHE_TTL);

    return results;
}

export default qqSearch;
