/**
 * 搜剧工具处理函数
 * 处理AI调用的影视搜索相关工具
 * 复用插件自身的资源站配置与 SearchVideo 接口
 */

import request from '../../../../lib/request/request.js';
import { Config, logger } from '../../../../components/index.js';
import { SearchVideo } from '../../../videoSearch/helpers.js';
import { isQrCodeLinkEnabled, generateQrCodeImage } from '../../../videoSearch/qrCode.js';
import { getSegment } from './shared/utils.js';

/** segment 加载 Promise 缓存（缓存 Promise 而非结果，避免并发调用触发多次 getSegment） */
let segmentPromise = null;

/**
 * 惰性获取 segment 实例
 * 首次调用时启动 getSegment() 并缓存其 Promise，后续并发调用共享同一个 Promise
 * 失败时 Promise 解析为 null 并被缓存，不会重试（避免重复加载失败的依赖）
 * @returns {Promise<object|null>} segment 实例或 null
 */
async function getSegmentInstance() {
    if (!segmentPromise) {
        segmentPromise = getSegment();
    }
    return segmentPromise;
}

/** 默认搜索页码 */
const DEFAULT_PAGE = 1;

/** 默认线路编号（从1开始） */
const DEFAULT_ROUTE_INDEX = 1;

/**
 * 检查是否为有效的 vod_id（兼容字符串和数字）
 * @param {*} value - 待检查的值
 * @returns {boolean}
 */
function isValidVodId(value) {
    if (value === undefined || value === null) {
        return false;
    }
    const s = String(value).trim();
    return s !== '' && /^\d+$/.test(s);
}

/**
 * 将 vod_id 转换为统一的字符串形式用于匹配
 * @param {*} value - vod_id
 * @returns {string}
 */
function normalizeVodId(value) {
    return String(value);
}

/** 工具返回结果数量上限 */
const MAX_RESULTS_LIMIT = 20;

/** 单条作品简介最大长度，避免结果过大占用 AI 上下文 */
const VOD_CONTENT_MAX_LENGTH = 200;

/**
 * 截断过长文本，超出部分以省略号结尾
 * @param {string} text - 原始文本
 * @param {number} maxLen - 最大长度
 * @returns {string} 截断后的文本
 */
function truncateText(text, maxLen) {
    if (!text || text.length <= maxLen) {
        return text || '';
    }
    return text.slice(0, maxLen) + '...';
}

/**
 * 调用资源站搜索接口
 * 使用 GET 方式请求，规避 Cloudflare 对 POST 的拦截
 * @param {string} apiUrl - 资源站 API URL
 * @param {string} keyword - 搜索关键词
 * @param {number} page - 页码
 * @param {string} [from=''] - 指定线路代码，CMS_V10 通过 from 参数过滤线路
 * @returns {Promise<object|null>} 搜索结果对象，失败返回 null
 */
async function fetchVideoSearchResults(apiUrl, keyword, page, from = '') {
    // 仅传必要参数 ac/wd/pg，避免某些资源站对 t=0&h=0 的过滤导致结果为空
    const params = new URLSearchParams({
        ac: 'detail',
        wd: keyword,
        pg: String(page)
    });
    // 指定线路代码时追加 from 参数，仅返回该线路（用于剔除云播/直链等非 m3u8 线路）
    if (from && typeof from === 'string' && from.trim() !== '') {
        params.set('from', from.trim());
    }
    const url = `${apiUrl}?${params.toString()}`;

    try {
        const data = await request.get(url, {
            responseType: 'json',
            closeCheckStatus: false,
            outErrorLog: false
        });
        return data;
    } catch (error) {
        // GET 失败时回退到原插件的 POST 实现
        logger.warn(`[搜剧工具] GET 请求失败，回退到 POST: ${error.message}`);
        try {
            return await SearchVideo(keyword, page, 0, 0, apiUrl, from);
        } catch (err) {
            throw new Error(err.message);
        }
    }
}

/**
 * 按 vod_id 精确获取作品详情
 * 资源站 CMS_V10 接口规范支持 ids 参数直接查询单个作品
 * 失败时直接抛错，由上层决定是否回退到关键词搜索
 * @param {string} apiUrl - 资源站 API URL
 * @param {string} vodId - 影视作品 ID
 * @param {string} [from=''] - 指定线路代码，CMS_V10 通过 from 参数过滤线路
 * @returns {Promise<object|null>} 包含目标作品的搜索结果对象
 */
