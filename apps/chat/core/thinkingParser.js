/**
 * 思维链（thinking/reasoning）统一解析器
 * 收编自旧responseHandler的extractMessageContent，三种来源统一收口：
 * 1. reasoning_content / reasoning 字段（DeepSeek R1、SiliconFlow等）
 * 2. content 数组中的 thinking 块（Claude、o1/o3走兼容端点等）
 * 3. content 字符串中嵌入的 <think>...</think> 标签（DeepSeek-R1-distill等）
 */

/**
 * 从content数组中提取text与thinking块
 * @param {Array<Object>} contentBlocks - content数组
 * @returns {{ textParts: string[], thinkingParts: string[] }} 分块结果
 */
function splitContentBlocks(contentBlocks) {
    const textParts = [];
    const thinkingParts = [];
    for (const block of contentBlocks) {
        if (block?.type === 'text' && block.text) {
            textParts.push(block.text);
        } else if (block?.type === 'thinking' && block.thinking) {
            thinkingParts.push(block.thinking);
        }
    }
    return { textParts, thinkingParts };
}

/**
 * 从content字符串中剥离并收集<think>标签思考内容
 * 兼容：完整配对块、仅闭合标签（前段为思考）、残留开启标签（后段为思考）
 * @param {string} textContent - 原始文本
 * @param {string|null} existingReasoning - 已收集的思考内容
 * @returns {{ textContent: string, reasoningContent: string|null }} 剥离结果
 */
function stripThinkTags(textContent, existingReasoning) {
    let text = textContent;
    let reasoning = existingReasoning;

    const appendReasoning = (part) => {
        reasoning = reasoning ? `${reasoning}\n${part}` : part;
    };

    // 1. 完整的 <think>...</think> 块
    const thinkBlockRegex = /<think>([\s\S]*?)<\/think>/g;
    const thinkBlocks = [];
    let thinkMatch;
    while ((thinkMatch = thinkBlockRegex.exec(text)) !== null) {
        thinkBlocks.push(thinkMatch[1].trim());
    }
    if (thinkBlocks.length > 0) {
        reasoning = reasoning || thinkBlocks.join('\n');
        text = text.replace(thinkBlockRegex, '').trim();
    }

    // 2. 未配对的闭合标签 </think>：之前视为思考，之后视为正式回复
    if (text.includes('</think>')) {
        const parts = text.split('</think>');
        if (parts.length > 1) {
            const thinkPart = parts[0].trim();
            if (thinkPart) {
                appendReasoning(thinkPart);
            }
            text = parts.slice(1).join('</think>').trim();
        }
    }

    // 3. 残留的开启标签 <think>：其后内容视为思考
    const openThinkIndex = text.indexOf('<think>');
    if (openThinkIndex !== -1) {
        const afterOpen = text.substring(openThinkIndex + 7).trim();
        if (afterOpen) {
            appendReasoning(afterOpen);
        }
        text = text.substring(0, openThinkIndex).trim();
    }

    return { textContent: text, reasoningContent: reasoning };
}

/**
 * 统一解析消息中的文本内容与思维链内容
 * @param {Object} message - OpenAI中间格式的消息对象
 * @param {string|Array|null} message.content - 消息内容
 * @param {string} [message.reasoning_content] - 推理内容字段（兼容reasoning）
 * @returns {{ textContent: string, reasoningContent: string|null }} 解析结果
 */
export function parseThinkingMessage(message) {
    if (!message) {
        return { textContent: '', reasoningContent: null };
    }

    let textContent = '';
    let reasoningContent = null;

    if (Array.isArray(message.content)) {
        const { textParts, thinkingParts } = splitContentBlocks(message.content);
        textContent = textParts.join('\n');
        if (thinkingParts.length > 0) {
            reasoningContent = thinkingParts.join('\n');
        }
    } else if (typeof message.content === 'string') {
        textContent = message.content.trim();
    }

    if (textContent) {
        const stripped = stripThinkTags(textContent, reasoningContent);
        textContent = stripped.textContent;
        reasoningContent = stripped.reasoningContent;
    }

    // 兜底：显式推理字段
    if (!reasoningContent) {
        reasoningContent = message.reasoning_content || message.reasoning || null;
    }

    return { textContent, reasoningContent };
}
