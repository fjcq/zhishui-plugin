import { Config } from '../../components/index.js';
import { getCurrentApiConfig, getCurrentRoleIndex, mergeSystemMessage } from './config.js';
import { addMessage } from './session.js';
import { checkJsonFormatSupport, validateRequestParams, parseJsonResponse, parseErrorMessage } from './parsers.js';
import { getUserFavor, setUserFavor } from './user.js';
import { ApiTypes } from './api-types.js';

/**
 * 获取有效的用户ID
 * @param {string|number} userId - 原始用户ID
 * @returns {string} 处理后的有效用户ID
 */
async function getValidUserId(userId) {
    // 处理特殊用户 stdin 和无效ID
    if (userId === 'stdin' || !userId || isNaN(userId) || String(userId).length < 5) {
        const masterQQ = await Config.Chat.MasterQQ;
        return masterQQ || "172679743";
    }
    return String(userId);
}

/**
 * 调用 AI API 进行对话
 * @param {string} msg - 用户消息
 * @param {Object} e - 事件对象
 * @param {string} systemMessage - 系统消息
 * @param {Array} chatMsg - 聊天历史
 * @returns {Promise<Object>} 返回对象包含 { content: string, rawResponse: string }
 */
export async function openAi(msg, e, systemMessage, chatMsg) {
    // 使用新的API配置获取方法
    const { apiIndex, apiConfig } = await getCurrentApiConfig(e);

    // 取出各项参数
    const apiType = apiConfig.ApiType || 'siliconflow';
    const apiKey = apiConfig.ApiKey || '';
    const aiModel = apiConfig.ApiModel || 'gpt-3.5-turbo';
    const apiUrl = apiConfig.ApiUrl || '';
    const tencentAssistantId = apiConfig.TencentAssistantId || '';

    // 获取当前角色的请求参数
    let roleRequestParams = {};
    try {
        const roleJson = Config.getJsonConfig('RoleProfile');
        const roles = JSON.parse(roleJson);
        const currentRoleIndex = await getCurrentRoleIndex(e);
        const currentRole = roles[currentRoleIndex] || {};
        roleRequestParams = currentRole['请求参数'] || {};
    } catch (error) {
        console.log('[openAi] 获取角色请求参数失败:', error.message);
    }

    // 根据API类型提供不同的默认参数
    const defaultParams = {
        temperature: 0.7,
        top_p: 0.95,
        max_tokens: 2048
    };

    // OpenAI/SiliconFlow/DeepSeek/智谱等支持更多参数
    if (apiType === ApiTypes.OPENAI || apiType === ApiTypes.SILICONFLOW || apiType === ApiTypes.DEEPSEEK || apiType === ApiTypes.ZHIPU) {
        defaultParams.presence_penalty = 0.2;
        defaultParams.frequency_penalty = 0.3;
    }

    // 合并默认参数和角色参数
    roleRequestParams = { ...defaultParams, ...roleRequestParams };

    // 针对硅基流动Qwen/Qwen2.5-VL-72B-Instruct模型的特殊处理
    const isQwenVL = (aiModel || '').toLowerCase().includes('qwen') || (aiModel || '').toLowerCase().includes('vl-72b');

    // 构建请求头和请求数据
    const { headers, requestData } = await buildRequestData(apiType, apiKey, aiModel, apiUrl, tencentAssistantId, systemMessage, chatMsg, msg, e, roleRequestParams, isQwenVL);

    // 输出请求参数调试信息
    if (apiType === ApiTypes.TENCENT) {
        console.log('[openAi] 腾讯API请求地址:', apiUrl);
        console.log('[openAi] 腾讯API请求头:', headers);
        console.log('[openAi] 腾讯API请求数据:', JSON.stringify(requestData, null, 2));
    }

    let content;
    let rawResponse = '';
    try {
        // 发送 POST 请求
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestData),
        });

        // 错误码处理
        handleHttpErrors(response, apiType);

        // 解析响应
        const responseData = await response.json();
        rawResponse = JSON.stringify(responseData, null, 2);

        // 根据API类型处理响应
        content = await handleApiResponse(responseData, apiType, msg, e, systemMessage, chatMsg, requestData);
    } catch (error) {
        // 处理通信错误
        content = await handleCommunicationError(error, apiType);
    }

    return { content, rawResponse };
}

/**
 * 构建请求数据
 */
