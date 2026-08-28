/**
 * Google Gemini原生格式Provider（手写fetch）
 *
 * 转换职责：OpenAI中间格式 → Gemini contents/systemInstruction格式；
 * 响应candidates → 统一 { content, toolCalls, thinking }。
 * 旧架构Gemini不支持Function Calling，本provider保持一致（supportsTools为false），
 * gemini-2.5系列自动启用google_search grounding（联网搜索）。
 */

import { isVisionModel } from '../configs/schema.js';
import { fetchJson, mergeSignal } from './requestUtils.js';

/** 参数白名单：Gemini generationConfig支持的参数（键名转换） */
const PARAM_MAP = {
    temperature: 'temperature',
    top_p: 'topP',
    max_tokens: 'maxOutputTokens'
};

/**
 * 转换OpenAI消息数组为Gemini contents格式
 * 规则：system→systemInstruction（调用方提取）；assistant→model角色；
 * 多模态image_url data URI→inline_data；tool消息跳过（不支持工具调用）
 * @param {Array} messages - OpenAI中间格式消息数组
 * @returns {{ systemInstruction: string|null, contents: Array }} 转换结果
 */
export function convertMessages(messages) {
    const systemParts = [];
    const contents = [];

    for (const msg of messages || []) {
        if (!msg || !msg.role) {
            continue;
        }

        if (msg.role === 'system') {
            const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            if (text) {
                systemParts.push(text);
            }
            continue;
        }

        if (msg.role === 'tool') {
            continue;  // Gemini路径无工具调用，跳过tool消息
        }

        const role = msg.role === 'assistant' ? 'model' : 'user';
        const parts = [];

        if (Array.isArray(msg.content)) {
            for (const block of msg.content) {
                if (block?.type === 'text' && block.text) {
                    parts.push({ text: block.text });
                } else if (block?.type === 'image_url') {
                    const uri = String(block.image_url?.url || '');
                    const match = /^data:([^;]+);base64,(.+)$/s.exec(uri);
                    if (match) {
                        parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
                    }
                }
            }
        } else if (msg.content) {
            parts.push({ text: String(msg.content) });
        }

        if (parts.length > 0) {
            contents.push({ role, parts });
        }
    }

    return {
        systemInstruction: systemParts.length > 0 ? systemParts.join('\n\n') : null,
        contents
    };
}

/**
 * 解析Gemini响应为统一结果
 * @param {Object} response - Gemini响应对象
 * @returns {{ content: string, toolCalls: Array, thinking: string|null, usage: Object|null }} 统一结果
 * @throws {Error} 安全过滤/空内容/格式异常时抛错
 */
export function parseGeminiResponse(response) {
    if (response?.error) {
        const error = new Error(response.error.message || 'Gemini API返回错误');
        error.status = response.error.code;
        error.errorData = response;
        throw error;
    }

    const candidate = response?.candidates?.[0];
    if (candidate?.finishReason === 'SAFETY') {
        throw new Error('内容被安全过滤器阻止，请尝试其他表达方式');
    }

    const parts = candidate?.content?.parts || [];
    const textParts = parts.map(p => p?.text || '').filter(Boolean);
    const content = textParts.join('\n');

    if (!content) {
        throw new Error('Gemini API响应格式异常或返回空内容，请稍后重试');
    }

    return {
        content,
        toolCalls: [],
        thinking: null,
        usage: response?.usageMetadata
            ? { prompt_tokens: response.usageMetadata.promptTokenCount, completion_tokens: response.usageMetadata.candidatesTokenCount }
            : null
    };
}

/**
 * 创建Gemini原生格式Provider实例
 * @param {Object} providerConfig - provider配置 { name, type, baseUrl, apiKey }
 * @returns {Object} Provider实例（统一接口）
 */
export function createGeminiProvider(providerConfig) {
    return {
        id: 'gemini',

        /**
         * 统一对话入口
         * @param {Object} req - 请求对象（同openaiProvider.chat入参约定）
         * @returns {Promise<{content: string, toolCalls: Array, thinking: string|null, raw: Object, usage: Object|null}>}
         */
        async chat(req) {
            const { systemInstruction, contents } = convertMessages(req.messages);

            const generationConfig = {};
            for (const [srcKey, dstKey] of Object.entries(PARAM_MAP)) {
                if (req.params?.[srcKey] !== undefined) {
                    generationConfig[dstKey] = req.params[srcKey];
                }
            }

            const body = { contents, generationConfig };
            if (systemInstruction) {
                body.systemInstruction = { parts: [{ text: systemInstruction }] };
            }
            // gemini-2.5系列启用联网搜索grounding（与旧行为一致）
            if (String(req.model || '').toLowerCase().includes('gemini-2.5')) {
                body.tools = [{ google_search: {} }];
            }

            const base = String(providerConfig.baseUrl || '').replace(/\/+$/, '');
            const url = `${base}/models/${encodeURIComponent(req.model)}:generateContent`;
            const { mergedSignal, dispose } = mergeSignal(req.signal, req.timeoutMs);

            let response;
            try {
                response = await fetchJson(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': providerConfig.apiKey
                    },
                    body: JSON.stringify(body),
                    signal: mergedSignal
                });
            } finally {
                dispose();
            }

            const parsed = parseGeminiResponse(response);
            return { ...parsed, raw: response };
        },

        /**
         * 判断模型是否支持视觉输入（Gemini全系列多模态）
         * @param {string} model - 模型名
         * @returns {boolean} 是否支持视觉
         */
        supportsVision(model) {
            return String(model || '').toLowerCase().includes('gemini') || isVisionModel(model);
        },

        /**
         * 是否支持工具调用（旧架构不支持，保持一致）
         * @returns {boolean} 是否支持
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
            for (const key of Object.keys(PARAM_MAP)) {
                if (params?.[key] !== undefined) {
                    result[key] = params[key];
                }
            }
            return result;
        },

        /**
         * 解析错误为统一错误码
         * @param {Object} err - fetchJson抛出的错误（含errorData时带Gemini错误结构）
         * @returns {{code: string, status?: number, message: string}} 统一错误
         */
        parseError(err) {
            const status = err?.status;
            const message = err?.message || String(err);

            if (err?.code === 'network') {
                return { code: 'network', message };
            }
            if (status === 401 || status === 403) {
                return { code: 'auth', status, message };
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
