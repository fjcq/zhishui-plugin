/**
 * 对话核心处理模块
 * 处理对话的主要逻辑
 */

import { Config } from '../../../components/index.js';
import { chatActiveMap, lastRequestTime, API_INTERVALS } from '../config.js';
import { convertAtFormat, convertAtToNames, convertMessageFormat } from '../parsers/index.js';
import { textToImage, shouldResponseAsImage } from '../chatHelper.js';
import voiceManager from '../../voice/voiceManager.js';
import { isToolCallingSupported } from '../api-types.js';
import { checkRateLimit, getUserFavor, setUserFavor } from '../user/index.js';
import { openAi, getCurrentApiConfig, loadChatMsg, mergeSystemMessage, clearSessionContext, getSessionKeyv, generateSessionId } from '../helpers.js';

const logger = global.logger || console;

/**
 * 转义正则表达式特殊字符
 * @param {string} str - 原始字符串
 * @returns {string} 转义后的字符串
 */
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

/**
 * 验证消息是否应该触发对话
 * @param {Object} e - 事件对象
 * @param {string} chatNickname - 对话昵称
 * @returns {Promise<{triggered: boolean, reason?: string}>} 验证结果
 */
async function validateMessageTrigger(e, chatNickname) {
    const msg = e.msg;
    
    if (isSpecialCommand(msg)) {
        return { triggered: false, reason: 'special_command' };
    }

    const isPrivate = !e.group_id;
    const enablePrivate = await Config.Chat.EnablePrivateChat;
    const nickname = chatNickname;
    const regex = new RegExp(`^#?${escapeRegExp(nickname)}`);

    if (isPrivate) {
        if (enablePrivate || regex.test(msg)) {
            return { triggered: true };
        }
        return { triggered: false, reason: 'private_not_enabled' };
    }

    const isAtBot = e.atBot && await Config.Chat.EnableAt;
    const isNicknameMatch = regex.test(msg);
    
    if (!isAtBot && !isNicknameMatch) {
        return { triggered: false, reason: 'not_triggered' };
    }
    
    return { triggered: true };
}

/**
 * 检查会话状态和频率限制
 * @param {string} sessionId - 会话ID
 * @returns {Promise<{allowed: boolean, reason?: string, waitTime?: number}>} 检查结果
 */
async function checkSessionAndRateLimit(sessionId) {
    if (chatActiveMap[sessionId] === 1) {
        return { allowed: false, reason: 'processing' };
    }

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
        return { 
            allowed: false, 
            reason: 'rate_limit', 
            waitTime: Math.ceil(waitTime / 1000)
        };
    }

    return { allowed: true };
}

/**
 * 解析消息内容
 * @param {Object} e - 事件对象
 * @returns {{processedMsg: string, images: string[], files: string[]}} 解析结果
 */
function parseMessage(e) {
    let images = [];
    let files = [];
    let processedMsg = e.msg;
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

    return { processedMsg, images, files };
}

/**
 * API重试策略配置
 */
const RETRY_STRATEGIES = {
    rate_limit: {
        shouldRetry: (error) => error.message.includes('请求过于频繁'),
        getWaitTime: (retryCount) => Math.min(3000 * retryCount, 12000),
        getUserMessage: () => '请求繁忙，正在自动重试中，请稍等...',
        getLogMessage: () => '请求频繁'
    },
    network_error: {
        shouldRetry: (error) => error.shouldRetry && (error.type === '连接超时' || error.type === '连接重置'),
        getWaitTime: (retryCount) => 2000 * retryCount,
        getUserMessage: () => '网络不稳定，正在重试连接...',
        getLogMessage: (error) => error.type
    }
};

/**
 * 判断错误类型并获取对应的重试策略
 * @param {Error} apiError - API错误
 * @returns {object|null} 重试策略
 */
function getRetryStrategy(apiError) {
    for (const [key, strategy] of Object.entries(RETRY_STRATEGIES)) {
        if (strategy.shouldRetry(apiError)) {
            return strategy;
        }
    }
    return null;
}

/**
 * 带重试机制的API调用
 * @param {Function} apiCall - API调用函数
 * @param {Object} e - 事件对象
 * @param {number} maxRetries - 最大重试次数
 * @returns {Promise<object>} API响应
 */
