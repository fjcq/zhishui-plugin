import { KeyvFile } from 'keyv-file';
import path from 'path';
import fs from 'fs';
import { CHAT_CONTEXT_PATH, CHAT_CONTEXT_V2_PATH, getContextMode, getCurrentRoleIndex, getUserRoleIndex } from './config.js';
import { filterMessagesByPrivacy, DEFAULT_PRIVACY_CONFIG } from './privacy/sceneFilter.js';
import { Config } from '../../components/index.js';

const logger = global.logger || console;

/**
 * 确保V2数据目录存在
 */
function ensureV2Directory() {
    if (!fs.existsSync(CHAT_CONTEXT_V2_PATH)) {
        fs.mkdirSync(CHAT_CONTEXT_V2_PATH, { recursive: true });
    }
}

/**
 * 获取当前场景信息
 * @param {Object} e - 事件对象
 * @returns {Object} 场景信息对象
 */
export function getCurrentScene(e) {
    return {
        type: e.group_id ? 'group' : 'private',
        source_id: String(e.group_id || e.user_id)
    };
}

/**
 * 生成V1格式的会话ID（按场景隔离）
 * 群聊: group_{群号}
 * 私聊: user_{用户ID}
 * @param {Object} e - 事件对象
 * @returns {string} 会话ID
 */
function generateSessionIdV1(e) {
    return e.group_id ? `group_${e.group_id}` : `user_${e.user_id}`;
}

/**
 * 生成V2格式的会话ID（全局整合模式）
 * 所有用户、所有群、所有私聊共用一个全局会话
 * AI通过消息中的scene信息识别消息来源（群聊/私聊）
 * @param {Object} e - 事件对象
 * @param {number} roleId - 角色索引（可选）
 * @returns {Promise<string>} 会话ID
 */
async function generateSessionIdV2(e, roleId) {
    const effectiveRoleId = typeof roleId === 'number' ? roleId : await getUserRoleIndex(e);
    return `role_${effectiveRoleId}_global`;
}

/**
 * 根据当前配置模式生成会话ID
 * 自动根据 ContextMode 配置选择V1或V2格式
 * @param {Object} e - 事件对象
 * @returns {Promise<string>} 会话ID
 */
export async function generateSessionId(e) {
    const mode = await getContextMode();
    if (mode === 'role') {
        return generateSessionIdV2(e);
    }
    return generateSessionIdV1(e);
}

/**
 * 获取Keyv实例（V1格式 - 按场景隔离）
 * @param {string} sessionId - 会话ID
 * @returns {KeyvFile} Keyv实例
 */
export function getSessionKeyv(sessionId) {
    return new KeyvFile({
        filename: path.join(CHAT_CONTEXT_PATH, `${sessionId}.json`),
        writeDelay: 100,
        encode: JSON.stringify,
        decode: JSON.parse
    });
}

/**
 * 获取V2格式Keyv实例（按角色整合）
 * @param {string} sessionId - V2会话ID
 * @returns {KeyvFile} Keyv实例
 */
export function getSessionKeyvV2(sessionId) {
    ensureV2Directory();
    return new KeyvFile({
        filename: path.join(CHAT_CONTEXT_V2_PATH, `${sessionId}.json`),
        writeDelay: 100,
        encode: JSON.stringify,
        decode: JSON.parse
    });
}

/**
 * 加载聊天消息（自动适配当前模式）
 * @param {Object} e - 事件对象
 * @returns {Promise<Array>} 聊天消息数组
 */
export async function loadChatMsg(e) {
    const sessionId = await generateSessionId(e);
    const mode = await getContextMode();

    if (mode === 'role') {
        return await loadChatMsgV2(sessionId, e);
    }
    return await loadChatMsgV1(sessionId);
}

/**
 * V1模式加载聊天消息
 * @param {string} sessionId - 会话ID
 * @returns {Promise<Array>} 聊天消息数组
 */
async function loadChatMsgV1(sessionId) {
    const keyv = getSessionKeyv(sessionId);
    const chatMsg = await keyv.get('chatMsg');
    return chatMsg || [];
}

