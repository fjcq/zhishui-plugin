/**
 * 生图模块新配置结构定义
 * providers/models 两级结构（对齐 chat 模块新架构）、格式类型枚举、条目校验
 *
 * 设计说明：
 * - 生图只有三种真实协议格式：OpenAI 兼容（覆盖 DALL-E/火山/SiliconFlow/Agnes 等绝大多数平台）、
 *   通义万相（DashScope 异步任务轮询）、文心一格（百度 AK/SK 换 token）
 * - 模型级参数（apiPath/sizeSeparator/responseFormat/quality/style/extraParams）平铺在 model 条目上，
 *   与 chat 的自由 params 嵌套不同：生图参数是封闭集合，平铺更直观且便于锅巴表单约束
 */

/**
 * 生图 Provider 格式类型枚举
 * openai: OpenAI 兼容格式（/images/generations 端点，文生图与图像编辑共用）
 * tongyi: 通义万相（阿里云 DashScope 异步任务轮询）
 * wenxin: 文心一格（百度千帆 AK/SK 换 access_token）
 */
export const IMAGE_PROVIDER_TYPES = {
    OPENAI: 'openai',
    TONGYI: 'tongyi',
    WENXIN: 'wenxin'
};

/**
 * 生图模型条目支持的全部可选参数字段
 * 用于迁移与校验时收敛字段，避免未知字段混入请求体
 */
export const IMAGE_MODEL_PARAM_KEYS = [
    'apiPath', 'sizeSeparator', 'responseFormat', 'quality', 'style', 'extraParams'
];

/**
 * 判断 API 密钥是否为有效配置（非空）
 * @param {string} apiKey - API 密钥
 * @returns {boolean} 是否有效
 */
export function isImageApiKeyConfigured(apiKey) {
    return Boolean(String(apiKey || '').trim());
}

/**
 * 判断 provider 是否已配置可用（按类型检查必要字段）
 * @param {Object} provider - provider 条目 { name, type, baseUrl, apiKey, secretKey }
 * @returns {boolean} 是否可用
 */
export function isImageProviderConfigured(provider) {
    if (!provider || typeof provider !== 'object') {
        return false;
    }
    if (!isImageApiKeyConfigured(provider.apiKey)) {
        return false;
    }
    // openai 格式必须提供接口地址；wenxin 需要 AK/SK 成对；tongyi 仅需 ApiKey
    if (provider.type === IMAGE_PROVIDER_TYPES.OPENAI && !String(provider.baseUrl || '').trim()) {
        return false;
    }
    if (provider.type === IMAGE_PROVIDER_TYPES.WENXIN && !String(provider.secretKey || '').trim()) {
        return false;
    }
    return true;
}

/**
 * 校验 provider 条目
 * @param {Object} provider - provider 条目
 * @returns {{ valid: boolean, errors: string[] }} 校验结果
 */
export function validateImageProvider(provider) {
    const errors = [];
    if (!provider || typeof provider !== 'object') {
        return { valid: false, errors: ['provider必须为对象'] };
    }
    if (!String(provider.name || '').trim()) {
        errors.push('name不能为空');
    }
    if (!Object.values(IMAGE_PROVIDER_TYPES).includes(provider.type)) {
        errors.push(`type必须为 ${Object.values(IMAGE_PROVIDER_TYPES).join('/')}`);
    }
    if (provider.type === IMAGE_PROVIDER_TYPES.OPENAI && !String(provider.baseUrl || '').trim()) {
        errors.push('openai类型baseUrl不能为空');
    }
    return { valid: errors.length === 0, errors };
}

/**
 * 校验 model 条目
 * @param {Object} model - model 条目 { name, provider, model, ...可选参数 }
 * @param {Array<Object>} [providers] - 可选，已校验的 provider 列表，用于引用检查
 * @returns {{ valid: boolean, errors: string[] }} 校验结果
 */
export function validateImageModel(model, providers) {
    const errors = [];
    if (!model || typeof model !== 'object') {
        return { valid: false, errors: ['model必须为对象'] };
    }
    if (!String(model.name || '').trim()) {
        errors.push('name不能为空');
    }
    if (!String(model.model || '').trim()) {
        errors.push('model不能为空');
    }
    if (!String(model.provider || '').trim()) {
        errors.push('provider引用不能为空');
    } else if (Array.isArray(providers)) {
        const exists = providers.some(p => p.name === model.provider);
        if (!exists) {
            errors.push(`provider "${model.provider}" 不存在`);
        }
    }
    return { valid: errors.length === 0, errors };
}

/**
 * 校验整份生图新配置结构
 * @param {Object} config - 含 providers/models/defaultText2Image/edit 的对象
 * @returns {{ valid: boolean, errors: string[] }} 校验结果
 */
export function validateImageGenConfig(config) {
    const errors = [];
    const providers = Array.isArray(config?.providers) ? config.providers : [];
    const models = Array.isArray(config?.models) ? config.models : [];

    const providerNames = new Set();
    providers.forEach((p, i) => {
        const result = validateImageProvider(p);
        result.errors.forEach(err => errors.push(`providers[${i}]: ${err}`));
        if (providerNames.has(p?.name)) {
            errors.push(`providers[${i}]: name "${p?.name}" 重复`);
        }
        providerNames.add(p?.name);
    });

    const modelNames = new Set();
    models.forEach((m, i) => {
        const result = validateImageModel(m, providers);
        result.errors.forEach(err => errors.push(`models[${i}]: ${err}`));
        if (modelNames.has(m?.name)) {
            errors.push(`models[${i}]: name "${m?.name}" 重复`);
        }
        modelNames.add(m?.name);
    });

    if (config?.defaultText2Image && !modelNames.has(config.defaultText2Image)) {
        errors.push(`defaultText2Image "${config.defaultText2Image}" 不存在于models`);
    }
    const editModel = config?.edit?.model;
    if (editModel && !modelNames.has(editModel)) {
        errors.push(`edit.model "${editModel}" 不存在于models`);
    }

    return { valid: errors.length === 0, errors };
}
