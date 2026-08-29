/**
 * chat模块新配置结构定义
 * providers/models两级结构、格式类型枚举、域名推断与条目校验
 *
 * 本文件是新配置的唯一事实源（收编自旧api-types.js中仍有价值的部分）：
 * - PROVIDER_DOMAIN_MAP：域名→服务商显示名（迁移时推断provider名称）
 * - VISION_MODEL_KEYWORDS：视觉模型识别关键词（原visionAgent.js）
 * - 旧26项服务商别名列表已废弃，openai格式由官方SDK的baseURL天然兼容
 */

/**
 * Provider格式类型枚举
 * openai: OpenAI兼容格式（官方SDK + baseURL覆盖，兼容绝大多数服务商）
 * anthropic: Anthropic原生格式（/v1/messages端点）
 * gemini: Google Gemini原生格式
 * tencent: 腾讯元器格式
 */
export const PROVIDER_TYPES = {
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
    GEMINI: 'gemini',
    TENCENT: 'tencent'
};

/**
 * 服务商域名映射表
 * API地址域名 → 服务商显示名，用于provider名称推断
 */
export const PROVIDER_DOMAIN_MAP = {
    // 国内服务商
    'api.deepseek.com': 'DeepSeek',
    'open.bigmodel.cn': '智谱AI',
    'api.siliconflow.cn': '硅基流动',
    'api.moonshot.cn': 'Moonshot',
    'api.moonshot.com': 'Moonshot',
    'open.kimi.com': 'Kimi',
    'dashscope.aliyuncs.com': '阿里云百炼',
    'ark.cn-beijing.volces.com': '火山方舟',
    'api.minimax.chat': 'MiniMax',
    'api.minimaxi.com': 'MiniMax',
    'api.baichuan-ai.com': '百川',
    'api.lingyiwanwu.com': '零一万物',
    'api.stepfun.com': '阶跃星辰',
    'apihub.agnes-ai.cn': 'Agnes AI',
    'apihub.agnes-ai.com': 'Agnes AI',
    // 国外服务商
    'api.openai.com': 'OpenAI',
    'api.anthropic.com': 'Anthropic',
    'generativelanguage.googleapis.com': 'Google Gemini',
    'openrouter.ai': 'OpenRouter',
    'api.together.xyz': 'Together AI',
    'api.fireworks.ai': 'Fireworks AI',
    'api.groq.com': 'Groq',
    'api.perplexity.ai': 'Perplexity',
    'api.mistral.ai': 'Mistral',
    'api.cohere.com': 'Cohere',
    'api.deepinfra.com': 'DeepInfra',
    'api.novita.ai': 'Novita',
    'api.x.ai': 'xAI',
    // 腾讯
    'yuanqi.tencent.com': '腾讯元器'
};

/**
 * 本地/内网地址匹配正则
 * 用于将本地部署的模型识别为"本地模型"
 */
const LOCAL_HOST_PATTERN = /^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

/**
 * 视觉模型关键词表
 * 模型名包含任一关键词即认为具备视觉理解能力
 */
export const VISION_MODEL_KEYWORDS = [
    'vl', 'vision', 'gpt-4o', 'gpt-4.1', 'gpt-4-turbo', 'o4-mini',
    'gemini', 'claude', 'glm-4v', 'glm-4.5v', 'glm-4.6v',
    'internvl', 'llava', 'pixtral', 'step-1v', 'yi-vision', 'doubao-vision'
];

/**
 * API密钥占位符前缀
 * 以"你的"开头且以"API Key"结尾的值视为未配置（旧默认模板风格）
 */
const API_KEY_PLACEHOLDER_PATTERN = /^你的.*API Key$/;

/**
 * 从API地址中提取主机名
 * @param {string} url - API地址
 * @returns {string} 小写主机名，解析失败返回空字符串
 */
