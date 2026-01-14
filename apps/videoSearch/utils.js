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

// 重新导出公共函数
export { isNotNull, chineseToNumber };
