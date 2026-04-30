/**
 * 请求构建工具函数
 */

import { Config } from '../../../../components/index.js';
import { validateRequestParams, checkJsonFormatSupport } from '../../parsers.js';
import { ApiTypes, isToolCallingSupported } from '../../api-types.js';
import { getEnabledTools } from '../../tools/index.js';

/**
 * 获取有效的用户ID
 * @param {string|number} userId - 原始用户ID
 * @returns {Promise<string>} 处理后的有效用户ID
 */
export async function getValidUserId(userId) {
    if (userId === 'stdin' || !userId || isNaN(userId) || String(userId).length < 5) {
        const masterQQ = await Config.Chat.MasterQQ;
        return masterQQ || "10000";
    }
    return String(userId);
}

/**
 * 构建请求头
 * @param {string} apiType - API类型
 * @param {string} apiKey - API密钥
 * @returns {Object} 请求头对象
 */
export function buildHeaders(apiType, apiKey) {
    if (apiType === 'tencent') {
        return {
            'X-Source': 'openapi',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        };
    } else if (apiType === 'gemini') {
        return {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
        };
    } else {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        };
    }
}

/**
 * 获取默认请求参数
 * @param {string} apiType - API类型
 * @returns {Object} 默认参数
 */
export function getDefaultParams(apiType) {
    const defaultParams = {
        temperature: 0.7,
        top_p: 0.95,
        max_tokens: 2048
    };

    if (apiType === ApiTypes.OPENAI) {
        defaultParams.presence_penalty = 0.2;
        defaultParams.frequency_penalty = 0.3;
    }

    return defaultParams;
}

/**
 * 构建用户消息内容
 * @param {string} msg - 原始消息
 * @returns {Object} 包含 fullUserMsg 和 userInfo 的对象
 */
export function buildUserMessageContent(msg) {
    let userMsg = msg;
    let userInfo = null;
    try {
        let msgObj = JSON.parse(msg);
        userMsg = msgObj.message || msg;
        userInfo = msgObj.additional_info || null;
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

    return { fullUserMsg, userInfo };
}

/**
 * 添加工具调用配置
 * @param {Object} requestData - 请求数据
 * @param {string} apiType - API类型
 */
export function addToolCallingConfig(requestData, apiType) {
    if (isToolCallingSupported(apiType)) {
        requestData.tools = getEnabledTools();
        requestData.tool_choice = 'auto';
    }
}

/**
 * 添加JSON格式配置
 * @param {Object} requestData - 请求数据
 * @param {string} apiType - API类型
 * @param {string} aiModel - AI模型名称
 */
export function addJsonFormatConfig(requestData, apiType, aiModel) {
    const supportsJsonFormat = checkJsonFormatSupport(apiType, aiModel);
    const hasTools = isToolCallingSupported(apiType);

    if (supportsJsonFormat && !hasTools) {
        requestData.response_format = { type: 'json_object' };
    }
}

/**
 * 下载图片并转换为Base64
 * @param {string} imgUrl - 图片URL
 * @returns {Promise<Object>} 包含 base64 和 mime 的对象
 */
export async function downloadImageAsBase64(imgUrl) {
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
    return { base64, mime };
}
