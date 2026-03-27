/**
 * 响应处理器
 */

import { Config } from '../../../../components/index.js';
import { addMessage } from '../../session.js';
import { parseJsonResponse, parseErrorMessage } from '../../parsers/index.js';
import { handleToolCall } from '../../tools/index.js';
import { generateToolFeedback, shouldShowFeedback } from '../../tools/feedbackGenerator.js';

/**
 * 处理API响应
 * @param {Object} responseData - 响应数据
 * @param {string} apiType - API类型
 * @param {string} msg - 用户消息
 * @param {Object} e - 事件对象
 * @param {string} systemMessage - 系统消息
 * @param {Array} chatMsg - 聊天历史
 * @param {Object} requestData - 请求数据
 * @param {number} recursionDepth - 递归深度
 * @param {Function} openAiCallback - openAi回调函数
 * @returns {Promise<string>} 处理后的响应内容
 */
export async function handleApiResponse(responseData, apiType, msg, e, systemMessage, chatMsg, requestData, recursionDepth = 0, openAiCallback) {
    let userMessageContent = msg;
    let userInfo = null;
    try {
        let msgObj = JSON.parse(msg);
        userMessageContent = msgObj.message || msg;
        userInfo = msgObj.additional_info || null;
    } catch (err) {
    }

    let fullUserMsg;
    if (userInfo) {
        const userRequestFormat = {
            message: userMessageContent,
            additional_info: {
                name: userInfo.name || '未知用户',
                user_id: userInfo.user_id || '',
                group_id: userInfo.group_id || 0,
                favor: userInfo.favor
            }
        };
        fullUserMsg = JSON.stringify(userRequestFormat);
    } else {
        fullUserMsg = userMessageContent;
    }

    if (apiType === 'tencent') {
        return await handleTencentResponse(responseData, fullUserMsg, e);
    }

    if (apiType === 'gemini') {
        return await handleGeminiResponse(responseData, fullUserMsg, e);
    }

    return await handleStandardResponse(responseData, apiType, msg, e, fullUserMsg, chatMsg, systemMessage, recursionDepth, openAiCallback);
}

/**
 * 处理腾讯元器响应
 * @param {Object} responseData - 响应数据
 * @param {string} fullUserMsg - 完整用户消息
 * @param {Object} e - 事件对象
 * @returns {Promise<string>} 处理后的响应内容
 */
async function handleTencentResponse(responseData, fullUserMsg, e) {
    let rawContent = responseData.choices?.[0]?.message?.content?.trim() || '';

    const parseResult = parseJsonResponse(rawContent, 'tencent');

    if (parseResult.parseError) {
        console.warn('[tencent] JSON解析遇到错误: ' + parseResult.parseError);
    }

    await addMessage({ role: 'user', content: fullUserMsg }, e);
    await addMessage({ role: 'assistant', content: rawContent }, e);

    const content = typeof parseResult.content === 'string' ? parseResult.content : String(parseResult.content || '');

    return JSON.stringify({
        message: content,
        favor_changes: []
    });
}

/**
 * 处理Gemini响应
 * @param {Object} responseData - 响应数据
 * @param {string} fullUserMsg - 完整用户消息
 * @param {Object} e - 事件对象
 * @returns {Promise<string>} 处理后的响应内容
 */
async function handleGeminiResponse(responseData, fullUserMsg, e) {
    if (responseData.error) {
        console.error('[Gemini] API返回错误:', responseData.error);
        throw new Error(parseErrorMessage(responseData));
    }

    if (responseData.candidates && responseData.candidates[0] && responseData.candidates[0].finishReason === 'SAFETY') {
        console.error('[Gemini] 内容被安全过滤器阻止');
        throw new Error('内容被安全过滤器阻止，请尝试其他表达方式');
    }

    let rawContent = '';
    if (responseData.candidates && responseData.candidates[0] && responseData.candidates[0].content && responseData.candidates[0].content.parts && responseData.candidates[0].content.parts[0]) {
        rawContent = responseData.candidates[0].content.parts[0].text || '';
    } else {
        console.error('[Gemini] 响应格式异常:', responseData);
        throw new Error('Gemini API响应格式异常，请稍后重试');
    }

    if (!rawContent || rawContent.trim() === '') {
        console.error('[Gemini] 返回空内容');
        throw new Error('AI返回了空内容，请稍后重试');
    }

    await addMessage({ role: 'user', content: fullUserMsg }, e);
    await addMessage({ role: 'assistant', content: rawContent }, e);

    const parseResult = parseJsonResponse(rawContent, 'Gemini');

    if (parseResult.parseError) {
        console.warn(`[Gemini] JSON解析遇到错误: ${parseResult.parseError}`);
    }

    const content = typeof parseResult.content === 'string' ? parseResult.content : String(parseResult.content || '');

    return JSON.stringify({
        message: content,
        favor_changes: []
    });
}

/**
 * 处理标准OpenAI格式响应
 * @param {Object} responseData - 响应数据
 * @param {string} apiType - API类型
 * @param {string} msg - 用户消息
 * @param {Object} e - 事件对象
 * @param {string} fullUserMsg - 完整用户消息
 * @param {Array} chatMsg - 聊天历史
 * @param {string} systemMessage - 系统消息
 * @param {number} recursionDepth - 递归深度
 * @param {Function} openAiCallback - openAi回调函数
 * @returns {Promise<string>} 处理后的响应内容
 */
