/**
 * 音乐平台官方 API 适配器
 * 直接调用各平台官方接口，不依赖第三方公共实例或 NeteaseCloudMusicApi
 *
 * 已验证可用的接口：
 * 【网易云】music.163.com
 * - /api/search/get        搜索歌曲
 * - /api/song/detail       歌曲详情（封面、歌手、专辑）
 * - /song/media/outer/url  音频直链（302重定向到CDN，免费歌曲无需登录）
 * - /api/song/lyric        歌词
 * - /api/playlist/detail   歌单详情
 *
 * 【酷狗】mobilecdn.kugou.com
 * - /api/v3/search/song    搜索歌曲（可用）
 * - 播放链接需签名计算，暂不支持，降级到 @meting/core
 */

import { logger } from '../../../../components/index.js';

/** 请求超时时间(毫秒) */
const REQUEST_TIMEOUT = 10000;

// ==================== 通用请求工具 ====================

/**
 * 发送 GET 请求
 * @param {string} url - 完整请求URL
 * @param {object} headers - 请求头
 * @param {number} timeout - 超时时间(毫秒)
 * @returns {Promise<object|null>} 解析后的 JSON 数据或 null
 */
async function httpGet(url, headers = {}, timeout = REQUEST_TIMEOUT) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                ...headers
            }
        });

        clearTimeout(timer);

        if (!response.ok) {
            logger.warn(`[音乐API] HTTP ${response.status} | ${url.substring(0, 80)}`);
            return null;
        }

        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError') {
            logger.warn(`[音乐API] 请求超时 | ${url.substring(0, 80)}`);
        } else {
            logger.warn(`[音乐API] 请求失败: ${error.message}`);
        }
        return null;
    }
}

// ==================== 网易云音乐 ====================

/** 网易云官方API基础地址 */
const NETEASE_API_BASE = 'https://music.163.com';

/**
 * 检测网易云官方 API 是否可用
 * @returns {Promise<boolean>} API是否可用
 */
export async function checkNcmAvailable() {
    try {
        const url = new URL('/api/search/get', NETEASE_API_BASE);
        url.searchParams.append('s', 'test');
        url.searchParams.append('type', '1');
        url.searchParams.append('limit', '1');
        url.searchParams.append('offset', '0');

        const data = await httpGet(url.toString(), {
            'Referer': 'https://music.163.com'
        }, 5000);

        return data && (data.code === 200 || data.result);
    } catch (error) {
        return false;
    }
}

/**
 * 网易云搜索歌曲
 * @param {string} keyword - 搜索关键词
 * @param {number} limit - 返回数量限制
 * @returns {Promise<Array|null>} 标准化后的歌曲列表
 */
export async function ncmSearch(keyword, limit = 5) {
    try {
        const url = new URL('/api/search/get', NETEASE_API_BASE);
        url.searchParams.append('s', keyword);
        url.searchParams.append('type', '1');
        url.searchParams.append('limit', String(Math.min(limit, 30)));
        url.searchParams.append('offset', '0');

        const data = await httpGet(url.toString(), {
            'Referer': 'https://music.163.com'
        });

        if (!data || !data.result || !data.result.songs) {
            logger.warn(`[网易云搜索] 无结果 | 关键词:${keyword}`);
            return null;
        }

        const songs = data.result.songs;
        const results = songs.map((song, index) => ({
            index: index + 1,
            name: song.name,
            artist: song.artists?.map(a => a.name).join(', ') || '未知歌手',
            id: String(song.id),
            album: song.album?.name || '',
            duration: Math.round((song.duration || song.dt || 0) / 1000),
            platform: 'netease'
        }));

        logger.info(`[网易云搜索] 找到${results.length}首 | 关键词:${keyword}`);
        return results;
    } catch (error) {
        logger.error(`[网易云搜索] 异常: ${error.message}`);
        return null;
    }
}

/**
 * 获取网易云歌曲播放URL（音频直链）
 * @param {string} songId - 歌曲ID
 * @returns {Promise<{url:string, canPlay:boolean}|null>} 音频信息
 */
