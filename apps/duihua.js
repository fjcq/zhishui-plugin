import plugin from '../../../lib/plugins/plugin.js'
import fetch from "node-fetch";
import fs from 'fs'
import Data from '../components/Data.js'
//import BingAIClient from '../model/BingAIClient.js'
//import BingAIClient from '@waylaidwanderer/chatgpt-api'
import crypto from 'crypto';
import _ from 'lodash'
import { createRequire } from 'module'
let segment = ""
try {
    segment = (await import("oicq")).segment
} catch (err) {
    segment = (await import("icqq")).segment
}

const require = createRequire(import.meta.url)

/** 聊天参数 */ let ChatSettings = await GetSettings();
/** 发音人列表 */ const VoiceList = await ReadVoiceList()
/**消息缓存 Chang */ var ForChangeMsg = ""
/** 默认协议头 */ var myHeaders = new Headers();
myHeaders.append("Content-Type", "application/json");
myHeaders.append("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36 Edg/110.0.1587.63");

let zs
let msgData = [];
/** 工作状态 */ let works = 0;
let cs = 0;
let i = 0;
let conversation_id;

/** 必应客户端 */
//const bingAIClient = new BingAIClient(options);

/** 提交数据 AiWwang */
const WwangDate = {
    "messages": [],
    "temperature": 0.6,
    "password": "",
    "model": "gpt-3.5-turbo"
};

/** 必应KEY */ let Bearer = ''