export function extractHostname(url) {
    const raw = String(url || '').trim();
    if (!raw) {
        return '';
    }
    try {
        return new URL(raw).hostname.toLowerCase();
    } catch {
        const matched = raw.match(/^[a-z][a-z0-9+.-]*:\/\/([^/:?#]+)/i);
        return matched ? matched[1].toLowerCase() : '';
    }
}

/**
 * 从API地址中提取端口
 * @param {string} url - API地址
 * @returns {string} 端口号，无端口或默认端口返回空字符串
 */
export function extractPort(url) {
    const raw = String(url || '').trim();
    if (!raw) {
        return '';
    }
    try {
        const port = new URL(raw).port;
        return port && port !== '80' && port !== '443' ? port : '';
    } catch {
        return '';
    }
}

/**
 * 推断provider显示名
 * 优先级：自定义标题 > 域名映射的服务商名 > 本地模型 > 域名 > 模型名 > 未配置
 * @param {Object} entry - 含 ApiTitle/ApiUrl/ApiModel 的旧配置条目或等价结构
 * @returns {string} 推断出的名称
 */
export function inferProviderName(entry) {
    const title = String(entry?.ApiTitle || entry?.title || '').trim();
    if (title) {
        return title;
    }

    const hostname = extractHostname(entry?.ApiUrl || entry?.baseUrl);
    if (!hostname) {
        return String(entry?.ApiModel || entry?.model || '').trim() || '未配置';
    }

    if (LOCAL_HOST_PATTERN.test(hostname)) {
        const port = extractPort(entry?.ApiUrl || entry?.baseUrl);
        return port ? `本地模型${port}` : '本地模型';
    }

    const matchedKey = Object.keys(PROVIDER_DOMAIN_MAP).find(key =>
        hostname === key || hostname.endsWith(`.${key}`)
    );
    if (matchedKey) {
        return PROVIDER_DOMAIN_MAP[matchedKey];
    }

    return hostname.replace(/^www\./, '');
}

/**
 * 判断模型名是否具备视觉能力
 * @param {string} modelName - 模型名称
 * @returns {boolean} 是否为视觉模型
 */
export function isVisionModel(modelName) {
    const lower = String(modelName || '').toLowerCase();
    return VISION_MODEL_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * 解析模型的视觉能力（三态：显式设置 > 关键词推断）
 * @param {string} modelName - 模型名称（用于auto时的关键词推断）
 * @param {boolean|undefined} visionSetting - 用户显式设置：true强制有视觉能力，
 *   false强制无视觉能力，undefined/auto走关键词推断
 * @returns {boolean} 是否具备视觉能力
 */
export function resolveVisionCapability(modelName, visionSetting) {
    if (visionSetting === true) {
        return true;
    }
    if (visionSetting === false) {
        return false;
    }
    return isVisionModel(modelName);
}

/**
 * 判断API密钥是否为有效配置（非空且非占位符）
 * @param {string} apiKey - API密钥
 * @returns {boolean} 是否有效
 */
export function isApiKeyConfigured(apiKey) {
    const key = String(apiKey || '').trim();
    return Boolean(key) && !API_KEY_PLACEHOLDER_PATTERN.test(key);
}

/**
 * 校验provider条目
 * @param {Object} provider - provider条目 { name, type, baseUrl, apiKey, tencentAssistantId }
 * @returns {{ valid: boolean, errors: string[] }} 校验结果
 */
export function validateProvider(provider) {
    const errors = [];
    if (!provider || typeof provider !== 'object') {
        return { valid: false, errors: ['provider必须为对象'] };
    }
    if (!String(provider.name || '').trim()) {
        errors.push('name不能为空');
    }
    if (!Object.values(PROVIDER_TYPES).includes(provider.type)) {
        errors.push(`type必须为 ${Object.values(PROVIDER_TYPES).join('/')}`);
    }
    if (!String(provider.baseUrl || '').trim()) {
        errors.push('baseUrl不能为空');
    }
    return { valid: errors.length === 0, errors };
}

/**
 * 校验model条目
 * @param {Object} model - model条目 { name, provider, model, params }
 * @param {Array<Object>} [providers] - 可选，已校验的provider列表，用于引用检查
 * @returns {{ valid: boolean, errors: string[] }} 校验结果
 */
export function validateModel(model, providers) {
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
    if (model.vision !== undefined && typeof model.vision !== 'boolean') {
        errors.push('vision必须为布尔值（true强制有视觉能力/false强制无视觉能力，不填自动按模型名推断）');
    }
    return { valid: errors.length === 0, errors };
}

/**
 * 校验整份新配置结构
 * @param {Object} config - 含 providers/models/defaultModel/visionModel/groupOverrides 的对象
 * @returns {{ valid: boolean, errors: string[] }} 校验结果
 */
export function validateChatConfig(config) {
    const errors = [];
    const providers = Array.isArray(config?.providers) ? config.providers : [];
    const models = Array.isArray(config?.models) ? config.models : [];

    if (!providers.length) {
        errors.push('providers不能为空');
    }
    if (!models.length) {
        errors.push('models不能为空');
    }

    const providerNames = new Set();
    providers.forEach((p, i) => {
        const result = validateProvider(p);
        result.errors.forEach(err => errors.push(`providers[${i}]: ${err}`));
        if (providerNames.has(p?.name)) {
            errors.push(`providers[${i}]: name "${p?.name}" 重复`);
        }
        providerNames.add(p?.name);
    });

    const modelNames = new Set();
    models.forEach((m, i) => {
        const result = validateModel(m, providers);
        result.errors.forEach(err => errors.push(`models[${i}]: ${err}`));
        if (modelNames.has(m?.name)) {
            errors.push(`models[${i}]: name "${m?.name}" 重复`);
        }
        modelNames.add(m?.name);
    });

    if (config?.defaultModel && !modelNames.has(config.defaultModel)) {
        errors.push(`defaultModel "${config.defaultModel}" 不存在于models`);
    }
    if (config?.visionModel && !modelNames.has(config.visionModel)) {
        errors.push(`visionModel "${config.visionModel}" 不存在于models`);
    }

    const overrides = Array.isArray(config?.groupOverrides) ? config.groupOverrides : [];
    overrides.forEach((o, i) => {
        if (o?.model && !modelNames.has(o.model)) {
            errors.push(`groupOverrides[${i}]: model "${o.model}" 不存在于models`);
        }
    });

    return { valid: errors.length === 0, errors };
}
