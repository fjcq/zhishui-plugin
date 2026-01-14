import { KeyvFile } from 'keyv-file';
import path from 'path';
import fs from 'fs';
import { Plugin_Path, Config } from '../../components/index.js';
import Data from '../../components/Data.js';
import { CHAT_CONTEXT_PATH } from './config.js';

/**
 * 获取会话Keyv实例
 * @param {string} sessionId - 会话ID
 * @returns {KeyvFile} Keyv实例
 */
export function getSessionKeyv(sessionId) {
    return new KeyvFile({
        filename: path.join(CHAT_CONTEXT_PATH, `${sessionId}.json`),
        writeDelay: 100,
        encode: JSON.stringify,
        decode: JSON.parse,
    });
}

/**
 * 加载聊天消息
 * @param {string} sessionId - 会话ID
 * @returns {Promise<Array>} 聊天消息数组
 */
export async function loadChatMsg(sessionId) {
    const keyv = getSessionKeyv(sessionId);
    const chatMsg = await keyv.get('chatMsg');
    return Array.isArray(chatMsg) ? chatMsg : [];
}

/**
 * 保存聊天消息
 * @param {string} sessionId - 会话ID
 * @param {Array} chatMsg - 聊天消息数组
 * @returns {Promise<void>}
 */
export async function saveChatMsg(sessionId, chatMsg) {
    const keyv = getSessionKeyv(sessionId);
    await keyv.set('chatMsg', chatMsg);
}

/**
 * 添加消息到聊天记录
 * @param {Object} msg - 消息对象
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function addMessage(msg, e) {
    const sessionId = e.group_id ? `group_${e.group_id}` : `user_${e.user_id}`;
    const chatMsg = await loadChatMsg(sessionId);
    chatMsg.push(msg);
    await saveChatMsg(sessionId, chatMsg);
}

/**
 * 清除会话上下文
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function clearSessionContext(e) {
    const sessionId = e.group_id ? `group_${e.group_id}` : `user_${e.user_id}`;
    const keyv = getSessionKeyv(sessionId);
    await keyv.delete('chatMsg');
}

/**
 * 获取当前会话应使用的角色索引
 * @param {object} e - 事件对象
 * @returns {number} 角色索引
 */
export async function getCurrentRoleIndex(e) {
    // 私聊：优先使用用户个人角色配置
    if (!e.group_id && e.user_id) {
        try {
            const userRoleIndex = await Config.GetUserChatConfig(e.user_id, 'RoleIndex');
            if (typeof userRoleIndex === 'number') {
                return userRoleIndex;
            }
        } catch (error) {
            logger.error('[getCurrentRoleIndex] 获取用户角色配置失败:', error);
        }
    }

    // 群聊：使用群专属角色配置
    const groupRoleList = (await Config.Chat.GroupRoleIndex) || [];
    const groupId = e && e.group_id ? String(e.group_id) : null;
    if (groupId && Array.isArray(groupRoleList)) {
        const found = groupRoleList.find(item => String(item.group) === groupId);
        if (found && typeof found.index === 'number') {
            return found.index;
        }
    }

    // 默认：使用全局角色配置
    const globalRoleIndex = await Config.Chat.RoleIndex;
    return typeof globalRoleIndex === 'number' ? globalRoleIndex : 0;
}

/**
 * 获取当前API配置
 * @param {Object} e - 事件对象
 * @returns {Object} API配置对象
 */
export async function getCurrentApiConfig(e) {
    const ApiList = await Config.Chat.ApiList || [];
    let apiIndex = typeof (await Config.Chat.CurrentApiIndex) === 'number'
        ? await Config.Chat.CurrentApiIndex
        : parseInt(await Config.Chat.CurrentApiIndex) || 0;

    // 群聊：使用群专属API配置
    if (e.group_id) {
        const groupRoleList = (await Config.Chat.GroupRoleIndex) || [];
        const found = groupRoleList.find(item => String(item.group) === String(e.group_id));
        if (found && typeof found.apiIndex === 'number') {
            apiIndex = found.apiIndex;
        }
    }

    const apiConfig = ApiList[apiIndex] || ApiList[0] || {};
    return { apiIndex, apiConfig };
}

