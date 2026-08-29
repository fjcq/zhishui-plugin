/**
 * 消息工具处理器 v3
 * 支持灵活的消息组合，包括多个@、图片、文本混合发送
 */

import { SceneAdapter } from './sceneAdapter.js';
import { MessageValidator, MessageSender, MessageResult, MessageBuilder, SceneType, cleanImageUrl, extractMessageId, checkReplyResult } from './messageUtils.js';
import { downloadImageSmart } from '../../api/utils/requestUtils.js';
import { getSegment } from './shared/utils.js';
import VoiceManager from '../../../voice/voiceManager.js';
import Config from '../../../../components/Config.js';
import { logger } from '../../../../components/index.js';
import { checkVoiceConfig } from './shared/voiceUtils.js';
import { applyResponseMode } from '../../chatHelper.js';

/**
 * 消息工具名称列表
 */
export const MESSAGE_TOOLS = [
    'send_message',
    'send_image',
    'send_voice',
    'send_private_message',
    'send_group_message',
    'forward_message',
    'recall_message',
    'set_essence_message',
    'get_scene_info',
    'get_group_member_info',
    'get_recent_messages'
];

/**
 * 处理消息工具调用
 * @param {string} toolName - 工具名称
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象
 * @param {string} currentUserId - 当前对话用户ID
 * @returns {Promise<object>} 工具执行结果
 */
export async function handleMessageToolCall(toolName, params, e, currentUserId) {
    let result;
    try {
        const adapter = SceneAdapter.create(e);

        switch (toolName) {
            case 'send_message':
                result = await handleSendMessage(params, adapter);
                break;

            case 'send_image':
                result = await handleSendImage(params, adapter);
                break;

            case 'send_voice':
                result = await handleSendVoice(params, adapter);
                break;

            case 'send_private_message':
                result = await handleSendPrivateMessage(params, e);
                break;

            case 'send_group_message':
                result = await handleSendGroupMessage(params, e);
                break;

            case 'forward_message':
                result = await handleForwardMessage(params, adapter);
                break;

            case 'recall_message':
                result = await handleRecallMessage(params, adapter);
                break;

            case 'set_essence_message':
                result = await handleSetEssenceMessage(params, adapter);
                break;

            case 'get_scene_info':
                result = await handleGetSceneInfo(params, adapter);
                break;

            case 'get_group_member_info':
                result = await handleGetGroupMemberInfo(params, adapter);
                break;

            case 'get_recent_messages':
                result = await handleGetRecentMessages(params, e);
                break;

            default:
                result = { error: true, error_message: `未知的消息工具: ${toolName}` };
        }
    } catch (error) {
        logger.error(`[消息工具] ${toolName} 执行失败: ${error.message}`);
        result = { error: true, error_message: `操作失败: ${error.message}` };
    }

    return result;
}

/**
 * 从 MessageResult 中提取消息ID并展开为工具结果字段
 * @param {object} result - MessageResult 实例（message_id 在 result.data 中）
 * @returns {object} 含 message_id 时返回 { message_id }，否则空对象
 */
function withMessageId(result) {
    const messageId = result?.data?.message_id;
    return messageId !== undefined && messageId !== null ?
        { message_id: String(messageId) } : {};
}

/**
 * 处理通用消息发送
 * 支持两种方式：
 * 1. segments 数组：自由组合消息段
 * 2. text 文本：支持特殊标记 [CQ:at,qq=用户ID]、@[用户ID]、[CQ:image,url=URL]、[image:URL]
 */
