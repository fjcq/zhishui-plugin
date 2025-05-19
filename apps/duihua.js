import plugin from '../../../lib/plugins/plugin.js';
import { common } from '../model/index.js';
import fs from 'fs';
import { Plugin_Path, Config } from '../components/index.js';
import Data from '../components/Data.js';
import { KeyvFile } from 'keyv-file';
import path from 'path';

/** 缓存目录 */
const CACHE_PATH = path.join(Plugin_Path, 'resources', 'Cache', 'Chat');
/** 聊天上下文文件夹 */
const CHAT_CONTEXT_PATH = path.join(Plugin_Path, 'resources', 'Cache', 'ChatContext');
if (!fs.existsSync(CHAT_CONTEXT_PATH)) fs.mkdirSync(CHAT_CONTEXT_PATH, { recursive: true });

/** 聊天昵称 */
let chatNickname = await Config.Chat.NickName;
/** 发音人列表 */
const voiceList = await Data.readVoiceList();

/** 工作状态 */
let chatActive = 0;

/** 消息计数器 */
let chatMessageCounter = 0;


export class ChatHandler extends plugin {
    constructor() {
        super({
            name: '[止水插件]对话',
            dsc: '智能对话',
            event: 'message',
            priority: 8888,
            rule: [
                {
                    reg: `^#?(止水)?(插件|对话)?(取消|结束|重置|关闭)(全部)?(对话|聊天)$`,
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
                    reg: '^#?(止水)?(插件|对话)?设置(对话)?身份(.*)',
                    fnc: 'SetContext'
                }, {
                    reg: `^#?(止水)?(插件|对话)??查看(对话)?角色$`,
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
                    reg: `^#?(止水)?(插件|对话)?设置(对话)?主人(.*)$`,
                    fnc: 'SetMaster'
                }, {
                    reg: `^#?(止水)?(插件|对话)?(设置|查看|开启|关闭)代理(.*)$`,
                    fnc: 'SetProxy'
                }, {
                    reg: `^#?(止水)?(插件|对话)?[链|连]接模式(开启|关闭)$`,
                    fnc: 'SetLinkMode'
                }, {
                    reg: `^#?止水(插件|对话)?设置(对话)?(API|api)(.*)$`,
                    fnc: 'SetApi'
                }, {
                    reg: `^#?止水(插件|对话)?查看(对话)?(API|api)$`,
                    fnc: 'ShowApi'
                }, {
                    reg: `^#?止水(插件|对话)?设置(对话)?(KEY|key)(.*)$`,
                    fnc: 'SetApiKey'
                }, {
                    reg: `^#?止水(插件|对话)?查看(对话)?(KEY|key)$`,
                    fnc: 'ShowApiKey'
                }, {
                    reg: `^#?止水(插件|对话)?设置(对话)?模型(.*)$`,
                    fnc: 'setModel'
                }, {
                    reg: `^#?止水(插件|对话)?查看(对话)?模型$`,
                    fnc: 'showModel'
                }, {
                    reg: `^#?止水(插件|对话)?测试(.*)$`,
                    fnc: 'taklTest'
                }, {
                    reg: '^#?(止水)?(插件|对话)?角色列表$',
                    fnc: 'ShowRoleList'
                }, {
                    reg: '^#?(止水)?(插件|对话)?切换(对话)?角色(.+)$',
                    fnc: 'SwitchRole'
                }, {
                    reg: ``,
                    fnc: 'duihua',
                    log: false
                }, {
                    reg: '^#?(止水)?(插件|对话)?添加(对话)?角色(.*)',
                    fnc: 'AddRole'
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
        chatActive = 0;

        // 判断是否为“结束全部对话”
        if (/全部/.test(e.msg)) {
            // 删除所有对话上下文缓存文件
            const files = fs.readdirSync(CHAT_CONTEXT_PATH);
            for (const file of files) {
                const filePath = path.join(CHAT_CONTEXT_PATH, file);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            e.reply('已清除全部对话缓存！');
            return;
        }

        // 删除对应上下文缓存
        const sessionId = e.group_id ? `group_${e.group_id}` : `user_${e.user_id}`;
        const keyv = getSessionKeyv(sessionId);
        await keyv.delete('chatMsg');

        e.reply('已经重置对话了！');
        return;
    };

    /** 对话 */
    async duihua(e) {
        // 检查消息是否是针对当前对话的，或者是通过@Bot的方式
        let msg = e.msg;
        let regex = new RegExp(`^#?${chatNickname}`);
        if (regex.test(msg) || (e.atBot && await Config.Chat.EnableAt)) {
            try {
                // 标记对话状态为进行中      
                chatActive = 1;
                // 提取用户消息内容，并去除对话昵称前缀
                msg = msg.replace(/^#?${chatNickname}\s*/, '').trim();
                msg = msg.replace(/{at:/g, '{@');

                const Favora = await getUserFavor(e.user_id);
                const userMessage = {
                    message: msg,
                    additional_info: {
                        name: e.sender.nickname,
                        user_id: e.user_id,
                        favor: Favora,
                        group_id: e.group_id || 0
                    }
                };
                const MessageText = JSON.stringify(userMessage);
                console.log("止水对话 -> " + MessageText);

                // 发送消息到 openAi 进行对话，传递 e 以便群聊优先使用群专属角色
                let response = await openAi(MessageText, e);

                if (response) {
                    console.log("止水对话 <- " + response);

                    // 严格JSON格式校验
                    let replyObj;
                    try {
                        replyObj = JSON.parse(response); // 这里用 response
                        if (typeof replyObj !== 'object' || !replyObj.message) {
                            replyObj = {
                                message: response,
                                favor_changes: []
                            };
                        }
                    } catch (error) {
                        replyObj = {
                            message: response,
                            favor_changes: []
                        };
                    }
                    replyObj.favor_changes = replyObj.favor_changes || [];

                    // 处理好感度
                    let favorLogs = [];
                    if (Array.isArray(replyObj.favor_changes)) {
                        for (const item of replyObj.favor_changes) {
                            const user_id = item.user_id || e.user_id;
                            const change = item.change || 0;
                            const oldFavor = await getUserFavor(user_id);
                            await setUserFavor(user_id, oldFavor + change);
                            favorLogs.push(`用户${user_id} 好感度变化: ${oldFavor} → ${oldFavor + change}`);
                        }
                    }
                    if (favorLogs.length > 0) {
                        console.log('[好感度变更]', favorLogs.join(' | '));
                    }

                    // 拼接 message 和 code_example 字段
                    let finalReply = replyObj.message ?? '';
                    let codeText = '';

                    // 优先提取 message 里的代码块
                    const codeRegex = /```(?:[\w]*)\n*([\s\S]*?)```/g;
                    let codeBlocks = [];
                    let msgWithoutCode = finalReply;
                    let match;
                    while ((match = codeRegex.exec(finalReply)) !== null) {
                        codeBlocks.push(match[1].trim());
                    }
                    // 去除 message 里的代码块，得到纯文本
                    if (codeBlocks.length > 0) {
                        codeText = codeBlocks.join('\n\n');
                        msgWithoutCode = finalReply.replace(/```[\w]*\n*[\s\S]*?```/g, '').trim();
                    }

                    // 如果没有 message 里的代码块，再看 code_example 字段
                    if (!codeText && replyObj.code_example && replyObj.code_example.trim()) {
                        codeText = replyObj.code_example.trim();
                    }

                    // 先回复普通文本（支持@），如果有
                    if (msgWithoutCode) {
                        const remsg = await msgToAt(msgWithoutCode);
                        await e.reply(remsg, true);
                    }

                    // 再转发代码（只发代码内容），如果有
                    if (codeText) {
                        await sendCodeAsForwardMsg(e, codeText);
                    }

                    // 语音合成（如有需要）
                    if (await Config.Chat.EnableVoice) {
                        const voiceId = voiceList[await Config.Chat.VoiceIndex].voiceId;
                        const voiceUrl = `https://dds.dui.ai/runtime/v1/synthesize?voiceId=${voiceId}&text=${encodeURIComponent(finalReply)}&speed=0.8&volume=150&audioType=wav`;
                        e.reply([segment.record(voiceUrl)]);
                    }

                    // 标记对话状态为完成
                    chatActive = 0;
                } else {
                    // 如果没有获取到有效的回复，标记对话状态为未进行
                    chatActive = 0;
                    return false;
                }
            } catch (error) {
                // 捕获并处理异常，例如输出错误日志
                console.error('对话处理过程中发生错误:', error);
                e.reply('发生错误，无法进行对话。');
                chatActive = 0;
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
            chatNickname = nickname;
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
        if (VoiceIndex < voiceList.length && VoiceIndex > 0) {
            VoiceIndex = VoiceIndex - 1;
            Config.modify('duihua', 'VoiceIndex', VoiceIndex);
            let name = voiceList[VoiceIndex].name;
            e.reply("[对话发音人]:" + name);

            let voiceId = voiceList[VoiceIndex].voiceId;
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
        msg.push(`当前发音人：${(nowindex + 1)} 、${voiceList[nowindex].name}`);
        msg.push(`#止水对话设置发音人${(nowindex + 1)}`);
        let list = `*** 发音人列表 ***\n`;
        for (let i = 0; i < voiceList.length; i++) {
            let obj = voiceList[i];
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

    /** 查看对话身份（角色） */
    async ShowContext(e) {
        let currentRoleIndex = await getCurrentRoleIndex(e);
        const roleFile = path.join(Plugin_Path, 'config', 'default_config', 'RoleProfile.json');
        try {
            const data = fs.readFileSync(roleFile, 'utf8');
            const roles = JSON.parse(data);
            const found = roles[currentRoleIndex];
            if (found) {
                e.reply(JSON.stringify(found, null, 2));
            } else {
                e.reply("未找到当前角色设定，请先切换角色。");
            }
        } catch (err) {
            e.reply("读取角色设定失败：" + err.message);
        }
    }

    /** 设置对话身份（角色，仅修改当前角色） */
    async SetContext(e) {
        if (!e.isMaster) return;
        let jsonStr = e.msg.replace(/^#?设置对话身份/, '').trim();
        if (!jsonStr) {
            e.reply("请提供完整的角色JSON内容。");
            return;
        }
        try {
            const newRole = JSON.parse(jsonStr);
            const roleFile = path.join(Plugin_Path, 'config', 'default_config', 'RoleProfile.json');
            let roles = [];
            if (fs.existsSync(roleFile)) {
                roles = JSON.parse(fs.readFileSync(roleFile, 'utf8'));
            }
            let currentRoleIndex = await getCurrentRoleIndex(e);
            if (roles[currentRoleIndex]) {
                roles[currentRoleIndex] = newRole;
                fs.writeFileSync(roleFile, JSON.stringify(roles, null, 2), 'utf8');
                e.reply("当前角色身份已修改！");
            } else {
                e.reply("未找到当前角色，无法修改。");
            }
        } catch (err) {
            e.reply("角色JSON格式有误：" + err.message);
        }
    }

    /** 枚举角色列表（高亮当前群或全局角色） */
    async ShowRoleList(e) {
        const roleFile = path.join(Plugin_Path, 'config', 'default_config', 'RoleProfile.json');
        let roles = [];
        let currentRoleIndex = await getCurrentRoleIndex(e);
        try {
            const data = fs.readFileSync(roleFile, 'utf8');
            roles = JSON.parse(data).map(r => r.角色标题 || r.基础身份?.名称 || '未知角色');
        } catch (err) {
            e.reply('读取角色列表失败');
            return;
        }
        const list = roles.map((r, i) => {
            if (i === currentRoleIndex) {
                return `${i + 1}. ${r} ✅`;
            } else {
                return `${i + 1}. ${r}`;
            }
        }).join('\n');
        e.reply('可用角色列表：\n' + list);
    }

    /** 切换角色（支持群专属和全局） */
    async SwitchRole(e) {
        if (!e.isMaster) return;
        const roleArg = e.msg.replace(/^#?(止水)?(插件|对话)?切换角色/, '').trim();
        if (!roleArg) {
            e.reply('请指定要切换的角色标题或序号');
            return;
        }
        const roleFile = path.join(Plugin_Path, 'config', 'default_config', 'RoleProfile.json');
        let roles = [];
        try {
            const data = fs.readFileSync(roleFile, 'utf8');
            roles = JSON.parse(data);
        } catch (err) {
            e.reply('读取角色配置失败');
            return;
        }
        let idx = -1;
        if (/^\d+$/.test(roleArg)) {
            idx = parseInt(roleArg, 10) - 1;
        } else {
            idx = roles.findIndex(r => r.角色标题 === roleArg);
        }
        if (idx < 0 || idx >= roles.length) {
            e.reply('未找到该角色，请检查角色标题或序号是否正确');
            return;
        }

        // 判断是否群聊，优先设置群专属，否则设置全局
        if (e.group_id) {
            // 获取当前 GroupRoleIndex
            let groupRoleList = (await Config.Chat.GroupRoleIndex) || [];
            // 查找当前群是否已存在
            const existIdx = groupRoleList.findIndex(item => String(item.group) === String(e.group_id));
            if (existIdx >= 0) {
                groupRoleList[existIdx].index = idx;
            } else {
                groupRoleList.push({ group: String(e.group_id), index: idx });
            }
            // 写入配置
            await Config.modify('duihua', 'GroupRoleIndex', groupRoleList);
            e.reply(`本群已切换为角色：${roles[idx].角色标题}`);
        } else {
            await Config.modify('duihua', 'CurrentRoleIndex', idx);
            e.reply(`全局已切换为角色：${roles[idx].角色标题}`);
        }
    }

}


/**
 * 组建 system 消息
 * @returns {string} 返回组建完成的 system 消息
 */
async function mergeSystemMessage(e) {
    let merged = {};
    try {
        const sceneJson = await ReadScene();
        const sceneSetting = JSON.parse(sceneJson);
        const roleFile = path.join(Plugin_Path, 'config', 'default_config', 'RoleProfile.json');
        const roles = JSON.parse(fs.readFileSync(roleFile, 'utf8'));
        const currentRoleIndex = await getCurrentRoleIndex(e);
        // 深拷贝角色设定，避免污染原数据
        const identitySetting = JSON.parse(JSON.stringify(roles[currentRoleIndex] || {}));
        // 移除请求参数，防止污染上下文
        if ('请求参数' in identitySetting) {
            delete identitySetting['请求参数'];
        }
        // 合并所有设定
        merged = { ...identitySetting, ...sceneSetting };
    } catch (error) {
        console.error('配置解析失败:', error);
        // merged 保持空对象，后面统一兜底
    }
    // 无论是否异常，都补充基础身份和主人信息
    const { NickName, Master, MasterQQ } = await Config.Chat;
    merged.基础身份 = {
        ...(merged.基础身份 || {}),
        名称: NickName
    };
    merged.主人信息 = {
        master_name: Master,
        master_qq: MasterQQ
    };
    return merged;
}

async function openAi(msg, e) {

    const apiKey = await Config.Chat.ApiKey || '';
    const aiModel = await Config.Chat.ApiModel || 'gpt-3.5-turbo';
    const apiUrl = await Config.Chat.ApiUrl || 'https://api.openai.com/v1/chat/completions';

    // 获取唯一会话ID（群聊用 group_id，私聊用 user_id）
    const sessionId = e.group_id ? `group_${e.group_id}` : `user_${e.user_id}`;

    // 读取上下文
    let chatMsg = await loadChatMsg(sessionId);

    // 每次都重新生成 system 消息，确保群专属角色生效
    const systemMessage = await mergeSystemMessage(e);
    if (!Array.isArray(chatMsg) || chatMsg.length === 0) {
        chatMsg = [{ role: 'system', content: JSON.stringify(systemMessage) }];
    } else {
        if (chatMsg[0].role === 'system') {
            chatMsg[0] = { role: 'system', content: JSON.stringify(systemMessage) };
        } else {
            chatMsg.unshift({ role: 'system', content: JSON.stringify(systemMessage) });
        }
    }

    /** 添加新消息 */
    async function addMessage(newMessage) {
        chatMsg.push(newMessage);
        const MaxHistory = await Config.Chat.MaxHistory;
        while (chatMsg.length > MaxHistory + 1) { // +1 保留 system 消消息
            chatMsg.splice(1, 1);
        }
        // 保存到文件
        await saveChatMsg(sessionId, chatMsg);
    }

    await addMessage({ role: 'user', content: msg });

    // 新增DeepSeek请求头
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
    };

    // 获取当前角色配置
    const roleFile = path.join(Plugin_Path, 'config', 'default_config', 'RoleProfile.json');
    const roles = JSON.parse(fs.readFileSync(roleFile, 'utf8'));
    const currentRoleIndex = await getCurrentRoleIndex(e);
    const identitySetting = roles[currentRoleIndex] || {};
    const apiParams = identitySetting.请求参数 || {};

    // 构建请求数据，优先用角色请求参数，没有则用全局默认
    const requestData = {
        model: aiModel,
        messages: chatMsg,
        temperature: apiParams.temperature ?? 0.7,
        top_p: apiParams.top_p ?? 0.8,
        max_tokens: apiParams.max_tokens ?? 2048,
        presence_penalty: apiParams.presence_penalty ?? 0,
        frequency_penalty: apiParams.frequency_penalty ?? 0.5,
        top_k: apiParams.top_k ?? 50,
        response_format: { type: 'json_object' },
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
            let text = await response.text();
            console.error(`响应内容：${text}`);

            let errorData;
            try {
                errorData = JSON.parse(text);
            } catch {
                errorData = { error: { message: text, code: response.status } };
            }
            return parseErrorMessage(errorData);
        }

        // 尝试解析 JSON 响应
        try {
            const responseData = await response.json();
            let rawContent = responseData.choices[0].message.content.trim();
            // 移除推理过程保留最终结论
            content = await Config.Chat.ShowReasoning ? rawContent : rawContent.replace(/(（\u63a8\u7406\u8fc7\u7a0b[：:][\s\S]*?）|\u63a8\u7406\u8fc7\u7a0b[：:][\s\S]*?)(?=\n\u7ed3\u8bba|\u7b54\u6848|$)/gi, '');

            // 添加历史消息和AI回复
            await addMessage({ role: 'assistant', content });

        } catch (parseError) {
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
 * 读场景设定
 */
async function ReadScene() {
    try {
        const fileName = 'SystemConfig.json'; // 修正
        const userConfigPath = path.join(Plugin_Path, 'config', 'config', fileName);
        const defaultConfigPath = path.join(Plugin_Path, 'config', 'default_config', fileName);

        const [userScene, defaultScene] = await Promise.all([
            fs.promises.readFile(userConfigPath, 'utf8').catch(() => ''),
            fs.promises.readFile(defaultConfigPath, 'utf8').catch(() => ''),
        ]);
        return userScene || defaultScene;
    } catch (error) {
        console.error('读取场景配置文件时发生错误:', error);
        return '';
    }
}

/**
 * 写场景设定
 */
async function WriteScene(Context) {
    try {
        const sceneFilePath = path.join(Plugin_Path, 'config', 'config', 'SystemConfig.json');
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
async function getUserFavor(userId) {
    let user = {};
    const dataPath = path.join(Plugin_Path, 'resources', 'data', 'user');
    const fileName = `${userId}.json`;
    if (fs.existsSync(path.join(dataPath, fileName))) {
        user = await Data.readJSON(fileName, dataPath);
    }
    return parseInt(user.favor) || 0;
}

/**
 * 设置好感度
 */
async function setUserFavor(userId, favor = 0) {
    let user = { favor: parseInt(favor) || 0 };
    const dataPath = path.join(Plugin_Path, 'resources', 'data', 'user');
    const fileName = `${userId}.json`;
    return Data.writeJSON(fileName, user, dataPath);
}

/**
 * 将msg中的号码转成@
 */
async function msgToAt(msg) {
    let arr = msg.toString()
        .split(/(\[@\d+\])/)
        .filter(Boolean)
        .map((s) => s.startsWith('[@') ? segment.at(parseInt(s.match(/\d+/)[0])) : s);
    return arr;
}

/**
 * 读场景设定
 */
async function readSystemConfig() {
    try {
        const fileName = 'SystemConfig.json';
        const userConfigPath = path.join(Plugin_Path, 'config', 'config', fileName);
        const defaultConfigPath = path.join(Plugin_Path, 'config', 'default_config', fileName);

        const [userScene, defaultScene] = await Promise.all([
            fs.promises.readFile(userConfigPath, 'utf8').catch(() => ''),
            fs.promises.readFile(defaultConfigPath, 'utf8').catch(() => ''),
        ]);
        return userScene || defaultScene;
    } catch (error) {
        console.error('读取场景配置文件时发生错误:', error);
        return '';
    }
}

/**
 * 写场景设定
 */
async function writeSystemConfig(configContent) {
    try {
        const sceneFilePath = path.join(Plugin_Path, 'config', 'config', 'SystemConfig.json');
        await fs.promises.writeFile(sceneFilePath, configContent, 'utf8');
        console.log('场景配置已成功保存。');
    } catch (error) {
        console.error('写入场景配置文件时发生错误:', error);
        return false;
    }
    return true;
}

/**
 * 写主人设定
 */
async function writeMasterInfo(masterName, masterQQ) {
    Config.modify('duihua', 'Master', masterName);
    Config.modify('duihua', 'MasterQQ', masterQQ);
}

/**
 * 获取当前会话应使用的角色索引
 * @param {object} e - 事件对象
 * @returns {number} 角色索引
 */
async function getCurrentRoleIndex(e) {
    const groupRoleList = (await Config.Chat.GroupRoleIndex) || [];
    const groupId = e && e.group_id ? String(e.group_id) : null;
    if (groupId && Array.isArray(groupRoleList)) {
        const found = groupRoleList.find(item => String(item.group) === groupId);
        if (found && typeof found.index === 'number') {
            return found.index;
        }
    }
    // 默认全局角色索引
    return parseInt(await Config.Chat.CurrentRoleIndex) || 0;
}

/**
 * 获取 KeyvFile 实例（每群/私聊一个文件）
 * @param {string} sessionId
 * @returns {KeyvFile}
 */
function getSessionKeyv(sessionId) {
    let file;
    if (sessionId.startsWith('group_')) {
        file = path.join(CHAT_CONTEXT_PATH, `${sessionId}.json`);
    } else {
        file = path.join(CHAT_CONTEXT_PATH, `private.json`);
    }
    return new KeyvFile({ filename: file });
}

/**
 * 加载聊天上下文
 * @param {string} sessionId
 * @returns {Promise<Array>}
 */
async function loadChatMsg(sessionId) {
    const keyv = getSessionKeyv(sessionId);
    return (await keyv.get('chatMsg')) || [];
}

/**
 * 保存聊天上下文
 * @param {string} sessionId
 * @param {Array} chatMsg
 * @returns {Promise<void>}
 */
async function saveChatMsg(sessionId, chatMsg) {
    const keyv = getSessionKeyv(sessionId);
    await keyv.set('chatMsg', chatMsg);
}

/**
 * 整理并通过转发消息发送代码内容，只发送代码部分
 * @param {object} e - 事件对象
 * @param {string} codeText - 包含代码的文本（可含多余说明）
 */
async function sendCodeAsForwardMsg(e, codeText) {
    // 提取所有代码块（支持 ```、```js、```javascript 等）
    const codeBlocks = [];
    const codeRegex = /```(?:[\w]*)\n*([\s\S]*?)```/g;
    let match;
    while ((match = codeRegex.exec(codeText)) !== null) {
        codeBlocks.push(match[1].trim());
    }
    // 如果没有代码块，则整体作为代码
    let codeList = codeBlocks.length > 0 ? codeBlocks : [codeText.trim()];
    // 过滤掉空内容
    codeList = codeList.filter(Boolean);
    if (codeList.length === 0) {
        e.reply('未检测到可发送的代码内容。');
        return;
    }
    await ForwardMsg(e, codeList);
}