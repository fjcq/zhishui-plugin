/**
 * 消息组装器（新架构版）
 * 移植自旧standardBuilder：system+历史+当前消息组装、多模态图片注入、
 * 视觉代理降级（主模型无视觉能力时图片转文字）、工具跟进轮图片回收。
 *
 * 输出OpenAI中间格式messages，供各provider统一消费。
 */

import {
    downloadImageSmart, extractCleanImageUrl, buildUserMessageContent
} from '../api/utils/requestUtils.js';
import { analyzeImage } from './visionAgent.js';
import { rememberSessionImage, IMAGE_SOURCES } from '../tools/imageGen/imageMemory.js';
import { logger } from '../../../components/index.js';

/** 工具结果单次注入图片的最大数量，防止 token 消耗失控 */
const MAX_TOOL_RESULT_IMAGES = 3;

/** 视觉代理单轮识别图片上限，防止耗时与 token 失控 */
const MAX_AGENT_IMAGES = 3;

/**
 * 验证并清理消息数组（保留消息序列完整性，让API处理语义验证）
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

        if (msg.role === 'user' && hasContent) {
            sanitized.push(msg);
        } else if (msg.role === 'assistant' && (hasContent || hasToolCalls || msg.function_call !== undefined)) {
            sanitized.push(msg);
        } else if ((msg.role === 'tool' || msg.role === 'function') && hasToolCallId && hasContent) {
            sanitized.push(msg);
        } else if (msg.role === 'system' && msg.content && String(msg.content).trim()) {
            sanitized.push(msg);
        }
    }
    return sanitized;
}

/**
 * 从事件消息段中按顺序收集图片文件ID（OneBot与icqq格式兼容）
 * @param {Object} e - 事件对象
 * @returns {Array<string>} 文件ID数组
 */
function collectImageFileIds(e) {
    const fileIds = [];
    const segments = Array.isArray(e?.message) ? e.message : [];
    for (const seg of segments) {
        if (seg?.type === 'image') {
            fileIds.push(String(seg.file || seg.file_id || seg.data?.file || seg.data?.file_id || ''));
        }
    }
    return fileIds;
}

/**
 * 判断事件消息段中是否含有图片段
 * @param {Object} e - 事件对象
 * @returns {boolean} 是否含图片段
 */
function hasImageSegment(e) {
    return (Array.isArray(e?.message) ? e.message : []).some(seg => seg?.type === 'image');
}

/**
 * 预处理JSON图片数组的回退组装（数量一致时按序配对fileId）
 * @param {Array<string>} msgImages - 图片URL数组
 * @param {Array<string>} msgFileIds - 文件ID数组
 * @returns {Array<{url: string, fileId: string, idx: number}>} 图片条目数组
 */
function allImageUrlsFallback(msgImages, msgFileIds) {
    const entries = [];
    for (let i = 0; i < msgImages.length; i++) {
        const clean = extractCleanImageUrl(msgImages[i]);
        if (!clean) continue;
        const fileId = msgFileIds.length === msgImages.length ? msgFileIds[i] : '';
        entries.push({ url: clean, fileId, idx: i });
    }
    return entries;
}

/**
 * 视觉代理识别核心：逐张三级下载后调视觉模型识别
 * @param {Array<{url: string, fileId: string}>} imageEntries - 图片条目数组
 * @param {Object} e - 事件对象
 * @returns {Promise<string[]>} 识别成功的描述列表
 */
async function recognizeImagesCore(imageEntries, e) {
    const descriptions = [];
    for (const entry of imageEntries.slice(0, MAX_AGENT_IMAGES)) {
        const downloaded = await downloadImageSmart({
            url: entry.url, fileId: entry.fileId, e, source: '视觉代理'
        });
        if (!downloaded) {
            logger.warn(`[视觉代理] 图片下载失败，跳过识别: ${extractCleanImageUrl(entry.url) || entry.fileId || '未知图片'}`);
            continue;
        }
        const result = await analyzeImage({ base64: downloaded.base64, mime: downloaded.mime });
        if (result.success) {
            descriptions.push(result.description);
        } else {
            logger.warn(`[视觉代理] 图片识别失败: ${result.error}`);
        }
    }
    return descriptions;
}

/**
 * 视觉代理：将图片条目转为文字描述注入文本
 * @param {Array} imageEntries - 图片条目数组
 * @param {Object} e - 事件对象
 * @returns {Promise<string>} 注入用文字描述，无内容返回空字符串
 */
