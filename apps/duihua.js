import plugin from '../../../lib/plugins/plugin.js'
import fetch from "node-fetch";
import fs from 'fs'
import Data from '../components/Data.js'
//import BingAIClient from '../model/BingAIClient.js'
//import BingAIClient from '@waylaidwanderer/chatgpt-api'
import crypto from 'crypto';
import _ from 'lodash'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

/**消息缓存 */
var ForChangeMsg = ""
/**必应开关 */
var EnableBing = false;
/** 默认协议头 */
var myHeaders = new Headers();
myHeaders.append("Content-Type", "application/json");
myHeaders.append("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36 Edg/110.0.1587.63");

let zs
/** 你要触发的前缀 */
let NickName = "小七";

let msgData = [];
/** 工作状态 */
let works = 0;
let cs = 0;
let i = 0;
/** 必应参数 */
let BingSettings = {};
/** 仅主人可用 */
let OnlyMaster = false;
BingSettings = await GetSettings();

/** 必应选项 */
const options = {
    host: 'https://www.bing.com',
    userToken: '',
    cookies: '',
    proxy: '',
    debug: false,
};

/** 必应客户端 */
//const bingAIClient = new BingAIClient(options);

/** 提交数据 AiWwang */
const WwangDate = {
    "messages": [],
    "temperature": 0.6,
    "password": "",
    "model": "gpt-3.5-turbo"
};

