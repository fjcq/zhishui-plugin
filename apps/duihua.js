import plugin from '../../../lib/plugins/plugin.js'
import lodash from 'lodash'
import fetch from "node-fetch";
import { segment } from 'oicq';
import { BingAIClient } from '@waylaidwanderer/chatgpt-api'//这个就是依赖 去装吧  pnpm add @waylaidwanderer/chatgpt-api -w
import { isNotNull } from './yanzou.js';
var tempMsg = ""
let jieguo
let zs
let cs = 0
let response
let bingcookie = "MUID=09AA49579F636A8D3F315B9C9EB16B43; MUIDB=09AA49579F636A8D3F315B9C9EB16B43; USRLOC=HS=1; SRCHD=AF=NOFORM; SRCHUID=V=2&GUID=54F2F9BB95A04332B961BE0C3F2088E4&dmnchg=1; ANON=A=592CA614CE31077CF348218AFFFFFFFF; SUID=A; _UR=QS=0&TQS=0; MUIDV=NU=1; ZHCHATSTRONGATTRACT=TRUE; ABDEF=V=13&ABDV=13&MRNB=1678008797474&MRB=0; ZHCHATWEAKATTRACT=TRUE; SRCHUSR=DOB=20230305; SRCHHPGUSR=SRCHLANG=zh-Hans; _EDGE_S=SID=395CD2F152AA66FB037DC03A53E967C9; SNRHOP=I=&TS=; WLS=C=d0c632e6321dd450&N=%e5%b3%b0; _SS=SID=395CD2F152AA66FB037DC03A53E967C9; _U=1r3ruzbXNk5o0fR8T7fY9UhQD9INEG5AA4orz60epXqQYkuzZvU5dnifvvxl3wYh9Ft3W0C-SAOVUHKA2BKLPbVsUWJoWX7YoIJKadgCdbjYugXADg3EvTOSPoDtfvvux-UQD1agA-RyA8SbUcvz3P7d-Ssu9LG92TVYB7zLrEiOlbGodPBLAbMEr0FFtEoV5_TiXZQBbvHHjtkBTBfy3Xw"

let bot = "小七" //你要触发的前缀
let msgData = []

let bingAIClient = new BingAIClient({
    // Necessary for some people in different countries, e.g. China (https://cn.bing.com)
    host: 'https://www.bing.com',
    // "_U" cookie from bing.com
    userToken: '',
    // If the above doesn't work, provide all your cookies as a string instead
    cookies: '_U=' + bingcookie,
    // A proxy string like "http://<ip>:<port>"
    proxy: '',
    // (Optional) Set to true to enable `console.debug()` logging
    debug: false,
});
let xx = ""

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
                    reg: '^#结束对话', //匹配消息正则,命令正则
                    /** 执行方法 */
                    fnc: 'jsdh'
                }, {
                    /** 命令正则匹配 */
                    reg: '^必应', //匹配消息正则,命令正则
                    /** 执行方法 */
                    fnc: 'Bing'
                }
            ]
        })
    }

    async Bing(e) {
   
        let msg = lodash.trimStart(e.msg, '必应')  
        if(cs ==6){
            cs=0
            e.reply('已重置对话')
    
        }
        
        if(cs == 0){
            xx = ""
           
            
             response = await bingAIClient.sendMessage(msg, {
                onProgress: (token) => {
                    process.stdout.write(token);
                    xx = xx + token
                },
            });
            cs = cs+1
          
            console.log(response.details.text);
            await sleep(1000)
            if(response.details.text == undefined){
                e.reply(xx,true)
                return
            }
            e.reply(response.details.text,true)
            return
        }
      
        
        if(cs !=0 & cs<6){
            response = await bingAIClient.sendMessage(msg, {
                toneStyle: 'balanced', //or creative, precise
                conversationSignature: response.conversationSignature,
                conversationId: response.conversationId,
                clientId: response.clientId,
                invocationId: response.invocationId,
                onProgress: (token) => {
                    process.stdout.write(token);
                    xx = xx + token
                },
            });
            console.log(response.details.text);
            await sleep(1000)
            if(response.details.text == undefined){
                e.reply(xx,true)
                return
            }
            e.reply(response.details.text,true)
            cs = cs+1
        }
        console.log(cs)
       
    
       
    
      }

    async jsdh(e) {
        tempMsg = ""
        msgData = []
        e.reply('已经重置对话了！')

    }

    async duihua(e) {
        let msg = lodash.trimStart(e.msg, `${bot}`)


        jieguo = await AiChatGPT(msg)
        console.log(`ChatGPT结果：${jieguo}`);

        /*         jieguo = await AiBing(msg)
                console.log(`必应结果：${jieguo}`);
        
                if (!isNotNull(jieguo)) {
                    jieguo = await AiChatGPT(msg)
                    console.log(`ChatGPT结果：${jieguo}`);
                } */

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

    let res2 = await res3.json();
    let text = res2.choices[0].text
    if (isNotNull(text)) {
        text = text.replace(/\n/, "").trim()
        text = text.replace(/答：/, "").trim()
        text = text.replace(/Bot:/, "").trim()
        text = text.replace(/robot:/, "").trim()
        text = text.replace(/Robot:/, "").trim()
        text = text.replace(/Computer:/, "").trim()
        text = text.replace(/computer:/, "").trim()
        text = text.replace(/AI:/, "").trim()
    }
    return text

}

//https://chatgpt-api.shn.hk/v1/
async function AiChatGPT(msg) {

    msgData.push({ "role": "user", "content": msg })
    console.log(msgData)
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

    let res = await response4.json()
    res = res.choices[0]
    let text = res.message.content
    if (text.startsWith('\n\n')) {
        text = text.substring(2);
    }
    return text
}

async function AiBing(msg) {
    let text = ""
    if (cs == 6) {
        cs = 0
        return null
    }

    if (cs == 0) {
        response = await bingAIClient.sendMessage(msg, {
            onProgress: (token) => {
                process.stdout.write(token);
                text += token
            },
        });
        cs = cs + 1

        console.log(response.details.text);
        await sleep(1000)
        if (isNotNull(response.details.text)) {
            text = response.details.text
        }
        return text
    }

    if (cs != 0 & cs < 6) {
        response = await bingAIClient.sendMessage(msg, {
            toneStyle: 'balanced', //or creative, precise
            conversationSignature: response.conversationSignature,
            conversationId: response.conversationId,
            clientId: response.clientId,
            invocationId: response.invocationId,
            onProgress: (token) => {
                process.stdout.write(token);
                text += token
            },
        });
        console.log(response.details.text);
        await sleep(1000)
        if (isNotNull(response.details.text)) {
            text = response.details.text
        }
        cs = cs + 1
    }
    console.log(cs)
    return text

}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}