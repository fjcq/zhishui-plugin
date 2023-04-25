import plugin from '../../../lib/plugins/plugin.js'
import { common } from '../model/index.js'
import fs from 'fs'
import { Plugin_Path, Config } from '../components/index.js'
import request from '../lib/request/request.js'
import Data from '../components/Data.js'
import BingAIClient from '../model/BingAIClient.js'
//import BingAIClient from '@waylaidwanderer/chatgpt-api'
import crypto from 'crypto';
import { KeyvFile } from 'keyv-file';

/** 缓存目录 */
const CachePath = `${Plugin_Path}/resources/Cache/Chat`
let segment = ""
try {
    segment = (await import("oicq")).segment
} catch (err) {
    segment = (await import("icqq")).segment
}


/** 聊天昵称 */ let NickName = await Config.Chat.NickName;
/** 发音人列表 */ const VoiceList = await ReadVoiceList()
/** Chang消息缓存 */ var ForChangeMsg = ""

// 必应相关变量
let jailbreakConversationId = ''
let messageId = ''

/** 工作状态 */ let works = 0;
let ChatosID = ''
let zs = 0
//https://chatgptmirror.com/chat

/** 提交数据 AiWwang */
const WwangDate = {
    "messages": [],
    "temperature": 0.6,
    "password": "",
    "model": "gpt-3.5-turbo"
};

