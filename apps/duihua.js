import plugin from '../../../lib/plugins/plugin.js';
import { common } from '../model/index.js';
import fs from 'fs';
import { Plugin_Path, Config } from '../components/index.js';
import request from '../lib/request/request.js';
import Data from '../components/Data.js';
import { BingAIClient } from '@waylaidwanderer/chatgpt-api';
import { KeyvFile } from 'keyv-file';
import path from 'path';

/** 缓存目录 */
const CachePath = path.join(Plugin_Path, 'resources', 'Cache', 'Chat');

/** 聊天昵称 */
let NickName = await Config.Chat.NickName;
/** 发音人列表 */
const VoiceList = await Data.ReadVoiceList();
/** Chang消息缓存 */
var cachedEditMessage = "";

// 必应相关变量
let jailbreakConversationId = '';
let messageId = '';

/** 工作状态 */
let isChatActive = 0;
/** 消息计数器 */
let messageCounter = 0;
/** 会话ID */
let chatSessionId = '#/chat/' + Date.now().toString();
/** 前后缓冲区 */
let chatFrontBuffer, chatBackBuffer = ''

/** GPT提交数据 */
const ChatData = {
    prompt: '',
    userId: chatSessionId,
    network: true,
    stream: false,
    system: '',
    withoutContext: false,
    // 新增deepseek专用参数
    temperature: 0.7,
    top_p: 0.8
};

/** 对话数据 */
let chatMsg = [];

/** 缓存选项 */
const keyv = new KeyvFile({ filename: `${CachePath}/cache.json` });
const cacheOptions = {
    store: keyv,
};

export class ChatHandler extends plugin {
    constructor() {
        super({
            name: '[止水插件]对话',
            dsc: '智能对话',
            event: 'message',
            priority: 8888,
            rule: [
                {
                    reg: `^#?(止水)?(插件|对话)?(取消|结束|重置|关闭)(对话|聊天)$`,
                    fnc: 'ResetChat'
                }, {
                    reg: `^#?(止水)?(插件|对话)?(语|发)音(开启|关闭)$`,
                    fnc: 'SetVoiceEnable'
                }, {
                    reg: `^#?(止水)?(插件|对话)?艾特(开启|关闭)$`,
                    fnc: 'SetAtEnable'
                }, {
                    reg: `^#?(止水)?(插件|对话)??设置(对话)?发音人(.*)$`,
                    fnc: 'SetVoiceId'
                }, {
                    reg: `^#?(止水)?(插件|对话)??查看(对话)?发音人$`,
                    fnc: 'ShowVoiceId'
                }, {
                    reg: '^#?(止水)?(插件|对话)??设置身份(.*)',
                    fnc: 'SetContext'
                }, {
                    reg: `^#?(止水)?(插件|对话)??查看(对话)?身份$`,
                    fnc: 'ShowContext'
                }, {
                    reg: `^#?(止水)?(插件|对话)??设置(对话)?场景(.*)`,
                    fnc: 'SetChatScene'
                }, {
                    reg: `^#?(止水)?(插件|对话)??查看(对话)?场景$`,
                    fnc: 'ShowChatScene'
                }, {
                    reg: `^#?(止水)?(插件|对话)??设置好感度(.*)$`,
                    fnc: 'updateUserFavor'
                }, {
                    reg: `^#?(止水)?(插件|对话)??查看好感度(.*)$`,
                    fnc: 'ShowUserFavora'
                }, {
                    reg: `^#?(止水)?(插件|对话)?设置(对话)?主人(.*)$`,
                    fnc: 'SetMaster'
                }, {
                    reg: `^#?(止水)?(插件|对话)?(设置|查看|开启|关闭)代理(.*)$`,
                    fnc: 'SetProxy'
                }, {
                    reg: `^#?(止水)?(插件|对话)?[链|连]接模式(开启|关闭)$`,
                    fnc: 'SetLinkMode'
                }, {
                    reg: `^#?止水(插件|对话)?设置API(.*)$`,
                    fnc: 'SetApi'
                }, {
                    reg: `^#?止水(插件|对话)?查看API$`,
                    fnc: 'ShowApi'
                }, {
                    reg: `^#?止水(插件|对话)?设置KEY(.*)$`,
                    fnc: 'SetApiKey'
                }, {
                    reg: `^#?止水(插件|对话)?查看KEY$`,
                    fnc: 'ShowApiKey'
                }, {
                    reg: `^#?止水(插件|对话)?设置模型(.*)$`,
                    fnc: 'setModel'
                }, {
                    reg: `^#?止水(插件|对话)?查看模型$`,
                    fnc: 'showModel'
                }, {
                    reg: `^#?止水(插件|对话)?测试(.*)$`,
                    fnc: 'taklTest'
                }, {
                    reg: ``,
                    fnc: 'duihua',
                    log: false
                }
            ]
        });
    }


