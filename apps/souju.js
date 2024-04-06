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
                    reg: "^(#|\/)?(重新)?搜剧(.*)$",
                    fnc: 'SearchVideos'
                }, {
                    reg: '^(#|\/)?(设置|增加|删除|查看)搜剧接口(.*)$',
                    fnc: 'SearchInterface'
                }, {
                    reg: '^(#|\/)?(设置|查看)搜剧播放器(.*)$',
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
                    reg: '^(#|\/)?(上一页|下一页|到.*页)$',
                    fnc: 'GoPage'
                }, {
                    reg: '^(#|\/)?线路(.*)$',
                    fnc: 'ChangingRoute'
                }, {
                    reg: '^(#|\/)?我的搜剧$',
                    fnc: 'MySearchVideo'
                }
            ]
        });
    }

    /** 搜剧 */
    async SearchVideos(e) {
        // 检查是否有正在进行的搜索
        if (zzss === 1) {
            e.reply('前方有搜索任务正在进行，请稍候再试！');
            return;
        }

        // 获取接口
        const idx = Number(await Config.GetUserSearchVideos(e.user_id, 'idx')) || 0;
        const jiekou = await Config.SearchVideos.resources[idx]?.site;

        // 检查接口是否存在
        if (!jiekou) {
            e.reply('接口配置错误，请联系管理员修复！');
            return;
        }

        try {
            // 开始搜索过程，设置搜索状态
            zzss = 1;

            // 获取搜索关键词
            const SearchName = extractSearchKeyword(e.msg);
            e.reply(`正在搜索 [${SearchName || '最新视频'}] ，请稍候…`);

            // 获取缓存数据
            const cacheData = await getUserSearchCache(e.user_id);

            let SearchResults;

            // 判断是否使用缓存数据
            if (SearchName == cacheData.keyword && cacheData.page > 1) {
                SearchResults = cacheData.SearchResults
            } else {
                SearchResults = await SearchVideo(SearchName, 1, 0, 0, jiekou.url);
            }

            // 保存搜索结果至缓存
            const mergedSearchResults = {
                ...SearchResults,
                keyword: SearchName,
                page: cacheData.page || 1,
                Episode: cacheData.Episode,
                Route: cacheData.Route,
                idx: idx
            };
            await saveUserSearchCache(e.user_id, mergedSearchResults);

            // 检查并展示搜索结果
            handleAndDisplaySearchResults(e, SearchResults, jiekou.showpic);

        } catch (error) {
            e.reply(`搜索过程中发生错误：${error.message}`);
        } finally {
            // 重置搜索状态
            zzss = 0;
        }
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

        //重置搜剧设置
        zzss = 0;
        await Config.SetUserSearchVideos(e.user_id, 'SearchResults', '');
        await Config.SetUserSearchVideos(e.user_id, 'keyword', '');
        await Config.SetUserSearchVideos(e.user_id, 'page', 1);
        await Config.SetUserSearchVideos(e.user_id, 'Episode', 1);
        await Config.SetUserSearchVideos(e.user_id, 'Route', 0);

        e.reply(`已取消 [ ${SearchName || '最新视频'} ] 的搜索`);
        return true;

    }

    /** 选剧 */
    async SelectVideo(e) {
        // 1. 获取用户搜索剧集的结果
        let userSearchResult = await Config.GetUserSearchVideos(e.user_id, 'SearchResults');

        // 2. 检查是否获取到有效的搜剧结果
        if (isNotNull(userSearchResult)) {
            try {
                // 尝试将结果解析为JSON对象
                userSearchResult = JSON.parse(userSearchResult);

                // 如果解析后的结果中缺少必要的list属性，则视为数据错误
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
            // 若未获取到搜剧结果，提示用户需先执行搜剧操作
            e.reply(`你需要先#搜剧，才可以#选剧！`);
            return false;
        }

        // 3. 检查所选剧集是否存在
        const selectedEpisodeIndex = parseInt(e.msg.replace(/\D+/, '').trim()) || 1;
        if (selectedEpisodeIndex >= userSearchResult.list.length) {
            e.reply('[选剧]错误，不存在这部剧！');
            return false;
        }

        // 4. 获取用户当前选择的播放线路和搜索接口
        let currentPlaybackRoute = await Config.GetUserSearchVideos(e.user_id, 'Route') || 0;
        const searchIndex = await Config.GetUserSearchVideos(e.user_id, 'idx') || 0;

        // 5. 根据选中剧集编号，从搜剧结果中获取详细信息
        const selectedEpisodeDetails = userSearchResult.list[selectedEpisodeIndex - 1];

        // 6. 分割出线路组和资源线路组
        const playbackRoutes = selectedEpisodeDetails.vod_play_from.split('$$$');
        const resourceGroups = selectedEpisodeDetails.vod_play_url.split('$$$');

        // 7. 校正当前播放线路，防止超出有效范围
        if (resourceGroups.length < currentPlaybackRoute) {
            currentPlaybackRoute = 0;
        }

        // 8. 对于有分集的剧集，提取分集信息
        const episodesWithLinks = resourceGroups[currentPlaybackRoute]?.split('#') || [resourceGroups[0]];

        // 9. 构建分集名称和链接列表
        const episodeNames = [];
        const episodeLinks = [];
        for (let i = 0; i < episodesWithLinks.length; i++) {
            const [episodeName, episodeLink] = episodesWithLinks[i].split('$');
            episodeNames.push(episodeName);
            episodeLinks.push(episodeLink);
        }

        // 10. 组装播放数据对象，并保存至缓存
        const playData = { VodName: selectedEpisodeDetails.vod_name, episodeNames, episodeLinks };
        await Config.SetUserSearchVideos(e.user_id, 'playData', JSON.stringify(playData));

        // 11. 渲染选剧页面，传递相关数据
        await puppeteer.render("souju/select", {
            list: selectedEpisodeDetails,
            mingzi: episodeNames,
            Route: await RouteToName(playbackRoutes),
            showPic: Config.SearchVideos.resources[searchIndex]?.site.showpic || false,
            CurrentrRoute: currentPlaybackRoute
        }, {
            e,
            scale: 1.8
        });
    }

    /** 看剧 */
    async WatchVideo(e) {
        /**  当前集 */
        let Episode = parseInt(await Config.GetUserSearchVideos(e.user_id, 'Episode'));
        if (!isNotNull(Episode) || isNaN(Episode)) {
            Episode = 1;
        }
        let msg = e.msg;

        if (msg.search(`上一集`) != -1) {
            Episode--;
        } else if (msg.search(`下一集`) != -1) {
            Episode++;
        } else {
            msg = msg.replace(/[#看剧到第集\s]/g, '').trim();
            if (msg == '首') {
                Episode = 1;
            } else if (msg == '尾') {
                Episode = 99999;
            } else {
                msg = chineseToArabic(msg);
                if (isNotNull(msg)) {
                    Episode = msg;
                }
            }
        }


        let PlayData = await Config.GetUserSearchVideos(e.user_id, 'PlayData');
        if (isNotNull(PlayData)) {
            PlayData = JSON.parse(PlayData);
        } else {
            e.reply(`搜索数据错误，请重新搜索！`);
            return false;
        }

        //集数效验，防止超出范围
        if (Episode < 1) {
            Episode = 1;
        } else if (Episode > PlayData.wangzhi.length) {
            Episode = PlayData.wangzhi.length;
        }

        //console.log(`看剧：${Episode}`);
        //保存当前集
        await Config.SetUserSearchVideos(e.user_id, 'Episode', Episode);

        //console.log(`网址：${PlayData.wangzhi}`);
        if (isNotNull(PlayData.wangzhi[Episode - 1])) {
            let title = PlayData.VodName + '  ' + PlayData.mingzi[Episode - 1]
            let msg = ['*** 请复制到浏览器中观看 ***'];
            let ShortLink = await Config.SearchVideos.player + PlayData.wangzhi[Episode - 1]

            //转短链接
            //let ShortLink = await linkLongToShort(await Config.SearchVideos.player + PlayData.wangzhi[Episode - 1])
            //console.log(`短链接：${ShortLink}`);

            msg.push(ShortLink)

            let ret = await common.getforwardMsg(e, msg, {
                isxml: true,
                xmlTitle: title,
            })
                .catch(err => {
                    msg = title + '\n'
                    if (e.isGroup) {
                        let at = Number(e.user_id)
                        msg = [segment.at(at, e.sender.card), ` 群消息发送失败。\n请添加好友后私聊发送：${e.msg}`]
                    } else {
                        msg = `消息发送失败，可能被风控。`
                    }
                    e.reply(msg);
                });

            return true;//返回true 阻挡消息不再往下
        } else {
            e.reply(`集数错误，无法观看！`);
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
            console.error('解析搜剧缓存为JSON时出错:', error);
            // 处理错误或使用默认值/备用逻辑
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
        } else {
            console.warn('SearchResults.list 未定义或为 null。跳过 ID 提取。');
        }

        console.log(`获取数组：${IDs}`);

        if (isNotNull(SearchResults.list)) {
            // 写到缓存
            await Config.SetUserSearchVideos(e.user_id, 'SearchResults', JSON.stringify(SearchResults));
            const showpic = await Config.SearchVideos.resources[idx].site.showpic;
            // 发送图片
            await puppeteer.render("souju/result", {
                list: SearchResults.list,
                keyword: keyword || '最新视频',
                showpic: await showpic,
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

    /** 切换线路 */
    async ChangingRoute(e) {
        const routeNumber = parseInt(e.msg.replace(/\D+/, '').trim()) || 1;

        // 记录当前线路
        await Config.SetUserSearchVideos(e.user_id, 'Route', routeNumber - 1);

        // 获取当前选剧ID
        let currentId = await Config.GetUserSearchVideos(e.user_id, 'CurrentID');
        if (currentId) {
            currentId++
        } else {
            currentId = 1
        }

        e.msg = '#选剧' + currentId.toString();
        return await this.SelectVideo(e);
    }

    async MySearchVideo(e) {
        try {
            // 合并数据库查询，一次性获取所有所需属性
            const userSearchData = await Config.GetUserSearchVideos(e.user_id, [
                'keyword',
                'page',
                'Episode',
                'idx',
                'PlayData',
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
                PlayData: playDataStr,
                Route
            } = userSearchData;

            // 解析JSON字符串
            const PlayData = JSON.parse(playDataStr);

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
            Episode = Math.max(1, Math.min(Episode, PlayData.wangzhi.length));

            const VodName = PlayData.VodName;
            const EpisodeName = PlayData.mingzi[Episode - 1] || '未知';

            const PlayerUrl = Config.SearchVideos.player + PlayData.wangzhi[Episode - 1];

            msg += '*** 播放记录 ***\n';
            msg += `片名：${VodName}\n`;
            msg += `视频：${EpisodeName}\n`;
            msg += `链接：${PlayerUrl}\n`;

            e.reply(msg);
            return true;
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
                throw new Error('搜索过程中发生错误。');
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
 * @param {string} chineseNumeral - 待转换的中文数字字符串，默认为空字符串。
 * @returns {number} 转换后的阿拉伯数字。
 *
 * @throws {Error} 当输入的中文数字字符串不符合书写规则时，抛出错误。
 */
function chineseToArabic(chineseNumeral = '') {
    const digitMap = {
        '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
        '十': 10, '百': 100, '千': 1000, '万': 10000, '亿': 100000000,
    };

    // 支持类似“一十二”的非标准参数
    const invalidPatterns = [
        /一十/g, // "一十" -> "10"
        /一\d{2}/g, // "一十二" -> "1十二"
        /一\d{3}/g, // "一百二十三" -> "1百二十三"
    ];

    for (const pattern of invalidPatterns) {
        chineseNumeral = chineseNumeral.replace(pattern, (match) => {
            const correctedMatch = match.replace(/^一/, '1');
            console.warn(`已将非标准中文数字"${match}"规范化为"${correctedMatch}"`);
            return correctedMatch;
        });
    }

    let result = 0;
    let power = 0;
    let previousWasUnit = false;

    for (let i = chineseNumeral.length - 1; i >= 0; i--) {
        const char = chineseNumeral[i];
        const value = digitMap[char];

        if (value > 10) { // 单位字符
            if (!previousWasUnit) {
                throw new Error('无效的中文数字：单位字符无前置数字');
            }
            power *= value;
            previousWasUnit = false;
        } else { // 数字字符
            if (previousWasUnit) {
                throw new Error('无效的中文数字：连续数字字符间缺少单位字符');
            }
            result += value * Math.pow(10, power);
            previousWasUnit = true;
        }
    }

    return result;
}

/**
 * 线路转名称
 * @param {string[]} Route - 线路数组
 * @returns {string[]} RouteName - 返回搜索结果信息数组
 */
async function RouteToName(Route = []) {
    try {
        // 异常处理
        const RouteList = await Data.ReadRouteList();

        // 创建一个以RouteCode为键的对象，优化查找性能
        const routeMap = RouteList.reduce((map, item) => {
            // 确保每个item都有预期的属性
            if (typeof item.RouteCode === 'string' && typeof item.RouteName === 'string') {
                map[item.RouteCode] = item.RouteName;
            }
            return map;
        }, {});

        // 使用map简化代码，同时提供默认值'Unknown'
        const RouteName = Route.map(routeCode => routeMap[routeCode] || 'Unknown');

        return RouteName;
    } catch (error) {
        console.error("Error converting Route to Name:", error);
        // 根据需求，这里可以选择抛出异常，或者返回一个错误信息等
        // throw error;
        // 或者根据业务场景返回特定的错误信息或值
        return ['Error occurred']; // 举例，实际情况应根据需求处理
    }
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
 * 获取用户搜索缓存数据
 * @param {number} userId 用户ID
 * @returns {{keyword: string, page: number, Episode: number, Route: number, SearchResults?: any}} 缓存数据对象
 */
async function getUserSearchCache(userId) {
    const keyword = await Config.GetUserSearchVideos(userId, 'keyword') || '';
    const page = parseInt(await Config.GetUserSearchVideos(userId, 'page') || '1');
    const Episode = parseInt(await Config.GetUserSearchVideos(userId, 'Episode') || '1');
    const Route = parseInt(await Config.GetUserSearchVideos(userId, 'Route') || '0');
    const SearchResults = await Config.GetUserSearchVideos(userId, 'SearchResults');

    return {
        keyword,
        page,
        Episode,
        Route,
        SearchResults: SearchResults ? JSON.parse(SearchResults) : undefined,
    };
}

/**
 * 判断是否可以使用缓存结果
 * @param {object} cacheData 缓存数据
 * @param {string} currentKeyword 当前搜索关键词
 * @param {number} page 当前请求的页码
 * @returns {any|undefined} 可以使用的缓存结果，否则返回undefined
 */
function useCachedResults(cacheData, currentKeyword, page) {
    return cacheData.SearchResults && cacheData.keyword === currentKeyword && cacheData.page === page
        ? cacheData.SearchResults
        : undefined;
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
        Config.SetUserSearchVideos(userId, 'Episode', searchResults.Episode),
        Config.SetUserSearchVideos(userId, 'Route', searchResults.Route),
        Config.SetUserSearchVideos(userId, 'SearchResults', JSON.stringify(searchResults)),
        Config.SetUserSearchVideos(userId, 'idx', searchResults.idx),
    ]);
}

/**
 * 处理并显示搜索结果
 * @param {Event} e 事件对象
 * @param {any} searchResults 搜索结果
 * @param {boolean} showPic 图片显示设置
 */
async function handleAndDisplaySearchResults(e, searchResults, showPic) {
    if (searchResults.list) {
        const IDs = searchResults.list.map(item => item.vod_id);
        console.log(`获取数组：${IDs}`);
        await puppeteer.render("souju/result", {
            list: searchResults.list,
            keyword: searchResults.keyword || '最新视频',
            showpic: showPic,
        }, {
            e,
            scale: 1.6,
        });
    } else {
        e.reply(`未能找到 [${searchResults.keyword || '最新视频'}] 的相关内容，非常抱歉！`);
    }
}