async function buildRequestData(apiType, apiKey, aiModel, apiUrl, tencentAssistantId, systemMessage, chatMsg, msg, e, roleRequestParams, isQwenVL) {
    let headers;
    let requestData;

    // 构建请求头
    if (apiType === 'tencent') {
        headers = {
            'X-Source': 'openapi',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        };
    } else if (apiType === 'gemini') {
        headers = {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
        };
    } else {
        headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        };
    }

    // 验证并修正请求参数
    const validatedParams = validateRequestParams(roleRequestParams, apiType);

    // 根据API类型构建请求数据
    if (apiType === ApiTypes.TENCENT) {
        requestData = await buildTencentRequest(tencentAssistantId, systemMessage, chatMsg, msg, e, validatedParams);
    } else if (apiType === 'gemini') {
        requestData = await buildGeminiRequest(aiModel, apiUrl, systemMessage, chatMsg, msg, e, validatedParams);
    } else if (isQwenVL) {
        requestData = await buildQwenVLRequest(aiModel, systemMessage, chatMsg, msg, e, validatedParams);
    } else {
        requestData = await buildStandardRequest(aiModel, systemMessage, chatMsg, msg, e, validatedParams, apiType);
    }

    return { headers, requestData };
}

/**
 * 构建腾讯元器请求数据
 */
