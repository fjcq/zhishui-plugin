/**
 * Schema工具函数
 */

import { Config } from '../../components/index.js';

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

/**
 * 获取对话模型选项列表（引用 chat.models 条目名称）
 * @param {boolean} [withAuto=false] - 是否在首位附加"自动选择"项
 * @returns {Array} 对话模型选项
 */
export function getChatModelOptions(withAuto = false) {
    const chat = Config.getDefOrConfig('chat') || {};
    const options = (chat.models || []).map(m => ({
        label: `${m.name}（${m.model || '未填模型'}）`,
        value: m.name
    }));
    return withAuto
        ? [{ label: '自动选择（第一个模型条目）', value: '' }, ...options]
        : options;
}

/**
 * 获取对话服务商选项列表（引用 chat.providers 条目名称）
 * 供模型列表的"所属服务商"下拉选择，避免手输名称出错导致引用悬空
 * @returns {Array} 对话服务商选项
 */
export function getChatProviderOptions() {
    const chat = Config.getDefOrConfig('chat') || {};
    return (chat.providers || []).map(p => ({
        label: `${p.name}（${p.type || '未选类型'}${p.baseUrl ? ` · ${String(p.baseUrl).replace(/^https?:\/\//, '').split('/')[0]}` : ''}）`,
        value: p.name
    }));
}

/**
 * 获取生图模型选项列表（引用 imageGen.models 条目名称）
 * @param {boolean} [withAuto=false] - 是否在首位附加"自动选择"项
 * @returns {Array} 生图模型选项
 */
export function getImageModelOptions(withAuto = false) {
    const imageGen = Config.getDefOrConfig('imageGen') || {};
    const options = (imageGen.models || []).map(m => ({
        label: `${m.name}（${m.model || '未填模型'}）`,
        value: m.name
    }));
    return withAuto
        ? [{ label: '自动选择（第一个可用模型）', value: '' }, ...options]
        : options;
}

/**
 * 获取生图服务商选项列表（引用 imageGen.providers 条目名称）
 * 供模型列表的"所属服务商"下拉选择，避免手输名称出错导致引用悬空
 * @returns {Array} 生图服务商选项
 */
export function getImageProviderOptions() {
    const imageGen = Config.getDefOrConfig('imageGen') || {};
    return (imageGen.providers || []).map(p => ({
        label: `${p.name}（${p.type || '未选类型'}${p.baseUrl ? ` · ${String(p.baseUrl).replace(/^https?:\/\//, '').split('/')[0]}` : ''}）`,
        value: p.name
    }));
}
