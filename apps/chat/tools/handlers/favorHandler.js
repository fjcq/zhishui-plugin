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
                result = await handleSetUserFavor(params, e);
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
                    error_message: `未知的工具: ${toolName}`
                };
        }

        return result;
    } catch (error) {
        logger.error(`[好感度工具] ${toolName} 异常: ${error.message}`);
        return {
            error: true,
            error_message: `工具执行失败: ${error.message}`
        };
    }
}

/**
 * 处理调整用户好感度（增减量）
 */
async function handleChangeUserFavor(params) {
    const { user_id, change, reason = "AI主动调整" } = params;

    if (!user_id) {
        return { error: true, error_message: "缺少用户ID参数" };
    }

    if (change === undefined || change === null) {
        return { error: true, error_message: "缺少变化量参数" };
    }

    const changeValue = Number(change);
    if (isNaN(changeValue)) {
        return { error: true, error_message: "变化量必须是数字" };
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
            natural_feedback: true
        };
    } else {
        return { error: true, error_message: "调整好感度失败" };
    }
}

/**
 * 处理获取用户好感度
 */
async function handleGetUserFavor(params) {
    const { user_id } = params;
    if (!user_id) {
        return { error: true, error_message: "缺少用户ID参数" };
    }

    const favor = await getUserFavor(user_id);
    return {
        success: true,
        user_id: user_id,
        favor: favor
    };
}

/**
 * 处理设置用户好感度
 * 此工具仅限管理员使用，AI请使用 change_user_favor 进行渐进式调整
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象（用于权限检查）
 */
async function handleSetUserFavor(params, e) {
    const { user_id, favor, reason = "管理员设置" } = params;

    if (!e || !e.isMaster) {
        logger.warn(`[好感度] 非管理员尝试调用 set_user_favor，已拒绝。user_id: ${user_id}, favor: ${favor}`);
        return {
            error: true,
            error_message: "set_user_favor 工具仅限管理员使用。AI请使用 change_user_favor 工具进行好感度调整，每次最多变化10点。",
            hint: "请使用 change_user_favor 工具",
            tool_available: "change_user_favor"
        };
    }

    if (!user_id || favor === undefined) {
        return { error: true, error_message: "缺少用户ID或好感度参数" };
    }

    const targetFavor = Number(favor);
    if (isNaN(targetFavor)) {
        return { error: true, error_message: "好感度必须是数字" };
    }

    const clampedTargetFavor = Math.max(-100, Math.min(100, targetFavor));
    const oldFavor = await getUserFavor(user_id);
    const success = await setUserFavor(user_id, clampedTargetFavor, reason, '主人');

    if (success) {
        logger.info(`[好感度] 主人设置用户 ${user_id} 好感度: ${oldFavor} -> ${clampedTargetFavor}`);
        return {
            success: true,
            user_id: user_id,
            old_favor: oldFavor,
            new_favor: clampedTargetFavor,
            change: clampedTargetFavor - oldFavor,
            operator: "主人"
        };
    } else {
        return { error: true, error_message: "设置好感度失败" };
    }
}

/**
 * 处理获取用户详细信息
 */
async function handleGetUserInfo(params) {
    const { user_id } = params;
    if (!user_id) {
        return { error: true, error_message: "缺少用户ID参数" };
    }

    const userData = await getUserData(user_id);
    return {
        success: true,
        user_id: user_id,
        user_data: userData
    };
}

/**
 * 处理获取群组信息
 */
async function handleGetGroupInfo(params, e) {
    if (!e) {
        return { error: true, error_message: "无法访问群组信息：缺少事件对象" };
    }

    const group_id = params.group_id || e.group_id;
    if (!group_id) {
        return { error: true, error_message: "当前不在群组环境中，无法获取群组信息" };
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
                create_time: groupInfo.create_time || groupInfo.createTime || null
            };
        }

        return {
            success: true,
            group_id: String(group_id),
            group_name: "当前群组"
        };
    } catch (error) {
        return { error: true, error_message: `获取群组信息失败: ${error.message}` };
    }
}

/**
 * 处理获取用户QQ资料
 */
async function handleGetUserProfile(params, e) {
    const { user_id, group_id } = params;
    if (!user_id) {
        return { error: true, error_message: "缺少用户ID参数" };
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
            ...profile
        };
    } catch (error) {
        return { error: true, error_message: `获取用户资料失败: ${error.message}` };
    }
}

/**
 * 处理获取群成员列表
 */
async function handleGetGroupMembers(params, e) {
    if (!e) {
        return { error: true, error_message: "无法访问群成员信息：缺少事件对象" };
    }

    const group_id = params.group_id || e.group_id;
    if (!group_id) {
        return { error: true, error_message: "当前不在群组环境中，无法获取群成员列表" };
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
            members: members
        };
    } catch (error) {
        return { error: true, error_message: `获取群成员列表失败: ${error.message}` };
    }
}