async function fetchVideoById(apiUrl, vodId, from = '') {
    const params = new URLSearchParams({
        ac: 'detail',
        ids: normalizeVodId(vodId)
    });
    if (from && typeof from === 'string' && from.trim() !== '') {
        params.set('from', from.trim());
    }
    const url = `${apiUrl}?${params.toString()}`;

    const data = await request.get(url, {
        responseType: 'json',
        closeCheckStatus: false,
        outErrorLog: false
    });
    return data;
}

/**
 * 处理搜剧工具调用入口
 * @param {string} toolName - 工具名称
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象
 * @param {string} currentUserId - 当前对话用户ID
 * @returns {Promise<object>} 工具执行结果
 */
export async function handleVideoToolCall(toolName, params, e, currentUserId) {
    try {
        switch (toolName) {
            case 'search_videos':
                return await handleSearchVideos(params, e, currentUserId);
            case 'get_video_episodes':
                return await handleGetVideoEpisodes(params, e, currentUserId);
            case 'get_video_play_url':
                return await handleGetVideoPlayUrl(params, e, currentUserId);
            default:
                return { error: true, error_message: `未知的搜剧工具: ${toolName}` };
        }
    } catch (error) {
        logger.error(`[搜剧工具] ${toolName} 执行失败: ${error.message}`);
        return { error: true, error_message: `搜剧操作失败: ${error.message}` };
    }
}

/**
 * 解析资源站索引：优先使用工具参数，其次用户配置，再回退到全局默认
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象
 * @returns {Promise<{index: number, resource: object|null}>} 资源站索引与配置
 */
async function resolveSiteIndex(params, e) {
    const resources = Config.SearchVideos?.resources;
    if (!Array.isArray(resources) || resources.length === 0) {
        return { index: 0, resource: null };
    }

    if (Number.isInteger(params.site_index) && params.site_index >= 0 && params.site_index < resources.length) {
        return { index: params.site_index, resource: resources[params.site_index] };
    }

    if (e && e.user_id) {
        const userIdxStr = await Config.GetUserSearchVideos(e.user_id, 'idx');
        const userIdx = Number(userIdxStr);
        if (userIdxStr !== '' && !isNaN(userIdx) && userIdx >= 0 && userIdx < resources.length) {
            return { index: userIdx, resource: resources[userIdx] };
        }
    }

    if (e && e.group_id && Config.SearchVideos.GroupResourceIndex) {
        const groupConfig = Config.SearchVideos.GroupResourceIndex.find(item => item.group == e.group_id);
        if (groupConfig && !isNaN(groupConfig.index) && groupConfig.index >= 0 && groupConfig.index < resources.length) {
            return { index: groupConfig.index, resource: resources[groupConfig.index] };
        }
    }

    const defaultIdx = Config.SearchVideos.CurrentResourceIndex || 0;
    const safeIdx = defaultIdx >= 0 && defaultIdx < resources.length ? defaultIdx : 0;
    return { index: safeIdx, resource: resources[safeIdx] };
}

/**
 * 提取资源站的 API URL
 * @param {object} resource - 资源站配置
 * @returns {string|null} API URL
 */
function getResourceApiUrl(resource) {
    if (!resource) {
        return null;
    }
    const site = resource.site || resource;
    return site?.url || resource.url || null;
}

/**
 * 提取资源站指定的线路代码
 * @param {object} resource - 资源站配置
 * @returns {string} 线路代码，未配置返回空字符串
 */
function getResourceFromCode(resource) {
    if (!resource) {
        return '';
    }
    const site = resource.site || resource;
    const from = site?.from ?? resource?.from ?? '';
    return typeof from === 'string' ? from.trim() : '';
}

/**
 * 处理影视搜索
 * @param {object} params - 搜索参数
 * @param {object} e - 事件对象
 * @returns {Promise<object>} 搜索结果
 */