async function callApiWithRetry(apiCall, e, maxRetries = 3) {
    let retryCount = 0;
    
    while (retryCount <= maxRetries) {
        try {
            return await apiCall();
        } catch (apiError) {
            logger.error(`[止水对话] API调用失败 (重试${retryCount}/${maxRetries}): ${apiError.message}`);
            
            const strategy = getRetryStrategy(apiError);
            
            if (strategy && retryCount < maxRetries) {
                retryCount++;
                const waitTime = strategy.getWaitTime(retryCount);
                logger.info(`[止水对话] ${strategy.getLogMessage(apiError)}，等待 ${waitTime / 1000} 秒后重试 (${retryCount}/${maxRetries})`);

                if (retryCount === 1) {
                    await e.reply(strategy.getUserMessage());
                }

                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            
            throw apiError;
        }
    }
    
    throw new Error('API调用失败');
}

/**
 * 处理好感度变化
 * @param {Array} favorChanges - 好感度变化数组
 * @param {Object} e - 事件对象
 * @returns {Promise<string[]>} 好感度日志
 */
async function handleFavorChanges(favorChanges, e) {
    const favorLogs = [];
    
    if (!Array.isArray(favorChanges)) {
        return favorLogs;
    }
    
    for (const item of favorChanges) {
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
    
    return favorLogs;
}

/**
 * 提取代码块
 * @param {string} content - 原始内容
 * @returns {{codeText: string, msgWithoutCode: string}} 提取结果
 */
function extractCodeBlocks(content) {
    const codeRegex = /```(?:[\w]*)\n*([\s\S]*?)```/g;
    let codeBlocks = [];
    let msgWithoutCode = content;
    let match;
    
    while ((match = codeRegex.exec(content)) !== null) {
        codeBlocks.push(match[1].trim());
    }
    
    if (codeBlocks.length > 0) {
        msgWithoutCode = content.replace(/```[\w]*\n*[\s\S]*?```/g, '').trim();
    }
    
    return {
        codeText: codeBlocks.join('\n\n'),
        msgWithoutCode
    };
}

/**
 * 发送语音消息
 * @param {Object} e - 事件对象
 * @param {string|Buffer|Array<Buffer>} voiceResult - 语音结果
 * @returns {Promise<void>}
 */
async function sendVoiceMessage(e, voiceResult) {
    if (typeof voiceResult === 'string') {
        await e.reply([segment.record(voiceResult)]);
    } else if (Buffer.isBuffer(voiceResult)) {
        await e.reply([segment.record(voiceResult)]);
    } else if (Array.isArray(voiceResult)) {
        for (let i = 0; i < voiceResult.length; i++) {
            const buffer = voiceResult[i];
            if (Buffer.isBuffer(buffer)) {
                await e.reply([segment.record(buffer)]);
                if (i < voiceResult.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        }
    }
}

/**
 * 发送文本或图片消息
 * @param {Object} e - 事件对象
 * @param {string} text - 文本内容
 * @returns {Promise<void>}
 */
async function sendTextOrImageMessage(e, text) {
    const replyContent = convertMessageFormat(text);

    if (shouldResponseAsImage(e.msg)) {
        const imageSuccess = await textToImage(e, text, {
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

/**
 * 发送响应
 * @param {Object} e - 事件对象
 * @param {string} finalReply - 最终回复内容
 * @param {string} codeText - 代码内容
 * @returns {Promise<void>}
 */
async function sendResponse(e, finalReply, codeText) {
    if (codeText) {
        await e.reply(codeText, true);
    }

    let msgWithoutCode = finalReply;
    if (codeText) {
        const { msgWithoutCode: withoutCode } = extractCodeBlocks(finalReply);
        msgWithoutCode = withoutCode;
    }

    if (!msgWithoutCode) {
        return;
    }

    let textForVoice = await convertAtToNames(msgWithoutCode, e);
    textForVoice = textForVoice.replace(/\s+/g, ' ').trim();

    const MAX_VOICE_TEXT_LENGTH = 500;
    const isTextTooLong = textForVoice.length > MAX_VOICE_TEXT_LENGTH;

    if (!isTextTooLong) {
        const voiceResult = await voiceManager.synthesize(e, textForVoice);
        if (voiceResult) {
            await sendVoiceMessage(e, voiceResult);
            return;
        }
    } else {
        logger.debug(`[止水对话] 文本长度 ${textForVoice.length} 超过限制 ${MAX_VOICE_TEXT_LENGTH}，跳过语音合成`);
    }

    await sendTextOrImageMessage(e, msgWithoutCode);
}

/**
 * 处理API错误
 * @param {Object} e - 事件对象
 * @param {Error} apiError - API错误
 * @param {string} apiType - API类型
 * @returns {Promise<void>}
 */
async function handleApiError(e, apiError, apiType) {
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

    await sendErrorReply(e, userMessage);
}

/**
 * 发送错误回复
 * @param {Object} e - 事件对象
 * @param {string} errorMsg - 错误消息
 * @returns {Promise<void>}
 */
async function sendErrorReply(e, errorMsg) {
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
}

/**
 * 处理对话核心逻辑
 * @param {Object} e - 事件对象
 * @param {string} chatNickname - 对话昵称
 * @returns {Promise<boolean>} 处理结果
 */
export async function handleChat(e, chatNickname) {
    const sessionId = await generateSessionId(e);

    const triggerValidation = await validateMessageTrigger(e, chatNickname);
    if (!triggerValidation.triggered) {
        chatActiveMap[sessionId] = 0;
        return false;
    }

    const sessionCheck = await checkSessionAndRateLimit(sessionId);
    if (!sessionCheck.allowed) {
        chatActiveMap[sessionId] = 0;
        
        if (sessionCheck.reason === 'processing') {
            if (e.group_id) {
                await e.reply([segment.at(e.user_id), '稍等哦，正在处理上一个请求~'], true);
            } else {
                await e.reply('稍等哦，正在处理上一个请求~');
            }
        } else if (sessionCheck.reason === 'rate_limit') {
            await e.reply(`请稍等 ${sessionCheck.waitTime} 秒后再试，避免请求过于频繁~`);
        }
        
        return false;
    }

    chatActiveMap[sessionId] = 1;
    lastRequestTime[sessionId] = Date.now();

    try {
        const { processedMsg, images, files } = parseMessage(e);
        const finalMsg = processedMsg.replace(new RegExp(`^#?${escapeRegExp(chatNickname)}\\s*`), '').trim();

        let actualUserId = e.user_id;
        if (e.user_id === 'stdin' || !e.user_id || isNaN(e.user_id) || String(e.user_id).length < 5) {
            actualUserId = await Config.Chat.MasterQQ;
        }

        const rateCheck = await checkRateLimit(actualUserId);
        if (!rateCheck.allowed) {
            await e.reply(rateCheck.message);
            chatActiveMap[sessionId] = 0;
            return false;
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
        const chatMsg = await loadChatMsg(e);

        if (!chatMsg || chatMsg.length === 0) {
            logger.info('[止水对话] 首次构建上下文，系统提示词:');
            logger.info(systemMessage);
            logger.info('[止水对话] 系统提示词结束');
        }

        let response;
        try {
            response = await callApiWithRetry(
                () => openAi(MessageText, e, systemMessage, chatMsg),
                e,
                3
            );
        } catch (apiError) {
            chatActiveMap[sessionId] = 0;
            await handleApiError(e, apiError, apiType);
            return false;
        }

        if (!response) {
            chatActiveMap[sessionId] = 0;
            await e.reply('服务器繁忙，请稍后再试');
            return false;
        }

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
            logger.warn(`[止水对话] JSON解析失败: ${error.message}，使用原始回复`);
            replyObj = {
                message: content,
                favor_changes: []
            };
            logger.warn('[止水对话] JSON解析失败，使用原始内容:', error.message);
        }
        replyObj.favor_changes = replyObj.favor_changes || [];

        const favorLogs = await handleFavorChanges(replyObj.favor_changes, e);
        if (favorLogs.length > 0) {
            logger.info(`[好感度变更] ${favorLogs.join(' | ')}`);
        }

        let finalReply = replyObj.message ?? '';
        logger.info(`[止水对话] <- AI回复: ${finalReply}`);

        const { codeText, msgWithoutCode } = extractCodeBlocks(finalReply);
        const finalCodeText = codeText || (replyObj.code_example?.trim() || '');

        await sendResponse(e, msgWithoutCode || finalReply, finalCodeText);

        chatActiveMap[sessionId] = 0;
        return true;
    } catch (error) {
        logger.error(`对话处理过程中发生错误: ${error.message}`);
        logger.error(error.stack);
        chatActiveMap[sessionId] = 0;
        await sendErrorReply(e, '发生错误，无法进行对话。请稍后再试。');
        return false;
    }
}

/**
 * 重置对话
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleResetChat(e) {
    const { chatActiveMap, lastRequestTime, CHAT_CONTEXT_PATH, CHAT_CONTEXT_V2_PATH } = await import('../config.js');
    const { clearAllSessions } = await import('../session.js');
    const sessionId = await generateSessionId(e);
    chatActiveMap[sessionId] = 0;

    if (lastRequestTime[sessionId]) {
        delete lastRequestTime[sessionId];
    }

    if (/全部/.test(e.msg)) {
        const { clearAllSessions } = await import('../session.js');
        const mode = await (await import('../config.js')).getContextMode();
        const targetMode = mode === 'role' ? 'role' : 'isolated';
        const result = clearAllSessions(targetMode);

        Object.keys(chatActiveMap).forEach(key => chatActiveMap[key] = 0);
        Object.keys(lastRequestTime).forEach(key => delete lastRequestTime[key]);

        let replyMsg = `已清除全部对话缓存！共清理${result.count}个文件`;
        if (result.errors.length > 0) {
            replyMsg += `\n部分文件清除失败: ${result.errors.slice(0, 3).join('; ')}`;
        }
        e.reply(replyMsg);
        return;
    }

    await clearSessionContext(e);

    e.reply('已经重置对话了！');
}
