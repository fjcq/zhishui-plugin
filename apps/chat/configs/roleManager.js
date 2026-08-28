/**
 * 人设（角色）索引管理
 * 从旧config.js移植getCurrentRoleIndex/getUserRoleIndex，改读新配置结构：
 * 群覆盖走groupOverrides.roleIndex（替代旧GroupRoleIndex.index），
 * 私聊用户级覆盖走UserDataManager（保持不变）。
 */

import { Config } from '../../../components/index.js';

/**
 * 获取当前角色索引
 * 优先级：群聊群覆盖 > 私聊用户级覆盖 > 全局默认
 * @param {Object} e - 事件对象
 * @returns {Promise<number>} 角色索引
 */
export async function getCurrentRoleIndex(e) {
    let currentRoleIndex = await Config.Chat.CurrentRoleIndex || 0;

    if (!e.group_id) {
        try {
            const userRoleIndex = await Config.GetUserChatConfig(e.user_id, 'RoleIndex');
            if (typeof userRoleIndex === 'number') {
                currentRoleIndex = userRoleIndex;
            }
        } catch {
            // 用户级配置读取失败保持默认
        }
    } else {
        const overrides = await Config.Chat.groupOverrides || [];
        const found = overrides.find(item => String(item.group) === String(e.group_id));
        if (found && typeof found.roleIndex === 'number') {
            currentRoleIndex = found.roleIndex;
        }
    }

    return currentRoleIndex;
}

/**
 * 获取用户个人角色索引（V2角色整合模式专用）
 * 忽略个人与群的角色配置，一律采用全局设置，实现跨场景对话整合
 * @returns {Promise<number>} 全局角色索引
 */
export async function getUserRoleIndex() {
    return await Config.Chat.CurrentRoleIndex || 0;
}