async function handleSendMessage(params, adapter) {
    const { segments, text, reply_to } = params;

    if (!segments && !text) {
        return { error: true, error_message: '消息内容不能为空，需要提供 segments 或 text' };
    }

    try {
        const segment = await getSegment();
        if (!segment) {
            logger.error('[消息工具] segment模块加载失败，无法发送复杂消息');
            if (text && !segments && !reply_to) {
                logger.info('[消息工具] 降级为纯文本消息发送');
                const ret = await adapter.e.reply(text);
                const replyError = checkReplyResult(ret);
                if (replyError) {
                    return { error: true, error_message: `消息发送失败: ${replyError}` };
                }
                const messageId = extractMessageId(ret);
                return {
                    success: true,
                    message: '消息发送成功（降级模式：纯文本）',
                    features: ['文本'],
                    degraded: true,
                    ...(messageId ? { message_id: messageId } : {})
                };
            }
            return {
                error: true,
                error_message: '无法加载segment模块，无法发送复杂消息（@、图片、回复）。请检查oicq或icqq模块是否正确安装。'
            };
        }

        const messageParts = [];

        if (reply_to) {
            const msgValidation = MessageValidator.validateMessageId(reply_to);
            if (!msgValidation.valid) {
                return { error: true, error_message: msgValidation.error };
            }
            messageParts.push(segment.reply(reply_to));
        }

        if (segments && Array.isArray(segments) && segments.length > 0) {
            const parsedParts = await parseSegments(segments, segment, adapter);
            if (parsedParts.error) {
                return parsedParts;
            }
            messageParts.push(...parsedParts);
        } else if (text) {
            const parsedParts = await parseTextWithMarkers(text, segment, adapter);
            if (parsedParts.error) {
                return parsedParts;
            }
            messageParts.push(...parsedParts);
        }

        if (messageParts.length === 0) {
            return { error: true, error_message: '消息内容不能为空' };
        }

        const ret = await adapter.e.reply(messageParts);
        const replyError = checkReplyResult(ret);
        if (replyError) {
            logger.error(`[消息工具] 消息发送失败: ${replyError}`);
            return { error: true, error_message: `消息发送失败: ${replyError}` };
        }
        const messageId = extractMessageId(ret);

        const features = [];
        const atCount = messageParts.filter(p => p?.type === 'at').length;
        const imageCount = messageParts.filter(p => p?.type === 'image').length;
        const hasReply = messageParts.some(p => p?.type === 'reply');

        if (hasReply) features.push('回复');
        if (atCount > 0) features.push(`${atCount}个@`);
        if (imageCount > 0) features.push(`${imageCount}张图片`);
        features.push('文本');

        logger.info(`[消息工具] 发送消息成功 | 功能:${features.join(', ')}${messageId ? ` | 消息ID:${messageId}` : ''}`);

        return {
            success: true,
            message: '消息发送成功',
            features: features,
            ...(messageId ? { message_id: messageId } : {}),
            at_count: atCount,
            image_count: imageCount
        };
    } catch (error) {
        logger.error(`[消息工具] 发送消息失败: ${error.message}`);
        return { error: true, error_message: `发送消息失败: ${error.message}` };
    }
}

/**
 * 解析消息段数组
 * @param {Array} segments - 消息段数组
 * @param {object} segment - segment模块
 * @param {object} adapter - 场景适配器
 * @returns {Promise<Array|object>} 消息段数组或错误对象
 */
async function parseSegments(segments, segment, adapter) {
    const messageParts = [];

    for (const seg of segments) {
        if (!seg || !seg.type) {
            continue;
        }

        switch (seg.type) {
            case 'text':
                if (seg.text) {
                    const textValidation = MessageValidator.validateText(seg.text);
                    if (!textValidation.valid) {
                        return { error: true, error_message: textValidation.error };
                    }
                    messageParts.push(seg.text);
                }
                break;

            case 'at':
                if (adapter.context.isPrivate()) {
                    logger.warn('[消息工具] 私聊场景跳过@功能');
                    break;
                }
                if (seg.user_id) {
                    const userValidation = MessageValidator.validateUserId(seg.user_id);
                    if (!userValidation.valid) {
                        return { error: true, error_message: userValidation.error };
                    }
                    messageParts.push(segment.at(seg.user_id));
                }
                break;

            case 'image':
                if (seg.url) {
                    const imgValidation = MessageValidator.validateImageUrl(seg.url);
                    if (!imgValidation.valid) {
                        return { error: true, error_message: imgValidation.error };
                    }
                    messageParts.push(segment.image(seg.url));
                }
                break;

            case 'reply':
                if (seg.message_id) {
                    const msgValidation = MessageValidator.validateMessageId(seg.message_id);
                    if (!msgValidation.valid) {
                        return { error: true, error_message: msgValidation.error };
                    }
                    messageParts.push(segment.reply(seg.message_id));
                }
                break;

            default:
                logger.warn(`[消息工具] 未知的消息段类型: ${seg.type}`);
        }
    }

    return messageParts;
}

