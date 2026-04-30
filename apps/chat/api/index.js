/**
 * API模块索引
 * 导出openAi主函数
 */

import { Config } from '../../../components/index.js';
import { getCurrentApiConfig, getCurrentRoleIndex } from '../config.js';
import { validateRequestParams } from '../parsers/index.js';
import { ApiTypes, isValidApiType, isOpenAICompatibleType } from '../api-types.js';
import { buildHeaders, getDefaultParams } from './utils/requestUtils.js';
import { buildTencentRequest, buildGeminiRequest, buildQwenVLRequest, buildStandardRequest } from './builders/index.js';
import { handleApiResponse, handleCommunicationError } from './handlers/index.js';

/**
 * 规范化API类型
 * 将非标准API类型映射到标准类型
 * @param {string} apiType - 原始API类型
 * @returns {string} 规范化后的API类型
 */
function normalizeApiType(apiType) {
    if (isValidApiType(apiType)) {
        return apiType;
    }

    // 检查是否为OpenAI兼容类型
    if (isOpenAICompatibleType(apiType)) {
        return ApiTypes.OPENAI;
    }

    // 默认当作OpenAI兼容格式处理
    return ApiTypes.OPENAI;
}

/**
 * 调用 AI API 进行对话
 * @param {string} msg - 用户消息
 * @param {Object} e - 事件对象
 * @param {string} systemMessage - 系统消息
 * @param {Array} chatMsg - 聊天历史
 * @param {number} [recursionDepth=0] - 递归调用深度
 * @returns {Promise<Object>} 返回对象包含 { content: string, rawResponse: string }
 */
export async function openAi(msg, e, systemMessage, chatMsg, recursionDepth = 0) {
    const MAX_RECURSION_DEPTH = 15;

    if (recursionDepth > MAX_RECURSION_DEPTH) {
        console.error(`[openAi] 工具调用递归深度超过限制: ${recursionDepth} > ${MAX_RECURSION_DEPTH}`);
        return {
            content: JSON.stringify({
                message: '工具调用过于频繁，请稍后再试',
                favor_changes: []
            }),
            rawResponse: '{}'
        };
    }

    const { apiIndex, apiConfig } = await getCurrentApiConfig(e);

    const rawApiType = apiConfig.ApiType || 'openai';
    const apiType = normalizeApiType(rawApiType);
    const apiKey = apiConfig.ApiKey || '';
    const aiModel = apiConfig.ApiModel || 'gpt-3.5-turbo';
    const apiUrl = apiConfig.ApiUrl || '';
    const tencentAssistantId = apiConfig.TencentAssistantId || '';

    let roleRequestParams = {};
    try {
        const roleJson = Config.getJsonConfig('RoleProfile');
        const roles = JSON.parse(roleJson);
        const currentRoleIndex = await getCurrentRoleIndex(e);
        const currentRole = roles[currentRoleIndex] || {};
        roleRequestParams = currentRole['请求参数'] || {};
    } catch (error) {
        console.error('[openAi] 获取角色请求参数失败:', error.message);
    }

    const defaultParams = getDefaultParams(apiType);
    roleRequestParams = { ...defaultParams, ...roleRequestParams };

    const isQwenVL = (aiModel || '').toLowerCase().includes('qwen-vl') ||
        (aiModel || '').toLowerCase().includes('vl-72b') ||
        (aiModel || '').toLowerCase().includes('qwen2.5-vl');

    const enableThinking = await Config.Chat.EnableThinking;
    const isThinkingMode = enableThinking && (aiModel || '').toLowerCase().includes('deepseek');

    const { headers, requestData } = await buildRequestData(apiType, apiKey, aiModel, apiUrl, tencentAssistantId, systemMessage, chatMsg, msg, e, roleRequestParams, isQwenVL, isThinkingMode);

    let content;
    let rawResponse = '';
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestData),
        });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            console.error('[API错误] 状态码:', response.status, '错误详情:', errorBody);

            if (response.status === 401) {
                throw new Error('API密钥无效，请检查 Key 配置');
            }
            if (response.status === 429) {
                throw new Error('请求过于频繁，请稍后再试');
            }
            if (response.status === 403) {
                if (apiType === 'gemini') {
                    throw new Error('当前地区无法使用 Gemini API，请更换为支持的地区或使用代理');
                }
                throw new Error('访问被拒绝，请检查API配置');
            }
            if (response.status === 500 || response.status === 502 || response.status === 503) {
                throw new Error(`服务器错误 (${response.status})，请稍后重试`);
            }

            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorBody}`);
        }

        const responseData = await response.json();
        rawResponse = JSON.stringify(responseData, null, 2);

        content = await handleApiResponse(responseData, apiType, msg, e, systemMessage, chatMsg, requestData, recursionDepth, openAi);
    } catch (error) {
        content = await handleCommunicationError(error, apiType);
    }

    return { content, rawResponse };
}

/**
 * 构建请求数据
 */
async function buildRequestData(apiType, apiKey, aiModel, apiUrl, tencentAssistantId, systemMessage, chatMsg, msg, e, roleRequestParams, isQwenVL, isThinkingMode = false) {
    const headers = buildHeaders(apiType, apiKey);
    const validatedParams = validateRequestParams(roleRequestParams, apiType);

    let requestData;

    if (apiType === ApiTypes.TENCENT) {
        requestData = await buildTencentRequest(tencentAssistantId, systemMessage, chatMsg, msg, e, validatedParams);
    } else if (apiType === 'gemini') {
        requestData = await buildGeminiRequest(aiModel, apiUrl, systemMessage, chatMsg, msg, e, validatedParams);
    } else if (isQwenVL) {
        requestData = await buildQwenVLRequest(aiModel, systemMessage, chatMsg, msg, e, validatedParams, apiType);
    } else {
        requestData = await buildStandardRequest(aiModel, systemMessage, chatMsg, msg, e, validatedParams, apiType, isThinkingMode);
    }

    return { headers, requestData };
}

export default openAi;