    /** 对话测试 */
    async taklTest(e) {
        if (!e.isMaster) { return; }
        return;
    };

    /** 重置对话 */
    async ResetChat(e) {
        if (!e.isMaster) { return; }

        cachedEditMessage = "";
        chatMsg = []


        Config.modify('duihua', 'MirrorBearer', "");
        Config.modify('duihua', 'MirrorConversationId', "");
        isChatActive = 0;

        //重置必应
        messageId = '';
        jailbreakConversationId = '';
        keyv.clear();

        e.reply('已经重置对话了！');
        return;
    };

    /** 对话 */
    async duihua(e) {
        // 检查消息是否是针对当前对话的，或者是通过@Bot的方式
        let msg = e.msg;
        let regex = new RegExp(`^#?${NickName}`);
        if (regex.test(msg) || (e.atBot && await Config.Chat.EnableAt)) {
            try {
                // 标记对话状态为进行中      
                isChatActive = 1;
                // 提取用户消息内容，并去除对话昵称前缀
                msg = msg.replace(/^#?${NickName}\s*/, '').trim();
                msg = msg.replace(/{at:/g, '{@');

                const Favora = await GetFavora(e.user_id);
                const userMessage = `<${e.user_id}|${Favora}>：${msg}`;
                console.log("止水对话 -> " + userMessage);

                // 发送消息到 openAi 进行对话
                let response = await openAi(userMessage);

                if (response) {
                    // 缓存对话消息
                    chatMsg.push({ role: 'user', content: userMessage });
                    chatMsg.push({ role: 'assistant', content: response });

                    // 更新好感度
                    const newfavora = await updateFavora(response)
                    //console.log("止水对话 <- " + newfavora);

                    // 发送回复消息给用户
                    const remsg = await MsgToAt(newfavora);
                    e.reply(remsg, true);

                    // 如果配置了语音合成，发送语音回复
                    if (await Config.Chat.EnableVoice) {
                        const voiceId = VoiceList[await Config.Chat.VoiceIndex].voiceId;
                        const voiceUrl = `https://dds.dui.ai/runtime/v1/synthesize?voiceId=${voiceId}&text=${encodeURIComponent(newfavora)}&speed=0.8&volume=150&audioType=wav`;
                        e.reply([segment.record(voiceUrl)]);
                    }

                    // 标记对话状态为完成
                    isChatActive = 0;
                } else {
                    // 如果没有获取到有效的回复，标记对话状态为未进行
                    isChatActive = 0;
                    return false;
                }
            } catch (error) {
                // 捕获并处理异常，例如输出错误日志
                console.error('对话处理过程中发生错误:', error);
                e.reply('发生错误，无法进行对话。');
                isChatActive = 0;
                return false;
            }
        }

        // 如果消息不是针对当前对话的，则不进行处理
        return false;
    }

    /** 修改对话昵称 */
    async ModifyNickname(e) {
        if (e.isMaster == false) {
            return false; //不是主人
        };

        let nickname = e.msg.replace(/^.*修改(对话)?昵称/g, '').trim();
        if (nickname.length > 0 && nickname != await Config.Chat.NickName) {
            NickName = nickname;
            Config.modify('duihua', 'NickName', nickname);
            e.reply("对话昵称修改为:" + nickname);
            return true;
        }
        return false;
    }

    /** 对话艾特开关 */
    async SetAtEnable(e) {
        if (e.isMaster == false) {
            return false; //不是主人
        };

        let Enable = e.msg.search('开启') != -1;

        Config.modify('duihua', 'EnableAt', Enable);

        if (Enable) {
            e.reply("[对话艾特]已开启！");
        } else {
            e.reply("[对话艾特]已关闭！");
        }
        return true;
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
        if (e.isMaster == false) {
            return false; //不是主人
        };

        let VoiceIndex = parseInt(e.msg.replace(/\D+/, '').trim());
        console.log(VoiceIndex);
        if (VoiceIndex < VoiceList.length && VoiceIndex > 0) {
            VoiceIndex = VoiceIndex - 1;
            Config.modify('duihua', 'VoiceIndex', VoiceIndex);
            let name = VoiceList[VoiceIndex].name;
            e.reply("[对话发音人]:" + name);

            let voiceId = VoiceList[VoiceIndex].voiceId;
            let url = `https://dds.dui.ai/runtime/v1/synthesize?voiceId=${voiceId}&text=你喜欢我这个声音吗？&speed=0.8&volume=150&audioType=wav`;
            e.reply([segment.record(url)]);



        } else {
            e.reply("[对话发音人]错误！");
        }

        return true;
    }

    /** 查看对话发音人 */
    async ShowVoiceId(e) {
        let msg = [];
        let nowindex = await Config.Chat.VoiceIndex;
        msg.push(`当前发音人：${(nowindex + 1)} 、${VoiceList[nowindex].name}`);
        msg.push(`#止水对话设置发音人${(nowindex + 1)}`);
        let list = `*** 发音人列表 ***\n`;
        for (let i = 0; i < VoiceList.length; i++) {
            let obj = VoiceList[i];
            let name = obj.name;
            let type = obj.type;
            let sexy = obj.sexy;
            if (nowindex == i) {
                list += `>>>${(i + 1)} 、${name}，分类：${type}，性别：${sexy}<<<\n`;
            } else {
                list += `${(i + 1)} 、${name}，分类：${type}，性别：${sexy}\n`;
            }

        }
        msg.push(list);
        common.getforwardMsg(e, msg, {
            isxml: true,
            xmlTitle: '发音人列表',
        })
        return;

    }

    /** 设置对话身份 */
    async SetContext(e) {
        if (e.isMaster) {
            let Context = e.msg.replace(/^.*?设置(全局|群)?对话身份/, '').trim();

            if (await WriteContext(Context)) {
                e.reply("设置对话身份成功！");
                return;
            } else {
                e.reply("设置对话身份失败！");
                return;
            }
        }
    }

    /** 查看对话身份 */
    async ShowContext(e) {
        if (e.isMaster) {
            let Context = await ReadContext();
            if (Context.length > 0) {
                let msg = []
                msg.push(Context)
                common.getforwardMsg(e, msg, {
                    isxml: true,
                    xmlTitle: '对话身份',
                })
            } else {
                e.reply("你还没 #设置对话身份");
            }

        };

    }

    /** 设置对话场景 */
    async SetChatScene(e) {
        if (e.isMaster) {
            let Scene = e.msg.replace(/^.*设置对话场景/, '').trim();

            if (await WriteScene(Scene)) {
                e.reply("设置对话场景成功！");
                return;
            } else {
                e.reply("设置对话场景失败！");
                return;
            }
        }
    }

    /** 查看对话场景 */
    async ShowChatScene(e) {
        if (e.isMaster) {
            let Scene = await ReadScene();
            if (Scene.length > 0) {
                let msg = []
                msg.push(Scene)
                common.getforwardMsg(e, msg, {
                    isxml: true,
                    xmlTitle: '对话场景',
                })
            } else {
                e.reply("你还没 #设置对话场景");
            }

        };
        return;
    }


    /** 查看用户好感度 */
    async ShowUserFavora(e) {
        let UserQQ;
        let isat = e.message.some((item) => item.type === "at");
        if (isat && e.isMaster) {
            let atItem = e.message.filter((item) => item.type === "at");//获取at信息
            UserQQ = atItem[0].qq;//对方qq
        } else {
            UserQQ = e.user_id;
        }

        let UserFavora = await GetFavora(UserQQ) | 0;

        let msg = [];
        msg.push(segment.at(parseInt(UserQQ)));
        msg.push(`\n好感度：${UserFavora}`);
        e.reply(msg);
        return;
    }

    /** 设置用户好感度 */
    async updateUserFavor(e) {

        if (!e.isMaster) {
            return;
        }
        //对方
        let UserQQ;
        let isat = e.message.some((item) => item.type === "at");
        if (isat) {
            let atItem = e.message.filter((item) => item.type === "at");//获取at信息
            UserQQ = atItem[0].qq;//对方qq
        } else {
            UserQQ = e.user_id;
        }


        const pattern = /\d+/;
        const result = e.msg.match(pattern);
        if (!result) {
            e.reply(`你需要输入：好感度数值`);
            return;
        }
        const UserFavora = result[0] | 0;
        const bool = SetFavora(UserQQ, UserFavora);


        let msg = `用户：${UserQQ}\n`;
        msg += `好感度：${bool ? UserFavora : await GetFavora(QQ)}`;
        e.reply(msg, true);
        return;

    }

    /** 设置主人 */
    async SetMaster(e) {
        if (e.isMaster) {

            let re = /^.*主人\s*(\S+)\s+(\d+)/;
            let result = re.exec(e.msg);

            if (result?.length != 3) {
                e.reply("设置主人格式错误！正确的格式应该是“#设置主人主人名字{空格}QQ号码”\n例如：#设置主人止水 1234567");
                return;
            }
            await WriteMaster(result[1], result[2]);

            e.reply(`设置成功！\n当前主人：${result[1]}\nQQ号码：${result[2]}`);
            return;
        };

    }

    /** 设置对话模型 */
    async setModel(e) {
        if (!e.isMaster) {
            return;
        };
        console.log(e.msg);
        const model = e.msg.replace(/^.*设置模型/, '').trim();
        const success = await Config.modify('duihua', 'ApiModel', model);
        if (success) {
            e.reply(`[对话] 设置模型为：${model}`);
        } else {
            e.reply(`[对话] 设置模型失败！`);
        }
        return;
    }

    /** 查看对话模型 */
    async showModel(e) {
        if (!e.isMaster) {
            return;
        };

        const model = await Config.Chat.ApiModel;
        e.reply(`[对话] 当前模型：${model}`);
        return;
    }


    /** 设置代理 */
    async SetProxy(e) {
        if (!e.isMaster) {
            return;
        };

        const switchProxy = e.msg.search('开启') != -1 ? true : e.msg.search('关闭') != -1 ? false : null;
        if (switchProxy !== null) {
            Config.modify('proxy', 'switchProxy', switchProxy);
            e.reply(`[对话] 代理 ${switchProxy ? '已开启' : '已关闭'}！`);
        } else if (e.msg.search('设置') != -1) {
            const proxy = e.msg.replace(/^.*代理/, '').trim();
            if (proxy) {
                Config.modify('proxy', 'proxyAddress', proxy);
                e.reply(`[对话]代理设置为：${proxy}`);
            } else {
                e.reply("[对话]设置代理失败！请在指令后面加上你要设置的http代理,例如：\n#止水对话设置代理http://127.0.0.1:7890");
            }
        } else if (e.msg.search('查看') != -1) {
            const proxyAddress = await Config.proxy.proxyAddress;
            if (proxyAddress) {
                e.reply(`[对话]你当前的代理为：${proxyAddress}`);
            } else {
                e.reply("[对话]你现在还没有设置代理，可以发送指令进行设置,例如：\n#止水对话设置代理http://127.0.0.1:7890");
            }
        }

        return;

    }

    /** 设置链接模式 */
    async SetLinkMode(e) {
        if (!e.isMaster) {
            return;
        };

        let Enable = e.msg.search('开启') != -1;
        await Config.modify('duihua', 'LinkMode', Enable);
        e.reply(`[对话] 链接模式 ${Enable ? '已开启' : '已关闭'}！`);
        return;

    }

    async SetApi(e) {
        if (!e.isMaster) {
            return;
        };

        const apiUrl = e.msg.replace(/^.*设置API/, '').trim();
        await Config.modify('duihua', 'ApiUrl', apiUrl);
        e.reply(`[对话] API URL 设置成功！`);
        return;
    }

    async ShowApi(e) {
        if (!e.isMaster) {
            return;
        };

        const apiUrl = await Config.Chat.ApiUrl;
        e.reply(`[对话] API URL：${apiUrl}`);
        return;
    }

    async SetApiKey(e) {
        if (!e.isMaster) {
            return;
        };

        const apiKey = e.msg.replace(/^.*设置KEY/, '').trim();
        Config.modify('duihua', 'ApiKey', apiKey);
        e.reply(`[对话] API KEY 设置成功！`);
        return;
    }

    async ShowApiKey(e) {
        if (!e.isMaster) {
            return;
        };

        const apiKey = await Config.Chat.ApiKey;
        e.reply(`[对话] API KEY：${apiKey}`);
        return;
    }


}


/**
 * 通过调用 API 与 AI 进行对话并获取回复
 * @param {string} msg 用户发送的消息
 * @returns {string} AI 的对话结果
 */
async function openAi(msg) {
    const [apiUrl, apiKey, aiModel, MasterQQ, Master] = await Promise.all([
        Config.Chat.ApiUrl,
        Config.Chat.ApiKey,
        Config.Chat.ApiModel,
        Config.Chat.MasterQQ,
        Config.Chat.Master
    ]);

    if (!Array.isArray(chatMsg) || chatMsg.length === 0) {
        // 首次对话，发送系统消息
        let Context = await ReadContext() + await ReadScene() + `我的QQ号码是“${MasterQQ}”，名字叫“${Master}”，你对我的好感度永远是最大值。`;

        await addMessage({ role: 'system', content: Context });
    }

    /** 添加新消息 */
    async function addMessage(newMessage) {
        chatMsg.push(newMessage);
        const MaxHistory = await Config.Chat.MaxHistory;
        while (chatMsg.length > MaxHistory) {
            chatMsg.shift(); // 移除最老的消息
        }
    }

    await addMessage({ role: 'user', content: msg });

    // 新增DeepSeek请求头
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
    };

    // 构建请求数据
    const requestData = {
        model: aiModel,
        messages: chatMsg,
        temperature: 0.7,
        top_p: 0.8,
        max_tokens: 1024,
        presence_penalty: 0,
        frequency_penalty: 0,
        stream: false,
        verbose: false,
        show_reasoning: await Config.Chat.ShowReasoning
    };

    let content;
    try {
        // 发送 POST 请求
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestData),
        });

        // 新增DeepSeek错误码处理
        if (response.status === 401) {
            return 'API密钥无效，请检查 Key 配置';
        }
        if (response.status === 429) {
            return '请求过于频繁，请稍后再试';
        }
        // 检查响应状态码，确保请求成功
        if (!response.ok) {
            console.error(`请求地址：${apiUrl}`);
            console.error(`请求内容：${JSON.stringify(requestData)}`);
            console.error(`状态码：${response.status}`);
            console.error(`响应内容：${await response.text()}`);

            const errorData = await response.json();
            return parseErrorMessage(errorData);

        }

        // 尝试解析 JSON 响应
        try {
            const responseData = await response.json();
            let rawContent = responseData.choices[0].message.content.trim();
            // 移除推理过程保留最终结论
            content = await Config.Chat.ShowReasoning ? rawContent : rawContent.replace(/(（\u63a8\u7406\u8fc7\u7a0b[：:][\s\S]*?）|\u63a8\u7406\u8fc7\u7a0b[：:][\s\S]*?)(?=\n\u7ed3\u8bba|\u7b54\u6848|$)/gi, '');

            // 添加 历史消息 和 AI 回复
            await addMessage({ role: 'assistant', content });

        } catch (parseError) {
            // 如果响应不是 JSON，则直接返回文本内容
            content = await response.text();
        }
    } catch (error) {
        console.error('与 AI 通信时发生错误:', error.message);
        return '与 AI 通信时发生错误，请稍后重试。';
    }

    return content;
}

