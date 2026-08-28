/**
 * chat模块新配置管理器
 * 模型解析（群覆盖 > 默认）、视觉模型解析、模型切换
 *
 * 替代旧config.js的getCurrentApiConfig群覆盖逻辑（单一实现，
 * 消除旧版在config.js与handlers/apiHandler.js的双实现）
 */

import { Config } from '../../../components/index.js';
import { isVisionModel, isApiKeyConfigured } from './schema.js';

/**
 * 读取全部provider配置
 * @returns {Promise<Array<Object>>} provider列表
 */
export async function getAllProviders() {
    return await Config.Chat.providers || [];
}

/**
 * 读取全部model配置
 * @returns {Promise<Array<Object>>} model列表
 */
export async function getAllModels() {
    return await Config.Chat.models || [];
}

/**
 * 按名称获取model及其关联provider
 * @param {string} modelName - model别名
 * @returns {Promise<{model: Object, provider: Object}|null>} 未找到时返回null
 */
export async function getModelByName(modelName) {
    const models = await getAllModels();
    const model = models.find(m => m.name === modelName);
    if (!model) {
        return null;
    }
    const providers = await getAllProviders();
    const provider = providers.find(p => p.name === model.provider);
    if (!provider) {
        return null;
    }
    return { model, provider };
}

/**
 * 解析当前会话应使用的模型
 * 优先级：群覆盖（groupOverrides） > 默认（defaultModel） > 第一个model
 * @param {Object} e - 事件对象（含group_id）
 * @returns {Promise<{model: Object, provider: Object}|null>} 解析结果，无可用配置返回null
 */
export async function resolveModel(e) {
    const models = await getAllModels();
    if (models.length === 0) {
        return null;
    }

    let modelName = String(await Config.Chat.defaultModel || '');

    if (e?.group_id) {
        const overrides = await Config.Chat.groupOverrides || [];
        const found = overrides.find(o => String(o.group) === String(e.group_id));
        if (found && found.model) {
            modelName = found.model;
        }
    }

    // 默认名无效时兜底第一个model
    const resolved = await getModelByName(modelName);
    if (resolved) {
        return resolved;
    }
    return await getModelByName(models[0].name);
}

/**
 * 解析视觉模型（主对话模型无视觉能力时的图片识别代理）
 * 优先级：指定visionModel > 自动扫描第一个已配置的视觉模型
 * @returns {Promise<{model: Object, provider: Object}|null>} 解析结果，无可用视觉模型返回null
 */
export async function resolveVisionModel() {
    const specified = String(await Config.Chat.visionModel || '');
    if (specified) {
        const resolved = await getModelByName(specified);
        if (resolved && isApiKeyConfigured(resolved.provider.apiKey)) {
            return resolved;
        }
    }

    // 自动扫描：第一个模型名具备视觉能力且密钥已配置的条目
    const models = await getAllModels();
    for (const model of models) {
        if (isVisionModel(model.model)) {
            const resolved = await getModelByName(model.name);
            if (resolved && isApiKeyConfigured(resolved.provider.apiKey)) {
                return resolved;
            }
        }
    }
    return null;
}

/**
 * 获取全部模型选项（供切换指令/面板下拉框展示）
 * @returns {Promise<Array<{name: string, model: string, provider: string, vision: boolean}>>} 选项列表
 */
export async function getModelOptions() {
    const models = await getAllModels();
    return models.map(m => ({
        name: m.name,
        model: m.model,
        provider: m.provider,
        vision: isVisionModel(m.model)
    }));
}

/**
 * 设置全局默认模型
 * @param {string} modelName - model别名
 * @returns {Promise<boolean>} 是否成功
 */
export async function setDefaultModel(modelName) {
    const exists = (await getAllModels()).some(m => m.name === modelName);
    if (!exists) {
        return false;
    }
    return await Config.modify('chat', 'defaultModel', modelName);
}

/**
 * 设置指定群聊的模型覆盖
 * @param {string|number} groupId - 群号
 * @param {string|null} modelName - model别名，传null表示清除该群的模型覆盖
 * @returns {Promise<boolean>} 是否成功
 */
export async function setGroupModel(groupId, modelName) {
    const group = String(groupId);
    const overrides = await Config.Chat.groupOverrides || [];

    if (modelName !== null) {
        const exists = (await getAllModels()).some(m => m.name === modelName);
        if (!exists) {
            return false;
        }
    }

    const index = overrides.findIndex(o => String(o.group) === group);
    if (modelName === null) {
        if (index === -1) {
            return true;
        }
        const entry = overrides[index];
        delete entry.model;
        // 仅剩group时整条移除，否则保留其余字段（如roleIndex）
        if (Object.keys(entry).length <= 1) {
            overrides.splice(index, 1);
        } else {
            overrides[index] = entry;
        }
    } else if (index === -1) {
        overrides.push({ group, model: modelName });
    } else {
        overrides[index] = { ...overrides[index], model: modelName };
    }

    return await Config.modify('chat', 'groupOverrides', overrides);
}
