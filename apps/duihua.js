import plugin from '../../../lib/plugins/plugin.js'
import fetch from "node-fetch";
import { common } from '../model/index.js'
import fs from 'fs'
import { Config } from '../components/index.js'
import request from '../lib/request/request.js'
import Data from '../components/Data.js'
//import BingAIClient from '../model/BingAIClient.js'
//import BingAIClient from '@waylaidwanderer/chatgpt-api'
import crypto from 'crypto';
import _ from 'lodash'

let segment = ""
try {
    segment = (await import("oicq")).segment
} catch (err) {
    segment = (await import("icqq")).segment
}


/** 聊天昵称 */ let NickName = await Config.Chat.NickName;
/** 发音人列表 */ const VoiceList = await ReadVoiceList()
/**消息缓存 Chang */ var ForChangeMsg = ""

let zs
/** 工作状态 */ let works = 0;

//https://chatgptmirror.com/chat
/** 会话ID */ let conversation_id = '';
/** 必应KEY */ let Bearer = ''

/** 必应客户端 */
//const bingAIClient = new BingAIClient(options);

/** 提交数据 AiWwang */
const WwangDate = {
    "messages": [],
    "temperature": 0.6,
    "password": "",
    "model": "gpt-3.5-turbo"
};

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
                    reg: '^#?(止水对话)?(取消|结束|重置|关闭)(对话|聊天)$', //匹配消息正则,命令正则
                    /** 执行方法 */
                    fnc: 'ResetChat'
                }, {
                    reg: '^#?(止水对话)?设置必应参数(.*)$',
                    fnc: 'SetBingSettings'
                }, {
                    reg: '^#?(止水对话)?查看必应参数$',
                    fnc: 'GetBingSettings'
                }, {
                    reg: '^#?(止水对话)?必应开关$',
                    fnc: 'BingEnable'
                }, {
                    reg: '^#?(止水对话)?修改昵称(.*)$',
                    fnc: 'ModifyNickname'
                }, {
                    reg: '^#?(止水对话)?语音(开启|关闭)$',
                    fnc: 'SetVoiceEnable'
                }, {
                    reg: '^#?(止水对话)?设置发音人(.*)$',
                    fnc: 'SetVoiceId'
                }, {
                    reg: '^#?(止水对话)?查看发音人$',
                    fnc: 'ShowVoiceId'
                }
            ]
        })
    }

    /** 重置对话 */
    async ResetChat(e) {
        ForChangeMsg = "";
        WwangDate.messages = [];
        Bearer == ''
        conversation_id = ''
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
        let msg = e.msg.replace(await Config.Chat.NickName, '').trim();
        msg = msg.replace(/^[#\s]+/, '');
        console.log("提问：" + msg);

        //存在必应cookie的时候优先必应
        //jieguo = (await Config.Chat.EnableBing && (!await Config.Chat.OnlyMaster || e.isMaster)) ? await AiBing(msg) : undefined;
        //console.log(`Bing结果：${jieguo}`);

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

        //接口2
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

        //语音合成
        if (await Config.Chat.EnableVoice) {
            let voiceId = VoiceList[await Config.Chat.VoiceIndex].voiceId
            let url = `https://dds.dui.ai/runtime/v1/synthesize?voiceId=${voiceId}&text=${jieguo}&speed=0.8&volume=150&audioType=wav`
            e.reply([segment.record(url)])
        }


        works = 0;
        return true;
    }

    /** 设置必应参数 */
    async SetBingSettings(e) {
        if (e.isMaster) {
            let jsonString = e.msg.replace(/(#?止水对话)?设置必应参数/g, "").trim();
            let jsonObject;

            try {
                jsonObject = JSON.parse(jsonString);
                // 检查对象是否有"conversationId", "clientId", "conversationSignature"属性
                if (jsonObject.hasOwnProperty("conversationId") && jsonObject.hasOwnProperty("clientId") && jsonObject.hasOwnProperty("conversationSignature")) {

                    Config.modify('duihua', 'BingSettings.conversationId', jsonObject.conversationId)
                    Config.modify('duihua', 'BingSettings.clientId', jsonObject.clientId)
                    Config.modify('duihua', 'BingSettings.conversationSignature', jsonObject.conversationSignature)

                    console.log("设置必应ck：" + jsonString);
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
            let msg = `*** 必应参数 ***/n/n`;
            msg += `conversationId:${await Config.Chat.BingSettings.conversationId}/n`;
            msg += `conversationId:${await Config.Chat.BingSettings.conversationId}/n`;
            msg += `conversationId:${await Config.Chat.BingSettings.conversationId}/n`;
            e.reply(msg);
            return true;
        }
    }

    /** 必应开关 */
    async BingEnable(e) {
        if (e.isMaster == false) {
            return false; //不是主人
        };

        let EnableBing = !await Config.Chat.EnableBing;
        Config.modify('duihua', 'EnableBing', EnableBing);

        if (EnableBing) {
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

        let nickname = e.msg.replace(`#?(止水对话)?修改对话昵称`, '').trim();
        if (nickname.length > 0 && nickname != await Config.Chat.NickName) {
            NickName = nickname
            Config.modify('duihua', 'NickName', nickname);
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

        let Enable = e.msg.search('开启') != -1;

        Config.modify('duihua', 'EnableVoice', Enable);

        if(Enable){
            e.reply("[对话语音]已开启！");
        }else{
            e.reply("[对话语音]已关闭！");
        }
        
        return true;
    }

    /** 设置对话发音人 */
    async SetVoiceId(e) {
        let VoiceIndex = parseInt(e.msg.replace(/\D+/, '').trim());
        console.log(VoiceIndex)
        if (VoiceIndex < VoiceList.length && VoiceIndex > 0) {
            Config.modify('duihua', 'VoiceIndex', VoiceIndex - 1);
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
        let nowindex = await Config.Chat.VoiceIndex
        msg.push(`当前发音人：${(nowindex + 1)} 、${VoiceList[nowindex].name}`);
        msg.push(`#止水对话设置发音人${(nowindex + 1)}`);
        let list = `*** 发音人列表 ***\n`;
        for (let i = 0; i < VoiceList.length; i++) {
            let obj = VoiceList[i];
            let name = obj.name;
            let type = obj.type;
            let sexy = obj.sexy;
            if (nowindex == i) {
                list += `>>>${(i + 1)} 、${name}，分类：${type}，性别：${sexy}<<<\n`
            } else {
                list += `${(i + 1)} 、${name}，分类：${type}，性别：${sexy}\n`
            }

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
    /** 协议头 */
    let AiHeaders = { Authorization: "Bearer" }
    /** 提交数据 */
    let MirrorData = {};
    let base_request = { "platform_type": "Web", "client_version": "2.1", "trace_id": "", "signature": "", "share": "" };
    /** 返回数据 */
    let MirrorRes = {};

    //初始化
    if (Bearer == '') {
        conversation_id = ''
        MirrorData = { "device_id": crypto.randomUUID(), "share": "", "base_request": base_request };
        //获取 Bearer
        MirrorRes = await FetchPost('https://chatgptmirror.com/api/v1/user/DefaultAccount', MirrorData, AiHeaders);
        if (!isNotNull(MirrorRes.data.token)) {
            return undefined
        };
        Bearer = MirrorRes.data.token;
        console.log('Bearer：' + Bearer);
    }

    AiHeaders.Authorization = "Bearer " + Bearer;

    if (conversation_id == '' || conversation_id == undefined) {
        //创建会话
        MirrorData = { "name": msg, "base_request": base_request };
        MirrorRes = await FetchPost('https://chatgptmirror.com/api/v1/conversation/CreateConversation', MirrorData, AiHeaders);
        if (!isNotNull(MirrorRes.data.conversation.id)) {
            return undefined;
        };
        conversation_id = MirrorRes.data.conversation?.id;
        console.log('conversation_id：' + conversation_id);
    }

    //发送消息
    MirrorData = { "conversation_id": conversation_id, "content": msg, "base_request": base_request };
    MirrorRes = await FetchPost('https://chatgptmirror.com/api/v1/conversation/Chat', MirrorData, AiHeaders);
    if (!isNotNull(MirrorRes)) {
        return undefined;
    };

    //取全部消息
    MirrorData = { "conversation_id": conversation_id, "base_request": base_request };
    MirrorRes = await FetchPost('https://chatgptmirror.com/api/v1/conversation/GetConvertionAllChatResult', MirrorData, AiHeaders);
    if (!isNotNull(MirrorRes.data.result_list)) {
        return undefined;
    };
    let length = MirrorRes.data.result_list.length
    let MsgId = MirrorRes.data.result_list[length - 1].id
    console.log('MsgId：' + MsgId);

    //取返回消息
    let state = ''
    MirrorData = { "chat_result_id": MsgId, "base_request": base_request };
    while (state != 'complete') {
        MirrorRes = await FetchPost('https://chatgptmirror.com/api/v1/conversation/RefreshChat', MirrorData, AiHeaders);

        if (!isNotNull(MirrorRes.data.result.state)) {
            return undefined;
        };

        state = MirrorRes.data.result.state

        await common.sleep(500)
    }
    console.log('return：' + MirrorRes);
    return await MirrorRes.data.result.content ?? undefined
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
 * 获取API POST数据
 * @param url API地址
 * @param {Object} data 提交的json参数
 * @param {Object} headers 附加协议头
 * @returns API返回数据
 */
async function FetchPost(Url = '', data = {}, headers = {}) {
    /** 请求参数 */
    let Options = {
        data,
        headers: headers,
        statusCode: 'json'
    }
    //console.log('请求：' + Url, '参数' + JSON.stringify(data))
    let Response = await request.post(Url, Options)
    //console.log('返回：' + JSON.stringify(Response));
    return await Response;
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