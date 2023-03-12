import plugin from '../../../lib/plugins/plugin.js'
import fetch from "node-fetch";
import fs from 'fs'
import { isNotNull } from './yanzou.js';
import Data from '../components/Data.js'
import BingAIClient from '../model/BingAIClient.js'
// pnpm add @waylaidwanderer/chatgpt-api -w
var tempMsg = ""
var EnableBing = false
var myHeaders = new Headers();
myHeaders.append("Content-Type", "application/json");
myHeaders.append("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36 Edg/110.0.1587.63");

let jieguo
let zs
let NickName = "小七" //你要触发的前缀
let msgData = []

let cs = 0
let response
let BingCookie
let OnlyMaster
await GetSettings()

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
                    reg: NickName,
                    fnc: 'duihua'
                }, {
                    reg: '^[#](结束|取消|关闭)(对话|聊天)$', //匹配消息正则,命令正则
                    /** 执行方法 */
                    fnc: 'jsdh'
                }, {
                    reg: '^#设置必应ck(.*)$',
                    fnc: 'SetBingCK'
                }, {
                    reg: '^#查看必应ck$',
                    fnc: 'GetBingCK'
                }, {
                    reg: '^#必应开关$',
                    fnc: 'BingEnable'
                }, {
                    reg: '^#修改对话昵称(.*)$',
                    fnc: 'ModifyNickname'
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
        let msg = e.msg.replace(NickName, '').trim();
        console.log("msg:" + msg);

        //存在必应cookie的时候优先必应
        jieguo = (await CheckCookie(BingCookie) && EnableBing && (!OnlyMaster || e.isMaster)) ? await AiBing(msg) : undefined;
        console.log(`Bing结果：${jieguo}`);

        /*        if (!isNotNull(jieguo)) {
                   jieguo = await AiChatGPT(msg);
                   console.log(`ChatGPT结果：${jieguo}`);
               }*/

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

    async SetBingCK(e) {
        if (e.isMaster) {
            let ck = ""
            ck = e.msg.replace(/#设置必应ck/g, "").trim();

            if (!CheckCookie(ck)) {
                e.reply("必应ck必须包含 _U 字段！");
                return;
            };

            let Settings = await ReadSettings();
            if (!isNotNull(Settings)) {
                e.reply("读取配置错误！");
                return;
            }

            Settings.BingCookie = ck
            await WriteSettings(Settings)
            BingCookie = ck
            console.log("设置必应ck：" + ck);
            e.reply("设置必应ck成功！");

            return true;
        }

    }

    async GetBingCK(e) {
        if (e.isMaster == false) {
            return; //不是主人
        };

        //私聊才能查看
        if (!e.isGroup) {
            let wardMsg = await ShowCookie();
            await ForwardMsg(e, wardMsg)
            return true;
        }
    }

    async BingEnable(e) {
        if (e.isMaster == false) {
            return false; //不是主人
        };

        EnableBing = !EnableBing
        if (EnableBing) {
            e.reply("[必应对话]已开启！");
        } else {
            e.reply("[必应对话]已关闭！");
        }
        return true;
    }

    async ModifyNickname(e) {
        if (e.isMaster == false) {
            return false; //不是主人
        };

        let nickname = e.msg.replace(`#修改对话昵称`, '').trim();
        if (nickname.length > 0) {
            let settings = await ReadSettings()
            settings.NnickName = nickname
            await WriteSettings(settings)
            NickName = nickname
        }
        e.reply("[对话昵称]：" + NickName);
        return true;
    }
}

/**
 * AI对话  https://api.forchange.cn/
 *
 * @param {*} msg 发送消息
 * @return {*} 对话结果
 */
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
        headers: myHeaders

    })

    if (res3.status != 200) {
        console.log(res3.status);
        console.log(res3.statusText);
        return undefined
    }

    let res2 = await res3.json();
    let text = res2.choices[0].text
    const regex = /(?:\n|答[:：]|Bot[:：]|robot[:：]|Robot[:：]|Computer[:：]|computer[:：]|AI[:：])/g;
    text = text.replace(regex, NickName + "：").trim();
    return text
}

