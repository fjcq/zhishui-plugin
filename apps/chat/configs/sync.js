/**
 * guoba面板与新配置结构的双向同步模块
 *
 * 背景：guoba UI（GSubForm平铺卡片）继续编辑旧ApiList形态，运行时只读
 * providers/models新结构。本模块是两侧的唯一转换层：
 * - renderLegacyView：新结构 → 旧ApiList视图（configReader/下拉框数据源）
 * - applyLegacyView：guoba保存的旧视图 → 覆盖新结构（configWriter调用）
 *
 * name稳定性约定：applyLegacyView按 type+baseUrl+apiKey（provider）与
 * provider+model串（model）匹配既有条目沿用其name，用户改标题/密钥才重命名，
 * 保证groupOverrides/defaultModel引用的别名不因guoba编辑而失效
 */

import { Config } from '../../../components/index.js';
import { PROVIDER_TYPES, inferProviderName } from './schema.js';
import { normalizeLegacyType, normalizeBaseUrl } from './migrate.js';

/**
 * 生成不重复名称（与migrate.js同名函数语义一致，独立实现避免跨模块导出私有函数）
 * @param {string} base - 基础名称
 * @param {Set<string>} used - 已占用集合（函数会追加占用）
 * @returns {string} 唯一名称
 */
function uniqueName(base, used) {
    let name = String(base || '').trim() || '未命名';
    if (!used.has(name)) {
        used.add(name);
        return name;
    }
    let suffix = 2;
    while (used.has(`${name}-${suffix}`)) {
        suffix += 1;
    }
    const result = `${name}-${suffix}`;
    used.add(result);
    return result;
}

/**
 * 新结构 → 旧ApiList视图（纯函数）
 * @param {Object} chatConfig - 新chat配置 { providers, models, defaultModel, visionModel }
 * @returns {{ApiList: Array, CurrentApiIndex: number, VisionApiIndex: number}} 旧视图
 */
export function renderLegacyView(chatConfig) {
    const providers = Array.isArray(chatConfig?.providers) ? chatConfig.providers : [];
    const models = Array.isArray(chatConfig?.models) ? chatConfig.models : [];
    const providerMap = new Map(providers.map(p => [p.name, p]));

    const apiList = models.map(model => {
        const provider = providerMap.get(model.provider) || {};
        return {
            ApiTitle: provider.name || '',
            ApiType: provider.type || PROVIDER_TYPES.OPENAI,
            ApiUrl: provider.baseUrl || '',
            ApiKey: provider.apiKey || '',
            ApiModel: model.model || '',
            TencentAssistantId: provider.tencentAssistantId || ''
        };
    });

    return {
        ApiList: apiList,
        CurrentApiIndex: models.findIndex(m => m.name === chatConfig?.defaultModel),
        VisionApiIndex: models.findIndex(m => m.name === chatConfig?.visionModel)
    };
}

/**
 * 旧ApiList视图 → 新结构（纯函数，name稳定性合并）
 * @param {Object} legacyView - 旧视图 { ApiList, CurrentApiIndex, VisionApiIndex }
 * @param {Object} currentConfig - 现存新chat配置（用于匹配沿用name与保留groupOverrides）
 * @returns {{providers: Array, models: Array, defaultModel: string, visionModel: string, groupOverrides: Array}} 新结构
 */
