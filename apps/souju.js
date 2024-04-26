import plugin from '../../../lib/plugins/plugin.js';
import { puppeteer, common } from '../model/index.js';
import { Plugin_Path, Config } from '../components/index.js';
import Data from '../components/Data.js';
import request from '../lib/request/request.js';
import YamlReader from '../components/YamlReader.js';

/** 缓存目录 */
const CachePath = `${Plugin_Path}/resources/Cache/SearchVideos`;
/** 搜剧视频名称 */
let SearchName = "";
/** 视频ID数组 */
var IDs = [];
/** 正在搜索 */
var zzss = 0;

export class souju extends plugin {
    constructor() {
        super({
            name: '[止水插件]搜剧',
            dsc: '七星搜剧',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: '^(#|\/)?(设置|增加|删除|查看)搜剧接口(.*)$',
                    fnc: 'SearchInterface'
                }, {
                    reg: '^(#|\/)?(设置|查看)(搜剧)?播放器(.*)$',
                    fnc: 'PlayerInterface'
                }, {
                    reg: '^(#|\/)?取消搜剧$',
                    fnc: 'CancelSearch'
                }, {
                    reg: '^(#|\/)?选剧(.*)',
                    fnc: 'SelectVideo'
                }, {
                    reg: '^(#|\/)?看剧.*集?$',
                    fnc: 'WatchVideo'
                }, {
                    reg: '^(#|\/)?(搜剧)?线路(.*)$',
                    fnc: 'changeRoute'
                }, {
                    reg: '^(#|\/)?我的搜剧$',
                    fnc: 'MySearchVideo'
                }, {
                    reg: '^(#|\/)?(搜剧|到).*页$',
                    fnc: 'GoPage'
                }, {
                    reg: "^(#|\/)?(重新)?搜剧(.*)$",
                    fnc: 'SearchVideos'
                }
            ]
        });
    }

    /** 搜剧 */
    async SearchVideos(e) {
        // 检查是否有正在进行的搜索
        if (zzss === 1) {
            e.reply('前方有搜索任务正在进行，请稍候再试！');
            return false;
        }

        // 获取接口
        const idx = Number(await Config.GetUserSearchVideos(e.user_id, 'idx')) || 0;
        const site = await Config.SearchVideos.resources[idx]?.site;

        // 检查接口是否存在
        if (!site) {
            e.reply('接口配置错误，请联系管理员修复！');
            return false;
        }

        try {
            // 开始搜索过程，设置搜索状态
            zzss = 1;

            // 获取搜索关键词
            const SearchName = extractSearchKeyword(e.msg);
            e.reply(`正在搜索 [${SearchName || '最新视频'}] ，请稍候…`);

            // 获取搜剧数据
            let SearchResults = await getSearchResultsWithCache(e.user_id, SearchName, 1, site.url);

            // 保存搜索结果至缓存
            await Config.SetUserSearchVideos(e.user_id, 'keyword', SearchName);
            await Config.SetUserSearchVideos(e.user_id, 'page', 1);
            await Config.SetUserSearchVideos(e.user_id, 'SearchResults', JSON.stringify(SearchResults));

            // 检查并展示搜索结果
            handleAndDisplaySearchResults(e, SearchResults, site.showpic, SearchName);

        } catch (error) {
            e.reply(`搜索过程中发生错误：${error.message}`);
        }
        zzss = 0;
        return true;
    }

    /** 搜剧接口 */
    async SearchInterface(e) {
        if (e.isMaster == false) {
            return false; //不是主人
        };

        const type = e.msg.substring(1, 3);

        if (type == "设置") {
            let index = parseInt(e.msg.replace(/^.*搜剧接口/, '').trim());
            if (isNaN(index)) {
                index = 1;
            }

            const resources = await Config.SearchVideos.resources;
            if (index < 1 && index > resources.length) {
                index = 1;
            }

            //重置搜剧设置
            this.CancelSearch(e);

            //写入搜剧接口设置
            await Config.SetUserSearchVideos(e.user_id, 'idx', index - 1);
            Show_SearchInterface(e);

        }
        else if (type == "增加") {

            const Interface = e.msg.replace(/^.*搜剧接口/, '').trim();

            if (Interface) {

                const [url, title = '新接口', showpic = 'true'] = Interface.split('|');
                const site = {
                    site: {
                        showpic: showpic === '显示' || showpic === 'true',
                        title,
                        url
                    }
                };

                await Config.modifyarr('souju', `resources`, site, 'add');
                Show_SearchInterface(e);
            }

        }

        else if (type == "删除") {

            const index = parseInt(e.msg.replace(/^.*搜剧接口/, '').trim());
            if (isNaN(index)) {
                e.reply(`接口编号错误！`);
                return false;
            }

            let path = `${Plugin_Path}/config/config/souju.yaml`;
            let yaml = new YamlReader(path);
            let resources = yaml.jsonData['resources'];
            let title = resources[index - 1].site.title;

            if (index < 0 && index >= resources.length) {
                e.reply(`接口编号错误！`);
                return false;
            }

            yaml.delete(`resources.${index - 1}`);

            e.reply(`已删除搜剧接口： ${title}`);

        }

        else if (type == "查看") {
            Show_SearchInterface(e);
        }
        return true;
    }

    /** 播放器接口 */
    async PlayerInterface(e) {
        if (e.isMaster == false) {
            return false; //不是主人
        };

        const type = e.msg.substring(1, 3);
        let msg, Interface = ""
        if (type == "设置") {
            Interface = e.msg.replace(/^.*播放器/, '').trim();
            await Config.modify('souju', 'player', Interface)
            msg = '设置成功，当前播放器：\n';
        } else {
            msg = '当前播放器：\n';
        }
        msg += await Config.SearchVideos.player;
        e.reply(msg);
        return true;
    }

    /** 取消搜剧 */
    async CancelSearch(e) {

        const SearchName = await Config.GetUserSearchVideos(e.user_id, 'keyword');

        //重置搜剧设置
        zzss = 0;
        await Config.SetUserSearchVideos(e.user_id, 'SearchResults', '');
        await Config.SetUserSearchVideos(e.user_id, 'keyword', '');
        await Config.SetUserSearchVideos(e.user_id, 'page', 1);
        await Config.SetUserSearchVideos(e.user_id, 'Episode', 1);
        await Config.SetUserSearchVideos(e.user_id, 'Route', '');

        e.reply(`已取消 [ ${SearchName || '最新视频'} ] 的搜索`);
        return true;

    }

    /** 选剧 */
    async SelectVideo(e) {
        // 获取用户搜索结果
        let userSearchResult = await Config.GetUserSearchVideos(e.user_id, 'SearchResults');

        // 检查搜索结果是否存在
        if (isNotNull(userSearchResult)) {
            try {
                // 解析搜索结果为JSON对象
                userSearchResult = JSON.parse(userSearchResult);

                // 检查JSON对象中是否包含必要的list属性
                if (!isNotNull(userSearchResult.list)) {
                    // 数据错误，提示用户重新搜剧
                    e.reply(`搜剧数据错误，请重新#搜剧！`);
                    return false;
                }
            } catch (error) {
                // 解析JSON时发生错误，记录错误信息并提示用户
                console.error('解析搜剧结果为JSON时出错:', error);
                e.reply(`解析搜剧数据时发生错误，请稍后重试！`);
                return false;
            }
        } else {
            // 用户尚未执行搜剧操作，提示用户先搜剧
            e.reply(`你需要先#搜剧，才可以#选剧！`);
            return false;
        }

        // 从用户消息中提取选剧编号，若无有效数字则默认为1
        const selectedEpisodeIndex = Math.max(parseInt(e.msg.replace(/\D+/, '').trim()) || 1, 1);

        // 检查选剧编号是否在有效范围内（1到搜索结果列表长度）
        if (selectedEpisodeIndex > userSearchResult.list.length) {
            // 错误的选剧编号，提示用户正确输入
            e.reply(`[选剧]错误，请确保选剧编号在1到${userSearchResult.list.length}之间。`);
            return false;
        } else {
            // 保存选中的剧集编号
            await Config.SetUserSearchVideos(e.user_id, 'selectedID', selectedEpisodeIndex);
        }

        // 获取用户已选择的播放路线（Route）及搜索结果索引
        const siteIdx = Number(await Config.GetUserSearchVideos(e.user_id, 'idx')) || 0;
        const selectedEpisodeDetails = userSearchResult.list[selectedEpisodeIndex - 1];
        const playbackRoutes = selectedEpisodeDetails.vod_play_from.split('$$$');
        const playRoutes = await RouteToNameMap(playbackRoutes);
        await Config.SetUserSearchVideos(e.user_id, 'playRoutes', JSON.stringify(playRoutes));

        // 获取当前播放路线索引（currentPlaybackRoute），并确保其有效性
        let Route = await Config.GetUserSearchVideos(e.user_id, 'Route');
        console.log(`当前播放路线：${Route}`);
        let currentPlaybackRoute = await findRouteIndex(Route, playRoutes);
        console.log(`当前播放路线索引：${currentPlaybackRoute}`);

        // 根据当前播放路线获取资源分组
        const resourceGroups = selectedEpisodeDetails.vod_play_url.split('$$$');

        // 若当前播放路线索引超出资源分组范围，设置为默认路线（第一条路线）
        if (resourceGroups.length < currentPlaybackRoute) {
            currentPlaybackRoute = 0;
        }

        // 解析资源分组中的剧集名称和链接
        const episodesWithLinks = resourceGroups[currentPlaybackRoute]?.split('#') || [resourceGroups[0]];
        const episodeNames = [];
        const episodeLinks = [];
        for (let i = 0; i < episodesWithLinks.length; i++) {
            const [episodeName, episodeLink] = episodesWithLinks[i].split('$');
            episodeNames.push(episodeName);
            episodeLinks.push(episodeLink);
        }

        // 组装播放数据对象，并保存至缓存
        const playData = { VodName: selectedEpisodeDetails.vod_name, episodeNames, episodeLinks };
        console.log(`保存用户数据：${JSON.stringify(playData)}`);
        await Config.SetUserSearchVideos(e.user_id, 'playData', JSON.stringify(playData));

        // 获取渲染所需数据
        const site = await Config.SearchVideos.resources[siteIdx]?.site;

        // 渲染选剧页面，传递相关数据
        await puppeteer.render("souju/select", {
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

    /** 看剧 */
    async WatchVideo(e) {
        let Episode = parseInt(await Config.GetUserSearchVideos(e.user_id, 'Episode')) || 1;
        const playDataStr = await Config.GetUserSearchVideos(e.user_id, 'playData');
        const playData = JSON.parse(playDataStr);

        console.log(`用户集数：${Episode}`);
        // 初始集数处理
        if (isNaN(Episode)) {
            Episode = 1;
        }

        // 解析用户输入
        const input = e.msg.trim();
        let targetEpisode = Episode;


        // 删除无关字符，仅保留集数相关指令
        const cleanedInput = input.replace(/#|看|剧|第|集/g, "");
        console.log(`cleanedInput：${cleanedInput}`);
        // 判断指令类型
        if (cleanedInput === '上一') {
            targetEpisode = Math.max(1, targetEpisode - 1);
        } else if (cleanedInput === '下一') {
            targetEpisode = Math.min(targetEpisode + 1, playData.episodeLinks.length);
        } else if (cleanedInput === '最后') {
            targetEpisode = playData.episodeLinks.length;
        } else if (!isNaN(parseInt(cleanedInput))) {
            targetEpisode = parseInt(cleanedInput);
        } else {
            // 判断是数字还是中文
            const chineseNumeral = cleanedInput;
            try {
                targetEpisode = chineseToNumber(chineseNumeral);
                console.log(`解析中文：${targetEpisode}`);
            } catch (error) {
                targetEpisode = parseInt(cleanedInput);
                if (isNaN(targetEpisode)) {
                    e.reply('输入的集数格式不正确，请重新输入。');
                    return false;
                }
            }
        }

        console.log(`解析集数：${targetEpisode}`);


        if (!isNotNull(playDataStr)) {
            e.reply('搜索数据错误，请重新搜索！');
            return false;
        }


        // 集数校验
        targetEpisode = Math.max(1, Math.min(targetEpisode, playData.episodeLinks.length));
        console.log(`最终集数：${targetEpisode}`);

        // 更新并保存当前集数
        await Config.SetUserSearchVideos(e.user_id, 'Episode', targetEpisode);

        // 构建回复消息
        if (isNotNull(playData.episodeLinks[targetEpisode - 1])) {
            const title = `${playData.VodName}  ${playData.episodeNames[targetEpisode - 1]}`;
            const fullLink = Config.SearchVideos.player + playData.episodeLinks[targetEpisode - 1];
            const msg = [
                '*** 请复制到浏览器中观看 ***',
                fullLink,
            ];

            try {
                await common.getforwardMsg(e, msg, { isxml: true, xmlTitle: title });
                return true; // 返回true，阻止消息继续传播
            } catch (err) {
                let replyMsg = title + '\n';

                if (e.isGroup) {
                    const at = Number(e.user_id);
                    replyMsg = [segment.at(at, e.sender.card), ` 群消息发送失败。\n请添加好友后私聊发送：${e.msg}`];
                } else {
                    replyMsg = `消息发送失败，可能被风控。`;
                }

                e.reply(replyMsg);
                return false; // 发送失败，允许消息继续传播
            }
        } else {
            e.reply('集数错误，无法观看！');
            return false;
        }
    }


    /** 到指定页 */
    async GoPage(e) {

        const PAGE_COMMANDS = {
            PREVIOUS: '上一页',
            NEXT: '下一页',
            FIRST: '首',
            LAST: '尾',
        };

        const msg = e.msg.trim();

        // 一次性获取所需的用户搜索数据
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

        // 解析SearchResults文本为JSON对象并重新赋值给SearchResults
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

        // 保存参数
        await Config.SetUserSearchVideos(e.user_id, 'page', page);

        e.reply(`开始跳转到 [${keyword || '最新视频'}] - 第${page}页`);

        /** 搜剧结果 */
        const domain = await Config.SearchVideos.resources[idx].site.url;
        SearchResults = await SearchVideo(keyword, page, 0, 0, domain);
        let IDs = [];

        if (SearchResults && SearchResults.list) {
            IDs = SearchResults.list.map(item => item.vod_id);
            console.log(`获取数组：${IDs}`);
        } else {
            console.warn('SearchResults.list 未定义或为 null。跳过 ID 提取。');
        }

        if (isNotNull(SearchResults.list)) {
            // 写到缓存
            await Config.SetUserSearchVideos(e.user_id, 'SearchResults', JSON.stringify(SearchResults));
            // 发送图片
            await puppeteer.render("souju/result", {
                list: SearchResults.list,
                keyword: keyword || '最新视频',
                showpic: await Config.SearchVideos.resources[idx].site.showpic
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
 * 切换线路
 * @param {Object} e - 事件对象，包含用户ID（user_id）、原始消息（msg）等信息
 * @returns {Promise<boolean>} - 表示切换线路操作是否成功
 */
    async changeRoute(e) {
        try {
            // 1. 解析用户输入的线路信息
            const inputRouteStr = e.msg.replace(/^.*线路/, '').trim(); // 提取用户输入的线路内容（可能为编号或名称）
            let inputRoute;

            // 2. 处理输入为线路编号的情况
            if (Number.isInteger(+inputRouteStr)) {
                // 2.1 获取可用线路列表
                const availableRoutesStr = await Config.GetUserSearchVideos(e.user_id, 'playRoutes');
                const availableRoutes = JSON.parse(availableRoutesStr);

                // 2.2 检查线路编号是否有效
                if (+inputRouteStr < 1 || +inputRouteStr > availableRoutes.length) {
                    return e.reply(`线路编号错误，请确保输入的数字在1到${availableRoutes.length}之间。`);
                }

                // 2.3 将线路编号转换为线路名称
                inputRoute = availableRoutes[+inputRouteStr - 1].RouteName;
            } else {
                // 3. 处理输入为线路名称的情况（假设输入直接为线路名称）
                inputRoute = inputRouteStr;
            }

            // 4. 保存当前播放线路
            await Config.SetUserSearchVideos(e.user_id, 'Route', inputRoute);
            console.log(`已切换到 [${inputRoute}] 线路`);

            // 5. 获取当前选剧ID
            let selectedID = await Config.GetUserSearchVideos(e.user_id, 'selectedID');
            selectedID = selectedID > 0 ? selectedID : 1;

            // 6. 更新消息并执行选剧操作
            e.msg = '#选剧' + selectedID.toString();
            return await this.SelectVideo(e);
        } catch (error) {
            return e.reply('切换线路时发生错误:', error);
        }
    }

    async MySearchVideo(e) {
        try {
            // 合并数据库查询，一次性获取所有所需属性
            const userSearchData = await Config.GetUserSearchVideos(e.user_id, [
                'keyword',
                'page',
                'Episode',
                'idx',
                'playData',
                'Route'
            ]);

            if (userSearchData === null || userSearchData === undefined) {
                e.reply(`未能找到你的搜剧记录`);
                throw error;
            }

            const {
                keyword,
                page = 1,
                Episode: initialEpisode,
                idx = 0,
                playData: playDataStr,
                Route
            } = userSearchData;
            console.log(`搜索数据：${JSON.stringify(userSearchData)}`);

            // 解析JSON字符串
            const playData = JSON.parse(playDataStr);

            let Episode = initialEpisode;
            let msg = '';

            // 资源接口站名
            const InterfaceName = Config.SearchVideos.resources[idx]?.site.title || '错误';

            msg += '*** 搜索记录 ***\n';
            msg += `接口：${InterfaceName}\n`;
            msg += `关键词：${keyword}\n`;
            msg += `搜索页：${page}\n`;
            msg += `线路：${Route}\n\n`;

            // 集数效验，防止超出范围
            Episode = Math.max(1, Math.min(Episode, playData.episodeLinks.length));

            const VodName = playData.VodName;
            const EpisodeName = playData.episodeNames[Episode - 1] || '未知';

            const PlayerUrl = Config.SearchVideos.player + playData.episodeLinks[Episode - 1];

            msg += '*** 播放记录 ***\n';
            msg += `片名：${VodName}\n`;
            msg += `视频：${EpisodeName}\n`;
            msg += `链接：${PlayerUrl}\n`;

            return e.reply(msg);
        } catch (error) {
            e.reply(`获取搜剧记录时发生错误：${error.message}`);
            throw error;
        }
    }

}

/** 显示搜剧接口 */
async function Show_SearchInterface(e) {
    try {
        let msg = "***搜剧接口***\n\n";
        let resources = await Config.SearchVideos.resources;
        if (!Array.isArray(resources) || resources.length === 0) {
            await e.reply("有可用的搜剧接口。");
            return false;
        }

        const len = resources.length;
        let routeIdx = parseInt(await Config.GetUserSearchVideos(e.user_id, 'idx'));
        // 修复边界条件逻辑错误
        if (routeIdx < 0 || routeIdx >= len) {
            routeIdx = 0;
        }

        // 提前计算索引加一，避免在map中重复计算
        const indexes = Array.from({ length: len }, (_, i) => i + 1);

        msg += indexes.map((index) => {
            const title = resources[index - 1].site.title; // 调整索引回退一步以匹配resources数组
            return `${index === routeIdx ? '>>' : ''} ${index}、${title} ${index === routeIdx ? '<<' : ''}`;
        }).join('\n') + "\n\n你可以使用 #设置搜剧接口<数字> 来切换不同的搜索接口。\n";

        await e.reply(msg); // 确保在异步操作完成后发送回复
        return true;
    } catch (error) {
        await e.reply(`搜剧接口显示失败：${error.message}`);
        return false;
    }
}

/**
 * 判断对象是否不为undefined且不为null、NaN
 * @param {any} obj - 待检查的对象。
 * @returns {boolean} - 如果 obj 既不是 undefined，也不是 null，也不是 NaN，则返回 true；否则返回 false。
 */
function isNotNull(obj) {
    // 检查 obj 是否为 undefined 或 null
    if (obj === undefined || obj === null) { return false; }

    // 使用 Number.isNaN() 来检查 obj 是否为 NaN
    if (Number.isNaN(obj)) { return false; }

    return true;
};

/**
 * 关键词搜索视频
 * @param {string} keyword - 搜索关键词
 * @param {number} [page=1] - 页码，默认为1
 * @param {number} [type=0] - 搜索类型
 * @param {number} [hour=0] - 搜索几小时内的数据
 * @param {string} [domain=''] - 资源站网址
 * @throws {Error} 当未找到作品时，会抛出异常
 * @returns {Array<string>} 返回搜索结果信息数组
 */
async function SearchVideo(keyword = '', page = 1, type = 0, hour = 0, domain = '') {
    if (page < 1) { page = 1 }
    if (type < 0) { type = 0 }
    if (hour < 0) { hour = 0 }

    try {
        // 使用URLSearchParams来构造查询字符串，避免直接URL拼接
        const params = new URLSearchParams({
            ac: 'detail',
            wd: keyword,
            t: type,
            h: hour,
            pg: page
        });

        const url = `${domain}?${params.toString()}`;

        let res = await request.post(url)
            .then(res => res.json())
            .catch(async (err) => {
                logger.error(err);
                // 适当地处理错误，比如可以返回一个特定的错误对象或消息
                throw new Error('post过程中发生错误。');
            });

        return res;
    } catch (error) {
        // 适当地处理异常，比如可以抛出供前端捕获的异常或返回错误信息
        throw error; // 维持原函数的行为：当未找到作品时，抛出异常
    }
}

/**
 * 将中文数字字符串转换为等效的阿拉伯数字。
 *
 * @param {string} str - 待转换的中文数字字符串，默认为空字符串。
 * @returns {number} 转换后的阿拉伯数字。
 *
 * @throws {Error} 当输入的中文数字字符串不符合书写规则时，抛出错误。
 */
function chineseToNumber(str) {
    // 九十二
    const numChar = {
        '零': 0,
        '一': 1,
        '二': 2,
        '三': 3,
        '四': 4,
        '五': 5,
        '六': 6,
        '七': 7,
        '八': 8,
        '九': 9,
    };
    const levelChar = {
        '十': 10,
        '百': 100,
        '千': 1000,
        '万': 10000,
        '亿': 100000000
    };
    let arr = Array.from(str);
    console.log(arr);
    let sum = 0, temp = 0;
    for (let i = 0; i < arr.length; i++) {
        const char = arr[i];
        if (char === '零') continue;
        if (char === '亿' || char === '万') {
            sum += temp * levelChar[char];
            temp = 0;
        } else {
            const next = arr[i + 1];
            if (next && next !== '亿' && next !== '万') {
                temp += numChar[char] * levelChar[next];
                i++;
            } else {
                temp += numChar[char]
            }
        }
    }
    return sum + temp;
}


/**
 * 获取线路名称
 * @param {string} RouteCode - 线路代码
 * @returns {Promise<string>} RouteName - 返回对应的线路名称，若未找到则返回线路代码本身。发生错误时，返回Promise.reject。
 */
async function RouteToName(RouteCode) {
    try {
        const RouteList = await Data.ReadRouteList();

        // 使用Map对象以提高查找效率
        const routeMap = new Map(RouteList.map(item => {
            // 进行更全面的数据验证
            if (typeof item.RouteCode === 'string' && item.RouteCode.trim() !== '' &&
                typeof item.RouteName === 'string' && item.RouteName.trim() !== '') {
                return [item.RouteCode.trim(), item.RouteName.trim()];
            }
            return null;
        }).filter(Boolean)); // 过滤掉无效的项

        // 提高代码的可读性和简洁性
        const RouteName = routeMap.get(RouteCode) || RouteCode;

        return RouteName;
    } catch (error) {
        // 默认的错误处理：在控制台输出错误信息，并返回Promise.reject
        console.error("获取线路名称时发生错误:", error);
        return Promise.reject(error);
    }
}

/**
 * 线路转名称映射表（返回格式与RouteList一致）
 * @param {string[]} Route - 线路数组
 * @returns {Array<{RouteCode: string, RouteName: string}>} RouteInfoList - 返回一个数组，每个元素是一个对象，包含RouteCode和RouteName属性
 */
async function RouteToNameMap(Route = []) {
    try {
        const RouteList = await Data.ReadRouteList();

        const routeMap = RouteList.reduce((map, item) => {
            if (typeof item.RouteCode === 'string' && typeof item.RouteName === 'string') {
                map[item.RouteCode] = item.RouteName;
            }
            return map;
        }, {});

        const RouteInfoList = Route.map(routeCode => ({
            RouteCode: routeCode,
            RouteName: routeMap[routeCode] || routeCode
        }));

        return RouteInfoList;
    } catch (error) {
        console.error("线路转名称映射表时发生错误:", error);
        // 根据实际需求选择适当的错误处理方式，如抛出异常或返回特定错误信息
        // throw error;
        // 或
        // return { error: "发生错误" };
    }
}

/**
 * 查找线路名称或线路代码在RouteList中的索引
 * @param {string} searchValue - 要查找的线路名称或线路代码
 * @param {Array<Object>} RouteList - 包含线路信息的对象数组
 * @returns {number} - 如果找到匹配的线路名称或线路代码，返回其在RouteList中的索引；否则返回0
 */
function findRouteIndex(searchValue, RouteList) {
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
 * 长链接转短链接
 * @param {string} longLink - 长链接
 * @returns {string} shortLink - 返回短链接
 */
async function linkLongToShort(longLink) {
    // 将API URL和请求头中的值提取为常量
    const API_URL = 'https://api.45t.cn/pc/site/index';
    const BASE_HEADERS = {
        Accept: 'application/json',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Content-type': 'application/json',
        Host: 'api.45t.cn',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
    };

    // 检查输入的长链接是否为空或不合法
    if (!longLink || typeof longLink !== 'string' || longLink.trim() === '') {
        console.error('输入的长链接无效。');
        return longLink; // 返回原链接或指定的错误链接
    }

    const body = {
        "url": longLink,
        "sg": "6a9537e0120bb886f989b12563737c47" // 固定值或从配置获取
    };

    // 直接在headers中计算Content-Length
    const headers = {
        ...BASE_HEADERS,
        'Content-Length': JSON.stringify(body).length
    };

    const options = {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    };

    let res = '';
    try {
        const response = await fetch(API_URL, options);
        if (!response.ok) {
            throw new Error(`API请求失败，状态码：${response.status}`);
        }
        res = await response.json();
        console.log(`短链接：${JSON.stringify(res)}`);
    } catch (err) {
        console.error(`链接转换出错: ${err.message}`);
    }

    // 返回短链接或在错误情况下返回原链接
    return res?.data?.url || longLink;
}

/**
 * 提取搜索关键词
 * @param {string} message 用户输入的消息
 * @returns {string} 搜索关键词
 */
function extractSearchKeyword(message) {
    const match = message.match(/搜剧(.*)/);
    return match ? match[1].trim() : '';
}

/**
 * 获取用户搜索结果，优先使用缓存（当keyword和page与传入参数一致时且SearchResults存在），否则在线搜索
 * @param {number} userId 用户ID
 * @param {string} SearchName 搜索名称
 * @param {number} defaultPage 默认页码
 * @param {string} defaultUrl 默认接口URL
 * @returns {any} SearchResults
 */
async function getSearchResultsWithCache(userId, SearchName, defaultPage = 1, defaultUrl = "") {
    try {
        // 获取用户搜索缓存数据
        const keyword = await Config.GetUserSearchVideos(userId, 'keyword') || '';
        const page = parseInt(await Config.GetUserSearchVideos(userId, 'page') || '1');
        const SearchResultsStr = await Config.GetUserSearchVideos(userId, 'SearchResults');

        // 判断缓存的keyword和page是否与传入参数一致，且SearchResults存在
        if (keyword === SearchName && page === defaultPage && SearchResultsStr !== undefined) {
            console.log("载入用户搜索缓存");
            return JSON.parse(SearchResultsStr);
        }
    } catch (error) {
        console.warn("获取用户搜索缓存时出现错误:", error);
    }

    // 在线搜索
    console.log("调用搜索接口");
    return await SearchVideo(SearchName, defaultPage, 0, 0, defaultUrl);
}

/**
 * 保存搜索结果至缓存
 * @param {number} userId 用户ID
 * @param {any} searchResults 搜索结果
 */
async function saveUserSearchCache(userId, searchResults) {
    await Promise.all([
        Config.SetUserSearchVideos(userId, 'keyword', searchResults.keyword),
        Config.SetUserSearchVideos(userId, 'page', searchResults.page),
        Config.SetUserSearchVideos(userId, 'SearchResults', JSON.stringify(searchResults)),
    ]);
}

/**
 * 处理并显示搜索结果
 * @param {Event} e 事件对象
 * @param {any} searchResults 搜索结果
 * @param {boolean} showPic 图片显示设置
 */
async function handleAndDisplaySearchResults(e, searchResults, showPic, keyword) {
    if (searchResults.list) {
        const IDs = searchResults.list.map(item => item.vod_id);
        console.log(`获取数组：${IDs}`);
        await puppeteer.render("souju/result", {
            list: searchResults.list,
            keyword: keyword || '最新视频',
            showpic: showPic,
        }, {
            e,
            scale: 1.6,
        });
    } else {
        e.reply(`未能找到 [${keyword || '最新视频'}] 的相关内容，非常抱歉！`);
    }
}
