/**
 * OpenAI格式Provider（官方SDK封装）
 *
 * 通过openai官方SDK的baseURL覆盖能力天然兼容所有OpenAI格式服务商
 * （DeepSeek/智谱/硅基流动/Moonshot/OpenRouter等），无需服务商枚举。
 *
 * SDK惰性加载：openai为可选依赖，缺失时本provider不可用（chat抛明确错误），
 * 但不影响anthropic/gemini/tencent等手写provider的加载。
 *
 * 职责边界：仅负责格式透传与响应归一；
 * 消息组装/图片下载/视觉代理降级/工具注入由编排层（chatClient）完成。
 */

import { parseThinkingMessage } from '../core/thinkingParser.js';
import { resolveVisionCapability } from '../configs/schema.js';

/** 参数白名单：仅透传OpenAI chat/completions支持的参数 */
const PARAM_WHITELIST = [
    'temperature', 'top_p', 'max_tokens', 'presence_penalty',
    'frequency_penalty', 'response_format'
];

/** SDK模块缓存（惰性加载后复用） */
let OpenAIModule = null;

/**
 * 惰性加载openai SDK
 * @returns {Promise<Object>} openai SDK模块
 * @throws {Error} 依赖未安装时抛出带安装指引的错误
 */
async function loadSdk() {
    if (OpenAIModule) {
        return OpenAIModule;
    }
    try {
        OpenAIModule = await import('openai');
    } catch {
        throw new Error('openai依赖未安装，请执行 pnpm add openai 后重启');
    }
    return OpenAIModule;
}

/** SDK客户端缓存：同baseUrl+apiKey复用，避免重复建连 */
const clientCache = new Map();

/**
 * 获取（或创建）openai SDK客户端
 * @param {Object} OpenAI - SDK构造函数
 * @param {Object} providerConfig - provider配置 { baseUrl, apiKey }
 * @returns {Object} SDK客户端实例
 */
function getClient(OpenAI, providerConfig) {
    const cacheKey = `${providerConfig.baseUrl}|${providerConfig.apiKey}`;
    if (clientCache.has(cacheKey)) {
        return clientCache.get(cacheKey);
    }
    const client = new OpenAI({
        apiKey: providerConfig.apiKey,
        baseURL: providerConfig.baseUrl,
        maxRetries: 0  // 重试由编排层统一控制，SDK层不重试
    });
    if (clientCache.size > 20) {
        clientCache.clear();  // 防泄漏：配置变更后旧客户端不再引用
    }
    clientCache.set(cacheKey, client);
    return client;
}

/**
 * 创建OpenAI格式Provider实例
 * @param {Object} providerConfig - provider配置 { name, type, baseUrl, apiKey }
 * @returns {Object} Provider实例（统一接口）
 */
export function createOpenAIProvider(providerConfig) {
    return {
        id: 'openai',

        /**
         * 统一对话入口
         * @param {Object} req - 请求对象
         * @param {string} req.model - 模型名
         * @param {Array} req.messages - OpenAI中间格式消息数组
         * @param {Array} [req.tools] - OpenAI schema工具定义
         * @param {Object} req.params - 已裁剪的请求参数
         * @param {AbortSignal} [req.signal] - 中止信号
         * @returns {Promise<{content: string, toolCalls: Array, thinking: string|null, raw: Object, usage: Object|null}>}
         */
        async chat(req) {
            const { default: OpenAI } = await loadSdk();
            const client = getClient(OpenAI, providerConfig);

            const body = {
                model: req.model,
                messages: req.messages,
                ...(Array.isArray(req.tools) && req.tools.length > 0
                    ? { tools: req.tools, tool_choice: 'auto' }
                    : {})
            };
            for (const key of PARAM_WHITELIST) {
                if (req.params?.[key] !== undefined) {
                    body[key] = req.params[key];
                }
            }

            const completion = await client.chat.completions.create(body, {
                signal: req.signal
            });

            const message = completion.choices?.[0]?.message || {};
            const { textContent, reasoningContent } = parseThinkingMessage(message);

            return {
                content: textContent,
                toolCalls: Array.isArray(message.tool_calls) ? message.tool_calls : [],
                thinking: reasoningContent,
                raw: completion,
                usage: completion.usage || null
            };
        },

        /**
         * 判断模型是否支持视觉输入
         * @param {string} model - 模型名
         * @param {boolean|undefined} [visionSetting] - 用户显式设置的三态视觉标记
         * @returns {boolean} 是否支持视觉
         */
        supportsVision(model, visionSetting) {
            return resolveVisionCapability(model, visionSetting);
        },

        /**
         * 是否支持工具调用（OpenAI Function Calling）
         * @returns {boolean} 是否支持
         */
        supportsTools() {
            return true;
        },

        /**
         * 按白名单裁剪请求参数
         * @param {Object} params - 原始参数
         * @returns {Object} 裁剪后的参数
         */
        sanitizeParams(params) {
            const result = {};
            for (const key of PARAM_WHITELIST) {
                if (params?.[key] !== undefined) {
                    result[key] = params[key];
                }
            }
            return result;
        },

        /**
         * 解析错误为统一错误码
         * @param {Error} err - SDK抛出的异常
         * @returns {Promise<{code: string, status?: number, message: string}>} 统一错误
         */
        async parseError(err) {
            const { APIError, APIConnectionError } = await loadSdk();
            if (err instanceof APIConnectionError || err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND') {
                return { code: 'network', message: err.message };
            }
            if (err instanceof APIError) {
                const status = err.status;
                const vendorCode = err.error?.code || err.code || '';
                if (status === 401) {
                    return { code: 'auth', status, message: err.message };
                }
                if (status === 403) {
                    return { code: 'forbidden', status, message: err.message };
                }
                if (status === 402 || String(vendorCode).includes('insufficient')) {
                    return { code: 'balance', status, message: err.message };
                }
                if (status === 404 || String(vendorCode).includes('model_not_found')) {
                    return { code: 'model_not_found', status, message: err.message };
                }
                if (status === 429) {
                    return { code: 'rate_limit', status, message: err.message };
                }
                if (status >= 500) {
                    return { code: 'server_error', status, message: err.message };
                }
                return { code: 'invalid_request', status, message: err.message };
            }
            return { code: 'unknown', message: err?.message || String(err) };
        }
    };
}
