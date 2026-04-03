/**
 * 代码输出工具处理函数
 * 处理AI调用的代码输出相关工具
 */

import { getSegment } from './musicCore.js';

const logger = global.logger || console;

/**
 * 语言映射表（用于语法高亮标识）
 */
const LANGUAGE_ALIASES = {
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'c#': 'csharp',
    'c++': 'cpp',
    '易语言': 'e',
    'e': 'e',
    'shell': 'bash',
    'yml': 'yaml',
    'md': 'markdown'
};

/**
 * 处理代码输出工具调用
 * @param {string} toolName - 工具名称
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象
 * @returns {Promise<object>} 工具执行结果
 */
export async function handleCodeToolCall(toolName, params, e) {
    try {
        switch (toolName) {
            case 'output_code':
                return await handleOutputCode(params, e);
            default:
                return { error: true, error_message: `未知的代码输出工具: ${toolName}` };
        }
    } catch (error) {
        logger.error(`[代码输出] ${toolName} 执行失败: ${error.message}`);
        return { error: true, error_message: `代码输出失败: ${error.message}` };
    }
}

/**
 * 处理代码输出
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象
 * @returns {Promise<object>} 工具执行结果
 */
async function handleOutputCode(params, e) {
    const { code, language, description = '', filename = '' } = params;

    if (!code) {
        return { error: true, error_message: '缺少代码内容参数' };
    }

    if (!language) {
        return { error: true, error_message: '缺少编程语言参数' };
    }

    const normalizedLanguage = normalizeLanguage(language);

    const formattedCode = formatCodeBlock(code, normalizedLanguage, description, filename);

    if (e && typeof e.reply === 'function') {
        try {
            await e.reply(formattedCode);
            logger.info(`[代码输出] 语言:${normalizedLanguage} | 描述:${description.substring(0, 30)}...`);

            return {
                success: true,
                language: normalizedLanguage,
                description: description,
                filename: filename,
                code_length: code.length
            };
        } catch (error) {
            logger.error(`[代码输出] 发送失败: ${error.message}`);
            return { error: true, error_message: `代码发送失败: ${error.message}` };
        }
    }

    return {
        success: true,
        formatted_code: formattedCode,
        language: normalizedLanguage,
        description: description,
        filename: filename
    };
}

/**
 * 标准化语言名称
 * @param {string} language - 原始语言名称
 * @returns {string} 标准化后的语言名称
 */
function normalizeLanguage(language) {
    const lowerLang = language.toLowerCase().trim();

    if (LANGUAGE_ALIASES[lowerLang]) {
        return LANGUAGE_ALIASES[lowerLang];
    }

    return lowerLang;
}

/**
 * 格式化代码块
 * @param {string} code - 代码内容
 * @param {string} language - 编程语言
 * @param {string} description - 代码描述
 * @param {string} filename - 文件名
 * @returns {string} 格式化后的代码块
 */
function formatCodeBlock(code, language, description, filename) {
    const parts = [];

    if (description) {
        parts.push(`📝 ${description}`);
        parts.push('');
    }

    if (filename) {
        parts.push(`📄 ${filename}`);
        parts.push('');
    }

    parts.push(`\`\`\`${language}`);
    parts.push(code);
    parts.push('```');

    return parts.join('\n');
}

export default {
    handleCodeToolCall
};