async function handleSearchVideos(params, e) {
    if (!Config.SearchVideos?.resources?.length) {
        return { error: true, error_message: '搜剧接口未配置，请管理员先在锅巴面板或 videoSearch.yaml 中配置资源站' };
    }

    const { index, resource } = await resolveSiteIndex(params, e);
    const apiUrl = getResourceApiUrl(resource);
    if (!apiUrl) {
        return { error: true, error_message: `资源站索引 ${index} 配置错误，未找到有效的 API URL` };
    }
    const from = getResourceFromCode(resource);

    const keyword = (params.keyword ?? '').toString().trim();
    const page = Number.isInteger(params.page) && params.page > 0 ? params.page : DEFAULT_PAGE;

    logger.info(`[搜剧工具] 搜索: "${keyword || '最新视频'}" | 页码: ${page} | 资源站: ${index}${from ? ` | 线路: ${from}` : ''}`);

    let searchResults;
    try {
        searchResults = await fetchVideoSearchResults(apiUrl, keyword, page, from);
    } catch (error) {
        return {
            error: true,
            error_message: `搜索请求失败: ${error.message}`
        };
    }

    logger.info(`[搜剧工具] 接口返回: code=${searchResults?.code} list=${Array.isArray(searchResults?.list) ? searchResults.list.length : 0}`);

    const list = Array.isArray(searchResults?.list) ? searchResults.list : [];
    if (list.length === 0) {
        return {
            success: true,
            keyword,
            page,
            site_index: index,
            total_results: 0,
            results: [],
            message: `未找到与 "${keyword || '最新视频'}" 相关的视频资源`
        };
    }

    const trimmed = list.slice(0, MAX_RESULTS_LIMIT).map(item => ({
        vod_id: item.vod_id,
        vod_name: item.vod_name,
        type_name: item.type_name || '',
        vod_year: item.vod_year || '',
        vod_area: item.vod_area || '',
        vod_remarks: item.vod_remarks || '',
        vod_pic: item.vod_pic || '',
        vod_content: truncateText((item.vod_content || '').replace(/\s+/g, ' ').trim(), VOD_CONTENT_MAX_LENGTH)
    }));

    logger.info(`[搜剧工具] 搜索完成: "${keyword || '最新视频'}" | 找到${trimmed.length}条结果`);

    return {
        success: true,
        keyword,
        page,
        site_index: index,
        pagecount: searchResults.pagecount || 1,
        total_results: trimmed.length,
        results: trimmed
    };
}

/**
 * 处理获取剧集列表
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象
 * @param {string} currentUserId - 当前用户ID
 * @returns {Promise<object>} 剧集列表结果
 */
async function handleGetVideoEpisodes(params, e, currentUserId) {
    if (!Config.SearchVideos?.resources?.length) {
        return { error: true, error_message: '搜剧接口未配置' };
    }

    const { index, resource } = await resolveSiteIndex(params, e);
    const apiUrl = getResourceApiUrl(resource);
    if (!apiUrl) {
        return { error: true, error_message: `资源站索引 ${index} 配置错误` };
    }
    const from = getResourceFromCode(resource);

    let vodId = params.vod_id;
    let vodName = (params.vod_name || '').toString().trim();

    // 参数缺失时，尝试用用户当前搜索缓存中已选中的作品
    if (!isValidVodId(vodId) && !vodName && e && e.user_id) {
        const cached = await loadCachedSelectedVideo(e.user_id);
        if (cached) {
            vodId = cached.vod_id;
            vodName = cached.vod_name;
        }
    }

    if (!isValidVodId(vodId) && !vodName) {
        return {
            error: true,
            error_message: '请提供 vod_id 或 vod_name 参数，或先让用户使用搜剧命令搜索'
        };
    }

    let searchResults;
    try {
        // 优先按 vod_id 精确查询；仅有 vod_name 时退化为关键词搜索
        searchResults = isValidVodId(vodId)
            ? await fetchVideoById(apiUrl, vodId, from)
            : await fetchVideoSearchResults(apiUrl, vodName, 1, from);
    } catch (error) {
        return { error: true, error_message: `获取剧集失败: ${error.message}` };
    }

    const list = Array.isArray(searchResults?.list) ? searchResults.list : [];
    if (list.length === 0) {
        return { error: true, error_message: `未找到作品: ${vodName || vodId}` };
    }

    // 精确匹配 vod_id（统一为字符串比较，兼容数字/字符串两种返回格式）或 vod_name
    const target = isValidVodId(vodId)
        ? (() => {
            const targetId = normalizeVodId(vodId);
            return list.find(item => normalizeVodId(item.vod_id) === targetId) || list[0];
        })()
        : list.find(item => item.vod_name === vodName) || list[0];

    const routes = parseVideoRoutes(target);

    logger.info(`[搜剧工具] 获取剧集: "${target.vod_name}" | ${routes.length}条线路`);

    // 剥离 episode_links，AI 不需要原始播放链接，保留剧集名即可
    const routesForAI = routes.map(route => ({
        route_name: route.route_name,
        route_index: route.route_index,
        total_episodes: route.total_episodes,
        episode_names: route.episode_names
    }));

    return {
        success: true,
        vod_id: target.vod_id,
        vod_name: target.vod_name,
        site_index: index,
        total_routes: routesForAI.length,
        routes: routesForAI
    };
}