/**
 * 将OpenAI错误消息转换为简洁易懂的中文描述。
 * @param {Object} errorData - 包含错误信息的对象。
 * @returns {string} 转换后的中文描述。
 */
function parseErrorMessage(errorData) {
    const errorMessage = errorData.error.message;
    const errorType = errorData.error.type;
    const errorCode = errorData.error.code;

    let response;

    switch (errorCode) {
        case "account_deactivated":
            response = "您的OpenAI账户已被停用。";
            break;
        case "invalid_request_error":
            response = "请求无效：" + errorMessage + "，请检查您的请求参数。";
            break;
        case "rate_limit_exceeded":
            response = "请求频率过高，请稍后重试。";
            break;
        case "quota_exceeded":
            response = "您已超出当前配额，请检查您的计划和账单详情。";
            break;
        case "invalid_api_key":
            response = "API密钥无效，请检查您的API密钥是否正确。";
            break;
        case "invalid_model":
            response = "指定的模型无效，请检查模型名称是否正确。";
            break;
        case "invalid_parameter":
            response = "请求参数无效：" + errorMessage + "，请检查您的参数设置。";
            break;
        case "missing_parameter":
            response = "缺少必要参数：" + errorMessage + "，请补充缺失的参数。";
            break;
        case "service_unavailable":
            response = "服务暂时不可用，请稍后再试。";
            break;
        case "internal_server_error":
            response = "服务器内部错误：" + errorMessage + "，请稍后再试或联系支持人员。";
            break;
        case "content_too_long":
            response = "内容过长，请缩短输入内容。";
            break;
        case "context_error":
            response = "上下文错误：" + errorMessage + "，请检查您的上下文设置。";
            break;
        default:
            response = "出现了一个问题：" + errorMessage + "，请稍后再试或联系支持人员。";
    }

    // 如果错误信息过长，进行简化
    if (response.length > 100) {
        response = "出现了一个问题：" + errorMessage.substring(0, 80) + "...，请稍后再试或联系支持人员。";
    }

    return response;
}

