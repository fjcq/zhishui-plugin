/**
 * JSON解析模块
 * 处理AI返回的JSON格式内容解析
 */

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

