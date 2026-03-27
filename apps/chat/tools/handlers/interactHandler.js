/**
 * 互动工具处理函数
 * 处理AI调用的互动相关工具
 */

import { isBotAdmin } from '../permissions.js';

/**
 * 处理互动工具调用
 * @param {string} toolName - 工具名称
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象
 * @param {string} currentUserId - 当前对话用户ID
 * @returns {Promise<object>} 工具执行结果
 */
export async function handleInteractToolCall(toolName, params, e, currentUserId) {
    try {
        switch (toolName) {
            case 'poke_user':
                return await handlePokeUser(params, e, currentUserId);
            case 'send_image':
                return await handleSendImage(params, e);
            case 'send_voice':
                return await handleSendVoice(params, e);
            case 'send_private_message':
                return await handleSendPrivateMessage(params, e);
            case 'forward_message':
                return await handleForwardMessage(params, e);
            case 'set_essence_message':
                return await handleSetEssenceMessage(params, e);
            default:
                return { error: true, message: `未知的互动工具: ${toolName}` };
        }
    } catch (error) {
        logger.error(`[互动工具] ${toolName} 执行失败: ${error.message}`);
        return { error: true, message: `操作失败: ${error.message}` };
    }
}

/**
 * 处理戳一戳用户
 */
async function handlePokeUser(params, e, currentUserId) {
    const user_id = params.user_id || currentUserId;

    if (!user_id) {
        return { error: true, message: '缺少用户ID参数' };
    }

    if (!e || !e.group_id) {
        return { error: true, message: '戳一戳功能仅在群组中可用' };
    }

    try {
        const group = e.group || e.bot?.pickGroup?.(e.group_id);
        if (!group) {
            return { error: true, message: '无法获取群组信息' };
        }

        await group.pokeMember?.(user_id);
        logger.info(`[互动] 戳一戳 | 群:${e.group_id} | 用户:${user_id}`);

        return {
            success: true,
            user_id: String(user_id),
            message: `已戳一戳用户 ${user_id}`
        };
    } catch (error) {
        return { error: true, message: `戳一戳失败: ${error.message}` };
    }
}

/**
 * 处理发送图片
 */
async function handleSendImage(params, e) {
    const { url, caption = '' } = params;

    if (!url) {
        return { error: true, message: '缺少图片URL参数' };
    }

    if (!e) {
        return { error: true, message: '无法发送消息：缺少事件对象' };
    }

    try {
        const segment = await import('oicq').then(m => m.segment).catch(() =>
            import('icqq').then(m => m.segment)
        );

        if (!segment) {
            return { error: true, message: '无法加载segment模块' };
        }

        const imageMsg = segment.image(url);
        const message = caption ? [imageMsg, caption] : [imageMsg];

        await e.reply(message);
        logger.info(`[互动] 发送图片 | URL:${url.substring(0, 50)}...`);

        return {
            success: true,
            url: url,
            caption: caption,
            message: '图片已发送'
        };
    } catch (error) {
        return { error: true, message: `发送图片失败: ${error.message}` };
    }
}

/**
 * 处理发送语音
 */
async function handleSendVoice(params, e) {
    const { text } = params;

    if (!text) {
        return { error: true, message: '缺少语音文本参数' };
    }

    if (!e) {
        return { error: true, message: '无法发送消息：缺少事件对象' };
    }

    try {
        const segment = await import('oicq').then(m => m.segment).catch(() =>
            import('icqq').then(m => m.segment)
        );

        if (!segment) {
            return { error: true, message: '无法加载segment模块' };
        }

        const voiceMsg = await segment.record(text);
        await e.reply(voiceMsg);
        logger.info(`[互动] 发送语音 | 文本:${text.substring(0, 30)}...`);

        return {
            success: true,
            text: text,
            message: '语音已发送'
        };
    } catch (error) {
        return { error: true, message: `发送语音失败: ${error.message}` };
    }
}

/**
 * 处理发送私聊消息
 */
async function handleSendPrivateMessage(params, e) {
    const { user_id, message } = params;

    if (!user_id || !message) {
        return { error: true, message: '缺少用户ID或消息内容参数' };
    }

    if (!e || !e.bot) {
        return { error: true, message: '无法发送私聊消息：缺少Bot实例' };
    }

    try {
        const friend = e.bot.pickFriend?.(user_id);
        if (!friend) {
            return { error: true, message: `用户 ${user_id} 不是好友，无法发送私聊消息` };
        }

        await friend.sendMsg?.(message);
        logger.info(`[互动] 发送私聊 | 用户:${user_id} | 内容:${message.substring(0, 30)}...`);

        return {
            success: true,
            user_id: String(user_id),
            message: `私聊消息已发送给用户 ${user_id}`
        };
    } catch (error) {
        return { error: true, message: `发送私聊消息失败: ${error.message}` };
    }
}

/**
 * 处理转发消息
 */
async function handleForwardMessage(params, e) {
    const { target_group_id, message } = params;

    if (!target_group_id || !message) {
        return { error: true, message: '缺少目标群ID或消息内容参数' };
    }

    if (!e || !e.bot) {
        return { error: true, message: '无法转发消息：缺少Bot实例' };
    }

    try {
        const targetGroup = e.bot.pickGroup?.(target_group_id);
        if (!targetGroup) {
            return { error: true, message: `无法访问群组 ${target_group_id}` };
        }

        await targetGroup.sendMsg?.(message);
        logger.info(`[互动] 转发消息 | 目标群:${target_group_id} | 内容:${message.substring(0, 30)}...`);

        return {
            success: true,
            target_group_id: String(target_group_id),
            message: `消息已转发到群 ${target_group_id}`
        };
    } catch (error) {
        return { error: true, message: `转发消息失败: ${error.message}` };
    }
}

/**
 * 处理设置精华消息
 */
async function handleSetEssenceMessage(params, e) {
    const { message_id } = params;

    if (!message_id) {
        return { error: true, message: '缺少消息ID参数' };
    }

    if (!e || !e.group_id) {
        return { error: true, message: '设置精华消息仅在群组中可用' };
    }

    const isAdmin = await isBotAdmin(e);
    if (!isAdmin) {
        return { error: true, message: '设置精华消息需要Bot是管理员' };
    }

    try {
        const group = e.group || e.bot?.pickGroup?.(e.group_id);
        if (!group) {
            return { error: true, message: '无法获取群组信息' };
        }

        await group.setEssenceMessage?.(message_id);
        logger.mark(`[互动] 设置精华 | 群:${e.group_id} | 消息ID:${message_id}`);

        return {
            success: true,
            message_id: message_id,
            message: '消息已设为精华'
        };
    } catch (error) {
        return { error: true, message: `设置精华消息失败: ${error.message}` };
    }
}
