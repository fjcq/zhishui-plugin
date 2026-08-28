/**
 * Schema工具函数
 */

import { Config } from '../../components/index.js';
import { renderLegacyView } from '../../apps/chat/configs/sync.js';

/**
 * 获取API类型选项（含anthropic原生格式，与新架构PROVIDER_TYPES一致）
 * @returns {Array} API类型选项列表
 */
function getApiTypeOptions() {
    return [
        { label: 'OpenAI兼容', value: 'openai', description: 'OpenAI兼容格式，覆盖绝大多数模型服务商', features: ['多模态', '工具调用', '思维链'] },
        { label: 'Anthropic', value: 'anthropic', description: 'Claude原生格式（/v1/messages），支持tool use与extended thinking', features: ['多模态', '工具调用', '思维链'] },
        { label: 'Google Gemini', value: 'gemini', description: 'Gemini原生格式，支持多模态和联网搜索', features: ['多模态', '联网'] },
        { label: '腾讯元器', value: 'tencent', description: '腾讯元器API，需要配置助手ID', features: [] }
    ];
}

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
 * 选项label格式：#序号 标题 - 模型名（从新providers/models结构经renderLegacyView渲染）
 * @returns {Array} API选项
 */
export function getApiOptions() {
    const view = renderLegacyView(Config.Chat);
    return view.ApiList.map((api, idx) => ({
        label: `#${idx + 1} ${api.ApiTitle || api.ApiModel || '未命名'}`,
        value: idx
    }));
}

/**
 * 获取视觉模型选项列表（含"自动选择"项）
 * @returns {Array} 视觉模型选项
 */
export function getVisionApiOptions() {
    const view = renderLegacyView(Config.Chat);
    return [
        { label: '自动选择（第一个已配置的视觉模型）', value: -1 },
        ...view.ApiList.map((api, idx) => ({
            label: `#${idx + 1} ${api.ApiModel || '未命名模型'}（${api.ApiTitle || '未命名'}）`,
            value: idx
        }))
    ];
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