export function applyLegacyTransform(legacyView, currentConfig) {
    const apiList = Array.isArray(legacyView?.ApiList) ? legacyView.ApiList : [];
    const currentProviders = Array.isArray(currentConfig?.providers) ? currentConfig.providers : [];
    const currentModels = Array.isArray(currentConfig?.models) ? currentConfig.models : [];

    /**
     * provider签名（type+baseUrl+apiKey），同签名条目在旧ApiList平铺结构中
     * 可能出现多次（同一服务商配多个模型），转换时必须合并为一个provider
     */
    const providerSignature = (type, baseUrl, apiKey) => `${type}|${baseUrl}|${apiKey}`;

    const usedProviderNames = new Set();
    const usedModelNames = new Set();
    const providers = [];
    const models = [];
    const providerNameBySignature = new Map();

    apiList.forEach(entry => {
        if (!entry || typeof entry !== 'object') {
            return;
        }
        const type = normalizeLegacyType(entry.ApiType);
        const baseUrl = normalizeBaseUrl(entry.ApiUrl, type);
        const apiKey = String(entry.ApiKey || '');
        const signature = providerSignature(type, baseUrl, apiKey);

        // 同签名复用已创建的provider；首次出现时匹配既有provider（沿用name保持引用稳定）
        let providerName = providerNameBySignature.get(signature);
        if (providerName === undefined) {
            const matched = currentProviders.find(p =>
                providerSignature(p.type, p.baseUrl, p.apiKey) === signature
            );
            providerName = matched
                ? uniqueName(matched.name, usedProviderNames)
                : uniqueName(inferProviderName({ title: entry.ApiTitle, baseUrl, model: entry.ApiModel }), usedProviderNames);
            providerNameBySignature.set(signature, providerName);

            providers.push({
                name: providerName,
                type,
                baseUrl,
                apiKey,
                ...(type === PROVIDER_TYPES.TENCENT && entry.TencentAssistantId
                    ? { tencentAssistantId: String(entry.TencentAssistantId) }
                    : {})
            });
        }

        // 匹配既有model（同provider+model串）沿用name
        const matchedModel = currentModels.find(m => m.provider === providerName && m.model === String(entry.ApiModel || ''));
        const modelName = matchedModel
            ? uniqueName(matchedModel.name, usedModelNames)
            : uniqueName(providerName, usedModelNames);

        models.push({
            name: modelName,
            provider: providerName,
            model: String(entry.ApiModel || ''),
            params: matchedModel?.params || {}
        });
    });

    const currentIndex = Number(legacyView?.CurrentApiIndex);
    const visionIndex = Number(legacyView?.VisionApiIndex);

    return {
        providers,
        models,
        defaultModel: Number.isInteger(currentIndex) && models[currentIndex] ? models[currentIndex].name : '',
        visionModel: Number.isInteger(visionIndex) && visionIndex >= 0 && models[visionIndex] ? models[visionIndex].name : '',
        // 群覆盖guoba不编辑，原样保留；失效model引用一并清理（删除键而非置undefined，避免YAML序列化出null）
        groupOverrides: (Array.isArray(currentConfig?.groupOverrides) ? currentConfig.groupOverrides : [])
            .map(o => {
                if (!o || o.group === undefined) {
                    return null;
                }
                if (o.model && !models.some(m => m.name === o.model)) {
                    const cleaned = { ...o };
                    delete cleaned.model;
                    return cleaned;
                }
                return o;
            })
            .filter(Boolean)
    };
}

/**
 * 将guoba保存的旧视图同步写入新配置结构（IO封装）
 * 同时置migrated=true，防止启动迁移用旧GroupRoleIndex覆盖阶段4后的群人设
 * @param {Object} legacyView - guoba提交的chat数据（含ApiList/CurrentApiIndex/VisionApiIndex）
 * @returns {Promise<{ok: boolean, reason?: string}>} 同步结果
 */
export async function applyLegacyView(legacyView) {
    const current = await Config.Chat;
    const result = applyLegacyTransform(legacyView, current);

    const entries = [
        ['providers', result.providers],
        ['models', result.models],
        ['defaultModel', result.defaultModel],
        ['visionModel', result.visionModel],
        ['groupOverrides', result.groupOverrides],
        ['migrated', true]
    ];
    for (const [key, value] of entries) {
        const ok = await Config.modify('chat', key, value);
        if (!ok) {
            return { ok: false, reason: `write-failed:${key}` };
        }
    }
    return { ok: true };
}
