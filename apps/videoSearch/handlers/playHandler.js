/**
 * 搜剧播放处理模块
 */

import { common } from '../../../model/index.js';
import { Config } from '../../../components/index.js';
import { isNotNull, chineseToNumber, findRouteIndex } from '../utils.js';
import { SearchVideo } from '../helpers.js';
import Data from '../../../components/Data.js';

/**
 * 处理选剧命令
 * @param {Object} e - 事件对象
 * @param {Function} getSiteIndexFn - 获取资源站索引函数
 * @param {Object} puppeteer - puppeteer对象
 * @returns {Promise<boolean>} 处理结果
 */
export async function handleSelectVideo(e, getSiteIndexFn, puppeteer) {
    let userSearchResult = await Config.GetUserSearchVideos(e.user_id, 'SearchResults');

    if (isNotNull(userSearchResult)) {
        try {
            userSearchResult = JSON.parse(userSearchResult);

            if (!isNotNull(userSearchResult.list)) {
                e.reply(`搜剧数据错误，请重新#搜剧！`);
                return false;
            }
        } catch (error) {
            console.error('解析搜剧结果为JSON时出错:', error);
            e.reply(`解析搜剧数据时发生错误，请稍后重试！`);
            return false;
        }
    } else {
        e.reply(`你需要先#搜剧，才可以#选剧！`);
        return false;
    }

    const selectedEpisodeIndex = Math.max(parseInt(e.msg.replace(/\D+/, '').trim()) || 1, 1);

    if (selectedEpisodeIndex > userSearchResult.list.length) {
        e.reply(`[选剧]错误，请确保选剧编号在1到${userSearchResult.list.length}之间。`);
        return false;
    } else {
        await Config.SetUserSearchVideos(e.user_id, 'selectedID', selectedEpisodeIndex);
    }

    const siteIdx = await getSiteIndexFn(e);
    const selectedEpisodeDetails = userSearchResult.list[selectedEpisodeIndex - 1];
    const playbackRoutes = selectedEpisodeDetails.vod_play_from.split('$$$');
    const playRoutes = await routeToNameMap(playbackRoutes);
    await Config.SetUserSearchVideos(e.user_id, 'playRoutes', JSON.stringify(playRoutes));

    let Route = await Config.GetUserSearchVideos(e.user_id, 'Route');
    let currentPlaybackRoute = await findRouteIndex(Route, playRoutes);

    const resourceGroups = selectedEpisodeDetails.vod_play_url.split('$$$');

    if (resourceGroups.length < currentPlaybackRoute) {
        currentPlaybackRoute = 0;
    }

    const episodesWithLinks = resourceGroups[currentPlaybackRoute]?.split('#') || [resourceGroups[0]];
    const episodeNames = [];
    const episodeLinks = [];
    for (let i = 0; i < episodesWithLinks.length; i++) {
        const [episodeName, episodeLink] = episodesWithLinks[i].split('$');
        episodeNames.push(episodeName);
        episodeLinks.push(episodeLink);
    }

    const playData = { VodName: selectedEpisodeDetails.vod_name, episodeNames, episodeLinks };
    await Config.SetUserSearchVideos(e.user_id, 'playData', JSON.stringify(playData));

    const resource = await Config.SearchVideos.resources[siteIdx];
    const site = resource?.site || resource;

    await puppeteer.render("videoSearch/select", {
        list: selectedEpisodeDetails,
        episodeNames: episodeNames,
        playRoutes: playRoutes,
        showPic: site?.showpic || false,
        CurrentrRoute: currentPlaybackRoute
    }, {
        e,
        scale: 1.8
    });
}

/**
 * 处理看剧命令
 * @param {Object} e - 事件对象
 * @returns {Promise<boolean>} 处理结果
 */
