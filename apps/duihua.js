import plugin from '../../../lib/plugins/plugin.js'
import fetch from "node-fetch";
import { isNotNull } from './yanzou.js';
var tempMsg = ""
let jieguo
let zs
let bot = "小七" //你要触发的前缀
let msgData = []


export class duihua extends plugin {
    constructor() {
        super({
            name: '[止水插件]对话',
            dsc: '智能对话',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `${bot}`,
                    fnc: 'duihua'
                }, {
                    /** 命令正则匹配 */
                    reg: '^[#](结束|取消|关闭)(对话|聊天)$', //匹配消息正则,命令正则
                    /** 执行方法 */
                    fnc: 'jsdh'
                }
            ]
        })
    }


    async jsdh(e) {
        tempMsg = ""
        msgData = []
        e.reply('已经重置对话了！')

    }

    async duihua(e) {
        let strToDelete = `[#]${bot}`;
        let reg = new RegExp(strToDelete, 'g');
        let msg = e.msg.replace(reg, '').trim();

        jieguo = await AiChatGPT(msg);
        console.log(`ChatGPT结果：${jieguo}`);

        if (!isNotNull(jieguo)) {
            jieguo = await AiForChange(msg)
            console.log(`ForChange结果：${jieguo}`);
        }

        if (!isNotNull(jieguo)) {
            e.reply('重置聊天对话啦')
            tempMsg = ""
            msgData = []
            return
        }

        e.reply(jieguo, true)
        tempMsg = ""
        zs = tempMsg.length
        return;
    }
}

//https://api.forchange.cn/
async function AiForChange(msg) {
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
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36 Edg/110.0.1587.63'
        }

    })

    if(res3.status != 200){
        console.log(res3.status);
        console.log(res3.statusText);
        return undefined
    }

    let res2 = await res3.json();
    let text = res2.choices[0].text
    if (isNotNull(text)) {
        const regex = /(\n|答：|Bot:|robot:|Robot:|Computer:|computer:|AI:)/gi;
        text = text.replace(regex, '').trim();
    }
    return text

}

//https://chatgpt-api.shn.hk/v1/
async function AiChatGPT(msg) {

    msgData.push({ "role": "user", "content": msg })
    //console.log(msgData)
    let response4 = await fetch('https://chatgpt-api.shn.hk/v1/', {
        method: 'POST',
        headers: {
            'Content-Type': "application/json",
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36 Edg/110.0.1587.63'
        },
        body: JSON.stringify(
            {
                "model": "gpt-3.5-turbo",
                "messages": msgData
            }
        )
    });

    if(response4.status != 200){
        console.log(response4.status);
        console.log(response4.statusText);
        return undefined
    }

    let res = await response4.json();
    if (res) {
        let text = res.choices[0].message.content;
        return text.startsWith('\n\n') ? text.substring(2) : text;
    }
    return undefined;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}