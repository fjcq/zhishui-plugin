/**
 * API类型常量定义
 * 统一管理所有支持的API类型及其配置
 * 
 * 简化设计：按API格式分类而非服务商
 * - openai: OpenAI兼容格式（覆盖90%的模型服务商）
 * - tencent: 腾讯元器（独立格式）
 * - gemini: Google Gemini（独立格式）
 */

/**
 * API类型枚举
 */
export const ApiTypes = {
    OPENAI: 'openai',
    TENCENT: 'tencent',
    GEMINI: 'gemini'
};

/**
 * 支持工具调用的API类型列表
 * 这些API支持OpenAI风格的Function Calling
 */
export const TOOL_SUPPORTED_APIS = [
    ApiTypes.OPENAI
];

/**
 * OpenAI兼容API类型列表
 * 这些API服务商使用OpenAI兼容的API格式
 */
export const OPENAI_COMPATIBLE_TYPES = [
    // 国内服务商
    'siliconflow',   // 硅基流动
    'deepseek',      // DeepSeek
    'zhipu',         // 智谱AI
    'moonshot',      // Moonshot
    'kimi',          // Kimi (Moonshot)
    'qwen',          // 通义千问
    'doubao',        // 豆包
    'baichuan',      // 百川
    'yi',            // 零一万物
    'minimax',       // Minimax
    'stepfun',       // 阶跃星辰
    '01ai',          // 零一万物
    
    // 国外服务商
    'openrouter',    // OpenRouter
    'together',      // Together AI
    'fireworks',     // Fireworks AI
    'groq',          // Groq
    'perplexity',    // Perplexity AI
    'replicate',     // Replicate
    'anthropic',     // Anthropic (兼容模式)
    'cohere',        // Cohere (兼容模式)
    'mistral',       // Mistral AI
    'deepinfra',     // DeepInfra
    'novita',        // Novita AI
    'lingyi',        // 灵弈
    'xai'            // xAI
];

/**
 * 检查API类型是否支持工具调用
 * @param {string} apiType - API类型
 * @returns {boolean} 是否支持工具调用
 */
export function isToolCallingSupported(apiType) {
    return TOOL_SUPPORTED_APIS.includes(apiType);
}

/**
 * 检查API类型是否为OpenAI兼容类型
 * @param {string} apiType - API类型
 * @returns {boolean} 是否为OpenAI兼容类型
 */
export function isOpenAICompatibleType(apiType) {
    return OPENAI_COMPATIBLE_TYPES.includes(apiType?.toLowerCase());
}

/**
 * API类型显示名称
 */
export const ApiTypeLabels = {
    [ApiTypes.OPENAI]: 'OpenAI兼容',
    [ApiTypes.TENCENT]: '腾讯元器',
    [ApiTypes.GEMINI]: 'Google Gemini'
};

/**
 * API类型描述
 */
export const ApiTypeDescriptions = {
    [ApiTypes.OPENAI]: 'OpenAI兼容格式，支持OpenAI、DeepSeek、智谱AI、硅基流动等绝大多数模型服务商',
    [ApiTypes.TENCENT]: '腾讯元器API，支持混元系列模型，需要配置助手ID',
    [ApiTypes.GEMINI]: 'Google Gemini API，支持Gemini系列模型，支持多模态和联网搜索'
};

/**
 * API类型支持的参数
 */
export const ApiTypeSupportedParams = {
    [ApiTypes.OPENAI]: ['temperature', 'top_p', 'max_tokens', 'presence_penalty', 'frequency_penalty', 'response_format'],
    [ApiTypes.TENCENT]: ['temperature', 'top_p', 'max_tokens'],
    [ApiTypes.GEMINI]: ['temperature', 'top_p', 'max_tokens', 'response_mime_type', 'systemInstruction', 'tools']
};

/**
 * API类型功能特性
 * 定义每个API类型支持的功能特性（仅保留用户关心的核心特性）
 */
export const ApiTypeFeatures = {
    [ApiTypes.OPENAI]: {
        multimodal: true,
        webSearch: false,
        features: ['多模态', '工具调用']
    },
    [ApiTypes.TENCENT]: {
        multimodal: false,
        webSearch: false,
        features: []
    },
    [ApiTypes.GEMINI]: {
        multimodal: true,
        webSearch: true,
        features: ['多模态', '联网']
    }
};

/**
 * API类型默认配置
 */
export const ApiTypeDefaults = {
    [ApiTypes.OPENAI]: {
        ApiUrl: 'https://api.openai.com/v1/chat/completions',
        ApiModel: 'gpt-3.5-turbo',
        TencentAssistantId: ''
    },
    [ApiTypes.TENCENT]: {
        ApiUrl: 'https://yuanqi.tencent.com/openapi/v1/agent/chat/completions',
        ApiModel: 'hunyuan-lite',
        TencentAssistantId: ''
    },
    [ApiTypes.GEMINI]: {
        ApiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        ApiModel: 'gemini-2.5-flash',
        TencentAssistantId: ''
    }
};

