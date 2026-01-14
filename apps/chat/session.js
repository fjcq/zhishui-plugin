import { KeyvFile } from 'keyv-file';
import path from 'path';
import { CHAT_CONTEXT_PATH } from './config.js';

/**
 * 获取会话Keyv实例
 * @param {string} sessionId - 会话ID
 * @returns {KeyvFile} Keyv实例
 */
export function getSessionKeyv(sessionId) {
    return new KeyvFile({
        filename: path.join(CHAT_CONTEXT_PATH, `${sessionId}.json`),
        writeDelay: 100,
        encode: JSON.stringify,
        decode: JSON.parse,
    });
}

/**
 * 加载聊天消息
 * @param {string} sessionId - 会话ID
 * @returns {Promise<Array>} 聊天消息数组
 */
export async function loadChatMsg(sessionId) {
    const keyv = getSessionKeyv(sessionId);
    const chatMsg = await keyv.get('chatMsg');
    return chatMsg || [];
}

/**
 * 保存聊天消息
 * @param {string} sessionId - 会话ID
 * @param {Array} chatMsg - 聊天消息数组
 * @returns {Promise<void>}
 */
export async function saveChatMsg(sessionId, chatMsg) {
    const keyv = getSessionKeyv(sessionId);
    await keyv.set('chatMsg', chatMsg);
}

/**
 * 添加消息到聊天历史
 * @param {Object} msg - 消息对象 {role, content}
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function addMessage(msg, e) {
    const sessionId = e.group_id ? `group_${e.group_id}` : `user_${e.user_id}`;
    const chatMsg = await loadChatMsg(sessionId);
    chatMsg.push(msg);
    await saveChatMsg(sessionId, chatMsg);
}

/**
 * 清除会话上下文
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function clearSessionContext(e) {
    const sessionId = e.group_id ? `group_${e.group_id}` : `user_${e.user_id}`;
    const keyv = getSessionKeyv(sessionId);
    await keyv.clear();
}