/**
 * 解析文本中的特殊标记
 * 支持 [CQ:at,qq=用户ID]、@[用户ID] 和 [image:URL]、[CQ:image,url=URL]
 * @param {string} text - 文本内容
 * @param {object} segment - segment模块
 * @param {object} adapter - 场景适配器
 * @returns {Promise<Array|object>} 消息段数组或错误对象
 */
async function parseTextWithMarkers(text, segment, adapter) {
    const messageParts = [];

    // 同时兼容 CQ 码格式与简化格式，避免 AI 按系统提示词输出 CQ 码时原样露出
    const atCqRegex = /\[CQ:at,qq=(\d+)\]/g;
    const atSimpleRegex = /@\[(\d+)\]/g;
    const atBracketRegex = /\[@(\d+)\]/g;
    const imageCqRegex = /\[CQ:image,url=([^\]]+)\]/g;
    const imageSimpleRegex = /\[image:([^\]]+)\]/g;

    const markers = [];
    let match;

    while ((match = atCqRegex.exec(text)) !== null) {
        markers.push({
            type: 'at',
            user_id: match[1],
            start: match.index,
            end: match.index + match[0].length,
            fullMatch: match[0]
        });
    }

    while ((match = atSimpleRegex.exec(text)) !== null) {
        markers.push({
            type: 'at',
            user_id: match[1],
            start: match.index,
            end: match.index + match[0].length,
            fullMatch: match[0]
        });
    }

    while ((match = atBracketRegex.exec(text)) !== null) {
        markers.push({
            type: 'at',
            user_id: match[1],
            start: match.index,
            end: match.index + match[0].length,
            fullMatch: match[0]
        });
    }

    while ((match = imageCqRegex.exec(text)) !== null) {
        markers.push({
            type: 'image',
            url: match[1],
            start: match.index,
            end: match.index + match[0].length,
            fullMatch: match[0]
        });
    }

    while ((match = imageSimpleRegex.exec(text)) !== null) {
        markers.push({
            type: 'image',
            url: match[1],
            start: match.index,
            end: match.index + match[0].length,
            fullMatch: match[0]
        });
    }

    markers.sort((a, b) => a.start - b.start);

    let lastEnd = 0;
    for (const marker of markers) {
        if (marker.start > lastEnd) {
            const textPart = text.substring(lastEnd, marker.start);
            if (textPart) {
                const textValidation = MessageValidator.validateText(textPart);
                if (!textValidation.valid) {
                    return { error: true, error_message: textValidation.error };
                }
                messageParts.push(textPart);
            }
        }

        switch (marker.type) {
            case 'at':
                if (adapter.context.isPrivate()) {
                    logger.warn('[消息工具] 私聊场景跳过@功能');
                    break;
                }
                const userValidation = MessageValidator.validateUserId(marker.user_id);
                if (!userValidation.valid) {
                    return { error: true, error_message: userValidation.error };
                }
                messageParts.push(segment.at(marker.user_id));
                break;

            case 'image':
                const imgValidation = MessageValidator.validateImageUrl(marker.url);
                if (!imgValidation.valid) {
                    return { error: true, error_message: imgValidation.error };
                }
                messageParts.push(segment.image(marker.url));
                break;
        }

        lastEnd = marker.end;
    }

    if (lastEnd < text.length) {
        const textPart = text.substring(lastEnd);
        if (textPart) {
            const textValidation = MessageValidator.validateText(textPart);
            if (!textValidation.valid) {
                return { error: true, error_message: textValidation.error };
            }
            messageParts.push(textPart);
        }
    }

    return messageParts;
}