export async function ncmSongUrl(songId) {
    try {
        const directUrl = `https://music.163.com/song/media/outer/url?id=${songId}.mp3`;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(directUrl, {
            method: 'HEAD',
            signal: controller.signal,
            redirect: 'follow',
            headers: {
                'Referer': 'https://music.163.com',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        clearTimeout(timer);

        const contentType = response.headers.get('content-type') || '';
        const isAudio = contentType.includes('audio/') || contentType.includes('mpeg');

        if (response.ok && isAudio) {
            logger.info(`[网易云音链] 获取成功 | ID:${songId} | 类型:${contentType}`);
            return { url: directUrl, canPlay: true };
        }

        if (response.status === 403 || (!isAudio && response.ok)) {
            logger.info(`[网易云音链] 歌曲需要VIP或受版权限制 | ID:${songId}`);
            return { url: directUrl, canPlay: false };
        }

        return { url: directUrl, canPlay: false };
    } catch (error) {
        if (error.name === 'AbortError') {
            logger.info(`[网易云音链] 验证超时，仍返回URL | ID:${songId}`);
        } else {
            logger.warn(`[网易云音链] 验证失败: ${error.message}，仍返回URL`);
        }
        return { url: `https://music.163.com/song/media/outer/url?id=${songId}.mp3`, canPlay: true };
    }
}

/**
 * 获取网易云歌曲详情
 * @param {string} songId - 歌曲ID
 * @returns {Promise<object|null>} 歌曲详情对象
 */
export async function ncmSongDetail(songId) {
    try {
        const url = new URL('/api/song/detail/', NETEASE_API_BASE);
        url.searchParams.append('id', songId);
        url.searchParams.append('ids', `[${songId}]`);

        const data = await httpGet(url.toString(), {
            'Referer': 'https://music.163.com'
        });

        if (!data || !data.songs || data.songs.length === 0) return null;

        const song = data.songs[0];
        return {
            name: song.name,
            artist: song.artists?.map(a => a.name).join(', ') || '未知歌手',
            id: String(song.id),
            album: song.album?.name || '',
            pic: song.album?.picUrl || song.album?.blurPicUrl || '',
            duration: Math.round((song.duration || 0) / 1000)
        };
    } catch (error) {
        logger.error(`[网易云详情] 异常: ${error.message}`);
        return null;
    }
}

/**
 * 获取网易云歌词
 * @param {string} songId - 歌曲ID
 * @param {boolean} showTranslation - 是否包含翻译
 * @returns {Promise<object|null>} 歌词信息
 */
export async function ncmLyric(songId, showTranslation = true) {
    try {
        const url = new URL('/api/song/lyric', NETEASE_API_BASE);
        url.searchParams.append('id', songId);
        url.searchParams.append('lv', '1');
        url.searchParams.append('tv', showTranslation ? '1' : '0');

        const data = await httpGet(url.toString(), {
            'Referer': 'https://music.163.com'
        });

        if (!data || !data.lrc) return null;

        return {
            lyricText: data.lrc.lyric || '',
            translationText: showTranslation ? (data.tlyric?.lyric || '') : ''
        };
    } catch (error) {
        logger.error(`[网易云歌词] 异常: ${error.message}`);
        return null;
    }
}

/**
 * 获取网易云歌单详情
 * @param {string} playlistId - 歌单ID
 * @param {number} limit - 返回数量限制
 * @returns {Promise<object|null>} 歌单信息
 */
export async function ncmPlaylist(playlistId, limit = 10) {
    try {
        const url = new URL('/api/playlist/detail', NETEASE_API_BASE);
        url.searchParams.append('id', playlistId);

        const data = await httpGet(url.toString(), {
            'Referer': 'https://music.163.com'
        });

        if (!data || !data.result) return null;

        const playlist = data.result;
        const tracks = (playlist.tracks || []).slice(0, limit);

        const songs = tracks.map((track, index) => ({
            index: index + 1,
            name: track.name,
            artist: track.artists?.map(a => a.name).join(', ') || '未知歌手',
            album: track.album?.name || '',
            id: String(track.id),
            duration: Math.round((track.duration || 0) / 1000)
        }));

        return {
            name: playlist.name || '未知歌单',
            description: playlist.description || '',
            totalCount: playlist.trackIds?.length || tracks.length,
            songs
        };
    } catch (error) {
        logger.error(`[网易云歌单] 异常: ${error.message}`);
        return null;
    }
}

// ==================== 酷狗音乐 ====================

/** 酷狗API基础地址 */
const KUGOU_API_BASE = 'https://mobilecdn.kugou.com';

/**
 * 检测酷狗搜索 API 是否可用
 * @returns {Promise<boolean>} API是否可用
 */
export async function checkKugouAvailable() {
    try {
        const url = `${KUGOU_API_BASE}/api/v3/search/song?keyword=test&page=1&pagesize=1`;
        const data = await httpGet(url, {}, 5000);
        return data && data.status === 1;
    } catch (error) {
        return false;
    }
}

/**
 * 酷狗搜索歌曲
 * 使用酷狗移动端公开搜索接口，返回标准化的歌曲列表
 * 注意：酷狗的播放链接需要签名计算，此接口仅提供搜索能力
 * @param {string} keyword - 搜索关键词
 * @param {number} limit - 返回数量限制
 * @returns {Promise<Array|null>} 标准化后的歌曲列表
 */
export async function kugouSearch(keyword, limit = 5) {
    try {
        const url = `${KUGOU_API_BASE}/api/v3/search/song?keyword=${encodeURIComponent(keyword)}&page=1&pagesize=${Math.min(limit, 30)}`;

        const data = await httpGet(url);

        if (!data || data.status !== 1 || !data.data?.info?.length) {
            logger.warn(`[酷狗搜索] 无结果 | 关键词:${keyword}`);
            return null;
        }

        const songs = data.data.info;
        const results = songs.map((song, index) => ({
            index: index + 1,
            name: song.songname || song.filename?.split(' - ')?.[1] || '',
            artist: song.singername?.split('、').join(', ') || '未知歌手',
            id: song.hash,
            album: song.album_name || '',
            duration: song.duration || 0,
            platform: 'kugou'
        }));

        logger.info(`[酷狗搜索] 找到${results.length}首 | 关键词:${keyword}`);
        return results;
    } catch (error) {
        logger.error(`[酷狗搜索] 异常: ${error.message}`);
        return null;
    }
}

/**
 * 获取平台链接
 * @param {string} songId - 歌曲ID
 * @returns {string} 网易云网页链接
 */
export function getNcmLink(songId) {
    return `https://music.163.com/#/song?id=${songId}`;
}
