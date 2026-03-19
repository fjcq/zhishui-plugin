/**
 * AT格式解析模块
 * 处理消息中的艾特格式转换
 */

/**
 * 将消息中的 {at:用户ID} 格式转换为 segment.at() 对象数组
 * @param {string} message - 原始消息内容
 * @returns {Array} 转换后的消息数组，包含文本和segment对象
 */
export function convertAtFormat(message) {
    if (!message || typeof message !== 'string') {
        return [message];
    }

    const result = [];
    const atRegex = /\{at:(\d+)\}/g;
    let lastIndex = 0;
    let match;

    while ((match = atRegex.exec(message)) !== null) {
        if (match.index > lastIndex) {
            result.push(message.substring(lastIndex, match.index));
        }

        const userId = match[1];
        result.push(segment.at(userId));

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < message.length) {
        result.push(message.substring(lastIndex));
    }

    if (result.length === 0) {
        return [message];
    }

    return result;
}