export class duihua extends plugin {
    constructor() {
        super({
            name: '[止水插件]对话',
            dsc: '智能对话',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: ChatSettings.NickName,
                    fnc: 'duihua'
                }, {
                    reg: '^[#]止水对话(结束|取消|关闭|重置)(对话|聊天)$', //匹配消息正则,命令正则
                    /** 执行方法 */
                    fnc: 'ResetChat'
                }, {
                    reg: '^#止水对话设置必应参数(.*)$',
                    fnc: 'SetBingSettings'
                }, {
                    reg: '^#止水对话查看必应参数$',
                    fnc: 'GetBingSettings'
                }, {
                    reg: '^#止水对话必应开关$',
                    fnc: 'BingEnable'
                }, {
                    reg: '^#止水对话修改昵称(.*)$',
                    fnc: 'ModifyNickname'
                }, {
                    reg: '^#止水对话语音(开启|关闭)$',
                    fnc: 'SetVoiceEnable'
                }, {
                    reg: '^#止水对话设置发音人(.*)$',
                    fnc: 'SetVoiceId'
                }, {
                    reg: '^#止水对话查看发音人$',
                    fnc: 'ShowVoiceId'
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

    /** 对话 */
    async duihua(e) {
        if (works > 1) {
            e.reply('你先别急，我有点忙不过来辣！', true);
            return false;
        };

        works = 1
        let jieguo;
        let msg = e.msg.replace(ChatSettings.NickName, '').trim();
        msg = msg.replace(/^[#\s]+/, '');
        console.log("提问：" + msg);

        //存在必应cookie的时候优先必应
        jieguo = (ChatSettings.EnableBing && (!ChatSettings.OnlyMaster || e.isMaster)) ? await AiBing(msg) : undefined;
        console.log(`Bing结果：${jieguo}`);


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

        //接口1
        if (!isNotNull(jieguo)) {
            jieguo = await AiForChange(msg);
            console.log(`ForChange结果：${jieguo}`);
        }

        if (!isNotNull(jieguo)) {
            this.ResetChat(e);
            works = 0;
            return true;
        }

        e.reply(jieguo, true)

        //语音合成
        if (ChatSettings.VoiceEnable) {
            let voiceId = VoiceList[ChatSettings.VoiceIndex - 1].voiceId
            let url = `https://dds.dui.ai/runtime/v1/synthesize?voiceId=${voiceId}&text=${jieguo}&speed=0.8&volume=150&audioType=wav`
            e.reply([segment.record(url)])

        }


        works = 0;
        return true;
    }

    /** 设置必应参数 */
    async SetBingSettings(e) {
        if (e.isMaster) {
            let jsonString = e.msg.replace(/#设置必应参数/g, "").trim();
            let jsonObject;

            try {
                jsonObject = JSON.parse(jsonString);
                // 检查对象是否有"conversationId", "clientId", "conversationSignature"属性
                if (jsonObject.hasOwnProperty("conversationId") && jsonObject.hasOwnProperty("clientId") && jsonObject.hasOwnProperty("conversationSignature")) {

                    ChatSettings.BingSettings = jsonObject
                    await WriteSettings(ChatSettings);

                    console.log("设置必应ck：" + jsonObject);
                    e.reply("设置必应ck成功！");
                    return true;

                } else {
                    e.reply(`必应参数不完整！`);
                    return false;
                }
            } catch (error) {
                e.reply(`必应参数错误，请在浏览器的开发人员工具中搜索"create"！`);
                return false;
            }

        }

    }

    /** 查看必应参数 */
    async GetBingSettings(e) {
        if (e.isMaster == false) {
            return; //不是主人
        };

        //私聊才能查看
        if (!e.isGroup) {
            let msg = []
            msg.push(`*** 必应参数 ***`);
            msg.push(JSON.stringify(ChatSettings.BingSettings));
            await ForwardMsg(e, msg);
            return true;
        }
    }

    /** 必应开关 */
    async BingEnable(e) {
        if (e.isMaster == false) {
            return false; //不是主人
        };

        ChatSettings.EnableBing = !ChatSettings.EnableBing;
        await WriteSettings(ChatSettings);

        if (ChatSettings.EnableBing) {
            e.reply("[必应对话]已开启！");
        } else {
            e.reply("[必应对话]已关闭！");
        }
        return true;
    }

    /** 修改对话昵称 */
    async ModifyNickname(e) {
        if (e.isMaster == false) {
            return false; //不是主人
        };

        let nickname = e.msg.replace(`#修改对话昵称`, '').trim();
        if (nickname.length > 0 && nickname != ChatSettings.NickName) {
            ChatSettings.NickName = nickname
            await WriteSettings(ChatSettings)
            e.reply("对话昵称修改为:" + nickname);
            return true;
        }
        return false;
    }

    /** 对话语音开关 */
    async SetVoiceEnable(e) {
        if (e.isMaster == false) {
            return false; //不是主人
        };
        let VoiceEnable = e.msg.replace('#对话语音', '').trim();
        if (VoiceEnable == '开启') {
            ChatSettings.VoiceEnable = true;
            e.reply("[对话语音]已开启！");
        } else if (VoiceEnable == '关闭') {
            ChatSettings.VoiceEnable = false;
            e.reply("[对话语音]已关闭！");
        } else {
            ChatSettings.VoiceEnable = !ChatSettings.VoiceEnable;
            e.reply("[对话语音]已" + ChatSettings.VoiceEnable ? "开启" : "关闭" + "！");
        }

        await WriteSettings(ChatSettings);
        return true;
    }

    /** 设置对话发音人 */
    async SetVoiceId(e) {
        let VoiceIndex = parseInt(e.msg.replace('#设置对话发音人', '').trim());
        console.log(VoiceIndex)
        if (VoiceIndex < VoiceList.length && VoiceIndex > 0) {
            ChatSettings.VoiceIndex = VoiceIndex - 1;
            await WriteSettings(ChatSettings);

            let name = VoiceList[VoiceIndex - 1].name
            e.reply("[对话发音人]:" + name);

        } else {
            e.reply("[对话发音人]错误！");
        }

        return true;
    }

    /** 查看对话发音人 */
    async ShowVoiceId(e) {
        let msg = []

        msg.push(`当前发音人：${(ChatSettings.VoiceIndex)} 、${VoiceList[ChatSettings.VoiceIndex - 1].name}`);

        let list = `*** 发音人列表 ***\n`;
        for (let i = 0; i < VoiceList.length; i++) {
            let obj = VoiceList[i];
            let name = obj.name;
            let type = obj.type;
            let sexy = obj.sexy;
            list += `${(i + 1)} 、${name}，分类：${type}，性别：${sexy}\n`
        }
        msg.push(list);
        await ForwardMsg(e, msg);
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
    }

    AiHeaders.set("Authorization", "Bearer " + Bearer);

    if (conversation_id === '' || conversation_id === undefined) {
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
    if (!CheckSettings(ChatSettings)) {
        return undefined;
    }
    return undefined; //禁用必应

    console.log(ChatSettings)

    let { conversationId, clientId, conversationSignature } = ChatSettings;

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

    if (fs.existsSync(ConfigPath + "duihua.json")) {
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
 * 读取对话参数
 */
async function GetSettings() {
    let Settings = await ReadSettings();
    let change = false;

    if (!isNotNull(Settings.NickName)) {
        Settings.NickName = "小七"
        change = true;
    };
    if (!isNotNull(Settings.OnlyMaster)) {
        Settings.OnlyMaster = false
        change = true;
    };
    if (!isNotNull(Settings.EnableBing)) {
        Settings.EnableBing = false
        change = true;
    };
    if (!isNotNull(Settings.EnableVoice)) {
        Settings.EnableVoice = false
        change = true;
    };
    if (!isNotNull(Settings.VoiceIndex)) {
        Settings.VoiceIndex = 23
        change = true;
    };
    if (!isNotNull(Settings.BingSettings)) {
        Settings.BingSettings = {}
        change = true;
    };

    let type = typeof Settings.BingSettings
    if (type != 'object') {
        Settings.BingSettings = {};
        change = true;
    }

    // 如果设置有变化，则写入文件中
    if (change) {
        await WriteSettings(Settings);
    };

    return Settings;
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

/**
 * 读发音人数据
 */
async function ReadVoiceList() {
    let temp = {};
    const DataPath = "./plugins/zhishui-plugin/resources/data/";

    if (fs.existsSync(DataPath + "VoiceList.json")) {
        temp = Data.readJSON("VoiceList.json", DataPath);
    }

    return temp;
}