/**
 * Anthropic原生格式Provider（手写fetch）
 *
 * 新增能力：Claude原生 /v1/messages 端点支持
 * （x-api-key鉴权、messages格式、tool use、extended thinking）。
 *
 * 转换职责：
 * - 入：OpenAI中间格式消息/工具定义 → Anthropic messages/tools格式
 * - 出：Anthropic content块 → 统一 { content, toolCalls, thinking }
 */

import fetch from 'node-fetch';
import { parseThinkingMessage } from '../core/thinkingParser.js';
import { isVisionModel } from '../configs/schema.js';
import { fetchJson, mergeSignal } from './requestUtils.js';

/** Anthropic API版本头 */
const ANTHROPIC_VERSION = '2023-06-01';

/** 参数白名单：Anthropic /v1/messages 支持的参数 */
const PARAM_WHITELIST = ['temperature', 'top_p', 'max_tokens'];

/** max_tokens必填时的默认值 */
const DEFAULT_MAX_TOKENS = 4096;

/**
 * 解析data URI为base64图片source
 * @param {string} dataUri - 形如 data:image/jpeg;base64,xxx
 * @returns {Object|null} Anthropic image source块，非data URI返回null
 */
function parseDataUri(dataUri) {
    const match = /^data:([^;]+);base64,(.+)$/s.exec(String(dataUri || ''));
    if (!match) {
        return null;
    }
    return {
        type: 'image',
        source: { type: 'base64', media_type: match[1], data: match[2] }
    };
}

/**
 * 转换单个OpenAI多模态content块为Anthropic块
 * @param {Object} block - OpenAI content块 {type:'text'|'image_url'}
 * @returns {Object|null} Anthropic content块，无法转换返回null
 */
function convertContentBlock(block) {
    if (!block || typeof block !== 'object') {
        return null;
    }
    if (block.type === 'text' && block.text) {
        return { type: 'text', text: block.text };
    }
    if (block.type === 'image_url') {
        const url = block.image_url?.url || '';
        const base64Source = parseDataUri(url);
        if (base64Source) {
            return base64Source;
        }
        // http(s)直链图片走url source
        if (/^https?:\/\//i.test(url)) {
            return { type: 'image', source: { type: 'url', url } };
        }
    }
    return null;
}

/**
 * 转换OpenAI消息数组为Anthropic messages格式
 * 规则：system→顶层system参数；tool消息→user角色的tool_result块（连续合并）；
 * assistant.tool_calls→tool_use块；多模态块按类型映射
 * @param {Array} messages - OpenAI中间格式消息数组
 * @returns {{ system: string, messages: Array }} 转换结果
 */
export function convertMessages(messages) {
    const systemParts = [];
    const converted = [];

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
            // tool结果 → user角色tool_result块；连续tool消息合并进同一条user消息
            const toolResult = {
                type: 'tool_result',
                tool_use_id: String(msg.tool_call_id || ''),
                content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? '')
            };
            const last = converted[converted.length - 1];
            if (last && last.role === 'user' && Array.isArray(last.content)
                && last.content[0]?.type === 'tool_result') {
                last.content.push(toolResult);
            } else {
                converted.push({ role: 'user', content: [toolResult] });
            }
            continue;
        }

        if (msg.role === 'user') {
            if (Array.isArray(msg.content)) {
                const blocks = msg.content.map(convertContentBlock).filter(Boolean);
                if (blocks.length > 0) {
                    converted.push({ role: 'user', content: blocks });
                }
            } else if (msg.content) {
                converted.push({ role: 'user', content: String(msg.content) });
            }
            continue;
        }

        if (msg.role === 'assistant') {
            const blocks = [];
            const text = typeof msg.content === 'string' ? msg.content : '';
            if (text) {
                blocks.push({ type: 'text', text });
            }
            // tool_calls → tool_use块（arguments字符串反序列化为input对象）
            for (const call of msg.tool_calls || []) {
                let input = {};
                try {
                    input = JSON.parse(call.function?.arguments || '{}');
                } catch {
                    input = {};
                }
                blocks.push({
                    type: 'tool_use',
                    id: String(call.id || ''),
                    name: call.function?.name || '',
                    input
                });
            }
            if (blocks.length > 0) {
                converted.push({ role: 'assistant', content: blocks });
            }
        }
    }

    return { system: systemParts.join('\n\n'), messages: converted };
}

/**
 * 转换OpenAI工具定义为Anthropic tools格式
 * @param {Array} tools - OpenAI schema工具定义
 * @returns {Array} Anthropic tools数组
 */
