import { ApiTypes, ApiTypeSupportedParams } from './api-types.js';

/**
 * 检查模型是否支持JSON格式输出
 * @param {string} apiType - API类型
 * @param {string} aiModel - 模型名称
 * @returns {boolean} 是否支持JSON格式输出
 */
export function checkJsonFormatSupport(apiType, aiModel) {
    const model = (aiModel || '').toLowerCase();

    // OpenAI API系列支持JSON格式的模型
    if (apiType === ApiTypes.OPENAI) {
        return model.includes('gpt-4') ||
            model.includes('gpt-3.5-turbo') ||
            model.includes('gpt-4o') ||
            model.includes('gpt-4-turbo');
    }

    // SiliconFlow等兼容OpenAI格式的API
    if (apiType === ApiTypes.SILICONFLOW || apiType === ApiTypes.DEEPSEEK || apiType === ApiTypes.ZHIPU) {
        return model.includes('gpt') ||
            model.includes('deepseek') ||
            model.includes('qwen') ||
            model.includes('glm') ||
            model.includes('yi-') ||
            model.includes('internlm');
    }

    // Gemini 支持 response_mime_type 参数来请求 JSON 格式响应
    if (apiType === ApiTypes.GEMINI) {
        return true;
    }

    // 腾讯元器等其他API
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

    // temperature 验证：范围 [0, 2]
    if (validated.temperature !== undefined) {
        validated.temperature = Math.max(0, Math.min(2, validated.temperature));
    }

    // top_p 验证：范围 [0, 1]
    if (validated.top_p !== undefined) {
        validated.top_p = Math.max(0, Math.min(1, validated.top_p));
    }

    // max_tokens 验证：最小值 1
    if (validated.max_tokens !== undefined) {
        validated.max_tokens = Math.max(1, validated.max_tokens);
    }

    // presence_penalty 和 frequency_penalty 验证：范围 [-2, 2]
    if (validated.presence_penalty !== undefined) {
        validated.presence_penalty = Math.max(-2, Math.min(2, validated.presence_penalty));
    }

    if (validated.frequency_penalty !== undefined) {
        validated.frequency_penalty = Math.max(-2, Math.min(2, validated.frequency_penalty));
    }

    // 根据API类型过滤不支持的参数
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
 * 解析AI返回的JSON格式内容
 * @param {string} rawContent - AI返回的原始内容
 * @param {string} apiType - API类型
 * @returns {Object} 返回解析后的内容对象 { content: string, isJson: boolean, parseError: string|null }
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

    // 尝试多种JSON格式解析
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
                // 智能提取完整的JSON对象，处理末尾多余字符
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
                // 智能提取完整的JSON数组
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

    // 按顺序尝试各种解析策略
    for (const strategy of parseStrategies) {
        try {
            if (strategy.test(trimmedContent)) {
                const jsonStr = strategy.extract(trimmedContent);
                if (jsonStr) {
                    const parsed = JSON.parse(jsonStr);

                    // 检查是否包含message字段
                    if (parsed && typeof parsed === 'object' && 'message' in parsed) {
                        console.log(`[${apiType}] JSON解析成功，使用策略: ${strategy.name}`);
                        result.content = parsed.message;
                        result.isJson = true;
                        return result;
                    }

                    // 如果没有message字段，检查是否有其他常用字段
                    const commonFields = ['content', 'text', 'reply', 'answer', 'response'];
                    for (const field of commonFields) {
                        if (parsed && typeof parsed === 'object' && field in parsed) {
                            console.log(`[${apiType}] JSON解析成功，使用策略: ${strategy.name}，字段: ${field}`);
                            result.content = parsed[field];
                            result.isJson = true;
                            return result;
                        }
                    }

                    // 如果JSON对象本身是字符串，直接使用
                    if (typeof parsed === 'string') {
                        console.log(`[${apiType}] JSON解析成功，使用策略: ${strategy.name}，直接字符串`);
                        result.content = parsed;
                        result.isJson = true;
                        return result;
                    }
                }
            }
        } catch (parseError) {
            console.log(`[${apiType}] JSON解析策略"${strategy.name}"失败: ${parseError.message}`);
            result.parseError = parseError.message;
        }
    }

    // 所有策略都失败，使用原始内容
    console.log(`[${apiType}] 所有JSON解析策略失败，使用原始内容`);
    return result;
}

/**
 * 将OpenAI错误消息转换为简洁易懂的中文描述。
 * @param {Object} errorData - 包含错误信息的对象。
 * @returns {string} 转换后的中文描述。
 */
export function parseErrorMessage(errorData) {
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

/**
 * 转换聊天上下文格式以适应不同模型
 * @param {Array} chatMsg - 聊天消息数组
 * @param {string} oldType - 旧API类型
 * @param {string} newType - 新API类型
 * @param {string} oldModel - 旧模型名称
 * @param {string} newModel - 新模型名称
 * @returns {Array} 转换后的聊天消息数组
 */
export function convertChatContextForModel(chatMsg, oldType, newType, oldModel, newModel) {
    if (!Array.isArray(chatMsg) || chatMsg.length === 0) {
        return chatMsg;
    }

    // 如果API类型相同，直接返回
    if (oldType === newType) {
        return chatMsg;
    }

    // 腾讯元器不支持system角色，需要转换
    if (newType === 'tencent') {
        const converted = [];
        for (const msg of chatMsg) {
            if (msg.role === 'system') {
                // 跳过system消息，会在请求时处理
                continue;
            }
            if (msg.role === 'user' || msg.role === 'assistant') {
                converted.push(msg);
            }
        }
        return converted;
    }

    // Gemini不支持system角色，需要转换
    if (newType === 'gemini') {
        const converted = [];
        for (const msg of chatMsg) {
            if (msg.role === 'system') {
                // 跳过system消息，会在请求时通过systemInstruction处理
                continue;
            }
            if (msg.role === 'user') {
                converted.push({ role: 'user', parts: [{ text: msg.content }] });
            } else if (msg.role === 'assistant') {
                converted.push({ role: 'model', parts: [{ text: msg.content }] });
            }
        }
        return converted;
    }

    // 其他情况直接返回
    return chatMsg;
}
