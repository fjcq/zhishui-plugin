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
    if (!e || !e.bot) {
        return { error: true, error_message: '缺少必要的事件对象或Bot实例' };
    }

    const permission = await checkToolPermission(toolName, e, params);
    if (!permission.allowed) {
        return { error: true, error_message: permission.reason };
    }

    try {
        switch (toolName) {
            case 'get_group_list':
                return await handleGetGroupList(params, e);
            case 'get_group_info':
                return await handleGetGroupInfo(params, e);
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
                return { error: true, error_message: `未知的群管理工具: ${toolName}` };
        }
    } catch (error) {
        logger.error(`[群管理工具] ${toolName} 执行失败: ${error.message}`);
        return { error: true, error_message: `操作失败: ${error.message}` };
    }
}

/**
 * 处理禁言成员
 */
async function handleMuteMember(params, e) {
    if (!e.group_id) {
        return { error: true, error_message: '禁言功能仅在群组中可用' };
    }

    const { user_id, duration = 60, reason = '' } = params;

    if (!user_id) {
        return { error: true, error_message: '缺少用户ID参数' };
    }

    const muteDuration = validateMuteDuration(duration);
    const group = e.group || e.bot?.pickGroup?.(e.group_id);

    if (!group) {
        return { error: true, error_message: '无法获取群组信息' };
    }

    try {
        if (muteDuration === 0) {
            await group.muteMember?.(user_id, 0);
            logger.mark(`[群管理] 解除禁言 | 群:${e.group_id} | 用户:${user_id}`);
            return {
                success: true,
                user_id: String(user_id),
                action: 'unmute'
            };
        }

        await group.muteMember?.(user_id, muteDuration);
        logger.mark(`[群管理] 禁言 | 群:${e.group_id} | 用户:${user_id} | 时长:${muteDuration}秒 | 原因:${reason}`);

        return {
            success: true,
            user_id: String(user_id),
            duration: muteDuration,
            duration_text: formatMuteDuration(muteDuration),
            reason: reason
        };
    } catch (error) {
        return { error: true, error_message: `禁言操作失败: ${error.message}` };
    }
}

/**
 * 处理设置群名片
 */
async function handleSetGroupCard(params, e) {
    if (!e.group_id) {
        return { error: true, error_message: '修改群名片功能仅在群组中可用' };
    }

    const { user_id, card } = params;

    if (!user_id) {
        return { error: true, error_message: '缺少用户ID参数' };
    }

    if (card === undefined || card === null) {
        return { error: true, error_message: '缺少名片内容参数' };
    }

    const group = e.group || e.bot?.pickGroup?.(e.group_id);
    if (!group) {
        return { error: true, error_message: '无法获取群组信息' };
    }

    try {
        await group.setCard?.(user_id, card);
        logger.mark(`[群管理] 修改名片 | 群:${e.group_id} | 用户:${user_id} | 新名片:${card}`);

        return {
            success: true,
            user_id: String(user_id),
            card: card
        };
    } catch (error) {
        return { error: true, error_message: `修改名片失败: ${error.message}` };
    }
}

/**
 * 处理设置群头衔
 */
async function handleSetGroupTitle(params, e) {
    if (!e.group_id) {
        return { error: true, error_message: '设置群头衔功能仅在群组中可用' };
    }

    const { user_id, title } = params;

    if (!user_id) {
        return { error: true, error_message: '缺少用户ID参数' };
    }

    const isOwner = await isBotOwner(e);
    if (!isOwner) {
        return { error: true, error_message: '设置专属头衔需要Bot是群主' };
    }

    const group = e.group || e.bot?.pickGroup?.(e.group_id);
    if (!group) {
        return { error: true, error_message: '无法获取群组信息' };
    }

    try {
        await group.setTitle?.(user_id, title);
        logger.mark(`[群管理] 设置头衔 | 群:${e.group_id} | 用户:${user_id} | 头衔:${title}`);

        return {
            success: true,
            user_id: String(user_id),
            title: title
        };
    } catch (error) {
        return { error: true, error_message: `设置头衔失败: ${error.message}` };
    }
}

/**
 * 处理移出群成员
 */
async function handleKickMember(params, e) {
    if (!e.group_id) {
        return { error: true, error_message: '移出成员功能仅在群组中可用' };
    }

    const { user_id, reason = '', reject_add_request = false } = params;

    if (!user_id) {
        return { error: true, error_message: '缺少用户ID参数' };
    }

    const group = e.group || e.bot?.pickGroup?.(e.group_id);
    if (!group) {
        return { error: true, error_message: '无法获取群组信息' };
    }

    try {
        await group.kickMember?.(user_id, reject_add_request);
        logger.mark(`[群管理] 移出成员 | 群:${e.group_id} | 用户:${user_id} | 原因:${reason} | 拒绝再加:${reject_add_request}`);

        return {
            success: true,
            user_id: String(user_id),
            reason: reason
        };
    } catch (error) {
        return { error: true, error_message: `移出成员失败: ${error.message}` };
    }
}

/**
 * 处理撤回消息
 */
async function handleDeleteMessage(params, e) {
    if (!e.group_id) {
        return { error: true, error_message: '撤回消息功能仅在群组中可用' };
    }

    const { message_id } = params;

    if (!message_id) {
        return { error: true, error_message: '缺少消息ID参数' };
    }

    const group = e.group || e.bot?.pickGroup?.(e.group_id);
    if (!group) {
        return { error: true, error_message: '无法获取群组信息' };
    }

    try {
        await group.recallMsg?.(message_id);
        logger.mark(`[群管理] 撤回消息 | 群:${e.group_id} | 消息ID:${message_id}`);

        return {
            success: true,
            message_id: message_id
        };
    } catch (error) {
        return { error: true, error_message: `撤回消息失败: ${error.message}` };
    }
}

