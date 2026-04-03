/**
 * 互动工具处理函数
 * 处理AI调用的互动相关工具
 */

import { isBotAdmin } from '../permissions.js';
import { handleMusicToolCall } from './musicHandler.js';
import { handleMemeToolCall } from './memeHandler.js';
import { getSegment } from './musicCore.js';
import VoiceManager from '../../../voice/voiceManager.js';
import Config from '../../../../components/Config.js';

const logger = global.logger || console;

/**
 * 处理互动工具调用
 * @param {string} toolName - 工具名称
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象
 * @param {string} currentUserId - 当前对话用户ID
 * @returns {Promise<object>} 工具执行结果
 */
export async function handleInteractToolCall(toolName, params, e, currentUserId) {
    let result;
    try {
        switch (toolName) {
            case 'poke_user':
                result = await handlePokeUser(params, e, currentUserId);
                break;
            case 'send_image':
                result = await handleSendImage(params, e);
                break;
            case 'send_voice':
                result = await handleSendVoice(params, e);
                break;
            case 'send_private_message':
                result = await handleSendPrivateMessage(params, e);
                break;
            case 'forward_message':
                result = await handleForwardMessage(params, e);
                break;
            case 'set_essence_message':
                result = await handleSetEssenceMessage(params, e);
                break;
            case 'search_music':
            case 'play_music':
            case 'get_lyrics':
            case 'get_playlist':
                result = await handleMusicToolCall(toolName, params, e);
                break;
            case 'generate_meme':
                result = await handleMemeToolCall(toolName, params, e, currentUserId);
                break;
            default:
                result = { error: true, error_message: `未知的互动工具: ${toolName}` };
        }
    } catch (error) {
        logger.error(`[互动工具] ${toolName} 执行失败: ${error.message}`);
        result = { error: true, error_message: `操作失败: ${error.message}` };
    }

    return result;
}

/**
 * 处理戳一戳用户
 */
async function handlePokeUser(params, e, currentUserId) {
    const user_id = params.user_id || currentUserId;

    if (!user_id) {
        return { error: true, error_message: '缺少用户ID参数' };
    }

    if (!e) {
        return { error: true, error_message: '无法获取事件对象' };
    }

    const isGroup = !!e.group_id;
    const errors = [];

    try {
        // ========== 私聊戳一戳 ==========
        if (!isGroup) {
            // 方法1: NapCatQQ native API - friend_poke
            if (e.bot?.sendApi) {
                try {
                    await e.bot.sendApi('friend_poke', {
                        user_id: Number(user_id)
                    });
                    logger.info(`[互动] 戳一戳(friend_poke) | 私聊用户:${user_id}`);
                    return { success: true, user_id: String(user_id) };
                } catch (err) {
                    errors.push(`friend_poke: ${err.message}`);
                }
            }

            // 方法2: 标准OneBot API
            if (typeof e.bot?.sendFriendPoke === 'function') {
                try {
                    await e.bot.sendFriendPoke(user_id);
                    logger.info(`[互动] 戳一戳(sendFriendPoke) | 私聊用户:${user_id}`);
                    return { success: true, user_id: String(user_id) };
                } catch (err) {
                    errors.push(`sendFriendPoke: ${err.message}`);
                }
            }

            logger.warn(`[互动] 私聊戳一戳失败，尝试过的方法: ${errors.join('; ')}`);
            return { error: true, error_message: `私聊戳一戳暂不支持，错误详情: ${errors.join('; ')}` };
        }

        // ========== 群聊戳一戳 ==========
        const group = e.group || e.bot?.pickGroup?.(e.group_id);
        if (!group) {
            return { error: true, error_message: '无法获取群组信息' };
        }

        // 方法1: NapCatQQ native API - group_poke
        if (e.bot?.sendApi) {
            try {
                await e.bot.sendApi('group_poke', {
                    group_id: Number(e.group_id),
                    user_id: Number(user_id)
                });
                logger.info(`[互动] 戳一戳(group_poke) | 群:${e.group_id} | 用户:${user_id}`);
                return { success: true, user_id: String(user_id) };
            } catch (err) {
                errors.push(`group_poke: ${err.message}`);
            }
        }

        // 方法2: 标准OneBot API - sendGroupPoke
        if (typeof e.bot?.sendGroupPoke === 'function') {
            try {
                await e.bot.sendGroupPoke(e.group_id, user_id);
                logger.info(`[互动] 戳一戳(sendGroupPoke) | 群:${e.group_id} | 用户:${user_id}`);
                return { success: true, user_id: String(user_id) };
            } catch (err) {
                errors.push(`sendGroupPoke: ${err.message}`);
            }
        }

        // 方法3: Yunzai原生 - pokeMember
        if (typeof group.pokeMember === 'function') {
            try {
                await group.pokeMember(user_id);
                logger.info(`[互动] 戳一戳(pokeMember) | 群:${e.group_id} | 用户:${user_id}`);
                return { success: true, user_id: String(user_id) };
            } catch (err) {
                errors.push(`pokeMember: ${err.message}`);
            }
        }

        // 方法4: 发送消息格式 - { type: 'poke', data: { qq: ... } }
        if (typeof group.sendMsg === 'function') {
            try {
                await group.sendMsg({ type: 'poke', data: { qq: Number(user_id) } });
                logger.info(`[互动] 戳一戳(sendMsg) | 群:${e.group_id} | 用户:${user_id}`);
                return { success: true, user_id: String(user_id) };
            } catch (err) {
                errors.push(`sendMsg: ${err.message}`);
            }
        }

        // 方法5: 其他OneBot实现 - set_group_poke
        if (e.bot?.sendApi) {
            try {
                await e.bot.sendApi('set_group_poke', {
                    group_id: e.group_id,
                    user_id: user_id
                });
                logger.info(`[互动] 戳一戳(set_group_poke) | 群:${e.group_id} | 用户:${user_id}`);
                return { success: true, user_id: String(user_id) };
            } catch (err) {
                errors.push(`set_group_poke: ${err.message}`);
            }
        }

        logger.warn(`[互动] 群聊戳一戳失败，尝试过的方法: ${errors.join('; ')}`);
        return { error: true, error_message: `群聊戳一戳暂不支持，错误详情: ${errors.join('; ')}` };
    } catch (error) {
        return { error: true, error_message: `戳一戳失败: ${error.message}` };
    }
}