/**
 * 处理获取播放链接
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象
 * @param {string} currentUserId - 当前用户ID
 * @returns {Promise<object>} 播放链接结果
 */
async function handleGetVideoPlayUrl(params, e, currentUserId) {
    if (!Config.SearchVideos?.resources?.length) {
        return { error: true, error_message: '搜剧接口未配置' };
    }

    const playerUrl = Config.SearchVideos.player;
    if (!playerUrl) {
        return { error: true, error_message: '播放器地址未配置，请联系管理员在 videoSearch.yaml 中设置 player' };
    }

    const { index, resource } = await resolveSiteIndex(params, e);
    const apiUrl = getResourceApiUrl(resource);
    if (!apiUrl) {
        return { error: true, error_message: `资源站索引 ${index} 配置错误` };
    }
    const from = getResourceFromCode(resource);

    let vodId = params.vod_id;
    let vodName = (params.vod_name || '').toString().trim();

    if (!isValidVodId(vodId) && !vodName && e && e.user_id) {
        const cached = await loadCachedSelectedVideo(e.user_id);
        if (cached) {
            vodId = cached.vod_id;
            vodName = cached.vod_name;
        }
    }

    if (!isValidVodId(vodId) && !vodName) {
        return {
            error: true,
            error_message: '请提供 vod_id 或 vod_name 参数，或先让用户使用搜剧命令搜索'
        };
    }

    let searchResults;
    try {
        // 优先按 vod_id 精确查询；仅有 vod_name 时退化为关键词搜索
        searchResults = isValidVodId(vodId)
            ? await fetchVideoById(apiUrl, vodId, from)
            : await fetchVideoSearchResults(apiUrl, vodName, 1, from);
    } catch (error) {
        return { error: true, error_message: `获取播放链接失败: ${error.message}` };
    }

    const list = Array.isArray(searchResults?.list) ? searchResults.list : [];
    if (list.length === 0) {
        return { error: true, error_message: `未找到作品: ${vodName || vodId}` };
    }

    const target = isValidVodId(vodId)
        ? (() => {
            const targetId = normalizeVodId(vodId);
            return list.find(item => normalizeVodId(item.vod_id) === targetId) || list[0];
        })()
        : list.find(item => item.vod_name === vodName) || list[0];

    const routes = parseVideoRoutes(target);
    if (routes.length === 0) {
        return { error: true, error_message: `作品 ${target.vod_name} 没有可用的播放线路` };
    }

    const routeIdx = (Number.isInteger(params.route_index) && params.route_index >= 1 && params.route_index <= routes.length)
        ? params.route_index - 1
        : 0;

    const route = routes[routeIdx];
    const episodeIdx = (Number.isInteger(params.episode) && params.episode >= 1 && params.episode <= route.episode_names.length)
        ? params.episode - 1
        : 0;

    if (!route.episode_links[episodeIdx]) {
        return { error: true, error_message: `集数 ${params.episode} 不存在，该线路共 ${route.episode_names.length} 集` };
    }

    const fullLink = playerUrl + route.episode_links[episodeIdx];

    logger.info(`[搜剧工具] 获取播放链接: ${target.vod_name} | 线路: ${route.route_name} | 集: ${route.episode_names[episodeIdx]}`);

    // 二维码模式：直接发送二维码图片给用户，不向 AI 暴露原始链接，规避链接风控
    if (isQrCodeLinkEnabled()) {
        const qrSentResult = await sendPlayUrlAsQrCode(e, fullLink);
        if (qrSentResult) {
            return {
                success: true,
                vod_id: target.vod_id,
                vod_name: target.vod_name,
                site_index: index,
                route_name: route.route_name,
                route_index: routeIdx + 1,
                episode_name: route.episode_names[episodeIdx],
                episode: episodeIdx + 1,
                total_episodes: route.episode_names.length,
                message: '已将播放链接以二维码图片形式发送给用户，请提示用户扫码在浏览器中观看'
            };
        }
        // 二维码发送失败则回退到文本链接
        logger.warn('[搜剧工具] 二维码发送失败，回退到文本链接');
    }

    return {
        success: true,
        vod_id: target.vod_id,
        vod_name: target.vod_name,
        site_index: index,
        route_name: route.route_name,
        route_index: routeIdx + 1,
        episode_name: route.episode_names[episodeIdx],
        episode: episodeIdx + 1,
        total_episodes: route.episode_names.length,
        play_url: fullLink,
        tip: '请将链接复制到浏览器中打开观看'
    };
}