/**
 * 转换聊天上下文以适应不同模型
 * @param {Array} chatMsg - 聊天消息数组
 * @param {string} oldType - 旧API类型
 * @param {string} newType - 新API类型
 * @param {string} oldModel - 旧模型名称
 * @param {string} newModel - 新模型名称
 * @returns {Object} 转换后的聊天上下文
 */
export function convertChatContextForModel(chatMsg, oldType, newType, oldModel, newModel) {
    // 这里可以实现聊天上下文转换逻辑
    // 目前返回原上下文，后续可以根据需要扩展
    return { converted: chatMsg, lostContent: false };
}

/**
 * 检查模型是否支持JSON格式输出
 * @param {string} apiType - API类型
 * @param {string} aiModel - 模型名称
 * @returns {boolean} 是否支持JSON格式输出
 */
export function checkJsonFormatSupport(apiType, aiModel) {
    const model = (aiModel || '').toLowerCase();

    // OpenAI API系列支持JSON格式的模型
    if (apiType === 'openai') {
        return model.includes('gpt-4') ||
            model.includes('gpt-3.5-turbo') ||
            model.includes('gpt-4o') ||
            model.includes('gpt-4-turbo');
    }

    // SiliconFlow等兼容OpenAI格式的API
    if (apiType === 'siliconflow' || apiType === 'deepseek' || apiType === 'zhipu') {
        return model.includes('gpt') ||
            model.includes('deepseek') ||
            model.includes('qwen') ||
            model.includes('glm') ||
            model.includes('yi-') ||
            model.includes('internlm');
    }

    // Gemini 原生不支持response_format，但支持JSON指令
    if (apiType === 'gemini') {
        return false; // Gemini通过系统指令处理JSON
    }

    // 腾讯元器等其他API
    if (apiType === 'tencent') {
        return false; // 腾讯元器通过系统指令处理JSON
    }

    return false;
}

/**
 * 组建 system 消息
 * @param {object} e - 用户对象，包含用户ID等信息
 * @returns {string} 返回组建完成的 system 消息
 */
export async function mergeSystemMessage(e) {
    let merged = {};
    try {
        const sceneJson = await ReadScene();
        const sceneSetting = JSON.parse(sceneJson);
        const roleJson = Config.getJsonConfig('RoleProfile');
        const roles = JSON.parse(roleJson);
        const currentRoleIndex = await getCurrentRoleIndex(e);
        // 深拷贝角色设定，避免污染原数据
        const identitySetting = JSON.parse(JSON.stringify(roles[currentRoleIndex] || {}));
        // 移除请求参数，防止污染上下文
        if ('请求参数' in identitySetting) {
            delete identitySetting['请求参数'];
        }
        // 合并所有设定
        merged = { ...identitySetting, ...sceneSetting };
    } catch (error) {
        console.error('配置解析失败:', error);
        // merged 保持空对象，后面统一兜底
    }

    // 检查当前API是否支持联网搜索，如果支持则添加搜索提示词
    try {
        const { apiIndex, apiConfig } = await getCurrentApiConfig(e);
        const apiType = apiConfig.ApiType || '';
        const aiModel = apiConfig.ApiModel || '';
        const apiUrl = apiConfig.ApiUrl || '';

        // 检查是否支持联网搜索
        let supportsSearch = false;
        if (apiType === 'gemini') {
            // Gemini 2.5 系列支持联网搜索
            supportsSearch = (aiModel || '').toLowerCase().includes('gemini-2.5') ||
                (apiUrl || '').includes('gemini-2.5');
        } else if (apiType === 'openai') {
            // OpenAI 的一些模型可能支持联网搜索（如果有相关工具配置）
            // 这里可以根据实际情况添加判断逻辑
            // supportsSearch = (aiModel || '').toLowerCase().includes('gpt-4');
        }
        // 未来可以根据需要扩展其他支持联网搜索的模型
        // else if (apiType === 'claude') {
        //     supportsSearch = true; // Claude 如果支持工具调用
        // }

        if (supportsSearch) {
            merged.联网搜索指引 = {
                搜索原则: "当用户询问实时信息、最新新闻、当前事件、实时数据等内容时，你应该自动进行网络搜索获取最新信息来回答用户的问题",
                搜索触发场景: [
                    "时间敏感信息：今天的新闻、最近发生的事件、当前时间、今天是什么日子",
                    "实时数据查询：股价、汇率、天气预报、体育比分、彩票开奖结果",
                    "最新发布内容：新电影上映、新游戏发布、新产品发布、最新版本更新",
                    "当前状态查询：网站运行状态、服务器状态、实时交通状况",
                    "热门话题讨论：当前热搜、流行趋势、病毒视频、网络梗",
                    "官方最新公告：政策更新、公司公告、活动通知"
                ],
                搜索关键词: [
                    "今天、现在、最新、最近、当前、实时",
                    "刚刚、刚才、目前、此刻、正在",
                    "2024年、2025年等当前年份",
                    "热门、流行、趋势、排行榜"
                ],
                回答要求: "基于搜索到的最新信息回答用户问题，确保信息的时效性和准确性。如果搜索到多个相关结果，可以进行综合分析。回答时可以适当提及信息来源的时间"
            };
        }
    } catch (error) {
        console.error('检查联网搜索支持时出错:', error);
        // 忽略错误，继续正常流程
    }

    // 无论是否异常，都补充基础身份、主人信息和用户信息
    const { NickName, Master, MasterQQ } = await Config.Chat;

    // 处理特殊用户 stdin，使用主人QQ号码
    let actualUserId = e.user_id;
    if (e.user_id === 'stdin') {
        actualUserId = MasterQQ || "172679743";
    }

    // 获取用户好感度
    const userFavor = await getUserFavor(actualUserId);
    merged.基础身份 = {
        ...(merged.基础身份 || {}),
        名称: NickName
    };
    merged.主人信息 = {
        master_name: Master,
        master_qq: MasterQQ
    };
    // 添加用户信息
    merged.用户信息 = {
        user_id: actualUserId,
        favor: userFavor
    };
    return merged;
}

