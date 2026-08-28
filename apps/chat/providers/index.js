/**
 * Provider工厂与注册表
 * 按provider配置的type创建对应Provider实例（统一接口）
 *
 * openai为可选依赖：SDK在openaiProvider内部惰性加载，
 * 缺失时仅openai格式不可用（chat抛出带安装指引的错误），其余provider不受影响。
 */

import { PROVIDER_TYPES } from '../configs/schema.js';
import { createOpenAIProvider } from './openaiProvider.js';
import { createAnthropicProvider } from './anthropicProvider.js';
import { createGeminiProvider } from './geminiProvider.js';
import { createTencentProvider } from './tencentProvider.js';

/**
 * Provider工厂注册表：格式类型 → 创建函数
 */
const PROVIDER_FACTORIES = {
    [PROVIDER_TYPES.OPENAI]: createOpenAIProvider,
    [PROVIDER_TYPES.ANTHROPIC]: createAnthropicProvider,
    [PROVIDER_TYPES.GEMINI]: createGeminiProvider,
    [PROVIDER_TYPES.TENCENT]: createTencentProvider
};

/** 实例缓存：同一provider配置名复用（配置热更新后由名称+指纹失效） */
const instanceCache = new Map();

/**
 * 生成provider配置指纹（用于配置变更后缓存失效）
 * @param {Object} providerConfig - provider配置
 * @returns {string} 指纹字符串
 */
function configFingerprint(providerConfig) {
    return [providerConfig.type, providerConfig.baseUrl, providerConfig.apiKey,
        providerConfig.tencentAssistantId || ''].join('|');
}

/**
 * 创建（或复用）Provider实例
 * @param {Object} providerConfig - provider配置
 * @param {string} providerConfig.name - provider名称
 * @param {string} providerConfig.type - 格式类型（openai/anthropic/gemini/tencent）
 * @returns {Object} Provider实例（统一接口：chat/supportsVision/supportsTools/sanitizeParams/parseError）
 * @throws {Error} 类型未注册或openai依赖缺失时抛错
 */
export function createProvider(providerConfig) {
    const factory = PROVIDER_FACTORIES[providerConfig?.type];
    if (!factory) {
        throw new Error(`未注册的provider类型: ${providerConfig?.type}（支持: ${Object.keys(PROVIDER_FACTORIES).join('/')}）`);
    }

    const cacheKey = `${providerConfig.name}|${configFingerprint(providerConfig)}`;
    if (instanceCache.has(cacheKey)) {
        return instanceCache.get(cacheKey);
    }

    const instance = factory(providerConfig);
    if (instanceCache.size > 30) {
        instanceCache.clear();  // 防泄漏：配置多次变更后旧实例不再引用
    }
    instanceCache.set(cacheKey, instance);
    return instance;
}

/**
 * 获取全部已注册的格式类型
 * @returns {Array<string>} 格式类型数组
 */
export function getRegisteredTypes() {
    return Object.keys(PROVIDER_FACTORIES);
}

/**
 * 清空实例缓存（配置文件热重载后调用，强制按最新配置重建）
 */
export function clearProviderCache() {
    instanceCache.clear();
}