async function describeImagesViaVisionAgent(imageEntries, e) {
    if (!Array.isArray(imageEntries) || imageEntries.length === 0) {
        return '';
    }
    const descriptions = await recognizeImagesCore(imageEntries, e);
    if (descriptions.length === 0) {
        return '';
    }
    return `【图片识别结果】用户发送了 ${imageEntries.length} 张图片（识别 ${descriptions.length} 张），以下内容由视觉模型识别提供：\n${descriptions.map((d, i) => `【图片${i + 1}内容】${d}`).join('\n')}`;
}

/**
 * 从当前用户消息提取文本与图片（含多模态注入与视觉代理降级）
 * @param {string} msg - JSON格式消息字符串
 * @param {Object} e - 事件对象
 * @param {Object} provider - Provider实例（supportsVision判断）
 * @param {string} model - 模型名
 * @param {boolean|undefined} [modelVision] - 用户为该模型显式设置的视觉能力标记（三态）
 * @returns {Promise<{fullUserMsg: string, images: Array}>} 提取结果
 */
async function extractMessageWithImages(msg, e, provider, model, modelVision) {
    let userMsg = msg;
    let userInfo = null;
    let replyInfo = null;
    let msgImages = [];
    let images = [];

    try {
        const msgObj = JSON.parse(msg);
        userMsg = msgObj.message || msg;
        userInfo = msgObj.additional_info || null;
        replyInfo = msgObj.reply || null;
        msgImages = Array.isArray(msgObj.images) ? msgObj.images : [];

        if (replyInfo) {
            let replyText = `\n【引用的消息】`;
            if (replyInfo.sender) replyText += ` 发送者: ${replyInfo.sender}`;
            if (replyInfo.text) replyText += `\n内容: ${replyInfo.text}`;
            if (replyInfo.images?.length > 0) replyText += `\n(引用消息中包含 ${replyInfo.images.length} 张图片)`;
            userMsg = userMsg + replyText;
        }
    } catch { /* 非JSON消息原样使用 */ }

    const { fullUserMsg } = buildUserMessageContent(
        userInfo ? JSON.stringify({ message: userMsg, additional_info: userInfo }) : userMsg
    );

    // 图片来源合并：事件消息段（主源）+ 预处理JSON图片（回退源）+ 引用消息图片
    const msgFileIds = collectImageFileIds(e);
    const imageEntries = [];

    if (msgFileIds.length > 0 || hasImageSegment(e)) {
        (Array.isArray(e?.message) ? e.message : []).forEach((seg, idx) => {
            if (seg?.type === 'image') {
                imageEntries.push({
                    url: String(seg.url || seg.data?.url || ''),
                    fileId: String(seg.file || seg.file_id || seg.data?.file || seg.data?.file_id || ''),
                    idx
                });
            }
        });
    } else {
        allImageUrlsFallback(msgImages, msgFileIds).forEach(entry => imageEntries.push(entry));
    }

    if (replyInfo && Array.isArray(replyInfo.images)) {
        for (const imgUrl of replyInfo.images) {
            const clean = extractCleanImageUrl(imgUrl);
            if (clean) {
                imageEntries.push({ url: clean, fileId: '', idx: -1 });
            }
        }
    }

    // 写入会话图片记忆（后续 edit_image/analyze_image 可用 "last" 引用用户刚发的图）
    for (const entry of imageEntries) {
        await rememberSessionImage(e, {
            source: IMAGE_SOURCES.USER,
            url: entry.url,
            fileId: entry.fileId
        });
    }

    // 主模型无视觉能力：视觉代理降级（图片转文字）
    if (!provider.supportsVision(model, modelVision)) {
        const agentText = await describeImagesViaVisionAgent(imageEntries, e);
        return agentText
            ? { fullUserMsg: `${fullUserMsg}\n${agentText}`, images: [] }
            : { fullUserMsg, images: [] };
    }

    if (imageEntries.length > 0) {
        const failedImages = [];
        for (const entry of imageEntries) {
            const downloaded = await downloadImageSmart({
                url: entry.url, fileId: entry.fileId, e, source: '多模态'
            });
            if (downloaded) {
                images.push({
                    type: 'image_url',
                    image_url: { url: `data:${downloaded.mime};base64,${downloaded.base64}` }
                });
            } else {
                const shownUrl = extractCleanImageUrl(entry.url) || entry.fileId || '未知图片';
                logger.error(`[多模态] 图片获取失败（三级策略均失败）: ${shownUrl}`);
                failedImages.push(shownUrl);
            }
        }
        if (failedImages.length > 0 && typeof e?.reply === 'function') {
            await e.reply(`【图片处理提示】成功处理${imageEntries.length - failedImages.length}张图片，${failedImages.length}张下载失败`);
        }
    }

    return { fullUserMsg, images };
}

/**
 * 从工具结果消息提取图片并构建多模态内容（工具跟进轮）
 * @param {Object} toolMsg - tool角色消息对象
 * @param {Object} e - 事件对象
 * @returns {Promise<Array>} multimodal content数组
 */
