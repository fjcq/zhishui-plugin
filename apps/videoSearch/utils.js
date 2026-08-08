/**
 * 搜剧模块工具函数
 */
// 引入公共工具函数
import { isNotNull, chineseToNumber } from '../../lib/common/utils.js';
// 引入日志组件
import { logger } from '../../components/index.js';

/**
 * 安全解析 JSON 字符串，解析失败返回 null
 * @param {string} str - 待解析字符串
 * @param {string} field - 字段名（用于日志定位）
 * @param {string} [tag='[搜剧]'] - 日志前缀标签，用于区分调用来源
 * @returns {*} 解析结果，失败返回 null
 */
export function safeParse(str, field, tag = '[搜剧]') {
    if (typeof str !== 'string' || !str.trim()) {
        return null;
    }
    try {
        return JSON.parse(str);
    } catch (err) {
        logger.warn(`${tag} ${field} JSON 解析失败: ${err.message}, 原始值: ${str?.slice?.(0, 120) ?? str}`);
        return null;
    }
}

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

/**
 * 将字符串编码为 URL-safe Base64
 * 兼容性兜底：Node 14+ 原生支持 base64url，旧版本手动替换字符
 * @param {string} str - 待编码字符串
 * @returns {string} URL-safe Base64 字符串（无填充）
 */
function toBase64Url(str) {
    const base64 = Buffer.from(str, 'utf-8').toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * 构造 Cloudflare Workers 中转跳转链接
 * 将原始播放链接通过 Workers 中转，使发送的链接域名指向 workers.dev（未被 QQ 风控标记）
 * Workers 收到请求后 302 重定向到真实播放链接，QQ 无法从消息内容中预判跳转目标
 * @param {string} workerUrl - Workers 服务地址（如 https://xxx.workers.dev）
 * @param {string} playLink - 原始播放链接
 * @returns {string} 中转后的链接；workerUrl 为空时原样返回 playLink
 */
export function buildRedirectLink(workerUrl, playLink) {
    const safeWorker = typeof workerUrl === 'string' ? workerUrl.trim().replace(/\/+$/, '') : '';
    const safeLink = typeof playLink === 'string' ? playLink : '';
    if (!safeWorker || !safeLink) {
        return safeLink;
    }
    const encoded = toBase64Url(safeLink);
    return `${safeWorker}/?u=${encoded}`;
}

// 重新导出公共函数
export { isNotNull, chineseToNumber };