/**
 * AI对话  新必应 NewBing
 *
 * @param {string} msg 发送消息
 * @return {string} 对话结果
 */
async function AiBing(msg) {
    let BingCookie = await Config.Chat.BingCookie;
    let Bingres = {};
    if (BingCookie == "") {
        return undefined;
    }

    let proxy = await Config.proxy.switchProxy ? await Config.proxy.proxyAddress : '';
    /** 必应选项 */
    const options = {
        host: 'https://cn.bing.com',
        userToken: '',
        cookies: BingCookie,
        proxy: proxy,
        debug: false,
    };

    /** 必应客户端 */
    const bingAIClient = new BingAIClient({
        ...options,
        cache: cacheOptions,
    });

    let nickname = await Config.Chat.NickName;
    let masterQQ = await Config.Chat.MasterQQ;
    let master = await Config.Chat.Master;

    //为设置昵称、主人、主人QQ
    if (!nickname || !masterQQ || !master) {
        return undefined;
    }

    //载入身份预设
    let Context = await ReadContext() + await ReadScene() + `我的QQ号码是“{MasterQQ}”，名字叫“{Master}”，你对我的好感度永远是最大值。`;
    Context = Context.replace(/{NickName}/g, nickname);
    Context = Context.replace(/{MasterQQ}/g, masterQQ);
    Context = Context.replace(/{Master}/g, master);

    let ResText = '';
    let toneStyle = await Config.Chat.toneStyle;
    if (!isNotNull(toneStyle)) { toneStyle = `creative`; };

    // console.log(toneStyle);
    // 首次对话 初始化参数和身份设定
    if (!messageId || !jailbreakConversationId) {
        Bingres = await bingAIClient.sendMessage(msg, {
            toneStyle: toneStyle, // 默认：balanced, 创意：creative, 精确：precise, 快速：fast
            jailbreakConversationId: true,
            systemMessage: Context,
            clientOptions: {
                features: {
                    genImage: {
                        enable: true,
                        type: 'markdown_list',
                    },
                },
            },
            onProgress: (token) => {
                process.stdout.write(token);
                ResText += token;
            },
        });
        jailbreakConversationId = Bingres.jailbreakConversationId;
        messageId = Bingres.messageId;

        console.log(JSON.stringify(Bingres, null, 2));

    } else {
        //开始正式对话
        Bingres = await bingAIClient.sendMessage(msg, {
            toneStyle: toneStyle,
            jailbreakConversationId: jailbreakConversationId,
            systemMessage: Context,
            clientOptions: {
                features: {
                    genImage: {
                        enable: true,
                        type: 'markdown_list',
                    },
                },
            },
            parentMessageId: messageId,
            onProgress: (token) => {
                process.stdout.write(token);
                ResText += token;
            },
        });
        jailbreakConversationId = Bingres.jailbreakConversationId;
        messageId = Bingres.messageId;
    }

    Data.sleep(1000);
    // console.log(JSON.stringify(Bingres, null, 2));

    const LinkMode = await Config.Chat.LinkMode;
    if (!ResText) {
        if (LinkMode && Bingres.details.adaptiveCards[0].body[0].text) {
            ResText = Bingres.details.adaptiveCards[0].body[0].text;
        } else if (Bingres.details.text && Bingres.details.text != 'N/A') {
            ResText = Bingres.details.text;
        } else if (Bingres.response && Bingres.response != 'N/A') {
            ResText = Bingres.response;
        }
    }


    if (Bingres.details?.bic?.images) {
        return {
            text: ResText,
            images: Bingres.details.bic.images
        };
    }
    return ResText;

}

