/**
 * 旧生图配置（Tongyi/DallE/Wenxin/Custom/Edit 五段平铺）→ 新 providers/models 结构迁移模块
 *
 * 设计原则（与 chat 模块 configs/migrate.js 一致）：
 * - 纯转换函数（transformLegacyImageConfig）零依赖，可独立单测
 * - IO封装（migrateImageGenConfig）通过注入 Config 模块解耦宿主，便于 mock
 * - 迁移只新增新字段并写入哨兵 imageMigrated=true，旧字段保留不动
 * - 幂等：哨兵存在时跳过，避免覆盖用户后续对新字段的修改
 * - 只迁移"已配置"的段（必要密钥非空），未配置的段跳过，避免产生空条目
 */

import { IMAGE_PROVIDER_TYPES } from './imageSchema.js';

/** 旧 DefaultProvider 枚举 → 迁移生成的 model 名称（保持行为一致） */
const LEGACY_PROVIDER_MODEL_NAME = {
    tongyi: '通义万相',
    dall_e: 'DALL-E',
    wenxin: '文心一格',
    custom: '自定义生图'
};

/** 旧 Edit 段迁移生成的 model 名称 */
const LEGACY_EDIT_MODEL_NAME = '图像编辑';

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
 * 清理对象中的 undefined 字段（避免 YAML 序列化出 null）
 * @param {Object} obj - 待清理对象
 * @returns {Object} 无 undefined 字段的新对象
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
 * 旧配置结构 → 新配置结构（纯函数，无 IO）
 * 映射规则：
 * - Tongyi（有 ApiKey）→ provider(tongyi) + model（style/pollInterval 归位）
 * - DallE（有 ApiKey）→ provider(openai) + model（quality/responseFormat，sizeSeparator 固定 x）
 * - Wenxin（有 ApiKey+SecretKey）→ provider(wenxin) + model
 * - Custom（有 ApiKey+BaseUrl+Model）→ provider(openai) + model（apiPath/quality/responseFormat/sizeSeparator/extraParams）
 * - Edit（有 ApiKey+BaseUrl+Model）→ provider(openai) + model + edit.model 引用
 * - DefaultProvider → defaultText2Image
 * @param {Object} legacy - 旧 imageGen 配置
 * @returns {{ providers: Array, models: Array, defaultText2Image: string, edit: Object }} 新结构
 */
