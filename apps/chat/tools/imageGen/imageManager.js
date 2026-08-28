/**
 * 生图模块配置管理器
 * 模型解析（文生图默认/图像编辑引用）、可用模型扫描、模型选项（供锅巴下拉框）
 *
 * 对齐 chat 模块 configs/manager.js 的职责边界：只做配置解析，不发请求
 */

import Config from '../../../../components/Config.js';
import { isImageProviderConfigured } from './imageSchema.js';

/**
 * 读取生图模块全部配置
 * @returns {Object} 合并后的 imageGen 配置
 */
export function getImageGenConfig() {
    return Config.getDefOrConfig('imageGen') || {};
}

/**
 * 读取全部生图 provider 配置
 * @returns {Array<Object>} provider 列表
 */
export function getImageProviders() {
    return Array.isArray(getImageGenConfig().providers) ? getImageGenConfig().providers : [];
}

/**
 * 读取全部生图 model 配置
 * @returns {Array<Object>} model 列表
 */
export function getImageModels() {
    return Array.isArray(getImageGenConfig().models) ? getImageGenConfig().models : [];
}

/**
 * 按名称获取 model 及其关联 provider
 * @param {string} modelName - model 别名
 * @returns {{model: Object, provider: Object}|null} 未找到时返回 null
 */
export function getImageModelByName(modelName) {
    const model = getImageModels().find(m => m.name === modelName);
    if (!model) {
        return null;
    }
    const provider = getImageProviders().find(p => p.name === model.provider);
    if (!provider) {
        return null;
    }
    return { model, provider };
}

/**
 * 判断 model 条目是否可用（模型名非空且关联 provider 已配置）
 * @param {Object} model - model 条目
 * @returns {boolean} 是否可用
 */
export function isImageModelUsable(model) {
    if (!model || !String(model.model || '').trim()) {
        return false;
    }
    const provider = getImageProviders().find(p => p.name === model.provider);
    return isImageProviderConfigured(provider);
}

/**
 * 解析文生图应使用的模型
 * 优先级：defaultText2Image 指定 > 第一个可用的 model
 * @returns {{model: Object, provider: Object}|null} 解析结果，无可用配置返回 null
 */
export function resolveText2ImageModel() {
    const models = getImageModels();

    const specified = String(getImageGenConfig().defaultText2Image || '').trim();
    if (specified) {
        const resolved = getImageModelByName(specified);
        if (resolved && isImageModelUsable(resolved.model)) {
            return resolved;
        }
    }

    // 自动模式：静默使用第一个可用 model
    for (const model of models) {
        const resolved = getImageModelByName(model.name);
        if (resolved && isImageModelUsable(model)) {
            return resolved;
        }
    }
    return null;
}

/**
 * 解析图像编辑应使用的模型
 * 仅使用 edit.model 显式引用的条目（编辑不做自动回退，避免误用文生图模型改图）
 * @returns {{model: Object, provider: Object}|null} 解析结果，未配置或不可用返回 null
 */
export function resolveEditModel() {
    const edit = getImageGenConfig().edit || {};
    const modelName = String(edit.model || '').trim();
    if (!modelName) {
        return null;
    }
    const resolved = getImageModelByName(modelName);
    if (resolved && isImageModelUsable(resolved.model)) {
        return resolved;
    }
    return null;
}

/**
 * 获取全部生图模型选项（供切换指令/锅巴下拉框展示）
 * @returns {Array<{name: string, model: string, provider: string, type: string, usable: boolean}>} 选项列表
 */
export function getImageModelOptions() {
    const providers = getImageProviders();
    return getImageModels().map(m => {
        const provider = providers.find(p => p.name === m.provider);
        return {
            name: m.name,
            model: m.model,
            provider: m.provider,
            type: provider?.type || '',
            usable: isImageModelUsable(m)
        };
    });
}

export default {
    getImageGenConfig,
    getImageProviders,
    getImageModels,
    getImageModelByName,
    isImageModelUsable,
    resolveText2ImageModel,
    resolveEditModel,
    getImageModelOptions
};