/**
 * 调用OpenAI API
 * @param {string} msg - 用户消息
 * @param {Object} e - 事件对象
 * @param {string} systemMessage - 系统消息
 * @param {Array} chatMsg - 聊天历史
 * @returns {Promise<string>} AI回复
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

    // 5. 获取当前角色的请求参数
    let roleRequestParams = {};
    try {
        const roleJson = Config.getJsonConfig('RoleProfile');
        const roles = JSON.parse(roleJson);
        const currentRoleIndex = await getCurrentRoleIndex(e);
        const currentRole = roles[currentRoleIndex] || {};
        roleRequestParams = currentRole['请求参数'] || {};
    } catch (error) {
        console.log('[openAi] 获取角色请求参数失败:', error.message);
        // 使用默认参数
        roleRequestParams = {
            temperature: 0.7,
            top_p: 0.95,
            max_tokens: 2048,
            presence_penalty: 0.2,
            frequency_penalty: 0.3
        };
    }

    // 针对硅基流动Qwen/Qwen2.5-VL-72B-Instruct模型的特殊处理
    const isQwenVL = (aiModel || '').toLowerCase().includes('qwen') || (aiModel || '').toLowerCase().includes('vl-72b');

    // 1. 先构建 headers
    let headers;
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

    // 2. 构建请求参数（不含 messages）
    let requestData;
    if (apiType === 'tencent') {
        // 腾讯元器API - 根据官方文档构建请求参数
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
                // 确保交替对话格式
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
        try {
            let msgObj = JSON.parse(msg);
            userMsg = msgObj.message || msg;
        } catch (err) {
            // msg 不是 JSON，直接使用
        }

        // 如果是第一条消息，将完整的系统设定融入用户消息
        if (messages.length === 0 || messages[messages.length - 1].role !== 'assistant') {
            if (systemPrompt && messages.length === 0) {
                // 使用完整的系统设定，而不是简化版本
                userMsg = `${systemPrompt}\n\n用户：${userMsg}`;
            }
            messages.push({ role: 'user', content: userMsg });
        }

        // 确保消息数组不为空且格式正确
        if (messages.length === 0) {
            messages.push({ role: 'user', content: userMsg });
        }

        // 确定用户ID：处理特殊用户 stdin 和无效ID
        let userId = e.user_id;
        if (userId === 'stdin' || !userId || isNaN(userId) || String(userId).length < 5) {
            const masterQQ = await Config.Chat.MasterQQ;
            userId = masterQQ || "172679743";
        }

        requestData = {
            assistant_id: tencentAssistantId,
            user_id: String(userId),
            stream: false,
            messages: messages,
            // 应用角色请求参数（腾讯元器支持的参数）
            ...(roleRequestParams.temperature !== undefined && { temperature: roleRequestParams.temperature }),
            ...(roleRequestParams.top_p !== undefined && { top_p: roleRequestParams.top_p }),
            ...(roleRequestParams.max_tokens !== undefined && { max_tokens: roleRequestParams.max_tokens })
        };
    } else if (apiType === 'gemini') {
        // Gemini 不支持 system 角色，需要将系统消息合并到用户消息中
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
                // 跳过 system 角色的消息，Gemini 不支持
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

            // 构建包含用户信息的消息文本
            let fullUserMsg = userMsg;
            if (userInfo) {
                const userContext = `[用户信息: QQ号${userInfo.user_id}, 昵称${userInfo.name}, 好感度${userInfo.favor}${userInfo.group_id ? ', 群聊' + userInfo.group_id : ', 私聊'}]`;
                fullUserMsg = `${userContext}\n用户说: ${userMsg}`;
            }

            // 直接使用包含用户信息的消息，系统消息通过 systemInstruction 字段处理
            parts.push({ text: fullUserMsg });

            if (Array.isArray(msgObj.images) && msgObj.images.length > 0) {
                for (const imgUrl of msgObj.images) {
                    try {
                        const res = await fetch(imgUrl);
                        const arrayBuffer = await res.arrayBuffer();
                        const base64 = Buffer.from(arrayBuffer).toString('base64');
                        let mime = 'image/jpeg';
                        if (imgUrl.endsWith('.png')) mime = 'image/png';
                        if (imgUrl.endsWith('.webp')) mime = 'image/webp';
                        if (imgUrl.endsWith('.gif')) mime = 'image/gif';
                        parts.push({ inline_data: { data: base64, mime_type: mime } });
                    } catch (err) {
                        failedImages.push(imgUrl);
                    }
                }
            }
        } catch (err) {
            // 当消息不是JSON格式时，直接使用原始消息（这种情况不应该发生，因为外部已经构建了JSON）
            parts.push({ text: msg });
        }
        if (failedImages.length > 0 && typeof e.reply === 'function') {
            await e.reply(`部分图片下载失败，未提交给AI：\n` + failedImages.join('\n'));
        }
        contents.push({ role: 'user', parts });

        // 构建基础请求数据
        requestData = {
            contents,
            // 应用角色请求参数（Gemini支持的参数）
            generationConfig: {
                ...(roleRequestParams.temperature !== undefined && { temperature: roleRequestParams.temperature }),
                ...(roleRequestParams.top_p !== undefined && { topP: roleRequestParams.top_p }),
                ...(roleRequestParams.max_tokens !== undefined && { maxOutputTokens: roleRequestParams.max_tokens })
            }
        };

        // 使用 systemInstruction 字段来处理系统消息（Gemini 推荐方式）
        if (systemPrompt.trim()) {
            requestData.systemInstruction = {
                parts: [{ text: systemPrompt }]
            };
        }

        // Gemini 联网搜索功能
        const supportsGrounding = (aiModel || '').toLowerCase().includes('gemini-2.5') ||
            (apiUrl || '').includes('gemini-2.5');

        if (supportsGrounding) {
            // 添加 Google 搜索工具
            requestData.tools = [{
                google_search: {}
            }];
        }
    } else if (isQwenVL) {
        // Qwen/Qwen2.5-VL-72B-Instruct多模态支持
        let msgObj;
        let userMsg = msg;
        let images = [];
        try {
            msgObj = JSON.parse(msg);
            userMsg = msgObj.message || msg;
            if (Array.isArray(msgObj.images) && msgObj.images.length > 0) {
                for (const imgUrl of msgObj.images) {
                    try {
                        const res = await fetch(imgUrl);
                        const arrayBuffer = await res.arrayBuffer();
                        const base64 = Buffer.from(arrayBuffer).toString('base64');
                        let mime = 'image/jpeg';
                        if (imgUrl.endsWith('.png')) mime = 'image/png';
                        if (imgUrl.endsWith('.webp')) mime = 'image/webp';
                        if (imgUrl.endsWith('.gif')) mime = 'image/gif';
                        images.push({ type: 'image_url', image: { url: `data:${mime};base64,${base64}` } });
                    } catch (err) {
                        // 图片下载失败
                    }
                }
            }
        } catch (err) {
            // msg 不是 JSON
        }
        // Qwen多模态格式：messages支持插入图片对象
        requestData = {
            model: aiModel,
            messages: [
                { role: 'system', content: JSON.stringify(systemMessage) },
                ...(images.length > 0 ? [{ role: 'user', content: userMsg, images }] : [{ role: 'user', content: userMsg }])
            ],
            // 应用角色请求参数
            ...(roleRequestParams.temperature !== undefined && { temperature: roleRequestParams.temperature }),
            ...(roleRequestParams.top_p !== undefined && { top_p: roleRequestParams.top_p }),
            ...(roleRequestParams.max_tokens !== undefined && { max_tokens: roleRequestParams.max_tokens }),
            ...(roleRequestParams.presence_penalty !== undefined && { presence_penalty: roleRequestParams.presence_penalty }),
            ...(roleRequestParams.frequency_penalty !== undefined && { frequency_penalty: roleRequestParams.frequency_penalty })
        };
    } else {
        // 其他API（如OpenAI、SiliconFlow等）
        // 构建标准的 OpenAI 格式消息
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
        try {
            let msgObj = JSON.parse(msg);
            userMsg = msgObj.message || msg;
        } catch (err) {
            // msg 不是 JSON，直接使用
        }
        messages.push({ role: 'user', content: userMsg });

        requestData = {
            model: aiModel,
            messages: messages,
            // 应用角色请求参数
            ...(roleRequestParams.temperature !== undefined && { temperature: roleRequestParams.temperature }),
            ...(roleRequestParams.top_p !== undefined && { top_p: roleRequestParams.top_p }),
            ...(roleRequestParams.max_tokens !== undefined && { max_tokens: roleRequestParams.max_tokens }),
            ...(roleRequestParams.presence_penalty !== undefined && { presence_penalty: roleRequestParams.presence_penalty }),
            ...(roleRequestParams.frequency_penalty !== undefined && { frequency_penalty: roleRequestParams.frequency_penalty })
        };

        // 检查是否支持JSON格式输出
        const supportsJsonFormat = checkJsonFormatSupport(apiType, aiModel);
        if (supportsJsonFormat) {
            requestData.response_format = { type: 'json_object' };
            console.log('[openAi] 已启用JSON格式输出');
        }
    }

    // 输出请求参数调试信息
    if (apiType === 'tencent') {
        console.log('[openAi] 腾讯API请求地址:', apiUrl);
        console.log('[openAi] 腾讯API请求头:', headers);
        console.log('[openAi] 腾讯API请求数据:', JSON.stringify(requestData, null, 2));
    }

    let content;
    try {
        // 发送 POST 请求
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestData),
        });

        // 错误码处理
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
            let text = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(text);
            } catch {
                errorData = { error: { message: text, code: response.status } };
            }
            console.error('[openAi] 请求失败，响应内容:', errorData);
            throw new Error(parseErrorMessage(errorData));
        }

        // 解析响应
        try {
            const responseData = await response.json();
            if (apiType === 'tencent') {
                // 腾讯元器返回格式
                let rawContent = responseData.choices?.[0]?.message?.content?.trim() || '';
                content = rawContent;
                // 只有请求成功时，才将请求和回复加入缓存
                await addMessage({ role: 'user', content: msg }, e);
                await addMessage({ role: 'assistant', content }, e);
            } else if (apiType === 'gemini') {
                // Gemini 返回 candidates[0].content.parts[0].text
                let rawContent = '';

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
                let finalContent = rawContent;
                try {
                    // 如果返回的是 JSON 格式，尝试解析
                    const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/);
                    if (jsonMatch) {
                        // 提取 JSON 代码块中的内容
                        const jsonContent = JSON.parse(jsonMatch[1]);
                        if (jsonContent.message) {
                            finalContent = jsonContent.message;
                        }
                    } else if (rawContent.trim().startsWith('{') && rawContent.trim().endsWith('}')) {
                        // 直接是 JSON 格式
                        const jsonContent = JSON.parse(rawContent);
                        if (jsonContent.message) {
                            finalContent = jsonContent.message;
                        }
                    }
                } catch (parseError) {
                    // JSON 解析失败，使用原始内容
                    console.log('[Gemini] JSON解析失败，使用原始回复:', parseError.message);
                    finalContent = rawContent;
                }

                content = finalContent;
                await addMessage({ role: 'user', content: msg }, e);
                await addMessage({ role: 'assistant', content }, e);
            } else {
                // 其他API格式
                let rawContent = responseData.choices[0].message.content.trim();
                content = await Config.Chat.ShowReasoning ? rawContent : rawContent.replace(/(（\u63a8\u7406\u8fc7\u7a0b[：:][\s\S]*?）|\u63a8\u7406\u8fc7\u7a0b[：:][\s\S]*?)(?=\n\u7ed3\u8bba|\u7b54\u6848|$)/gi, '');
                await addMessage({ role: 'user', content: msg }, e);
                await addMessage({ role: 'assistant', content }, e);
            }
        } catch (parseError) {
            console.error('[openAi] 响应解析失败:', parseError);
            content = await response.text();
        }
    } catch (error) {
        console.error('[openAi] 与 AI 通信时发生错误:', error.message);

        // 详细分析错误类型并提供对应解决方案
        let errorType = '未知错误';
        let errorMessage = '与 AI 通信时发生错误，请稍后重试。';
        let shouldRetry = true;

        if (error.message.includes('API密钥无效') || error.message.includes('invalid_api_key') || error.message.includes('Unauthorized')) {
            errorType = 'API密钥错误';
            errorMessage = `【${apiType.toUpperCase()} API密钥无效】请检查配置文件中的API密钥是否正确`;
            shouldRetry = false;
        } else if (error.message.includes('地区无法使用') || error.message.includes('User location is not supported')) {
            errorType = '地区限制';
            errorMessage = `【地区限制】当前地区无法访问${apiType.toUpperCase()} API，建议：1.使用VPN/代理 2.切换到其他API`;
            shouldRetry = false;
        } else if (error.message.includes('请求过于频繁') || error.message.includes('rate_limit_exceeded')) {
            errorType = '频率限制';
            errorMessage = `【请求频繁】${apiType.toUpperCase()} API请求过于频繁，请稍后重试`;
            shouldRetry = true;
        } else if (error.code === 'ENOTFOUND') {
            errorType = 'DNS解析失败';
            errorMessage = `【网络错误】无法解析${apiType.toUpperCase()} API域名，请检查：1.网络连接 2.DNS设置 3.API地址是否正确`;
            shouldRetry = false;
        } else if (error.code === 'ECONNREFUSED') {
            errorType = '连接被拒绝';
            errorMessage = `【网络错误】连接${apiType.toUpperCase()} API被拒绝，请检查：1.网络连接 2.防火墙设置 3.代理配置`;
            shouldRetry = false;
        } else if (error.code === 'ETIMEDOUT') {
            errorType = '连接超时';
            errorMessage = `【网络超时】连接${apiType.toUpperCase()} API超时，可能原因：1.网络较慢 2.服务器繁忙 3.需要代理`;
            shouldRetry = true;
        } else if (error.code === 'ECONNRESET') {
            errorType = '连接重置';
            errorMessage = `【网络错误】与${apiType.toUpperCase()} API连接被重置，建议：1.检查网络稳定性 2.尝试使用代理`;
            shouldRetry = true;
        } else if (error.message.includes('quota_exceeded') || error.message.includes('配额')) {
            errorType = 'API配额不足';
            errorMessage = `【配额用完】${apiType.toUpperCase()} API配额已用完，请：1.充值续费 2.等待配额重置 3.切换其他API`;
            shouldRetry = false;
        } else if (error.message.includes('model') && error.message.includes('invalid')) {
            errorType = '模型无效';
            errorMessage = `【模型错误】${apiType.toUpperCase()} API不支持当前模型，请检查模型名称是否正确`;
            shouldRetry = false;
        }

        // 输出详细错误信息到控制台
        console.error(`[错误分析] 类型: ${errorType}, API: ${apiType}, 错误: ${error.message}`);

        // 根据错误类型决定是否抛出异常
        const detailedError = new Error(errorMessage);
        detailedError.type = errorType;
        detailedError.shouldRetry = shouldRetry;
        detailedError.apiType = apiType;
        throw detailedError;
    }

    return content;
}

/**
 * 读场景设定
 */
