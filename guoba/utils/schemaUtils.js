/**
 * Schema工具函数
 */

import { Config } from '../../components/index.js';
import { getApiTypeOptions } from '../../apps/chat/api-types.js';

/**
 * 获取最新角色配置
 * @returns {Array} 角色列表
 */
export function getLatestRoles() {
    try {
        const latestRoleContent = Config.getJsonConfig('RoleProfile');
        return latestRoleContent ? JSON.parse(latestRoleContent) : [];
    } catch (err) {
        console.error('获取最新角色配置失败:', err);
        return [];
    }
}

/**
 * 获取API类型选项
 * @returns {Array} API类型选项列表
 */
export function getApiTypeSelectOptions() {
    return getApiTypeOptions().map(option => ({
        label: option.features && option.features.length > 0
            ? `${option.label} (${option.features.join('、')})`
            : option.label,
        value: option.value
    }));
}

/**
 * 获取角色选项列表
 * @param {Array} [roles] - 角色列表（可选，不传则自动获取）
 * @returns {Array} 角色选项
 */
export function getRoleOptions(roles) {
    const roleList = roles || getLatestRoles();
    return (roleList || []).map((role, idx) => ({
        label: role['角色标题'] || role.角色标题 || `角色${idx + 1}`,
        value: idx
    }));
}

/**
 * 获取API选项列表
 * @returns {Array} API选项
 */
export function getApiOptions() {
    return (Config.Chat?.ApiList || []).map((api, idx) => ({
        label: `${api.ApiType || '未知'} - ${api.ApiUrl || '未配置'}`,
        value: idx
    }));
}

/**
 * 获取资源站选项列表
 * @returns {Array} 资源站选项
 */
export function getResourceOptions() {
    return (Config.SearchVideos?.resources || []).map((item, idx) => {
        const site = item?.site || item;
        const title = site?.title || `资源站${idx + 1}`;
        return { label: title, value: idx };
    });
}
