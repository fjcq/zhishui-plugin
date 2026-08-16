/**
 * Qwen VL请求构建器
 */

import { buildUserMessageContent, downloadImageSmart } from '../utils/requestUtils.js';
import { extractToolResultImages, collectImageFileIds } from './standardBuilder.js';
import { isToolCallingSupported } from '../../api-types.js';
import { getEnabledTools } from '../../tools/index.js';
import { logger } from '../../../../components/index.js';

/**
 * 构建Qwen VL请求数据
 * @param {string} aiModel - AI模型名称
 * @param {string} systemMessage - 系统消息
 * @param {Array} chatMsg - 聊天历史
 * @param {string} msg - 当前用户消息
 * @param {Object} e - 事件对象
 * @param {Object} validatedParams - 验证后的请求参数
 * @param {string} apiType - API类型
 * @returns {Promise<Object>} 请求数据对象
 */
export async function buildQwenVLRequest(aiModel, systemMessage, chatMsg, msg, e, validatedParams, apiType) {
    let msgObj;
    let userMsg = msg;
    let images = [];
    let failedImages = [];
    try {
        msgObj = JSON.parse(msg);
        userMsg = msgObj.message || msg;
        if (Array.isArray(msgObj.images) && msgObj.images.length > 0) {
            // 按序从事件消息段收集文件ID（数量一致时配对），供 get_image 兑底
            const fileIds = collectImageFileIds(e);
            for (let i = 0; i < msgObj.images.length; i++) {
                // 三级下载：直链 → get_image 本地缓存 → get_image 新链
                const downloaded = await downloadImageSmart({
                    url: msgObj.images[i],
                    fileId: fileIds.length === msgObj.images.length ? fileIds[i] : '',
                    e,
                    source: 'QwenVL'
                });
                if (downloaded) {
                    images.push({ type: 'image_url', image_url: { url: `data:${downloaded.mime};base64,${downloaded.base64}` } });
                } else {
                    logger.error(`[QwenVL] 图片获取失败（三级策略均失败）: ${msgObj.images[i]}`);
                    failedImages.push({ url: msgObj.images[i], error: '链接过期且本地缓存不可用' });
                }
            }
        }
    } catch (err) {
    }

    if (failedImages.length > 0 && typeof e.reply === 'function') {
        const failedCount = failedImages.length;
        const totalCount = msgObj?.images?.length || failedCount;
        const errorMsg = `【图片下载失败】共${totalCount}张图片，${failedCount}张下载失败，已提交${totalCount - failedCount}张给AI\n\n失败详情：\n${failedImages.map((item, index) => `${index + 1}. ${item.url}\n   原因：${item.error}`).join('\n\n')}`;
        await e.reply(errorMsg);
    }

    const { fullUserMsg } = buildUserMessageContent(msg);

    let userMessage;
    if (images.length > 0) {
        userMessage = {
            role: 'user',
            content: [
                { type: 'text', text: fullUserMsg },
                ...images.map(img => ({ type: 'image_url', image_url: img.image_url }))
            ]
        };
    } else {
        userMessage = { role: 'user', content: fullUserMsg };
    }

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
                if (item.tool_calls) {
                    messages.push({
                        role: 'assistant',
                        content: item.content || null,
                        tool_calls: item.tool_calls
                    });
                } else if (item.content) {
                    messages.push({ role: 'assistant', content: item.content });
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
        messages.push(userMessage);
    } else {
        // 工具跟进轮：注入工具结果携带的图片（如聊天记录中的历史图片），
        // 与 standardBuilder 对齐，避免模型只能看到 [图片: url] 占位文本而误判自己无视觉能力
        const toolImages = await extractToolResultImages(lastMsg, e);
        if (toolImages.length > 0) {
            messages.push({ role: 'user', content: toolImages });
        }
    }

    let requestData = {
        model: aiModel,
        messages: messages,
        ...(validatedParams.temperature !== undefined && { temperature: validatedParams.temperature }),
        ...(validatedParams.top_p !== undefined && { top_p: validatedParams.top_p }),
        ...(validatedParams.max_tokens !== undefined && { max_tokens: validatedParams.max_tokens }),
        ...(validatedParams.presence_penalty !== undefined && { presence_penalty: validatedParams.presence_penalty }),
        ...(validatedParams.frequency_penalty !== undefined && { frequency_penalty: validatedParams.frequency_penalty })
    };

    if (isToolCallingSupported(apiType)) {
        requestData.tools = getEnabledTools();
        requestData.tool_choice = 'auto';
    }

    return requestData;
}
