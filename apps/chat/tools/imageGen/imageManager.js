/**
 * 生图模块配置管理器
 * 模型解析（文生图默认/图像编辑引用）、可用模型扫描、模型选项（供锅巴下拉框）
 *
 * 对齐 chat 模块 configs/manager.js 的职责边界：只做配置解析，不发请求
 */

import Config from '../../../../components/Config.js';
import { logger } from '../../../../components/index.js';
import { isImageProviderConfigured } from './imageSchema.js';

/**
 * 编辑型模型关键词黑名单（大小写不敏感匹配 model.model）
 * 当 resolveText2ImageModel 自动扫描文生图默认模型时，
 * 命中以下关键词的 model 直接跳过，避免把编辑模型当作文生图模型。
 * 注意：用户在 defaultText2Image 中显式指定时也会被检查并跳过（加警告日志），
 *       确保无论怎么配置都不会触发服务商 400。
 */
const EDIT_MODEL_BLACKLIST_KEYWORDS = [
    /image[_\- ]?edit/i,
    /edit[_\- ]?image/i,
    /-edit-?\d/i,
    /\/edit$/i,
    /img[_\- ]?edit/i
];

/**
 * 判断 model 是否明显是"图像编辑"专用模型，不能用于纯文生图。
 * 匹配：model.model 字符串中的关键词（更可靠），其次是 name。
 * @param {Object} model - model 配置条目
 * @returns {boolean} 是否是编辑专用模型
 */
export function isEditOnlyModel(model) {
    if (!model) return false;
    const haystack = [model.model, model.name, model.description]
        .filter(Boolean)
        .join(' ');
    return EDIT_MODEL_BLACKLIST_KEYWORDS.some(re => re.test(haystack));
}

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
 * 优先级：defaultText2Image 指定 > 第一个可用的 model（同时跳过编辑专用模型）
 * 用户显式指定了编辑型模型时会降级为自动扫描并输出 warn，避免 400
 * @returns {{model: Object, provider: Object}|null} 解析结果，无可用配置返回 null
 */
export function resolveText2ImageModel() {
    const models = getImageModels();

    const specified = String(getImageGenConfig().defaultText2Image || '').trim();
    if (specified) {
        const resolved = getImageModelByName(specified);
        if (resolved && isImageModelUsable(resolved.model)) {
            if (isEditOnlyModel(resolved.model)) {
                logger.warn(
                    `[生图配置] defaultText2Image="${specified}" 指向编辑型模型 "${resolved.model.model}"，` +
                    `将降级为自动扫描可用的文生图模型。请改配置：编辑型模型只应用于 edit.model，不应作为文生图默认。`
                );
                // 降级：继续走下面的自动扫描分支
            } else {
                return resolved;
            }
        } else if (resolved) {
            logger.warn(`[生图配置] defaultText2Image="${specified}" 关联的 provider 未完成配置，降级自动选择`);
        }
    }

    // 自动模式：使用第一个可用且非编辑型 model；如果全部是编辑型才兜底最后一个
    // （极端情况：用户只配置了编辑模型时不返回 null，让下游报 400 由错误详情暴露原因）
    let lastUsable = null;
    for (const model of models) {
        const resolved = getImageModelByName(model.name);
        if (resolved && isImageModelUsable(model)) {
            if (!isEditOnlyModel(model)) {
                return resolved;
            }
            lastUsable = resolved;
        }
    }
    if (lastUsable) {
        logger.warn(
            `[生图配置] 扫描到的可用模型全部是编辑型，兜底使用 "${lastUsable.model.name}"。` +
            `纯文生图请求可能被服务商拒绝，建议在 models 中添加至少一个文生图模型（如 Z-Image-Turbo、ERNIE-Image-Turbo 等）。`
        );
    }
    return lastUsable;
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