/**
 * V2模式加载聊天消息（按角色整合，返回纯消息数组供API使用）
 * 自动应用隐私过滤，防止跨场景敏感信息泄露
 * @param {string} sessionId - V2会话ID
 * @param {Object} e - 事件对象（用于确定当前场景和隐私过滤）
 * @returns {Promise<Array>} 过滤后的消息数组
 */
async function loadChatMsgV2(sessionId, e) {
    const keyv = getSessionKeyvV2(sessionId);
    const sessionData = await keyv.get('session');

    if (!sessionData || !Array.isArray(sessionData.messages)) {
        return [];
    }

    const currentScene = getCurrentScene(e);
    return filterMessagesByPrivacy(sessionData.messages, currentScene, DEFAULT_PRIVACY_CONFIG);
}

/**
 * 保存聊天消息（自动适配当前模式）
 * @param {string} sessionId - 会话ID
 * @param {Array} chatMsg - 聊天消息数组
 * @returns {Promise<void>}
 */
export async function saveChatMsg(sessionId, chatMsg) {
    const mode = await getContextMode();
    if (mode === 'role') {
        await saveChatMsgV2(sessionId, chatMsg);
    } else {
        await saveChatMsgV1(sessionId, chatMsg);
    }
}

/**
 * V1模式保存聊天消息
 * @param {string} sessionId - 会话ID
 * @param {Array} chatMsg - 聊天消息数组
 * @returns {Promise<void>}
 */
async function saveChatMsgV1(sessionId, chatMsg) {
    const keyv = getSessionKeyv(sessionId);
    await keyv.set('chatMsg', chatMsg);
}

/**
 * V2模式保存聊天消息（完整会话结构）
 * @param {string} sessionId - V2会话ID
 * @param {Array} messages - 增强型消息数组
 * @returns {Promise<void>}
 */
async function saveChatMsgV2(sessionId, messages) {
    const keyv = getSessionKeyvV2(sessionId);

    let sessionData = await keyv.get('session');

    if (!sessionData) {
        const [roleIdStr, userIdStr] = sessionId.replace('role_', '').split('_user_');
        sessionData = {
            version: '2.0',
            sessionId,
            roleId: parseInt(roleIdStr) || 0,
            userId: userIdStr,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            stats: { totalMessages: 0, groupMessages: 0, privateMessages: 0 },
            messages: []
        };
    }

    sessionData.messages = messages;
    sessionData.updatedAt = Date.now();

    const stats = computeStats(messages);
    sessionData.stats = stats;

    await keyv.set('session', sessionData);
}

/**
 * 计算会话统计信息
 * @param {Array} messages - 消息数组
 * @returns {Object} 统计信息对象
 */
function computeStats(messages) {
    let totalMessages = messages.length;
    let groupMessages = 0;
    let privateMessages = 0;
    let lastScene = null;

    for (const msg of messages) {
        if (msg.additional_info) {
            if (msg.additional_info.group_id && msg.additional_info.group_id !== 0) {
                groupMessages++;
                lastScene = { type: 'group', source_id: String(msg.additional_info.group_id) };
            } else {
                privateMessages++;
                lastScene = { type: 'private', source_id: String(msg.additional_info.user_id) };
            }
        }
    }

    return { totalMessages, groupMessages, privateMessages, lastScene };
}

/**
 * 修剪历史消息数组，保持在最大限制内
 * @param {Array} messages - 消息数组
 * @param {number} maxHistory - 最大历史消息数量
 * @returns {Array} 修剪后的消息数组
 */
function trimHistory(messages, maxHistory) {
    const limit = maxHistory ?? Config.Chat.MaxHistory ?? 50;
    if (messages.length > limit) {
        const removeCount = messages.length - limit;
        messages.splice(0, removeCount);
    }
    return messages;
}