/** QQ 图床域名：链接带时效性 rkey 且常被反引号包裹，本地转 base64 发送更可靠 */
const QQ_IMAGE_HOSTS = ['gchat.qpic.cn', 'multimedia.nt.qq.com.cn', 'multimedia.nt.qq.com', 'grouptalk.c2c.qq.com'];

/**
 * 判断是否为 QQ 图床链接
 * @param {string} url - 图片URL
 * @returns {boolean} 是否QQ图床链接
 */
function isQqImageHost(url) {
    try {
        return QQ_IMAGE_HOSTS.includes(new URL(url).hostname.toLowerCase());
    } catch {
        return false;
    }
}

/**
 * 处理发送图片
 * QQ 图床链接带分钟级时效 rkey 且历史消息中的 URL 常被反引号包裹，
 * 直传给协议端下载极易 400：经 downloadImageSmart 三级策略
 * （直链/get_image本地缓存/get_image新链）取 base64 后发送；
 * 支持传入 file_id（来自 get_recent_messages）提高历史图片成功率
 */
async function handleSendImage(params, adapter) {
    const { caption = '' } = params;
    const rawUrl = String(params.url || '');
    const url = cleanImageUrl(rawUrl);
    const fileId = String(params.file_id || params.file || '');

    if (url && url !== rawUrl) {
        logger.info(`[消息工具] send_image URL已清理: ${url.substring(0, 60)}${url.length > 60 ? '...' : ''}`);
    }

    // QQ 图床链接或携带文件ID：三级策略取 base64 发送，绕开 URL 直传的时效与包裹问题
    if ((url && isQqImageHost(url)) || fileId) {
        const downloaded = await downloadImageSmart({
            url,
            fileId,
            e: adapter?.e,
            source: '消息工具'
        });

        if (downloaded) {
            const result = await adapter.sendImage(`base64://${downloaded.base64}`, caption);
            if (result.success) {
                logger.info('[消息工具] send_image 已通过base64发送');
                return { success: true, url: url || fileId, caption, ...withMessageId(result) };
            }
            return { error: true, error_message: `图片发送失败: ${result.error}` };
        }

        // 三级策略全部失败：回退直传原始链接交由协议端尝试，仍失败则明确告知链接过期
        if (url) {
            const result = await adapter.sendImage(url, caption);
            return result.success ?
                { success: true, url, caption, ...withMessageId(result) } :
                { error: true, error_message: `图片发送失败（链接可能已过期）: ${result.error}` };
        }
        return { error: true, error_message: '图片获取失败，历史图片链接可能已过期，无法重新发送' };
    }

    // 普通网络图片：校验后直接发送
    const validation = MessageValidator.validateImageUrl(url);
    if (!validation.valid) {
        return { error: true, error_message: validation.error };
    }

    const result = await adapter.sendImage(url, caption);

    return result.success ?
        { success: true, url, caption, ...withMessageId(result) } :
        { error: true, error_message: result.error };
}

/**
 * 处理发送语音
 */