/**
 * API预设模板
 * 提供常用服务商的快速配置
 */
export const ApiPresets = [
    {
        name: 'OpenAI',
        apiType: ApiTypes.OPENAI,
        ApiUrl: 'https://api.openai.com/v1/chat/completions',
        ApiModel: 'gpt-3.5-turbo',
        description: 'OpenAI官方API，支持GPT系列模型'
    },
    {
        name: 'DeepSeek',
        apiType: ApiTypes.OPENAI,
        ApiUrl: 'https://api.deepseek.com/v1/chat/completions',
        ApiModel: 'deepseek-chat',
        description: 'DeepSeek API，支持DeepSeek系列模型'
    },
    {
        name: '智谱AI',
        apiType: ApiTypes.OPENAI,
        ApiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        ApiModel: 'glm-4',
        description: '智谱AI API，支持GLM系列模型'
    },
    {
        name: '硅基流动',
        apiType: ApiTypes.OPENAI,
        ApiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
        ApiModel: 'Qwen/Qwen2.5-7B-Instruct',
        description: '硅基流动API，支持多种开源模型'
    },
    {
        name: '腾讯元器',
        apiType: ApiTypes.TENCENT,
        ApiUrl: 'https://yuanqi.tencent.com/openapi/v1/agent/chat/completions',
        ApiModel: 'hunyuan-lite',
        description: '腾讯元器API，支持混元系列模型'
    },
    {
        name: 'Google Gemini',
        apiType: ApiTypes.GEMINI,
        ApiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        ApiModel: 'gemini-2.5-flash',
        description: 'Google Gemini API，支持多模态和联网搜索'
    }
];

/**
 * 检查API类型是否有效
 * @param {string} apiType - API类型
 * @returns {boolean} 是否有效
 */
export function isValidApiType(apiType) {
    return Object.values(ApiTypes).includes(apiType);
}

/**
 * 获取API类型显示名称
 * @param {string} apiType - API类型
 * @returns {string} 显示名称
 */
export function getApiTypeLabel(apiType) {
    return ApiTypeLabels[apiType] || '未知';
}

/**
 * 获取API类型描述
 * @param {string} apiType - API类型
 * @returns {string} 描述
 */
export function getApiTypeDescription(apiType) {
    return ApiTypeDescriptions[apiType] || '';
}

/**
 * 检查API类型是否支持指定参数
 * @param {string} apiType - API类型
 * @param {string} param - 参数名
 * @returns {boolean} 是否支持
 */
export function isParamSupported(apiType, param) {
    const supportedParams = ApiTypeSupportedParams[apiType] || [];
    return supportedParams.includes(param);
}

/**
 * 获取API类型默认配置
 * @param {string} apiType - API类型
 * @returns {Object} 默认配置
 */
export function getApiTypeDefaults(apiType) {
    return { ...ApiTypeDefaults[apiType] };
}

/**
 * 获取所有支持的API类型列表
 * @returns {Array} API类型数组
 */
export function getAllApiTypes() {
    return Object.values(ApiTypes);
}

/**
 * 获取所有API类型选项（用于UI选择）
 * @returns {Array} API类型选项数组
 */
export function getApiTypeOptions() {
    return Object.entries(ApiTypes).map(([key, value]) => ({
        label: ApiTypeLabels[value],
        value: value,
        description: ApiTypeDescriptions[value],
        features: ApiTypeFeatures[value]?.features || []
    }));
}

/**
 * 获取API类型功能特性
 * @param {string} apiType - API类型
 * @returns {Object} 功能特性对象
 */
export function getApiTypeFeatures(apiType) {
    return { ...ApiTypeFeatures[apiType] };
}

/**
 * 检查API类型是否支持指定功能
 * @param {string} apiType - API类型
 * @param {string} feature - 功能名称 (multimodal: 多模态, webSearch: 联网)
 * @returns {boolean} 是否支持
 */
export function isFeatureSupported(apiType, feature) {
    const features = ApiTypeFeatures[apiType];
    return features ? features[feature] === true : false;
}

/**
 * 获取API类型支持的功能标签列表
 * @param {string} apiType - API类型
 * @returns {Array} 功能标签数组
 */
export function getApiTypeFeatureLabels(apiType) {
    const features = ApiTypeFeatures[apiType];
    return features ? features.features : [];
}

/**
 * 获取所有API预设模板
 * @returns {Array} 预设模板数组
 */
export function getApiPresets() {
    return ApiPresets.map(preset => ({
        ...preset,
        label: preset.name,
        value: preset.name
    }));
}

/**
 * 根据预设名称获取预设配置
 * @param {string} presetName - 预设名称
 * @returns {Object|null} 预设配置
 */
export function getPresetByName(presetName) {
    return ApiPresets.find(p => p.name === presetName) || null;
}
