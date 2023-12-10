import plugin from '../../../lib/plugins/plugin.js';
import { puppeteer } from '../model/index.js';
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
/** 当前视频索引 */
var CurrentID = 1;
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
                    reg: "^#(重新)?搜剧(.*)$",
                    fnc: 'SearchVideos'
                }, {
                    reg: '^#(设置|增加|删除|查看)搜剧接口(.*)$',
                    fnc: 'SearchInterface'
                }, {
                    reg: '^#(设置|查看)搜剧播放器(.*)$',
                    fnc: 'PlayerInterface'
                }, {
                    reg: '^#取消搜剧$',
                    fnc: 'CancelSearch'
                }, {
                    reg: '^#选剧(.*)',
                    fnc: 'SelectVideo'
                }, {
                    reg: '^#看剧.*集?$',
                    fnc: 'WatchVideo'
                }, {
                    reg: '^#(上一页|下一页|到.*页)$',
                    fnc: 'GoPage'
                }, {
                    reg: '^#线路(.*)$',
                    fnc: 'ChangingRoute'
                }, {
                    reg: '^#我的搜剧$',
                    fnc: 'MySearchVideo'
                }
            ]
        });
    }

    /** 搜剧 */
    async SearchVideos(e) {

        if (zzss == 1) {
            e.reply('前面的搜索尚未完成，你先等等！');
            return;
        }

        const idx = await Config.GetUserSearchVideos(e.user_id, 'idx') || 0;
        const jiekou = await Config.SearchVideos.resources[idx].site;

        if (zzss == 0) {
            if (!isNotNull(jiekou)) {
                e.reply('接口错误！');
                zzss = 0;
                return false;
            }
            zzss = 1;

            let retry = e.msg.search('重新') != -1;
            SearchName = e.msg.replace(/.*搜剧/g, "").trim();
            e.reply(`开始搜索 [${SearchName || '最新视频'}] ，请稍候片刻...`);

            const keyword = await Config.GetUserSearchVideos(e.user_id, 'keyword') || '';
            const page = parseInt(await Config.GetUserSearchVideos(e.user_id, 'page') || '1');
            const domain = Config.SearchVideos.resources[idx].site.url;
            let SearchResults;
            if ((page == 1) && (keyword == SearchName) && !retry) {
                //判断缓存
                SearchResults = await Config.GetUserSearchVideos(e.user_id, 'SearchResults');
                if (isNotNull(SearchResults)) {
                    SearchResults = JSON.parse(SearchResults);
                } else {

                    //不存在缓存，重新搜索
                    SearchResults = await SearchVideo(SearchName, 1, 0, 0, domain);
                    //写入缓存
                    await Config.SetUserSearchVideos(e.user_id, 'SearchResults', JSON.stringify(SearchResults));
                };
            } else {
                //初始化数据
                await Config.SetUserSearchVideos(e.user_id, 'keyword', SearchName);
                await Config.SetUserSearchVideos(e.user_id, 'page', 1);
                await Config.SetUserSearchVideos(e.user_id, 'Episode', 1);
                if (!await Config.GetUserSearchVideos(e.user_id, 'Route')) {
                    await Config.SetUserSearchVideos(e.user_id, 'Route', 0);
                }

                //不存在缓存，重新搜索
                SearchResults = await SearchVideo(SearchName, 1, 0, 0, domain);
                //写入缓存
                await Config.SetUserSearchVideos(e.user_id, 'SearchResults', JSON.stringify(SearchResults));
            };

            if (SearchResults.list.length > 0) {
                //发送图片
                IDs = SearchResults.list.map(item => item.vod_id);
                console.log(`获取数组：${IDs}`);
                await puppeteer.render("souju/result", {
                    list: SearchResults.list,
                    keyword: SearchName || '最新视频',
                    showpic: await jiekou.showpic
                }, {
                    e,
                    scale: 1.6
                });

                zzss = 0;
                return true;
            } else {
                zzss = 0;
                e.reply(`未能搜索到 [${SearchName || '最新视频'}]，抱歉！`);
                return false;
            }

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
        //console.log(`当前数组：${IDs}`)
        /** 搜剧结果 */
        let SearchResults = await Config.GetUserSearchVideos(e.user_id, 'SearchResults');
        //console.log(SearchResults);
        if (isNotNull(SearchResults)) {
            SearchResults = JSON.parse(SearchResults);
            if (!isNotNull(SearchResults.list)) {
                e.reply(`搜剧数据错误，请重新#搜剧！`);
                return false;
            }
        } else {
            e.reply(`你需要先#搜剧，才可以#选剧！`);
            return false;
        }

        //选剧
        if (e.msg.includes("#选剧")) {
            CurrentID = parseInt(e.msg.replace(/\D+/, '').trim()) || 0;
            CurrentID = CurrentID - 1;
        }
        if (CurrentID < 0) {
            CurrentID = 0;
        }
        if (CurrentID >= SearchResults.list.length) {
            e.reply('[选剧]错误，不存在这部剧！');
            return false;
        }


        //线路
        let NowRoute = await Config.GetUserSearchVideos(e.user_id, 'Route') || 0;
        //接口
        let idx = await Config.GetUserSearchVideos(e.user_id, 'idx') || 0;
        const id = SearchResults.list[CurrentID]?.vod_id || 0;
        const showpic = await Config.SearchVideos.resources[idx]?.site.showpic || false;
        console.log(`视频ID：${id}，搜索接口：${idx}`);
        const Detail = SearchResults.list.find(item => item.vod_id == id);

        //分割出 线路组
        const Route = Detail.vod_play_from.split('$$$');
        let RouteName = await RouteToName(Route);


        //分割出 资源线路组
        let jiedian = Detail.vod_play_url.split('$$$');

        if (jiedian.length < (NowRoute - 1)) {
            NowRoute = 0;
        }

        //有分集时
        let jishu2 = jiedian[NowRoute]?.split('#') || [jiedian[0]];
        //console.log(jishu2);
        let mingzi = [];
        let wangzhi = [];
        for (var i = 0; i < jishu2.length; i++) {
            let arr = jishu2[i].split('$');
            mingzi[i] = arr[0];
            wangzhi[i] = arr[1];
        }

        const PlayData = { VodName: Detail.vod_name, mingzi: mingzi, wangzhi: wangzhi };
        //写到缓存
        await Config.SetUserSearchVideos(e.user_id, 'PlayData', JSON.stringify(PlayData));
        await puppeteer.render("souju/select", {
            list: Detail,
            mingzi: mingzi,
            Route: RouteName,
            showpic: showpic,
            CurrentrRoute: NowRoute
        }, {
            e,
            scale: 1.6
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
                msg = transformChar(msg);
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
            let msg = [];
            msg.push(PlayData.VodName + '\n' + PlayData.mingzi[Episode - 1] + ' \n*** 请复制到浏览器中观看 ***')
            msg.push(await Config.SearchVideos.player + PlayData.wangzhi[Episode - 1])
            ForwardMsg(e, msg)

            return true;//返回true 阻挡消息不再往下
        } else {
            e.reply(`集数错误，无法观看！`);
            return false;
        }
    }

    /** 到指定页 */
    async GoPage(e) {
        let msg = e.msg;
        const SearchName = await Config.GetUserSearchVideos(e.user_id, 'keyword') || '';
        let page = await Config.GetUserSearchVideos(e.user_id, 'page') || 1;
        if (msg.search(`上一页`) != -1) {
            if (page > 1) {
                page--;
            } else {
                page = 1;
            }

        } else if (msg.search(`下一页`) != -1) {
            page++;
        } else {
            msg = e.msg.replace(/[#到第页\s]/g, '').trim();
            if (msg == '首') {
                page = 1;
            } else if (msg == '尾') {
                page = 999;
            } else {
                page = transformChar(msg);
            }
        }
        //保存参数
        await Config.SetUserSearchVideos(e.user_id, 'page', page);
        e.reply(`开始跳转到 [${SearchName || '最新视频'}] - 第${page}页`);


        /** 搜剧结果 */
        const idx = await Config.GetUserSearchVideos(e.user_id, 'idx') || 0;
        const domain = Config.SearchVideos.resources[idx].site.url;
        const SearchResults = await SearchVideo(SearchName, page, 0, 0, domain);
        IDs = SearchResults.list.map(item => item.vod_id);
        console.log(`获取数组：${IDs}`);

        if (isNotNull(SearchResults.list)) {
            //写到缓存
            await Config.SetUserSearchVideos(e.user_id, 'SearchResults', JSON.stringify(SearchResults));
            const showpic = await Config.SearchVideos.resources[idx].site.showpic;
            //发送图片
            await puppeteer.render("souju/result", {
                list: SearchResults.list,
                keyword: SearchName || '最新视频',
                showpic: await showpic
            }, {
                e,
                scale: 1.6
            });

            zzss = 0;
            return true;
        } else {
            zzss = 0;
            e.reply('未能搜索到  [' + SearchName || '最新视频' + ']，抱歉');
            return false;
        }

    }

    /** 切换线路 */
    async ChangingRoute(e) {
        let Route = parseInt(e.msg.replace(/\D+/, '').trim());
        if (!Route) {
            Route = 1;
        }

        //记录当前线路
        await Config.SetUserSearchVideos(e.user_id, 'Route', Route - 1);

        e.msg = '#选剧' + CurrentID.toString();
        return await this.SelectVideo(e);
    }

    /** 我的搜剧 */
    async MySearchVideo(e) {
        let keyword = await Config.GetUserSearchVideos(e.user_id, 'keyword');
        let page = await Config.GetUserSearchVideos(e.user_id, 'page') || 1;
        let Episode = await Config.GetUserSearchVideos(e.user_id, 'Episode');
        let idx = await Config.GetUserSearchVideos(e.user_id, 'idx') || 0;
        let PlayData = await Config.GetUserSearchVideos(e.user_id, 'PlayData');
        let Route = await Config.GetUserSearchVideos(e.user_id, 'Route');
        PlayData = JSON.parse(PlayData);
        let msg = '';
        //资源接口站名
        let InterfaceName = await Config.SearchVideos.resources[idx]?.site.title || '错误';

        msg += '*** 搜索记录 ***\n';
        msg += `接口：${InterfaceName}\n`;
        msg += `关键词：${keyword}\n`;
        msg += `搜索页：${page}\n`;
        msg += `线路：${Route}\n\n`;

        //集数效验，防止超出范围
        if (Episode < 1) {
            Episode = 1;
        } else if (Episode > PlayData.wangzhi.length) {
            Episode = PlayData.wangzhi.length;
        }

        let VodName = PlayData.VodName;
        let EpisodeName = PlayData.mingzi[Episode - 1] || '未知';

        let PlayerUrl = await Config.SearchVideos.player + PlayData.wangzhi[Episode - 1];

        msg += '*** 播放记录 ***\n';
        msg += `片名：${VodName}\n`;
        msg += `视频：${EpisodeName}\n`;
        msg += `链接：${PlayerUrl}\n`;
        e.reply(msg);
        return true;
    }

}

/**显示搜剧接口 */
async function Show_SearchInterface(e) {

    let msg = "***搜剧接口***\n\n";
    let resources = await Config.SearchVideos.resources;
    const len = resources.length;

    let Route = parseInt(await Config.GetUserSearchVideos(e.user_id, 'idx'));
    if (Route < 0 && Route > len - 1) {
        Route = 0;
    }

    msg += resources.map((resource, i) => {
        const title = resource.site.title;
        return `${i === Route ? '>>' : ''} ${i + 1}、${title} ${i === Route ? '<<' : ''}`;
    }).join('\n') + "\n\n你可以使用 #设置搜剧接口<数字> 来切换不同的搜索接口。\n";
    e.reply(msg);

}

/**
 * 判断对象是否不为undefined且不为null、NaN
 * @param obj 对象
 * @returns obj对象不存在时返回：false，否则返回：true
 */
function isNotNull(obj) {
    if (obj == undefined || obj == null || obj != obj) { return false; }
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
    let url = domain + '?ac=detail&wd=' + encodeURI(keyword) + "&t=" + type + "&h=" + hour + "&pg=" + page;
    let res = await request.post(url)
        .then(res => res.json())
        .catch(err => {
            logger.error(err);
            //return err
        });
    return res;
}

function transformChar(str = '') {
    if (parseInt(str) == str) {
        return parseInt(str);
    } else if (str.search(/[十百千万亿]/) == -1) {
        let arr = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
        for (var i = 0; i < arr.length; i++) {
            str = str.replace(new RegExp(arr[i], "g"), (i + 1));
        }
        return parseInt(str);
    }

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

    if (arr[0] == "十") {
        arr.unshift('一');
    }

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
                temp += numChar[char];
            }
        }
    }
    console.log(`sum`, sum);
    console.log(`temp`, temp);
    temp = parseInt(sum) + parseInt(temp);
    return temp;
}

/**
 * 线路转名称
 * @param {string[]} Route - 线路数组
 * @returns {string[]} Name - 返回搜索结果信息数组
 */
async function RouteToName(Route = []) {
    const RouteList = await Data.ReadRouteList();
    let RouteName = [];

    for (let i = 0; i < Route.length; i++) {
        let Name = RouteList.find(item => item.RouteCode == Route[i]).RouteName;
        RouteName.push(Name);
    };
    return RouteName;
}

/**
 * 发送转发消息
 * @param data 输入一个数组,元素是字符串,每一个元素都是一条消息.
*/
async function ForwardMsg(e, data) {
    // use map method to create msgList
    const msgList = data.map(i => ({
        message: i,
        NickName: Bot.NickName,
        user_id: Bot.uin
    }));
    // use ternary operator to simplify if...else statement
    await e.reply(msgList.length == 1 ? msgList[0].message : await Bot.makeForwardMsg(msgList));
};