export async function ReadScene() {
    return Config.getJsonConfig('SystemConfig');
}

/**
 * 写场景设定
 */
export async function WriteScene(Context) {
    return Config.setJsonConfig('SystemConfig', Context);
}

/**
 * 写主人设定
 */
export async function WriteMaster(Master, MasterQQ) {
    Config.modify('chat', 'Master', Master);
    Config.modify('chat', 'MasterQQ', MasterQQ);
}

/**
 * 获取好感度
 */
export async function getUserFavor(userId) {
    let user = {};
    const dataPath = path.join(Plugin_Path, 'resources', 'data', 'user');
    const fileName = `${userId}.json`;
    if (fs.existsSync(path.join(dataPath, fileName))) {
        user = await Data.readJSON(fileName, dataPath);
    }
    return parseInt(user.favor) || 0;
}

/**
 * 设置好感度
 */
export async function setUserFavor(userId, favor = 0) {
    const dataPath = path.join(Plugin_Path, 'resources', 'data', 'user');
    const fileName = `${userId}.json`;
    let user = {};
    if (fs.existsSync(path.join(dataPath, fileName))) {
        user = await Data.readJSON(fileName, dataPath);
    }
    user.favor = parseInt(favor) || 0;
    return Data.writeJSON(fileName, user, dataPath);
}

