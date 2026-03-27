/**
 * 群管理工具处理函数
 * 处理AI调用的群管理相关工具
 */

import {
    checkToolPermission,
    validateMuteDuration,
    formatMuteDuration,
    isBotOwner
} from '../permissions.js';

/**
 * 处理群管理工具调用
 * @param {string} toolName - 工具名称
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象
 * @returns {Promise<object>} 工具执行结果
 */
export async function handleGroupToolCall(toolName, params, e) {
    if (!e || !e.group_id) {
        return { error: true, message: '此功能仅在群组中可用' };
    }

    const permission = await checkToolPermission(toolName, e, params);
    if (!permission.allowed) {
        return { error: true, message: permission.reason };
    }

    try {
        switch (toolName) {
            case 'mute_group_member':
                return await handleMuteMember(params, e);
            case 'set_group_card':
                return await handleSetGroupCard(params, e);
            case 'set_group_title':
                return await handleSetGroupTitle(params, e);
            case 'kick_group_member':
                return await handleKickMember(params, e);
            case 'delete_message':
                return await handleDeleteMessage(params, e);
            case 'set_group_name':
                return await handleSetGroupName(params, e);
            case 'set_group_announcement':
                return await handleSetGroupAnnouncement(params, e);
            default:
                return { error: true, message: `未知的群管理工具: ${toolName}` };
        }
    } catch (error) {
        logger.error(`[群管理工具] ${toolName} 执行失败: ${error.message}`);
        return { error: true, message: `操作失败: ${error.message}` };
    }
}

/**
 * 处理禁言成员
 */
async function handleMuteMember(params, e) {
    const { user_id, duration = 60, reason = '' } = params;

    if (!user_id) {
        return { error: true, message: '缺少用户ID参数' };
    }

    const muteDuration = validateMuteDuration(duration);
    const group = e.group || e.bot?.pickGroup?.(e.group_id);

    if (!group) {
        return { error: true, message: '无法获取群组信息' };
    }

    try {
        if (muteDuration === 0) {
            await group.muteMember?.(user_id, 0);
            logger.mark(`[群管理] 解除禁言 | 群:${e.group_id} | 用户:${user_id}`);
            return {
                success: true,
                user_id: String(user_id),
                action: 'unmute',
                message: `已解除用户 ${user_id} 的禁言`
            };
        }

        await group.muteMember?.(user_id, muteDuration);
        logger.mark(`[群管理] 禁言 | 群:${e.group_id} | 用户:${user_id} | 时长:${muteDuration}秒 | 原因:${reason}`);

        return {
            success: true,
            user_id: String(user_id),
            duration: muteDuration,
            duration_text: formatMuteDuration(muteDuration),
            reason: reason,
            message: `已将用户 ${user_id} 禁言 ${formatMuteDuration(muteDuration)}`
        };
    } catch (error) {
        return { error: true, message: `禁言操作失败: ${error.message}` };
    }
}

/**
 * 处理设置群名片
 */
async function handleSetGroupCard(params, e) {
    const { user_id, card } = params;

    if (!user_id) {
        return { error: true, message: '缺少用户ID参数' };
    }

    if (card === undefined || card === null) {
        return { error: true, message: '缺少名片内容参数' };
    }

    const group = e.group || e.bot?.pickGroup?.(e.group_id);
    if (!group) {
        return { error: true, message: '无法获取群组信息' };
    }

    try {
        await group.setCard?.(user_id, card);
        logger.mark(`[群管理] 修改名片 | 群:${e.group_id} | 用户:${user_id} | 新名片:${card}`);

        return {
            success: true,
            user_id: String(user_id),
            card: card,
            message: card ? `已将用户 ${user_id} 的群名片修改为: ${card}` : `已清除用户 ${user_id} 的群名片`
        };
    } catch (error) {
        return { error: true, message: `修改名片失败: ${error.message}` };
    }
}

/**
 * 处理设置群头衔
 */
