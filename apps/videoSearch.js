import plugin from '../../../lib/plugins/plugin.js';
import { puppeteer, common } from '../model/index.js';
import { Plugin_Path, Config } from '../components/index.js';
import Data from '../components/Data.js';
import request from '../lib/request/request.js';
import YamlReader from '../components/YamlReader.js';

// 引入拆分后的模块
import { CachePath, SearchName, IDs } from './videoSearch/config.js';
import { isNotNull, chineseToNumber, findRouteIndex, extractSearchKeyword } from './videoSearch/utils.js';
import { SearchVideo, linkLongToShort, getSearchResultsWithCache, saveUserSearchCache, handleAndDisplaySearchResults } from './videoSearch/helpers.js';

// 本地搜索状态变量
let isSearching = false;

export class VideoSearch extends plugin {
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
        if (isSearching) {
            e.reply('前方有搜索任务正在进行，请稍候再试！');
            return false;
        }

        // 获取接口索引（优先级：用户个人设置 > 群专属设置 > 全局默认设置）
        const idx = await this.getSiteIndex(e);

        // 检查resources数组是否存在且有效
        if (!Config.SearchVideos.resources || Config.SearchVideos.resources.length === 0) {
            e.reply('搜剧接口未配置，请管理员先配置接口！');
            return false;
        }

        // 检查索引是否有效
        if (idx < 0 || idx >= Config.SearchVideos.resources.length) {
            e.reply('当前接口索引无效，请使用#设置搜剧接口 选择有效接口');
            return false;
        }

        const resource = Config.SearchVideos.resources[idx];
        const site = resource?.site || {};

        // 检查接口是否存在，兼容新旧格式
        if (!resource || (!site.url && !resource.url)) {
            e.reply('接口配置错误，请联系管理员修复！');
            logger.error(`接口配置错误: 索引${idx}`, { resource });
            return false;
        }

        // 统一接口URL和标题获取方式
        const apiUrl = site.url || resource.url;
        const apiTitle = site.title || resource.title || `未命名接口(${apiUrl || '无URL'})`;