export async function extractToolResultImages(toolMsg, e) {
    if (!toolMsg || typeof toolMsg.content !== 'string') {
        return [];
    }
    let result;
    try {
        result = JSON.parse(toolMsg.content);
    } catch {
        return [];
    }
    if (!Array.isArray(result?.images) || result.images.length === 0) {
        return [];
    }

    const content = [{
        type: 'text',
        text: '【补充说明】以下是上述工具结果中提到的图片内容，按出现顺序排列，可直接用于理解与回复。'
    }];
    for (const item of result.images.slice(0, MAX_TOOL_RESULT_IMAGES)) {
        const url = extractCleanImageUrl(typeof item === 'string' ? item : item?.url || '');
        const fileId = typeof item === 'object' ? String(item.file_id || item.file || '') : '';
        if (!url && !fileId) continue;

        const downloaded = await downloadImageSmart({ url, fileId, e, source: '多模态' });
        if (downloaded) {
            content.push({
                type: 'image_url',
                image_url: { url: `data:${downloaded.mime};base64,${downloaded.base64}` }
            });
        } else {
            logger.warn(`[多模态] 工具结果图片获取失败: ${url || fileId}`);
        }
    }
    return content.length > 1 ? content : [];
}

/**
 * 组装完整OpenAI中间格式消息数组
 * @param {Object} options - 组装选项
 * @param {string} options.systemMessage - 系统消息
 * @param {Array} options.chatMsg - 聊天历史
 * @param {string} options.msg - 当前用户消息（JSON字符串）
 * @param {Object} options.e - 事件对象
 * @param {Object} options.provider - Provider实例
 * @param {string} options.model - 模型名
 * @param {boolean|undefined} [options.modelVision] - 用户为该模型显式设置的视觉能力标记（三态）
 * @param {boolean} [options.isThinkingMode=false] - 思维链模式（历史assistant带reasoning_content）
 * @returns {Promise<Array>} 消息数组
 */
export async function buildMessages({ systemMessage, chatMsg, msg, e, provider, model, modelVision, isThinkingMode = false }) {
    let messages = [];

    const systemPrompt = typeof systemMessage === 'string' ? systemMessage : '';
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }

    for (const item of (Array.isArray(chatMsg) ? chatMsg : [])) {
        if (!item || !item.role) continue;
        if (item.role === 'user' && item.content) {
            messages.push({ role: 'user', content: item.content });
        } else if (item.role === 'assistant') {
            const assistantMsg = { role: 'assistant', content: item.content || null };
            if (item.tool_calls) {
                assistantMsg.tool_calls = item.tool_calls;
            }
            if (isThinkingMode && item.reasoning_content) {
                assistantMsg.reasoning_content = item.reasoning_content;
            }
            if (assistantMsg.content || assistantMsg.tool_calls || assistantMsg.reasoning_content) {
                messages.push(assistantMsg);
            }
        } else if (item.role === 'tool') {
            messages.push({ role: 'tool', tool_call_id: item.tool_call_id, content: item.content });
        }
    }

    // 工具跟进轮判断：末条为tool时不追加当前用户消息，转为图片回收
    const lastMsg = chatMsg?.length > 0 ? chatMsg[chatMsg.length - 1] : null;
    const isToolFollowUp = lastMsg && lastMsg.role === 'tool';

    if (!isToolFollowUp) {
        const { fullUserMsg, images } = await extractMessageWithImages(msg, e, provider, model, modelVision);
        if (images.length > 0) {
            messages.push({ role: 'user', content: [{ type: 'text', text: fullUserMsg }, ...images] });
        } else {
            messages.push({ role: 'user', content: fullUserMsg });
        }
    } else if (provider.supportsVision(model, modelVision)) {
        const toolImages = await extractToolResultImages(lastMsg, e);
        if (toolImages.length > 0) {
            messages.push({ role: 'user', content: toolImages });
        }
    } else {
        // 工具跟进轮且主模型无视觉能力：视觉代理把工具结果图片转文字
        let toolResult;
        try {
            toolResult = JSON.parse(lastMsg.content);
        } catch {
            toolResult = null;
        }
        if (Array.isArray(toolResult?.images) && toolResult.images.length > 0) {
            const entries = toolResult.images.map(item => ({
                url: typeof item === 'string' ? item : String(item?.url || ''),
                fileId: typeof item === 'object' ? String(item.file_id || item.file || '') : ''
            }));
            const agentText = await describeImagesViaVisionAgent(entries, e);
            if (agentText) {
                messages.push({ role: 'user', content: agentText });
            }
        }
    }

    return validateAndSanitizeMessages(messages);
}
