/**
 * 腾讯元器Provider（手写fetch）
 *
 * 消息转换规则（移植自旧tencentBuilder）：
 * 元器接口要求user/assistant严格交替，连续同角色消息仅保留首条；
 * system消息并入首条user消息前缀；assistant_id/user_id为必填。
 */

import { fetchJson, mergeSignal } from './requestUtils.js';

/** 参数白名单：元器接口支持的参数 */
const PARAM_WHITELIST = ['temperature', 'top_p', 'max_tokens'];

/**
 * 转换OpenAI消息数组为元器messages格式（严格交替）
 * @param {Array} messages - OpenAI中间格式消息数组（编排层已组装完整，末条为当前用户消息）
 * @returns {Array} 元器messages数组
 */
export function convertMessages(messages) {
    const converted = [];
    let systemPrefix = '';
    let lastRole = '';

    for (const msg of messages || []) {
        if (!msg || !msg.role) {
            continue;
        }

        if (msg.role === 'system') {
            const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            if (text) {
                systemPrefix = systemPrefix ? `${systemPrefix}\n\n${text}` : text;
            }
            continue;
        }

        if (msg.role === 'user' && lastRole !== 'user') {
            const content = typeof msg.content === 'string'
                ? msg.content
                : JSON.stringify(msg.content ?? '');
            const merged = systemPrefix && converted.length === 0
                ? `${systemPrefix}\n\n${content}`
                : content;
            converted.push({ role: 'user', content: merged });
            lastRole = 'user';
        } else if (msg.role === 'assistant' && lastRole === 'user') {
            const content = typeof msg.content === 'string'
                ? msg.content
                : JSON.stringify(msg.content ?? '');
            converted.push({ role: 'assistant', content });
            lastRole = 'assistant';
        }
        // tool消息：元器无工具调用，跳过
    }

    return converted;
}

/**
 * 创建腾讯元器Provider实例
 * @param {Object} providerConfig - provider配置 { name, type, baseUrl, apiKey, tencentAssistantId }
 * @returns {Object} Provider实例（统一接口）
 */
export function createTencentProvider(providerConfig) {
    return {
        id: 'tencent',

        /**
         * 统一对话入口
         * @param {Object} req - 请求对象，extra需含 { userId }
         * @returns {Promise<{content: string, toolCalls: Array, thinking: string|null, raw: Object, usage: Object|null}>}
         * @throws {Error} assistant_id未配置时抛配置错误
         */
        async chat(req) {
            const assistantId = String(providerConfig.tencentAssistantId || '').trim();
            if (!assistantId) {
                throw new Error('腾讯元器配置错误：assistant_id不能为空，请在provider配置中填写tencentAssistantId');
            }

            const body = {
                assistant_id: assistantId,
                user_id: String(req.extra?.userId || '10000'),
                stream: false,
                messages: convertMessages(req.messages)
            };
            for (const key of PARAM_WHITELIST) {
                if (req.params?.[key] !== undefined) {
                    body[key] = req.params[key];
                }
            }

            const { mergedSignal, dispose } = mergeSignal(req.signal, req.timeoutMs);

            let response;
            try {
                response = await fetchJson(providerConfig.baseUrl, {
                    method: 'POST',
                    headers: {
                        'X-Source': 'openapi',
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${providerConfig.apiKey}`
                    },
                    body: JSON.stringify(body),
                    signal: mergedSignal
                });
            } finally {
                dispose();
            }

            const content = String(response?.choices?.[0]?.message?.content || '').trim();
            if (!content) {
                throw new Error('腾讯元器API返回空内容，请稍后重试');
            }

            return {
                content,
                toolCalls: [],
                thinking: null,
                raw: response,
                usage: null
            };
        },

        /**
         * 判断模型是否支持视觉输入（元器协议不支持多模态，仅显式设置可覆盖）
         * @param {string} model - 模型名
         * @param {boolean|undefined} [visionSetting] - 用户显式设置的三态视觉标记
         * @returns {boolean} 是否支持视觉
         */
        supportsVision(model, visionSetting) {
            if (visionSetting === true) {
                return true;
            }
            if (visionSetting === false) {
                return false;
            }
            return false;
        },

        /**
         * 是否支持工具调用（元器无Function Calling）
         * @returns {boolean} 恒为false
         */
        supportsTools() {
            return false;
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
         * @param {Object} err - fetchJson抛出的错误
         * @returns {{code: string, status?: number, message: string}} 统一错误
         */
        parseError(err) {
            const status = err?.status;
            const message = err?.errorData?.message || err?.message || String(err);

            if (err?.code === 'network') {
                return { code: 'network', message };
            }
            if (status === 401) {
                return { code: 'auth', status, message };
            }
            if (status === 403) {
                return { code: 'forbidden', status, message };
            }
            if (status === 404) {
                return { code: 'model_not_found', status, message };
            }
            if (status === 429) {
                return { code: 'rate_limit', status, message };
            }
            if (status && status >= 500) {
                return { code: 'server_error', status, message };
            }
            return { code: 'invalid_request', status, message };
        }
    };
}