async function handleSendVoice(params, adapter) {
    const { text } = params;

    if (!text) {
        return { error: true, error_message: '缺少语音文本参数' };
    }

    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
        return { error: true, error_message: '语音文本不能为空' };
    }

    if (trimmedText.length > 500) {
        return { error: true, error_message: '语音文本过长，请控制在500字符以内' };
    }

    try {
        const configCheck = checkVoiceConfig();

        if (!configCheck.hasConfig) {
            return { error: true, error_message: configCheck.message };
        }

        const segment = await getSegment();
        if (!segment) {
            logger.error('[消息工具] segment模块加载失败，无法发送语音消息');
            return {
                error: true,
                error_message: '无法加载segment模块，无法发送语音消息。请检查oicq或icqq模块是否正确安装。'
            };
        }

        const e = adapter.e;
        const originalVoiceSystem = Config.Voice.VoiceSystem;
        const tempModify = originalVoiceSystem !== configCheck.configType;

        if (tempModify) {
            Config.modify('voice', 'VoiceSystem', configCheck.configType);
        }

        let voiceResult;
        try {
            voiceResult = await VoiceManager.synthesize(e, trimmedText);
        } finally {
            if (tempModify) {
                Config.modify('voice', 'VoiceSystem', originalVoiceSystem);
            }
        }

        if (!voiceResult) {
            return { error: true, error_message: '语音合成失败，请检查语音系统配置' };
        }

        if (typeof voiceResult === 'string') {
            // 白名单提取清理语音URL，防止首尾包裹字符（反引号等）导致协议端下载失败
            const voiceUrl = cleanImageUrl(voiceResult);
            const voiceMsg = segment.record(voiceUrl);
            const ret = await e.reply(voiceMsg);
            const replyError = checkReplyResult(ret);
            if (replyError) {
                return { error: true, error_message: `语音发送失败: ${replyError}` };
            }
            logger.info(`[消息工具] 发送语音(DUI) | 文本:${trimmedText.substring(0, 30)}...`);
        } else if (Array.isArray(voiceResult) && voiceResult.length > 0) {
            const uploadRecord = (await import('../../../../model/uploadRecord.js')).default;
            for (let i = 0; i < voiceResult.length; i++) {
                const buffer = voiceResult[i];
                const voiceMsg = await uploadRecord(buffer);
                if (voiceMsg) {
                    const ret = await e.reply(voiceMsg);
                    const replyError = checkReplyResult(ret);
                    if (replyError) {
                        return { error: true, error_message: `语音发送失败（第${i + 1}段）: ${replyError}` };
                    }
                }
            }
            logger.info(`[消息工具] 发送语音(腾讯云) | 文本:${trimmedText.substring(0, 30)}... | 分段:${voiceResult.length}`);
        } else {
            return { error: true, error_message: '语音合成返回结果无效' };
        }

        return {
            success: true,
            text: trimmedText
        };
    } catch (error) {
        logger.error(`[消息工具] 发送语音失败: ${error.message}`);
        return { error: true, error_message: `发送语音失败: ${error.message}` };
    }
}

/**
 * 处理发送私聊消息
 */
async function handleSendPrivateMessage(params, e) {
    const { user_id, message } = params;

    const userValidation = MessageValidator.validateUserId(user_id);
    if (!userValidation.valid) {
        return { error: true, error_message: userValidation.error };
    }

    if (!message) {
        return { error: true, error_message: '消息内容不能为空' };
    }

    // 根据回复模式处理消息内容
    const processedMessage = await applyResponseMode(message);

    const result = await MessageSender.sendPrivate(e.bot, user_id, processedMessage);

    return result.success ?
        { success: true, user_id } :
        { error: true, error_message: result.error };
}

/**
 * 处理发送群消息
 */
async function handleSendGroupMessage(params, e) {
    const { group_id, message } = params;

    const groupValidation = MessageValidator.validateGroupId(group_id);
    if (!groupValidation.valid) {
        return { error: true, error_message: groupValidation.error };
    }

    if (!message) {
        return { error: true, error_message: '消息内容不能为空' };
    }

    // 根据回复模式处理消息内容
    const processedMessage = await applyResponseMode(message);

    const result = await MessageSender.sendGroup(e.bot, group_id, processedMessage);

    return result.success ?
        { success: true, group_id } :
        { error: true, error_message: result.error };
}

/**
 * 处理转发消息
 */
async function handleForwardMessage(params, adapter) {
    const { target_group_id, message } = params;

    const groupValidation = MessageValidator.validateGroupId(target_group_id);
    if (!groupValidation.valid) {
        return { error: true, error_message: groupValidation.error };
    }

    if (!message) {
        return { error: true, error_message: '消息内容不能为空' };
    }

    // 根据回复模式处理消息内容
    const processedMessage = await applyResponseMode(message);

    const result = await adapter.forwardMessage(target_group_id, processedMessage);

    return result.success ?
        { success: true, target_group_id, ...withMessageId(result) } :
        { error: true, error_message: result.error };
}