async function handleSetGroupTitle(params, e) {
    const { user_id, title } = params;

    if (!user_id) {
        return { error: true, message: '缺少用户ID参数' };
    }

    const isOwner = await isBotOwner(e);
    if (!isOwner) {
        return { error: true, message: '设置专属头衔需要Bot是群主' };
    }

    const group = e.group || e.bot?.pickGroup?.(e.group_id);
    if (!group) {
        return { error: true, message: '无法获取群组信息' };
    }

    try {
        await group.setTitle?.(user_id, title);
        logger.mark(`[群管理] 设置头衔 | 群:${e.group_id} | 用户:${user_id} | 头衔:${title}`);

        return {
            success: true,
            user_id: String(user_id),
            title: title,
            message: title ? `已为用户 ${user_id} 设置专属头衔: ${title}` : `已清除用户 ${user_id} 的专属头衔`
        };
    } catch (error) {
        return { error: true, message: `设置头衔失败: ${error.message}` };
    }
}

/**
 * 处理移出群成员
 */
async function handleKickMember(params, e) {
    const { user_id, reason = '', reject_add_request = false } = params;

    if (!user_id) {
        return { error: true, message: '缺少用户ID参数' };
    }

    const group = e.group || e.bot?.pickGroup?.(e.group_id);
    if (!group) {
        return { error: true, message: '无法获取群组信息' };
    }

    try {
        await group.kickMember?.(user_id, reject_add_request);
        logger.mark(`[群管理] 移出成员 | 群:${e.group_id} | 用户:${user_id} | 原因:${reason} | 拒绝再加:${reject_add_request}`);

        return {
            success: true,
            user_id: String(user_id),
            reason: reason,
            message: `已将用户 ${user_id} 移出群组`
        };
    } catch (error) {
        return { error: true, message: `移出成员失败: ${error.message}` };
    }
}

/**
 * 处理撤回消息
 */
async function handleDeleteMessage(params, e) {
    const { message_id } = params;

    if (!message_id) {
        return { error: true, message: '缺少消息ID参数' };
    }

    const group = e.group || e.bot?.pickGroup?.(e.group_id);
    if (!group) {
        return { error: true, message: '无法获取群组信息' };
    }

    try {
        await group.recallMsg?.(message_id);
        logger.mark(`[群管理] 撤回消息 | 群:${e.group_id} | 消息ID:${message_id}`);

        return {
            success: true,
            message_id: message_id,
            message: '消息已撤回'
        };
    } catch (error) {
        return { error: true, message: `撤回消息失败: ${error.message}` };
    }
}

/**
 * 处理修改群名称
 */
async function handleSetGroupName(params, e) {
    const { group_name } = params;

    if (!group_name) {
        return { error: true, message: '缺少群名称参数' };
    }

    const group = e.group || e.bot?.pickGroup?.(e.group_id);
    if (!group) {
        return { error: true, message: '无法获取群组信息' };
    }

    try {
        await group.setName?.(group_name);
        logger.mark(`[群管理] 修改群名 | 群:${e.group_id} | 新名称:${group_name}`);

        return {
            success: true,
            group_name: group_name,
            message: `群名称已修改为: ${group_name}`
        };
    } catch (error) {
        return { error: true, message: `修改群名称失败: ${error.message}` };
    }
}

/**
 * 处理发布群公告
 */
async function handleSetGroupAnnouncement(params, e) {
    const { content, image } = params;

    if (!content) {
        return { error: true, message: '缺少公告内容参数' };
    }

    const group = e.group || e.bot?.pickGroup?.(e.group_id);
    if (!group) {
        return { error: true, message: '无法获取群组信息' };
    }

    try {
        if (image) {
            await group.setAnnouncement?.(content, image);
        } else {
            await group.setAnnouncement?.(content);
        }
        logger.mark(`[群管理] 发布公告 | 群:${e.group_id} | 内容:${content.substring(0, 50)}...`);

        return {
            success: true,
            content: content,
            message: '群公告已发布'
        };
    } catch (error) {
        return { error: true, message: `发布公告失败: ${error.message}` };
    }
}
