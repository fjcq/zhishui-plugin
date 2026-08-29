/**
 * 旧ApiList配置 → 新providers/models结构迁移模块
 *
 * 设计原则：
 * - 纯转换函数（transformLegacyConfig）零依赖，可独立单测
 * - IO封装（migrateChatConfig）通过注入Config模块解耦宿主，便于mock
 * - 迁移只新增新字段并写入哨兵，保留旧字段不动（旧代码继续读ApiList，
 *   旧字段待阶段6收尾统一清理），保证绞杀式重写期间新旧共存安全
 * - 幂等：哨兵migrated=true存在时跳过，避免覆盖用户后续对新字段的修改
 */

import { PROVIDER_TYPES, inferProviderName } from './schema.js';

/**
 * 旧ApiType服务商别名快照（迁移专用，已冻结不再增补）
 * 历史配置中这些值均表示OpenAI兼容格式，统一归一为openai
 * 注意：旧anthropic别名也归一为openai——旧架构中anthropic走OpenAI兼容端点，
 * 迁移不改变行为，用户需要原生格式时手动改type为anthropic
 */
const LEGACY_OPENAI_ALIASES = [
    'siliconflow', 'deepseek', 'zhipu', 'moonshot', 'kimi', 'qwen',
    'doubao', 'baichuan', 'yi', 'minimax', 'stepfun', '01ai', 'agnes',
    'openrouter', 'together', 'fireworks', 'groq', 'perplexity',
    'replicate', 'anthropic', 'cohere', 'mistral', 'deepinfra',
    'novita', 'lingyi', 'xai'
];

/**
 * 归一化旧ApiType为新格式类型
 * @param {string} apiType - 旧ApiType值
 * @returns {string} PROVIDER_TYPES中的格式值，未知值一律归一为openai
 */
export function normalizeLegacyType(apiType) {
    const type = String(apiType || '').trim().toLowerCase();
    if (type === PROVIDER_TYPES.TENCENT) {
        return PROVIDER_TYPES.TENCENT;
    }
    if (type === PROVIDER_TYPES.GEMINI) {
        return PROVIDER_TYPES.GEMINI;
    }
    // anthropic保留原生类型判断已在新配置中处理；旧anthropic别名按OpenAI兼容处理
    if (type === PROVIDER_TYPES.ANTHROPIC) {
        return PROVIDER_TYPES.OPENAI;
    }
    if (LEGACY_OPENAI_ALIASES.includes(type)) {
        return PROVIDER_TYPES.OPENAI;
    }
    return PROVIDER_TYPES.OPENAI;
}

/**
 * 规范化baseUrl
 * 旧ApiUrl是完整端点地址，新baseUrl是端点前缀：
 * - openai格式：裁掉尾部 /chat/completions（SDK自行拼接）
 * - gemini格式：裁掉 /models/xxx:generateContent 尾部（provider自行拼接）
 * - tencent及其他：保持原样（provider内部按完整URL语义处理）
 * @param {string} apiUrl - 旧完整端点地址
 * @param {string} providerType - 新格式类型
 * @returns {string} 规范化后的baseUrl
 */
export function normalizeBaseUrl(apiUrl, providerType) {
    const url = String(apiUrl || '').trim();
    if (!url) {
        return '';
    }
    if (providerType === PROVIDER_TYPES.OPENAI) {
        return url.replace(/\/chat\/completions\/?$/i, '');
    }
    if (providerType === PROVIDER_TYPES.GEMINI) {
        return url.replace(/\/models\/[^/]*:generateContent\/?$/i, '');
    }
    return url;
}

/**
 * 生成不重复的名称
 * @param {string} base - 基础名称
 * @param {Set<string>} used - 已占用名称集合（函数会追加占用）
 * @returns {string} 唯一名称，冲突时追加-2/-3后缀
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
 * 清理对象中的undefined字段（避免YAML序列化出null）
 * @param {Object} obj - 待清理对象
 * @returns {Object} 无undefined字段的新对象
 */
function omitUndefined(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
            result[key] = value;
        }
    }
    return result;
}

/**
 * 旧配置结构 → 新配置结构（纯函数，无IO）
 * @param {Object} legacy - 旧chat配置 { ApiList, CurrentApiIndex, VisionApiIndex, GroupRoleIndex }
 * @returns {{ providers: Array, models: Array, defaultModel: string, visionModel: string, groupOverrides: Array }} 新结构
 */
