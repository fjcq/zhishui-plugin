/**
 * JSON解析模块
 * 处理AI返回的JSON格式内容解析
 */

import { ApiTypes, ApiTypeSupportedParams } from '../api-types.js';

/**
 * 检查模型是否支持JSON格式输出
 * @param {string} apiType - API类型
 * @param {string} aiModel - 模型名称
 * @returns {boolean} 是否支持JSON格式输出
 */
export function checkJsonFormatSupport(apiType, aiModel) {
    const model = (aiModel || '').toLowerCase();

    if (apiType === ApiTypes.OPENAI) {
        return model.includes('gpt-4') ||
            model.includes('gpt-3.5-turbo') ||
            model.includes('gpt-4o') ||
            model.includes('gpt-4-turbo') ||
            model.includes('deepseek') ||
            model.includes('qwen') ||
            model.includes('glm') ||
            model.includes('yi-') ||
            model.includes('internlm');
    }

    if (apiType === ApiTypes.GEMINI) {
        return true;
    }

    if (apiType === ApiTypes.TENCENT) {
        return false;
    }

    return false;
}

/**
 * 验证并修正请求参数
 * @param {Object} params - 原始参数
 * @param {string} apiType - API类型
 * @returns {Object} 验证后的参数
 */
export function validateRequestParams(params, apiType) {
    const validated = { ...params };

    if (validated.temperature !== undefined) {
        validated.temperature = Math.max(0, Math.min(2, validated.temperature));
    }

    if (validated.top_p !== undefined) {
        validated.top_p = Math.max(0, Math.min(1, validated.top_p));
    }

    if (validated.max_tokens !== undefined) {
        validated.max_tokens = Math.max(1, validated.max_tokens);
    }

    if (validated.presence_penalty !== undefined) {
        validated.presence_penalty = Math.max(-2, Math.min(2, validated.presence_penalty));
    }

    if (validated.frequency_penalty !== undefined) {
        validated.frequency_penalty = Math.max(-2, Math.min(2, validated.frequency_penalty));
    }

    const supportedParams = ApiTypeSupportedParams[apiType] || [];
    const allParams = ['temperature', 'top_p', 'max_tokens', 'presence_penalty', 'frequency_penalty', 'response_format', 'response_mime_type', 'systemInstruction', 'tools'];

    for (const param of allParams) {
        if (!supportedParams.includes(param) && validated[param] !== undefined) {
            delete validated[param];
        }
    }

    return validated;
}

/**
 * 解码JSON字符串中的转义字符
 * @param {string} str - 需要解码的字符串
 * @returns {string} 解码后的字符串
 */
function decodeJsonString(str) {
    if (!str || typeof str !== 'string') {
        return str;
    }
    try {
        return str
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\r/g, '\r')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
    } catch {
        return str;
    }
}

/**
 * 从畸形JSON中提取文本内容
 * @param {string} malformedJson - 畸形的JSON字符串
 * @returns {string|null} 提取的文本内容
 */
function extractTextFromMalformedJson(malformedJson) {
    if (!malformedJson || typeof malformedJson !== 'string') {
        return null;
    }

    const contentPatterns = [
        /"content"\s*:\s*"((?:[^"\\]|\\.)*)"/,
        /"message"\s*:\s*"((?:[^"\\]|\\.)*)"/,
        /"text"\s*:\s*"((?:[^"\\]|\\.)*)"/,
        /"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/,
        /"answer"\s*:\s*"((?:[^"\\]|\\.)*)"/,
        /"response"\s*:\s*"((?:[^"\\]|\\.)*)"/
    ];

    for (const pattern of contentPatterns) {
        const match = malformedJson.match(pattern);
        if (match && match[1] && match[1].length > 5) {
            return decodeJsonString(match[1]);
        }
    }

    const stringPattern = /"([^"]{10,})"/g;
    let longestMatch = null;
    let currentMatch;
    while ((currentMatch = stringPattern.exec(malformedJson)) !== null) {
        if (!longestMatch || currentMatch[1].length > longestMatch.length) {
            if (!/^[a-z_]+$/i.test(currentMatch[1])) {
                longestMatch = currentMatch[1];
            }
        }
    }

    if (longestMatch) {
        return decodeJsonString(longestMatch);
    }

    return null;
}

/**
 * 解析AI返回的JSON格式内容
 * @param {string} rawContent - AI返回的原始内容
 * @param {string} apiType - API类型
 * @returns {Object} 返回解析后的内容对象
 */
