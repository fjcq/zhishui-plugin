import fetch from 'node-fetch'
import { segment } from 'oicq'
import plugin from '../../../lib/plugins/plugin.js'
import puppeteer from "../../../lib/puppeteer/puppeteer.js";

let msg3 = []
let k = ""
let name = ""
let msg = ""
let msg2 = []
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
let kg = 0
let zdy = ""
let zdyn = 0
let bfxl = 1
let kid = 1

// 视频搜索接口
let jiekouzu = ["http://zj.qxyys.com/api.php/provide/vod/", "https://www.partnersky-horoskop.com/api.php/provide/vod/"]
// 播放器
let bfq = "http://bfq.qxyys.com/?url="

let jiekou = jiekouzu[0]



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
                    reg: '^#设置搜剧接口(.*)|#当前搜剧接口',
                    fnc: 'soujuset'
                }
            ]
        })
    }


    async soujuset(e) {
        if (e.isMaster) {

            if (e.msg.includes("#设置搜剧接口")) {
                zdy = e.msg.replace(/#设置搜剧接口/g, "").trim()
                zdyn = Number(zdy)

                if (zdy.length > 2) {
                    jiekou = zdy
                } else {
                    if (zdyn < 1) {
                        zdyn = 1
                    }
                    if (zdyn > jiekouzu.length) {
                        zdyn = jiekouzu.length
                    }
                    jiekou = jiekouzu[zdyn - 1]
                }
                console.log("设置接口：" + jiekou)

                e.reply("设置成功！")
            }

            if (e.msg.includes("#当前搜剧接口")) {
                e.reply("当前接口：" + jiekou)

            }
        }

    }


    async souju(e) {
        if (e.msg == "#下一页") {
            yema = yema + 1
        }
        k = ""

        if (e.msg.includes("#取消搜剧") & zzss == 1) {
            zzss = 0
            e.reply('已取消当前' + name + '搜索')
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
            try {
                url = jiekou + '?ac=detail&wd=' + encodeURI(name) + "&pg=" + yema
                if (name == "") {
                    url = jiekou + '?ac=detail' + "&pg=" + yema
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
                        tplFile: './plugins/zhishui-plugin/resources/souju/result.html',
                        dz: ml,
                        nr2: nr2
                    }
                    let img = await puppeteer.screenshot("123", {
                        ...data1,
                    });
                    e.reply(img)
                    zzss = 0
                }
            } catch (err) {
                e.reply('未能搜索到 ' + name + '，抱歉')
                console.log(err)
                zzss = 0
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
            let url2 = jiekou + "?ac=detail&ids=" + String(vid[k1])
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
                tplFile: './plugins/zhishui-plugin/resources/souju/select.html',
                js: js,
                dz: ml,
                mingzi: mingzi,
                jdm: jdm,
                bfxl: bfxl

            }
            let img = await puppeteer.screenshot("123", {
                ...data1,
            });
            e.reply(img)
        }




        if (e.msg.includes("#选剧")) {
            k = e.msg.replace(/#选剧/g, "").trim()
            msg = bt + mingzi[Number(k) - 1] + '\n' + bfq + wangzhi[Number(k) - 1]
            e.reply(msg)
        }
        return true;//返回true 阻挡消息不再往下
    }
}



function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}



async function ForwardMsg(e, data) {
    console.log(data[1]);
    let msgList = [];
    for (let i = 0; i < msg2.length; i++) {
        msgList.push({
            message: k + msg2[i] + "\n" + msg3[i],
            nickname: Bot.nickname,
            user_id: Bot.uin,
        });
    }
    if (msgList.length == 10) {
        await e.reply(msgList[0].message);
    }
    else {
        //console.log(msgList);
        await e.reply(await Bot.makeForwardMsg(msgList));
    }
    return;
}