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

/** 工作状态（每群/私聊独立） */
let chatActiveMap = {};

/** 最后请求时间记录（防止429错误） */
let lastRequestTime = {};

/** 消息计数器 */
let chatMessageCounter = 0;

/** 最小请求间隔（毫秒），防止429错误 */
const MIN_REQUEST_INTERVAL = 2000; // 2秒间隔

/** 不同API类型的请求间隔配置 */
const API_INTERVALS = {
    'openai': 1000,    // OpenAI系列 1秒
    'gemini': 2000,    // Gemini 2秒
    'siliconflow': 1500, // 硅基流动 1.5秒
    'tencent': 1000,   // 腾讯元器 1秒
    'default': 2000    // 默认 2秒
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
                    reg: '^#?(止水)?(插件|对话)?查看(好感|亲密)度$',
                    fnc: 'ShowFavor'
                }, {
                    reg: `^#?(止水)?(插件|对话)?设置(好感|亲密)度(.*)$`,
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
                    reg: `^#?(止水)?(插件|对话)?设置(对话)?(API|api)(.*)$`,
                    fnc: 'SetApi'
                }, {
                    reg: `^#?(止水)?(插件|对话)?切换(对话)?(API|api)(.*)$`,
                    fnc: 'SwitchApi'
                }, {
                    reg: `^#?(止水)?(插件|对话)?查看(对话)?(API|api)$`,
                    fnc: 'ShowApi'
                }, {
                    reg: `^#?(止水)?(插件|对话)?测试(.*)$`,
                    fnc: 'taklTest'
                }, {
                    reg: '^#?(止水)?(插件|对话)?角色列表$',
                    fnc: 'ShowRoleList'
                }, {
                    reg: '^#?(止水)?(插件|对话)?切换(对话)?角色(.+)$',
                    fnc: 'SwitchRole'
                }, {
                    reg: '^#?(止水)?(插件|对话)?添加(对话)?角色(.*)',
                    fnc: 'AddRole'
                }, {
                    reg: '^#?(止水)?私聊回复(开启|关闭)$',
                    fnc: 'SetPrivateChatEnable'
                }, {
                    reg: `^#?(止水)?(插件|对话)?查看对话(历史)?$`,
                    fnc: 'ShowChatHistory'
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
        // 获取当前会话ID
        const sessionId = e.group_id ? `group_${e.group_id}` : `user_${e.user_id}`;
        chatActiveMap[sessionId] = 0;

        // 同时清除请求时间记录，允许立即请求
        if (lastRequestTime[sessionId]) {
            delete lastRequestTime[sessionId];
        }

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
            // 清空所有会话的活跃状态
            chatActiveMap = {};
            // 清空所有请求时间记录
            lastRequestTime = {};
            e.reply('已清除全部对话缓存！');
            return;
        }

        // 删除对应上下文缓存
        const keyv = getSessionKeyv(sessionId);
        await keyv.delete('chatMsg');

        e.reply('已经重置对话了！');
        return;
    };

    /** 对话 */
    async duihua(e) {
        // 获取当前会话ID
        const sessionId = e.group_id ? `group_${e.group_id}` : `user_${e.user_id}`;
        let msg = e.msg;
        function escapeRegExp(str) {
            return str.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
        }
        let nickname = await Config.Chat.NickName;
        let regex = new RegExp(`^#?${escapeRegExp(nickname)}`); // 只允许开头
        const isPrivate = !e.group_id;
        const enablePrivate = await Config.Chat.EnablePrivateChat;

        // 详细触发追踪
        let triggerDetail = '';
        let triggered = false;
        // 私聊逻辑
        if (isPrivate) {
            if (enablePrivate || regex.test(msg)) {
                triggered = true;
                if (regex.test(msg)) {
                    triggerDetail = '';
                } else {
                    triggerDetail = '';
                }
            } else {
                chatActiveMap[sessionId] = 0;
                return false;
            }
        } else {
            const isAtBot = e.atBot && await Config.Chat.EnableAt;
            const isNicknameMatch = regex.test(msg);
            if (!isAtBot && !isNicknameMatch) {
                chatActiveMap[sessionId] = 0;
                return false;
            } else {
                triggered = true;
                if (isAtBot) {
                    // 追踪被谁艾特
                    let atWho = '';
                    if (Array.isArray(e.message)) {
                        for (const seg of e.message) {
                            if (seg.type === 'at' && seg.qq) {
                                atWho = seg.qq;
                                break;
                            }
                        }
                    }
                    triggerDetail = '';
                } else if (isNicknameMatch) {
                    triggerDetail = '';
                }
            }
        }
        if (!triggered) {
            chatActiveMap[sessionId] = 0;
            return false;
        }
        // 只有真正触发后再判断是否有请求在处理中
        if (chatActiveMap[sessionId] === 1) {
            if (e.group_id) {
                await e.reply([segment.at(e.user_id), '稍等哦，正在处理上一个请求~'], true);
            } else {
                await e.reply('稍等哦，正在处理上一个请求~');
            }
            return;
        }
        chatActiveMap[sessionId] = 1;

        // 检查请求间隔，防止429错误
        const now = Date.now();
        const lastTime = lastRequestTime[sessionId] || 0;

        // 获取当前API类型以确定间隔时间
        const ApiList = await Config.Chat.ApiList || [];
        const CurrentApiIndex = typeof (await Config.Chat.CurrentApiIndex) === 'number'
            ? await Config.Chat.CurrentApiIndex
            : parseInt(await Config.Chat.CurrentApiIndex) || 0;
        const apiConfig = ApiList[CurrentApiIndex] || ApiList[0] || {};
        const apiType = apiConfig.ApiType || 'default';
        const requiredInterval = API_INTERVALS[apiType] || API_INTERVALS['default'];

        const timeDiff = now - lastTime;

        if (timeDiff < requiredInterval) {
            const waitTime = requiredInterval - timeDiff;
            chatActiveMap[sessionId] = 0;
            const waitSeconds = Math.ceil(waitTime / 1000);
            await e.reply(`请稍等 ${waitSeconds} 秒后再试，避免请求过于频繁~`);
            return;
        }

        // 记录本次请求时间
        lastRequestTime[sessionId] = now;

        // 只有对话机制被触发后，才检测图片和文件
        let images = [];
        let files = [];
        if (Array.isArray(e.message)) {
            for (const seg of e.message) {
                if (seg.type === 'image' && seg.url) {
                    images.push(seg.url);
                }
                if (seg.type === 'file' && seg.file) {
                    files.push(seg.file); // file对象结构可根据实际平台调整
                }
            }
        }
        if (images.length > 0) {
            console.log(`[止水对话] 检测到图片:`, images);
        }
        if (files.length > 0) {
            console.log(`[止水对话] 检测到文件:`, files);
        }

        try {
            // 提取用户消息内容，并去除对话昵称前缀
            msg = msg.replace(/^#?${chatNickname}\s*/, '').trim();
            msg = msg.replace(/{at:/g, '{@');

            const Favora = await getUserFavor(e.user_id);
            const userMessage = {
                message: msg,
                images: images,
                files: files,
                additional_info: {
                    name: e.sender.nickname,
                    user_id: e.user_id,
                    favor: Favora,
                    group_id: e.group_id || 0
                }
            };

            console.log(`[止水对话] -> 用户[${e.user_id}]说: ${msg}`);

            const MessageText = JSON.stringify(userMessage);
            // 新增：获取 systemMessage 和历史上下文
            const systemMessage = await mergeSystemMessage(e);
            const chatMsg = await loadChatMsg(sessionId);

            let response;
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount <= maxRetries) {
                try {
                    response = await openAi(MessageText, e, systemMessage, chatMsg);
                    break; // 成功则退出循环
                } catch (apiError) {
                    console.error(`[止水对话] API调用失败 (重试${retryCount}/${maxRetries}):`, apiError.message);

                    // 根据错误类型决定是否重试
                    if (apiError.message.includes('请求过于频繁') && retryCount < maxRetries) {
                        retryCount++;
                        const waitTime = Math.min(3000 * retryCount, 12000); // 3秒、6秒、9秒，最多12秒
                        console.log(`[止水对话] 请求频繁，等待 ${waitTime / 1000} 秒后重试 (${retryCount}/${maxRetries})`);

                        // 告知用户正在重试
                        if (retryCount === 1) {
                            await e.reply(`请求繁忙，正在自动重试中，请稍等...`);
                        }

                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue;
                    } else if (apiError.shouldRetry && (apiError.type === '连接超时' || apiError.type === '连接重置') && retryCount < maxRetries) {
                        // 网络相关的可重试错误
                        retryCount++;
                        const waitTime = 2000 * retryCount; // 2秒、4秒、6秒
                        console.log(`[止水对话] ${apiError.type}，等待 ${waitTime / 1000} 秒后重试 (${retryCount}/${maxRetries})`);

                        if (retryCount === 1) {
                            await e.reply(`网络不稳定，正在重试连接...`);
                        }

                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue;
                    } else {
                        // 不可重试的错误或重试次数用完
                        chatActiveMap[sessionId] = 0;

                        // 根据错误类型提供不同的用户提示
                        let userMessage = apiError.message;
                        if (apiError.type === 'API密钥错误') {
                            userMessage = `API配置有误，请联系管理员检查API密钥设置\n当前使用API: ${apiError.apiType || 'unknown'}`;
                        } else if (apiError.type === '地区限制') {
                            userMessage = `${apiError.message}\n建议使用命令切换到其他API，如：#切换对话api1`;
                        } else if (apiError.type === 'DNS解析失败' || apiError.type === '连接被拒绝') {
                            userMessage = `${apiError.message}\n建议使用命令切换到其他API，如：#切换对话api1`;
                        } else if (apiError.type === 'API配额不足') {
                            userMessage = `${apiError.message}\n建议使用命令切换到其他API，如：#切换对话api1`;
                        }

                        await e.reply(userMessage);
                        return false;
                    }
                }
            }

            // 如果重试次数用完仍未成功
            if (!response && retryCount > maxRetries) {
                chatActiveMap[sessionId] = 0;
                await e.reply('服务器繁忙，请稍后再试');
                return false;
            }

            if (response) {
                // 严格JSON格式校验
                let replyObj;
                try {
                    console.log(`[止水对话] 收到原始回复: ${response.substring(0, 200)}...`);
                    replyObj = JSON.parse(response); // 这里用 response
                    console.log(`[止水对话] JSON解析成功，消息内容: ${replyObj.message?.substring(0, 50)}...`);
                    console.log(`[止水对话] 解析后的对象类型: ${typeof replyObj}, 是否有message: ${!!replyObj.message}`);
                    if (typeof replyObj !== 'object' || !replyObj.message) {
                        console.log(`[止水对话] JSON对象无效，使用原始回复`);
                        replyObj = {
                            message: response,
                            favor_changes: []
                        };
                    }
                } catch (error) {
                    console.log(`[止水对话] JSON解析失败: ${error.message}，使用原始回复`);
                    console.log(`[止水对话] <- AI回复: ${response.substring(0, 50)}...`);
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
                        const change = Number(item.change);
                        if (isNaN(change)) continue; // 跳过无效变更
                        const oldFavor = await getUserFavor(user_id);
                        const newFavor = Math.max(-100, oldFavor + change); // 最小-100
                        await setUserFavor(user_id, newFavor);
                        favorLogs.push(`用户${user_id} 好感度变化: ${oldFavor} → ${newFavor} (变更: ${change})`);
                    }
                }
                if (favorLogs.length > 0) {
                    console.log('[好感度变更]', favorLogs.join(' | '));
                }

                // 拼接 message 和 code_example 字段
                let finalReply = replyObj.message ?? '';
                console.log(`[止水对话] 最终回复内容: ${finalReply.substring(0, 100)}...`);
                console.log(`[止水对话] 回复对象结构:`, JSON.stringify(replyObj, null, 2).substring(0, 300));
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
                    // 如果AI回复内容是JSON字符串，则再次解析，提取message字段
                    let finalMsg = msgWithoutCode;
                    if (finalMsg.trim().startsWith('{') && finalMsg.trim().endsWith('}')) {
                        try {
                            const jsonObj = JSON.parse(finalMsg);
                            if (jsonObj.message) {
                                finalMsg = jsonObj.message;
                            }
                        } catch (e) {
                            // 解析失败则原样回复
                        }
                    }
                    const remsg = await msgToAt(finalMsg);
                    await e.reply(remsg, true);
                } else {
                    console.log(`[止水对话] 消息为空，不发送`);
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
                chatActiveMap[sessionId] = 0;
            } else {
                // 如果没有获取到有效的回复或请求失败，返回错误信息并重置状态
                chatActiveMap[sessionId] = 0;
                if (response) {
                    // 如果有错误信息，回复给用户
                    await e.reply(response);
                } else {
                    await e.reply('抱歉，AI暂时无法回复，请稍后再试。');
                }
                return false;
            }
        } catch (error) {
            // 捕获并处理异常，例如输出错误日志
            console.error('对话处理过程中发生错误:', error);
            chatActiveMap[sessionId] = 0;
            await e.reply('发生错误，无法进行对话。请稍后再试。');
            return false;
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

    /** 查看用户好感度 */
    async ShowFavor(e) {
        let isAdmin = e.isMaster || e.isAdmin;
        let atUser = null;

        if (e.at && e.at.length > 0) {
            atUser = e.at[0];
        }
        let targetId = atUser || e.user_id;

        // 权限判断
        if (atUser && !isAdmin) {
            e.reply('只有主人或管理员可以查看他人好感度。');
            return;
        }

        const favor = await getUserFavor(targetId);
        if (atUser) {
            e.reply(`用户 [${atUser}] 的好感度为：${favor}`);
        } else {
            e.reply(`你的好感度为：${favor}`);
        }
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
                await clearSessionContext(e);
                e.reply("当前角色身份已修改！\n已自动清除上下文缓存，请重新开始对话。");
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
        const sessionId = e.group_id ? `group_${e.group_id}` : `user_${e.user_id}`;
        const ApiList = await Config.Chat.ApiList || [];
        const apiIndex = typeof (await Config.Chat.CurrentApiIndex) === 'number'
            ? await Config.Chat.CurrentApiIndex
            : parseInt(await Config.Chat.CurrentApiIndex) || 0;
        const api = ApiList[apiIndex] || {};
        const model = (api.ApiModel || '').toLowerCase();
        const type = (api.ApiType || '').toLowerCase();
        let lost = false;
        let chatMsg = await loadChatMsg(sessionId);
        if (Array.isArray(chatMsg) && chatMsg.length > 0) {
            const { converted, lostContent } = convertChatContextForModel(chatMsg, type, type, model, model);
            await saveChatMsg(sessionId, converted);
            if (lostContent) lost = true;
        }
        await clearSessionContext(e); // 兜底清理
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
            let tip = `本群已切换为角色：${roles[idx].角色标题}`;
            if (lost) tip += `\n注意：因模型/接口格式不兼容，历史上下文已被简化或部分丢失。建议重新开始对话。`;
            else tip += `\n已自动清除上下文缓存，请重新开始对话。`;
            e.reply(tip);
        } else {
            await Config.modify('duihua', 'CurrentRoleIndex', idx);
            let tip = `全局已切换为角色：${roles[idx].角色标题}`;
            if (lost) tip += `\n注意：因模型/接口格式不兼容，历史上下文已被简化或部分丢失。建议重新开始对话。`;
            else tip += `\n已自动清除上下文缓存，请重新开始对话。`;
            e.reply(tip);
        }
    }

    /** 设置API（支持切换API序号） */
    async SetApi(e) {
        if (!e.isMaster) {
            e.reply('只有主人可以设置API。');
            return;
        }

        // 检查敏感参数，禁止群内设置
        if (e.group_id && sensitiveFields.includes(field)) {
            e.reply('该参数（如密钥、助手ID）只能在私聊中设置，请私聊机器人操作。');
            return;
        }

        // 匹配如 #设置API类型 openai
        const match = e.msg.match(/^#?设置API(类型|地址|密钥|模型|助手ID)\s+(.+)$/i);
        if (!match) {
            e.reply('格式错误，请用如 #设置API类型 openai');
            return;
        }
        const keyMap = {
            '类型': 'ApiType',
            '地址': 'ApiUrl',
            '密钥': 'ApiKey',
            '模型': 'ApiModel',
            '助手ID': 'TencentAssistantId'
        };
        const sensitiveFields = ['ApiKey', 'TencentAssistantId'];
        const field = keyMap[match[1]];
        const value = match[2].trim();
        const ApiList = await Config.Chat.ApiList || [];
        let idx = typeof (await Config.Chat.CurrentApiIndex) === 'number'
            ? await Config.Chat.CurrentApiIndex
            : parseInt(await Config.Chat.CurrentApiIndex) || 0;

        // 判断是否群专属API
        if (e.group_id && Array.isArray(await Config.Chat.GroupRoleIndex)) {
            const groupRoleList = await Config.Chat.GroupRoleIndex;
            const found = groupRoleList.find(item => String(item.group) === String(e.group_id));
            if (found && typeof found.apiIndex === 'number') {
                idx = found.apiIndex;
            }
        }

        if (idx < 0 || idx >= ApiList.length) {
            e.reply(`当前API索引无效，当前共${ApiList.length}个API`);
            return;
        }
        if (!field) {
            e.reply('不支持设置该参数');
            return;
        }
        ApiList[idx][field] = value;
        await Config.modify('duihua', 'ApiList', ApiList);
        await clearSessionContext(e);
        e.reply(`当前API的${field}已设置为：${value}\n已自动清除上下文缓存，请重新开始对话。`);
    }

    /** 切换API（支持切换API序号） */
    async SwitchApi(e) {
        if (!e.isMaster) {
            e.reply('只有主人可以切换API。');
            return;
        }
        // 解析序号
        const apiIndexStr = e.msg.replace(/^#?(止水)?(插件|对话)?切换(对话)?(API|api)/, '').trim();
        const ApiList = await Config.Chat.ApiList || [];
        let idx = parseInt(apiIndexStr, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= ApiList.length) {
            e.reply(`请输入正确的API序号（1~${ApiList.length}），如：#切换API1`);
            return;
        }
        // 获取切换前后的模型类型
        const sessionId = e.group_id ? `group_${e.group_id}` : `user_${e.user_id}`;
        const oldApiIndex = typeof (await Config.Chat.CurrentApiIndex) === 'number'
            ? await Config.Chat.CurrentApiIndex
            : parseInt(await Config.Chat.CurrentApiIndex) || 0;
        const oldApi = ApiList[oldApiIndex] || {};
        const newApi = ApiList[idx] || {};
        const oldModel = (oldApi.ApiModel || '').toLowerCase();
        const newModel = (newApi.ApiModel || '').toLowerCase();
        const oldType = (oldApi.ApiType || '').toLowerCase();
        const newType = (newApi.ApiType || '').toLowerCase();
        // 切换
        await Config.modify('duihua', 'CurrentApiIndex', idx);
        // 自动兼容上下文
        let lost = false;
        let chatMsg = await loadChatMsg(sessionId);
        if (Array.isArray(chatMsg) && chatMsg.length > 0) {
            const { converted, lostContent } = convertChatContextForModel(chatMsg, oldType, newType, oldModel, newModel);
            await saveChatMsg(sessionId, converted);
            if (lostContent) lost = true;
        }
        await clearSessionContext(e); // 兜底清理
        let tip = `已切换到API序号${idx + 1}，类型：${newApi.ApiType || '未知类型'}`;
        if (lost) tip += `\n注意：因模型/接口格式不兼容，历史上下文已被简化或部分丢失。建议重新开始对话。`;
        else tip += `\n已自动清除上下文缓存，请重新开始对话。`;
        e.reply(tip);
    }

    /** 查看API（显示当前API参数+API列表+指令引导） */
    async ShowApi(e) {
        // 群聊禁止查看API参数
        if (e.group_id) {
            e.reply('该指令只能在私聊中使用，请私聊机器人查看API参数。');
            return;
        }
        const ApiList = await Config.Chat.ApiList || [];
        if (!ApiList.length) {
            e.reply('未配置任何API。');
            return;
        }
        const currentIdx = typeof (await Config.Chat.CurrentApiIndex) === 'number'
            ? await Config.Chat.CurrentApiIndex
            : parseInt(await Config.Chat.CurrentApiIndex) || 0;

        // 判断是否群专属API
        let idx = currentIdx;
        let isGroupSpecific = false;
        if (e.group_id && Array.isArray(await Config.Chat.GroupRoleIndex)) {
            const groupRoleList = await Config.Chat.GroupRoleIndex;
            const found = groupRoleList.find(item => String(item.group) === String(e.group_id));
            if (found && typeof found.apiIndex === 'number') {
                idx = found.apiIndex;
                isGroupSpecific = true;
            }
        }

        if (idx < 0 || idx >= ApiList.length) {
            e.reply('当前API索引无效。');
            return;
        }
        const api = ApiList[idx];
        // 参数名中英文映射
        const nameMap = {
            ApiType: '类型',
            ApiUrl: '地址',
            ApiKey: '密钥',
            ApiModel: '模型',
            TencentAssistantId: '助手ID'
        };

        // 显示API类型（全局/群专属）
        const apiTypeLabel = isGroupSpecific ? '群专属API' : '全局API';
        let msg = `【当前API参数】（${apiTypeLabel}）\n${Object.entries(api).map(([k, v]) => `${nameMap[k] || k}: ${v}`).join('\n')}`;

        // 列出所有API
        msg += `\n\n【API列表】\n`;
        ApiList.forEach((item, i) => {
            msg += `${i + 1}. ${item.ApiType || '未知类型'}${i === idx ? ' ✅当前' : ''}\n`;
        });

        // 指令引导
        msg += `\n切换API：#切换API序号  例如 #切换API1\n`;
        msg += `设置当前API参数：#设置API类型/地址/密钥/模型/助手ID 值  例如 #设置API类型 openai`;

        e.reply(msg.trim());
    }

    /** 设置好感度，支持管理员@他人 */
    async SetUserFavor(e) {
        // 仅主人或管理员可设置他人
        let isAdmin = e.isMaster || e.isAdmin;
        let atUser = null;
        let favor = null;

        // 检查是否@了某人
        if (e.at && e.at.length > 0) {
            atUser = e.at[0];
        }

        // 提取好感度数值
        let match = e.msg.match(/好感度\s*(-?\d+)/);
        if (match) {
            favor = parseInt(match[1]);
        } else {
            // 兼容 #设置好感度 @某人 50
            let numMatch = e.msg.match(/(\d+)/);
            if (numMatch) favor = parseInt(numMatch[1]);
        }

        // 目标用户
        let targetId = atUser || e.user_id;

        // 权限判断
        if (atUser && !isAdmin) {
            e.reply('只有主人或管理员可以设置他人好感度。');
            return;
        }

        if (favor === null || isNaN(favor)) {
            e.reply('请指定要设置的好感度数值，例如：#设置好感度 50');
            return;
        }

        await setUserFavor(targetId, favor);
        if (atUser) {
            e.reply(`已将 [${atUser}] 的好感度设置为：${favor}`);
        } else {
            e.reply(`你的好感度已设置为：${favor}`);
        }
    }

    /** 查看场景设定（仅私聊可用） */
    async ShowChatScene(e) {
        if (e.group_id) {
            e.reply('该指令只能在私聊中使用，请私聊机器人查看场景设定。');
            return;
        }
        const sceneJson = await ReadScene();
        if (!sceneJson) {
            e.reply('未找到任何场景设定。');
            return;
        }
        try {
            const scene = JSON.parse(sceneJson);
            let msg = '【当前场景设定】\n' + Object.entries(scene).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n');
            e.reply(msg);
        } catch {
            e.reply('场景设定数据格式有误。');
        }
    }

    /** 设置场景设定（仅私聊可用） */
    async SetChatScene(e) {
        if (e.group_id) {
            e.reply('该指令只能在私聊中使用，请私聊机器人设置场景。');
            return;
        }
        // 取指令后的内容
        let jsonStr = e.msg.replace(/^#?(止水)?(插件|对话)?设置(对话)?场景/, '').trim();
        if (!jsonStr) {
            e.reply('请提供完整的场景JSON内容。例如：#设置场景 {"key":"value"}');
            return;
        }
        try {
            JSON.parse(jsonStr); // 校验格式
            await WriteScene(jsonStr);
            e.reply('场景设定已成功保存！');
        } catch (err) {
            e.reply('场景JSON格式有误：' + err.message);
        }
    }

    /** 私聊AI回复开关 */
    async SetPrivateChatEnable(e) {
        if (!e.isMaster) {
            e.reply('只有主人可以设置私聊AI回复开关。');
            return false;
        }
        let enable = e.msg.includes('开启');
        await Config.modify('duihua', 'EnablePrivateChat', enable);
        e.reply(`[止水私聊AI回复]已${enable ? '开启' : '关闭'}！`);
        return true;
    }

    /**
     * 查看对话历史
     * @param {Object} e 事件对象
     * @returns {Promise<void>}
     */
    async ShowChatHistory(e) {
        try {
            const sessionId = e.group_id ? `group_${e.group_id}` : `user_${e.user_id}`;
            const keyv = getSessionKeyv(sessionId);
            const history = await keyv.get('chatMsg');

            if (!history || !Array.isArray(history) || history.length === 0) {
                e.reply('暂无对话历史记录');
                return;
            }

            let historyMsg = ['*** 对话历史记录 ***'];
            history.forEach((item, index) => {
                // 处理对象和字符串两种情况
                let message = typeof item === 'object' ?
                    (item.message || JSON.stringify(item)) :
                    item;

                if (message) {
                    historyMsg.push(`${index + 1}. ${message}`);
                }
            });

            if (historyMsg.length <= 1) {
                e.reply('暂无有效的对话历史记录');
                return;
            }

            common.getforwardMsg(e, historyMsg, {
                isxml: true,
                xmlTitle: '对话历史记录',
            });
        } catch (err) {
            console.error('查看对话历史出错:', err);
            e.reply('获取对话历史失败: ' + err.message);
        }
    }

}


/**
 * 组建 system 消息
 * @param {object} e - 用户对象，包含用户ID等信息
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
    // 无论是否异常，都补充基础身份、主人信息和用户信息
    const { NickName, Master, MasterQQ } = await Config.Chat;
    // 获取用户好感度
    const userFavor = await getUserFavor(e.user_id);
    merged.基础身份 = {
        ...(merged.基础身份 || {}),
        名称: NickName
    };
    merged.主人信息 = {
        master_name: Master,
        master_qq: MasterQQ
    };
    // 添加用户信息
    merged.用户信息 = {
        user_id: e.user_id,
        favor: userFavor
    };
    return merged;
}

async function openAi(msg, e, systemMessage, chatMsg) {
    // 1. 获取 ApiList、CurrentApiIndex、GroupRoleIndex
    const ApiList = await Config.Chat.ApiList || [];
    const CurrentApiIndex = typeof (await Config.Chat.CurrentApiIndex) === 'number'
        ? await Config.Chat.CurrentApiIndex
        : parseInt(await Config.Chat.CurrentApiIndex) || 0;
    const GroupRoleIndex = await Config.Chat.GroupRoleIndex || [];

    // 2. 判断是否有群专属API
    let apiIndex = CurrentApiIndex;
    if (e.group_id && Array.isArray(GroupRoleIndex)) {
        const found = GroupRoleIndex.find(item => String(item.group) === String(e.group_id));
        if (found && typeof found.apiIndex === 'number') {
            apiIndex = found.apiIndex;
        }
    }

    // 3. 获取当前要用的API配置
    const apiConfig = ApiList[apiIndex] || ApiList[0] || {};

    // 4. 取出各项参数
    const apiType = apiConfig.ApiType || 'siliconflow';
    const apiKey = apiConfig.ApiKey || '';
    const aiModel = apiConfig.ApiModel || 'gpt-3.5-turbo';
    const apiUrl = apiConfig.ApiUrl || '';
    const tencentAssistantId = apiConfig.TencentAssistantId || '';

    // 针对硅基流动Qwen/Qwen2.5-VL-72B-Instruct模型的特殊处理
    const isQwenVL = (aiModel || '').toLowerCase().includes('qwen') || (aiModel || '').toLowerCase().includes('vl-72b');

    // 1. 先构建 headers
    let headers;
    if (apiType === 'tencent') {
        headers = {
            'X-Source': 'openapi',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        };
    } else if (apiType === 'gemini') {
        headers = {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
        };
    } else {
        headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        };
    }

    // 2. 构建请求参数（不含 messages）
    let requestData;
    if (apiType === 'tencent') {
        // 腾讯元器API - 根据官方文档构建请求参数
        let messages = [];

        // 系统消息处理：腾讯元器不支持system角色，需要融入到用户消息中
        let systemPrompt = '';
        try {
            systemPrompt = typeof systemMessage === 'string' ? systemMessage : JSON.stringify(systemMessage);
        } catch {
            systemPrompt = '';
        }

        // 处理历史消息：确保user与assistant交替
        if (Array.isArray(chatMsg) && chatMsg.length > 0) {
            let lastRole = '';
            for (const item of chatMsg) {
                if (!item || !item.role || !item.content) continue;
                // 确保交替对话格式
                if (item.role === 'user' && lastRole !== 'user') {
                    messages.push({ role: 'user', content: item.content });
                    lastRole = 'user';
                } else if (item.role === 'assistant' && lastRole === 'user') {
                    messages.push({ role: 'assistant', content: item.content });
                    lastRole = 'assistant';
                }
            }
        }

        // 处理当前用户消息
        let userMsg = msg;
        try {
            let msgObj = JSON.parse(msg);
            userMsg = msgObj.message || msg;
        } catch (err) {
            // msg 不是 JSON，直接使用
        }

        // 如果是第一条消息，将系统设定简化后融入用户消息
        if (messages.length === 0 || messages[messages.length - 1].role !== 'assistant') {
            if (systemPrompt && messages.length === 0) {
                // 简化系统提示，避免过长
                let simplifiedPrompt = "你是小七，一个可爱的AI助手。请用温柔可爱的语气回答问题。";
                try {
                    const systemObj = JSON.parse(systemPrompt);
                    if (systemObj.基础身份?.名称) {
                        simplifiedPrompt = `你是${systemObj.基础身份.名称}，请用可爱的语气回答问题。`;
                    }
                } catch (e) {
                    // 使用默认简化提示
                }
                userMsg = `${simplifiedPrompt}\n\n${userMsg}`;
            }
            messages.push({ role: 'user', content: userMsg });
        }

        // 确保消息数组不为空且格式正确
        if (messages.length === 0) {
            messages.push({ role: 'user', content: userMsg });
        }

        // 确定用户ID：使用真实QQ号，如果无效则使用主人QQ号
        let userId = e.user_id;
        if (!userId || isNaN(userId) || String(userId).length < 5) {
            const masterQQ = await Config.Chat.MasterQQ;
            userId = masterQQ || "172679743";
        }

        requestData = {
            assistant_id: tencentAssistantId,
            user_id: String(userId),
            stream: false,
            messages: messages
        };
    } else if (apiType === 'gemini') {
        // Gemini 需要 contents: [{role:..., parts:...}, ...]
        // 1. 组装历史上下文（含 system prompt）
        let contents = [];
        // system prompt
        let systemPrompt = '';
        try {
            systemPrompt = typeof systemMessage === 'string' ? systemMessage : JSON.stringify(systemMessage);
        } catch {
            systemPrompt = '';
        }
        contents.push({ role: 'model', parts: [{ text: systemPrompt }] });
        // 2. 拼接历史 user/assistant 消息，assistant 需转为 model
        if (Array.isArray(chatMsg)) {
            for (const item of chatMsg) {
                if (!item || !item.role || !item.content) continue;
                if (item.role === 'user') {
                    contents.push({ role: 'user', parts: [{ text: item.content }] });
                } else if (item.role === 'assistant') {
                    contents.push({ role: 'model', parts: [{ text: item.content }] });
                }
            }
        }
        // 3. 当前用户消息（带图片）
        let parts = [];
        let failedImages = [];
        let userMsg = msg;
        try {
            let msgObj = JSON.parse(msg);
            userMsg = msgObj.message || msg;
            parts.push({ text: userMsg });
            if (Array.isArray(msgObj.images) && msgObj.images.length > 0) {
                for (const imgUrl of msgObj.images) {
                    try {
                        const res = await fetch(imgUrl);
                        const arrayBuffer = await res.arrayBuffer();
                        const base64 = Buffer.from(arrayBuffer).toString('base64');
                        let mime = 'image/jpeg';
                        if (imgUrl.endsWith('.png')) mime = 'image/png';
                        if (imgUrl.endsWith('.webp')) mime = 'image/webp';
                        if (imgUrl.endsWith('.gif')) mime = 'image/gif';
                        parts.push({ inline_data: { data: base64, mime_type: mime } });
                    } catch (err) {
                        failedImages.push(imgUrl);
                    }
                }
            }
        } catch (err) {
            parts.push({ text: msg });
        }
        if (failedImages.length > 0 && typeof e.reply === 'function') {
            await e.reply(`部分图片下载失败，未提交给AI：\n` + failedImages.join('\n'));
        }
        contents.push({ role: 'user', parts });

        // 构建基础请求数据
        requestData = { contents };

        // 只有在使用支持搜索的模型时才添加搜索工具
        // Gemini 1.5 系列（包括 pro 和 flash）都支持 grounding
        const supportsGrounding = (aiModel || '').toLowerCase().includes('gemini-1.5') ||
            (apiUrl || '').includes('gemini-1.5');

        if (supportsGrounding) {
            requestData.tools = [{
                googleSearchRetrieval: {
                    dynamicRetrievalConfig: {
                        mode: "MODE_DYNAMIC",
                        dynamicThreshold: 0.7
                    }
                }
            }];
        }
    } else if (isQwenVL) {
        // Qwen/Qwen2.5-VL-72B-Instruct多模态支持
        let msgObj;
        let userMsg = msg;
        let images = [];
        try {
            msgObj = JSON.parse(msg);
            userMsg = msgObj.message || msg;
            if (Array.isArray(msgObj.images) && msgObj.images.length > 0) {
                for (const imgUrl of msgObj.images) {
                    try {
                        const res = await fetch(imgUrl);
                        const arrayBuffer = await res.arrayBuffer();
                        const base64 = Buffer.from(arrayBuffer).toString('base64');
                        let mime = 'image/jpeg';
                        if (imgUrl.endsWith('.png')) mime = 'image/png';
                        if (imgUrl.endsWith('.webp')) mime = 'image/webp';
                        if (imgUrl.endsWith('.gif')) mime = 'image/gif';
                        images.push({ type: 'image_url', image: { url: `data:${mime};base64,${base64}` } });
                    } catch (err) {
                        // 图片下载失败
                    }
                }
            }
        } catch (err) {
            // msg 不是 JSON
        }
        // Qwen多模态格式：messages支持插入图片对象
        requestData = {
            model: aiModel,
            messages: [
                { role: 'system', content: JSON.stringify(systemMessage) },
                ...(images.length > 0 ? [{ role: 'user', content: userMsg, images }] : [{ role: 'user', content: userMsg }])
            ]
        };
    } else {
        // 其他API（如OpenAI、SiliconFlow等）
        // 构建标准的 OpenAI 格式消息
        let messages = [];

        // 添加 system 消息
        let systemPrompt = '';
        try {
            systemPrompt = typeof systemMessage === 'string' ? systemMessage : JSON.stringify(systemMessage);
        } catch {
            systemPrompt = '';
        }
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }

        // 添加历史消息
        if (Array.isArray(chatMsg)) {
            for (const item of chatMsg) {
                if (!item || !item.role || !item.content) continue;
                if (item.role === 'user' || item.role === 'assistant') {
                    messages.push({ role: item.role, content: item.content });
                }
            }
        }

        // 添加当前用户消息
        let userMsg = msg;
        try {
            let msgObj = JSON.parse(msg);
            userMsg = msgObj.message || msg;
        } catch (err) {
            // msg 不是 JSON，直接使用
        }
        messages.push({ role: 'user', content: userMsg });

        requestData = {
            model: aiModel,
            messages: messages
        };
    }

    // 输出请求参数调试信息
    if (apiType === 'tencent') {
        console.log('[openAi] 腾讯API请求地址:', apiUrl);
        console.log('[openAi] 腾讯API请求头:', headers);
        console.log('[openAi] 腾讯API请求数据:', JSON.stringify(requestData, null, 2));
    }
    // console.log('[openAi] 请求地址:', apiUrl);
    // console.log('[openAi] 请求头:', headers);
    // console.log('[openAi] 请求数据:', JSON.stringify(requestData, null, 2));

    let content;
    try {
        // 发送 POST 请求
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestData),
        });

        // 错误码处理
        if (response.status === 401) {
            console.error('[openAi] API密钥无效，状态码401');
            throw new Error('API密钥无效，请检查 Key 配置');
        }
        if (response.status === 429) {
            console.error('[openAi] 请求过于频繁，状态码429');
            throw new Error('请求过于频繁，请稍后再试');
        }
        if (response.status === 403) {
            console.error('[openAi] 访问被拒绝，状态码403');
            if (apiType === 'gemini') {
                throw new Error('当前地区无法使用 Gemini API，请更换为支持的地区（如美国、日本等）或使用代理。');
            }
            throw new Error('访问被拒绝，请检查API配置');
        }
        if (!response.ok) {
            let text = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(text);
            } catch {
                errorData = { error: { message: text, code: response.status } };
            }
            console.error('[openAi] 请求失败，响应内容:', errorData);
            throw new Error(parseErrorMessage(errorData));
        }

        // 解析响应
        try {
            const responseData = await response.json();
            // console.log('[openAi] 响应数据:', responseData);
            if (apiType === 'tencent') {
                // 腾讯元器返回格式
                let rawContent = responseData.choices?.[0]?.message?.content?.trim() || '';
                content = rawContent;
                // 只有请求成功时，才将请求和回复加入缓存
                await addMessage({ role: 'user', content: msg }, e);
                await addMessage({ role: 'assistant', content }, e);
            } else if (apiType === 'gemini') {
                // Gemini 返回 candidates[0].content.parts[0].text
                let rawContent = '';

                // 检查 Gemini 响应是否有错误
                if (responseData.error) {
                    console.error('[Gemini] API返回错误:', responseData.error);
                    throw new Error(parseErrorMessage(responseData));
                }

                // 检查是否被安全过滤器阻止
                if (responseData.candidates && responseData.candidates[0] && responseData.candidates[0].finishReason === 'SAFETY') {
                    console.error('[Gemini] 内容被安全过滤器阻止');
                    throw new Error('内容被安全过滤器阻止，请尝试其他表达方式');
                }

                if (responseData.candidates && responseData.candidates[0] && responseData.candidates[0].content && responseData.candidates[0].content.parts && responseData.candidates[0].content.parts[0]) {
                    rawContent = responseData.candidates[0].content.parts[0].text || '';
                } else {
                    console.error('[Gemini] 响应格式异常:', responseData);
                    throw new Error('Gemini API响应格式异常，请稍后重试');
                }

                // 检查是否为空响应
                if (!rawContent || rawContent.trim() === '') {
                    console.error('[Gemini] 返回空内容');
                    throw new Error('AI返回了空内容，请稍后重试');
                }

                // 尝试解析 Gemini 返回的 JSON 格式内容
                let finalContent = rawContent;
                try {
                    // 如果返回的是 JSON 格式，尝试解析
                    const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/);
                    if (jsonMatch) {
                        // 提取 JSON 代码块中的内容
                        const jsonContent = JSON.parse(jsonMatch[1]);
                        if (jsonContent.message) {
                            finalContent = jsonContent.message;
                        }
                    } else if (rawContent.trim().startsWith('{') && rawContent.trim().endsWith('}')) {
                        // 直接是 JSON 格式
                        const jsonContent = JSON.parse(rawContent);
                        if (jsonContent.message) {
                            finalContent = jsonContent.message;
                        }
                    }
                } catch (parseError) {
                    // JSON 解析失败，使用原始内容
                    console.log('[Gemini] JSON解析失败，使用原始回复:', parseError.message);
                    finalContent = rawContent;
                }

                content = finalContent;
                await addMessage({ role: 'user', content: msg }, e);
                await addMessage({ role: 'assistant', content }, e);
            } else {
                // 其他API格式
                let rawContent = responseData.choices[0].message.content.trim();
                content = await Config.Chat.ShowReasoning ? rawContent : rawContent.replace(/(（\u63a8\u7406\u8fc7\u7a0b[：:][\s\S]*?）|\u63a8\u7406\u8fc7\u7a0b[：:][\s\S]*?)(?=\n\u7ed3\u8bba|\u7b54\u6848|$)/gi, '');
                await addMessage({ role: 'user', content: msg }, e);
                await addMessage({ role: 'assistant', content }, e);
            }
        } catch (parseError) {
            console.error('[openAi] 响应解析失败:', parseError);
            content = await response.text();
        }
    } catch (error) {
        console.error('[openAi] 与 AI 通信时发生错误:', error.message);

        // 详细分析错误类型并提供对应解决方案
        let errorType = '未知错误';
        let errorMessage = '与 AI 通信时发生错误，请稍后重试。';
        let shouldRetry = true;

        if (error.message.includes('API密钥无效') || error.message.includes('invalid_api_key') || error.message.includes('Unauthorized')) {
            errorType = 'API密钥错误';
            errorMessage = `【${apiType.toUpperCase()} API密钥无效】请检查配置文件中的API密钥是否正确`;
            shouldRetry = false;
        } else if (error.message.includes('地区无法使用') || error.message.includes('User location is not supported')) {
            errorType = '地区限制';
            errorMessage = `【地区限制】当前地区无法访问${apiType.toUpperCase()} API，建议：1.使用VPN/代理 2.切换到其他API`;
            shouldRetry = false;
        } else if (error.message.includes('请求过于频繁') || error.message.includes('rate_limit_exceeded')) {
            errorType = '频率限制';
            errorMessage = `【请求频繁】${apiType.toUpperCase()} API请求过于频繁，请稍后重试`;
            shouldRetry = true;
        } else if (error.code === 'ENOTFOUND') {
            errorType = 'DNS解析失败';
            errorMessage = `【网络错误】无法解析${apiType.toUpperCase()} API域名，请检查：1.网络连接 2.DNS设置 3.API地址是否正确`;
            shouldRetry = false;
        } else if (error.code === 'ECONNREFUSED') {
            errorType = '连接被拒绝';
            errorMessage = `【网络错误】连接${apiType.toUpperCase()} API被拒绝，请检查：1.网络连接 2.防火墙设置 3.代理配置`;
            shouldRetry = false;
        } else if (error.code === 'ETIMEDOUT') {
            errorType = '连接超时';
            errorMessage = `【网络超时】连接${apiType.toUpperCase()} API超时，可能原因：1.网络较慢 2.服务器繁忙 3.需要代理`;
            shouldRetry = true;
        } else if (error.code === 'ECONNRESET') {
            errorType = '连接重置';
            errorMessage = `【网络错误】与${apiType.toUpperCase()} API连接被重置，建议：1.检查网络稳定性 2.尝试使用代理`;
            shouldRetry = true;
        } else if (error.message.includes('quota_exceeded') || error.message.includes('配额')) {
            errorType = 'API配额不足';
            errorMessage = `【配额用完】${apiType.toUpperCase()} API配额已用完，请：1.充值续费 2.等待配额重置 3.切换其他API`;
            shouldRetry = false;
        } else if (error.message.includes('model') && error.message.includes('invalid')) {
            errorType = '模型无效';
            errorMessage = `【模型错误】${apiType.toUpperCase()} API不支持当前模型，请检查模型名称是否正确`;
            shouldRetry = false;
        }

        // 输出详细错误信息到控制台
        console.error(`[错误分析] 类型: ${errorType}, API: ${apiType}, 错误: ${error.message}`);

        // 根据错误类型决定是否抛出异常
        const detailedError = new Error(errorMessage);
        detailedError.type = errorType;
        detailedError.shouldRetry = shouldRetry;
        detailedError.apiType = apiType;
        throw detailedError;
    }

    return content;
}

/**
 * 将OpenAI错误消息转换为简洁易懂的中文描述。
 * @param {Object} errorData - 包含错误信息的对象。
 * @returns {string} 转换后的中文描述。
 */
function parseErrorMessage(errorData) {
    // 兼容 code/message 格式（如 deepseek）
    if (errorData && typeof errorData === 'object') {
        if (typeof errorData.message === 'string' && errorData.message) {
            // Gemini 地区限制友好提示
            if (errorData.message.includes('User location is not supported for the API use')) {
                return '当前地区无法使用 Gemini API，请更换为支持的地区（如美国、日本等）或使用代理。';
            }
            return errorData.message;
        }
        if (typeof errorData.error === 'object' && errorData.error && typeof errorData.error.message === 'string') {
            // Gemini 地区限制友好提示
            if (errorData.error.message.includes('User location is not supported for the API use')) {
                return '当前地区无法使用 Gemini API，请更换为支持的地区（如美国、日本等）或使用代理。';
            }
            // OpenAI 风格
            const errorMessage = errorData.error.message;
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
            if (response.length > 100) {
                response = "出现了一个问题：" + errorMessage.substring(0, 80) + "...，请稍后再试或联系支持人员。";
            }
            return response;
        }
    }
    // 兜底
    return '与 AI 通信时发生错误，请稍后重试。';
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
    const dataPath = path.join(Plugin_Path, 'resources', 'data', 'user');
    const fileName = `${userId}.json`;
    let user = {};
    if (fs.existsSync(path.join(dataPath, fileName))) {
        user = await Data.readJSON(fileName, dataPath);
    }
    user.favor = parseInt(favor) || 0;
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

/**
 * 向当前会话追加一条消息并保存
 * @param {Object} message {role, content}
 */
async function addMessage(message, e) {
    const sessionId = e.group_id ? `group_${e.group_id}` : `user_${e.user_id}`;
    let chatMsg = await loadChatMsg(sessionId);
    if (!Array.isArray(chatMsg)) chatMsg = [];
    chatMsg.push(message);
    await saveChatMsg(sessionId, chatMsg);
}

/** 清除当前会话缓存上下文 */
async function clearSessionContext(e) {
    const sessionId = e.group_id ? `group_${e.group_id}` : `user_${e.user_id}`;
    const keyv = getSessionKeyv(sessionId);
    await keyv.delete('chatMsg');
}

/**
 * 上下文兼容转换：只保留 user/assistant 的纯文本内容，丢弃特殊字段
 * @param {Array} chatMsg 历史上下文
 * @param {string} oldType 旧模型类型
 * @param {string} newType 新模型类型
 * @param {string} oldModel 旧模型名
 * @param {string} newModel 新模型名
 * @returns { converted, lostContent }
 */
function convertChatContextForModel(chatMsg, oldType, newType, oldModel, newModel) {
    let lostContent = false;
    const isGemini = newType === 'gemini' || newModel.includes('gemini');
    const isQwenOrOpenAI = ['openai', 'qwen', 'siliconflow'].includes(newType) || /gpt|qwen|turbo|vl-72b/.test(newModel);
    const converted = chatMsg.map(item => {
        if (typeof item !== 'object') return null;
        let role = item.role || '';
        let content = item.content || item.message || '';
        // system <-> model 兼容转换
        if (role === 'system' && isGemini) {
            // system 转 model（Gemini）
            return { role: 'model', parts: [{ text: typeof content === 'string' ? content : JSON.stringify(content) }] };
        }
        if (role === 'model' && isQwenOrOpenAI) {
            // model 转 system（OpenAI/Qwen）
            let text = '';
            if (Array.isArray(item.parts) && item.parts.length > 0) {
                text = item.parts.map(p => p.text).join('\n');
            } else if (typeof content === 'string') {
                text = content;
            }
            return { role: 'system', content: text };
        }
        // 只保留 user/assistant 的纯文本内容
        if ((role === 'user' || role === 'assistant') && typeof content === 'string') {
            return { role, content };
        }
        lostContent = true;
        return null;
    }).filter(Boolean);
    if (converted.length < chatMsg.length) lostContent = true;
    return { converted, lostContent };
}
