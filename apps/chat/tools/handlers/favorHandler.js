/**
 * 好感度工具处理函数
 * 处理AI调用的好感度相关工具
 */

import { getUserFavor, setUserFavor, getUserData } from '../../user/index.js';

/**
 * 处理好感度工具调用
 * @param {string} toolName - 工具名称
 * @param {object} toolParams - 工具参数
 * @param {object} e - 事件对象（用于访问Bot API）
 * @param {string} currentUserId - 当前对话用户ID（用于自动填充）
 * @returns {Promise<object>} 工具执行结果
 */
export async function handleFavorToolCall(toolName, toolParams, e = null, currentUserId = null) {
    try {
        const params = { ...toolParams };
        const toolsNeedUserId = ['get_user_favor', 'set_user_favor', 'change_user_favor', 'get_user_info', 'get_user_profile'];

        if (toolsNeedUserId.includes(toolName) && !params.user_id) {
            if (currentUserId) {
                params.user_id = currentUserId;
            } else if (e && e.user_id) {
                params.user_id = String(e.user_id);
            }
        }

        const toolsNeedGroupId = ['get_group_info', 'get_group_members', 'get_user_profile'];
        if (toolsNeedGroupId.includes(toolName) && params.group_id === undefined) {
            if (e && e.group_id) {
                params.group_id = String(e.group_id);
            } else {
                params.group_id = '';
            }
        }

        let result;
        switch (toolName) {
            case "change_user_favor":
                result = await handleChangeUserFavor(params);
                break;
            case "get_user_favor":
                result = await handleGetUserFavor(params);
                break;
            case "set_user_favor":
                result = await handleSetUserFavor(params);
                break;
            case "get_user_info":
                result = await handleGetUserInfo(params);
                break;
            case "get_group_info":
                result = await handleGetGroupInfo(params, e);
                break;
            case "get_user_profile":
                result = await handleGetUserProfile(params, e);
                break;
            case "get_group_members":
                result = await handleGetGroupMembers(params, e);
                break;
            default:
                result = {
                    error: true,
                    message: `未知的工具: ${toolName}`
                };
        }

        if (result.error) {
            logger.error(`[工具调用] ${toolName} 失败: ${result.message}`);
        } else {
            logger.info(`[工具调用] ${toolName}: ${result.message}`);
        }

        return result;
    } catch (error) {
        logger.error(`[工具调用] ${toolName} 异常: ${error.message}`);
        return {
            error: true,
            message: `工具执行失败: ${error.message}`
        };
    }
}

/**
 * 处理调整用户好感度（增减量）
 */
async function handleChangeUserFavor(params) {
    const { user_id, change, reason = "AI主动调整" } = params;

    if (!user_id) {
        return { error: true, message: "缺少用户ID参数" };
    }

    if (change === undefined || change === null) {
        return { error: true, message: "缺少变化量参数" };
    }

    const changeValue = Number(change);
    if (isNaN(changeValue)) {
        return { error: true, message: "变化量必须是数字" };
    }

    const MAX_SINGLE_CHANGE = 10;
    const clampedChange = Math.max(-MAX_SINGLE_CHANGE, Math.min(MAX_SINGLE_CHANGE, changeValue));

    const oldFavor = await getUserFavor(user_id);
    const newFavor = Math.max(-100, Math.min(100, oldFavor + clampedChange));

    const success = await setUserFavor(user_id, newFavor, reason, 'AI');

    if (success) {
        return {
            success: true,
            user_id: user_id,
            old_favor: oldFavor,
            change: clampedChange,
            new_favor: newFavor,
            message: `好感度已更新`,
            natural_feedback: true
        };
    } else {
        return { error: true, message: "调整好感度失败" };
    }
}

/**
 * 处理获取用户好感度
 */
async function handleGetUserFavor(params) {
    const { user_id } = params;
    if (!user_id) {
        return { error: true, message: "缺少用户ID参数" };
    }

    const favor = await getUserFavor(user_id);
    return {
        success: true,
        user_id: user_id,
        favor: favor,
        message: `用户 ${user_id} 的好感度为 ${favor}`
    };
}

/**
 * 处理设置用户好感度
 */
async function handleSetUserFavor(params) {
    const { user_id, favor, reason = "AI主动调整" } = params;
    if (!user_id || favor === undefined) {
        return { error: true, message: "缺少用户ID或好感度参数" };
    }

    const oldFavor = await getUserFavor(user_id);
    const success = await setUserFavor(user_id, favor, reason, 'AI');

    if (success) {
        return {
            success: true,
            user_id: user_id,
            old_favor: oldFavor,
            new_favor: favor,
            message: `成功将用户 ${user_id} 的好感度从 ${oldFavor} 设置为 ${favor}`
        };
    } else {
        return { error: true, message: "设置好感度失败" };
    }
}

