/**
 * 对话核心处理模块
 * 处理对话的主要逻辑
 */

import { Config } from '../../../components/index.js';
import { chatActiveMap, lastRequestTime, API_INTERVALS } from '../config.js';
import { convertAtFormat, convertAtToNames } from '../parsers/index.js';
import { textToImage, shouldResponseAsImage } from '../chatHelper.js';
import voiceManager from '../../voice/voiceManager.js';
import { isToolCallingSupported } from '../api-types.js';
import { checkRateLimit, getUserFavor, setUserFavor } from '../user/index.js';
import { openAi, getCurrentApiConfig, loadChatMsg, mergeSystemMessage, clearSessionContext, getSessionKeyv } from '../helpers.js';

/**
 * 处理对话核心逻辑
 * @param {Object} e - 事件对象
 * @param {string} chatNickname - 对话昵称
 * @returns {Promise<boolean>} 处理结果
 */
export async function handleChat(e, chatNickname) {
    const sessionId = e.group_id ? `group_${e.group_id}` : `user_${e.user_id}`;
    let msg = e.msg;

    function escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * 检查消息是否以特殊符号开头
     * 排除与其他指令冲突的消息
     * @param {string} message - 消息内容
     * @returns {boolean} 是否为特殊指令
     */
    function isSpecialCommand(message) {
        if (!message || typeof message !== 'string') {
            return false;
        }
        const trimmedMsg = message.trim();
        const specialPrefixPattern = /^[#*~\/\\!$%&^=+\-_|<>]/;
        return specialPrefixPattern.test(trimmedMsg);
    }

    if (isSpecialCommand(msg)) {
        chatActiveMap[sessionId] = 0;
        return false;
    }

    let nickname = chatNickname;
    let regex = new RegExp(`^#?${escapeRegExp(nickname)}`);
    const isPrivate = !e.group_id;
    const enablePrivate = await Config.Chat.EnablePrivateChat;

    let triggered = false;

    if (isPrivate) {
        if (enablePrivate || regex.test(msg)) {
            triggered = true;
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
        }
    }

    if (!triggered) {
        chatActiveMap[sessionId] = 0;
        return false;
    }

    if (chatActiveMap[sessionId] === 1) {
        if (e.group_id) {
            await e.reply([segment.at(e.user_id), '稍等哦，正在处理上一个请求~'], true);
        } else {
            await e.reply('稍等哦，正在处理上一个请求~');
        }
        return;
    }
    chatActiveMap[sessionId] = 1;

    const now = Date.now();
    const lastTime = lastRequestTime[sessionId] || 0;

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

    lastRequestTime[sessionId] = now;

    let images = [];
    let files = [];
    let processedMsg = msg;
    const botId = Bot?.uin || e.bot?.uin || e.bot?.id;

    if (Array.isArray(e.message)) {
        let msgParts = [];
        for (const seg of e.message) {
            if (seg.type === 'text' && seg.text) {
                msgParts.push(seg.text);
            } else if (seg.type === 'at' && seg.qq) {
                if (botId && String(seg.qq) === String(botId)) {
                    msgParts.push('[CQ:at,qq=self]');
                } else {
                    msgParts.push(`[CQ:at,qq=${seg.qq}]`);
                }
            } else if (seg.type === 'image' && seg.url) {
                images.push(seg.url);
            } else if (seg.type === 'file' && seg.file) {
                files.push(seg.file);
            }
        }
        if (msgParts.length > 0) {
            processedMsg = msgParts.join('');
        }
    }

    try {
        let finalMsg = processedMsg;
        finalMsg = finalMsg.replace(new RegExp(`^#?${escapeRegExp(chatNickname)}\\s*`), '').trim();

        let actualUserId = e.user_id;
        if (e.user_id === 'stdin' || !e.user_id || isNaN(e.user_id) || String(e.user_id).length < 5) {
            actualUserId = await Config.Chat.MasterQQ;
        }

        const rateCheck = await checkRateLimit(actualUserId);
        if (!rateCheck.allowed) {
            await e.reply(rateCheck.message);
            return;
        }

        const favor = await getUserFavor(actualUserId);

        const { apiConfig } = await getCurrentApiConfig(e);
        const apiType = apiConfig.ApiType || 'default';
        const supportsToolCalling = isToolCallingSupported(apiType);

        const baseMessage = {
            message: finalMsg,
            images: images,
            files: files,
            additional_info: {
                name: e.sender.nickname,
                user_id: actualUserId,
                group_id: e.group_id || 0,
                favor: favor
            }
        };

        const userMessage = baseMessage;
        const MessageText = JSON.stringify(userMessage);
        const systemMessage = await mergeSystemMessage(e, supportsToolCalling);
        const chatMsg = await loadChatMsg(sessionId);

        if (!chatMsg || chatMsg.length === 0) {
            console.log('[止水对话] 首次构建上下文，系统提示词:');
            console.log(systemMessage);
            console.log('[止水对话] 系统提示词结束');
        }

        let response;
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount <= maxRetries) {
            try {
                response = await openAi(MessageText, e, systemMessage, chatMsg);
                break;
            } catch (apiError) {
                console.error(`[止水对话] API调用失败 (重试${retryCount}/${maxRetries}):`, apiError.message);

                if (apiError.message.includes('请求过于频繁') && retryCount < maxRetries) {
                    retryCount++;
                    const waitTime = Math.min(3000 * retryCount, 12000);
                    console.log(`[止水对话] 请求频繁，等待 ${waitTime / 1000} 秒后重试 (${retryCount}/${maxRetries})`);

                    if (retryCount === 1) {
                        await e.reply(`请求繁忙，正在自动重试中，请稍等...`);
                    }

                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                } else if (apiError.shouldRetry && (apiError.type === '连接超时' || apiError.type === '连接重置') && retryCount < maxRetries) {
                    retryCount++;
                    const waitTime = 2000 * retryCount;
                    console.log(`[止水对话] ${apiError.type}，等待 ${waitTime / 1000} 秒后重试 (${retryCount}/${maxRetries})`);

                    if (retryCount === 1) {
                        await e.reply(`网络不稳定，正在重试连接...`);
                    }

                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                } else {
                    chatActiveMap[sessionId] = 0;

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

        if (!response && retryCount > maxRetries) {
            chatActiveMap[sessionId] = 0;
            await e.reply('服务器繁忙，请稍后再试');
            return false;
        }

        if (response) {
            const { content, rawResponse } = response;

            let replyObj;
            try {
                replyObj = JSON.parse(content);
                if (typeof replyObj !== 'object' || !replyObj.message) {
                    replyObj = {
                        message: content,
                        favor_changes: []
                    };
                    logger.warn('[止水对话] JSON对象缺少message字段，使用原始内容');
                }
            } catch (error) {
                console.log(`[止水对话] JSON解析失败: ${error.message}，使用原始回复`);
                replyObj = {
                    message: content,
                    favor_changes: []
                };
                logger.warn('[止水对话] JSON解析失败，使用原始内容:', error.message);
            }
            replyObj.favor_changes = replyObj.favor_changes || [];

            let favorLogs = [];
            if (Array.isArray(replyObj.favor_changes)) {
                for (const item of replyObj.favor_changes) {
                    let targetUserId = item.user_id || e.user_id;
                    if (targetUserId === 'stdin' || !targetUserId || isNaN(targetUserId) || String(targetUserId).length < 5) {
                        const masterQQ = await Config.Chat.MasterQQ;
                        targetUserId = masterQQ || "10000";
                    }

                    const change = Number(item.change);
                    if (isNaN(change)) continue;

                    const MAX_SINGLE_CHANGE = 10;
                    const clampedChange = Math.max(-MAX_SINGLE_CHANGE, Math.min(MAX_SINGLE_CHANGE, change));

                    const oldFavor = await getUserFavor(targetUserId);
                    const newFavor = Math.max(-100, Math.min(100, oldFavor + clampedChange));

                    await setUserFavor(targetUserId, newFavor, item.reason || '未说明', 'AI');

                    favorLogs.push(`用户${targetUserId} 好感度变化: ${oldFavor} → ${newFavor} (变更: ${clampedChange}, 原因: ${item.reason || '未说明'})`);
                }
            }
            if (favorLogs.length > 0) {
                console.log('[好感度变更]', favorLogs.join(' | '));
            }

            let finalReply = replyObj.message ?? '';
            console.log(`[止水对话] <- AI回复: ${finalReply}`);

            let codeText = '';

            const codeRegex = /```(?:[\w]*)\n*([\s\S]*?)```/g;
            let codeBlocks = [];
            let msgWithoutCode = finalReply;
            let match;
            while ((match = codeRegex.exec(finalReply)) !== null) {
                codeBlocks.push(match[1].trim());
            }
            if (codeBlocks.length > 0) {
                codeText = codeBlocks.join('\n\n');
                msgWithoutCode = finalReply.replace(/```[\w]*\n*[\s\S]*?```/g, '').trim();
            }

            if (!codeText && replyObj.code_example && replyObj.code_example.trim()) {
                codeText = replyObj.code_example.trim();
            }

            if (codeText) {
                await e.reply(codeText, true);
            }

            let textForVoice = await convertAtToNames(msgWithoutCode, e);
            textForVoice = textForVoice.replace(/\s+/g, ' ').trim();

            const MAX_VOICE_TEXT_LENGTH = 500;
            const isTextTooLong = textForVoice.length > MAX_VOICE_TEXT_LENGTH;

            let voiceResult = null;
            if (!isTextTooLong) {
                voiceResult = await voiceManager.synthesize(e, textForVoice);
            } else {
                logger.debug(`[止水对话] 文本长度 ${textForVoice.length} 超过限制 ${MAX_VOICE_TEXT_LENGTH}，跳过语音合成`);
            }

            if (voiceResult) {
                if (typeof voiceResult === 'string') {
                    e.reply([segment.record(voiceResult)]);
                } else if (Buffer.isBuffer(voiceResult)) {
                    e.reply([segment.record(voiceResult)]);
                } else if (Array.isArray(voiceResult)) {
                    for (let i = 0; i < voiceResult.length; i++) {
                        const buffer = voiceResult[i];
                        if (Buffer.isBuffer(buffer)) {
                            e.reply([segment.record(buffer)]);
                            if (i < voiceResult.length - 1) {
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        }
                    }
                }
            } else {
                if (msgWithoutCode) {
                    const replyContent = convertAtFormat(msgWithoutCode);

                    if (shouldResponseAsImage(e.msg)) {
                        const imageSuccess = await textToImage(e, msgWithoutCode, {
                            showFooter: true
                        });
                        if (!imageSuccess) {
                            await e.reply(replyContent);
                        }
                    } else {
                        const hasImageAttempt = e.msg.includes('图片') || e.msg.includes('图像') || e.msg.includes('画');
                        if (hasImageAttempt && !shouldResponseAsImage(e.msg)) {
                            const notification = '根据通信规范，常规对话内容默认使用文本格式。\n如需生成图片，请使用特定命令如：#生成图片 [描述]';
                            await e.reply([segment.at(e.user_id), notification]);
                        }
                        await e.reply(replyContent);
                    }
                }
            }

            chatActiveMap[sessionId] = 0;
        } else {
            chatActiveMap[sessionId] = 0;
            let errorMsg = response || '抱歉，AI暂时无法回复，请稍后再试。';
            if (response) {
                try {
                    const errorObj = JSON.parse(response);
                    if (errorObj.message) {
                        errorMsg = errorObj.message;
                    }
                } catch {
                    logger.warn('[止水对话] 错误响应不是JSON，使用原始内容');
                }
            }
            if (shouldResponseAsImage(e.msg)) {
                const imageSuccess = await textToImage(e, errorMsg, {
                    showFooter: true
                });
                if (!imageSuccess) {
                    await e.reply(errorMsg);
                }
            } else {
                await e.reply(errorMsg);
            }
            return false;
        }
    } catch (error) {
        console.error('对话处理过程中发生错误:', error);
        chatActiveMap[sessionId] = 0;
        const errorMsg = '发生错误，无法进行对话。请稍后再试。';
        if (shouldResponseAsImage(e.msg)) {
            const imageSuccess = await textToImage(e, errorMsg, {
                showFooter: true
            });
            if (!imageSuccess) {
                await e.reply(errorMsg);
            }
        } else {
            await e.reply(errorMsg);
        }
        return false;
    }

    return false;
}

/**
 * 重置对话
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleResetChat(e) {
    const { chatActiveMap, lastRequestTime, CHAT_CONTEXT_PATH } = await import('../config.js');
    const sessionId = e.group_id ? `group_${e.group_id}` : `user_${e.user_id}`;
    chatActiveMap[sessionId] = 0;

    if (lastRequestTime[sessionId]) {
        delete lastRequestTime[sessionId];
    }

    if (/全部/.test(e.msg)) {
        const fs = await import('fs');
        const path = await import('path');
        const files = fs.readdirSync(CHAT_CONTEXT_PATH);
        for (const file of files) {
            const filePath = path.join(CHAT_CONTEXT_PATH, file);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        Object.keys(chatActiveMap).forEach(key => chatActiveMap[key] = 0);
        Object.keys(lastRequestTime).forEach(key => delete lastRequestTime[key]);
        e.reply('已清除全部对话缓存！');
        return;
    }

    const keyv = getSessionKeyv(sessionId);
    await keyv.delete('chatMsg');

    e.reply('已经重置对话了！');
}
