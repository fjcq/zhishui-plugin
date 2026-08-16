/**
 * 视觉代理模块
 * 主对话模型无视觉能力时，图片识别委托给独立配置的视觉模型：
 * 用户可通过 Chat.VisionApiIndex 指定（对应 ApiList 下标），
 * 未指定（-1）时自动按 ApiList 顺序选择第一个已配置且带视觉能力的模型
 */

import { Config, logger } from '../../../components/index.js';
import { buildHeaders } from './utils/requestUtils.js';

/** 视觉识别请求超时时间（毫秒） */
const VISION_TIMEOUT_MS = 60000;

/** 已知具备视觉能力的模型名关键词（小写子串匹配） */
const VISION_MODEL_KEYWORDS = [
    'vl', 'vision', 'gpt-4o', 'gpt-4.1', 'gpt-4-turbo', 'o4-mini',
    'gemini', 'claude', 'glm-4v', 'glm-4.5v', 'glm-4.6v',
    'internvl', 'llava', 'pixtral', 'step-1v', 'yi-vision', 'doubao-vision'
];

/**
 * 判断 API 配置是否为已配置可用的视觉模型
 * 密钥为空或仍是默认模板占位符（"你的xxx API Key"）视为未配置
 * @param {object} apiConfig - ApiList 条目
 * @returns {boolean} 是否可用视觉模型
 */
export function hasVisionCapability(apiConfig) {
    if (!apiConfig || !apiConfig.ApiUrl || !apiConfig.ApiModel) {
        return false;
    }
    const apiKey = String(apiConfig.ApiKey || '');
    if (!apiKey || apiKey.includes('你的')) {
        return false;
    }
    const apiType = String(apiConfig.ApiType || 'openai').toLowerCase();
    if (apiType === 'gemini') {
        return true;
    }
    if (apiType === 'tencent') {
        return false;
    }
    const model = String(apiConfig.ApiModel).toLowerCase();
    return VISION_MODEL_KEYWORDS.some(kw => model.includes(kw));
}

/**
 * 解析视觉模型 API 配置
 * VisionApiIndex >= 0 时强制使用指定条目（无效则回退自动选择并告警）；
 * 否则按 ApiList 顺序扫描第一个带视觉能力的已配置模型
 * @returns {Promise<{apiIndex: number, apiConfig: object}|null>} 解析结果，无可用视觉模型时返回 null
 */
export async function resolveVisionApiConfig() {
    const ApiList = await Config.Chat.ApiList || [];
    const rawIndex = await Config.Chat.VisionApiIndex;
    const visionIndex = Number(rawIndex);

    if (Number.isInteger(visionIndex) && visionIndex >= 0) {
        const apiConfig = ApiList[visionIndex];
        const apiKey = String(apiConfig?.ApiKey || '');
        if (apiConfig?.ApiUrl && apiKey && !apiKey.includes('你的')) {
            return { apiIndex: visionIndex, apiConfig };
        }
        logger.warn(`[视觉代理] VisionApiIndex=${visionIndex} 指向的API未配置或密钥为空，回退自动选择`);
    }

    for (let i = 0; i < ApiList.length; i++) {
        if (hasVisionCapability(ApiList[i])) {
            return { apiIndex: i, apiConfig: ApiList[i] };
        }
    }
    return null;
}

/**
 * 调用视觉模型识别图片
 * @param {object} options - 参数对象
 * @param {string} options.base64 - 图片 base64 数据
 * @param {string} options.mime - 图片 MIME 类型（如 image/jpeg）
 * @param {string} [options.prompt] - 识别指令（默认通用描述）
 * @returns {Promise<{success: boolean, description?: string, error?: string}>} 识别结果
 */
export async function analyzeImage({ base64, mime, prompt }) {
    const vision = await resolveVisionApiConfig();
    if (!vision) {
        return { success: false, error: '没有配置带视觉能力的模型，请在 ApiList 中配置或设置 VisionApiIndex' };
    }

    const { apiConfig } = vision;
    const apiType = String(apiConfig.ApiType || 'openai').toLowerCase();
    const question = prompt || '请详细描述这张图片的内容，包括主体、场景、文字信息等。';
    const headers = buildHeaders(apiType, apiConfig.ApiKey);

    let body;
    if (apiType === 'gemini') {
        body = {
            contents: [{
                parts: [
                    { inline_data: { data: base64, mime_type: mime } },
                    { text: question }
                ]
            }]
        };
    } else {
        body = {
            model: apiConfig.ApiModel,
            messages: [{
                role: 'user',
                content: [
                    { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
                    { type: 'text', text: question }
                ]
            }],
            max_tokens: 1024
        };
    }

    try {
        const res = await fetch(apiConfig.ApiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(VISION_TIMEOUT_MS)
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            logger.error(`[视觉代理] 识别请求失败: HTTP ${res.status} ${errText.substring(0, 200)}`);
            return { success: false, error: `视觉模型请求失败: HTTP ${res.status}` };
        }

        const data = await res.json();
        const description = extractVisionText(data, apiType);
        if (!description) {
            return { success: false, error: '视觉模型未返回有效内容' };
        }
        return { success: true, description };
    } catch (err) {
        logger.error(`[视觉代理] 识别请求异常: ${err.message}`);
        return { success: false, error: `视觉模型请求异常: ${err.message}` };
    }
}

/**
 * 从视觉模型响应中提取文本
 * @param {object} data - 响应 JSON
 * @param {string} apiType - API类型
 * @returns {string} 提取的文本，无内容时返回空字符串
 */
function extractVisionText(data, apiType) {
    if (apiType === 'gemini') {
        const parts = data?.candidates?.[0]?.content?.parts || [];
        return parts.map(p => p?.text || '').filter(Boolean).join('\n').trim();
    }
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string') {
        return content.trim();
    }
    if (Array.isArray(content)) {
        return content.map(item => item?.text || '').filter(Boolean).join('\n').trim();
    }
    return '';
}
