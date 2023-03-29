import plugin from '../../../lib/plugins/plugin.js'
import fetch from "node-fetch";
import fs from 'fs'
import Data from '../components/Data.js'
//import BingAIClient from '../model/BingAIClient.js'
import BingAIClient from '@waylaidwanderer/chatgpt-api'
import crypto from 'crypto';

var tempMsg = ""
var EnableBing = true
/** 默认协议头 */
var myHeaders = new Headers();
myHeaders.append("Content-Type", "application/json");
myHeaders.append("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36 Edg/110.0.1587.63");

let zs
/** 你要触发的前缀 */
let NickName = "小七"
let msgData = []
/** 工作状态 */
let works = 0
let cs = 0
/** 必应Cookie */
let BingCookie = ''
let OnlyMaster = false
BingCookie = await GetSettings();

/** 必应选项 */
const options = {
    host: 'https://www.bing.com',
    userToken: '',
    cookies: BingCookie,
    proxy: '',
    debug: false,
};

/** 必应客户端 */
const bingAIClient = new BingAIClient(options);

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
                    reg: '^[#](结束|取消|关闭|重置)(对话|聊天)$', //匹配消息正则,命令正则
                    /** 执行方法 */
                    fnc: 'ResetChat'
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

    /** 重置对话 */
    async ResetChat(e) {
        tempMsg = "";
        msgData = [];
        cs = 0;
        works = 0;
        e.reply('已经重置对话了！');
        return true;
    }

    async duihua(e) {
        if (works > 1) {
            e.reply('你先别急，我有点忙不过来辣！', true);
            return false;
        };

        works = 1
        let jieguo;
        let msg = e.msg.replace(NickName, '').trim();
        console.log("提问：" + msg);

        //存在必应cookie的时候优先必应
        jieguo = (CheckCookie(BingCookie) && EnableBing && (!OnlyMaster || e.isMaster)) ? await AiBing(msg) : undefined;
        console.log(`Bing结果：${jieguo}`);

        /*        if (!isNotNull(jieguo)) {
                   jieguo = await AiChatGPT(msg);
                   console.log(`ChatGPT结果：${jieguo}`);
               }*/

        if (!isNotNull(jieguo)) {
            jieguo = await AiForChange(msg);
            console.log(`ForChange结果：${jieguo}`);
        }
        
        if (!isNotNull(jieguo)) {
            jieguo = await AiWwang(msg);
            console.log(`AiWwang结果：${jieguo}`);
        }
        
        if (!isNotNull(jieguo)) {
            this.ResetChat(e);
            works = 0;
            return true;
        }

        e.reply(jieguo, true)
        tempMsg = "";
        zs = tempMsg.length;
        works = 0;
        return true;
    }

    async SetBingCK(e) {
        if (e.isMaster) {
            let ck = "";
            ck = e.msg.replace(/#设置必应ck/g, "").trim();

            if (!CheckCookie(ck)) {
                e.reply("必应ck必须包含 KievRPSSecAuth 字段！");
                return false;
            };

            let Settings = await ReadSettings();
            if (!isNotNull(Settings)) {
                e.reply("读取配置错误！");
                return false;
            }

            Settings.BingCookie = ck;
            await WriteSettings(Settings);
            BingCookie = ck;
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
    tempMsg += "\nHuman: " + msg
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

    if (text == null) {
        tempMsg = ""
        return undefined
    }

    tempMsg += text
    const regex = /(?:答[:：]|Bot[:：]|robot[:：]|Robot[:：]|Computer[:：]|computer[:：]|AI[:：])/g;
    text = text.replace(regex, NickName + "：").trim();
    return text
}

/** AiWwang 提交数据 */
var WwangDate = {
    "messages": [],
    "temperature": 0.6,
    "password": "",
    "model": "gpt-3.5-turbo"
};

/**
 * AI对话  https://ai.wwang.eu.org/api
 *
 * @param {*} msg 发送消息
 * @return {*} 对话结果
 */
async function AiWwang(msg) {
    //记录提问数据
    let WwangTempMsg = {
        "role": "user",
        "content": msg,
        "id": Date.now()
    };
    WwangDate.messages.push(WwangTempMsg);

    let url = "https://ai.wwang.eu.org/api"
    let WwangRes = await fetch(url, {
        method: "post",
        body: JSON.stringify(WwangDate),
        headers: myHeaders
    })

    //错误处理 网页响应
    if (WwangRes.status != 200) {
        WwangDate.messages = []
        console.log(WwangRes.status);
        console.log(WwangRes.statusText);
        return undefined
    }

    let text = await res3.text();
    if (!isNotNull(text)) {
        WwangDate.messages = []
        return undefined
    }

    //记录回答数据
    WwangTempMsg = {
        "role": "assistant",
        "content": text,
        "id": Date.now()
    };
    WwangDate.messages.push(WwangTempMsg);

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
    let response
    let text = "";
    if (cs == 15) {
        cs = 0;
        return undefined;
    }

    if (cs == 0) {
        response = await bingAIClient.sendMessage(msg, {
            toneStyle: 'balanced', // or creative, precise, fast
            onProgress: (token) => {
                process.stdout.write(token);
                text += token;
            },
        });
        console.log(JSON.stringify(response, null, 2));
        cs++;

        await sleep(1000);
        if (response.details.text != undefined) {
            text = response.details.text;
        }

        text = text.replace(`必应`, NickName).trim();
        return text;
    }


    if (cs != 0 && cs < 15) {
        response = await bingAIClient.sendMessage(msg, {
            toneStyle: 'balanced', //or creative, precise
            conversationSignature: response.conversationSignature,
            conversationId: response.conversationId,
            clientId: response.clientId,
            invocationId: response.invocationId,
            onProgress: (token) => {
                process.stdout.write(token);
                text += token;
            },
        });
        //console.log(`${cs}回复：` + response.details.text);
        await sleep(1000)
        if (response.details.text != undefined) {
            text = response.details.text;
        }

        cs++
        text = text.replace(`必应|Bing`, NickName).trim();
        return text;
    }
    //console.log(cs)
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
    let temp = {};
    const ConfigPath = "./plugins/zhishui-plugin/config/config/";
    const DefaultPath = "./plugins/zhishui-plugin/config/default_config/";

    if (fs.existsSync(ConfigPath)) {
        temp = Data.readJSON("duihua.json", ConfigPath);
    } else {
        temp = Data.readJSON("duihua.json", DefaultPath);
        await WriteSettings(temp);
    }

    return temp;
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
    let change = false;

    // 使用对象解构赋值来简化属性赋值
    ({ NickName, OnlyMaster, BingCookie } = Settings);

    // 使用默认值来避免undefined检查
    NickName = NickName ?? "小七";
    OnlyMaster = OnlyMaster ?? false;
    BingCookie = BingCookie ?? "";

    // 使用Object.assign来更新设置对象
    change = Object.assign(Settings, { NickName, OnlyMaster, BingCookie }) !== Settings;

    // 如果设置有变化，则写入文件中
    if (change) {
        await WriteSettings(Settings);
    }

    return BingCookie;
}

/**
 * 检查必应cookie是否正确
 * @param {string} Cookie 必应Cookie，必须包含KievRPSSecAuth字段
 * @returns {boolean} 返回逻辑结果
 */
async function CheckCookie(Cookie) {
    var regex = /(_U|KievRPSSecAuth)=/;
    return regex.test(Cookie);
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

async function createNewConversation() {
    const fetchOptions = {
        headers: {
            accept: 'application/json',
            'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
            'content-type': 'application/json',
            'accept-encoding': 'gzip, deflate, br',
            'sec-ch-ua': '"Microsoft Edge";v="111", "Not(A:Brand";v="8", "Chromium";v="111"',
            'sec-ch-ua-arch': '"x86"',
            'sec-ch-ua-bitness': '"64"',
            'sec-ch-ua-full-version': '"111.0.1661.41"',
            'sec-ch-ua-full-version-list': '"Microsoft Edge";v="111.0.1661.41", "Not(A:Brand";v="8.0.0.0", "Chromium";v="111.0.5563.64"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-model': '',
            'sec-ch-ua-platform': '"Windows"',
            'sec-ch-ua-platform-version': '"10.0.0"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36 Edg/111.0.1661.41',
            'x-ms-client-request-id': crypto.randomUUID(),
            'x-ms-useragent': 'azsdk-js-api-client-factory/1.0.0-beta.1 core-rest-pipeline/1.10.0 OS/Win32',
            cookie: BingCookie,
            Referer: 'https://www.bing.com/search?q=Bing+AI&showconv=1&FORM=hpcodx',
        },
    };

    const response = await fetch(`https://www.bing.com/turing/conversation/create`, fetchOptions);

    return response.json();
}

/**
 * 判断对象是否不为undefined且不为null、NaN
 * @param obj 对象
 * @returns obj==null/undefined,return false,other return true
 */
export function isNotNull(obj) {
    if (obj == undefined || obj == null || obj != obj) { return false }
    return true
}