/**
 * 处理撤回消息
 */
async function handleRecallMessage(params, adapter) {
    const { message_id } = params;

    const validation = MessageValidator.validateMessageId(message_id);
    if (!validation.valid) {
        return { error: true, error_message: validation.error };
    }

    const result = await adapter.recallMessage(message_id);

    return result.success ?
        { success: true, message_id } :
        { error: true, error_message: result.error };
}

/**
 * 处理设置精华消息
 */
async function handleSetEssenceMessage(params, adapter) {
    const { message_id } = params;

    const validation = MessageValidator.validateMessageId(message_id);
    if (!validation.valid) {
        return { error: true, error_message: validation.error };
    }

    const result = await adapter.setEssenceMessage(message_id);

    return result.success ?
        { success: true, message_id } :
        { error: true, error_message: result.error };
}

/**
 * 处理获取场景信息
 */
async function handleGetSceneInfo(params, adapter) {
    const contextInfo = adapter.getContextInfo();
    const permission = await adapter.context.getBotPermission();

    return {
        success: true,
        scene: {
            ...contextInfo,
            bot_permission: permission
        }
    };
}

/**
 * 处理获取群成员信息
 */
async function handleGetGroupMemberInfo(params, adapter) {
    if (adapter.context.isPrivate()) {
        return { error: true, error_message: '私聊场景无法获取群成员信息' };
    }

    const user_id = params.user_id || adapter.context.userId;
    const memberInfo = await adapter.context.getMemberInfo(user_id);

    if (!memberInfo) {
        return { error: true, error_message: '无法获取群成员信息' };
    }

    return {
        success: true,
        member: memberInfo
    };
}

/** 获取聊天记录默认条数 */
const DEFAULT_HISTORY_COUNT = 10;

/** 获取聊天记录最大条数 */
const MAX_HISTORY_COUNT = 30;

/**
 * 处理获取最近聊天记录
 * 通过宿主提供的群/好友 getChatHistory 接口拉取当前会话的历史消息，
 * 排除触发本次对话的消息本身，按时间从早到晚返回
 * 每条消息携带 message_id，供 recall_message 撤回、send_message reply_to 回复等使用
 * @param {object} params - 工具参数
 * @param {number} [params.count] - 获取条数，默认10条，最多30条
 * @param {object} e - 事件对象
 * @returns {Promise<object>} 聊天记录结果（messages 数组含 message_id/sender/user_id/time/content）
 */
async function handleGetRecentMessages(params, e) {
    if (!e) {
        return { error: true, error_message: '当前场景无法获取聊天记录' };
    }

    const count = clampHistoryCount(params.count);

    // 解析聊天记录拉取目标
    // 注意：TRSS-Yunzai 事件无 is_group 属性，需以 group_id 判定群聊；
    // 且群消息事件中 e.friend 也被赋值（Bot 与发送者的私聊对象），判定顺序不能颠倒
    const historyTarget = resolveHistoryTarget(e);

    if (!historyTarget) {
        return { error: true, error_message: '当前环境不支持获取聊天记录' };
    }

    const history = await fetchHistoryWithFallback(historyTarget.target, historyTarget.anchor, count + 1, historyTarget.scene);

    if (history === null) {
        return { error: true, error_message: '获取聊天记录失败，请稍后再试' };
    }

    if (!Array.isArray(history) || history.length === 0) {
        return { error: true, error_message: '没有找到最近的聊天记录' };
    }

    let list = history.filter(Boolean);

    // 优先按消息ID排除当前触发消息
    const beforeExclude = list.length;
    if (e.message_id !== undefined && e.message_id !== null) {
        list = list.filter(m => String(m.message_id ?? '') !== String(e.message_id));
    }

    // 消息ID未能排除时（部分平台历史消息ID与事件ID不一致），按锚点回退判断末尾元素
    if (list.length === beforeExclude && list.length > 0) {
        const last = list[list.length - 1];
        const isCurrent = historyTarget.scene === 'group'
            ? (Number(e.seq) > 0 && Number(last.seq) === Number(e.seq))
            : (Number(e.time) > 0 && Number(last.time) === Number(e.time)
                && Number(last.sender?.user_id) === Number(e.user_id));
        if (isCurrent) {
            list = list.slice(0, -1);
        }
    }

    // 只保留最近 count 条，并按时间从早到晚排序
    list = list.slice(-count).sort((a, b) => (a.time || 0) - (b.time || 0));

    const images = [];
    const messages = list.map(m => ({
        message_id: String(m.message_id ?? ''),
        sender: m.sender?.card || m.sender?.nickname || '未知用户',
        user_id: String(m.sender?.user_id ?? ''),
        time: formatHistoryTime(m.time),
        content: formatHistoryMessage(m, images, m.sender?.card || m.sender?.nickname || '未知用户')
    })).filter(m => m.content);

    if (messages.length === 0) {
        return { error: true, error_message: '最近的聊天记录里没有可读的内容' };
    }

    return {
        success: true,
        scene: historyTarget.scene,
        count: messages.length,
        messages,
        ...(images.length > 0 ? { images } : {})
    };
}

