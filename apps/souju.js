import fetch from 'node-fetch'
import plugin from '../../../lib/plugins/plugin.js'
import puppeteer from "../../../lib/puppeteer/puppeteer.js";
import Data from '../components/Data.js'

let k = ""
let name = ""
let msg = ""
let nr2 = {}
let js = {}
let data1 = {}
let data = ""
let ml = process.cwd()
let bt = ""
let zzss = 0
let url = ""
let response = ""
let vid = []
let mingzi = []
let wangzhi = []
let yema = 1
let hc = ""
let zdy = ""
let zdyn = 0
let bfxl = 1
let kid = 1
let bfq = ""
let jiekou = {}

bfq = await Get_Player()
jiekou = await Get_Interface()

export class souju extends plugin {
    constructor() {
        super({
            name: '搜剧',
            dsc: '七星搜剧',
            event: 'message',
            priority: 2000,
            rule: [
                {
                    reg: "^#搜剧(.*)$|#看剧(.*)|#选剧(.*)|#取消搜剧$|#下一页|#线路(.*)",
                    fnc: 'souju'
                }, {
                    reg: '^#设置搜剧接口(.*)$',
                    fnc: 'setsouju'
                }, {
                    reg: '^#查看搜剧接口$',
                    fnc: 'getsouju'
                }
            ]
        })
    }


    async setsouju(e) {
        if (e.isMaster) {
            zdy = e.msg.replace(/#设置搜剧接口/g, "").trim();
            zdyn = Number(zdy);
            let Interface = await Read_Interface();

            if (zdyn <= Interface.resources.length && zdyn > 0) {
                let idx = zdyn - 1
                jiekou = Interface.resources[idx];
                Interface.idx = idx;

                await Write_Interface(Interface);

                console.log("设置接口：" + jiekou.url);
                Show_Interface(e);
            } else {
                e.reply("接口编号错误！");
            }

            return true;
        }

    }

    async getsouju(e) {
        if (e.isMaster == false) {
            return; //不是主人
        };

        Show_Interface(e);

        return true;
    }

    async souju(e) {
        if (e.msg == "#下一页") {
            yema = yema + 1
        }
        k = ""

        if (e.msg.includes("#取消搜剧") & zzss == 1) {
            zzss = 0
            e.reply('已取消当前 [' + name + '] 搜索')
        }

        if (zzss == 1) {
            e.reply('当前正在搜索中...请勿重复搜索')
            return
        }

        if (e.msg.includes("#搜剧") & zzss == 0 | e.msg.includes("#下一页")) {
            zzss = 1
            vid = []
            mingzi = []
            wangzhi = []

            k = e.msg.replace(/#搜剧/g, "").trim()
            console.log("开始搜索：" + k)
            if (k != "#下一页") {
                hc = k
            }

            name = hc
            e.reply('正在搜索中...请稍后')

            url = jiekou.url + '?ac=detail&wd=' + encodeURI(name) + "&pg=" + yema
            if (name == "") {
                url = jiekou.url + '?ac=detail' + "&pg=" + yema
            }

            response = await fetch(url);
            data = await response.json()

            nr2 = data.list


            for (let i = 0; i < nr2.length; i++) {
                vid[i] = nr2[i].vod_id
            }
            console.log(vid)

            if (nr2.length != 0) {
                data1 = {
                    tplFile: './plugins/zhishui-plugin/resources/html/souju/result.html',
                    dz: ml,
                    nr2: nr2,
                    showpic: jiekou.showpic
                }
                let img = await puppeteer.screenshot("souju", {
                    ...data1,
                });
                e.reply(img)
                zzss = 0
            } else {
                zzss = 0
                e.reply('未能搜索到  [' + name + ']，抱歉')
                return
            }

        }

        if (e.msg.includes("#看剧") | e.msg.includes("#线路")) {
            if (vid.length == 0) {
                e.reply('你还没有#搜剧哦。')
                return
            }
            if (e.msg.includes("#看剧")) {
                kid = e.msg.replace(/#看剧/g, "").trim()
            }

            if (kid < 1) {
                kid = 1
            }

            if (e.msg.includes("#线路")) {
                if (js.length == undefined) {
                    e.reply('你还没有#看剧哦。')
                    return
                }



                bfxl = e.msg.replace(/#线路/g, "").trim()
                if (bfxl < 1) {
                    bfxl = 1
                }
            } else {
                bfxl = 1
            }

            yema = 0

            let k1 = Number(kid - 1)
            let url2 = jiekou.url + "?ac=detail&ids=" + String(vid[k1])
            let response = await fetch(url2);
            let data2 = await response.json()

            js = data2.list
            bt = js[0].vod_name

            let vod_play_from = js[0].vod_play_from
            let jdm = vod_play_from.split('$$$')

            let jishu = js[0].vod_play_url
            let jiedian = jishu.split('$$$')

            if (jiedian.length < bfxl) {
                bfxl = jiedian.length
            }

            let jishu2 = jiedian[bfxl - 1].split('#')
            for (let i = 0; i < jishu2.length; i++) {
                let ziyuan = jishu2[i].split('$')
                mingzi[i] = ziyuan[0]
                wangzhi[i] = ziyuan[1]
            }

            data1 = {
                tplFile: './plugins/zhishui-plugin/resources/html/souju/select.html',
                js: js,
                dz: ml,
                mingzi: mingzi,
                jdm: jdm,
                bfxl: bfxl

            }
            let img = await puppeteer.screenshot("souju", {
                ...data1,
            });
            e.reply(img)
        }

        if (e.msg.includes("#选剧")) {
            k = e.msg.replace(/#选剧/g, "").trim()
            if (wangzhi[Number(k) - 1]!=undefined){
                msg = bt + mingzi[Number(k) - 1] + '\n' + bfq + wangzhi[Number(k) - 1]
                e.reply(msg)
                return true;//返回true 阻挡消息不再往下
            }
        }


    }
}

//显示搜剧接口
export async function Show_Interface(e) {
    let Interface = await Read_Interface()

    let msg = "***搜剧接口***\n";
    let name = ""
    for (var i = 0; i < Interface.resources.length; i++) {

        name = "搜剧接口" + Math.round(i + 1) + "：" + Interface.resources[i].title
        if (Interface.idx == i) {
            name = name + "[当前]"
        }

        msg += name + "\n"
    }
    msg += "你可以使用 #设置搜剧接口<数字> 来切换不同的搜索接口。"
    e.reply(msg)
}


//取播放器
export async function Get_Player() {
    let Interface = await Read_Interface();
    return Interface.player;
}

//取图片设置
export async function Get_ShowPic(idx = 0) {
    let Interface = await Read_Interface();
    return Interface.resources[idx].showpic;
}

//取当前接口
export async function Get_Interface() {
    let Interface = await Read_Interface();
    let idx = Interface.idx;

    if (idx < Interface.resources.length) {

        return Interface.resources[idx];

    } else {

        Interface.idx = 0
        await Write_Interface(Interface);

        return Interface.resources[0];
    }

}

//读取接口配置
export async function Read_Interface() {
    return Data.readJSON("Interface.json", "./plugins/zhishui-plugin/resources/data")
}

//写出接口配置
export async function Write_Interface(data) {
    return Data.writeJSON("Interface.json", data, '\t', "./plugins/zhishui-plugin/resources/data")
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}


// 发送转发消息
// 输入data一个数组,元素是字符串,每一个元素都是一条消息.
export async function ForwardMsg(e, data) {
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