/** 缓存选项 */
const keyv = new KeyvFile({ filename: `${CachePath}/cache.json` })
const cacheOptions = {
    store: keyv,
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
                    reg: '^#?(止水对话)?(取消|结束|重置|关闭)(对话|聊天)$', //匹配消息正则,命令正则
                    /** 执行方法 */
                    fnc: 'ResetChat'
                }, {
                    reg: '^(.*)KievRPSSecAuth=(.*)$',
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
                }, {
                    reg: '^#?(止水对话)?设置对话身份(.*)$',
                    fnc: 'SetContext'
                }, {
                    reg: '^#?(止水对话)?查看对话身份$',
                    fnc: 'ShowContext'
                }, {
                    reg: NickName,
                    fnc: 'duihua'
                }
            ]
        })
    }

    /** 重置对话 */
    async ResetChat(e) {
        ForChangeMsg = "";
        WwangDate.messages = [];
        Config.modify('duihua', 'MirrorBearer', "");
        Config.modify('duihua', 'MirrorConversationId', "");
        works = 0;

        //重置必应
        messageId = ''
        jailbreakConversationId = ''
        keyv.clear()

        e.reply('已经重置对话了！');
        return true;
    };

    /** 对话 */
    async duihua(e) {
        if (works > 1) {
            e.reply('你先别急，我有点忙不过来辣！', true);
            return false;
        };

        works = 1
        let jieguo;
        let name = await Config.Chat.NickName
        let msg = e.msg.replace(name, '').trim();
        msg = msg.replace(/^[#\s]+/, '');
        console.log("提问：" + msg);

        //启用必应时，优先必应
        if (!isNotNull(jieguo)) {
            jieguo = (await Config.Chat.EnableBing && (!await Config.Chat.OnlyMaster || e.isMaster)) ? await AiBing(msg) : undefined;
            console.log(`Bing结果：${jieguo}`);
            //jieguo = jieguo?.replace(/(Bing|微软必应|必应|Sydney)/g, name).trim();
            jieguo = jieguo?.replace(/(Sydney)/g, name).trim();
            jieguo = jieguo?.replace(/\[\^\d*\^\]/g, '');

        }

        //接口4
        if (!isNotNull(jieguo)) {
            jieguo = await Aichatos(msg);
            console.log(`AiMirror结果：${jieguo}`);
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
            let BingCookie = e.msg;
            let { KievRPSSecAuth, _U } = await AnalysisBingCookie(BingCookie);
            if (await InspectBingCookie(KievRPSSecAuth, _U) == false) {
                e.reply(`必应参数错误，请在浏览器中提取必应的Cookie中的 “KievRPSSecAuth” 字段和 “_U” 字段，发送给我`);
                return false;
            };
            BingCookie = `KievRPSSecAuth=${KievRPSSecAuth}; _U=${_U}`
            Config.modify('duihua', 'BingCookie', BingCookie)
            e.reply("设置必应参数成功！");
            return true;
        }

    }

    /** 查看必应参数 */
    async GetBingSettings(e) {
        if (e.isMaster == false) {
            return; //不是主人
        };

        //私聊才能查看
        if (!e.isGroup) {
            let msg = `*** 必应参数 ***\n\n${await Config.Chat.BingCookie}`;
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
        if (EnableBing) {
            let { KievRPSSecAuth, _U } = await AnalysisBingCookie(await Config.Chat.BingCookie);
            if (await InspectBingCookie(KievRPSSecAuth, _U) == false) {
                e.reply(`你的必应参数无效！\n请在浏览器中打开必应对话，然后将Cookie发送给我，Cookie中必须包含 “KievRPSSecAuth” 和 “_U” 字段`);
                return false;
            } else {
                e.reply("[必应对话]已开启！");
            };
        } else {
            e.reply("[必应对话]已关闭！");
        }

        Config.modify('duihua', 'EnableBing', EnableBing);
        return true;
    }

    /** 修改对话昵称 */
    async ModifyNickname(e) {
        if (e.isMaster == false) {
            return false; //不是主人
        };

        let nickname = e.msg.replace(/#?(止水对话)?修改昵称/g, '').trim();
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

        if (Enable) {
            e.reply("[对话语音]已开启！");
        } else {
            e.reply("[对话语音]已关闭！");
        }

        return true;
    }

    /** 设置对话发音人 */
    async SetVoiceId(e) {
        let VoiceIndex = parseInt(e.msg.replace(/\D+/, '').trim());
        console.log(VoiceIndex)
        if (VoiceIndex < VoiceList.length && VoiceIndex > 0) {
            VoiceIndex = VoiceIndex - 1
            Config.modify('duihua', 'VoiceIndex', VoiceIndex);
            let name = VoiceList[VoiceIndex].name
            e.reply("[对话发音人]:" + name);

            let voiceId = VoiceList[VoiceIndex].voiceId
            let url = `https://dds.dui.ai/runtime/v1/synthesize?voiceId=${voiceId}&text=你喜欢我这个声音吗？&speed=0.8&volume=150&audioType=wav`
            e.reply([segment.record(url)])



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

    /** 设置对话身份 */
    async SetContext(e) {
        if (e.isMaster) {
            let Context = e.msg.replace(/#?(止水对话)?设置对话身份/g, '').trim();
            if (Context = '') {
                e.reply("你是不是忘记输入对话身份内容了？");
                return false;
            }

            if (await WriteContext(Context)) {
                e.reply("设置对话身份成功！");
                return true;
            } else {
                e.reply("设置对话身份失败！");
                return false;
            }
        }
    }

    /** 查看对话身份 */
    async ShowContext(e) {
        if (e.isMaster) {
            let Context = await ReadContext();
            if (Context.length > 0) {
                e.reply(Context);
            } else {
                e.reply("你还没 #设置对话身份");
            }

        };

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


    let res2 = await FetchPost(url, ChangeData)
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
    let WwangRes = await FetchPost(url, WwangTempMsg, {}, 'text')

    if (!isNotNull(WwangRes)) {
        WwangDate.messages = []
        return undefined
    }

    //记录回答数据
    WwangTempMsg = {
        "role": "assistant",
        "content": WwangRes,
        "id": Date.now()
    };
    WwangDate.messages.push(WwangTempMsg);
    return WwangRes
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
    /** 必应KEY */ let Bearer = await Config.Chat.MirrorBearer || "";
    let url = ''

    //初始化
    if (Bearer == "") {
        Config.modify('duihua', 'MirrorConversationId', "")
        MirrorData = { "device_id": crypto.randomUUID(), "share": "", "base_request": base_request };
        //获取 Bearer
        url = 'https://chatgptmirror.com/api/v1/user/DefaultAccount'
        MirrorRes = await FetchPost(url, MirrorData, AiHeaders);
        //console.log('Post：' + url);
        //console.log('MirrorRes：' + JSON.stringify(MirrorRes));
        if (!isNotNull(MirrorRes.data.token)) {
            Config.modify('duihua', 'MirrorBearer', "")
            return undefined
        } else {
            Config.modify('duihua', 'MirrorBearer', MirrorRes.data.token)
            //console.log('Bearer：' + await Config.Chat.MirrorBearer);
        };

    }

    AiHeaders.Authorization = "Bearer " + await Config.Chat.MirrorBearer;

    /** 会话ID */
    let conversation_id = await Config.Chat.MirrorConversationId || "";

    if (conversation_id == "") {
        //创建会话
        MirrorData = { "name": msg, "base_request": base_request };
        url = 'https://chatgptmirror.com/api/v1/conversation/CreateConversation'
        MirrorRes = await FetchPost(url, MirrorData, AiHeaders);
        //console.log('Post：' + url);
        //console.log('MirrorRes：' + JSON.stringify(MirrorRes));
        if (!isNotNull(MirrorRes.data.conversation.id)) {
            return undefined;
        } else {
            conversation_id = MirrorRes.data.conversation.id
            Config.modify('duihua', 'MirrorConversationId', conversation_id)
            //console.log('ConversationId' + await Config.Chat.MirrorConversationId);
        };

    }

    //发送消息
    MirrorData = { "conversation_id": conversation_id, "content": msg, "base_request": base_request };
    url = 'https://chatgptmirror.com/api/v1/conversation/Chat'
    MirrorRes = await FetchPost(url, MirrorData, AiHeaders);
    //console.log('Post：' + url);
    //console.log('MirrorRes：' + JSON.stringify(MirrorRes));
    if (!isNotNull(MirrorRes)) {
        return undefined;
    } else if (MirrorRes.code != 0) {
        Config.modify('duihua', 'MirrorBearer', "")
        return '对话已重置'
    };

    //取全部消息
    MirrorData = { "conversation_id": conversation_id, "base_request": base_request };
    url = 'https://chatgptmirror.com/api/v1/conversation/GetConvertionAllChatResult'
    MirrorRes = await FetchPost(url, MirrorData, AiHeaders);
    //console.log('Post：' + url);
    //console.log('MirrorRes：' + JSON.stringify(MirrorRes));
    if (!isNotNull(MirrorRes.data.result_list)) {
        return undefined;
    };

    let length = MirrorRes.data.result_list.length
    let MsgId = ''
    if (length >= 0) {
        MsgId = MirrorRes.data.result_list[length - 1].id
        //console.log('MsgId：' + MsgId);
    } else {
        Config.modify('duihua', 'MirrorBearer', "")
        Config.modify('duihua', 'MirrorConversationId', "")
        return undefined;
    }


    //取返回消息
    let state = ''
    MirrorData = { "chat_result_id": MsgId, "base_request": base_request };
    url = 'https://chatgptmirror.com/api/v1/conversation/RefreshChat'
    //console.log('Post：' + url);
    while (state != 'complete') {
        MirrorRes = await FetchPost(url, MirrorData, AiHeaders);

        if (!isNotNull(MirrorRes.data.result.state)) {
            return undefined;
        } else if (MirrorRes.data.result.state != '' && MirrorRes.data.result.state != 'complete') {
            //console.log('state' + MirrorRes.data.result.state);
        };
        //console.log('return：' + MirrorRes.data.result.content);
        state = MirrorRes.data.result.state

        await common.sleep(500)
    }

    return await MirrorRes.data.result.content ?? undefined
}

/**
 * AI对话 https://fwg08.aichatos.com
 *
 * @param {string} msg 发送消息
 * @return {string} 对话结果
 */
async function Aichatos(msg) {
    //记录提问数据

    if (ChatosID = '') {
        ChatosID = Date.now()
    }

    const MsgData = {
        "prompt": msg,
        "userId": "#/chat/" + ChatosID,
        "network": true,
        "apikey": "",
        "system": "",
        "withoutContext": false
    };

    let opt = {
        'accept': 'application/json, text/plain, */*',
        'content-type': 'application/json',
        'origin': 'https://fwg08.aichatos.com',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
    }

    let url = "https://api.aichatos.cloud/api/generateStream"
    let PGTRes = await FetchPost(url, MsgData, opt, 'text')

    return PGTRes
}


/**
 * AI对话  新必应 NewBing
 *
 * @param {string} msg 发送消息
 * @return {string} 对话结果
 */
async function AiBing(msg) {
    let BingCookie = await Config.Chat.BingCookie;
    let Bingres = {}
    if (BingCookie == "") {
        return undefined;
    }

    /** 必应选项 */
    const options = {
        host: 'https://www.bing.com',
        userToken: '',
        cookies: BingCookie,
        proxy: '',
        debug: false,
    }

    /** 必应客户端 */
    const bingAIClient = new BingAIClient({
        ...options,
        cache: cacheOptions,
    });

    //载入身份预设
    let Context = await ReadContext()

    //首次对话 初始化参数和身份设定
    if (!messageId || !jailbreakConversationId) {
        Bingres = await bingAIClient.sendMessage(msg, {
            toneStyle: 'creative', // 默认：balanced, 创意：creative, 精确：precise, 快速：fast
            jailbreakConversationId: true,
            systemMessage: Context,
            onProgress: (token) => {
                process.stdout.write(token);
            },
        });
        jailbreakConversationId = Bingres.jailbreakConversationId;
        messageId = Bingres.messageId;
        //console.log(JSON.stringify(Bingres, null, 2));
    } else {
        //开始正式对话
        Bingres = await bingAIClient.sendMessage(msg, {
            jailbreakConversationId: jailbreakConversationId,
            systemMessage: Context,
            parentMessageId: messageId,
            onProgress: (token) => {
                process.stdout.write(token);
            },
        });
    }
    //console.log(JSON.stringify(Bingres, null, 2));
    await common.sleep(100);
    return Bingres.details.text;
}

/** 解析必应参数 */
async function AnalysisBingCookie(Cookie = '') {
    let regexp
    let match
    regexp = /\bKievRPSSecAuth=(\S+)\b/g;
    match = regexp.exec(Cookie);
    let KievRPSSecAuth = match[1]

    regexp = /\b_U=(\S+)\b/g;
    match = regexp.exec(Cookie);
    let _U = match[1]
    return { KievRPSSecAuth, _U }
}


/** 检查必应参数 */
async function InspectBingCookie(KievRPSSecAuth, _U) {
    let opt = { statusCode: 'json' }
    let url = `https://www.tukuai.one/bingck.php?ka=${KievRPSSecAuth}&u=${_U}`
    let ret = await request.get(url, opt)
    console.log('ret:' + JSON.stringify(ret));
    if (ret.clientId == undefined) {
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
 * @param {'buffer'|'json'|'text'|'arrayBuffer'|'formData'|'blob'} statusCode 输出数据类型
 * @returns API返回数据
 */
async function FetchPost(Url = '', data = {}, headers = {}, statusCode = 'json') {
    /** 请求参数 */
    let Options = {
        data,
        headers: headers,
        statusCode: statusCode
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

/**
 * 读身份设定
 */
async function ReadContext() {
    let Context = '';
    const DataFile = `${Plugin_Path}/resources/data/Context.txt`;

    if (fs.existsSync(DataFile)) {
        return fs.readFileSync(DataFile, 'utf8')
    } else {
        return ''
    }

}

/**
 * 写身份设定
 */
async function WriteContext(Context = '') {
    if (Context.length > 0) {
        const DataFile = `${Plugin_Path}/resources/data/Context.txt`;
        try {
            fs.writeFileSync(DataFile, Context)
            return true
        } catch (err) {
            logger.error(err)
            return false
        }
    } else {
        return false
    }
}