/**
 * 将OpenAI错误消息转换为简洁易懂的中文描述。
 * @param {Object} errorData - 包含错误信息的对象。
 * @returns {string} 转换后的中文描述。
 */
function parseErrorMessage(errorData) {
    // 兼容 code/message 格式（如 deepseek）
    if (errorData && typeof errorData === 'object') {
        if (typeof errorData.message === 'string' && errorData.message) {
            // Gemini 地区限制友好提示
            if (errorData.message.includes('User location is not supported for the API use')) {
                return '当前地区无法使用 Gemini API，请更换为支持的地区（如美国、日本等）或使用代理。';
            }
            return errorData.message;
        }
        if (typeof errorData.error === 'object' && errorData.error && typeof errorData.error.message === 'string') {
            // Gemini 地区限制友好提示
            if (errorData.error.message.includes('User location is not supported for the API use')) {
                return '当前地区无法使用 Gemini API，请更换为支持的地区（如美国、日本等）或使用代理。';
            }
            // OpenAI 风格
            const errorMessage = errorData.error.message;
            const errorCode = errorData.error.code;
            let response;
            switch (errorCode) {
                case "account_deactivated":
                    response = "您的OpenAI账户已被停用。";
                    break;
                case "invalid_request_error":
                    response = "请求无效：" + errorMessage + "，请检查您的请求参数。";
                    break;
                case "rate_limit_exceeded":
                    response = "请求频率过高，请稍后重试。";
                    break;
                case "quota_exceeded":
                    response = "您已超出当前配额，请检查您的计划和账单详情。";
                    break;
                case "invalid_api_key":
                    response = "API密钥无效，请检查您的API密钥是否正确。";
                    break;
                case "invalid_model":
                    response = "指定的模型无效，请检查模型名称是否正确。";
                    break;
                case "invalid_parameter":
                    response = "请求参数无效：" + errorMessage + "，请检查您的参数设置。";
                    break;
                case "missing_parameter":
                    response = "缺少必要参数：" + errorMessage + "，请补充缺失的参数。";
                    break;
                case "service_unavailable":
                    response = "服务暂时不可用，请稍后再试。";
                    break;
                case "internal_server_error":
                    response = "服务器内部错误：" + errorMessage + "，请稍后再试或联系支持人员。";
                    break;
                case "content_too_long":
                    response = "内容过长，请缩短输入内容。";
                    break;
                case "context_error":
                    response = "上下文错误：" + errorMessage + "，请检查您的上下文设置。";
                    break;
                default:
                    response = "出现了一个问题：" + errorMessage + "，请稍后再试或联系支持人员。";
            }
            if (response.length > 100) {
                response = "出现了一个问题：" + errorMessage.substring(0, 80) + "...，请稍后再试或联系支持人员。";
            }
            return response;
        }
    }
    // 兜底
    return '与 AI 通信时发生错误，请稍后重试。';
}
