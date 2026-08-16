/**
 * Gemini请求构建器
 */

import { buildUserMessageContent, downloadImageSmart } from '../utils/requestUtils.js';
import { checkJsonFormatSupport } from '../../parsers/index.js';
import { logger } from '../../../../components/index.js';

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
                // 三级下载：直链 → get_image 本地缓存 → get_image 新链
                const downloaded = await downloadImageSmart({ url: imgUrl, e, source: 'Gemini' });
                if (downloaded) {
                    parts.push({ inline_data: { data: downloaded.base64, mime_type: downloaded.mime } });
                } else {
                    logger.error(`[Gemini] 图片获取失败（三级策略均失败）: ${imgUrl}`);
                    failedImages.push({ url: imgUrl, error: '链接过期且本地缓存不可用' });
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
