/**
 * 搜剧模块工具函数
 */
// 引入公共工具函数
import { isNotNull, chineseToNumber } from '../../lib/common/utils.js';

/**
 * 查找线路名称或线路代码在RouteList中的索引
 * @param {string} searchValue - 要查找的线路名称或线路代码
 * @param {Array<Object>} RouteList - 包含线路信息的对象数组
 * @returns {number} - 如果找到匹配的线路名称或线路代码，返回其在RouteList中的索引；否则返回0
 */
export function findRouteIndex(searchValue, RouteList) {
    for (let i = 0; i < RouteList.length; i++) {
        const item = RouteList[i];

        const isNameMatch = (typeof item.RouteName === 'string' && item.RouteName.trim() !== '') &&
            item.RouteName.trim() === searchValue.trim();
        const isCodeMatch = (typeof item.RouteCode === 'string' && item.RouteCode.trim() !== '') &&
            item.RouteCode.trim() === searchValue.trim();

        if (isNameMatch || isCodeMatch) {
            return i;
        }
    }

    // 查找失败，返回0
    return 0;
}

/**
 * 提取搜索关键词
 * @param {string} message 用户输入的消息
 * @returns {string} 搜索关键词
 */
export function extractSearchKeyword(message) {
    const match = message.match(/搜剧(.*)/);
    return match ? match[1].trim() : '';
}

/**
 * 视频文件后缀正则：匹配 .m3u8/.mp4/.flv/.ts/.mkv/.avi 等直链后缀（兼容带查询参数与哈希的链接）
 */
const VIDEO_FILE_EXT_REGEX = /\.(m3u8|mp4|flv|ts|mkv|avi|mov|webm)(?:[?#].*)?$/i;

/**
 * 云播分享链接路径正则：匹配路径中包含 /share/ 或 /play/ 等分享页面段
 */
const CLOUD_PLAY_SHARE_REGEX = /\/(?:share|play|voddetail|vodplay)\//i;

/**
 * 判断播放链接是否需要拼接播放器前缀
 * 仅当链接为视频文件直链（以 .m3u8/.mp4/.flv 等后缀结尾）时才需要拼接播放器
 * 云播分享链接（如 vip.ffzy-plays.com/share/xxx）自带播放页面，无需拼接
 * @param {string} link - 原始播放链接
 * @returns {boolean} 是否需要拼接播放器
 */
export function shouldWrapWithPlayer(link) {
    if (typeof link !== 'string' || link.trim() === '') {
        return false;
    }
    // 云播分享链接优先判定为不需要拼接
    if (CLOUD_PLAY_SHARE_REGEX.test(link)) {
        return false;
    }
    // 视频文件直链需要拼接播放器
    return VIDEO_FILE_EXT_REGEX.test(link);
}

/**
 * 拼接播放器前缀（按需）
 * 当 player 为空或链接自带播放页时直接返回原始链接，否则拼接播放器前缀
 * @param {string} playerUrl - 播放器前缀（如 https://p.qxyys.com/?url=）
 * @param {string} rawLink - 原始播放链接
 * @returns {string} 最终播放链接
 */
export function buildPlayLink(playerUrl, rawLink) {
    const safePlayer = typeof playerUrl === 'string' ? playerUrl.trim() : '';
    const safeLink = typeof rawLink === 'string' ? rawLink : '';
    if (!safePlayer || !shouldWrapWithPlayer(safeLink)) {
        return safeLink;
    }
    return safePlayer + safeLink;
}

// 重新导出公共函数
export { isNotNull, chineseToNumber };
