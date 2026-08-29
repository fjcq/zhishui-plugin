/**
 * 用户配置处理模块
 * 处理用户配置相关的命令
 */

import { getCurrentRoleIndex } from '../configs/roleManager.js';
import { clearSessionContext, getSessionKeyv, loadChatMsg, generateSessionId } from '../helpers.js';
import { searchMessages, isAvailable as storeAvailable } from '../storage/chatStore.js';
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
 * 从消息内容提取可读文本（JSON 包装格式提取 message 字段）
 * @param {string} content - 存储的消息内容
 * @returns {string} 可读文本
 */
function extractDisplayContent(content) {
    if (!content) {
        return '';
    }
    try {
        const obj = JSON.parse(content);
        if (obj && typeof obj === 'object' && typeof obj.message === 'string') {
            return obj.message;
        }
    } catch { /* 非JSON内容原样返回 */ }
    return content;
}

/**
 * 解析查询文本中的日期条件
 * 支持：今天 / 昨天 / YYYY-MM-DD / YYYY-MM-DD~YYYY-MM-DD
 * @param {string} text - 查询文本
 * @returns {{ startTime: number, endTime: number, rest: string }} 时间范围与剩余文本
 */
function parseDateRange(text) {
    const now = new Date();
    const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    let startTime = null;
    let endTime = null;
    let rest = text;

    const rangeMatch = text.match(/(\d{4}-\d{2}-\d{2})\s*[~～至到]\s*(\d{4}-\d{2}-\d{2})/);
    const singleMatch = text.match(/(\d{4}-\d{2}-\d{2})/);

    if (rangeMatch) {
        const s = new Date(`${rangeMatch[1]}T00:00:00`).getTime();
        const e = new Date(`${rangeMatch[2]}T23:59:59`).getTime();
        if (!isNaN(s) && !isNaN(e)) {
            startTime = s;
            endTime = e;
            rest = rest.replace(rangeMatch[0], ' ');
        }
    } else if (singleMatch) {
        const s = new Date(`${singleMatch[1]}T00:00:00`).getTime();
        const e = new Date(`${singleMatch[1]}T23:59:59`).getTime();
        if (!isNaN(s) && !isNaN(e)) {
            startTime = s;
            endTime = e;
            rest = rest.replace(singleMatch[0], ' ');
        }
    } else if (/今天/.test(text)) {
        startTime = dayStart(now);
        endTime = now.getTime() + 60000;
        rest = rest.replace(/今天/g, ' ');
    } else if (/昨天/.test(text)) {
        const yesterday = new Date(now.getTime() - 86400000);
        startTime = dayStart(yesterday);
        endTime = dayStart(now) - 1;
        rest = rest.replace(/昨天/g, ' ');
    }

    return { startTime, endTime, rest: rest.trim() };
}

/**
 * 检索聊天记录（主人专用，基于 SQLite 全量历史）
 * 用法：#查聊天记录 [关键词] [@某人] [今天|昨天|日期|日期~日期]
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleSearchChatHistory(e) {
    if (!e.isMaster) {
        e.reply('只有主人可以查询聊天记录。');
        return;
    }

    if (!await storeAvailable()) {
        e.reply('当前环境不支持 SQLite 存储，无法检索历史记录。');
        return;
    }

    try {
        // 提取查询参数：去掉指令前缀后的剩余文本
        const queryText = (e.msg || '').replace(/^#?(止水)?(插件|对话)?查(聊天)?记录/, '').trim();
        const { startTime, endTime, rest } = parseDateRange(queryText);
        const keyword = rest || null;

        // @某人 → 指定用户；@全体 无意义，取首个
        let targetUserId = null;
        if (e.at) {
            targetUserId = Array.isArray(e.at) ? e.at[0] : e.at;
        }

        // 检索范围：群聊查当前群，私聊查与主人自己的对话
        const conditions = { keyword, startTime, endTime, limit: 50 };
        if (e.group_id) {
            conditions.groupId = e.group_id;
            if (targetUserId) {
                conditions.userId = targetUserId;
            }
        } else if (targetUserId) {
            conditions.userId = targetUserId;
        } else {
            conditions.userId = e.user_id;
        }

        if (!keyword && !targetUserId && startTime === null) {
            e.reply([
                '【查询聊天记录】用法：',
                '#查聊天记录 关键词',
                '#查聊天记录 @某人',
                '#查聊天记录 今天 / 昨天 / 2026-08-01',
                '#查聊天记录 2026-08-01~08-15 关键词 @某人',
                '（群聊查当前群，私聊查与自己的对话）'
            ].join('\n'));
            return;
        }

        const rows = await searchMessages(conditions);

        if (!rows.length) {
            e.reply('未找到匹配的聊天记录');
            return;
        }

        const lines = [`*** 聊天记录检索（${rows.length}条）***`];
        for (const row of rows) {
            const time = new Date(row.timestamp).toLocaleString('zh-CN', { hour12: false });
            const role = row.role === 'assistant' ? 'AI' : (row.name || row.user_id || '用户');
            lines.push(`[${time}] ${role}: ${extractDisplayContent(row.content)}`);
        }

        const { common } = await import('../../../model/index.js');
        common.getforwardMsg(e, lines, {
            isxml: true,
            xmlTitle: '聊天记录检索',
        });
    } catch (err) {
        console.error('查询聊天记录出错:', err);
        e.reply('查询聊天记录失败: ' + err.message);
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
