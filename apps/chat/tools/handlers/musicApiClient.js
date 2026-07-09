/**
 * 自建音乐 API 客户端
 * 作为 musicService.js 调用自建 API 服务的入口
 * 提供与 ncmService.js 对等的接口
 *
 * 调用本地 HTTP 服务，通过 isServerRunning() 判断可用性
 */

import { logger } from '../../../../components/index.js';
import { Config } from '../../../../components/index.js';
import { isServerRunning, getServerStatus } from '../server/index.js';

/** 客户端调用超时（毫秒） */
const CLIENT_TIMEOUT = 5000;

/** 支持的平台列表 */
const SUPPORTED_PLATFORMS = ['qq', 'kugou', 'kuwo'];

/** 平台代码映射：Yunzai 内部代码 → 自建API路由代码 */
const PLATFORM_CODE_MAP = {
    qq: 'qq',
    tencent: 'qq',
    kugou: 'kugou',
    kuwo: 'kuwo'
};

/**
 * 获取自建 API 服务地址
 * @returns {string} 服务基础地址
 */
function getBaseUrl() {
    const config = Config.getDefOrConfig('musicApi') || {};
    const host = config.host || '127.0.0.1';
    const port = getServerStatus().port || config.port || 3210;
    return `http://${host}:${port}`;
}

/**
 * 调用自建 API
 * @param {string} path - 路径，如 /api/kugou/search
 * @param {object} params - 查询参数
 * @returns {Promise<object|null>} 响应数据或 null
 */
async function callApi(path, params = {}) {
    if (!isServerRunning()) {
        return null;
    }

    const url = new URL(path, getBaseUrl());
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.append(key, String(value));
        }
    }

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT);

        const response = await fetch(url.toString(), {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'zhishui-plugin/musicApiClient'
            }
        });

        clearTimeout(timer);

        if (!response.ok) return null;

        const result = await response.json();
        if (result.code !== 200) {
            logger.warn(`[自建API] 调用失败 | ${path} | ${result.message}`);
            return null;
        }
        return result.data;
    } catch (error) {
        if (error.name === 'AbortError') {
            logger.warn(`[自建API] 请求超时 | ${path}`);
        } else {
            logger.warn(`[自建API] 请求失败 | ${path} | ${error.message}`);
        }
        return null;
    }
}

/**
 * 校验平台是否支持
 * @param {string} platform - 平台代码
 * @returns {boolean} 是否支持
 */
function isPlatformSupported(platform) {
    return Object.prototype.hasOwnProperty.call(PLATFORM_CODE_MAP, platform);
}

/**
 * 转换平台代码为自建API路由代码
 * @param {string} platform - Yunzai 内部平台代码
 * @returns {string} 自建API路由代码
 */
function mapPlatformCode(platform) {
    return PLATFORM_CODE_MAP[platform] || platform;
}

/**
 * 检查自建 API 服务是否可用
 * @returns {Promise<boolean>} 是否可用
 */
export async function checkMusicApiAvailable() {
    if (!isServerRunning()) return false;

    const data = await callApi('/api/health');
    return data?.status === 'ok';
}

/**
 * 搜索音乐
 * @param {string} platform - 平台代码 qq/tencent/kugou/kuwo
 * @param {string} keyword - 搜索关键词
 * @param {number} limit - 返回数量
 * @returns {Promise<Array|null>} 歌曲列表
 */
export async function musicApiSearch(platform, keyword, limit = 5) {
    if (!isPlatformSupported(platform)) return null;
    const apiPlatform = mapPlatformCode(platform);

    const data = await callApi(`/api/${apiPlatform}/search`, { keyword, limit });
    if (!data?.songs?.length) return null;

    return data.songs.map((song, index) => ({
        index: index + 1,
        name: song.name,
        artist: song.artist,
        id: song.id,
        // 透传 mediaMid（QQ音乐构造 vkey filename 必需）
        mediaMid: song.mediaMid || '',
        album: song.album || '',
        duration: song.duration || 0,
        pic: song.pic || '',
        platform
    }));
}

/**
 * 获取播放链接
 * @param {string} platform - 平台代码
 * @param {string} id - 歌曲 ID
 * @param {string} [mediaMid=''] - media_mid（QQ音乐构造 vkey filename 必需）
 * @returns {Promise<object|null>} 播放链接信息 { url, canPlay, quality }
 */
export async function musicApiSongUrl(platform, id, mediaMid = '') {
    if (!isPlatformSupported(platform)) return null;
    const apiPlatform = mapPlatformCode(platform);

    const params = { id };
    // QQ音乐需要 mediaMid 才能构造正确的 vkey filename
    if (mediaMid) {
        params.mediaMid = mediaMid;
    }

    return await callApi(`/api/${apiPlatform}/url`, params);
}

/**
 * 获取歌词
 * @param {string} platform - 平台代码
 * @param {string} id - 歌曲 ID
 * @returns {Promise<object|null>} 歌词信息 { lyric, translation }
 */
export async function musicApiLyric(platform, id) {
    if (!isPlatformSupported(platform)) return null;
    const apiPlatform = mapPlatformCode(platform);

    return await callApi(`/api/${apiPlatform}/lyric`, { id });
}

/**
 * 获取歌曲详情
 * @param {string} platform - 平台代码
 * @param {string} id - 歌曲 ID
 * @returns {Promise<object|null>} 歌曲详情
 */
export async function musicApiDetail(platform, id) {
    if (!isPlatformSupported(platform)) return null;
    const apiPlatform = mapPlatformCode(platform);

    return await callApi(`/api/${apiPlatform}/detail`, { id });
}

/**
 * 获取歌单
 * @param {string} platform - 平台代码
 * @param {string} playlistId - 歌单 ID
 * @param {number} limit - 返回数量
 * @returns {Promise<object|null>} 歌单信息
 */
export async function musicApiPlaylist(platform, playlistId, limit = 10) {
    if (!isPlatformSupported(platform)) return null;
    const apiPlatform = mapPlatformCode(platform);

    return await callApi(`/api/${apiPlatform}/playlist`, { id: playlistId, limit });
}

export default {
    checkMusicApiAvailable,
    musicApiSearch,
    musicApiSongUrl,
    musicApiLyric,
    musicApiDetail,
    musicApiPlaylist,
    isPlatformSupported,
    SUPPORTED_PLATFORMS
};
