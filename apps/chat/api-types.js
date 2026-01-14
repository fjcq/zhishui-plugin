/**
 * API类型常量定义
 * 统一管理所有支持的API类型及其配置
 */

/**
 * API类型枚举
 */
export const ApiTypes = {
    OPENAI: 'openai',
    SILICONFLOW: 'siliconflow',
    DEEPSEEK: 'deepseek',
    ZHIPU: 'zhipu',
    TENCENT: 'tencent',
    GEMINI: 'gemini'
};

/**
 * API类型显示名称
 */
export const ApiTypeLabels = {
    [ApiTypes.OPENAI]: 'OpenAI',
    [ApiTypes.SILICONFLOW]: '硅基流动',
    [ApiTypes.DEEPSEEK]: 'DeepSeek',
    [ApiTypes.ZHIPU]: '智谱AI',
    [ApiTypes.TENCENT]: '腾讯元器',
    [ApiTypes.GEMINI]: 'Gemini'
};

/**
 * API类型描述
 */
export const ApiTypeDescriptions = {
    [ApiTypes.OPENAI]: 'OpenAI官方API，支持GPT系列模型',
    [ApiTypes.SILICONFLOW]: '硅基流动API，兼容OpenAI格式，支持多种开源模型',
    [ApiTypes.DEEPSEEK]: 'DeepSeek API，兼容OpenAI格式，支持DeepSeek系列模型',
    [ApiTypes.ZHIPU]: '智谱AI API，兼容OpenAI格式，支持GLM系列模型',
    [ApiTypes.TENCENT]: '腾讯元器API，支持混元系列模型',
    [ApiTypes.GEMINI]: 'Google Gemini API，支持Gemini系列模型，支持多模态和联网搜索'
};

/**
 * API类型支持的参数
 */
export const ApiTypeSupportedParams = {
    [ApiTypes.OPENAI]: ['temperature', 'top_p', 'max_tokens', 'presence_penalty', 'frequency_penalty', 'response_format'],
    [ApiTypes.SILICONFLOW]: ['temperature', 'top_p', 'max_tokens', 'presence_penalty', 'frequency_penalty', 'response_format'],
    [ApiTypes.DEEPSEEK]: ['temperature', 'top_p', 'max_tokens', 'presence_penalty', 'frequency_penalty', 'response_format'],
    [ApiTypes.ZHIPU]: ['temperature', 'top_p', 'max_tokens', 'presence_penalty', 'frequency_penalty', 'response_format'],
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
        features: ['多模态']
    },
    [ApiTypes.SILICONFLOW]: {
        multimodal: false,
        webSearch: false,
        features: []
    },
    [ApiTypes.DEEPSEEK]: {
        multimodal: false,
        webSearch: false,
        features: []
    },
    [ApiTypes.ZHIPU]: {
        multimodal: false,
        webSearch: false,
        features: []
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
 * API类型支持的模型格式
 */
export const ApiTypeModelFormats = {
    [ApiTypes.OPENAI]: 'openai',
    [ApiTypes.SILICONFLOW]: 'openai',
    [ApiTypes.DEEPSEEK]: 'openai',
    [ApiTypes.ZHIPU]: 'openai',
    [ApiTypes.TENCENT]: 'tencent',
    [ApiTypes.GEMINI]: 'gemini'
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
    [ApiTypes.SILICONFLOW]: {
        ApiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
        ApiModel: 'Qwen/Qwen2.5-7B-Instruct',
        TencentAssistantId: ''
    },
    [ApiTypes.DEEPSEEK]: {
        ApiUrl: 'https://api.deepseek.com/v1/chat/completions',
        ApiModel: 'deepseek-chat',
        TencentAssistantId: ''
    },
    [ApiTypes.ZHIPU]: {
        ApiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        ApiModel: 'glm-4',
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
