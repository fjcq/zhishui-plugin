/**
 * 角色管理处理模块
 * 处理角色相关的命令
 */

import { Config } from '../../../components/index.js';
import { getCurrentRoleIndex } from '../config.js';
import { clearSessionContext, loadChatMsg, saveChatMsg, convertChatContextForModel } from '../helpers.js';
import { getCurrentApiConfig } from '../helpers.js';

/**
 * 查看对话身份（角色）
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleShowContext(e) {
    let currentRoleIndex = await getCurrentRoleIndex(e);
    try {
        const roleJson = Config.getJsonConfig('RoleProfile');
        const roles = JSON.parse(roleJson);
        const found = roles[currentRoleIndex];
        if (found) {
            e.reply(JSON.stringify(found, null, 2));
        } else {
            e.reply("未找到当前角色设定，请先切换角色。");
        }
    } catch (err) {
        e.reply("读取角色设定失败：" + err.message);
    }
}

/**
 * 枚举角色列表
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleShowRoleList(e) {
    let roles = [];
    let currentRoleIndex = await getCurrentRoleIndex(e);
    try {
        const roleJson = Config.getJsonConfig('RoleProfile');
        const roleData = JSON.parse(roleJson);
        roles = roleData.map(r => ({
            title: r.角色标题 || r.基础身份?.名称 || '未知角色',
            isDefault: r._isDefault || false
        }));
    } catch (err) {
        e.reply('读取角色列表失败');
        return;
    }

    let roleTypeLabel = '全局角色';
    if (!e.group_id) {
        try {
            const userRoleIndex = await Config.GetUserChatConfig(e.user_id, 'RoleIndex');
            if (typeof userRoleIndex === 'number') {
                roleTypeLabel = '个人专属角色';
            }
        } catch (error) {
        }
    } else {
        const groupRoleList = (await Config.Chat.GroupRoleIndex) || [];
        const found = groupRoleList.find(item => String(item.group) === String(e.group_id));
        if (found && typeof found.index === 'number') {
            roleTypeLabel = '群专属角色';
        }
    }

    const list = roles.map((r, i) => {
        let displayText = `${i + 1}. ${r.title}`;
        if (r.isDefault) {
            displayText += ' [预设]';
        }
        if (i === currentRoleIndex) {
            displayText += ' ✅';
        }
        return displayText;
    }).join('\n');

    e.reply(`【当前使用：${roleTypeLabel}】\n可用角色列表：\n${list}`);
}

/**
 * 切换角色
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleSwitchRole(e) {
    if (e.group_id && !e.isMaster) {
        e.reply('群聊中只有主人可以切换角色。');
        return;
    }

    const roleArg = e.msg.replace(/^#?(止水)?(插件|对话)?切换角色/, '').trim();
    if (!roleArg) {
        e.reply('请指定要切换的角色标题或序号');
        return;
    }

    let roles = [];
    try {
        const roleJson = Config.getJsonConfig('RoleProfile');
        roles = JSON.parse(roleJson);
    } catch (err) {
        e.reply('读取角色配置失败');
        return;
    }

    let idx = -1;
    if (/^\d+$/.test(roleArg)) {
        idx = parseInt(roleArg, 10) - 1;
    } else {
        idx = roles.findIndex(r => r.角色标题 === roleArg);
    }

    if (idx < 0 || idx >= roles.length) {
        e.reply('未找到该角色，请检查角色标题或序号是否正确');
        return;
    }

    const sessionId = e.group_id ? `group_${e.group_id}` : `user_${e.user_id}`;

    const { apiConfig } = await getCurrentApiConfig(e);
    const model = (apiConfig.ApiModel || '').toLowerCase();
    const type = (apiConfig.ApiType || '').toLowerCase();

    let lost = false;
    let chatMsg = await loadChatMsg(sessionId);
    if (Array.isArray(chatMsg) && chatMsg.length > 0) {
        const { converted, lostContent } = convertChatContextForModel(chatMsg, type, type, model, model);
        await saveChatMsg(sessionId, converted);
        if (lostContent) lost = true;
    }
    await clearSessionContext(e);

    if (!e.group_id) {
        await Config.SetUserChatConfig(e.user_id, 'RoleIndex', idx);
        let tip = `你的个人角色已切换为：${roles[idx].角色标题}`;
        if (lost) tip += `\n注意：因模型/接口格式不兼容，历史上下文已被简化或部分丢失。建议重新开始对话。`;
        else tip += `\n已自动清除上下文缓存，请重新开始对话。`;
        e.reply(tip);
        return;
    }

    let groupRoleList = (await Config.Chat.GroupRoleIndex) || [];
    const existIdx = groupRoleList.findIndex(item => String(item.group) === String(e.group_id));
    if (existIdx >= 0) {
        groupRoleList[existIdx].index = idx;
    } else {
        groupRoleList.push({ group: String(e.group_id), index: idx });
    }

    await Config.modify('chat', 'GroupRoleIndex', groupRoleList);
    let tip = `本群已切换为角色：${roles[idx].角色标题}`;
    if (lost) tip += `\n注意：因模型/接口格式不兼容，历史上下文已被简化或部分丢失。建议重新开始对话。`;
    else tip += `\n已自动清除上下文缓存，请重新开始对话。`;
    e.reply(tip);
}

/**
 * 添加对话角色
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleAddRole(e) {
    if (!e.isMaster) return;
    let jsonStr = e.msg.replace(/^#?(止水)?(插件|对话)?添加(对话)?角色/, '').trim();
    if (!jsonStr) {
        e.reply("请提供完整的角色JSON内容。");
        return;
    }
    try {
        const newRole = JSON.parse(jsonStr);
        if (!newRole.角色标题) {
            e.reply("角色格式错误：缺少'角色标题'字段");
            return;
        }
        const roleJson = Config.getJsonConfig('RoleProfile');
        let roles = [];
        if (roleJson) {
            roles = JSON.parse(roleJson);
        }
        const existingIndex = roles.findIndex(r => r.角色标题 === newRole.角色标题);
        if (existingIndex >= 0) {
            e.reply(`角色"${newRole.角色标题}"已存在，请使用不同的角色标题`);
            return;
        }
        roles.push(newRole);
        Config.setJsonConfig('RoleProfile', JSON.stringify(roles, null, 2));
        e.reply(`新角色"${newRole.角色标题}"已成功添加！\n当前总共有 ${roles.length} 个角色。`);
    } catch (err) {
        e.reply("角色JSON格式有误：" + err.message);
    }
}
