/**
 * 工具调用循环（新架构版）
 * 移植自旧responseHandler.handleToolCalls：
 * 解析toolCalls → 执行工具 → 结果以tool角色回填 → 回调chatClient继续生成。
 *
 * 与旧版的差异：chatFn由chatClient显式注入（替代旧版openAi自身作为
 * callback的隐式递归耦合），职责边界清晰。
 */

import { logger } from '../../../components/index.js';
import { addMessage } from '../session.js';
import { handleToolCall } from '../tools/index.js';
import { generateToolFeedback, shouldShowFeedback } from '../tools/feedbackGenerator.js';
import { sanitizeModelOutput, extractPlainTextFromJson } from '../api/utils/requestUtils.js';

/** 工具调用最大递归深度 */
export const MAX_TOOL_DEPTH = 15;

/**
 * 检查文本是否与已发送文本重复（避免多轮工具循环中重复推送）
 * @param {string} text - 待检查文本
 * @param {Array<string>} sentTexts - 已发送文本列表
 * @returns {boolean} 是否重复
 */
function isDuplicateText(text, sentTexts) {
    return sentTexts.some(sent => {
        if (text === sent || text.startsWith(sent) || sent.startsWith(text)) {
            return true;
        }
        // 长文本检查后缀/子串（AI重复发送片段的情况）
        if (text.length >= 10 && (sent.endsWith(text) || sent.includes(text))) {
            return true;
        }
        return false;
    });
}

/**
 * 提取用户消息中的用户ID（工具执行需要）
 * @param {string} msg - JSON格式用户消息
 * @returns {string|null} 用户ID
 */
function extractUserId(msg) {
    try {
        return JSON.parse(msg).additional_info?.user_id || null;
    } catch {
        return null;
    }
}

/**
 * 执行工具调用循环
 * @param {Object} options - 循环选项
 * @param {Object} options.response - provider统一响应 { content, toolCalls, thinking, raw }
 * @param {Object} options.chatContext - 对话上下文 { msg, e, systemMessage, chatMsg, fullUserMsg }
 * @param {number} options.recursionDepth - 当前递归深度
 * @param {Function} options.chatFn - chatClient.chat回调（继续生成用）
 * @returns {Promise<string>} 最终回复内容（JSON字符串）
 */
export async function executeToolLoop({ response, chatContext, recursionDepth, chatFn }) {
    const { msg, e, systemMessage, chatMsg, fullUserMsg } = chatContext;
    // 立即发送前再次清理控制 token（双保险：chatClient 已清理过，
    // 此处防止极端情况下残留或未经过 chatClient 清理的路径调用）
    // 再剥一层 message/content JSON 外壳：Gemini 等模型常把助手文本
    // 包成 {"message":"..."} 直接放到 response.content 里，若不剥壳会把
    // 整段JSON当普通文本发给用户（参见 2026-08-31 03:11:43 泄漏事故）。
    let textContent = extractPlainTextFromJson(sanitizeModelOutput(response.content || ''));

    const assistantMessage = {
        role: 'assistant',
        content: textContent || null,
        tool_calls: response.toolCalls
    };
    if (response.thinking) {
        assistantMessage.reasoning_content = sanitizeModelOutput(response.thinking);
    }

    // 有文本时立即发送给用户（带重复检测）
    if (textContent && textContent.trim()) {
        const trimmedText = textContent.trim();
        if (!e._sentTexts) {
            e._sentTexts = [];
        }
        if (!isDuplicateText(trimmedText, e._sentTexts)) {
            try {
                await e.reply(trimmedText);
                e._sentTexts.push(trimmedText);
            } catch (replyError) {
                logger.error(`[工具调用] 发送消息失败: ${replyError.message}`);
            }
        }
    }

    // 逐个执行工具
    const currentUserId = extractUserId(msg);
    const toolResults = [];
    const naturalFeedbacks = [];

    for (const toolCall of response.toolCalls) {
        let toolParams;
        try {
            toolParams = JSON.parse(toolCall.function?.arguments || '{}');
        } catch {
            logger.error(`[工具调用] 参数解析失败: ${toolCall.function?.name}`);
            toolResults.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: true, error_message: '参数格式错误' })
            });
            continue;
        }

        const result = await handleToolCall(toolCall.function.name, toolParams, e, currentUserId);

        if (shouldShowFeedback(toolCall.function.name, result)) {
            const feedback = await generateToolFeedback(toolCall.function.name, result, toolParams, { e, currentUserId });
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

    // 会话持久化：assistant工具调用消息与tool结果
    await addMessage(assistantMessage, e);
    for (const toolResult of toolResults) {
        await addMessage(toolResult, e);
    }

    const updatedChatMsg = [...chatMsg, { role: 'user', content: fullUserMsg }, assistantMessage, ...toolResults];
    const { content: followUpContent } = await chatFn(msg, e, systemMessage, updatedChatMsg, recursionDepth + 1);

    // 自然化反馈合并进最终回复
    if (naturalFeedbacks.length === 0) {
        return followUpContent;
    }
    const feedbackText = naturalFeedbacks.filter(Boolean).join(' ');
    try {
        const followUpObj = JSON.parse(followUpContent);
        if (feedbackText) {
            if (followUpObj.message?.trim()) {
                if (!followUpObj.message.includes(feedbackText)) {
                    followUpObj.message = `${feedbackText}\n\n${followUpObj.message}`;
                }
            } else {
                followUpObj.message = feedbackText;
            }
        }
        return JSON.stringify(followUpObj);
    } catch {
        return JSON.stringify({ message: feedbackText, favor_changes: [] });
    }
}
