/**
 * 入群验证配置管理
 * 提供验证配置读取与验证群列表的增删，VerifyGroups 以 [{ group: 群号 }] 结构落盘
 */

import { Config, logger } from '../../components/index.js';

/**
 * 从原始配置提取群号列表（兼容对象与字符串两种条目格式）
 * @param {Array} rawGroups - 原始 VerifyGroups 配置
 * @returns {string[]} 群号字符串列表
 */
function extractGroupIds(rawGroups) {
    if (!Array.isArray(rawGroups)) {
        return [];
    }

    return rawGroups
        .map(item => {
            if (item !== null && typeof item === 'object') {
                return item.group ?? item.group_id;
            }
            return item;
        })
        .filter(id => id !== undefined && id !== null && String(id).trim() !== '')
        .map(id => String(id).trim());
}

/**
 * 获取验证配置（默认配置与用户配置合并）
 * @returns {{enable: boolean, useAI: boolean, verifyGroups: string[], timeout: number,
 *           passCooldown: number}} 规范化配置
 */
export function getVerifyConfig() {
    const config = Config.getDefOrConfig('groupVerify') || {};
    const timeout = Number(config.Timeout);
    const passCooldown = Number(config.PassCooldown);

    return {
        enable: config.Enable === true,
        useAI: config.UseAI === true,
        verifyGroups: extractGroupIds(config.VerifyGroups),
        timeout: Number.isFinite(timeout) && timeout > 0 ? Math.floor(timeout) : 300,
        passCooldown: Number.isFinite(passCooldown) && passCooldown >= 0 ? Math.floor(passCooldown) : 86400
    };
}

/**
 * 判断群是否在验证群列表中
 * @param {string[]} verifyGroups - 验证群号列表
 * @param {string|number} groupId - 目标群号
 * @returns {boolean} 是否为验证群
 */
export function isVerifyGroup(verifyGroups, groupId) {
    return verifyGroups.includes(String(groupId));
}

/**
 * 读取当前验证群原始配置列表（保留落盘结构）
 * @returns {Array} 原始 VerifyGroups 数组
 */
function getRawVerifyGroups() {
    const config = Config.getConfig('groupVerify') || {};
    return Array.isArray(config.VerifyGroups) ? config.VerifyGroups : [];
}

/**
 * 添加验证群
 * @param {string|number} groupId - 目标群号
 * @returns {{success: boolean, message: string}} 操作结果
 */
export function addVerifyGroup(groupId) {
    const id = String(groupId).trim();
    if (!/^\d+$/.test(id)) {
        return { success: false, message: `群号 ${id} 格式不正确` };
    }

    const rawGroups = getRawVerifyGroups();
    if (findGroupIndex(rawGroups, id) >= 0) {
        return { success: false, message: `群 ${id} 已在验证群列表中` };
    }

    Config.modify('groupVerify', 'VerifyGroups', [...rawGroups, { group: id }]);
    logger.mark(`[入群验证] 添加验证群:${id}`);
    return { success: true, message: `已将群 ${id} 加入入群验证列表` };
}

/**
 * 在原始列表中查找目标群号的条目下标
 * @param {Array} rawGroups - 原始 VerifyGroups 数组
 * @param {string} id - 目标群号
 * @returns {number} 条目下标，未找到返回 -1
 */
function findGroupIndex(rawGroups, id) {
    return rawGroups.findIndex(item => {
        const gid = item !== null && typeof item === 'object'
            ? (item.group ?? item.group_id)
            : item;
        return gid !== undefined && gid !== null && String(gid).trim() === id;
    });
}

/**
 * 移除验证群
 * @param {string|number} groupId - 目标群号
 * @returns {{success: boolean, message: string}} 操作结果
 */
export function removeVerifyGroup(groupId) {
    const id = String(groupId).trim();
    const rawGroups = getRawVerifyGroups();
    const index = findGroupIndex(rawGroups, id);

    if (index < 0) {
        return { success: false, message: `群 ${id} 不在验证群列表中` };
    }

    Config.modify('groupVerify', 'VerifyGroups', rawGroups.filter((_, i) => i !== index));
    logger.mark(`[入群验证] 移除验证群:${id}`);
    return { success: true, message: `已将群 ${id} 移出入群验证列表` };
}

/**
 * 设置入群验证总开关
 * @param {boolean} enable - 是否启用
 * @returns {{success: boolean, message: string}} 操作结果
 */
export function setVerifyEnable(enable) {
    Config.modify('groupVerify', 'Enable', enable === true);
    logger.mark(`[入群验证] 总开关:${enable ? '开启' : '关闭'}`);
    return { success: true, message: `入群验证已${enable ? '开启' : '关闭'}` };
}