/**
 * 以二维码图片形式发送播放链接
 * 生成或发送失败时返回 false，由调用方回退到文本链接
 * @param {object} e - 事件对象
 * @param {string} playUrl - 播放链接
 * @returns {Promise<boolean>} 是否发送成功
 */
async function sendPlayUrlAsQrCode(e, playUrl) {
    if (!e || !e.reply) {
        logger.error('[搜剧工具] 缺少事件对象 e.reply，无法发送二维码');
        return false;
    }

    const qrUri = await generateQrCodeImage(playUrl);
    if (!qrUri) {
        return false;
    }

    const segment = await getSegmentInstance();
    if (!segment) {
        logger.error('[搜剧工具] segment 模块加载失败，无法发送二维码');
        return false;
    }

    try {
        await e.reply(segment.image(qrUri));
        return true;
    } catch (error) {
        logger.error(`[搜剧工具] 二维码图片发送失败：${error.message}`);
        return false;
    }
}

/**
 * 加载用户当前已搜索并选中的作品缓存
 * @param {string|number} userId - 用户ID
 * @returns {Promise<{vod_id: string|number, vod_name: string}|null>} 缓存的选中作品
 */
async function loadCachedSelectedVideo(userId) {
    if (!userId || typeof Config.GetUserSearchVideos !== 'function') {
        return null;
    }
    try {
        const searchResultsStr = await Config.GetUserSearchVideos(userId, 'SearchResults');
        if (!searchResultsStr) {
            return null;
        }
        const searchResults = JSON.parse(searchResultsStr);
        const list = Array.isArray(searchResults?.list) ? searchResults.list : [];
        if (list.length === 0) {
            return null;
        }

        const selectedIdStr = await Config.GetUserSearchVideos(userId, 'selectedID');
        // 用字符串统一比较，避免 Number 转换 NaN 风险与类型不一致问题
        const selectedId = selectedIdStr != null ? String(selectedIdStr).trim() : '';
        const selected = selectedId
            ? list.find(item => normalizeVodId(item.vod_id) === selectedId)
            : null;

        // 仅当存在有效选中ID时返回，避免误回退到 list[0] 导致返回错误作品
        if (selected) {
            return { vod_id: selected.vod_id, vod_name: selected.vod_name };
        }
    } catch (error) {
        logger.warn(`[搜剧工具] 读取用户搜索缓存失败: ${error.message}`);
    }
    return null;
}

/**
 * 解析影视作品的播放线路与剧集列表
 * @param {object} vodItem - 视频条目数据
 * @returns {Array<object>} 线路数组
 */
function parseVideoRoutes(vodItem) {
    if (!vodItem || !vodItem.vod_play_from || !vodItem.vod_play_url) {
        return [];
    }

    const routeCodes = vodItem.vod_play_from.split('$$$');
    const resourceGroups = vodItem.vod_play_url.split('$$$');

    return routeCodes.map((code, idx) => {
        const episodesWithLinks = (resourceGroups[idx] || resourceGroups[0] || '').split('#').filter(Boolean);
        const episodeNames = [];
        const episodeLinks = [];

        for (const ep of episodesWithLinks) {
            const [name, link] = ep.split('$');
            episodeNames.push(name || '');
            episodeLinks.push(link || '');
        }

        return {
            route_name: code,
            route_index: idx + 1,
            total_episodes: episodeNames.length,
            episode_names: episodeNames,
            episode_links: episodeLinks
        };
    });
}

/**
 * 搜剧工具名称列表
 */
export const VIDEO_TOOLS = ['search_videos', 'get_video_episodes', 'get_video_play_url'];
