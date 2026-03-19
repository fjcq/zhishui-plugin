/**
 * 腾讯元器请求构建器
 */

import { getValidUserId, buildUserMessageContent } from '../utils/requestUtils.js';

/**
 * 构建腾讯元器请求数据
 * @param {string} tencentAssistantId - 腾讯元器助手ID
 * @param {string} systemMessage - 系统消息
 * @param {Array} chatMsg - 聊天历史
 * @param {string} msg - 当前用户消息
 * @param {Object} e - 事件对象
 * @param {Object} validatedParams - 验证后的请求参数
 * @returns {Promise<Object>} 请求数据对象
 */
export async function buildTencentRequest(tencentAssistantId, systemMessage, chatMsg, msg, e, validatedParams) {
    let messages = [];

    let systemPrompt = '';
    try {
        systemPrompt = typeof systemMessage === 'string' ? systemMessage : JSON.stringify(systemMessage);
    } catch {
        systemPrompt = '';
    }

    if (Array.isArray(chatMsg) && chatMsg.length > 0) {
        let lastRole = '';
        for (const item of chatMsg) {
            if (!item || !item.role || !item.content) continue;
            if (item.role === 'user' && lastRole !== 'user') {
                messages.push({ role: 'user', content: item.content });
                lastRole = 'user';
            } else if (item.role === 'assistant' && lastRole === 'user') {
                messages.push({ role: 'assistant', content: item.content });
                lastRole = 'assistant';
            }
        }
    }

    const { fullUserMsg } = buildUserMessageContent(msg);

    if (messages.length === 0 || messages[messages.length - 1].role !== 'assistant') {
        if (systemPrompt && messages.length === 0) {
            messages.push({ role: 'user', content: `${systemPrompt}\n\n${fullUserMsg}` });
        } else {
            messages.push({ role: 'user', content: fullUserMsg });
        }
    }

    if (messages.length === 0) {
        messages.push({ role: 'user', content: fullUserMsg });
    }

    const userId = await getValidUserId(e.user_id);

    if (!tencentAssistantId || tencentAssistantId.trim() === '') {
        throw new Error('腾讯元器API配置错误：assistant_id不能为空，请检查配置文件中的TencentAssistantId');
    }

    return {
        assistant_id: tencentAssistantId,
        user_id: String(userId),
        stream: false,
        messages: messages,
        ...(validatedParams.temperature !== undefined && { temperature: validatedParams.temperature }),
        ...(validatedParams.top_p !== undefined && { top_p: validatedParams.top_p }),
        ...(validatedParams.max_tokens !== undefined && { max_tokens: validatedParams.max_tokens })
    };
}