async function handleStandardResponse(responseData, apiType, msg, e, fullUserMsg, chatMsg, systemMessage, recursionDepth, openAiCallback) {
    const message = responseData.choices[0].message;
    const finishReason = responseData.choices[0].finish_reason;

    if (message.tool_calls && message.tool_calls.length > 0) {
        return await handleToolCalls(message, finishReason, msg, e, fullUserMsg, chatMsg, systemMessage, recursionDepth, openAiCallback);
    }

    return await handleRegularResponse(message, apiType, e, fullUserMsg, responseData);
}

/**
 * 处理工具调用
 * @param {Object} message - 消息对象
 * @param {string} finishReason - 完成原因
 * @param {string} msg - 用户消息
 * @param {Object} e - 事件对象
 * @param {string} fullUserMsg - 完整用户消息
 * @param {Array} chatMsg - 聊天历史
 * @param {string} systemMessage - 系统消息
 * @param {number} recursionDepth - 递归深度
 * @param {Function} openAiCallback - openAi回调函数
 * @returns {Promise<string>} 处理后的响应内容
 */
async function handleToolCalls(message, finishReason, msg, e, fullUserMsg, chatMsg, systemMessage, recursionDepth, openAiCallback) {
    const assistantMessage = {
        role: 'assistant',
        content: message.content || null,
        tool_calls: message.tool_calls
    };

    if (message.reasoning_content) {
        assistantMessage.reasoning_content = message.reasoning_content;
    }

    const toolResults = [];
    const naturalFeedbacks = [];
    
    for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = toolCall.function.arguments;

        let toolParams;

        try {
            toolParams = JSON.parse(toolArgs);
        } catch (error) {
            logger.error(`[工具调用] 参数解析失败: ${error.message}`);
            toolResults.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: true, message: '参数格式错误' })
            });
            continue;
        }

        console.log(`[工具调用] ${toolName}(${JSON.stringify(toolParams)})`);

        let currentUserId = null;
        try {
            const msgObj = JSON.parse(msg);
            currentUserId = msgObj.additional_info?.user_id || null;
        } catch {
        }

        const result = await handleToolCall(toolName, toolParams, e, currentUserId);

        console.log(`[工具调用] 结果: ${JSON.stringify(result)}`);
        
        if (shouldShowFeedback(toolName, result)) {
            const feedback = await generateToolFeedback(toolName, result, toolParams, { e, currentUserId });
            if (feedback) {
                naturalFeedbacks.push(feedback);
            }
        }

        toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
        });
    }

    await addMessage(assistantMessage, e);
    for (const toolResult of toolResults) {
        await addMessage(toolResult, e);
    }

    const updatedChatMsg = [...chatMsg, { role: 'user', content: fullUserMsg }, assistantMessage, ...toolResults];

    const { content: followUpContent } = await openAiCallback(msg, e, systemMessage, updatedChatMsg, recursionDepth + 1);
    
    if (naturalFeedbacks.length > 0) {
        try {
            const followUpObj = JSON.parse(followUpContent);
            if (followUpObj.message && naturalFeedbacks.length > 0) {
                const feedbackText = naturalFeedbacks.filter(f => f).join(' ');
                if (feedbackText && !followUpObj.message.includes(feedbackText)) {
                    followUpObj.message = `${feedbackText}\n\n${followUpObj.message}`;
                }
            }
            return JSON.stringify(followUpObj);
        } catch {
            return followUpContent;
        }
    }

    return followUpContent;
}

/**
 * 处理常规响应
 * @param {Object} message - 消息对象
 * @param {string} apiType - API类型
 * @param {Object} e - 事件对象
 * @param {string} fullUserMsg - 完整用户消息
 * @param {Object} responseData - 响应数据
 * @returns {Promise<string>} 处理后的响应内容
 */
async function handleRegularResponse(message, apiType, e, fullUserMsg, responseData) {
    let rawContent = message.content ? message.content.trim() : '';
    const reasoningContent = message.reasoning_content || null;

    const parseResult = parseJsonResponse(rawContent, apiType);

    if (parseResult.parseError) {
        console.warn(`[${apiType}] JSON解析遇到错误: ${parseResult.parseError}`);
        console.log(`[${apiType}] API原始响应: ${JSON.stringify(responseData, null, 2)}`);
    }

    const showReasoning = await Config.Chat.ShowReasoning;
    let content = typeof parseResult.content === 'string' ? parseResult.content : String(parseResult.content || '');
    content = content.replace(/(（\u63a8\u7406\u8fc7\u7a0b[：:][\s\S]*?）|\u63a8\u7406\u8fc7\u7a0b[：:][\s\S]*?)(?=\n\u7ed3\u8bba|\u7b54\u6848|$)/gi, '');

    if (showReasoning && reasoningContent) {
        content = `【思维链】\n${reasoningContent}\n\n【回答】\n${content}`;
    }

    await addMessage({ role: 'user', content: fullUserMsg }, e);

    const assistantMsgToSave = { role: 'assistant', content };
    if (reasoningContent) {
        assistantMsgToSave.reasoning_content = reasoningContent;
    }
    await addMessage(assistantMsgToSave, e);

    return JSON.stringify({
        message: content,
        favor_changes: []
    });
}