export function convertTools(tools) {
    return (tools || [])
        .filter(t => t?.type === 'function' && t.function?.name)
        .map(t => ({
            name: t.function.name,
            description: t.function.description || '',
            input_schema: t.function.parameters || { type: 'object', properties: {} }
        }));
}

/**
 * 解析Anthropic响应content数组为统一结果
 * @param {Object} response - Anthropic响应对象
 * @returns {{ content: string, toolCalls: Array, thinking: string|null, usage: Object|null }} 统一结果
 */
export function parseAnthropicResponse(response) {
    const contentBlocks = Array.isArray(response?.content) ? response.content : [];
    const { textContent, reasoningContent } = parseThinkingMessage({ content: contentBlocks });

    const toolCalls = contentBlocks
        .filter(b => b?.type === 'tool_use')
        .map(b => ({
            id: String(b.id || ''),
            type: 'function',
            function: {
                name: b.name || '',
                arguments: JSON.stringify(b.input ?? {})
            }
        }));

    return {
        content: textContent,
        toolCalls,
        thinking: reasoningContent,
        usage: response?.usage
            ? { prompt_tokens: response.usage.input_tokens, completion_tokens: response.usage.output_tokens }
            : null
    };
}

/**
 * 创建Anthropic原生格式Provider实例
 * @param {Object} providerConfig - provider配置 { name, type, baseUrl, apiKey }
 * @returns {Object} Provider实例（统一接口）
 */
export function createAnthropicProvider(providerConfig) {
    return {
        id: 'anthropic',

        /**
         * 统一对话入口
         * @param {Object} req - 请求对象（同openaiProvider.chat入参约定）
         * @returns {Promise<{content: string, toolCalls: Array, thinking: string|null, raw: Object, usage: Object|null}>}
         */
        async chat(req) {
            const { system, messages } = convertMessages(req.messages);
            const anthropicTools = convertTools(req.tools);

            const body = {
                model: req.model,
                max_tokens: req.params?.max_tokens || DEFAULT_MAX_TOKENS,
                messages,
                ...(system ? { system } : {}),
                ...(anthropicTools.length > 0 ? { tools: anthropicTools } : {})
            };
            for (const key of ['temperature', 'top_p']) {
                if (req.params?.[key] !== undefined) {
                    body[key] = req.params[key];
                }
            }
            // extended thinking：编排层传入thinking配置时启用，此时temperature必须省略
            if (req.params?.thinking) {
                body.thinking = req.params.thinking;
                delete body.temperature;
            }

            const url = `${String(providerConfig.baseUrl || '').replace(/\/+$/, '')}/v1/messages`;
            const { mergedSignal, dispose } = mergeSignal(req.signal, req.timeoutMs);

            let response;
            try {
                response = await fetchJson(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': providerConfig.apiKey,
                        'anthropic-version': ANTHROPIC_VERSION
                    },
                    body: JSON.stringify(body),
                    signal: mergedSignal
                });
            } finally {
                dispose();
            }

            const parsed = parseAnthropicResponse(response);
            return { ...parsed, raw: response };
        },

        /**
         * 判断模型是否支持视觉输入（Claude全系列支持）
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
            return String(model || '').toLowerCase().includes('claude') || isVisionModel(model);
        },

        /**
         * 是否支持工具调用（Anthropic tool use）
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
            if (params?.thinking) {
                result.thinking = params.thinking;
            }
            return result;
        },

        /**
         * 解析错误为统一错误码
         * @param {Object} err - fetchJson抛出的错误（含response JSON时带errorData）
         * @returns {{code: string, status?: number, message: string}} 统一错误
         */
        parseError(err) {
            const errorType = err?.errorData?.error?.type || '';
            const message = err?.errorData?.error?.message || err?.message || String(err);
            const status = err?.status;

            if (errorType === 'authentication_error' || status === 401) {
                return { code: 'auth', status, message };
            }
            if (errorType === 'permission_error' || status === 403) {
                return { code: 'forbidden', status, message };
            }
            if (errorType === 'not_found_error' || status === 404) {
                return { code: 'model_not_found', status, message };
            }
            if (errorType === 'rate_limit_error' || status === 429) {
                return { code: 'rate_limit', status, message };
            }
            if (errorType === 'overloaded_error' || (status && status >= 500)) {
                return { code: 'server_error', status, message };
            }
            if (errorType === 'billing_error' || status === 402) {
                return { code: 'balance', status, message };
            }
            return { code: 'invalid_request', status, message };
        }
    };
}