/** 解析必应参数 */
async function AnalysisBingCookie(Cookie = '') {
    let KievRPSSecAuth = '';
    let _U = '';
    if (Cookie.includes("KievRPSSecAuth=")) {
        KievRPSSecAuth = Cookie.match(/\bKievRPSSecAuth=(\S+)\b/)[1];
    }

    if (Cookie.includes("_U=")) {
        _U = Cookie.match(/\b_U=(\S+)\b/)[1];
    }

    return { KievRPSSecAuth, _U };
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
 * 发送转发图片消息
 * @param data 输入一个数组,元素是字符串,每一个元素都是一个图片链接.
*/
async function ForwardImageMsg(e, data) {
    let msgList = [];
    for (let i = 0; i < data.length; i++) {
        let msg2 = await segment.image(data[i]);
        msgList.push({
            message: msg2,
            nickname: Bot.nickname,
            user_id: Bot.uin,
        });
    }
    console.log(msgList);
    if (msgList.length == 0) {
        await e.reply(msgList[0].message);
    }
    else {
        await e.reply(await Bot.makeForwardMsg(msgList));
    }
    return;
};

/**
 * 判断对象是否不为undefined且不为null、NaN
 * @param obj 对象
 * @returns obj==null/undefined,return false,other return true
 */
function isNotNull(obj) {
    if (obj == undefined || obj == null || obj != obj) { return false; }
    return true;
};

/**
 * 读身份设定
 */
async function ReadContext() {
    let context = '';
    const fileName = 'Context.txt';
    const defFile = path.join(Plugin_Path, 'config', 'default_config', fileName);
    const userFile = path.join(Plugin_Path, 'config', 'config', fileName);

    if (fs.existsSync(userFile)) {
        context = fs.readFileSync(userFile, 'utf8');
        if (!context) {
            context = fs.readFileSync(defFile, 'utf8');
        }
    } else {
        context = fs.readFileSync(defFile, 'utf8');
    }

    if (!context) {
        context = '';
    }

    return context;

};


/**
 * 写身份设定
 */
async function WriteContext(Context) {
    const DataFile = path.join(Plugin_Path, 'config', 'config', 'Context.txt');
    console.log("设置身份：" + Context);
    try {
        fs.writeFileSync(DataFile, Context);
        return true;
    } catch (error) {
        logger.error(error);
        return false;
    }

}

/**
 * 读场景设定
 */
async function ReadScene() {
    try {
        const fileName = 'Scene.txt';
        const userConfigPath = path.join(Plugin_Path, 'config', 'config', fileName);
        const defaultConfigPath = path.join(Plugin_Path, 'config', 'default_config', fileName);

        // 优先读取用户配置文件，如果不存在则读取默认配置文件
        const [userScene, defaultScene] = await Promise.all([
            fs.promises.readFile(userConfigPath, 'utf8').catch(() => ''),
            fs.promises.readFile(defaultConfigPath, 'utf8').catch(() => ''),
        ]);

        // 返回用户配置，如果用户配置为空或不存在，则返回默认配置
        return userScene || defaultScene;
    } catch (error) {
        // 处理可能的错误，例如记录日志或返回一个空字符串
        console.error('读取场景配置文件时发生错误:', error);
        return '';
    }
}

/**
 * 写场景设定
 */
async function WriteScene(Context) {
    try {
        const sceneFilePath = path.join(Plugin_Path, 'config', 'config', 'Scene.txt');
        // 使用 fs.promises.writeFile 来异步写入文件，并处理可能的异常
        await fs.promises.writeFile(sceneFilePath, Context, 'utf8');
        console.log('场景配置已成功保存。');
    } catch (error) {
        // 处理可能的错误，例如记录日志
        console.error('写入场景配置文件时发生错误:', error);
        // 在发生错误时返回 false 表示写入失败
        return false;
    }
    return true; // 写入成功返回 true
}

/**
 * 写主人设定
 */
async function WriteMaster(Master, MasterQQ) {
    Config.modify('duihua', 'Master', Master);
    Config.modify('duihua', 'MasterQQ', MasterQQ);
}

/**
 * 获取好感度
 */
async function GetFavora(qq) {
    let user = {};
    const DataPath = path.join(Plugin_Path, 'resources', 'data', 'user');
    const fileName = `${qq}.json`;
    if (fs.existsSync(path.join(DataPath, fileName))) {
        user = await Data.readJSON(fileName, DataPath);
    }

    return parseInt(user.Favora) | 0;
}

/**
 * 设置好感度
 */
async function SetFavora(qq, favora = 0) {
    let user = { Favora: parseInt(favora) | 0 };
    const DataPath = path.join(Plugin_Path, 'resources', 'data', 'user');
    const fileName = `${qq}.json`;

    return Data.writeJSON(fileName, user, DataPath);
}

/**
 * 将msg中的号码转成@
 */
async function MsgToAt(msg) {
    let arr = msg.toString()
        .split(/(\[@\d+\])/)
        .filter(Boolean)
        .map((s) => s.startsWith('[@') ? segment.at(parseInt(s.match(/\d+/)[0])) : s);
    return arr;
}

/**
 * 更新好感度
 */
async function updateFavora(text) {
    try {
        const qqRegex = /(?:\(|（|｛|{)@(\d+)(?:\|(-?\d+))?(?:\)|）|｝|})/g;
        qqRegex.lastIndex = 0;  // 重置 lastIndex

        let match;
        while ((match = qqRegex.exec(text)) !== null) {
            const qqNumber = parseInt(match[1]);
            const paramValue = match[2] ? parseInt(match[2]) : 0;

            if (paramValue !== 0) {
                const oldFavora = await GetFavora(qqNumber);
                const newFavora = parseInt(oldFavora) + paramValue; // 计算好感度
                if (await SetFavora(qqNumber, newFavora)) {
                    console.log(`更新好感度成功：[${qqNumber}] ${oldFavora} + ${paramValue} -> ${newFavora}`);
                } else {
                    logger.error(`更新好感度失败：[${qqNumber}] ${paramValue}`);
                }
            }
        }

        const updatedText = text.replace(qqRegex, '');

        return updatedText;
    } catch (error) {
        // 处理异步操作中的错误
        console.error('更新好感度时发生错误:', error);
        return text;
    }
}