        try {
            // 开始搜索过程，设置搜索状态
            isSearching = true;

            // 获取搜索关键词
            const SearchName = extractSearchKeyword(e.msg);
            e.reply(`正在搜索 [${SearchName || '最新视频'}] ，请稍候…`);

            // 获取搜剧数据
            let SearchResults = await getSearchResultsWithCache(e.user_id, SearchName, 1, apiUrl);

            // 保存搜索结果至缓存
            await Config.SetUserSearchVideos(e.user_id, 'keyword', SearchName);
            await Config.SetUserSearchVideos(e.user_id, 'page', 1);
            await Config.SetUserSearchVideos(e.user_id, 'SearchResults', JSON.stringify(SearchResults));

            // 检查并展示搜索结果
            handleAndDisplaySearchResults(e, SearchResults, site.showpic || resource.showpic, SearchName);

        } catch (error) {
            // 检查是否是服务器错误
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
                // 资源站服务器错误，返回友好提示
                e.reply(`当前资源站服务器繁忙或发生内部错误，建议切换到其他资源站再试。`);
            } else if (error.message.includes('HTTPS 证书异常')) {
                // 证书错误，返回友好提示
                e.reply(error.message);
            } else {
                // 其他错误，返回简化的错误信息
                e.reply(`搜索失败：${error.message}`);
            }
            // 记录完整错误信息用于调试
            logger.error(`搜剧错误:`, error);
        }
        isSearching = false;
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
            await this.ShowSearchInterface(e);

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

                await Config.modifyarr('videoSearch', `resources`, site, 'add');
                await this.ShowSearchInterface(e);
            }

        }

        else if (type == "删除") {

            const index = parseInt(e.msg.replace(/^.*搜剧接口/, '').trim());
            if (isNaN(index)) {
                e.reply(`接口编号错误！`);
                return false;
            }

            let path = `${Plugin_Path}/config/config/videoSearch.yaml`;
            let yaml = new YamlReader(path);
            let resources = yaml.jsonData['resources'];
            const resource = resources[index - 1];
            const site = resource?.site || resource; // 兼容新旧格式
            let title = site?.title || '未命名接口';

            if (index < 0 && index >= resources.length) {
                e.reply(`接口编号错误！`);
                return false;
            }

            yaml.delete(`resources.${index - 1}`);

            e.reply(`已删除搜剧接口： ${title}`);

        }

        else if (type == "查看") {
            await this.ShowSearchInterface(e);
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
            await Config.modify('videoSearch', 'player', Interface)
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
        isSearching = false;
        await Config.SetUserSearchVideos(e.user_id, 'SearchResults', '');
        await Config.SetUserSearchVideos(e.user_id, 'keyword', '');
        await Config.SetUserSearchVideos(e.user_id, 'page', 1);
        await Config.SetUserSearchVideos(e.user_id, 'Episode', 1);
        await Config.SetUserSearchVideos(e.user_id, 'Route', '');

        e.reply(`已取消 [ ${SearchName || '最新视频'} ] 的搜索`);
        return true;

    }

    /**
     * 获取资源站索引，优先级：用户个人设置 > 群专属设置 > 全局默认设置
     * @param {Object} e - 事件对象
     * @returns {Number} 资源站索引
     */
    async getSiteIndex(e) {
        // 1. 优先使用用户个人设置
        const idxStr = await Config.GetUserSearchVideos(e.user_id, 'idx');
        let idx = Number(idxStr);
        // 只有当idxStr不是空字符串且转换后的数字有效时，才使用用户个人设置
        if (idxStr !== '' && !isNaN(idx) && idx >= 0) {
            return idx;
        }

        // 2. 检查是否有群专属设置
        if (e.group_id && Config.SearchVideos.GroupResourceIndex) {
            const groupConfig = Config.SearchVideos.GroupResourceIndex.find(item =>
                item.group == e.group_id
            );
            if (groupConfig && !isNaN(groupConfig.index) && groupConfig.index >= 0) {
                return groupConfig.index;
            }
        }

        // 3. 使用全局默认设置
        return Config.SearchVideos.CurrentResourceIndex || 0;
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
        const siteIdx = await this.getSiteIndex(e);
        const selectedEpisodeDetails = userSearchResult.list[selectedEpisodeIndex - 1];
        const playbackRoutes = selectedEpisodeDetails.vod_play_from.split('$$$');
        const playRoutes = await this.RouteToNameMap(playbackRoutes);
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
        const resource = await Config.SearchVideos.resources[siteIdx];
        const site = resource?.site || resource; // 兼容新旧格式

        // 渲染选剧页面，传递相关数据
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
                page = this.chineseToArabic(msg.replace(/#|到|第|页/g, "")) || 1;
                break;
        }

        // 保存参数
        await Config.SetUserSearchVideos(e.user_id, 'page', page);

        e.reply(`开始跳转到 [${keyword || '最新视频'}] - 第${page}页`);

        /** 搜剧结果 */
        const resource = await Config.SearchVideos.resources[idx];
        const site = resource?.site || resource; // 兼容新旧格式
        const domain = site?.url;
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
            // 获取资源配置，兼容新旧格式
            const resource = await Config.SearchVideos.resources[idx];
            const site = resource?.site || resource;
            // 发送图片
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

            // 检查playData是否为空
            if (!playDataStr) {
                e.reply(`没有找到有效的搜剧记录`);
                return false;
            }

            // 解析JSON字符串
            let playData;
            try {
                playData = JSON.parse(playDataStr);
            } catch (error) {
                e.reply(`搜剧记录数据格式错误，请重新搜索`);
                return false;
            }

            let Episode = initialEpisode;
            let msg = '';

            // 资源接口站名
            const resource = Config.SearchVideos.resources[idx];
            const site = resource?.site || resource; // 兼容新旧格式
            const InterfaceName = site?.title || '错误';

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

    /**
     * 显示搜剧接口列表
     * @param {Object} e - 事件对象
     */
    async ShowSearchInterface(e) {
        const resources = Config.SearchVideos.resources || [];
        if (resources.length === 0) {
            e.reply('当前没有配置搜剧接口');
            return;
        }

        let msg = '*** 搜剧接口列表 ***\n';
        const idx = await this.getSiteIndex(e);

        resources.forEach((resource, index) => {
            const site = resource?.site || resource;
            const title = site?.title || resource?.title || `未命名接口${index + 1}`;
            const url = site?.url || resource?.url || '无URL';
            const isCurrent = index === idx ? ' [当前]' : '';
            msg += `${index + 1}. ${title}${isCurrent}\n`;
            msg += `   URL: ${url}\n`;
        });

        e.reply(msg);
    }

    /**
     * 将线路代码数组转换为线路名称映射数组
     * @param {string[]} routeCodes - 线路代码数组
     * @returns {Promise<Array<{RouteName: string, RouteCode: string}>>} - 线路名称映射数组
     */
    async RouteToNameMap(routeCodes) {
        const routeData = await Data.ReadRouteList();
        const routeMap = {};

        // 构建线路代码到线路信息的映射
        if (Array.isArray(routeData)) {
            routeData.forEach(route => {
                routeMap[route.RouteCode] = route;
            });
        }

        // 将线路代码数组转换为线路名称映射数组
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
     * @returns {number} - 阿拉伯数字
     */
    chineseToArabic(chineseNum) {
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
}
