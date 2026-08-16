/**
 * 标准OpenAI格式请求构建器
 */

import { getDefaultParams, addToolCallingConfig, addJsonFormatConfig, downloadImageAsBase64, downloadImageSmart, extractCleanImageUrl } from '../utils/requestUtils.js';
import { isToolCallingSupported, isFeatureSupported } from '../../api-types.js';
import { getEnabledTools } from '../../tools/index.js';
import { analyzeImage } from '../visionAgent.js';
import { logger } from '../../../../components/index.js';

// 版本标记：启动/重载时输出一次，用于确认进程加载的是当前磁盘代码
logger.info('[多模态] standardBuilder v9 图片链路已加载（三级下载 + 无视觉模型走视觉代理）');

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
        const { fullUserMsg, images: extractedImages } = await extractMessageWithImages(msg, e, apiType);

        if (extractedImages && extractedImages.length > 0) {
            const multimodalContent = [
                { type: 'text', text: fullUserMsg },
                ...extractedImages
            ];
            messages.push({ role: 'user', content: multimodalContent });
        } else {
            messages.push({ role: 'user', content: fullUserMsg });
        }
    } else if (isFeatureSupported(apiType, 'multimodal')) {
        // 工具跟进轮：若工具结果携带了图片（如聊天记录中的历史图片），注入视觉内容供模型查看
        const toolImages = await extractToolResultImages(lastMsg, e);
        if (toolImages.length > 0) {
            messages.push({ role: 'user', content: toolImages });
        }
    } else {
        // 工具跟进轮且主模型无视觉能力：视觉代理把工具结果中的图片转文字描述
        const agentText = await describeToolResultImagesViaAgent(lastMsg, e);
        if (agentText) {
            messages.push({ role: 'user', content: agentText });
        }
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

    if (!isThinkingMode && isToolCallingSupported(apiType)) {
        requestData.tools = getEnabledTools();
        requestData.tool_choice = 'auto';
    }

    const { checkJsonFormatSupport } = await import('../../parsers/index.js');
    const supportsJsonFormat = checkJsonFormatSupport(apiType, aiModel);
    const hasTools = !isThinkingMode && isToolCallingSupported(apiType);

    if (supportsJsonFormat && !hasTools && !isThinkingMode) {
        requestData.response_format = { type: 'json_object' };
    }

    if (isThinkingMode) {
        // 根据模型类型设置思维链参数
        const modelLower = (aiModel || '').toLowerCase();
        // OpenAI o系列模型自带推理能力，无需额外参数
        const isOpenAIReasoning = /\bo[134]-/.test(modelLower) || modelLower.includes('o1-mini') || modelLower.includes('o1-preview');
        if (!isOpenAIReasoning) {
            requestData.thinking = { type: 'enabled' };
        }
    }

    return requestData;
}

/**
 * 从消息中提取文本和图片内容
 * @param {string} msg - JSON格式的消息字符串
 * @param {Object} e - 事件对象
 * @param {string} apiType - API类型
 * @returns {Promise<{fullUserMsg: string, images: Array}>} 提取结果
 */