export async function handleWatchVideo(e) {
    let Episode = parseInt(await Config.GetUserSearchVideos(e.user_id, 'Episode')) || 1;
    const playDataStr = await Config.GetUserSearchVideos(e.user_id, 'playData');
    const playData = JSON.parse(playDataStr);

    if (isNaN(Episode)) {
        Episode = 1;
    }

    const input = e.msg.trim();
    let targetEpisode = Episode;

    const cleanedInput = input.replace(/#|看|剧|第|集/g, "");

    if (cleanedInput === '上一') {
        targetEpisode = Math.max(1, targetEpisode - 1);
    } else if (cleanedInput === '下一') {
        targetEpisode = Math.min(targetEpisode + 1, playData.episodeLinks.length);
    } else if (cleanedInput === '最后') {
        targetEpisode = playData.episodeLinks.length;
    } else if (!isNaN(parseInt(cleanedInput))) {
        targetEpisode = parseInt(cleanedInput);
    } else {
        const chineseNumeral = cleanedInput;
        try {
            targetEpisode = chineseToNumber(chineseNumeral);
        } catch (error) {
            targetEpisode = parseInt(cleanedInput);
            if (isNaN(targetEpisode)) {
                e.reply('输入的集数格式不正确，请重新输入。');
                return false;
            }
        }
    }

    if (!isNotNull(playDataStr)) {
        e.reply('搜索数据错误，请重新搜索！');
        return false;
    }

    targetEpisode = Math.max(1, Math.min(targetEpisode, playData.episodeLinks.length));

    await Config.SetUserSearchVideos(e.user_id, 'Episode', targetEpisode);

    if (isNotNull(playData.episodeLinks[targetEpisode - 1])) {
        const title = `${playData.VodName}  ${playData.episodeNames[targetEpisode - 1]}`;
        const fullLink = Config.SearchVideos.player + playData.episodeLinks[targetEpisode - 1];
        const msg = [
            '*** 请复制到浏览器中观看 ***',
            fullLink,
        ];

        try {
            await common.getforwardMsg(e, msg, { isxml: true, xmlTitle: title });
            return true;
        } catch (err) {
            let replyMsg = title + '\n';

            if (e.isGroup) {
                const at = Number(e.user_id);
                replyMsg = [segment.at(at, e.sender.card), ` 群消息发送失败。\n请添加好友后私聊发送：${e.msg}`];
            } else {
                replyMsg = `消息发送失败，可能被风控。`;
            }

            e.reply(replyMsg);
            return false;
        }
    } else {
        e.reply('集数错误，无法观看！');
        return false;
    }
}

/**
 * 处理翻页命令
 * @param {Object} e - 事件对象
 * @param {Object} puppeteer - puppeteer对象
 * @returns {Promise<boolean>} 处理结果
 */
export async function handleGoPage(e, puppeteer) {
    const PAGE_COMMANDS = {
        PREVIOUS: '上一页',
        NEXT: '下一页',
        FIRST: '首',
        LAST: '尾',
    };

    const msg = e.msg.trim();

    const searchUserData = await Config.GetUserSearchVideos(e.user_id, [
        'keyword',
        'page',
        'idx',
        'SearchResults',
    ]);

    let {
        keyword = '',
        page = 1,
        idx = 0,
        SearchResults = '',
    } = searchUserData;

    try {
        SearchResults = JSON.parse(SearchResults);
    } catch (error) {
        SearchResults = { "pagecount": 1 }
    }

    switch (true) {
        case msg.includes(PAGE_COMMANDS.PREVIOUS):
            page = page > 1 ? page - 1 : 1;
            break;
        case msg.includes(PAGE_COMMANDS.NEXT):
            page++;
            break;
        case msg.includes(PAGE_COMMANDS.FIRST):
            page = 1;
            break;
        case msg.includes(PAGE_COMMANDS.LAST):
            page = SearchResults.pagecount || 99999;
            break;
        default:
            page = chineseToArabic(msg.replace(/#|到|第|页/g, "")) || 1;
            break;
    }

    await Config.SetUserSearchVideos(e.user_id, 'page', page);

    e.reply(`开始跳转到 [${keyword || '最新视频'}] - 第${page}页`);

    const resource = await Config.SearchVideos.resources[idx];
    const site = resource?.site || resource;
    const domain = site?.url;
    SearchResults = await SearchVideo(keyword, page, 0, 0, domain);

    if (isNotNull(SearchResults.list)) {
        await Config.SetUserSearchVideos(e.user_id, 'SearchResults', JSON.stringify(SearchResults));
        const resource = await Config.SearchVideos.resources[idx];
        const site = resource?.site || resource;
        await puppeteer.render("videoSearch/result", {
            list: SearchResults.list,
            keyword: keyword || '最新视频',
            showpic: site?.showpic || false
        }, {
            e,
            scale: 1.6,
        });

        return true;
    } else {
        e.reply(`未能搜索到 [${keyword || '最新视频'}]，抱歉`);
        return false;
    }
}

/**
 * 处理切换线路命令
 * @param {Object} e - 事件对象
 * @param {Function} selectVideoFn - 选剧函数
 * @returns {Promise<boolean>} 处理结果
 */
export async function handleChangeRoute(e, selectVideoFn) {
    try {
        const inputRouteStr = e.msg.replace(/^.*线路/, '').trim();
        let inputRoute;

        if (Number.isInteger(+inputRouteStr)) {
            const availableRoutesStr = await Config.GetUserSearchVideos(e.user_id, 'playRoutes');
            const availableRoutes = JSON.parse(availableRoutesStr);

            if (+inputRouteStr < 1 || +inputRouteStr > availableRoutes.length) {
                return e.reply(`线路编号错误，请确保输入的数字在1到${availableRoutes.length}之间。`);
            }

            inputRoute = availableRoutes[+inputRouteStr - 1].RouteName;
        } else {
            inputRoute = inputRouteStr;
        }

        await Config.SetUserSearchVideos(e.user_id, 'Route', inputRoute);

        let selectedID = await Config.GetUserSearchVideos(e.user_id, 'selectedID');
        selectedID = selectedID > 0 ? selectedID : 1;

        e.msg = '#选剧' + selectedID.toString();
        return await selectVideoFn(e);
    } catch (error) {
        return e.reply('切换线路时发生错误:', error);
    }
}

/**
 * 将线路代码数组转换为线路名称映射数组
 * @param {string[]} routeCodes - 线路代码数组
 * @returns {Promise<Array>} 线路名称映射数组
 */
async function routeToNameMap(routeCodes) {
    const routeData = await Data.ReadRouteList();
    const routeMap = {};

    if (Array.isArray(routeData)) {
        routeData.forEach(route => {
            routeMap[route.RouteCode] = route;
        });
    }

    return routeCodes.map(code => {
        const routeInfo = routeMap[code] || { RouteName: code, RouteCode: code };
        return {
            RouteName: routeInfo.RouteName,
            RouteCode: routeInfo.RouteCode
        };
    });
}

/**
 * 将中文数字转换为阿拉伯数字
 * @param {string} chineseNum - 中文数字字符串
 * @returns {number} 阿拉伯数字
 */
function chineseToArabic(chineseNum) {
    const chineseNumMap = {
        '零': 0, '一': 1, '二': 2, '三': 3, '四': 4,
        '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
        '十': 10, '百': 100, '千': 1000, '万': 10000
    };

    let result = 0;
    let temp = 0;

    for (let i = 0; i < chineseNum.length; i++) {
        const char = chineseNum[i];
        const num = chineseNumMap[char];

        if (num === undefined) {
            continue;
        }

        if (num === 10) {
            if (temp === 0) {
                temp = 1;
            }
            result += temp * num;
            temp = 0;
        } else if (num >= 100) {
            result += temp * num;
            temp = 0;
        } else {
            temp = num;
        }
    }

    result += temp;
    return result;
}
