/**
 * API类型兼容层（阶段5清理版）
 * 旧438行文件中绝大部分为死代码（26项服务商别名列表运行时无效、
 * ApiPresets/ApiTypeDefaults无调用方），已随新架构（configs/schema.js）废弃。
 *
 * 本文件仅保留guoba面板仍在消费的3个显示名函数（阶段6 guoba重写后整体删除），
 * 内部转调新schema实现，消除双份维护。
 */

import { inferProviderName } from './configs/schema.js';

/**
 * API类型枚举（兼容旧链路：requestUtils/jsonParser字符串比较用）
 */
export const ApiTypes = {
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
    TENCENT: 'tencent',
    GEMINI: 'gemini'
};

/**
 * 各API类型支持的请求参数白名单（兼容旧链路：jsonParser.validateRequestParams用）
 */
export const ApiTypeSupportedParams = {
    [ApiTypes.OPENAI]: ['temperature', 'top_p', 'max_tokens', 'presence_penalty', 'frequency_penalty', 'response_format'],
    [ApiTypes.ANTHROPIC]: ['temperature', 'top_p', 'max_tokens'],
    [ApiTypes.TENCENT]: ['temperature', 'top_p', 'max_tokens'],
    [ApiTypes.GEMINI]: ['temperature', 'top_p', 'max_tokens', 'response_mime_type', 'systemInstruction', 'tools']
};

/**
 * 检查API类型是否支持OpenAI风格Function Calling（兼容旧链路）
 * @param {string} apiType - API类型
 * @returns {boolean} 是否支持
 */
export function isToolCallingSupported(apiType) {
    return apiType === ApiTypes.OPENAI || apiType === ApiTypes.ANTHROPIC || apiType === ApiTypes.GEMINI;
}

/**
 * 检查API类型是否有效（兼容旧链路：api/index.js校验用）
 * @param {string} apiType - API类型
 * @returns {boolean} 是否有效
 */
export function isValidApiType(apiType) {
    return Object.values(ApiTypes).includes(apiType);
}

/**
 * 检查API类型是否为OpenAI兼容类型（兼容旧链路；旧26项别名列表已废弃，
 * 新架构下所有服务商统一归入openai格式，此处仅放行openai本身）
 * @param {string} apiType - API类型
 * @returns {boolean} 是否为OpenAI兼容类型
 */
export function isOpenAICompatibleType(apiType) {
    return apiType?.toLowerCase() === ApiTypes.OPENAI;
}

/**
 * 检查API类型是否支持指定功能（兼容旧链路：standardBuilder用）
 * @param {string} apiType - API类型
 * @param {string} feature - 功能名称 (multimodal: 多模态, webSearch: 联网)
 * @returns {boolean} 是否支持
 */
export function isFeatureSupported(apiType, feature) {
    const features = {
        [ApiTypes.OPENAI]: { multimodal: true, webSearch: false },
        [ApiTypes.ANTHROPIC]: { multimodal: true, webSearch: false },
        [ApiTypes.TENCENT]: { multimodal: false, webSearch: false },
        [ApiTypes.GEMINI]: { multimodal: true, webSearch: true }
    };
    return features[apiType]?.[feature] === true;
}

/**
 * 兼容映射：ApiList条目字段名 → 新schema等价字段
 * @param {Object} api - 旧ApiList条目 { ApiTitle, ApiUrl, ApiModel }
 * @returns {Object} 新schema条目 { title, baseUrl, model }
 */
function toSchemaEntry(api) {
    return {
        title: api?.ApiTitle,
        baseUrl: api?.ApiUrl,
        model: api?.ApiModel
    };
}

/**
 * 获取API配置的显示名（兼容旧签名）
 * 优先级：标题 > 域名映射服务商名 > 本地模型 > 域名 > 模型名 > 未配置
 * @param {Object} api - ApiList条目配置
 * @returns {string} 显示名
 */
export function getApiDisplayName(api) {
    return inferProviderName(toSchemaEntry(api));
}

/**
 * 获取API配置显示名（含模型名）
 * 格式如 "DeepSeek - deepseek-chat"，用于下拉框与列表展示
 * @param {Object} api - ApiList条目配置
 * @returns {string} 显示名与模型名组合
 */
export function getApiDisplayNameWithModel(api) {
    const name = getApiDisplayName(api);
    const model = String(api?.ApiModel || '').trim();
    return model && model !== name ? `${name} - ${model}` : name;
}

/**
 * 获取所有API类型选项（用于UI选择，含anthropic新类型）
 * @returns {Array} API类型选项数组
 */
export function getApiTypeOptions() {
    return [
        { label: 'OpenAI兼容', value: 'openai', description: 'OpenAI兼容格式，覆盖绝大多数模型服务商', features: ['多模态', '工具调用', '思维链'] },
        { label: 'Anthropic', value: 'anthropic', description: 'Claude原生格式（/v1/messages），支持tool use与extended thinking', features: ['多模态', '工具调用', '思维链'] },
        { label: 'Google Gemini', value: 'gemini', description: 'Gemini原生格式，支持多模态和联网搜索', features: ['多模态', '联网'] },
        { label: '腾讯元器', value: 'tencent', description: '腾讯元器API，需要配置助手ID', features: [] }
    ];
}
