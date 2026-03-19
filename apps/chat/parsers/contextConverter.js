/**
 * 上下文转换模块
 * 处理不同API类型之间的聊天上下文格式转换
 */

/**
 * 转换聊天上下文格式以适应不同模型
 * @param {Array} chatMsg - 聊天消息数组
 * @param {string} oldType - 旧API类型
 * @param {string} newType - 新API类型
 * @param {string} oldModel - 旧模型名称
 * @param {string} newModel - 新模型名称
 * @returns {Object} 返回 {converted: Array, lostContent: boolean}
 */
export function convertChatContextForModel(chatMsg, oldType, newType, oldModel, newModel) {
    if (!Array.isArray(chatMsg) || chatMsg.length === 0) {
        return { converted: chatMsg, lostContent: false };
    }

    if (oldType === newType) {
        return { converted: chatMsg, lostContent: false };
    }

    let lostContent = false;

    if (newType === 'tencent') {
        const converted = [];
        for (const msg of chatMsg) {
            if (msg.role === 'system') {
                lostContent = true;
                continue;
            }
            if (msg.role === 'user' || msg.role === 'assistant') {
                converted.push(msg);
            }
        }
        return { converted, lostContent };
    }

    if (newType === 'gemini') {
        const converted = [];
        for (const msg of chatMsg) {
            if (msg.role === 'system') {
                lostContent = true;
                continue;
            }
            if (msg.role === 'user') {
                converted.push({ role: 'user', parts: [{ text: msg.content }] });
            } else if (msg.role === 'assistant') {
                converted.push({ role: 'model', parts: [{ text: msg.content }] });
            }
        }
        return { converted, lostContent };
    }

    return { converted: chatMsg, lostContent: false };
}