/**
 * 处理修改群名称
 */
async function handleSetGroupName(params, e) {
    if (!e.group_id) {
        return { error: true, error_message: '修改群名称功能仅在群组中可用' };
    }

    const { group_name } = params;

    if (!group_name) {
        return { error: true, error_message: '缺少群名称参数' };
    }

    const group = e.group || e.bot?.pickGroup?.(e.group_id);
    if (!group) {
        return { error: true, error_message: '无法获取群组信息' };
    }

    try {
        await group.setName?.(group_name);
        logger.mark(`[群管理] 修改群名 | 群:${e.group_id} | 新名称:${group_name}`);

        return {
            success: true,
            group_name: group_name
        };
    } catch (error) {
        return { error: true, error_message: `修改群名称失败: ${error.message}` };
    }
}

/**
 * 处理发布群公告
 */
async function handleSetGroupAnnouncement(params, e) {
    if (!e.group_id) {
        return { error: true, error_message: '发布群公告功能仅在群组中可用' };
    }

    const { content, image } = params;

    if (!content) {
        return { error: true, error_message: '缺少公告内容参数' };
    }

    const group = e.group || e.bot?.pickGroup?.(e.group_id);
    if (!group) {
        return { error: true, error_message: '无法获取群组信息' };
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
            content: content
        };
    } catch (error) {
        return { error: true, error_message: `发布公告失败: ${error.message}` };
    }
}

/**
 * 处理获取群列表
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象
 * @returns {Promise<object>} 执行结果
 */
async function handleGetGroupList(params, e) {
    if (!e || !e.bot) {
        return { error: true, error_message: '无法访问群列表：缺少Bot实例' };
    }

    try {
        let groupList = [];

        // 方式1: 使用 bot.gl Map 获取完整群信息（推荐）
        if (e.bot.gl instanceof Map && e.bot.gl.size > 0) {
            for (const [groupId, groupInfo] of e.bot.gl) {
                groupList.push({
                    group_id: String(groupId),
                    group_name: groupInfo.group_name || groupInfo.name || '未知群'
                });
            }
        }
        // 方式2: 使用 getGroupArray 获取群数组
        else if (typeof e.bot.getGroupArray === 'function') {
            const groupArray = await e.bot.getGroupArray();
            if (Array.isArray(groupArray)) {
                groupList = groupArray.map(group => ({
                    group_id: String(group.group_id || group.groupId),
                    group_name: group.group_name || group.name || '未知群'
                }));
            }
        }
        // 方式3: getGroupList 返回 group_id 数组，需要逐个获取信息
        else if (typeof e.bot.getGroupList === 'function') {
            const groupIds = await e.bot.getGroupList();
            if (Array.isArray(groupIds)) {
                for (const groupId of groupIds) {
                    // 尝试从 gl Map 获取详细信息
                    const groupInfo = e.bot.gl?.get?.(groupId);
                    groupList.push({
                        group_id: String(groupId),
                        group_name: groupInfo?.group_name || groupInfo?.name || '未知群'
                    });
                }
            }
        }

        if (groupList.length === 0) {
            return {
                success: true,
                group_count: 0,
                groups: []
            };
        }

        logger.info(`[群管理] 获取群列表 | 数量:${groupList.length}`);

        return {
            success: true,
            group_count: groupList.length,
            groups: groupList
        };
    } catch (error) {
        logger.error(`[群管理] 获取群列表失败: ${error.message}`);
        return { error: true, error_message: `获取群列表失败: ${error.message}` };
    }
}

/**
 * 处理获取群详细信息
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象
 * @returns {Promise<object>} 执行结果
 */
async function handleGetGroupInfo(params, e) {
    const { group_id } = params;
    const targetGroupId = group_id || e.group_id;

    if (!targetGroupId) {
        return { error: true, error_message: '缺少群号参数，且不在群聊环境中' };
    }

    if (!e || !e.bot) {
        return { error: true, error_message: '无法访问群信息：缺少Bot实例' };
    }

    try {
        const group = e.bot.pickGroup?.(targetGroupId);

        if (!group) {
            return { error: true, error_message: `群 ${targetGroupId} 不存在或Bot未加入` };
        }

        // 获取群信息
        let groupInfo = null;
        if (typeof group.getInfo === 'function') {
            groupInfo = await group.getInfo();
        }

        // 获取群成员数量
        let memberCount = null;
        if (typeof group.getMemberMap === 'function') {
            const memberMap = await group.getMemberMap();
            memberCount = memberMap instanceof Map ? memberMap.size : (Array.isArray(memberMap) ? memberMap.length : null);
        } else if (groupInfo?.member_count !== undefined) {
            memberCount = groupInfo.member_count;
        }

        // 从 gl Map 获取基本信息作为备用
        const basicInfo = e.bot.gl?.get?.(targetGroupId);

        const result = {
            success: true,
            group_id: String(targetGroupId),
            group_name: groupInfo?.group_name || groupInfo?.name || basicInfo?.group_name || basicInfo?.name || '未知群',
            member_count: memberCount,
            owner_id: groupInfo?.owner_id || groupInfo?.ownerId || basicInfo?.owner_id || null,
            max_member_count: groupInfo?.max_member_count || groupInfo?.maxMemberCount || null,
            create_time: groupInfo?.create_time || null,
            group_memo: groupInfo?.group_memo || groupInfo?.memo || null
        };

        logger.info(`[群管理] 获取群信息 | 群:${targetGroupId} | 名称:${result.group_name} | 成员:${memberCount || '未知'}`);

        return result;
    } catch (error) {
        logger.error(`[群管理] 获取群信息失败: ${error.message}`);
        return { error: true, error_message: `获取群信息失败: ${error.message}` };
    }
}
