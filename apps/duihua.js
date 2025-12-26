import plugin from '../../../lib/plugins/plugin.js';
import fs from 'fs';
import path from 'path';
import { common } from '../model/index.js';
import { Plugin_Path, Config } from '../components/index.js';
import Data from '../components/Data.js';

// 引入拆分后的模块
import { chatActiveMap, lastRequestTime, API_INTERVALS, CHAT_CONTEXT_PATH } from './duihua/config.js';
import { ForwardMsg, msgToAt, sendCodeAsForwardMsg } from './duihua/utils.js';
import {
    mergeSystemMessage, openAi, loadChatMsg, saveChatMsg,
    clearSessionContext, getCurrentRoleIndex, getSessionKeyv,
    ReadScene, WriteScene, getUserFavor, setUserFavor, convertChatContextForModel
} from './duihua/helpers.js';

/** 发音人列表 */
const voiceList = await Data.readVoiceList();

/** 聊天昵称 */
let chatNickname = await Config.Chat.NickName;


/**
 * 对话处理类
 */
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
                    reg: `^#?(止水)?(插件|对话)?重置个人配置$`,
                    fnc: 'ResetUserConfig'
                }, {
                    reg: `^#?(止水)?(插件|对话)?查看个人配置$`,
                    fnc: 'ShowUserConfig'
                }, {
                    reg: `^#?(止水)?(插件|对话)?查看用户配置\s*(\d+)?$`,
                    fnc: 'ShowOtherUserConfig'
                }, {
                    reg: `^#?(止水)?(插件|对话)?重置用户配置\s*(\d+)$`,
                    fnc: 'ResetOtherUserConfig'
                }, {
                    reg: `^#?(止水)?(插件|对话)?用户配置统计$`,
                    fnc: 'ShowUserConfigStats'
                }, {
                    reg: ``,
                    fnc: 'duihua',
                    log: false
                }
            ]
        });
    }




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
    }

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
            // console.log(`[止水对话] 检测到图片:`, images); // 精简：隐藏图片检测日志
        }
        if (files.length > 0) {
            // console.log(`[止水对话] 检测到文件:`, files); // 精简：隐藏文件检测日志
        }

        try {
            // 提取用户消息内容，并去除对话昵称前缀
            msg = msg.replace(/^#?${chatNickname}\s*/, '').trim();
            msg = msg.replace(/{at:/g, '{@');

            // 处理特殊用户 stdin，使用主人QQ号码
            let actualUserId = e.user_id;
            if (e.user_id === 'stdin') {
                actualUserId = await Config.Chat.MasterQQ;
            }

            const Favora = await getUserFavor(actualUserId);
            const userMessage = {
                message: msg,
                images: images,
                files: files,
                additional_info: {
                    name: e.sender.nickname,
                    user_id: actualUserId,
                    favor: Favora,
                    group_id: e.group_id || 0
                }
            };

            // console.log(`[止水对话] -> 用户[${e.user_id}]说: ${msg}`); // 精简：隐藏用户输入日志

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
                    // console.log(`[止水对话] 请求频繁，等待 ${waitTime / 1000} 秒后重试 (${retryCount}/${maxRetries})`);
                    // console.log(`[止水对话] ${apiError.type}，等待 ${waitTime / 1000} 秒后重试 (${retryCount}/${maxRetries})`);
                    // console.log(`[止水对话] 收到原始回复: ${response.substring(0, 200)}...`);
                    // console.log(`[止水对话] JSON解析成功，消息内容: ${replyObj.message?.substring(0, 50)}...`);
                    // console.log(`[止水对话] 解析后的对象类型: ${typeof replyObj}, 是否有message: ${!!replyObj.message}`);
                    // console.log(`[止水对话] JSON对象无效，使用原始回复`);
                    // console.log(`[止水对话] JSON解析失败: ${error.message}，使用原始回复`);

                    // 根据错误类型决定是否重试
                    if (apiError.message.includes('请求过于频繁') && retryCount < maxRetries) {
                        retryCount++;
                        const waitTime = Math.min(3000 * retryCount, 12000); // 3秒、6秒、9秒，最多12秒
                        console.log(`[止水对话] 请求频繁，等待 ${waitTime / 1000} 秒后重试 (${retryCount}/${maxRetries})`);
                        // ...existing code...

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
                        // ...existing code...

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
                    // console.log(`[止水对话] 收到原始回复: ${response.substring(0, 200)}...`); // 精简：隐藏原始回复
                    replyObj = JSON.parse(response);
                    // console.log(`[止水对话] JSON解析成功，消息内容: ${replyObj.message?.substring(0, 50)}...`); // 精简：隐藏解析详情
                    // console.log(`[止水对话] 解析后的对象类型: ${typeof replyObj}, 是否有message: ${!!replyObj.message}`); // 精简：隐藏对象详情
                    if (typeof replyObj !== 'object' || !replyObj.message) {
                        // console.log(`[止水对话] JSON对象无效，使用原始回复`); // 精简：隐藏无效对象日志
                        replyObj = {
                            message: response,
                            favor_changes: []
                        };
                    }
                } catch (error) {
                    console.log(`[止水对话] JSON解析失败: ${error.message}，使用原始回复`);
                    // console.log(`[止水对话] <- AI回复: ${response.substring(0, 50)}...`); // 精简：隐藏重复回复日志
                    // console.log(`[止水对话] <- AI回复: ${response}`); // 精简：隐藏完整回复日志
                    // console.log(`[止水对话] <- AI回复: ${response.substring(0, 50)}...`); // 精简：隐藏重复回复日志
                    // console.log('[好感度变更]', favorLogs.join(' | ')); // 精简：移到后面统一处理
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
                        // 使用与用户消息相同的用户ID处理逻辑
                        let targetUserId = item.user_id || e.user_id;
                        if (targetUserId === 'stdin') {
                            const masterQQ = await Config.Chat.MasterQQ;
                            targetUserId = masterQQ || "172679743";
                        }

                        const change = Number(item.change);
                        if (isNaN(change)) continue; // 跳过无效变更
                        const oldFavor = await getUserFavor(targetUserId);
                        const newFavor = Math.max(-100, oldFavor + change); // 最小-100
                        await setUserFavor(targetUserId, newFavor);
                        favorLogs.push(`用户${targetUserId} 好感度变化: ${oldFavor} → ${newFavor} (变更: ${change})`);
                    }
                }
                if (favorLogs.length > 0) {
                    console.log('[好感度变更]', favorLogs.join(' | '));
                    // ...existing code...
                }

                // 拼接 message 和 code_example 字段
                let finalReply = replyObj.message ?? '';
                console.log(`[止水对话] <- AI回复: ${finalReply}`); // 精简：只保留一条简洁的回复日志
                // console.log(`[止水对话] 最终回复内容: ${finalReply.substring(0, 100)}...`); // 精简：隐藏重复日志
                // console.log(`[止水对话] 最终回复内容: ${finalReply}`); // 精简：隐藏重复日志
                // console.log(`[止水对话] 最终回复内容: ${finalReply.substring(0, 100)}...`); // 精简：隐藏重复日志
                // console.log(`[止水对话] 回复对象结构:`, JSON.stringify(replyObj, null, 2).substring(0, 300)); // 精简：隐藏对象结构
                // console.log(`[止水对话] 消息为空，不发送`); // 精简：这个日志位置不对，应该在后面
                // console.log(`[止水对话] 回复对象结构:`, JSON.stringify(replyObj, null, 2).substring(0, 300)); // 精简：隐藏重复日志
                // ...existing code...
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
                    // ...existing code...
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
        try {
            const roleJson = Config.getJsonConfig('RoleProfile');
            const roles = JSON.parse(roleJson);
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

    /** 枚举角色列表（高亮当前角色） */
    async ShowRoleList(e) {
        let roles = [];
        let currentRoleIndex = await getCurrentRoleIndex(e);
        try {
            const roleJson = Config.getJsonConfig('RoleProfile');
            const roleData = JSON.parse(roleJson);
            roles = roleData.map(r => ({
                title: r.角色标题 || r.基础身份?.名称 || '未知角色',
                isDefault: r._isDefault || false
            }));
        } catch (err) {
            e.reply('读取角色列表失败');
            return;
        }

        // 确定角色类型
        let roleTypeLabel = '全局角色';
        if (!e.group_id) {
            // 私聊：检查是否有用户个人角色配置
            try {
                const userRoleIndex = await Config.GetUserChatConfig(e.user_id, 'RoleIndex');
                if (typeof userRoleIndex === 'number') {
                    roleTypeLabel = '个人专属角色';
                }
            } catch (error) {
                // 使用全局角色
            }
        } else {
            // 群聊：检查是否有群专属角色配置
            const groupRoleList = (await Config.Chat.GroupRoleIndex) || [];
            const found = groupRoleList.find(item => String(item.group) === String(e.group_id));
            if (found && typeof found.index === 'number') {
                roleTypeLabel = '群专属角色';
            }
        }

        const list = roles.map((r, i) => {
            let displayText = `${i + 1}. ${r.title}`;
            if (r.isDefault) {
                displayText += ' [预设]';
            }
            if (i === currentRoleIndex) {
                displayText += ' ✅';
            }
            return displayText;
        }).join('\n');

        e.reply(`【当前使用：${roleTypeLabel}】\n可用角色列表：\n${list}`);
    }

    /** 切换角色（支持群专属、用户专属和全局） */
    async SwitchRole(e) {
        // 权限控制：群聊只有主人可以切换，私聊用户可以切换自己的角色
        if (e.group_id && !e.isMaster) {
            e.reply('群聊中只有主人可以切换角色。');
            return;
        }

        const roleArg = e.msg.replace(/^#?(止水)?(插件|对话)?切换角色/, '').trim();
        if (!roleArg) {
            e.reply('请指定要切换的角色标题或序号');
            return;
        }

        let roles = [];
        try {
            const roleJson = Config.getJsonConfig('RoleProfile');
            roles = JSON.parse(roleJson);
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

        const sessionId = e.group_id ? `group_${e.group_id}` : `user_${e.user_id}`;

        // 获取当前API配置用于上下文兼容
        const { apiConfig } = await getCurrentApiConfig(e);
        const model = (apiConfig.ApiModel || '').toLowerCase();
        const type = (apiConfig.ApiType || '').toLowerCase();

        let lost = false;
        let chatMsg = await loadChatMsg(sessionId);
        if (Array.isArray(chatMsg) && chatMsg.length > 0) {
            const { converted, lostContent } = convertChatContextForModel(chatMsg, type, type, model, model);
            await saveChatMsg(sessionId, converted);
            if (lostContent) lost = true;
        }
        await clearSessionContext(e);

        // 私聊：设置用户个人角色配置
        if (!e.group_id) {
            await Config.SetUserChatConfig(e.user_id, 'RoleIndex', idx);
            let tip = `你的个人角色已切换为：${roles[idx].角色标题}`;
            if (lost) tip += `\n注意：因模型/接口格式不兼容，历史上下文已被简化或部分丢失。建议重新开始对话。`;
            else tip += `\n已自动清除上下文缓存，请重新开始对话。`;
            e.reply(tip);
            return;
        }

        // 群聊：设置群专属角色配置（仅主人）
        let groupRoleList = (await Config.Chat.GroupRoleIndex) || [];
        const existIdx = groupRoleList.findIndex(item => String(item.group) === String(e.group_id));
        if (existIdx >= 0) {
            groupRoleList[existIdx].index = idx;
        } else {
            groupRoleList.push({ group: String(e.group_id), index: idx });
        }

        await Config.modify('duihua', 'GroupRoleIndex', groupRoleList);
        let tip = `本群已切换为角色：${roles[idx].角色标题}`;
        if (lost) tip += `\n注意：因模型/接口格式不兼容，历史上下文已被简化或部分丢失。建议重新开始对话。`;
        else tip += `\n已自动清除上下文缓存，请重新开始对话。`;
        e.reply(tip);
    }

    /** 添加对话角色 */
    async AddRole(e) {
        if (!e.isMaster) return;
        let jsonStr = e.msg.replace(/^#?(止水)?(插件|对话)?添加(对话)?角色/, '').trim();
        if (!jsonStr) {
            e.reply("请提供完整的角色JSON内容。");
            return;
        }
        try {
            const newRole = JSON.parse(jsonStr);
            // 验证角色格式
            if (!newRole.角色标题) {
                e.reply("角色格式错误：缺少'角色标题'字段");
                return;
            }
            const roleJson = Config.getJsonConfig('RoleProfile');
            let roles = [];
            if (roleJson) {
                roles = JSON.parse(roleJson);
            }
            // 检查是否已存在相同标题的角色
            const existingIndex = roles.findIndex(r => r.角色标题 === newRole.角色标题);
            if (existingIndex >= 0) {
                e.reply(`角色"${newRole.角色标题}"已存在，请使用不同的角色标题`);
                return;
            }
            // 添加新角色
            roles.push(newRole);
            Config.setJsonConfig('RoleProfile', JSON.stringify(roles, null, 2));
            e.reply(`新角色"${newRole.角色标题}"已成功添加！\n当前总共有 ${roles.length} 个角色。`);
        } catch (err) {
            e.reply("角色JSON格式有误：" + err.message);
        }
    }

    /** 设置API（仅主人可操作） */
    async SetApi(e) {
        // 权限控制：只有主人可以设置API
        if (!e.isMaster) {
            e.reply('只有主人可以设置API参数。');
            return;
        }

        // 检查敏感参数，禁止群内设置
        const sensitiveFields = ['ApiKey', 'TencentAssistantId'];
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
        const field = keyMap[match[1]];
        const value = match[2].trim();

        if (e.group_id && sensitiveFields.includes(field)) {
            e.reply('该参数（如密钥、助手ID）只能在私聊中设置，请私聊机器人操作。');
            return;
        }

        const ApiList = await Config.Chat.ApiList || [];

        // 操作全局API配置
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

    /** 切换API（仅主人可操作） */
    async SwitchApi(e) {
        // 权限控制：只有主人可以切换API
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

        const sessionId = e.group_id ? `group_${e.group_id}` : `user_${e.user_id}`;

        // 获取切换前的API配置
        const { apiIndex: oldApiIndex, apiConfig: oldApi } = await getCurrentApiConfig(e);
        const newApi = ApiList[idx] || {};
        const oldModel = (oldApi.ApiModel || '').toLowerCase();
        const newModel = (newApi.ApiModel || '').toLowerCase();
        const oldType = (oldApi.ApiType || '').toLowerCase();
        const newType = (newApi.ApiType || '').toLowerCase();

        // 设置全局API配置
        await Config.modify('duihua', 'CurrentApiIndex', idx);

        // 自动兼容上下文
        let lost = false;
        let chatMsg = await loadChatMsg(sessionId);
        if (Array.isArray(chatMsg) && chatMsg.length > 0) {
            const { converted, lostContent } = convertChatContextForModel(chatMsg, oldType, newType, oldModel, newModel);
            await saveChatMsg(sessionId, converted);
            if (lostContent) lost = true;
        }
        await clearSessionContext(e);

        let tip = `已切换到API序号${idx + 1}，类型：${newApi.ApiType || '未知类型'}`;
        if (lost) tip += `\n注意：因模型/接口格式不兼容，历史上下文已被简化或部分丢失。建议重新开始对话。`;
        else tip += `\n已自动清除上下文缓存，请重新开始对话。`;
        e.reply(tip);
    }

    /** 查看API（仅主人可查看） */
    async ShowApi(e) {
        // 权限控制：只有主人可以查看API参数
        if (!e.isMaster) {
            e.reply('只有主人可以查看API参数。');
            return;
        }

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

        // 获取当前使用的API配置
        const { apiIndex: idx, apiConfig: api } = await getCurrentApiConfig(e);

        // 判断API类型
        let apiTypeLabel = '全局API';

        // 群聊逻辑（群专属API检查）
        if (Array.isArray(await Config.Chat.GroupRoleIndex)) {
            const groupRoleList = await Config.Chat.GroupRoleIndex;
            const found = groupRoleList.find(item => String(item.group) === String(e.group_id));
            if (found && typeof found.apiIndex === 'number') {
                apiTypeLabel = '群专属API';
            }
        }

        if (idx < 0 || idx >= ApiList.length) {
            e.reply('当前API索引无效。');
            return;
        }

        // 参数名中英文映射
        const nameMap = {
            ApiType: '类型',
            ApiUrl: '地址',
            ApiKey: '密钥',
            ApiModel: '模型',
            TencentAssistantId: '助手ID'
        };

        // 显示API类型
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

    /**
     * 重置个人配置
     * @param {Object} e 事件对象
     * @returns {Promise<void>}
     */
    async ResetUserConfig(e) {
        if (e.group_id) {
            e.reply('该功能只能在私聊中使用。');
            return;
        }

        try {
            // 只删除用户的角色配置
            await Config.DeleteUserChatConfig(e.user_id, 'RoleIndex');

            // 清除上下文缓存
            await clearSessionContext(e);

            e.reply('已重置你的个人角色配置，将使用全局预设角色。\n已自动清除上下文缓存，请重新开始对话。');
        } catch (error) {
            console.error('[ResetUserConfig] 重置用户配置失败:', error);
            e.reply('重置个人配置失败，请稍后重试。');
        }
    }

    /**
     * 查看个人配置
     * @param {Object} e 事件对象
     * @returns {Promise<void>}
     */
    async ShowUserConfig(e) {
        if (e.group_id) {
            e.reply('该功能只能在私聊中使用。');
            return;
        }

        try {
            const currentRoleIndex = await getCurrentRoleIndex(e);

            // 检查是否有个人角色配置
            let hasUserRoleConfig = false;

            try {
                const userRoleIndex = await Config.GetUserChatConfig(e.user_id, 'RoleIndex');
                if (typeof userRoleIndex === 'number') hasUserRoleConfig = true;
            } catch (error) { }

            let msg = `【你的当前配置】\n\n`;

            // 角色配置
            msg += `【角色配置】${hasUserRoleConfig ? '（个人专属）' : '（使用全局默认）'}\n`;
            try {
                const roleJson = Config.getJsonConfig('RoleProfile');
                const roles = JSON.parse(roleJson);
                const currentRole = roles[currentRoleIndex];
                msg += `序号：${currentRoleIndex + 1}\n`;
                msg += `角色：${currentRole?.角色标题 || currentRole?.基础身份?.名称 || '未知角色'}\n\n`;
            } catch (error) {
                msg += `角色：获取失败\n\n`;
            }

            // 操作提示
            msg += `【操作提示】\n`;
            msg += `• 私聊切换角色：#切换角色序号\n`;
            msg += `• 重置个人角色配置：#重置个人配置`;

            e.reply(msg);
        } catch (error) {
            console.error('[ShowUserConfig] 获取用户配置失败:', error);
            e.reply('获取个人配置失败，请稍后重试。');
        }
    }

    /**
     * 查看其他用户配置（仅主人）
     * @param {Object} e 事件对象
     * @returns {Promise<void>}
     */
    async ShowOtherUserConfig(e) {
        if (!e.isMaster) {
            e.reply('只有主人可以查看其他用户的配置。');
            return;
        }

        // 提取用户QQ号
        const match = e.msg.match(/查看用户配置\s*(\d+)?$/);
        const targetUserId = match?.[1];

        if (!targetUserId) {
            e.reply('请指定要查看的用户QQ号，例如：#查看用户配置 123456789');
            return;
        }

        try {
            // 模拟事件对象以获取该用户的配置
            const fakeEvent = { user_id: targetUserId, group_id: null };
            const currentRoleIndex = await getCurrentRoleIndex(fakeEvent);

            // 检查是否有个人角色配置
            let hasUserRoleConfig = false;

            try {
                const userRoleIndex = await Config.GetUserChatConfig(targetUserId, 'RoleIndex');
                if (typeof userRoleIndex === 'number') hasUserRoleConfig = true;
            } catch (error) { }

            let msg = `【用户 ${targetUserId} 的配置】\n\n`;

            // 角色配置
            msg += `【角色配置】${hasUserRoleConfig ? '（个人专属）' : '（使用全局默认）'}\n`;
            try {
                const roleJson = Config.getJsonConfig('RoleProfile');
                const roles = JSON.parse(roleJson);
                const currentRole = roles[currentRoleIndex];
                msg += `序号：${currentRoleIndex + 1}\n`;
                msg += `角色：${currentRole?.角色标题 || currentRole?.基础身份?.名称 || '未知角色'}\n\n`;
            } catch (error) {
                msg += `角色：获取失败\n\n`;
            }

            // 管理操作提示
            msg += `【管理操作】\n`;
            msg += `• 重置该用户配置：#重置用户配置 ${targetUserId}`;

            e.reply(msg);
        } catch (error) {
            console.error('[ShowOtherUserConfig] 获取用户配置失败:', error);
            e.reply('获取用户配置失败，请稍后重试。');
        }
    }

    /**
     * 重置其他用户配置（仅主人）
     * @param {Object} e 事件对象
     * @returns {Promise<void>}
     */
    async ResetOtherUserConfig(e) {
        if (!e.isMaster) {
            e.reply('只有主人可以重置其他用户的配置。');
            return;
        }

        // 提取用户QQ号
        const match = e.msg.match(/重置用户配置\s*(\d+)$/);
        const targetUserId = match?.[1];

        if (!targetUserId) {
            e.reply('请指定要重置的用户QQ号，例如：#重置用户配置 123456789');
            return;
        }

        try {
            // 只删除用户的角色配置
            await Config.DeleteUserChatConfig(targetUserId, 'RoleIndex');

            // 清除该用户的上下文缓存
            const sessionId = `user_${targetUserId}`;
            const keyv = getSessionKeyv(sessionId);
            await keyv.delete('chatMsg');

            e.reply(`已重置用户 ${targetUserId} 的个人角色配置，该用户将使用全局预设角色。\n已自动清除该用户的上下文缓存。`);
        } catch (error) {
            console.error('[ResetOtherUserConfig] 重置用户配置失败:', error);
            e.reply('重置用户配置失败，请稍后重试。');
        }
    }

    /**
     * 显示用户配置统计（仅主人）
     * @param {Object} e 事件对象
     * @returns {Promise<void>}
     */
    async ShowUserConfigStats(e) {
        if (!e.isMaster) {
            e.reply('只有主人可以查看用户配置统计。');
            return;
        }

        try {
            // 这里需要遍历Redis中的所有用户配置
            // 由于Redis操作的复杂性，我们提供一个简化的统计信息

            let msg = `【用户配置统计】\n\n`;
            msg += `系统当前支持用户个人角色配置功能：\n`;
            msg += `• 用户可在私聊中设置专属角色\n`;
            msg += `• 配置存储在Redis中，键格式：zhishui:ChatConfig:QQ号:配置项\n`;
            msg += `• 支持的配置项：RoleIndex\n\n`;
            msg += `【管理指令】\n`;
            msg += `• #查看用户配置 QQ号 - 查看指定用户配置\n`;
            msg += `• #重置用户配置 QQ号 - 重置指定用户配置\n`;
            msg += `• #用户配置统计 - 查看此统计信息\n\n`;
            msg += `注：详细的用户配置数据需要通过Redis管理工具查看`;

            e.reply(msg);
        } catch (error) {
            console.error('[ShowUserConfigStats] 获取用户配置统计失败:', error);
            e.reply('获取用户配置统计失败，请稍后重试。');
        }
    }
}
