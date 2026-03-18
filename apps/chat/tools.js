/**
 * 工具模块
 * 提供AI调用的各种工具
 */

import { getUserFavor, setUserFavor, getUserData, addFavorHistory } from './user.js';

/**
 * 工具集合
 * 注意：OpenAI工具调用格式要求使用 type: "function" 包装
 * 工具描述应避免技术术语，使用角色扮演友好的表述
 * strict 模式：确保模型输出严格遵循 JSON Schema 格式
 */
export const favorTools = [
    {
        type: "function",
        function: {
            name: "get_user_favor",
            strict: true,
            description: "获取用户的好感度数值。在设置好感度之前，应该先调用此工具获取当前好感度，以便计算新的目标值。当用户问「你对我的好感度是多少」「我们关系怎么样」等问题时也必须调用此工具。不要编造好感度数值。user_id可省略，默认查询当前对话用户。",
            parameters: {
                type: "object",
                properties: {
                    user_id: {
                        type: "string",
                        description: "用户ID，可省略，默认使用当前对话用户"
                    }
                },
                required: [],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "set_user_favor",
            strict: true,
            description: "【必须调用】设置用户的好感度数值。每次对话结束后，必须调用此工具更新好感度，根据用户的言行和你的心情主动评估。增加场景：礼貌关心(+1~+3)、真诚帮助(+4~+6)、情感共鸣(+7~+10)；降低场景：无礼冒犯(-1~-3)、欺骗嘲讽(-4~-6)、严重伤害(-7~-10)。参数favor是目标值（-100到100），不是变化量。user_id可省略，默认设置当前对话用户。reason参数用于记录调整原因。",
            parameters: {
                type: "object",
                properties: {
                    user_id: {
                        type: "string",
                        description: "用户ID，可省略，默认使用当前对话用户"
                    },
                    favor: {
                        type: "integer",
                        description: "好感度目标值，范围-100到100。必须根据对话内容主动评估，不要总是保持不变"
                    },
                    reason: {
                        type: "string",
                        description: "调整原因，简要说明为什么调整好感度，例如'用户关心我'、'用户说话无礼'等"
                    }
                },
                required: ["favor", "reason"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_user_info",
            strict: true,
            description: "获取用户的详细数据，包括好感度、互动次数等统计信息。当需要全面了解用户状态时调用。user_id可省略，默认查询当前对话用户。",
            parameters: {
                type: "object",
                properties: {
                    user_id: {
                        type: "string",
                        description: "用户ID，可省略，默认使用当前对话用户"
                    }
                },
                required: [],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_group_info",
            strict: true,
            description: "获取群组信息（群名、群号、成员数量等）。当用户问「这个群叫什么」「群号是多少」「群里有几个人」等问题时必须调用此工具获取真实数据。不要编造群信息。group_id可省略，默认使用当前群组。",
            parameters: {
                type: "object",
                properties: {
                    group_id: {
                        type: "string",
                        description: "群组ID，可省略，默认使用当前群组"
                    }
                },
                required: [],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_user_profile",
            strict: true,
            description: "获取用户的QQ资料（昵称、头像、等级等）。当需要知道用户的真实昵称、头像URL、等级等信息时必须调用此工具。不要编造用户资料。user_id可省略，默认查询当前对话用户。",
            parameters: {
                type: "object",
                properties: {
                    user_id: {
                        type: "string",
                        description: "用户ID，可省略，默认使用当前对话用户"
                    },
                    group_id: {
                        type: "string",
                        description: "群组ID，可省略，用于获取群内昵称，不传则不获取群内昵称"
                    }
                },
                required: [],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_group_members",
            strict: true,
            description: "获取群成员列表。当用户问「群里有谁」「群成员有哪些」「列出群成员」等问题时必须调用此工具获取真实数据。不要编造成员列表。group_id可省略，默认使用当前群组。",
            parameters: {
                type: "object",
                properties: {
                    group_id: {
                        type: "string",
                        description: "群组ID，可省略，默认使用当前群组"
                    }
                },
                required: [],
                additionalProperties: false
            }
        }
    }
];

/**
 * 处理工具调用
 * @param {string} toolName - 工具名称
 * @param {object} toolParams - 工具参数
 * @param {object} e - 事件对象（用于访问Bot API）
 * @param {string} currentUserId - 当前对话用户ID（用于自动填充）
 * @returns {Promise<object>} 工具执行结果
 */
export async function handleFavorToolCall(toolName, toolParams, e = null, currentUserId = null) {
    try {
        // 自动填充用户ID（如果工具需要但未提供）
        const params = { ...toolParams };
        const toolsNeedUserId = ['get_user_favor', 'set_user_favor', 'get_user_info', 'get_user_profile'];

        if (toolsNeedUserId.includes(toolName) && !params.user_id) {
            if (currentUserId) {
                params.user_id = currentUserId;
                logger.info(`[工具调用] 自动填充用户ID: ${currentUserId}`);
            } else if (e && e.user_id) {
                params.user_id = String(e.user_id);
                logger.info(`[工具调用] 从事件对象自动填充用户ID: ${e.user_id}`);
            }
        }

        // 自动填充群组ID（如果工具需要但未提供）
        const toolsNeedGroupId = ['get_group_info', 'get_group_members', 'get_user_profile'];
        if (toolsNeedGroupId.includes(toolName) && params.group_id === undefined) {
            if (e && e.group_id) {
                params.group_id = String(e.group_id);
            } else {
                params.group_id = '';
            }
        }

        switch (toolName) {
            case "get_user_favor":
                return await handleGetUserFavor(params);
            case "set_user_favor":
                return await handleSetUserFavor(params);
            case "get_user_info":
                return await handleGetUserInfo(params);
            case "get_group_info":
                return await handleGetGroupInfo(params, e);
            case "get_user_profile":
                return await handleGetUserProfile(params, e);
            case "get_group_members":
                return await handleGetGroupMembers(params, e);
            default:
                return {
                    error: true,
                    message: `未知的工具: ${toolName}`
                };
        }
    } catch (error) {
        logger.error(`处理工具调用失败: ${error.message}`);
        return {
            error: true,
            message: `工具执行失败: ${error.message}`
        };
    }
}

/**
 * 处理获取用户好感度
 * @param {object} params - 工具参数
 * @returns {Promise<object>} 执行结果
 */
async function handleGetUserFavor(params) {
    const { user_id } = params;
    if (!user_id) {
        return {
            error: true,
            message: "缺少用户ID参数"
        };
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
 * @param {object} params - 工具参数
 * @returns {Promise<object>} 执行结果
 */
async function handleSetUserFavor(params) {
    const { user_id, favor, reason = "AI设置" } = params;
    if (!user_id || favor === undefined) {
        return {
            error: true,
            message: "缺少用户ID或好感度参数"
        };
    }

    const oldFavor = await getUserFavor(user_id);
    const success = await setUserFavor(user_id, favor);

    if (success) {
        await addFavorHistory(user_id, favor - oldFavor, reason, oldFavor, favor);

        return {
            success: true,
            user_id: user_id,
            old_favor: oldFavor,
            new_favor: favor,
            message: `成功将用户 ${user_id} 的好感度从 ${oldFavor} 设置为 ${favor}`
        };
    } else {
        return {
            error: true,
            message: "设置好感度失败"
        };
    }
}

/**
 * 处理获取用户详细信息
 * @param {object} params - 工具参数
 * @returns {Promise<object>} 执行结果
 */
async function handleGetUserInfo(params) {
    const { user_id } = params;
    if (!user_id) {
        return {
            error: true,
            message: "缺少用户ID参数"
        };
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
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象
 * @returns {Promise<object>} 执行结果
 */
async function handleGetGroupInfo(params, e) {
    if (!e) {
        return {
            error: true,
            message: "无法访问群组信息：缺少事件对象"
        };
    }

    const group_id = params.group_id || e.group_id;
    if (!group_id) {
        return {
            error: true,
            message: "当前不在群组环境中，无法获取群组信息"
        };
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

        // 如果无法获取详细信息，返回基本信息
        return {
            success: true,
            group_id: String(group_id),
            group_name: "当前群组",
            message: `群组 ${group_id} 的基本信息`
        };
    } catch (error) {
        return {
            error: true,
            message: `获取群组信息失败: ${error.message}`
        };
    }
}

/**
 * 处理获取用户QQ资料
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象
 * @returns {Promise<object>} 执行结果
 */
async function handleGetUserProfile(params, e) {
    const { user_id, group_id } = params;
    if (!user_id) {
        return {
            error: true,
            message: "缺少用户ID参数"
        };
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

        // 尝试获取群成员信息
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
                // 群成员信息获取失败，继续尝试其他方式
            }
        }

        // 尝试获取陌生人信息
        if (!profile.nickname && e) {
            try {
                const strangerInfo = await e.bot?.pickFriend?.(user_id)?.getInfo?.() ||
                    await e.bot?.pickUser?.(user_id)?.getInfo?.();
                if (strangerInfo) {
                    profile.nickname = strangerInfo.nickname || strangerInfo.nick || null;
                    profile.sign = strangerInfo.sign || strangerInfo.signature || null;
                }
            } catch {
                // 陌生人信息获取失败
            }
        }

        return {
            success: true,
            ...profile,
            message: `用户 ${user_id} 的资料获取成功`
        };
    } catch (error) {
        return {
            error: true,
            message: `获取用户资料失败: ${error.message}`
        };
    }
}

/**
 * 处理获取群成员列表
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象
 * @returns {Promise<object>} 执行结果
 */
async function handleGetGroupMembers(params, e) {
    if (!e) {
        return {
            error: true,
            message: "无法访问群成员信息：缺少事件对象"
        };
    }

    const group_id = params.group_id || e.group_id;
    if (!group_id) {
        return {
            error: true,
            message: "当前不在群组环境中，无法获取群成员列表"
        };
    }

    try {
        const members = [];

        // 尝试获取群成员列表
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
        return {
            error: true,
            message: `获取群成员列表失败: ${error.message}`
        };
    }
}
