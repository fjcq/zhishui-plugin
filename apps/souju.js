import plugin from '../../../lib/plugins/plugin.js'
import { puppeteer } from '../model/index.js'
import Data from '../components/Data.js'
import { Plugin_Path, Config } from '../components/index.js'
import request from '../lib/request/request.js'

/** 缓存目录 */
const CachePath = `${Plugin_Path}/resources/Cache/SearchVideos`
/** 搜剧视频名称 */
let SearchName = ""
/** 视频ID数组 */
var IDs = []
/** 当前播放线路 */
var CurrentrRoute = 0
/** 当前视频ID */
var CurrentID = 1
var zzss = 0

export class souju extends plugin {
    constructor() {
        super({
            name: '[止水插件]搜剧',
            dsc: '七星搜剧',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: "^#搜剧(.*)$",
                    fnc: 'SearchVideos'
                }, {
                    reg: '^#设置搜剧接口(.*)$',
                    fnc: 'SetInterface'
                }, {
                    reg: '^#查看搜剧接口$',
                    fnc: 'GetInterface'
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
                }
            ]
        })
    }

    /** 搜剧 */
    async SearchVideos(e) {

        if (zzss == 1) {
            e.reply('当前正在搜索中...请勿重复搜索')
            return
        }
        let jiekou = await Config.SearchVideos.resources[Config.SearchVideos.idx].site
        if (e.msg.includes("#搜剧") && zzss == 0) {
            if (jiekou == undefined) {
                e.reply('接口错误！')
                zzss = 0
                return false
            }
            zzss = 1

            SearchName = e.msg.replace(/#搜剧/g, "").trim()

            //保存数据
            Config.modify('souju', 'keyword', SearchName)
            Config.modify('souju', 'page', 1)

            e.reply(`开始搜索 [${SearchName || '最新视频'}] ，请稍候片刻...`)

            /** 搜剧结果 */
            let SearchResults = await SearchVideo(SearchName, 1)
            IDs = SearchResults.list.map(item => item.vod_id);
            console.log(`获取数组：${IDs}`)

            if (isNotNull(SearchResults.list)) {
                //写到缓存
                WriteCacheJson('SearchResults.json', SearchResults)
                //发送图片
                await puppeteer.render("souju/result", {
                    list: SearchResults.list,
                    showpic: await jiekou.showpic
                }, {
                    e,
                    scale: 1.6
                });

                zzss = 0
                return true
            } else {
                zzss = 0
                e.reply('未能搜索到  [' + SearchName || '最新视频' + ']，抱歉')
                return false
            }

        }

    }

    /** 设置搜剧接口 */
    async SetInterface(e) {
        if (e.isMaster) {
            let index = parseInt(e.msg.replace(/\D+/, '').trim());

            if (index <= Config.SearchVideos.resources.length && index > 0) {
                Config.modify('souju', 'idx', index - 1)
                Show_Interface(e);
            } else {
                e.reply("接口编号错误！");
            }
            return true;
        }
        return false
    }

    /** 查看搜剧接口 */
    async GetInterface(e) {
        if (e.isMaster == false) {
            return; //不是主人
        };

        Show_Interface(e);

        return true;
    }

    /** 取消搜剧 */
    async CancelSearch(e) {
        zzss = 0
        e.reply(`已取消 [ ${SearchName || '最新视频'} ] 的搜索`)
        return true;
    }

    /** 选剧 */
    async SelectVideo(e) {
        console.log(`当前数组：${IDs}`)
        /** 搜剧结果 */
        let SearchResults = ReadCacheJson('SearchResults.json')

        if (!isNotNull(SearchResults.list)) {
            e.reply('你还没有 [ #搜剧 ] 哦。')
            return false
        }

        //选剧
        if (e.msg.includes("#选剧")) {
            CurrentID = parseInt(e.msg.replace(/\D+/, '').trim()) || 0;
            CurrentID = CurrentID - 1
        }
        if (CurrentID < 0) {
            CurrentID = 0
        }
        if (CurrentID >= SearchResults.list.length) {
            e.reply('[选剧]错误，不存在这部剧！')
            return false
        }


        //线路
        CurrentrRoute = await Config.SearchVideos.Route

        let idx = SearchResults.list[CurrentID].vod_id
        console.log(`选择的ID：${idx}，选择的线路：${CurrentrRoute}`);




        let Detail = SearchResults.list.find(item => item.vod_id == idx);
        console.log(Detail.vod_name);

        //分割出 线路组
        let Route = Detail.vod_play_from.split('$$$')

        //分割出 资源线路组
        let jiedian = Detail.vod_play_url.split('$$$')

        if (jiedian.length < CurrentrRoute) {
            CurrentrRoute = jiedian.length
        }

        //有分集时
        let jishu2 = jiedian[CurrentrRoute].split('#')

        let mingzi = []
        let wangzhi = []
        for (var i = 0; i < jishu2.length; i++) {
            let arr = jishu2[i].split('$')
            mingzi[i] = arr[0]
            wangzhi[i] = arr[1]
        }

        const PlayData = { VodName: Detail.vod_name, mingzi: mingzi, wangzhi: wangzhi }
        //写到缓存
        WriteCacheJson('PlayData.json', PlayData)

        await puppeteer.render("souju/select", {
            list: Detail,
            mingzi: mingzi,
            Route: Route,
            CurrentrRoute: CurrentrRoute
        }, {
            e,
            scale: 1.6
        });


    }

    /** 看剧 */
    async WatchVideo(e) {
        let Episode = await Config.SearchVideos.Episode || 1
        let msg = e.msg

        if (msg.search(`上一集`) != -1) {
            Episode--;
        } else if (msg.search(`下一集`) != -1) {
            Episode++
        } else {
            msg = msg.replace(/[#看剧到第集\s]/g, '').trim();
            if (msg == '首') {
                Episode = 1
            } else if (msg == '尾') {
                Episode = 99999
            } else {
                Episode = transformChar(msg)
            }
        }


        let PlayData = await ReadCacheJson('PlayData.json')

        //集数效验，防止超出范围
        if (Episode < 1) {
            Episode = 1
        } else if (Episode > PlayData.wangzhi.length) {
            Episode = PlayData.wangzhi.length
        }

        console.log(`看剧：${Episode}`);
        //保存参数
        Config.modify('souju', 'Episode', Episode)

        console.log(`网址：${PlayData.wangzhi}`);
        if (isNotNull(PlayData.wangzhi[Episode - 1])) {
            let msg = PlayData.VodName + '\n' + PlayData.mingzi[Episode - 1] + '\n' + await Config.SearchVideos.player + PlayData.wangzhi[Episode - 1]
            e.reply(msg)
            return true;//返回true 阻挡消息不再往下
        } else {
            e.reply(`集数错误，无法观看！`)
            return false;
        }
    }

    /** 到指定页 */
    async GoPage(e) {
        let msg = e.msg
        let SearchName = await Config.SearchVideos.keyword
        let yema = await Config.SearchVideos.page || 1
        if (msg.search(`上一页`) != -1) {
            if (yema > 1) {
                yema--;
            } else {
                yema = 1;
            }

        } else if (msg.search(`下一页`) != -1) {
            yema++
        } else {
            msg = e.msg.replace(/[#到第页\s]/g, '').trim();
            if (msg == '首') {
                yema = 1
            } else if (msg == '尾') {
                yema = 999
            } else {
                yema = transformChar(msg)
            }
        }
        //保存参数
        Config.modify('souju', 'page', yema)

        e.reply(`开始跳转到 [${SearchName || '最新视频'}] - 第${yema}页`);


        /** 搜剧结果 */
        let SearchResults = await SearchVideo(SearchName, yema)
        IDs = SearchResults.list.map(item => item.vod_id);
        console.log(`获取数组：${IDs}`)

        if (isNotNull(SearchResults.list)) {
            //写到缓存
            WriteCacheJson('SearchResults.json', SearchResults)
            let showpic = await Config.SearchVideos.resources[Config.SearchVideos.idx].site.showpic
            //发送图片
            await puppeteer.render("souju/result", {
                list: SearchResults.list,
                showpic: await showpic
            }, {
                e,
                scale: 1.6
            });

            zzss = 0
            return true
        } else {
            zzss = 0
            e.reply('未能搜索到  [' + SearchName || '最新视频' + ']，抱歉')
            return false
        }

    }

    /** 切换线路 */
    async ChangingRoute(e) {
        let index = parseInt(e.msg.replace(/\D+/, '').trim());
        e.reply("当前线路：" + index);
        Config.modify('souju', 'Route', index - 1)

        return true
    }
}

//显示搜剧接口
async function Show_Interface(e) {

    let msg = "***搜剧接口***\n\n";
    let title = ""
    let resources
    for (var i = 0; i < Config.SearchVideos.resources.length; i++) {
        resources = Config.SearchVideos.resources[i].site
        title = resources.title
        if (Config.SearchVideos.idx == i) {
            title = `>> ${resources.title} <<`
        }
        msg += `${i + 1}、${title}\n`;

    }
    msg += "\n你可以使用 #设置搜剧接口<数字> 来切换不同的搜索接口。\n";
    e.reply(msg)
}



/**
 * 发送转发消息
 * @param data 输入一个数组,元素是字符串,每一个元素都是一条消息.
*/
async function ForwardMsg(e, data) {
    let msgList = []
    for (let i of data) {
        msgList.push({
            message: i,
            nickname: Bot.nickname,
            user_id: Bot.uin
        })
    }
    if (msgList.length == 1) {
        await e.reply(msgList[0].message)
    } else {
        await e.reply(await Bot.makeForwardMsg(msgList))
    }
}

/**
 * 判断对象是否不为undefined且不为null、NaN
 * @param obj 对象
 * @returns obj==null/undefined,return false,other return true
 */
function isNotNull(obj) {
    if (obj == undefined || obj == null || obj != obj) { return false }
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
    if (domain == '') {
        domain = Config.SearchVideos.resources[Config.SearchVideos.idx].site.url
    }

    let url = domain + '?ac=detail&wd=' + encodeURI(keyword) + "&t=" + type + "&h=" + hour + "&pg=" + page
    let res = await request.get(url)
        .then(res => res.json())
        .catch(err => {
            logger.error(err)
            throw Error(`搜剧出错啦~！：${err.message}`)
        })
    return res
}
/**
 * 获取视频详情内容
 * @param {number} ids - 视频id
 * @param {number} [page=1] - 页码，默认为1
 * @param {number} [type=0] - 搜索类型
 * @param {number} [hour=0] - 搜索几小时内的数据
 * @param {string} [domain=''] - 资源站网址
 * @throws {Error} 当未找到作品时，会抛出异常
 * @returns {Array<string>} 返回搜索结果信息数组
 */
async function GetVideoDetails(ids = 0, page = 1, type = 0, hour = 0, domain = '') {
    if (domain == '') {
        domain = Config.SearchVideos.resources[Config.SearchVideos.idx].site.url
    }

    let url = domain + '?ac=detail&ids=' + ids + "&t=" + type + "&h=" + hour + "&pg=" + page
    console.log(`开始请求：${url}`);
    let res = await request.get(url)
        .then(res => res.json())
        .catch(err => {
            logger.error(err)
            throw Error(`搜剧出错啦~！：${err.message}`)
        })
    return res
}

function transformChar(str = '') {
    if (parseInt(str) == str) {
        return parseInt(str)
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
        arr.unshift('一')
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
                temp += numChar[char]
            }
        }
    }
    console.log(`sum`, sum);
    console.log(`temp`, temp);
    temp = parseInt(sum) + parseInt(temp)
    return temp;
}

/**
 * 读取缓存JSON
 * @param {string} file - 文件名
 * @returns {JSON<object>} 返回JSON对象
 */
function ReadCacheJson(file = '') {
    let object = Data.readJSON(file, CachePath)
    return object
}

/**
 * 写入缓存JSON
 * @param {string} file - 文件名
 * @param {object} [data={}] - 要写入的内容
 * @returns {boolean} 返回JSON对象
 */
function WriteCacheJson(file = '', data = {}) {
    return Data.writeJSON(file, data, CachePath)
}