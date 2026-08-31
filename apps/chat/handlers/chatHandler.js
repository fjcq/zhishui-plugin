/**
 * 对话核心处理模块
 * 处理对话的主要逻辑
 */

import { Config, logger } from '../../../components/index.js';
import {
    chatActiveMap,
    lastRequestTime,
    API_INTERVALS,
    getContextMode,
    GLOBAL_QUEUE_KEY,
    chatQueue,
    chatQueueBusy
} from '../config.js';
import { convertAtFormat, convertMessageFormat } from '../parsers/index.js';
import { checkRateLimit, getUserFavor, setUserFavor } from '../user/index.js';
import { openAi, loadChatMsg, clearSessionContext, getSessionKeyv, generateSessionId } from '../helpers.js';
import { resolveModel } from '../configs/manager.js';
import { createProvider } from '../providers/index.js';
import { mergeSystemMessage } from '../configs/systemMessage.js';
import { sanitizeModelOutput, safeParseJsonWithTail, extractPlainTextFromJson } from '../api/utils/requestUtils.js';

/**
 * 转义正则表达式特殊字符
 * @param {string} str - 原始字符串
 * @returns {string} 转义后的字符串
 */
function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 单个队列允许的最大排队消息数，超出时丢弃最旧的消息作为保护 */
const MAX_QUEUE_LIMIT = 50;

/**
 * 计算对话队列键
 * 角色整合（role）模式下所有对话共用一个全局队列，实现全局串行；
 * 场景隔离（isolated）模式下按会话（用户+群）隔离队列，不同会话可并行。
 * @param {string} lockId - 会话锁ID
 * @param {boolean} isGlobalQueue - 是否为全局队列模式
 * @returns {string} 队列键
 */
function getQueueKey(lockId, isGlobalQueue) {
    return isGlobalQueue ? GLOBAL_QUEUE_KEY : lockId;
}

/**
 * 判断指定队列是否正处于处理中
 * @param {string} key - 队列键
 * @returns {boolean} 是否繁忙
 */
function isQueueBusy(key) {
    return chatQueueBusy[key] === true;
}

/**
 * 设置队列繁忙标记
 * @param {string} key - 队列键
 * @param {boolean} busy - 是否繁忙
 */
function setQueueBusy(key, busy) {
    chatQueueBusy[key] = busy;
}

/**
 * 将待处理对话加入队列
 * @param {Object} item - 待处理项 {e, chatNickname}
 * @param {string} key - 队列键
 */
function enqueueChat(item, key) {
    const queue = chatQueue[key] || (chatQueue[key] = []);
    queue.push(item);
    if (queue.length > MAX_QUEUE_LIMIT) {
        queue.shift();
    }
}

/**
 * 从队列取出下一条对话并继续处理
 * 在AI处理完上一条后调用，实现排队消息的自动接续，避免直接丢弃。
 * @param {string} key - 队列键
 */
