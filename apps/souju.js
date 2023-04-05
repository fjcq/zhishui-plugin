import fetch from 'node-fetch'
import plugin from '../../../lib/plugins/plugin.js'
import fs from 'fs'
import { puppeteer } from '../model/index.js'
import Data from '../components/Data.js'
import { Config } from '../components/index.js'
import request from '../lib/request/request.js'

let k = ""
let name = ""
let msg = ""
let nr2 = {}
let js = {}
let data = ""
let ml = process.cwd()
let bt = ""
let zzss = 0
let url = ""
var vid = []
var mingzi = []
var wangzhi = []
let yema = 1
let hc = ""
var bfxl = 1
let kid = 1
/**搜剧接口 */

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
                    reg: '^#看剧(.*)',
                    fnc: 'WatchVideo'
                }, {
                    reg: '^#(上一页|下一页)$',
                    fnc: 'NextPage'
                }, {
                    reg: '^#到(.*)页$',
                    fnc: 'GoPage'
                }, {
                    reg: '^#切换线路(.*)$',
                    fnc: 'ChangingRoute'
                }
            ]
        })
    }

    /** 搜剧 */
    async SearchVideos(e) {
        yema = 1

        k = ""
        let jiekou = Config.SearchVideos.resources[Config.SearchVideos.idx].site

        if (zzss == 1) {
            e.reply('当前正在搜索中...请勿重复搜索')
            return
        }

        if (e.msg.includes("#搜剧") && zzss == 0 || e.msg.includes("#上一页") || e.msg.includes("#下一页")) {
            if (jiekou == undefined) {
                e.reply('接口错误！')
                zzss = 0
                return false
            }

            zzss = 1

            k = e.msg.replace(/#搜剧/g, "").trim()
            if (k != "#下一页") {
                hc = k
            }
            name = hc
            e.reply(`开始搜索 [${name || '最新视频'}] ，请稍候片刻...`)

            jiekou = Config.SearchVideos.resources[Config.SearchVideos.idx].site
            url = jiekou.url + '?ac=detail&wd=' + encodeURI(name) + "&pg=" + yema
            if (name == "") {
                url = jiekou.url + '?ac=detail' + "&pg=" + yema
            }

            let response = await fetch(url);
            data = await response.json()
            nr2 = data.list
            vid = nr2.map(item => item.vod_id);
            console.log('vid')
            console.log(vid)

            if (isNotNull(nr2)) {

                let img = await puppeteer.render("souju/result", {
                    dz: ml,
                    nr2: nr2,
                    showpic: jiekou.showpic
                }, {
                    e,
                    scale: 1.6
                });

                zzss = 0
            } else {
                zzss = 0
                e.reply('未能搜索到  [' + name || '最新视频' + ']，抱歉')
                return false
            }

        }

        if (e.msg.includes("#看剧") | e.msg.includes("#线路")) {
            console.log(nr2)
            console.log(vid)
            if (!isNotNull(vid)) {
                e.reply('你还没有 [ #搜剧 ] 哦。')
                return false
            }
            if (e.msg.includes("#看剧")) {
                kid = e.msg.replace(/#看剧/g, "").trim()
            }

            if (kid < 1) {
                kid = 1
            }

            //线路
            if (e.msg.includes("#线路")) {
                bfxl = e.msg.replace(/#线路/g, "").trim()
                if (bfxl < 1) {
                    bfxl = 1
                }
            } else {
                bfxl = 1
            }

            let k1 = Number(kid - 1)
            let url2 = jiekou.url + "?ac=detail&ids=" + String(vid[k1])
            let response = await fetch(url2);
            let data2 = await response.json()
            if (data2.list.length = 0 || !isNotNull(data2.list)) {
                e.reply('没有找到资源！')
                return false
            }

            console.log(`data2${JSON.stringify(data2)}`);
            js = data2.list

            bt = js[0].vod_name || ''

            let vod_play_from = js[0].vod_play_from
            let jdm = vod_play_from.split('$$$')

            let jishu = js[0].vod_play_url
            let jiedian = jishu.split('$$$')

            if (jiedian.length < bfxl) {
                bfxl = jiedian.length
            }

            let jishu2 = jiedian[bfxl - 1].split('#')
            [mingzi, wangzhi] = jishu2.map((str) => {
                const [name, url] = str.split('$')
                return [name, url]
            })
            console.log(`mingzi${mingzi}`);
            console.log(`wangzhi${wangzhi}`);

            await puppeteer.render("souju/select", {
                js: js,
                dz: ml,
                mingzi: mingzi,
                jdm: jdm,
                bfxl: bfxl
            }, {
                e,
                scale: 1.6
            });

        }

        if (e.msg.includes("#选剧")) {
            let n = e.msg.replace(/#选剧/g, "").trim()
            console.log(`JS：${JSON.stringify(js)}`);
            console.log(`wangzhi：${wangzhi}`);
            if (isNotNull(wangzhi[Number(n) - 1])) {
                msg = bt + mingzi[Number(n) - 1] + '\n' + Config.SearchVideos.player + wangzhi[Number(k) - 1]
                e.reply(msg)
                return true;//返回true 阻挡消息不再往下
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
        e.reply('已取消 [' + name || '最新视频' + '] 的搜索')
        return true;
    }

    /** 选剧 */
    async SelectVideo(e) {
        return true
    }

    /** 看剧 */
    async WatchVideo(e) {
        return true
    }

    /** 上一页|下一页 */
    async NextPage(e) {
        if (e.msg == "#上一页" && yema > 1) {
            yema--
        } else if (e.msg == "#下一页") {
            yema++
        } else {
            yema = 1
        }
        e.reply("当前页码：" + yema);
        return true
    }
    /** 到指定页 */
    async GoPage(e) {
        let index = e.msg.replace(/[#到第页\s]/g, '').trim();

        if (index == '首') {
            yema = 1
        } else if (index == '尾') {
            yema = 999
        } else {
            yema = transformChar(index)
        }


        e.reply("当前页码：" + yema);
        return true
    }

    /** 切换线路 */
    async ChangingRoute(e) {
        let index = parseInt(e.msg.replace(/\D+/, '').trim());
        e.reply("当前路：" + index);
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


/**取播放器*/
async function Get_Player() {
    return await Config.SearchVideos.player;
}

/**取解析接口*/
async function Get_analysis() {
    return await Config.SearchVideos.analysis;
}

/**取图片设置*/
async function Get_ShowPic(idx = 0) {
    return await Config.SearchVideos.resources[idx].site.showpic;
}

/**取当前接口*/
async function Get_Interface() {
    return await Config.SearchVideos.resources[idx].site
}

/**读取接口配置*/
async function Read_Interface() {
    return await Config.SearchVideos;
}

//写出接口配置
async function Write_Interface(data) {
    return Data.writeJSON("souju.json", data, "./plugins/zhishui-plugin/config/config", '\t')
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
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
 * 关键词搜索作品
 * @param {string} keyword - 搜索关键词
 * @param {number} [page=1] - 页码，默认为1
 * @param {number} [type=0] - 搜索类型
 * @param {number} [hour=0] - 搜索几小时内的数据
 * @param {string} [domain=''] - 资源站网址
 * @throws {Error} 当未找到作品时，会抛出异常
 * @returns {Array<string>} 返回搜索结果信息数组
 */
async function SearchVideo(keyword, page = 1, type = 0, hour = 0, domain = '') {
    if (domain == '') {
        domain = Config.SearchVideos.resources[Config.SearchVideos.idx].site.url
    }

    let url = domain + '?ac=detail&wd=' + encodeURI(keyword) + "&t=" + type + "&h=" + hour + "&pg=" + page
    let res = await request.get(url)
        .then(res => res.json())
        .catch(err => {
            logger.error(err)
            throw Error(`搜剧出错啦~！：${err.message.match(/reason:(.*)/)[1]}`)
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