async function buildTencentRequest(tencentAssistantId, systemMessage, chatMsg, msg, e, validatedParams) {
    let messages = [];

    // 系统消息处理：腾讯元器不支持system角色，需要融入到用户消息中
    let systemPrompt = '';
    try {
        systemPrompt = typeof systemMessage === 'string' ? systemMessage : JSON.stringify(systemMessage);
    } catch {
        systemPrompt = '';
    }

    // 处理历史消息：确保user与assistant交替
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

    // 处理当前用户消息
    let userMsg = msg;
    let userInfo = null;
    try {
        let msgObj = JSON.parse(msg);
        userMsg = msgObj.message || msg;
        userInfo = msgObj.additional_info || null;
    } catch (err) {
        // msg 不是 JSON，直接使用
    }

    // 构建包含用户信息的完整消息
    let fullUserMsg = userMsg;
    if (userInfo) {
        const userContext = `[用户信息: QQ号${userInfo.user_id}, 昵称${userInfo.name}, 好感度${userInfo.favor}${userInfo.group_id ? ', 群聊' + userInfo.group_id : ', 私聊'}]`;
        fullUserMsg = `${userContext}\n用户说: ${userMsg}`;
    }

    // 如果是第一条消息，将完整的系统设定融入用户消息
    if (messages.length === 0 || messages[messages.length - 1].role !== 'assistant') {
        if (systemPrompt && messages.length === 0) {
            fullUserMsg = `${systemPrompt}\n\n${fullUserMsg}`;
        }
        messages.push({ role: 'user', content: fullUserMsg });
    }

    // 确保消息数组不为空且格式正确
    if (messages.length === 0) {
        messages.push({ role: 'user', content: fullUserMsg });
    }

    // 确定用户ID：处理特殊用户 stdin 和无效ID
    const userId = await getValidUserId(e.user_id);

    // 验证腾讯元器必填参数
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

/**
 * 构建Gemini请求数据
 */
async function buildGeminiRequest(aiModel, apiUrl, systemMessage, chatMsg, msg, e, validatedParams) {
    let contents = [];
    let systemPrompt = '';
    try {
        systemPrompt = typeof systemMessage === 'string' ? systemMessage : JSON.stringify(systemMessage);
    } catch {
        systemPrompt = '';
    }

    // 添加历史对话记录（不包含system消息）
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

    // 处理当前用户消息
    let parts = [];
    let failedImages = [];
    let userMsg = msg;
    let userInfo = null;

    try {
        let msgObj = JSON.parse(msg);
        userMsg = msgObj.message || msg;
        userInfo = msgObj.additional_info || null;

        let fullUserMsg = userMsg;
        if (userInfo) {
            const userContext = `[用户信息: QQ号${userInfo.user_id}, 昵称${userInfo.name}, 好感度${userInfo.favor}${userInfo.group_id ? ', 群聊' + userInfo.group_id : ', 私聊'}]`;
            fullUserMsg = `${userContext}\n用户说: ${userMsg}`;
        }

        parts.push({ text: fullUserMsg });

        if (Array.isArray(msgObj.images) && msgObj.images.length > 0) {
            for (const imgUrl of msgObj.images) {
                try {
                    const res = await fetch(imgUrl);
                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                    }
                    const arrayBuffer = await res.arrayBuffer();
                    const base64 = Buffer.from(arrayBuffer).toString('base64');
                    let mime = 'image/jpeg';
                    if (imgUrl.endsWith('.png')) mime = 'image/png';
                    if (imgUrl.endsWith('.webp')) mime = 'image/webp';
                    if (imgUrl.endsWith('.gif')) mime = 'image/gif';
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
        const totalCount = msgObj.images?.length || failedCount;
        const errorMsg = `【图片下载失败】共${totalCount}张图片，${failedCount}张下载失败，已提交${totalCount - failedCount}张给AI\n\n失败详情：\n${failedImages.map((item, index) => `${index + 1}. ${item.url}\n   原因：${item.error}`).join('\n\n')}`;
        await e.reply(errorMsg);
    }

    contents.push({ role: 'user', parts });

    // 构建基础请求数据
    let requestData = {
        contents,
        generationConfig: {
            ...(validatedParams.temperature !== undefined && { temperature: validatedParams.temperature }),
            ...(validatedParams.top_p !== undefined && { topP: validatedParams.top_p }),
            ...(validatedParams.max_tokens !== undefined && { maxOutputTokens: validatedParams.max_tokens })
        }
    };

    // 检查是否支持JSON格式输出
    const supportsJsonFormat = checkJsonFormatSupport('gemini', aiModel);
    if (supportsJsonFormat) {
        requestData.generationConfig.response_mime_type = 'application/json';
        console.log('[openAi] Gemini 已启用JSON格式输出');
    }

    // 使用 systemInstruction 字段来处理系统消息
    if (systemPrompt.trim()) {
        requestData.systemInstruction = {
            parts: [{ text: systemPrompt }]
        };
    }

    // Gemini 联网搜索功能
    const supportsGrounding = (aiModel || '').toLowerCase().includes('gemini-2.5') ||
        (apiUrl || '').includes('gemini-2.5');

    if (supportsGrounding) {
        requestData.tools = [{
            google_search: {}
        }];
    }

    return requestData;
}

/**
 * 构建Qwen VL请求数据
 */
async function buildQwenVLRequest(aiModel, systemMessage, chatMsg, msg, e, validatedParams) {
    let msgObj;
    let userMsg = msg;
    let images = [];
    let failedImages = [];
    try {
        msgObj = JSON.parse(msg);
        userMsg = msgObj.message || msg;
        if (Array.isArray(msgObj.images) && msgObj.images.length > 0) {
            for (const imgUrl of msgObj.images) {
                try {
                    const res = await fetch(imgUrl);
                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                    }
                    const arrayBuffer = await res.arrayBuffer();
                    const base64 = Buffer.from(arrayBuffer).toString('base64');
                    let mime = 'image/jpeg';
                    if (imgUrl.endsWith('.png')) mime = 'image/png';
                    if (imgUrl.endsWith('.webp')) mime = 'image/webp';
                    if (imgUrl.endsWith('.gif')) mime = 'image/gif';
                    images.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } });
                } catch (err) {
                    console.error(`[QwenVL] 图片下载失败: ${imgUrl}, 错误: ${err.message}`);
                    failedImages.push({ url: imgUrl, error: err.message });
                }
            }
        }
    } catch (err) {
        // msg 不是 JSON
    }

    // 如果有图片下载失败，通知用户
    if (failedImages.length > 0 && typeof e.reply === 'function') {
        const failedCount = failedImages.length;
        const totalCount = msgObj.images?.length || failedCount;
        const errorMsg = `【图片下载失败】共${totalCount}张图片，${failedCount}张下载失败，已提交${totalCount - failedCount}张给AI\n\n失败详情：\n${failedImages.map((item, index) => `${index + 1}. ${item.url}\n   原因：${item.error}`).join('\n\n')}`;
        await e.reply(errorMsg);
    }

    // 构建包含用户信息的完整消息
    let fullUserMsg = userMsg;
    if (msgObj.additional_info) {
        const userInfo = msgObj.additional_info;
        const userContext = `[用户信息: QQ号${userInfo.user_id}, 昵称${userInfo.name}, 好感度${userInfo.favor}${userInfo.group_id ? ', 群聊' + userInfo.group_id : ', 私聊'}]`;
        fullUserMsg = `${userContext}\n用户说: ${userMsg}`;
    }

    // 构建符合OpenAI标准的多模态消息格式
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

    return {
        model: aiModel,
        messages: [
            { role: 'system', content: JSON.stringify(systemMessage) },
            userMessage
        ],
        ...(validatedParams.temperature !== undefined && { temperature: validatedParams.temperature }),
        ...(validatedParams.top_p !== undefined && { top_p: validatedParams.top_p }),
        ...(validatedParams.max_tokens !== undefined && { max_tokens: validatedParams.max_tokens }),
        ...(validatedParams.presence_penalty !== undefined && { presence_penalty: validatedParams.presence_penalty }),
        ...(validatedParams.frequency_penalty !== undefined && { frequency_penalty: validatedParams.frequency_penalty })
    };
}

