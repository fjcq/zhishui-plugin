/**
 * 搜剧搜索处理模块
 */

import { Config } from '../../../components/index.js';
import { extractSearchKeyword } from '../utils.js';
import { getSearchResultsWithCache, handleAndDisplaySearchResults } from '../helpers.js';

let isSearching = false;

/**
 * 获取搜索状态
 * @returns {boolean} 搜索状态
 */
export function getSearchState() {
    return isSearching;
}

/**
 * 设置搜索状态
 * @param {boolean} state - 搜索状态
 */
export function setSearchState(state) {
    isSearching = state;
}

/**
 * 获取资源站索引
 * @param {Object} e - 事件对象
 * @returns {Promise<number>} 资源站索引
 */
export async function getSiteIndex(e) {
    const idxStr = await Config.GetUserSearchVideos(e.user_id, 'idx');
    let idx = Number(idxStr);
    if (idxStr !== '' && !isNaN(idx) && idx >= 0) {
        return idx;
    }

    if (e.group_id && Config.SearchVideos.GroupResourceIndex) {
        const groupConfig = Config.SearchVideos.GroupResourceIndex.find(item =>
            item.group == e.group_id
        );
        if (groupConfig && !isNaN(groupConfig.index) && groupConfig.index >= 0) {
            return groupConfig.index;
        }
    }

    return Config.SearchVideos.CurrentResourceIndex || 0;
}

/**
 * 处理搜剧命令
 * @param {Object} e - 事件对象
 * @param {Function} getSiteIndexFn - 获取资源站索引函数
 * @returns {Promise<boolean>} 处理结果
 */
export async function handleSearchVideos(e, getSiteIndexFn) {
    if (isSearching) {
        e.reply('前方有搜索任务正在进行，请稍候再试！');
        return false;
    }

    const idx = await getSiteIndexFn(e);

    if (!Config.SearchVideos.resources || Config.SearchVideos.resources.length === 0) {
        e.reply('搜剧接口未配置，请管理员先配置接口！');
        return false;
    }

    if (idx < 0 || idx >= Config.SearchVideos.resources.length) {
        e.reply('当前接口索引无效，请使用#设置搜剧接口 选择有效接口');
        return false;
    }

    const resource = Config.SearchVideos.resources[idx];
    const site = resource?.site || {};

    if (!resource || (!site.url && !resource.url)) {
        e.reply('接口配置错误，请联系管理员修复！');
        logger.error(`接口配置错误: 索引${idx}`, { resource });
        return false;
    }

    const apiUrl = site.url || resource.url;

    try {
        isSearching = true;

        const SearchName = extractSearchKeyword(e.msg);
        e.reply(`正在搜索 [${SearchName || '最新视频'}] ，请稍候…`);

        let SearchResults = await getSearchResultsWithCache(e.user_id, SearchName, 1, apiUrl);

        await Config.SetUserSearchVideos(e.user_id, 'keyword', SearchName);
        await Config.SetUserSearchVideos(e.user_id, 'page', 1);
        await Config.SetUserSearchVideos(e.user_id, 'SearchResults', JSON.stringify(SearchResults));

        handleAndDisplaySearchResults(e, SearchResults, site.showpic || resource.showpic, SearchName);

    } catch (error) {
        const serverErrorPatterns = [
            '500 internal server error',
            '502 bad gateway',
            '503 service unavailable',
            '504 gateway timeout',
            '内部错误'
        ];

        const errText = `${error.message || ''}`.toLowerCase();
        const isServerError = serverErrorPatterns.some(p => errText.includes(p.toLowerCase()));

        if (isServerError) {
            e.reply(`当前资源站服务器繁忙或发生内部错误，建议切换到其他资源站再试。`);
        } else if (error.message.includes('HTTPS 证书异常')) {
            e.reply(error.message);
        } else {
            e.reply(`搜索失败：${error.message}`);
        }
        logger.error(`搜剧错误:`, error);
    }
    isSearching = false;
    return true;
}

/**
 * 处理取消搜剧命令
 * @param {Object} e - 事件对象
 * @returns {Promise<boolean>} 处理结果
 */
export async function handleCancelSearch(e) {
    const SearchName = await Config.GetUserSearchVideos(e.user_id, 'keyword');

    isSearching = false;
    await Config.SetUserSearchVideos(e.user_id, 'SearchResults', '');
    await Config.SetUserSearchVideos(e.user_id, 'keyword', '');
    await Config.SetUserSearchVideos(e.user_id, 'page', 1);
    await Config.SetUserSearchVideos(e.user_id, 'Episode', 1);
    await Config.SetUserSearchVideos(e.user_id, 'Route', '');

    e.reply(`已取消 [ ${SearchName || '最新视频'} ] 的搜索`);
    return true;
}