function processNextInQueue(key) {
    const queue = chatQueue[key];
    if (!queue || queue.length === 0) {
        if (queue) delete chatQueue[key];
        return;
    }
    const next = queue.shift();
    if (queue.length === 0) {
        delete chatQueue[key];
    }
    // 提前声明占用，避免在 await 间隙被其他消息插入导致并发
    setQueueBusy(key, true);
    setTimeout(() => {
        handleChat(next.e, next.chatNickname, { fromQueue: true, isGlobalQueue: key === GLOBAL_QUEUE_KEY })
            .catch((err) => logger.error(`处理排队对话失败: ${err.message}`));
    }, 0);
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
 * 生成并发控制锁ID
 * 用于区分不同用户/群的并发请求，允许多用户并行处理
 * @param {Object} e - 事件对象
 * @returns {string} 锁ID
 */
function generateLockId(e) {
    if (e.group_id) {
        return `group_${e.group_id}_user_${e.user_id}`;
    }
    return `user_${e.user_id}`;
}

/**
 * 检查并发状态和频率限制
 * @param {string} lockId - 并发控制锁ID
 * @param {string} queueKey - 队列键
 * @param {Object} e - 事件对象
 * @param {boolean} fromQueue - 是否从队列接续处理（跳过频率限制，队列本身已串行）
 * @returns {Promise<{allowed: boolean, reason?: string, waitTime?: number}>} 检查结果
 */
async function checkConcurrencyAndRateLimit(lockId, queueKey, e, fromQueue = false) {
    // 从队列接续处理的消息，已由 processNextInQueue 占用队列并保证串行，直接放行
    if (fromQueue) {
        return { allowed: true };
    }

    if (isQueueBusy(queueKey)) {
        return { allowed: false, reason: 'processing' };
    }

    const now = Date.now();
    const lastTime = lastRequestTime[lockId] || 0;

    // 按当前生效provider的格式类型查询请求间隔（新配置结构）
    const resolved = await resolveModel(e);
    const apiType = resolved?.provider?.type || 'default';
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
 * @returns {Promise<{processedMsg: string, images: string[], files: string[], replyContent: Object|null}>} 解析结果
 */
async function parseMessage(e) {
    let images = [];
    let files = [];
    let replyContent = null;
    let processedMsg = e.msg || '';
    const botId = Bot?.uin || e.bot?.uin || e.bot?.id;

    if (Array.isArray(e.message)) {
        let msgParts = [];
        for (const seg of e.message) {
            if (seg.type === 'text' && seg.text) {
                msgParts.push(seg.text);
            } else if (seg.type === 'at' && seg.qq) {
                if (botId && String(seg.qq) === String(botId)) {
                    msgParts.push('@你');
                } else {
                    msgParts.push(`@[${seg.qq}]`);
                }
            } else if (seg.type === 'image' && seg.url) {
                images.push(seg.url);
            } else if (seg.type === 'file' && seg.file) {
                files.push(seg.file);
            } else if (seg.type === 'reply' && seg.id) {
                try {
                    const replyMsg = await getReplyMessage(e, seg.id);
                    if (replyMsg) {
                        replyContent = replyMsg;
                        if (replyMsg.text) {
                            msgParts.push(`[引用消息: ${replyMsg.text.substring(0, 100)}${replyMsg.text.length > 100 ? '...' : ''}]`);
                        }
                        if (replyMsg.images && replyMsg.images.length > 0) {
                            images.push(...replyMsg.images);
                        }
                    }
                } catch (err) {
                    logger.warn(`[解析消息] 获取引用消息失败: ${err.message}`);
                }
            }
        }
        if (msgParts.length > 0) {
            processedMsg = msgParts.join('');
        }
    }

    return { processedMsg, images, files, replyContent };
}

/**
 * 获取引用消息内容
 * @param {Object} e - 事件对象
 * @param {string} messageId - 消息ID
 * @returns {Promise<Object|null>} 引用消息内容
 */
async function getReplyMessage(e, messageId) {
    try {
        let reply = null;

        if (typeof e.getReply === 'function') {
            reply = await e.getReply();
        } else if (e.source) {
            if (e.group?.getChatHistory) {
                reply = (await e.group.getChatHistory(e.source.seq, 1)).pop();
            } else if (e.friend?.getChatHistory) {
                reply = (await e.friend.getChatHistory(e.source.time, 1)).pop();
            }
        }

        if (!reply) {
            return null;
        }

        const result = {
            text: '',
            images: [],
            sender: reply.sender?.nickname || '未知用户',
            sender_id: reply.sender?.user_id || ''
        };

        if (reply.message) {
            for (const msg of reply.message) {
                if (msg.type === 'text' && msg.text) {
                    result.text += msg.text;
                } else if (msg.type === 'image' && msg.url) {
                    result.images.push(msg.url);
                }
            }
        }

        return result;
    } catch (error) {
        logger.warn(`[获取引用消息] 失败: ${error.message}`);
        return null;
    }
}

/**
 * API重试策略配置（匹配新架构统一错误码）
 */
const RETRY_STRATEGIES = {
    rate_limit: {
        shouldRetry: (error) => error.type === 'rate_limit' || error.message.includes('请求频繁') || error.message.includes('请求过于频繁'),
        getWaitTime: (retryCount) => Math.min(3000 * retryCount, 12000),
        getUserMessage: () => '请求繁忙，正在自动重试中，请稍等...',
        getLogMessage: () => '请求频繁'
    },
    network_error: {
        shouldRetry: (error) => error.type === 'network' || error.type === 'server_error',
        getWaitTime: (retryCount) => 2000 * retryCount,
        getUserMessage: () => '网络不稳定，正在重试连接...',
        getLogMessage: (error) => error.type || '网络错误'
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
                    await safeReply(e, strategy.getUserMessage());
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
 * 带重试机制的安全消息发送
 * 处理 NTQQ 客户端超时问题
 * @param {Object} e - 事件对象
 * @param {*} content - 消息内容
 * @param {number} maxRetries - 最大重试次数
 * @param {number} retryDelay - 重试延迟(ms)
 * @param {Object|boolean} options - 发送选项
 * @returns {Promise<{success: boolean, error?: Error}>}
 */
async function safeReply(e, content, maxRetries = 2, retryDelay = 1000, options = {}) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            await e.reply(content, options);
            if (attempt > 1) {
                logger.info(`[止水对话] 消息发送重试成功 (第${attempt}次)`);
            }
            return { success: true };
        } catch (error) {
            lastError = error;
            const isTimeout = error.message?.includes('Timeout') || 
                             error.message?.includes('NTEvent') ||
                             error.error?.retcode === 1200;
            
            if (isTimeout && attempt <= maxRetries) {
                logger.warn(`[止水对话] 消息发送超时，${retryDelay}ms后重试 (第${attempt}/${maxRetries}次)`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                retryDelay *= 1.5;
            } else {
                logger.error(`[止水对话] 消息发送失败: ${error.message}`);
                break;
            }
        }
    }
    
    return { success: false, error: lastError };
}

/**
 * 发送文本回复
 * @param {Object} e - 事件对象
 * @param {string} text - 文本内容
 * @returns {Promise<void>}
 */
async function sendTextMessage(e, text) {
    const replyContent = convertMessageFormat(text);
    await safeReply(e, replyContent);
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
        await safeReply(e, codeText, 2, 1000, true);
    }

    let msgWithoutCode = finalReply;
    if (codeText) {
        const { msgWithoutCode: withoutCode } = extractCodeBlocks(finalReply);
        msgWithoutCode = withoutCode;
    }

    if (!msgWithoutCode) {
        return;
    }

    await sendTextMessage(e, msgWithoutCode);
}

/**
 * 处理API错误（新架构：错误对象带统一type码与providerName）
 * @param {Object} e - 事件对象
 * @param {Error} apiError - API错误
 * @returns {Promise<void>}
 */
async function handleApiError(e, apiError) {
    let userMessage = apiError.message;

    if (apiError.type === 'auth') {
        userMessage = `API配置有误，请联系管理员检查API密钥设置\n当前使用模型: ${apiError.providerName || 'unknown'}`;
    } else if (['forbidden', 'network', 'balance', 'model_not_found'].includes(apiError.type)) {
        userMessage = `${apiError.message}\n建议使用命令切换到其他模型，如：#切换模型 <模型别名>`;
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
    await safeReply(e, errorMsg);
}

/**
 * 处理对话核心逻辑
 * 加入队列机制：当同一队列（会话级或全局级）正在处理上一条请求时，
 * 新消息进入队列排队，待上一条处理完成后自动继续，而非回复“稍等”后丢弃。
 * @param {Object} e - 事件对象
 * @param {string} chatNickname - 对话昵称
 * @param {Object} [opts] - 附加参数
 * @param {boolean} [opts.fromQueue] - 是否为队列接续处理
 * @param {boolean} [opts.isGlobalQueue] - 是否为全局队列模式（角色整合）
 * @returns {Promise<boolean>} 处理结果
 */
export async function handleChat(e, chatNickname, opts = {}) {
    const sessionId = await generateSessionId(e);
    const lockId = generateLockId(e);
    const fromQueue = !!opts.fromQueue;
    // 队列粒度跟随存储模式：角色整合（role）用全局队列，场景隔离（isolated）用会话队列
    const isGlobalQueue = opts.isGlobalQueue ?? ((await getContextMode()) === 'role');
    const queueKey = getQueueKey(lockId, isGlobalQueue);

    const triggerValidation = await validateMessageTrigger(e, chatNickname);
    if (!triggerValidation.triggered) {
        chatActiveMap[lockId] = 0;
        if (fromQueue) {
            // 队列接续的消息未通过触发校验：释放占用并继续驱动队列，避免后续消息卡住
            setQueueBusy(queueKey, false);
            processNextInQueue(queueKey);
        }
        return false;
    }

    const concurrencyCheck = await checkConcurrencyAndRateLimit(lockId, queueKey, e, fromQueue);
    if (!concurrencyCheck.allowed) {
        if (concurrencyCheck.reason === 'processing') {
            // 队列繁忙：消息进入队列，AI空闲后自动接续处理，不再回复“稍等”丢弃
            enqueueChat({ e, chatNickname }, queueKey);
            return true;
        }
        // 频率限制：保留友好提示
        await safeReply(e, `请稍等 ${concurrencyCheck.waitTime} 秒后再试，避免请求过于频繁~`);
        return false;
    }

    chatActiveMap[lockId] = 1;
    setQueueBusy(queueKey, true);
    lastRequestTime[lockId] = Date.now();

    try {
        const { processedMsg, images, files, replyContent } = await parseMessage(e);
        const finalMsg = processedMsg.replace(new RegExp(`^#?${escapeRegExp(chatNickname)}\\s*`), '').trim();

        let actualUserId = e.user_id;
        if (e.user_id === 'stdin' || !e.user_id || isNaN(e.user_id) || String(e.user_id).length < 5) {
            actualUserId = await Config.Chat.MasterQQ;
        }

        const rateCheck = await checkRateLimit(actualUserId);
        if (!rateCheck.allowed) {
            await safeReply(e, rateCheck.message);
            chatActiveMap[lockId] = 0;
            return false;
        }

        const favor = await getUserFavor(actualUserId);

        // 新架构：解析当前生效模型并经provider统一接口判断工具支持
        const resolvedModel = await resolveModel(e);
        if (!resolvedModel) {
            chatActiveMap[lockId] = 0;
            await safeReply(e, '未配置可用的AI模型，请先在配置中设置providers/models');
            return false;
        }
        const supportsToolCalling = createProvider(resolvedModel.provider).supportsTools();

        const baseMessage = {
            message: finalMsg,
            images: images,
            files: files,
            reply: replyContent ? {
                text: replyContent.text,
                images: replyContent.images,
                sender: replyContent.sender,
                sender_id: replyContent.sender_id
            } : null,
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
            chatActiveMap[lockId] = 0;
            await handleApiError(e, apiError);
            return false;
        }

        if (!response) {
            chatActiveMap[lockId] = 0;
            await safeReply(e, '服务器繁忙，请稍后再试');
            return false;
        }

        const { content, rawResponse } = response;

        let replyObj;
        // 使用支持尾部垃圾字符的 JSON 解析器：
        // 先清理模型内部控制 token，再尝试截取最大合法 JSON 子串，
        // 避免 thinking/tool-calling 模型在 JSON 末尾追加控制符导致全量回退
        replyObj = safeParseJsonWithTail(content);
        if (!replyObj) {
            // 解析失败的最终回退：直接把清理+剥壳后的纯文本作为 message
            // 剥壳防止模型用 {"message":"..."} 包裹导致用户收到JSON外壳
            const cleanedFallback = extractPlainTextFromJson(sanitizeModelOutput(content));
            replyObj = {
                message: cleanedFallback,
                favor_changes: []
            };
            // 降噪：仅当模型输出看起来"像JSON"（{ 或 [ 开头）时才打 WARN。
            // 模型直接输出自然语言（绝大多数正常聊天场景）不应触发 WARN，
            // 否则日志里满屏"解析失败"会让主人误以为系统有问题。
            const looksLikeJson = (typeof content === 'string') && /^\s*[{[]/.test(content);
            if (looksLikeJson) {
                logger.warn('[止水对话] JSON解析失败，已清理控制token并剥壳后使用纯文本作为回复');
            }
        } else if (typeof replyObj !== 'object' || !replyObj.message) {
            // 解析成功但缺少 message 字段，构造合法结构
            const candidateMsg = typeof replyObj === 'string'
                ? extractPlainTextFromJson(replyObj)
                : extractPlainTextFromJson(sanitizeModelOutput(content));
            replyObj = {
                message: candidateMsg,
                favor_changes: replyObj?.favor_changes || []
            };
            logger.warn('[止水对话] JSON对象缺少message字段，使用剥壳后的内容');
        }
        replyObj.favor_changes = replyObj.favor_changes || [];

        const favorLogs = await handleFavorChanges(replyObj.favor_changes, e);
        if (favorLogs.length > 0) {
            logger.info(`[好感度变更] ${favorLogs.join(' | ')}`);
        }

        // 在发送前最后再做一次清理 + 剥壳，防止任何路径上的控制符/JSON外壳泄漏到用户端
        let finalReply = extractPlainTextFromJson(sanitizeModelOutput(replyObj.message ?? ''));

        // 去除已通过工具调用阶段发送的内容，避免重复推送
        // handleToolCalls 在工具调用前会立即发送 textContent，AI 在 followUp 中常会重复这部分内容
        if (e._sentTexts && e._sentTexts.length > 0) {
            let changed = true;
            while (changed) {
                changed = false;
                for (const sent of e._sentTexts) {
                    if (!finalReply) break;
                    // 完全相同，直接清空
                    if (finalReply === sent) {
                        finalReply = '';
                        changed = true;
                        break;
                    }
                    // finalReply 以已发送内容开头，去除前缀
                    if (finalReply.startsWith(sent)) {
                        finalReply = finalReply.substring(sent.length).trim();
                        changed = true;
                    }
                }
            }
        }

        logger.info(`[止水对话] <- AI回复: ${finalReply}`);

        // 如果最终回复为空（已通过工具调用阶段发送），跳过重复发送
        if (!finalReply) {
            logger.info('[止水对话] 最终回复已通过工具调用阶段发送，跳过重复发送');
            chatActiveMap[lockId] = 0;
            return true;
        }

        const { codeText, msgWithoutCode } = extractCodeBlocks(finalReply);
        const finalCodeText = codeText || (replyObj.code_example?.trim() || '');

        await sendResponse(e, msgWithoutCode || finalReply, finalCodeText);

        chatActiveMap[lockId] = 0;
        return true;
    } catch (error) {
        logger.error(`对话处理过程中发生错误: ${error.message}`);
        logger.error(error.stack);
        chatActiveMap[lockId] = 0;
        await sendErrorReply(e, '发生错误，无法进行对话。请稍后再试。');
        return false;
    } finally {
        // 当前请求结束：释放队列占用并继续处理排队中的下一条
        chatActiveMap[lockId] = 0;
        setQueueBusy(queueKey, false);
        processNextInQueue(queueKey);
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
    const lockId = generateLockId(e);
    
    chatActiveMap[lockId] = 0;

    if (lastRequestTime[lockId]) {
        delete lastRequestTime[lockId];
    }

    if (/全部/.test(e.msg)) {
        const mode = await (await import('../config.js')).getContextMode();
        const targetMode = mode === 'role' ? 'role' : 'isolated';
        const { insertBoundaryAll, isAvailable: storeAvailable } = await import('../storage/chatStore.js');

        Object.keys(chatActiveMap).forEach(key => chatActiveMap[key] = 0);
        Object.keys(lastRequestTime).forEach(key => delete lastRequestTime[key]);

        // 清空全部对话队列与占用标记，避免残留排队消息在重置后继续处理
        const { chatQueue: allQueue, chatQueueBusy: allQueueBusy } = await import('../config.js');
        Object.keys(allQueue).forEach(key => delete allQueue[key]);
        Object.keys(allQueueBusy).forEach(key => delete allQueueBusy[key]);

        // SQLite 路径：全局插入分界标记（AI失忆，历史数据保留）
        if (await storeAvailable()) {
            const count = await insertBoundaryAll();
            e.reply(`已重置全部对话！共重置${count}个会话的AI记忆\n历史消息已保留，可通过 #查聊天记录 检索`);
            return;
        }

        // 降级路径：删除旧文件（旧语义）
        const result = await clearAllSessions(targetMode);

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