/**
 * 构建标准OpenAI格式请求数据
 */
async function buildStandardRequest(aiModel, systemMessage, chatMsg, msg, e, validatedParams, apiType) {
    let messages = [];

    // 添加 system 消息
    let systemPrompt = '';
    try {
        systemPrompt = typeof systemMessage === 'string' ? systemMessage : JSON.stringify(systemMessage);
    } catch {
        systemPrompt = '';
    }
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }

    // 添加历史消息
    if (Array.isArray(chatMsg)) {
        for (const item of chatMsg) {
            if (!item || !item.role || !item.content) continue;
            if (item.role === 'user' || item.role === 'assistant') {
                messages.push({ role: item.role, content: item.content });
            }
        }
    }

    // 添加当前用户消息
    let userMsg = msg;
    let userInfo = null;
    try {
        let msgObj = JSON.parse(msg);
        userMsg = msgObj.message || msg;
        userInfo = msgObj.additional_info || null;
    } catch (err) {
        // msg 不是 JSON，直接使用
    }

    // 构建包含用户信息的完整消息
    let fullUserMsg = userMsg;
    if (userInfo) {
        const userContext = `[用户信息: QQ号${userInfo.user_id}, 昵称${userInfo.name}, 好感度${userInfo.favor}${userInfo.group_id ? ', 群聊' + userInfo.group_id : ', 私聊'}]`;
        fullUserMsg = `${userContext}\n用户说: ${userMsg}`;
    }

    messages.push({ role: 'user', content: fullUserMsg });

    let requestData = {
        model: aiModel,
        messages: messages,
        ...(validatedParams.temperature !== undefined && { temperature: validatedParams.temperature }),
        ...(validatedParams.top_p !== undefined && { top_p: validatedParams.top_p }),
        ...(validatedParams.max_tokens !== undefined && { max_tokens: validatedParams.max_tokens }),
        ...(validatedParams.presence_penalty !== undefined && { presence_penalty: validatedParams.presence_penalty }),
        ...(validatedParams.frequency_penalty !== undefined && { frequency_penalty: validatedParams.frequency_penalty })
    };

    // 检查是否支持JSON格式输出
    const supportsJsonFormat = checkJsonFormatSupport(apiType, aiModel);
    if (supportsJsonFormat) {
        requestData.response_format = { type: 'json_object' };
    }

    return requestData;
}

/**
 * 处理HTTP错误
 */
function handleHttpErrors(response, apiType) {
    if (response.status === 401) {
        console.error('[openAi] API密钥无效，状态码401');
        throw new Error('API密钥无效，请检查 Key 配置');
    }
    if (response.status === 429) {
        console.error('[openAi] 请求过于频繁，状态码429');
        throw new Error('请求过于频繁，请稍后再试');
    }
    if (response.status === 403) {
        console.error('[openAi] 访问被拒绝，状态码403');
        if (apiType === 'gemini') {
            throw new Error('当前地区无法使用 Gemini API，请更换为支持的地区（如美国、日本等）或使用代理。');
        }
        throw new Error('访问被拒绝，请检查API配置');
    }
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
}

/**
 * 处理API响应
 */