async function extractMessageWithImages(msg, e, apiType) {
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
            if (replyInfo.sender) {
                replyText += ` 发送者: ${replyInfo.sender}`;
            }
            if (replyInfo.text) {
                replyText += `\n内容: ${replyInfo.text}`;
            }
            if (replyInfo.images && replyInfo.images.length > 0) {
                replyText += `\n(引用消息中包含 ${replyInfo.images.length} 张图片)`;
            }
            userMsg = userMsg + replyText;
        }
    } catch (err) {
    }

    let fullUserMsg;
    if (userInfo) {
        const userRequestFormat = {
            message: userMsg,
            additional_info: {
                name: userInfo.name || '未知用户',
                user_id: userInfo.user_id || '',
                group_id: userInfo.group_id || 0,
                favor: userInfo.favor
            }
        };
        fullUserMsg = JSON.stringify(userRequestFormat);
    } else {
        fullUserMsg = userMsg;
    }

    // 图片来源合并（收集逻辑前置，供多模态注入与视觉代理共用）：事件消息段（主源，含文件ID）+ 预处理 JSON 中的图片（回退源）
    const msgFileIds = collectImageFileIds(e);
    const imageEntries = [];

    if (msgFileIds.length > 0 || hasImageSegment(e)) {
        // 主源：直接取事件消息段，fileId 与 url 天然配对，不受预处理序列化污染
        const segs = Array.isArray(e?.message) ? e.message : [];
        segs.forEach((seg, idx) => {
            if (seg?.type === 'image') {
                const data = seg.data || {};
                imageEntries.push({
                    url: String(seg.url || data.url || ''),
                    fileId: String(seg.file || seg.file_id || data.file || data.file_id || ''),
                    idx
                });
            }
        });
    } else {
        // 回退源：预处理 JSON 的 images 数组（无 fileId 时按序对应事件消息段补齐）
        allImageUrlsFallback(msgImages, msgFileIds).forEach(entry => imageEntries.push(entry));
    }

    if (replyInfo && Array.isArray(replyInfo.images) && replyInfo.images.length > 0) {
        // 引用消息中的图片：无事件段对应，仅能尝试 URL 直链
        for (const imgUrl of replyInfo.images) {
            const clean = extractCleanImageUrl(imgUrl);
            if (clean) {
                imageEntries.push({ url: clean, fileId: '', idx: -1 });
            }
        }
    }

    const supportsMultimodal = isFeatureSupported(apiType, 'multimodal');
    if (!supportsMultimodal) {
        // 主模型无视觉能力：视觉代理把图片转文字描述注入，避免模型"看不到图"
        const agentText = await describeImagesViaVisionAgent(imageEntries, e);
        if (agentText) {
            return { fullUserMsg: `${fullUserMsg}\n${agentText}`, images: [] };
        }
        return { fullUserMsg, images: [] };
    }

    if (imageEntries.length > 0) {
        const failedImages = [];

        for (const entry of imageEntries) {
            // 三级下载：直链 → get_image 本地缓存 → get_image 新链
            const downloaded = await downloadImageSmart({
                url: entry.url,
                fileId: entry.fileId,
                e,
                source: '多模态'
            });

            if (downloaded) {
                images.push({
                    type: 'image_url',
                    image_url: {
                        url: `data:${downloaded.mime};base64,${downloaded.base64}`
                    }
                });
            } else {
                const shownUrl = extractCleanImageUrl(entry.url) || entry.fileId || '未知图片';
                logger.error(`[多模态] 图片获取失败（三级策略均失败）: ${shownUrl}`);
                failedImages.push({ url: shownUrl, error: '链接过期且本地缓存不可用' });
            }
        }

        if (failedImages.length > 0 && typeof e?.reply === 'function') {
            const failedCount = failedImages.length;
            const totalCount = imageEntries.length;
            const successCount = totalCount - failedCount;
            
            let errorMsg = `【图片处理提示】`;
            if (successCount > 0) {
                errorMsg += `成功处理${successCount}张图片，`;
            }
            errorMsg += `${failedCount}张图片下载失败\n`;
            errorMsg += failedImages.map((item, index) => 
                `${index + 1}. ${item.url.substring(0, 30)}...\n   原因: ${item.error}`
            ).join('\n');
            
            await e.reply(errorMsg);
        }
    }

    return { fullUserMsg, images };
}

/** 工具结果单次注入图片的最大数量，防止 token 消耗失控 */
const MAX_TOOL_RESULT_IMAGES = 3;

/**
 * 判断事件消息段中是否含有图片段
 * @param {object} e - 事件对象
 * @returns {boolean} 是否含图片段
 */
function hasImageSegment(e) {
    const segments = Array.isArray(e?.message) ? e.message : [];
    return segments.some(seg => seg?.type === 'image');
}

/**
 * 预处理 JSON 图片数组的回退组装
 * 事件消息段无图片时使用；按序号对应事件消息段的文件ID（数量一致时才配对）
 * @param {Array<string>} msgImages - 预处理图片URL数组
 * @param {Array<string>} msgFileIds - 事件消息段文件ID数组
 * @returns {Array<{url: string, fileId: string, idx: number}>} 图片条目数组
 */
function allImageUrlsFallback(msgImages, msgFileIds) {
    const entries = [];
    for (let i = 0; i < msgImages.length; i++) {
        const clean = extractCleanImageUrl(msgImages[i]);
        if (!clean) {
            continue;
        }
        // 仅在数量一致时按序配对，避免错位兑底
        const fileId = msgFileIds.length === msgImages.length ? msgFileIds[i] : '';
        entries.push({ url: clean, fileId, idx: i });
    }
    return entries;
}

/**
 * 从事件消息段中按顺序收集图片文件ID
 * OneBot 格式（e.message 数组的 image 段 data.file）与 icqq 格式（seg.file）兼容，
 * 用于直链下载失败时经 get_image 兑底
 * @param {object} e - 事件对象
 * @returns {Array<string>} 文件ID数组，与消息中图片出现顺序对应
 */
export function collectImageFileIds(e) {
    const fileIds = [];
    const segments = Array.isArray(e?.message) ? e.message : [];
    for (const seg of segments) {
        if (!seg || typeof seg !== 'object') {
            continue;
        }
        if (seg.type === 'image') {
            fileIds.push(String(seg.file || seg.file_id || seg.data?.file || seg.data?.file_id || ''));
        }
    }
    return fileIds;
}

