/**
 * Gemini请求构建器
 */

import { buildUserMessageContent, downloadImageAsBase64 } from '../utils/requestUtils.js';
import { checkJsonFormatSupport } from '../../parsers/index.js';

/**
 * 构建Gemini请求数据
 * @param {string} aiModel - AI模型名称
 * @param {string} apiUrl - API地址
 * @param {string} systemMessage - 系统消息
 * @param {Array} chatMsg - 聊天历史
 * @param {string} msg - 当前用户消息
 * @param {Object} e - 事件对象
 * @param {Object} validatedParams - 验证后的请求参数
 * @returns {Promise<Object>} 请求数据对象
 */
export async function buildGeminiRequest(aiModel, apiUrl, systemMessage, chatMsg, msg, e, validatedParams) {
    let contents = [];
    let systemPrompt = '';
    try {
        systemPrompt = typeof systemMessage === 'string' ? systemMessage : JSON.stringify(systemMessage);
    } catch {
        systemPrompt = '';
    }

    if (Array.isArray(chatMsg)) {
        for (const item of chatMsg) {
            if (!item || !item.role || !item.content) continue;
            if (item.role === 'system') continue;
            if (item.role === 'user') {
                contents.push({ role: 'user', parts: [{ text: item.content }] });
            } else if (item.role === 'assistant') {
                contents.push({ role: 'model', parts: [{ text: item.content }] });
            }
        }
    }

    let parts = [];
    let failedImages = [];
    let msgObj;

    try {
        msgObj = JSON.parse(msg);
        const { fullUserMsg } = buildUserMessageContent(msg);
        parts.push({ text: fullUserMsg });

        if (Array.isArray(msgObj.images) && msgObj.images.length > 0) {
            for (const imgUrl of msgObj.images) {
                try {
                    const { base64, mime } = await downloadImageAsBase64(imgUrl);
                    parts.push({ inline_data: { data: base64, mime_type: mime } });
                } catch (err) {
                    console.error(`[Gemini] 图片下载失败: ${imgUrl}, 错误: ${err.message}`);
                    failedImages.push({ url: imgUrl, error: err.message });
                }
            }
        }
    } catch (err) {
        parts.push({ text: msg });
    }

    if (failedImages.length > 0 && typeof e.reply === 'function') {
        const failedCount = failedImages.length;
        const totalCount = msgObj?.images?.length || failedCount;
        const errorMsg = `【图片下载失败】共${totalCount}张图片，${failedCount}张下载失败，已提交${totalCount - failedCount}张给AI\n\n失败详情：\n${failedImages.map((item, index) => `${index + 1}. ${item.url}\n   原因：${item.error}`).join('\n\n')}`;
        await e.reply(errorMsg);
    }

    contents.push({ role: 'user', parts });

    let requestData = {
        contents,
        generationConfig: {
            ...(validatedParams.temperature !== undefined && { temperature: validatedParams.temperature }),
            ...(validatedParams.top_p !== undefined && { topP: validatedParams.top_p }),
            ...(validatedParams.max_tokens !== undefined && { maxOutputTokens: validatedParams.max_tokens })
        }
    };

    const supportsJsonFormat = checkJsonFormatSupport('gemini', aiModel);
    if (supportsJsonFormat) {
        requestData.generationConfig.response_mime_type = 'application/json';
    }

    if (systemPrompt.trim()) {
        requestData.systemInstruction = {
            parts: [{ text: systemPrompt }]
        };
    }

    const supportsGrounding = (aiModel || '').toLowerCase().includes('gemini-2.5') ||
        (apiUrl || '').includes('gemini-2.5');

    if (supportsGrounding) {
        requestData.tools = [{
            google_search: {}
        }];
    }

    return requestData;
}
