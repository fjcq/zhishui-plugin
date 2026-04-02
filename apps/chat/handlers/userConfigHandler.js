/**
 * 用户配置处理模块
 * 处理用户配置相关的命令
 */

import { getCurrentRoleIndex } from '../config.js';
import { clearSessionContext, getSessionKeyv, loadChatMsg, generateSessionId } from '../helpers.js';
import { Config } from '../../../components/index.js';

/**
 * 查看对话历史
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleShowChatHistory(e) {
    try {
        const sessionId = await generateSessionId(e);
        const history = await loadChatMsg(e);

        if (!history || !Array.isArray(history) || history.length === 0) {
            e.reply('暂无对话历史记录');
            return;
        }

        let historyMsg = ['*** 对话历史记录 ***'];
        history.forEach((item, index) => {
            let message = typeof item === 'object' ?
                (item.message || JSON.stringify(item)) :
                item;

            if (message) {
                historyMsg.push(`${index + 1}. ${message}`);
            }
        });

        if (historyMsg.length <= 1) {
            e.reply('暂无有效的对话历史记录');
            return;
        }

        const { common } = await import('../../../model/index.js');
        common.getforwardMsg(e, historyMsg, {
            isxml: true,
            xmlTitle: '对话历史记录',
        });
    } catch (err) {
        console.error('查看对话历史出错:', err);
        e.reply('获取对话历史失败: ' + err.message);
    }
}

/**
 * 重置个人配置
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleResetUserConfig(e) {
    if (e.group_id) {
        e.reply('该功能只能在私聊中使用。');
        return;
    }

    try {
        const { Config } = await import('../../../components/index.js');
        await Config.DeleteUserChatConfig(e.user_id, 'RoleIndex');
        await clearSessionContext(e);
        e.reply('已重置你的个人角色配置，将使用全局预设角色。\n已自动清除上下文缓存，请重新开始对话。');
    } catch (error) {
        console.error('[ResetUserConfig] 重置用户配置失败:', error);
        e.reply('重置个人配置失败，请稍后重试。');
    }
}

/**
 * 查看个人配置
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleShowUserConfig(e) {
    if (e.group_id) {
        e.reply('该功能只能在私聊中使用。');
        return;
    }

    try {
        const { Config } = await import('../../../components/index.js');
        const currentRoleIndex = await getCurrentRoleIndex(e);

        let hasUserRoleConfig = false;

        try {
            const userRoleIndex = await Config.GetUserChatConfig(e.user_id, 'RoleIndex');
            if (typeof userRoleIndex === 'number') hasUserRoleConfig = true;
        } catch (error) { }

        let msg = `【你的当前配置】\n\n`;

        msg += `【角色配置】${hasUserRoleConfig ? '（个人专属）' : '（使用全局默认）'}\n`;
        try {
            const roleJson = Config.getJsonConfig('RoleProfile');
            const roles = JSON.parse(roleJson);
            const currentRole = roles[currentRoleIndex];
            msg += `序号：${currentRoleIndex + 1}\n`;
            msg += `角色：${currentRole?.角色标题 || currentRole?.基础身份?.名称 || '未知角色'}\n\n`;
        } catch (error) {
            msg += `角色：获取失败\n\n`;
        }

        msg += `【操作提示】\n`;
        msg += `• 私聊切换角色：#切换角色序号\n`;
        msg += `• 重置个人角色配置：#重置个人配置`;

        e.reply(msg);
    } catch (error) {
        console.error('[ShowUserConfig] 获取用户配置失败:', error);
        e.reply('获取个人配置失败，请稍后重试。');
    }
}

/**
 * 查看其他用户配置
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleShowOtherUserConfig(e) {
    if (!e.isMaster) {
        e.reply('只有主人可以查看其他用户的配置。');
        return;
    }

    let targetUserId = null;

    if (e.at) {
        targetUserId = Array.isArray(e.at) ? String(e.at[0]) : String(e.at);
    } else {
        const match = e.msg.match(/查看用户配置\s*(\d+)?$/);
        targetUserId = match?.[1];
    }

    if (!targetUserId) {
        e.reply('请指定要查看的用户，例如：\n#查看用户配置 123456789\n#查看用户配置 @某人');
        return;
    }

    try {
        const { Config } = await import('../../../components/index.js');
        const fakeEvent = { user_id: targetUserId, group_id: null };
        const currentRoleIndex = await getCurrentRoleIndex(fakeEvent);

        let hasUserRoleConfig = false;

        try {
            const userRoleIndex = await Config.GetUserChatConfig(targetUserId, 'RoleIndex');
            if (typeof userRoleIndex === 'number') hasUserRoleConfig = true;
        } catch (error) { }

        let msg = `【用户 ${targetUserId} 的配置】\n\n`;

        msg += `【角色配置】${hasUserRoleConfig ? '（个人专属）' : '（使用全局默认）'}\n`;
        try {
            const roleJson = Config.getJsonConfig('RoleProfile');
            const roles = JSON.parse(roleJson);
            const currentRole = roles[currentRoleIndex];
            msg += `序号：${currentRoleIndex + 1}\n`;
            msg += `角色：${currentRole?.角色标题 || currentRole?.基础身份?.名称 || '未知角色'}\n\n`;
        } catch (error) {
            msg += `角色：获取失败\n\n`;
        }

        msg += `【管理操作】\n`;
        msg += `• 重置该用户配置：#重置用户配置 ${targetUserId}`;

        e.reply(msg);
    } catch (error) {
        console.error('[ShowOtherUserConfig] 获取用户配置失败:', error);
        e.reply('获取用户配置失败，请稍后重试。');
    }
}

/**
 * 重置其他用户配置
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleResetOtherUserConfig(e) {
    if (!e.isMaster) {
        e.reply('只有主人可以重置其他用户的配置。');
        return;
    }

    let targetUserId = null;

    if (e.at) {
        targetUserId = Array.isArray(e.at) ? String(e.at[0]) : String(e.at);
    } else {
        const match = e.msg.match(/重置用户配置\s*(\d+)$/);
        targetUserId = match?.[1];
    }

    if (!targetUserId) {
        e.reply('请指定要重置的用户，例如：\n#重置用户配置 123456789\n#重置用户配置 @某人');
        return;
    }

    try {
        const { Config } = await import('../../../components/index.js');
        await Config.DeleteUserChatConfig(targetUserId, 'RoleIndex');

        const sessionId = `user_${targetUserId}`;
        const keyv = getSessionKeyv(sessionId);
        await keyv.delete('chatMsg');

        e.reply(`已重置用户 ${targetUserId} 的个人角色配置，该用户将使用全局预设角色。\n已自动清除该用户的上下文缓存。`);
    } catch (error) {
        console.error('[ResetOtherUserConfig] 重置用户配置失败:', error);
        e.reply('重置用户配置失败，请稍后重试。');
    }
}

/**
 * 显示用户配置统计
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleShowUserConfigStats(e) {
    if (!e.isMaster) {
        e.reply('只有主人可以查看用户配置统计。');
        return;
    }

    try {
        let msg = `【用户配置统计】\n\n`;
        msg += `系统当前支持用户个人角色配置功能：\n`;
        msg += `• 用户可在私聊中设置专属角色\n`;
        msg += `• 配置存储在Redis中，键格式：zhishui:ChatConfig:QQ号:配置项\n`;
        msg += `• 支持的配置项：RoleIndex\n\n`;
        msg += `【管理指令】\n`;
        msg += `• #查看用户配置 QQ号 - 查看指定用户配置\n`;
        msg += `• #重置用户配置 QQ号 - 重置指定用户配置\n`;
        msg += `• #查看用户配置统计 - 查看此统计信息\n\n`;
        msg += `注：详细的用户配置数据需要通过Redis管理工具查看`;

        e.reply(msg);
    } catch (error) {
        console.error('[ShowUserConfigStats] 获取用户配置统计失败:', error);
        e.reply('获取用户配置统计失败，请稍后重试。');
    }
}

/**
 * 私聊AI回复开关
 * @param {Object} e - 事件对象
 * @returns {Promise<boolean>} 处理结果
 */
export async function handleSetPrivateChatEnable(e) {
    if (!e.isMaster) {
        e.reply('只有主人可以设置私聊AI回复开关。');
        return false;
    }
    const { Config } = await import('../../../components/index.js');
    let enable = e.msg.includes('开启');
    await Config.modify('chat', 'EnablePrivateChat', enable);
    e.reply(`[止水私聊AI回复]已${enable ? '开启' : '关闭'}！`);
    return true;
}