/**
 * 解析聊天记录拉取目标
 * 群聊判定以 group_id 为主（TRSS-Yunzai 事件无 is_group 属性），
 * 兼容其他适配器的 is_group 标记；e.group 缺失时尝试经 Bot.pickGroup 补建。
 * 必须先判群再判私聊：TRSS 在群消息事件中也会赋值 e.friend（Bot 与发送者的
 * 私聊对象），顺序颠倒会导致群里查到私聊记录
 * @param {object} e - 事件对象
 * @returns {{target: object, anchor: number, scene: string}|null} 拉取目标信息
 */
function resolveHistoryTarget(e) {
    const isGroup = Boolean(e.group_id || e.is_group || (e.group && !e.friend));

    // OneBotv11 系适配器把锚点透传为真实消息序号查库，而事件上的 seq/time 并非有效序号，
    // 直接跳过锚点（拉取最新），避免每次必失败一次的无谓请求
    const skipAnchor = /onebot/i.test(String(e.adapter_name || ''));

    if (isGroup) {
        let group = e.group;
        if (typeof group?.getChatHistory !== 'function' && e.group_id && typeof e.bot?.pickGroup === 'function') {
            try {
                group = e.bot.pickGroup(e.group_id);
            } catch (error) {
                logger.debug(`[消息工具] pickGroup 补建失败: ${error.message}`);
            }
        }

        if (typeof group?.getChatHistory === 'function') {
            return { target: group, anchor: skipAnchor ? 0 : e.seq, scene: 'group' };
        }
    }

    if (typeof e.friend?.getChatHistory === 'function') {
        return { target: e.friend, anchor: skipAnchor ? 0 : e.time, scene: 'private' };
    }

    return null;
}

/**
 * 校验并限制聊天记录获取条数
 * @param {number|null|undefined} value - AI 传入的条数
 * @returns {number} 修正后的条数
 */
function clampHistoryCount(value) {
    if (!Number.isInteger(value) || value <= 0) {
        return DEFAULT_HISTORY_COUNT;
    }
    return Math.min(value, MAX_HISTORY_COUNT);
}

/**
 * 带回退的聊天记录拉取
 * 两类适配器锚点语义不一致：icqq 接受消息序号/时间且总能命中；
 * OneBotv11（NapCat 等）把锚点透传给 get_group_msg_history 按序号查库，
 * 而 e.seq 实为 message_id（非真实序号），会报"消息不存在"。
 * 因此锚点失败时回退为锚点 0（拉取最新消息），当前消息由调用方按 message_id 排除
 * @param {object} target - e.group 或 e.friend 对象
 * @param {number} anchor - 锚点（群消息序号 / 私聊消息时间）
 * @param {number} count - 拉取条数
 * @param {string} scene - 场景标识（group/private，仅用于日志）
 * @returns {Promise<Array|null>} 历史消息数组，两级尝试均失败时返回 null
 */