export function transformLegacyImageConfig(legacy) {
    const usedProviderNames = new Set();
    const usedModelNames = new Set();
    const providers = [];
    const models = [];

    /** 追加一组 provider+model 并返回 model 名称 */
    const pushEntry = (provider, model) => {
        const providerName = uniqueName(provider.name, usedProviderNames);
        const modelName = uniqueName(model.name, usedModelNames);
        providers.push({ ...provider, name: providerName });
        models.push({ ...omitUndefined(model), name: modelName, provider: providerName });
        return modelName;
    };

    // 通义万相（异步任务轮询）
    const tongyi = legacy?.Tongyi || {};
    if (tongyi.ApiKey) {
        pushEntry(
            {
                name: '通义万相',
                type: IMAGE_PROVIDER_TYPES.TONGYI,
                baseUrl: '',
                apiKey: String(tongyi.ApiKey),
                pollInterval: Number(tongyi.PollInterval) || 2000
            },
            {
                name: '通义万相',
                model: String(tongyi.Model || 'wanx2.1-t2i-turbo'),
                style: String(tongyi.Style || '')
            }
        );
    }

    // DALL-E（OpenAI 官方，尺寸分隔符固定 x）
    const dallE = legacy?.DallE || {};
    if (dallE.ApiKey) {
        pushEntry(
            {
                name: 'DALL-E',
                type: IMAGE_PROVIDER_TYPES.OPENAI,
                baseUrl: String(dallE.BaseUrl || 'https://api.openai.com/v1'),
                apiKey: String(dallE.ApiKey)
            },
            {
                name: 'DALL-E',
                model: String(dallE.Model || 'dall-e-3'),
                sizeSeparator: 'x',
                responseFormat: String(dallE.ResponseFormat || 'url'),
                quality: String(dallE.Quality || 'standard')
            }
        );
    }

    // 文心一格（百度 AK/SK 换 token）
    const wenxin = legacy?.Wenxin || {};
    if (wenxin.ApiKey && wenxin.SecretKey) {
        pushEntry(
            {
                name: '文心一格',
                type: IMAGE_PROVIDER_TYPES.WENXIN,
                baseUrl: '',
                apiKey: String(wenxin.ApiKey),
                secretKey: String(wenxin.SecretKey),
                tokenCacheTtl: Number(wenxin.TokenCacheTTL) || 86400
            },
            {
                name: '文心一格',
                model: String(wenxin.Model || 'wenxin-yige-2.0')
            }
        );
    }

    // 自定义服务商（OpenAI 兼容）
    const custom = legacy?.Custom || {};
    if (custom.ApiKey && custom.BaseUrl && custom.Model) {
        pushEntry(
            {
                name: '自定义生图',
                type: IMAGE_PROVIDER_TYPES.OPENAI,
                baseUrl: String(custom.BaseUrl),
                apiKey: String(custom.ApiKey)
            },
            {
                name: '自定义生图',
                model: String(custom.Model),
                apiPath: String(custom.ApiPath || '/images/generations'),
                sizeSeparator: String(custom.SizeSeparator || 'x'),
                responseFormat: String(custom.ResponseFormat || 'url'),
                quality: String(custom.Quality || 'standard'),
                extraParams: String(custom.ExtraParams || '')
            }
        );
    }

    // 图像编辑（OpenAI 兼容，独立 provider + model，被 edit.model 引用）
    const edit = legacy?.Edit || {};
    let editModelName = '';
    if (edit.ApiKey && edit.BaseUrl && edit.Model) {
        editModelName = pushEntry(
            {
                name: LEGACY_EDIT_MODEL_NAME,
                type: IMAGE_PROVIDER_TYPES.OPENAI,
                baseUrl: String(edit.BaseUrl),
                apiKey: String(edit.ApiKey)
            },
            {
                name: LEGACY_EDIT_MODEL_NAME,
                model: String(edit.Model),
                apiPath: String(edit.ApiPath || '/images/generations'),
                sizeSeparator: String(edit.SizeSeparator || 'x'),
                responseFormat: String(edit.ResponseFormat || 'url'),
                extraParams: String(edit.ExtraParams || '')
            }
        );
    }

    // 旧 DefaultProvider（tongyi/dall_e/wenxin/custom）→ defaultText2Image（model 名称引用）
    const legacyDefault = String(legacy?.DefaultProvider || '').trim();
    let defaultText2Image = '';
    if (legacyDefault && LEGACY_PROVIDER_MODEL_NAME[legacyDefault]) {
        const target = LEGACY_PROVIDER_MODEL_NAME[legacyDefault];
        const matched = models.find(m => m.name === target || m.name.startsWith(`${target}-`));
        if (matched) {
            defaultText2Image = matched.name;
        }
    }

    // edit 段：Enable/MaxImages 保留全局语义，Model 换为 model 名称引用
    const editSection = {
        enable: edit.Enable === true,
        model: editModelName,
        maxImages: Number(edit.MaxImages) || 4
    };

    return { providers, models, defaultText2Image, edit: editSection };
}

/**
 * 检测旧配置是否存在且未迁移
 * 判定为"存在任一旧段落键"（无论是否已填密钥），确保旧结构用户全量归一
 * （含 edit 段：避免旧 Edit 结构残留在合并视图导致新代码/面板读到混合结构）
 * @param {Object} legacy - 旧 imageGen 配置对象
 * @returns {boolean} 是否需要迁移
 */
export function needsImageMigration(legacy) {
    const hasLegacySection = Boolean(
        legacy?.Tongyi || legacy?.DallE || legacy?.Wenxin || legacy?.Custom || legacy?.Edit
    );
    return hasLegacySection && legacy?.imageMigrated !== true;
}

/**
 * 执行迁移（IO 封装，Config 模块注入）
 * 逐键写入新字段并落哨兵 imageMigrated=true，旧字段原样保留
 * @param {Object} ConfigModule - 宿主 Config 模块（需提供 getDefOrConfig 与 modify 方法）
 * @param {Object} [options] - 选项
 * @param {boolean} [options.dryRun=false] - 仅预览不写入
 * @returns {Promise<{migrated: boolean, reason?: string, result?: Object}>} 迁移结果
 */
export async function migrateImageGenConfig(ConfigModule, options = {}) {
    const legacy = ConfigModule.getDefOrConfig('imageGen');

    if (!needsImageMigration(legacy)) {
        return { migrated: false, reason: legacy?.imageMigrated === true ? 'already-migrated' : 'no-legacy-config' };
    }

    const result = transformLegacyImageConfig(legacy);
    if (options.dryRun) {
        return { migrated: false, reason: 'dry-run', result };
    }

    const entries = [
        ['providers', result.providers],
        ['models', result.models],
        ['defaultText2Image', result.defaultText2Image],
        ['edit', result.edit],
        ['imageMigrated', true]
    ];
    for (const [key, value] of entries) {
        const ok = await ConfigModule.modify('imageGen', key, value);
        if (!ok) {
            return { migrated: false, reason: `write-failed:${key}`, result };
        }
    }

    return { migrated: true, result };
}