/**
 * 处理获取用户详细信息
 */
async function handleGetUserInfo(params) {
    const { user_id } = params;
    if (!user_id) {
        return { error: true, message: "缺少用户ID参数" };
    }

    const userData = await getUserData(user_id);
    return {
        success: true,
        user_id: user_id,
        user_data: userData,
        message: `获取用户 ${user_id} 的详细信息成功`
    };
}

/**
 * 处理获取群组信息
 */
async function handleGetGroupInfo(params, e) {
    if (!e) {
        return { error: true, message: "无法访问群组信息：缺少事件对象" };
    }

    const group_id = params.group_id || e.group_id;
    if (!group_id) {
        return { error: true, message: "当前不在群组环境中，无法获取群组信息" };
    }

    try {
        const groupInfo = await e.bot?.pickGroup?.(group_id)?.getInfo?.() ||
            await e.group?.getInfo?.();

        if (groupInfo) {
            return {
                success: true,
                group_id: String(group_id),
                group_name: groupInfo.group_name || groupInfo.name || "未知群组",
                member_count: groupInfo.member_count || groupInfo.memberCount || 0,
                max_member_count: groupInfo.max_member_count || groupInfo.maxMemberCount || 0,
                create_time: groupInfo.create_time || groupInfo.createTime || null,
                message: `群组 ${group_id} 的信息获取成功`
            };
        }

        return {
            success: true,
            group_id: String(group_id),
            group_name: "当前群组",
            message: `群组 ${group_id} 的基本信息`
        };
    } catch (error) {
        return { error: true, message: `获取群组信息失败: ${error.message}` };
    }
}

/**
 * 处理获取用户QQ资料
 */
async function handleGetUserProfile(params, e) {
    const { user_id, group_id } = params;
    if (!user_id) {
        return { error: true, message: "缺少用户ID参数" };
    }

    try {
        let profile = {
            user_id: String(user_id),
            nickname: null,
            card: null,
            avatar_url: `https://q1.qlogo.cn/g?b=qq&nk=${user_id}&s=640`,
            level: null,
            sign: null
        };

        if (e && (group_id || e.group_id)) {
            const gid = group_id || e.group_id;
            try {
                const memberInfo = await e.bot?.pickMember?.(gid, user_id)?.getInfo?.() ||
                    await e.group?.pickMember?.(user_id)?.getInfo?.();
                if (memberInfo) {
                    profile.nickname = memberInfo.nickname || memberInfo.nick || null;
                    profile.card = memberInfo.card || memberInfo.group_name || null;
                    profile.level = memberInfo.level || memberInfo.qqLevel || null;
                    profile.sign = memberInfo.sign || memberInfo.signature || null;
                }
            } catch {
                // 忽略错误
            }
        }

        if (!profile.nickname && e) {
            try {
                const strangerInfo = await e.bot?.pickFriend?.(user_id)?.getInfo?.() ||
                    await e.bot?.pickUser?.(user_id)?.getInfo?.();
                if (strangerInfo) {
                    profile.nickname = strangerInfo.nickname || strangerInfo.nick || null;
                    profile.sign = strangerInfo.sign || strangerInfo.signature || null;
                }
            } catch {
                // 忽略错误
            }
        }

        return {
            success: true,
            ...profile,
            message: `用户 ${user_id} 的资料获取成功`
        };
    } catch (error) {
        return { error: true, message: `获取用户资料失败: ${error.message}` };
    }
}

/**
 * 处理获取群成员列表
 */
async function handleGetGroupMembers(params, e) {
    if (!e) {
        return { error: true, message: "无法访问群成员信息：缺少事件对象" };
    }

    const group_id = params.group_id || e.group_id;
    if (!group_id) {
        return { error: true, message: "当前不在群组环境中，无法获取群成员列表" };
    }

    try {
        const members = [];

        const memberList = await e.bot?.pickGroup?.(group_id)?.getMemberList?.() ||
            await e.group?.getMemberList?.();

        if (memberList && Array.isArray(memberList)) {
            for (const member of memberList) {
                members.push({
                    user_id: String(member.user_id || member.userId),
                    nickname: member.nickname || member.nick || null,
                    card: member.card || member.group_name || null,
                    role: member.role || (member.owner ? "owner" : (member.admin ? "admin" : "member"))
                });
            }
        }

        return {
            success: true,
            group_id: String(group_id),
            member_count: members.length,
            members: members,
            message: `群组 ${group_id} 的成员列表获取成功，共 ${members.length} 人`
        };
    } catch (error) {
        return { error: true, message: `获取群成员列表失败: ${error.message}` };
    }
}