async function fetchHistoryWithFallback(target, anchor, count, scene) {
    if (anchor !== undefined && anchor !== null && !(Number.isFinite(anchor) && Number(anchor) === 0)) {
        try {
            const history = await target.getChatHistory(anchor, count);
            if (Array.isArray(history) && history.length > 0) {
                return history;
            }
        } catch (error) {
            logger.debug(`[消息工具] ${scene} 锚点拉取失败，回退最新模式: ${error.message}`);
        }
    }

    try {
        return await target.getChatHistory(0, count);
    } catch (error) {
        logger.warn(`[消息工具] ${scene} 聊天记录拉取失败: ${error.message}`);
        return null;
    }
}

/**
 * 格式化历史消息时间为 HH:MM 形式
 * @param {number} time - 消息时间戳（秒）
 * @returns {string} 格式化时间，无法解析时返回空字符串
 */
function formatHistoryTime(time) {
    if (!Number.isFinite(time) || time <= 0) {
        return '';
    }
    const date = new Date(time * 1000);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * 将历史消息转换为可读的文本内容
 * 兼容 icqq 风格消息段（text/url/qq 直接挂在段对象上）与
 * OneBot 风格消息段（数据在 data 字段内）两种格式
 * 图片消息会提取 URL 写入正文占位符，并收集到 images 数组供多模态管线使用
 * @param {object} msg - 历史消息对象
 * @param {Array<{sender: string, url: string}>} [imageCollector] - 图片收集数组（可选）
 * @param {string} [senderName] - 该消息发送者名称（用于图片归属标注）
 * @returns {string} 可读文本，无可读内容时返回空字符串
 */
function formatHistoryMessage(msg, imageCollector = null, senderName = '') {
    if (typeof msg.message === 'string') {
        return msg.message.trim();
    }

    if (!Array.isArray(msg.message)) {
        return '';
    }

    const parts = [];
    for (const seg of msg.message) {
        const data = seg?.data || {};
        switch (seg?.type) {
            case 'text':
                parts.push(seg.text || data.text || '');
                break;
            case 'at': {
                const target = seg.qq ?? data.qq;
                parts.push(target ? `@${target}` : '@某人');
                break;
            }
            case 'image': {
                // 兼容 icqq（seg.url）与 OneBot（data.url）两种格式；
                // NapCat 历史消息的 url 可能被反引号/空白包裹且 & 被转义，统一清理后使用
                const url = cleanImageUrl(seg.url || data.url || '');
                // 文件ID：URL 下载失败（rkey 过期等）时可经 OneBot get_image 接口换取新鲜链接
                const fileId = seg.file || data.file || seg.file_id || data.file_id || '';
                if (url && imageCollector) {
                    imageCollector.push({ sender: senderName, url, ...(fileId ? { file_id: fileId } : {}) });
                    parts.push(`[图片: ${url}]`);
                } else if (url) {
                    parts.push(`[图片: ${url}]`);
                } else {
                    parts.push('[图片]');
                }
                break;
            }
            case 'record':
                parts.push('[语音]');
                break;
            case 'video':
                parts.push('[视频]');
                break;
            case 'file':
                parts.push(`[文件${seg.name || data.name ? ':' + (seg.name || data.name) : ''}]`);
                break;
            case 'face':
                parts.push(`[表情${seg.text || data.text ? ':' + (seg.text || data.text) : ''}]`);
                break;
            case 'reply':
                parts.push('[回复]');
                break;
            case 'forward':
                parts.push('[合并转发]');
                break;
            case 'json':
            case 'xml':
                parts.push('[卡片消息]');
                break;
            default:
                // 其余消息类型对理解上下文帮助有限，忽略
                break;
        }
    }

    return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export default {
    handleMessageToolCall,
    MESSAGE_TOOLS
};
