/**
 * 权限控制模块
 * 管理工具调用的权限验证
 */

/**
 * 敏感工具列表（需要管理员权限）
 */
export const SENSITIVE_TOOLS = [
    'mute_group_member',
    'kick_group_member',
    'set_group_admin',
    'delete_message'
];

/**
 * 需要确认的工具列表
 */
export const NEED_CONFIRM_TOOLS = [
    'kick_group_member',
    'mute_group_member'
];

/**
 * 禁言时长限制（秒）
 */
export const MUTE_DURATION_LIMITS = {
    MIN: 0,
    MAX: 2592000,
    DEFAULT: 60
};

/**
 * 检查Bot是否为群管理员
 * @param {object} e - 事件对象
 * @returns {Promise<boolean>} 是否为管理员
 */
export async function isBotAdmin(e) {
    if (!e || !e.group_id) {
        return false;
    }

    try {
        const botId = e.bot?.uin || e.bot?.id;
        if (!botId) {
            return false;
        }

        const botInfo = await e.group?.pickMember?.(botId)?.getInfo?.() ||
            await e.bot?.pickMember?.(e.group_id, botId)?.getInfo?.();

        if (!botInfo) {
            return false;
        }

        return botInfo.role === 'admin' || botInfo.role === 'owner' ||
               botInfo.admin === true || botInfo.owner === true;
    } catch (error) {
        logger.error(`[权限检查] 检查Bot管理员状态失败: ${error.message}`);
        return false;
    }
}

/**
 * 检查用户是否为群管理员
 * @param {object} e - 事件对象
 * @param {string} userId - 用户ID
 * @returns {Promise<boolean>} 是否为管理员
 */
export async function isUserAdmin(e, userId) {
    if (!e || !e.group_id || !userId) {
        return false;
    }

    try {
        const userInfo = await e.group?.pickMember?.(userId)?.getInfo?.() ||
            await e.bot?.pickMember?.(e.group_id, userId)?.getInfo?.();

        if (!userInfo) {
            return false;
        }

        return userInfo.role === 'admin' || userInfo.role === 'owner' ||
               userInfo.admin === true || userInfo.owner === true;
    } catch (error) {
        logger.error(`[权限检查] 检查用户管理员状态失败: ${error.message}`);
        return false;
    }
}

/**
 * 检查Bot是否可以操作目标用户
 * @param {object} e - 事件对象
 * @param {string} targetUserId - 目标用户ID
 * @returns {Promise<{allowed: boolean, reason: string}>} 检查结果
 */
export async function canOperateUser(e, targetUserId) {
    if (!e || !e.group_id) {
        return { allowed: false, reason: '不在群组环境中' };
    }

    const botId = e.bot?.uin || e.bot?.id;
    if (targetUserId === String(botId)) {
        return { allowed: false, reason: '不能对自己执行此操作' };
    }

    const isBotAdminResult = await isBotAdmin(e);
    if (!isBotAdminResult) {
        return { allowed: false, reason: 'Bot不是管理员，无法执行此操作' };
    }

    const isTargetAdmin = await isUserAdmin(e, targetUserId);
    if (isTargetAdmin) {
        return { allowed: false, reason: '无法对管理员执行此操作' };
    }

    return { allowed: true, reason: '' };
}

/**
 * 检查工具调用权限
 * @param {string} toolName - 工具名称
 * @param {object} e - 事件对象
 * @param {object} params - 工具参数
 * @returns {Promise<{allowed: boolean, reason: string}>} 权限检查结果
 */
export async function checkToolPermission(toolName, e, params) {
    if (!SENSITIVE_TOOLS.includes(toolName)) {
        return { allowed: true, reason: '' };
    }

    if (!e || !e.group_id) {
        return { allowed: false, reason: '敏感操作只能在群组环境中执行' };
    }

    if (toolName === 'mute_group_member') {
        return await canOperateUser(e, params.user_id);
    }

    if (toolName === 'kick_group_member') {
        return await canOperateUser(e, params.user_id);
    }

    if (toolName === 'delete_message') {
        const isBotAdminResult = await isBotAdmin(e);
        if (!isBotAdminResult) {
            return { allowed: false, reason: 'Bot不是管理员，无法撤回消息' };
        }
        return { allowed: true, reason: '' };
    }

    if (toolName === 'set_group_admin') {
        const isBotOwner = await isBotOwner(e);
        if (!isBotOwner) {
            return { allowed: false, reason: '只有群主才能设置管理员' };
        }
        return { allowed: true, reason: '' };
    }

    return { allowed: true, reason: '' };
}

/**
 * 检查Bot是否为群主
 * @param {object} e - 事件对象
 * @returns {Promise<boolean>} 是否为群主
 */
export async function isBotOwner(e) {
    if (!e || !e.group_id) {
        return false;
    }

    try {
        const botId = e.bot?.uin || e.bot?.id;
        if (!botId) {
            return false;
        }

        const botInfo = await e.group?.pickMember?.(botId)?.getInfo?.() ||
            await e.bot?.pickMember?.(e.group_id, botId)?.getInfo?.();

        if (!botInfo) {
            return false;
        }

        return botInfo.role === 'owner' || botInfo.owner === true;
    } catch (error) {
        logger.error(`[权限检查] 检查Bot群主状态失败: ${error.message}`);
        return false;
    }
}

/**
 * 验证禁言时长
 * @param {number} duration - 禁言时长（秒）
 * @returns {number} 有效的禁言时长
 */
export function validateMuteDuration(duration) {
    const dur = Number(duration);
    if (isNaN(dur) || dur < 0) {
        return 0;
    }
    return Math.min(Math.max(dur, MUTE_DURATION_LIMITS.MIN), MUTE_DURATION_LIMITS.MAX);
}

/**
 * 格式化禁言时长
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时长字符串
 */
export function formatMuteDuration(seconds) {
    if (seconds === 0) {
        return '解除禁言';
    }

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}天`);
    if (hours > 0) parts.push(`${hours}小时`);
    if (minutes > 0) parts.push(`${minutes}分钟`);
    if (secs > 0 && parts.length === 0) parts.push(`${secs}秒`);

    return parts.join('') || '0秒';
}