export function transformLegacyConfig(legacy) {
    const apiList = Array.isArray(legacy?.ApiList) ? legacy.ApiList : [];
    const usedProviderNames = new Set();
    const usedModelNames = new Set();
    const providers = [];
    const models = [];

    apiList.forEach(entry => {
        if (!entry || typeof entry !== 'object') {
            return;
        }
        const type = normalizeLegacyType(entry.ApiType);
        const providerName = uniqueName(inferProviderName(entry), usedProviderNames);
        const modelName = uniqueName(providerName, usedModelNames);

        const provider = {
            name: providerName,
            type,
            baseUrl: normalizeBaseUrl(entry.ApiUrl, type),
            apiKey: String(entry.ApiKey || '')
        };
        // 腾讯助手ID是接入点级属性，仅在tencent类型下保留
        if (type === PROVIDER_TYPES.TENCENT && entry.TencentAssistantId) {
            provider.tencentAssistantId = String(entry.TencentAssistantId);
        }
        providers.push(provider);

        // 视觉能力三态：旧条目手填的Vision标记 → 布尔vision（auto不写键）
        const vision = entry.Vision === 'true' ? true : entry.Vision === 'false' ? false : undefined;

        const model = {
            name: modelName,
            provider: providerName,
            model: String(entry.ApiModel || ''),
            params: {},
            ...(vision !== undefined ? { vision } : {})
        };
        models.push(model);
    });

    // 旧CurrentApiIndex → defaultModel（索引无效时留空，manager兜底第一个模型）
    const currentIndex = Number(legacy?.CurrentApiIndex);
    const defaultModel = Number.isInteger(currentIndex) && models[currentIndex]
        ? models[currentIndex].name
        : '';

    // 旧VisionApiIndex → visionModel（-1或无效表示自动选择，留空）
    const visionIndex = Number(legacy?.VisionApiIndex);
    const visionModel = Number.isInteger(visionIndex) && visionIndex >= 0 && models[visionIndex]
        ? models[visionIndex].name
        : '';

    // 旧GroupRoleIndex → groupOverrides（apiIndex→model别名，index→roleIndex）
    const groupOverrides = (Array.isArray(legacy?.GroupRoleIndex) ? legacy.GroupRoleIndex : [])
        .filter(item => item && item.group !== undefined && item.group !== null)
        .map(item => {
            const modelIdx = Number(item.apiIndex);
            const overrideModel = Number.isInteger(modelIdx) && models[modelIdx]
                ? models[modelIdx].name
                : undefined;
            return omitUndefined({
                group: item.group,
                model: overrideModel,
                roleIndex: typeof item.index === 'number' ? item.index : undefined
            });
        });

    return { providers, models, defaultModel, visionModel, groupOverrides };
}

/**
 * 检测旧配置是否存在且未迁移
 * @param {Object} legacy - 旧chat配置对象
 * @returns {boolean} 是否需要迁移
 */
export function needsMigration(legacy) {
    return Array.isArray(legacy?.ApiList)
        && legacy.ApiList.length > 0
        && legacy.migrated !== true;
}

/**
 * 执行迁移（IO封装，Config模块注入）
 * 逐键写入新字段并落哨兵migrated=true，旧字段原样保留
 * @param {Object} ConfigModule - 宿主Config模块（需提供Chat getter与modify方法）
 * @param {Object} [options] - 选项
 * @param {boolean} [options.dryRun=false] - 仅预览不写入
 * @returns {Promise<{migrated: boolean, reason?: string, result?: Object}>} 迁移结果
 */
export async function migrateChatConfig(ConfigModule, options = {}) {
    const legacy = await ConfigModule.Chat;

    if (!Array.isArray(legacy?.ApiList) || legacy.ApiList.length === 0) {
        return { migrated: false, reason: 'no-legacy-config' };
    }
    if (legacy.migrated === true) {
        return { migrated: false, reason: 'already-migrated' };
    }

    const result = transformLegacyConfig(legacy);
    if (options.dryRun) {
        return { migrated: false, reason: 'dry-run', result };
    }

    const entries = [
        ['providers', result.providers],
        ['models', result.models],
        ['defaultModel', result.defaultModel],
        ['visionModel', result.visionModel],
        ['groupOverrides', result.groupOverrides],
        ['migrated', true]
    ];
    for (const [key, value] of entries) {
        const ok = await ConfigModule.modify('chat', key, value);
        if (!ok) {
            return { migrated: false, reason: `write-failed:${key}`, result };
        }
    }

    return { migrated: true, result };
}