/** 视觉代理单轮识别图片上限，防止耗时与 token 失控 */
const MAX_AGENT_IMAGES = 3;

/**
 * 视觉代理识别核心：逐张三级下载后调视觉模型识别
 * @param {Array<{url: string, fileId: string}>} imageEntries - 图片条目数组
 * @param {object} [e] - 事件对象（提供 bot.sendApi 用于 get_image 兑底）
 * @returns {Promise<string[]>} 识别成功的描述列表
 */
async function recognizeImagesCore(imageEntries, e) {
    const descriptions = [];
    const candidates = imageEntries.slice(0, MAX_AGENT_IMAGES);

    for (const entry of candidates) {
        const downloaded = await downloadImageSmart({
            url: entry.url,
            fileId: entry.fileId,
            e,
            source: '视觉代理'
        });
        if (!downloaded) {
            logger.warn(`[视觉代理] 图片下载失败，跳过识别: ${extractCleanImageUrl(entry.url) || entry.fileId || '未知图片'}`);
            continue;
        }

        const result = await analyzeImage({
            base64: downloaded.base64,
            mime: downloaded.mime
        });
        if (result.success) {
            descriptions.push(result.description);
        } else {
            logger.warn(`[视觉代理] 图片识别失败: ${result.error}`);
        }
    }

    return descriptions;
}

/**
 * 视觉代理：主对话模型无视觉能力时，将用户消息中的图片交由视觉模型转文字描述
 * 全部失败时返回空字符串（保持无视觉时的原行为）
 * @param {Array<{url: string, fileId: string}>} imageEntries - 图片条目数组
 * @param {object} [e] - 事件对象
 * @returns {Promise<string>} 注入用文字描述，无内容时返回空字符串
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
 * 视觉代理：工具跟进轮（主模型无视觉能力）把工具结果携带的图片转文字描述
 * @param {object} toolMsg - tool 角色消息对象
 * @param {object} [e] - 事件对象
 * @returns {Promise<string>} 注入用文字描述，无内容时返回空字符串
 */
async function describeToolResultImagesViaAgent(toolMsg, e) {
    if (!toolMsg || typeof toolMsg.content !== 'string') {
        return '';
    }

    let result;
    try {
        result = JSON.parse(toolMsg.content);
    } catch {
        return '';
    }
    if (!result || !Array.isArray(result.images) || result.images.length === 0) {
        return '';
    }

    const imageEntries = result.images.map(item => ({
        url: typeof item === 'string' ? item : String(item?.url || ''),
        fileId: typeof item === 'object' ? String(item.file_id || item.file || '') : ''
    }));

    const descriptions = await recognizeImagesCore(imageEntries, e);
    if (descriptions.length === 0) {
        return '';
    }
    return `【补充说明】上述工具结果中提到的图片，经视觉模型识别内容如下（按出现顺序）：\n${descriptions.map((d, i) => `【图片${i + 1}内容】${d}`).join('\n')}`;
}

/**
 * 从工具结果消息中提取图片并构建多模态内容
 * 工具（如 get_recent_messages）在结果 JSON 中携带 images 数组时，
 * 下载图片转为 base64，与说明文本组装成 multimodal content 供模型查看。
 * 历史图片 URL 的 rkey 可能已过期，下载失败时经 OneBot get_image 接口
 * 用文件ID换取新鲜链接重试
 * @param {object} toolMsg - tool 角色消息对象
 * @param {object} [e] - 事件对象（提供 bot.sendApi 用于 get_image 兑底）
 * @returns {Promise<Array>} multimodal content 数组，无图片或全部失败时返回空数组
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

    if (!result || !Array.isArray(result.images) || result.images.length === 0) {
        return [];
    }

    const content = [{
        type: 'text',
        text: '【补充说明】以下是上述工具结果中提到的图片内容，按出现顺序排列，可直接用于理解与回复。'
    }];

    const candidates = result.images.slice(0, MAX_TOOL_RESULT_IMAGES);
    for (const item of candidates) {
        const url = extractCleanImageUrl(typeof item === 'string' ? item : item?.url || '');
        const fileId = typeof item === 'object' ? String(item.file_id || item.file || '') : '';

        if (!url && !fileId) {
            continue;
        }

        // 三级下载：直链 → get_image 本地缓存 → get_image 新链
        const downloaded = await downloadImageSmart({ url, fileId, e, source: '多模态' });

        if (downloaded) {
            content.push({
                type: 'image_url',
                image_url: { url: `data:${downloaded.mime};base64,${downloaded.base64}` }
            });
        } else {
            logger.warn(`[多模态] 工具结果图片获取失败（三级策略均失败）: ${url || fileId}`);
        }
    }

    // 仅文本说明而无图片时无注入价值
    return content.length > 1 ? content : [];
}