/**
 * AI对话  https://chatgpt-api.shn.hk/v1/
 *
 * @param {*} msg 发送消息
 * @return {*} 对话结果
 */
async function AiChatGPT(msg) {

    msgData.push({ "role": "user", "content": msg })
    //console.log(msgData)
    let response4 = await fetch('https://chatgpt-api.shn.hk/v1/', {
        method: 'POST',
        headers: myHeaders,
        body: JSON.stringify(
            {
                "model": "gpt-3.5-turbo",
                "messages": msgData
            }
        )
    });

    if (response4.status != 200) {
        console.log(response4.status);
        console.log(response4.statusText);
        return undefined
    }

    let res = await response4.json();
    if (!res) {
        return undefined;
    }
    if (res.error) {
        console.log(res.error.message);
        return undefined;
    }

    let text = res.choices[0].message.content;
    return text.startsWith('\n\n') ? text.substring(2) : text;
}

/**
 * 必应AI对话  https://www.bing.com
 *
 * @param {*} msg 发送消息
 * @return {*} 对话结果
 */
async function AiBing(msg) {

    if (cs == 6) {
        cs = 0
        return undefined;
    }

    const bingAIClient = new BingAIClient({
        // Necessary for some people in different countries, e.g. China (https://cn.bing.com)
        host: 'https://www.bing.com',
        // "_U" cookie from bing.com
        userToken: ``,
        // If the above doesn't work, provide all your cookies as a string instead
        cookies: BingCookie,
        // A proxy string like "http://<ip>:<port>"
        proxy: '',
        // (Optional) Set to true to enable `console.debug()` logging
        debug: false,
    });

    if (cs == 0) {
        xx = ""
        response = await bingAIClient.sendMessage(msg, {
            onProgress: (token) => {
                process.stdout.write(token);
                xx += token;
            },
        });
        cs++;
        console.log(response.details.text);
        await sleep(1000);
        if (response.details.text != undefined) {
            xx = response.details.text;
        }

        xx = xx.replace(`必应`, NickName).trim();
        return xx;
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
                xx += token;
            },
        });
        console.log(response.details.text);
        await sleep(1000)
        if (response.details.text != undefined) {
            xx = response.details.text;
        }

        cs++
        xx = xx.replace(`必应`, NickName).trim();
        return xx;
    }
    console.log(cs)
    return undefined;
}

/**
* 延时
*/
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}
/**
* 读取对话配置文件
*/
async function ReadSettings() {
    let temp
    if (fs.existsSync("./plugins/zhishui-plugin/config/config/duihua.json")) {
        temp = Data.readJSON("duihua.json", "./plugins/zhishui-plugin/config/config");
    } else {
        temp = Data.readJSON("duihua.json", "./plugins/zhishui-plugin/config/default_config");
        Write_Interface(temp);
    }
    return temp
}

/**
* 写出对话配置文件
*/
async function WriteSettings(data) {
    return Data.writeJSON("duihua.json", data, '\t', "./plugins/zhishui-plugin/config/config")
}

/**
 * 回复当前必应Cookie
 */
async function ShowCookie() {
    let Settings = await ReadSettings()
    let msg = []
    msg.push(`*** 必应CK ***`);
    msg.push(Settings.BingCookie);
    return msg
}

/**
 * 读取对话配置
 */
async function GetSettings() {
    let Settings = await ReadSettings();
    let change = false

    if (Settings.NickName == undefined) {
        Settings.NickName = "小七"
        change = true
    }
    if (Settings.OnlyMaster == undefined) {
        Settings.OnlyMaster = false
        change = true
    }
    if (Settings.BingCookie == undefined) {
        Settings.BingCookie = ""
        change = true
    }
    if (change) {
        await WriteSettings(Settings)
    }

    BingCookie = Settings.BingCookie
    OnlyMaster = Settings.OnlyMaster
    NickName = Settings.NickName
    return Settings.BingCookie
}

/**
 * 检查必应cookie是否正确
 */
async function CheckCookie(Cookie) {
    let n = Cookie.indexOf("_U")
    if (n == -1) {
        return false
    } else {
        return true
    }
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