/**
 * 处理发送图片
 */
async function handleSendImage(params, e) {
    const { url, caption = '' } = params;

    if (!url) {
        return { error: true, error_message: '缺少图片URL参数' };
    }

    if (!e) {
        return { error: true, error_message: '无法发送消息：缺少事件对象' };
    }

    try {
        const segment = await getSegment();

        if (!segment) {
            return { error: true, error_message: '无法加载segment模块' };
        }

        const imageMsg = segment.image(url);
        const message = caption ? [imageMsg, caption] : [imageMsg];

        await e.reply(message);
        logger.info(`[互动] 发送图片 | URL:${url.substring(0, 50)}...`);

        return {
            success: true,
            url: url,
            caption: caption
        };
    } catch (error) {
        return { error: true, error_message: `发送图片失败: ${error.message}` };
    }
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
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象
 * @returns {Promise<object>} 工具执行结果
 */
async function handleSendVoice(params, e) {
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

    if (!e) {
        return { error: true, error_message: '无法发送消息：缺少事件对象' };
    }

    try {
        const configCheck = checkVoiceConfig();

        if (!configCheck.hasConfig) {
            return { error: true, error_message: configCheck.message };
        }

        const segment = await getSegment();
        if (!segment) {
            return { error: true, error_message: '无法加载segment模块' };
        }

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
            logger.info(`[互动] 发送语音(DUI) | 文本:${trimmedText.substring(0, 30)}...`);
        } else if (Array.isArray(voiceResult) && voiceResult.length > 0) {
            const uploadRecord = (await import('../../../../model/uploadRecord.js')).default;
            for (let i = 0; i < voiceResult.length; i++) {
                const buffer = voiceResult[i];
                const voiceMsg = await uploadRecord(buffer);
                if (voiceMsg) {
                    await e.reply(voiceMsg);
                }
            }
            logger.info(`[互动] 发送语音(腾讯云) | 文本:${trimmedText.substring(0, 30)}... | 分段:${voiceResult.length}`);
        } else {
            return { error: true, error_message: '语音合成返回结果无效' };
        }

        return {
            success: true,
            text: trimmedText
        };
    } catch (error) {
        logger.error(`[互动] 发送语音失败: ${error.message}`);
        return { error: true, error_message: `发送语音失败: ${error.message}` };
    }
}

/**
 * 处理发送私聊消息
 */
async function handleSendPrivateMessage(params, e) {
    const { user_id, message } = params;

    if (!user_id || !message) {
        return { error: true, error_message: '缺少用户ID或消息内容参数' };
    }

    if (!e || !e.bot) {
        return { error: true, error_message: '无法发送私聊消息：缺少Bot实例' };
    }

    try {
        const friend = e.bot.pickFriend?.(user_id);
        if (!friend) {
            return { error: true, error_message: `用户 ${user_id} 不是好友，无法发送私聊消息` };
        }

        await friend.sendMsg?.(message);
        logger.info(`[互动] 发送私聊 | 用户:${user_id} | 内容:${message.substring(0, 30)}...`);

        return {
            success: true,
            user_id: String(user_id)
        };
    } catch (error) {
        return { error: true, error_message: `发送私聊消息失败: ${error.message}` };
    }
}

/**
 * 处理转发消息
 */
async function handleForwardMessage(params, e) {
    const { target_group_id, message } = params;

    if (!target_group_id || !message) {
        return { error: true, error_message: '缺少目标群ID或消息内容参数' };
    }

    if (!e || !e.bot) {
        return { error: true, error_message: '无法转发消息：缺少Bot实例' };
    }

    try {
        const targetGroup = e.bot.pickGroup?.(target_group_id);
        if (!targetGroup) {
            return { error: true, error_message: `无法访问群组 ${target_group_id}` };
        }

        await targetGroup.sendMsg?.(message);
        logger.info(`[互动] 转发消息 | 目标群:${target_group_id} | 内容:${message.substring(0, 30)}...`);

        return {
            success: true,
            target_group_id: String(target_group_id)
        };
    } catch (error) {
        return { error: true, error_message: `转发消息失败: ${error.message}` };
    }
}

/**
 * 处理设置精华消息
 */
async function handleSetEssenceMessage(params, e) {
    const { message_id } = params;

    if (!message_id) {
        return { error: true, error_message: '缺少消息ID参数' };
    }

    if (!e || !e.group_id) {
        return { error: true, error_message: '设置精华消息仅在群组中可用' };
    }

    const isAdmin = await isBotAdmin(e);
    if (!isAdmin) {
        return { error: true, error_message: '设置精华消息需要Bot是管理员' };
    }

    try {
        const group = e.group || e.bot?.pickGroup?.(e.group_id);
        if (!group) {
            return { error: true, error_message: '无法获取群组信息' };
        }

        await group.setEssenceMessage?.(message_id);
        logger.mark(`[互动] 设置精华 | 群:${e.group_id} | 消息ID:${message_id}`);

        return {
            success: true,
            message_id: message_id
        };
    } catch (error) {
        return { error: true, error_message: `设置精华消息失败: ${error.message}` };
    }
}
