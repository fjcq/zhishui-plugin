import plugin from '../../../lib/plugins/plugin.js'
import fetch from "node-fetch";
var tempMsg = ""
let jieguo
let zs

export class duihua extends plugin {
    constructor() {
        super({
            name: '[止水插件]对话',
            dsc: '智能对话',
            event: 'message',
            priority: 2000,
            rule: [
                {
                    reg: "^#小七.*",
                    fnc: 'duihua'
                }
            ]
        })
    }

    async duihua(e) {
        let msg = e.msg.replace(/#小七/, "").trim()
        tempMsg = tempMsg + "\nHuman: " + msg
        var data2 = {
            prompt: tempMsg,
            tokensLength: zs
        }

        let url = "https://api.forchange.cn/"


        let res3 = await fetch(url, {
            method: "post",

            body: JSON.stringify(data2),
            headers: {
                'Content-Type': "application/json",
                'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36'
            }

        })
        let res2 = await res3.json();
        jieguo = res2.choices[0].text


        if (jieguo == null) {
            e.reply('重置聊天对话啦')
            tempMsg = ""
            return
        }
        jieguo = jieguo.replace(/\n/, "").trim()
        jieguo = jieguo.replace(/答：/, "").trim()
        jieguo = jieguo.replace(/Bot:/, "").trim()
        jieguo = jieguo.replace(/robot:/, "").trim()
        jieguo = jieguo.replace(/Robot:/, "").trim()
        jieguo = jieguo.replace(/Computer:/, "").trim()
        jieguo = jieguo.replace(/computer:/, "").trim()
        jieguo = jieguo.replace(/AI:/, "").trim()

        e.reply(jieguo, true)
        tempMsg = ""
        zs = tempMsg.length
        return;
    }
}