/**
 * 消息工具处理器 v3
 * 支持灵活的消息组合，包括多个@、图片、文本混合发送
 */

import { SceneAdapter } from './sceneAdapter.js';
import { MessageValidator, MessageSender, MessageResult, MessageBuilder, SceneType } from './messageUtils.js';
import { getSegment } from './musicCore.js';
import VoiceManager from '../../../voice/voiceManager.js';
import Config from '../../../../components/Config.js';

const logger = global.logger || console;

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
    'get_group_member_info'
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
 * 处理通用消息发送
 * 支持两种方式：
 * 1. segments 数组：自由组合消息段
 * 2. text 文本：支持特殊标记 @[用户ID] 和 [image:URL]
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
                await adapter.e.reply(text);
                return {
                    success: true,
                    message: '消息发送成功（降级模式：纯文本）',
                    features: ['文本'],
                    degraded: true
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

        await adapter.e.reply(messageParts);

        const features = [];
        const atCount = messageParts.filter(p => p?.type === 'at').length;
        const imageCount = messageParts.filter(p => p?.type === 'image').length;
        const hasReply = messageParts.some(p => p?.type === 'reply');

        if (hasReply) features.push('回复');
        if (atCount > 0) features.push(`${atCount}个@`);
        if (imageCount > 0) features.push(`${imageCount}张图片`);
        features.push('文本');

        logger.info(`[消息工具] 发送消息成功 | 功能:${features.join(', ')}`);

        return {
            success: true,
            message: '消息发送成功',
            features: features,
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
 * 支持 @[用户ID] 和 [image:URL]
 * @param {string} text - 文本内容
 * @param {object} segment - segment模块
 * @param {object} adapter - 场景适配器
 * @returns {Promise<Array|object>} 消息段数组或错误对象
 */
async function parseTextWithMarkers(text, segment, adapter) {
    const messageParts = [];

    const atRegex = /@\[(\d+)\]/g;
    const imageRegex = /\[image:([^\]]+)\]/g;

    const markers = [];
    let match;

    while ((match = atRegex.exec(text)) !== null) {
        markers.push({
            type: 'at',
            user_id: match[1],
            start: match.index,
            end: match.index + match[0].length,
            fullMatch: match[0]
        });
    }

    while ((match = imageRegex.exec(text)) !== null) {
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

/**
 * 处理发送图片
 */
async function handleSendImage(params, adapter) {
    const { url, caption = '' } = params;

    const validation = MessageValidator.validateImageUrl(url);
    if (!validation.valid) {
        return { error: true, error_message: validation.error };
    }

    const result = await adapter.sendImage(url, caption);

    return result.success ?
        { success: true, url, caption } :
        { error: true, error_message: result.error };
}

/**
 * 检查语音系统是否已配置
 * @returns {object} { hasConfig: boolean, configType: number, message: string }
 */
function checkVoiceConfig() {
    const voiceConfig = Config.Voice;
    const tencentConfig = voiceConfig?.TencentCloudTTS;

    const hasTencentConfig = tencentConfig?.SecretId &&
        tencentConfig?.SecretKey &&
        tencentConfig.SecretId !== '你的腾讯云SecretId' &&
        tencentConfig.SecretKey !== '你的腾讯云SecretKey';

    const hasDuiConfig = voiceConfig?.VoiceIndex !== undefined;

    if (hasTencentConfig) {
        return { hasConfig: true, configType: 2, message: '腾讯云语音已配置' };
    }

    if (hasDuiConfig) {
        return { hasConfig: true, configType: 1, message: 'DUI平台语音已配置' };
    }

    return {
        hasConfig: false,
        configType: 0,
        message: '语音系统未配置。请主人使用指令配置：\n"对话语音开启" - 开启DUI平台语音系统\n"对话语音开启腾讯" - 开启腾讯云语音系统（需先配置SecretId和SecretKey）'
    };
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
            const voiceMsg = segment.record(voiceResult);
            await e.reply(voiceMsg);
            logger.info(`[消息工具] 发送语音(DUI) | 文本:${trimmedText.substring(0, 30)}...`);
        } else if (Array.isArray(voiceResult) && voiceResult.length > 0) {
            const uploadRecord = (await import('../../../../model/uploadRecord.js')).default;
            for (let i = 0; i < voiceResult.length; i++) {
                const buffer = voiceResult[i];
                const voiceMsg = await uploadRecord(buffer);
                if (voiceMsg) {
                    await e.reply(voiceMsg);
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

    const result = await MessageSender.sendPrivate(e.bot, user_id, message);

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

    const result = await MessageSender.sendGroup(e.bot, group_id, message);

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

    const result = await adapter.forwardMessage(target_group_id, message);

    return result.success ?
        { success: true, target_group_id } :
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

export default {
    handleMessageToolCall,
    MESSAGE_TOOLS
};