/**
 * 添加消息到聊天历史（自动适配当前模式）
 * @param {Object} msg - 消息对象 {role, content}
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function addMessage(msg, e) {
    const mode = await getContextMode();
    if (mode === 'role') {
        await addMessageV2(msg, e);
    } else {
        await addMessageV1(msg, e);
    }
}

/**
 * V1模式添加消息（原始逻辑保持不变）
 * @param {Object} msg - 消息对象
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
async function addMessageV1(msg, e) {
    const sessionId = generateSessionIdV1(e);
    const chatMsg = await loadChatMsgV1(sessionId);
    chatMsg.push(msg);
    trimHistory(chatMsg);
    await saveChatMsgV1(sessionId, chatMsg);
}

/**
 * V2模式添加消息（使用 additional_info 格式，与 SystemConfig.json 约定一致）
 * @param {Object} msg - 消息对象
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
async function addMessageV2(msg, e) {
    const sessionId = await generateSessionIdV2(e);

    const enhancedMessage = {
        role: msg.role,
        content: msg.content,
        additional_info: {
            user_id: e.user_id,
            group_id: e.group_id || 0,
            name: e.sender?.nickname || '',
            timestamp: Date.now()
        }
    };

    if (msg.tool_calls) enhancedMessage.tool_calls = msg.tool_calls;
    if (msg.tool_call_id) enhancedMessage.tool_call_id = msg.tool_call_id;
    if (msg.reasoning_content) enhancedMessage.reasoning_content = msg.reasoning_content;

    const keyv = getSessionKeyvV2(sessionId);
    let sessionData = await keyv.get('session');

    if (!sessionData) {
        sessionData = {
            version: '2.0',
            sessionId,
            roleId: parseInt(sessionId.replace('role_', '').replace('_global', '')) || 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            stats: { totalMessages: 0, groupMessages: 0, privateMessages: 0 },
            messages: []
        };
    }

    sessionData.messages.push(enhancedMessage);
    trimHistory(sessionData.messages);
    
    sessionData.updatedAt = Date.now();
    sessionData.stats = computeStats(sessionData.messages);

    await keyv.set('session', sessionData);
}

/**
 * 清除会话上下文（自动适配当前模式）
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function clearSessionContext(e) {
    const mode = await getContextMode();
    if (mode === 'role') {
        await clearSessionContextV2(e);
    } else {
        await clearSessionContextV1(e);
    }
}

/**
 * V1模式清除会话上下文
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
async function clearSessionContextV1(e) {
    const sessionId = generateSessionIdV1(e);
    const keyv = getSessionKeyv(sessionId);
    await keyv.clear();
}

/**
 * V2模式清除会话上下文（清除当前角色的所有对话记录）
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
async function clearSessionContextV2(e) {
    const sessionId = await generateSessionIdV2(e);
    const keyv = getSessionKeyvV2(sessionId);
    await keyv.clear();
}

/**
 * 清除指定模式下所有会话数据
 * 切换存储模式时调用，清除旧模式的全部缓存
 * @param {string} mode - 要清除的模式 ('isolated' | 'role')
 * @returns {{ count: number, errors: string[] }} 清除结果
 */
export function clearAllSessions(mode) {
    const result = { count: 0, errors: [] };

    try {
        let targetPath;

        if (mode === 'isolated' || mode === 'v1') {
            targetPath = CHAT_CONTEXT_PATH;
        } else if (mode === 'role' || mode === 'v2') {
            targetPath = CHAT_CONTEXT_V2_PATH;
        } else {
            result.errors.push(`未知的模式: ${mode}`);
            return result;
        }

        if (!fs.existsSync(targetPath)) {
            return result;
        }

        const files = fs.readdirSync(targetPath);

        for (const file of files) {
            const filePath = path.join(targetPath, file);
            try {
                if (fs.statSync(filePath).isFile()) {
                    fs.unlinkSync(filePath);
                    result.count++;
                }
            } catch (err) {
                result.errors.push(`删除文件失败 [${file}]: ${err.message}`);
            }
        }

        logger.info(`[会话管理] 已清除${mode}模式下全部会话数据，共${result.count}个文件`);
    } catch (error) {
        result.errors.push(error.message);
    }

    return result;
}