/** 必应KEY */
let Bearer = ''

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
                    reg: '^#设置必应参数(.*)$',
                    fnc: 'SetBingCK'
                }, {
                    reg: '^#查看必应参数$',
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
        ForChangeMsg = "";
        msgData = [];
        WwangDate.messages = [];
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
        msg = msg.replace(/^[#\s]+/, '');
        console.log("提问：" + msg);

        //存在必应cookie的时候优先必应
        jieguo = (EnableBing && (!OnlyMaster || e.isMaster)) ? await AiBing(msg) : undefined;
        console.log(`Bing结果：${jieguo}`);

        //接口1
        if (!isNotNull(jieguo)) {
            jieguo = await AiForChange(msg);
            console.log(`ForChange结果：${jieguo}`);
        }

        //接口2
        if (!isNotNull(jieguo)) {
            jieguo = await AiWwang(msg);
            console.log(`AiWwang结果：${jieguo}`);
        }

        //接口3
        if (!isNotNull(jieguo)) {
            jieguo = await AiMirror(msg);
            console.log(`AiMirror结果：${jieguo}`);
        }
        if (!isNotNull(jieguo)) {
            this.ResetChat(e);
            works = 0;
            return true;
        }

        e.reply(jieguo, true)
        works = 0;
        return true;
    }

    async SetBingCK(e) {
        if (e.isMaster) {
            let TempSettings = "";
            TempSettings = e.msg.replace(/#设置必应参数/g, "").trim();

            if (!CheckSettings(TempSettings)) {
                e.reply(`必应参数错误，请在浏览器的开发人员工具中搜索"create"！`);
                return false;
            };

            let Settings = await ReadSettings();
            if (!isNotNull(Settings)) {
                e.reply("读取配置错误！");
                return false;
            }

            Settings.BingSettings = TempSettings;
            await WriteSettings(Settings);
            BingSettings = TempSettings;
            console.log("设置必应ck：" + TempSettings);
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
            let wardMsg = await ShowSettings();
            await ForwardMsg(e, wardMsg);
            return true;
        }
    }

    async BingEnable(e) {
        if (e.isMaster == false) {
            return false; //不是主人
        };

        EnableBing = !EnableBing;
        let Settings = await ReadSettings();
        if (!isNotNull(Settings)) {
            e.reply("读取配置错误！");
            return false;
        };

        Settings.EnableBing = EnableBing;
        await WriteSettings(Settings);

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
            let Settings = await ReadSettings()
            if (!isNotNull(Settings)) {
                e.reply("读取配置错误！");
                return false;
            };

            Settings.NnickName = nickname
            await WriteSettings(Settings)
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
    ForChangeMsg += `\nHuman: ${msg}`
    zs = ForChangeMsg.length;
    var ChangeData = {
        prompt: ForChangeMsg,
        tokensLength: zs
    }
    console.log(ChangeData);
    let url = "https://api.forchange.cn/"


    let res3 = await fetch(url, {
        method: "post",

        body: JSON.stringify(ChangeData),
        headers: myHeaders

    })

    if (res3.status != 200) {
        console.log(res3.status);
        console.log(res3.statusText);
        return undefined;
    }

    let res2 = await res3.json();
    let text = res2.choices[0].text;

    if (!isNotNull(text)) {
        ForChangeMsg = "";
        return undefined;
    }

    ForChangeMsg += text;

    if (text.includes('当前访问人数太多')) {
        return undefined;
    }


    const regex = /(?:答[:：]|Bot[:：]|robot[:：]|Computer[:：]|AI[:：])/gi;
    text = text.replace(regex, "").trim();
    return text;
}

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
 * AI对话  https://chatgptmirror.com/chat
 *
 * @param {string} msg 发送消息
 * @return {string} 对话结果
 */
async function AiMirror(msg) {
    let text = '';
    /** 协议头 */
    let AiHeaders = myHeaders;
    AiHeaders.append("Authorization", "Bearer");
    /** 提交数据 */
    let MirrorData = {};
    let base_request = { "platform_type": "Web", "client_version": "2.1", "trace_id": "", "signature": "", "share": "" };
    /** 返回数据 */
    let MirrorRes;
    let conversation_id;

    //初始化
    if (Bearer == '') {
        MirrorData = { "device_id": crypto.randomUUID(), "share": "", "base_request": base_request };
        //获取 Bearer
        MirrorRes = await FetchPost('https://chatgptmirror.com/api/v1/user/DefaultAccount', {
            method: "post",
            body: JSON.stringify(MirrorData),
            headers: AiHeaders
        });
        if (!isNotNull(MirrorRes.data.token)) {
            return undefined
        };
        Bearer = MirrorRes.data.token;

        AiHeaders.set("Authorization", "Bearer " + Bearer);

        //创建会话
        MirrorData = { "name": msg, "base_request": base_request };
        MirrorRes = await FetchPost('https://chatgptmirror.com/api/v1/conversation/CreateConversation', {
            method: "post",
            body: JSON.stringify(MirrorData),
            headers: AiHeaders
        });
        if (!isNotNull(MirrorRes.data.conversation.id)) {
            return undefined;
        };
        conversation_id = MirrorRes.data.conversation.id;

    }

    //发送消息
    AiHeaders.set("Authorization", "Bearer " + Bearer);
    MirrorData = { "conversation_id": conversation_id, "content": msg, "base_request": base_request };
    MirrorRes = await FetchPost('https://chatgptmirror.com/api/v1/conversation/Chat', {
        method: "post",
        body: JSON.stringify(MirrorData),
        headers: AiHeaders
    });
    if (!isNotNull(MirrorRes)) {
        return undefined;
    };

    //取全部消息
    MirrorData = { "conversation_id": conversation_id, "base_request": base_request };
    MirrorRes = await FetchPost('https://chatgptmirror.com/api/v1/conversation/GetConvertionAllChatResult', {
        method: "post",
        body: JSON.stringify(MirrorData),
        headers: AiHeaders
    });
    if (!isNotNull(MirrorRes.data.result_list)) {
        return undefined;
    };
    let length = MirrorRes.data.result_list.length
    let MsgId = MirrorRes.data.result_list[length - 1].id


    //取返回消息
    let state = ''
    MirrorData = { "chat_result_id": MsgId, "base_request": base_request };
    while (state != 'complete') {
        MirrorRes = await FetchPost('https://chatgptmirror.com/api/v1/conversation/RefreshChat', {
            method: "post",
            body: JSON.stringify(MirrorData),
            headers: AiHeaders
        });

        if (!isNotNull(MirrorRes.data.result.state)) {
            return undefined;
        };

        state = MirrorRes.data.result.state

        sleep(500)
    }

    text = MirrorRes.data.result.content
    return text
}

/**
 * 必应AI对话  https://www.bing.com
 *
 * @param {*} msg 发送消息
 * @return {*} 对话结果
 */
async function AiBing(msg) {
    if (!CheckSettings(BingSettings)) {
        return undefined;
    }
    return undefined;

    console.log(BingSettings)

    let { conversationId, clientId, conversationSignature } = BingSettings;

    console.log(conversationId, clientId, conversationSignature)

    const WebSocket = require('ws');
    const ws = new WebSocket('wss://sydney.bing.com/sydney/ChatHub');

    //51D|BingProd|FFB44DEADFD7394D83A588988A85C1382979D7BC11868474AA9523AF6EDEE61E 1055518303310722 SZ5zhwi1vA/OtkRB0Gk6qQCucBKBsVvE+gxKc2OC3bM=
    let obj
    if (i == 0) {

        obj = {
            "arguments": [{
                "source": "cib",
                "optionsSets": ["nlu_direct_response_filter", "deepleo", "disable_emoji_spoken_text", "responsible_ai_policy_235", "enablemm", "harmonyv3", "actions", "h3topp", "dv3sugg"],
                "allowedMessageTypes": ["Chat", "InternalSearchQuery", "InternalSearchResult", "Disengaged", "InternalLoaderMessage", "RenderCardRequest", "AdsQuery", "SemanticSerp", "GenerateContentQuery", "SearchQuery"],
                "sliceIds": ["checkauth", "scfraithtr5", "scraith50", "308actions", "228h3adss0", "h3adss0", "0310wlthrots0", "0228cache", "ssoverlap50", "ssplon", "sssreduce", "sswebtop2", "302blcklists0", "308disbings0", "303h3topp", "224locals0", "224locals0"],
                "traceId": "640dfe2069594422853dabe24b4b6fb9",
                "isStartOfSession": true,
                "message": {
                    "author": "user",
                    "inputMethod": "Keyboard",
                    "text": "Bing AI",
                    "messageType": "SearchQuery"
                },
                "conversationSignature": conversationSignature,
                "participant": {
                    "id": clientId
                },
                "conversationId": conversationId
            }],
            "invocationId": "0",
            "target": "chat",
            "type": 4
        }
        i = i + 1
    } else if (i != 0 & i < 15) {
        obj = {
            arguments: [
                {
                    source: 'cib',
                    optionsSets: [
                        'nlu_direct_response_filter',
                        'deepleo',
                        'disable_emoji_spoken_text',
                        'responsible_ai_policy_235',
                        'enablemm',
                        'harmonyv3',
                        'dtappid',
                        'cricinfo',
                        'cricinfov2',
                        'dv3sugg',
                    ],
                    sliceIds: [
                        '222dtappid',
                        '225cricinfo',
                        '224locals0',
                    ],
                    traceId: "640db0d1e54f4dabb2fe2de74c8eeeaa",
                    isStartOfSession: false,
                    message: {
                        author: 'user',
                        text: xiaoxi,
                        messageType: 'SearchQuery',
                    },
                    conversationSignature: conversationSignature,
                    participant: {
                        id: clientId.toString(),
                    },
                    conversationId: conversationId,
                },
            ],
            invocationId: String(i),
            target: 'chat',
            type: 4,
        };
        i = i + 1

    } else if (i == 15) {
        i = 0
        return undefined
    }


    ws.on('open', () => {
        if (i == 0) {
            ws.send(JSON.stringify({ "protocol": "json", "version": 1 }) + '')
            ws.send(JSON.stringify({ "type": 6 }) + '')
            ws.send(JSON.stringify(obj) + '')
            ws.send(JSON.stringify({ "protocol": "json", "version": 1 }) + '')
            ws.send(JSON.stringify({ "type": 6 }) + '')
            let obj2 = {
                arguments: [
                    {
                        source: 'cib',
                        optionsSets: [
                            'nlu_direct_response_filter',
                            'deepleo',
                            'disable_emoji_spoken_text',
                            'responsible_ai_policy_235',
                            'enablemm',
                            'harmonyv3',
                            'dtappid',
                            'cricinfo',
                            'cricinfov2',
                            'dv3sugg',
                        ],
                        sliceIds: [
                            '222dtappid',
                            '225cricinfo',
                            '224locals0',
                        ],
                        traceId: "640db0d1e54f4dabb2fe2de74c8eeeaa",
                        isStartOfSession: false,
                        message: {
                            author: 'user',
                            text: xiaoxi,
                            messageType: 'SearchQuery',
                        },
                        conversationSignature: conversationSignature,
                        participant: {
                            id: clientId.toString(),
                        },
                        conversationId: conversationId,
                    },
                ],
                invocationId: String(i),
                target: 'chat',
                type: 4,
            };
            ws.send(JSON.stringify(obj2) + '')
        } else {

            ws.send(JSON.stringify({ "protocol": "json", "version": 1 }) + '')
            ws.send(JSON.stringify({ "type": 6 }) + '')
            ws.send(JSON.stringify(obj) + '')
        }




    })

    ws.on('error', err => {
        console.log(err)
    })
    let shuju = []
    ws.on('message', data => {
        console.debug(data);
        const buffer = Buffer.from(data); // 二进制数据
        const str = buffer.toString('utf-8'); // 将Buffer转换为字符串
        shuju.push(str)

    })
    let wenben
    let wb
    ws.on('close', (code, reason) => {

        for (let i = 0; i < shuju.length; i++) {
            shuju[i] = shuju[i].replace(//, "").trim()
            shuju[i] = _.trimStart(shuju[i], '')
        }
        try {
            for (let i = 0; i < shuju.length; i++) {
                console.log(shuju[i])

                try {
                    wb = JSON.parse(shuju[i])
                    wenben = wb.arguments[0].messages[0].text
                    console.log(wenben)
                } catch { }


            }
            return wenben;

        } catch {

        }


        const buffer = Buffer.from(reason); // 二进制数据
        const str = buffer.toString('utf-8'); // 将Buffer转换为字符串
        console.log(str)


        console.log(reason + '==========' + typeof reason)
    })

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
 * 回复当前必应参数
 */
async function ShowSettings() {
    let Settings = await ReadSettings()
    let msg = []
    msg.push(`*** 必应参数 ***`);
    msg.push(Settings.BingSettings);
    return msg
}

/**
 * 读取必应参数
 */
async function GetSettings() {
    let Settings = await ReadSettings();
    let change = false;

    // 使用对象解构赋值来简化属性赋值
    ({ NickName, OnlyMaster, EnableBing, BingSettings } = Settings);

    // 使用默认值来避免undefined检查
    NickName = NickName ?? "小七";
    OnlyMaster = OnlyMaster ?? false;
    EnableBing = EnableBing ?? false;
    BingSettings = BingSettings ?? {};

    // 使用Object.assign来更新设置对象
    change = Object.assign(Settings, { NickName, OnlyMaster, EnableBing, BingSettings }) !== Settings;

    // 如果设置有变化，则写入文件中
    if (change) {
        await WriteSettings(Settings);
    }

    if (typeof BingSettings != 'object') {
        BingSettings = JSON.parse(BingSettings);
    }
    return BingSettings;
}

/**
 * 检查必应参数是否正确
 * @param {string} Settings 必应参数，由https://www.bing.com/turing/conversation/create获取
 * @returns {boolean} 参数正确返回ture 否则返回假
 */
async function CheckSettings(Settings) {
    return isNotNull(Settings) && ["conversationId", "clientId", "conversationSignature"].every(
        prop => isNotNull(Settings[prop])
    );
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
            cookie: BingSettings,
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
    return true;
};

/**
 * 获取API数据
 * @param url API地址
 * @param Options 提交参数
 * @returns API返回数据
 */
async function FetchPost(Url = '', Options = {}) {
    let Response = await fetch(Url, Options);
    //错误处理 网页响应
    if (Response.status != 200) {
        Response.messages = []
        console.log(Response.statusText);
        return undefined
    }

    return await Response.json()
    //return await Response.text()

};