export function parseJsonResponse(rawContent, apiType) {
    const result = {
        content: rawContent,
        isJson: false,
        parseError: null
    };

    if (!rawContent || typeof rawContent !== 'string') {
        return result;
    }

    const trimmedContent = rawContent.trim();

    const parseStrategies = [
        {
            name: 'Markdown JSON代码块',
            test: (content) => /```json\s*[\s\S]*?\s*```/.test(content),
            extract: (content) => {
                const match = content.match(/```json\s*([\s\S]*?)\s*```/);
                return match ? match[1].trim() : null;
            }
        },
        {
            name: 'Markdown代码块（无语言标记）',
            test: (content) => /```\s*[\s\S]*?\s*```/.test(content),
            extract: (content) => {
                const match = content.match(/```\s*([\s\S]*?)\s*```/);
                return match ? match[1].trim() : null;
            }
        },
        {
            name: '纯JSON对象（智能提取）',
            test: (content) => content.startsWith('{'),
            extract: (content) => {
                let braceCount = 0;
                let inString = false;
                let escapeNext = false;
                let endIndex = -1;

                for (let i = 0; i < content.length; i++) {
                    const char = content[i];

                    if (escapeNext) {
                        escapeNext = false;
                        continue;
                    }

                    if (char === '\\') {
                        escapeNext = true;
                        continue;
                    }

                    if (char === '"') {
                        inString = !inString;
                        continue;
                    }

                    if (!inString) {
                        if (char === '{') {
                            braceCount++;
                        } else if (char === '}') {
                            braceCount--;
                            if (braceCount === 0) {
                                endIndex = i + 1;
                                break;
                            }
                        }
                    }
                }

                if (endIndex > 0) {
                    return content.substring(0, endIndex);
                }
                return content;
            }
        },
        {
            name: 'JSON数组',
            test: (content) => content.startsWith('['),
            extract: (content) => {
                let bracketCount = 0;
                let inString = false;
                let escapeNext = false;
                let endIndex = -1;

                for (let i = 0; i < content.length; i++) {
                    const char = content[i];

                    if (escapeNext) {
                        escapeNext = false;
                        continue;
                    }

                    if (char === '\\') {
                        escapeNext = true;
                        continue;
                    }

                    if (char === '"') {
                        inString = !inString;
                        continue;
                    }

                    if (!inString) {
                        if (char === '[') {
                            bracketCount++;
                        } else if (char === ']') {
                            bracketCount--;
                            if (bracketCount === 0) {
                                endIndex = i + 1;
                                break;
                            }
                        }
                    }
                }

                if (endIndex > 0) {
                    return content.substring(0, endIndex);
                }
                return content;
            }
        },
        {
            name: '嵌套在文本中的JSON',
            test: (content) => /{[\s\S]*"message"[\s\S]*}/.test(content),
            extract: (content) => {
                const match = content.match(/({[\s\S]*"message"[\s\S]*})/);
                return match ? match[1] : null;
            }
        }
    ];

    for (const strategy of parseStrategies) {
        try {
            if (strategy.test(trimmedContent)) {
                const jsonStr = strategy.extract(trimmedContent);
                if (jsonStr) {
                    const parsed = JSON.parse(jsonStr);

                    if (parsed && typeof parsed === 'object' && 'message' in parsed) {
                        result.content = parsed.message;
                        result.isJson = true;
                        return result;
                    }

                    const commonFields = ['content', 'text', 'reply', 'answer', 'response'];
                    for (const field of commonFields) {
                        if (parsed && typeof parsed === 'object' && field in parsed) {
                            result.content = parsed[field];
                            result.isJson = true;
                            return result;
                        }
                    }

                    if (typeof parsed === 'string') {
                        result.content = parsed;
                        result.isJson = true;
                        return result;
                    }
                }
            }
        } catch (parseError) {
            result.parseError = parseError.message;
        }
    }

    if (trimmedContent.startsWith('{') || trimmedContent.startsWith('[')) {
        const extractedText = extractTextFromMalformedJson(trimmedContent);
        if (extractedText && extractedText.length > 0) {
            result.content = extractedText;
            result.isJson = false;
            result.parseError = 'JSON格式错误，已提取文本内容';
            return result;
        }
    }

    return result;
}

/**
 * 将OpenAI错误消息转换为简洁易懂的中文描述
 * @param {Object} errorData - 包含错误信息的对象
 * @returns {string} 转换后的中文描述
 */
export function parseErrorMessage(errorData) {
    if (errorData && typeof errorData === 'object') {
        if (typeof errorData.message === 'string' && errorData.message) {
            if (errorData.message.includes('User location is not supported for the API use')) {
                return '当前地区无法使用 Gemini API，请更换为支持的地区（如美国、日本等）或使用代理。';
            }
            return errorData.message;
        }
        if (typeof errorData.error === 'object' && errorData.error && typeof errorData.error.message === 'string') {
            if (errorData.error.message.includes('User location is not supported for the API use')) {
                return '当前地区无法使用 Gemini API，请更换为支持的地区（如美国、日本等）或使用代理。';
            }
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
    return '与 AI 通信时发生错误，请稍后重试。';
}