async function handleApiResponse(responseData, apiType, msg, e, systemMessage, chatMsg, requestData) {
    if (apiType === 'tencent') {
        let rawContent = responseData.choices?.[0]?.message?.content?.trim() || '';
        await addMessage({ role: 'user', content: msg }, e);
        await addMessage({ role: 'assistant', content: rawContent }, e);
        return rawContent;
    }

    if (apiType === 'gemini') {
        // 检查 Gemini 响应是否有错误
        if (responseData.error) {
            console.error('[Gemini] API返回错误:', responseData.error);
            throw new Error(parseErrorMessage(responseData));
        }

        // 检查是否被安全过滤器阻止
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

        // 检查是否为空响应
        if (!rawContent || rawContent.trim() === '') {
            console.error('[Gemini] 返回空内容');
            throw new Error('AI返回了空内容，请稍后重试');
        }

        // 尝试解析 Gemini 返回的 JSON 格式内容
        const parseResult = parseJsonResponse(rawContent, 'Gemini');

        // 如果JSON解析失败，记录日志
        if (parseResult.parseError) {
            console.warn(`[Gemini] JSON解析遇到错误: ${parseResult.parseError}`);
        }

        // 如果成功解析出JSON内容，直接使用原始JSON字符串（保持JSON格式）
        // 如果解析失败，包装成JSON格式返回
        if (parseResult.isJson) {
            return rawContent;
        } else {
            return JSON.stringify({
                message: parseResult.content,
                favor_changes: []
            });
        }
    }

    // 其他API格式
    let rawContent = responseData.choices[0].message.content.trim();
    const content = await Config.Chat.ShowReasoning ? rawContent : rawContent.replace(/(（\u63a8\u7406\u8fc7\u7a0b[：:][\s\S]*?）|\u63a8\u7406\u8fc7\u7a0b[：:][\s\S]*?)(?=\n\u7ed3\u8bba|\u7b54\u6848|$)/gi, '');
    await addMessage({ role: 'user', content: msg }, e);
    await addMessage({ role: 'assistant', content }, e);
    return content;
}

/**
 * 处理通信错误
 */
async function handleCommunicationError(error, apiType) {
    console.error('[openAi] 与 AI 通信时发生错误:', error.message);

    // 详细分析错误类型并提供对应解决方案
    let errorType = '未知错误';
    let errorMessage = '与 AI 通信时发生错误，请稍后重试。';

    if (error.message.includes('API密钥无效') || error.message.includes('invalid_api_key') || error.message.includes('Unauthorized')) {
        errorType = 'API密钥错误';
        errorMessage = `【${apiType.toUpperCase()} API密钥无效】请检查配置文件中的API密钥是否正确`;
    } else if (error.message.includes('地区无法使用') || error.message.includes('User location is not supported')) {
        errorType = '地区限制';
        errorMessage = `【地区限制】当前地区无法访问${apiType.toUpperCase()} API，建议：1.使用VPN/代理 2.切换到其他API`;
    } else if (error.message.includes('请求过于频繁') || error.message.includes('rate_limit_exceeded')) {
        errorType = '频率限制';
        errorMessage = `【请求频繁】${apiType.toUpperCase()} API请求过于频繁，请稍后重试`;
    } else if (error.code === 'ENOTFOUND') {
        errorType = 'DNS解析失败';
        errorMessage = `【网络错误】无法解析${apiType.toUpperCase()} API域名，请检查：1.网络连接 2.DNS设置 3.API地址是否正确`;
    } else if (error.code === 'ECONNREFUSED') {
        errorType = '连接被拒绝';
        errorMessage = `【网络错误】连接${apiType.toUpperCase()} API被拒绝，请检查：1.网络连接 2.防火墙设置 3.代理配置`;
    } else if (error.code === 'ETIMEDOUT') {
        errorType = '连接超时';
        errorMessage = `【网络超时】连接${apiType.toUpperCase()} API超时，可能原因：1.网络较慢 2.服务器繁忙 3.需要代理`;
    } else if (error.code === 'ECONNRESET') {
        errorType = '连接重置';
        errorMessage = `【网络错误】与${apiType.toUpperCase()} API连接被重置，建议：1.检查网络稳定性 2.尝试使用代理`;
    } else if (error.message.includes('quota_exceeded') || error.message.includes('配额')) {
        errorType = 'API配额不足';
        errorMessage = `【配额用完】${apiType.toUpperCase()} API配额已用完，请：1.充值续费 2.等待配额重置 3.切换其他API`;
    } else if (error.message.includes('model') && error.message.includes('invalid')) {
        errorType = '模型无效';
        errorMessage = `【模型错误】${apiType.toUpperCase()} API不支持当前模型，请检查模型名称是否正确`;
    }

    // 输出详细错误信息到控制台
    console.error(`[错误分析] 类型: ${errorType}, API: ${apiType}, 错误: ${error.message}`);

    // 抛出详细错误
    const detailedError = new Error(errorMessage);
    detailedError.type = errorType;
    detailedError.apiType = apiType;
    throw detailedError;
}
