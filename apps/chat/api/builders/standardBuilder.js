/**
 * 标准OpenAI格式请求构建器
 */

import { buildUserMessageContent, getDefaultParams, addToolCallingConfig, addJsonFormatConfig } from '../utils/requestUtils.js';
import { isToolCallingSupported } from '../../api-types.js';
import { getEnabledTools } from '../../tools/index.js';

/**
 * 验证并清理消息数组
 * 仅验证基本格式，保留消息序列完整性，让API处理语义验证
 * @param {Array} messages - 原始消息数组
 * @returns {Array} 清理后的消息数组
 */
function validateAndSanitizeMessages(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
        return [];
    }

    const sanitized = [];

    for (const msg of messages) {
        if (!msg || !msg.role) continue;

        const validRoles = ['system', 'user', 'assistant', 'tool', 'function'];
        if (!validRoles.includes(msg.role)) continue;

        const hasContent = msg.content !== null && msg.content !== undefined &&
            ((typeof msg.content === 'string' && msg.content.trim().length > 0) ||
             Array.isArray(msg.content));
        const hasToolCalls = Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0;
        const hasToolCallId = (msg.role === 'tool' || msg.role === 'function') && msg.tool_call_id;
        const hasFunctionCall = msg.function_call !== undefined;

        if (msg.role === 'user') {
            if (!hasContent) continue;
            sanitized.push(msg);
        }
        else if (msg.role === 'assistant') {
            if (!hasContent && !hasToolCalls && !hasFunctionCall) continue;
            sanitized.push(msg);
        }
        else if (msg.role === 'tool' || msg.role === 'function') {
            if (!hasToolCallId || !hasContent) continue;
            sanitized.push(msg);
        }
        else if (msg.role === 'system') {
            if (!msg.content || (typeof msg.content === 'string' && msg.content.trim().length === 0)) continue;
            sanitized.push(msg);
        }
    }

    return sanitized;
}

/**
 * 构建标准OpenAI格式请求数据
 * @param {string} aiModel - AI模型名称
 * @param {string} systemMessage - 系统消息
 * @param {Array} chatMsg - 聊天历史
 * @param {string} msg - 当前用户消息
 * @param {Object} e - 事件对象
 * @param {Object} validatedParams - 验证后的请求参数
 * @param {string} apiType - API类型
 * @param {boolean} isThinkingMode - 是否启用思考模式
 * @returns {Promise<Object>} 请求数据对象
 */
export async function buildStandardRequest(aiModel, systemMessage, chatMsg, msg, e, validatedParams, apiType, isThinkingMode = false) {
    let messages = [];

    let systemPrompt = '';
    try {
        systemPrompt = typeof systemMessage === 'string' ? systemMessage : JSON.stringify(systemMessage);
    } catch {
        systemPrompt = '';
    }
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }

    if (Array.isArray(chatMsg)) {
        for (const item of chatMsg) {
            if (!item || !item.role) continue;

            if (item.role === 'user') {
                if (!item.content) continue;
                messages.push({ role: 'user', content: item.content });
            }
            else if (item.role === 'assistant') {
                const assistantMsg = {
                    role: 'assistant',
                    content: item.content || null
                };
                if (item.tool_calls) {
                    assistantMsg.tool_calls = item.tool_calls;
                }
                if (isThinkingMode && item.reasoning_content) {
                    assistantMsg.reasoning_content = item.reasoning_content;
                }
                if (assistantMsg.content || assistantMsg.tool_calls || assistantMsg.reasoning_content) {
                    messages.push(assistantMsg);
                }
            }
            else if (item.role === 'tool') {
                messages.push({
                    role: 'tool',
                    tool_call_id: item.tool_call_id,
                    content: item.content
                });
            }
        }
    }

    const lastMsg = chatMsg && chatMsg.length > 0 ? chatMsg[chatMsg.length - 1] : null;
    const isToolFollowUp = lastMsg && lastMsg.role === 'tool';

    if (!isToolFollowUp) {
        const { fullUserMsg } = buildUserMessageContent(msg);
        messages.push({ role: 'user', content: fullUserMsg });
    }

    messages = validateAndSanitizeMessages(messages);

    let requestData = {
        model: aiModel,
        messages: messages
    };

    if (!isThinkingMode) {
        if (validatedParams.temperature !== undefined) {
            requestData.temperature = validatedParams.temperature;
        }
        if (validatedParams.top_p !== undefined) {
            requestData.top_p = validatedParams.top_p;
        }
        if (validatedParams.presence_penalty !== undefined) {
            requestData.presence_penalty = validatedParams.presence_penalty;
        }
        if (validatedParams.frequency_penalty !== undefined) {
            requestData.frequency_penalty = validatedParams.frequency_penalty;
        }
    }

    if (validatedParams.max_tokens !== undefined) {
        requestData.max_tokens = validatedParams.max_tokens;
    }

    if (isToolCallingSupported(apiType)) {
        requestData.tools = getEnabledTools();
        requestData.tool_choice = 'auto';
    }

    const { checkJsonFormatSupport } = await import('../../parsers/index.js');
    const supportsJsonFormat = checkJsonFormatSupport(apiType, aiModel);
    const hasTools = isToolCallingSupported(apiType);

    if (supportsJsonFormat && !hasTools) {
        requestData.response_format = { type: 'json_object' };
    }

    if (isThinkingMode) {
        requestData.thinking = { type: 'enabled' };
    }

    return requestData;
}
