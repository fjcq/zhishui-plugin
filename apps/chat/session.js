/**
 * 会话管理模块（重构版）
 * 使用策略模式消除重复的模式判断逻辑
 */

import path from 'path';
import fs from 'fs';
import { CHAT_CONTEXT_PATH, CHAT_CONTEXT_V2_PATH, getContextMode } from './config.js';
import { sessionStrategyFactory } from './strategies/SessionStrategy.js';

const logger = global.logger || console;

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
 * 根据当前配置模式生成会话ID
 * 自动根据 ContextMode 配置选择V1或V2格式
 * @param {Object} e - 事件对象
 * @returns {Promise<string>} 会话ID
 */
export async function generateSessionId(e) {
    const mode = await getContextMode();
    const strategy = sessionStrategyFactory.getStrategy(mode);
    return await strategy.generateSessionId(e);
}

/**
 * 获取Keyv实例（V1格式 - 按场景隔离）
 * @param {string} sessionId - 会话ID
 * @returns {KeyvFile} Keyv实例
 * @deprecated 请使用策略模式，此函数保留用于向后兼容
 */
export function getSessionKeyv(sessionId) {
    const { KeyvFile } = require('keyv-file');
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
 * @deprecated 请使用策略模式，此函数保留用于向后兼容
 */
export function getSessionKeyvV2(sessionId) {
    const { KeyvFile } = require('keyv-file');
    if (!fs.existsSync(CHAT_CONTEXT_V2_PATH)) {
        fs.mkdirSync(CHAT_CONTEXT_V2_PATH, { recursive: true });
    }
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
    const mode = await getContextMode();
    const strategy = sessionStrategyFactory.getStrategy(mode);
    const sessionId = await strategy.generateSessionId(e);
    return await strategy.loadChatMsg(sessionId, e);
}

/**
 * 保存聊天消息（自动适配当前模式）
 * @param {string} sessionId - 会话ID
 * @param {Array} chatMsg - 聊天消息数组
 * @returns {Promise<void>}
 */
export async function saveChatMsg(sessionId, chatMsg) {
    const mode = await getContextMode();
    const strategy = sessionStrategyFactory.getStrategy(mode);
    await strategy.saveChatMsg(sessionId, chatMsg, null);
}

/**
 * 添加消息到聊天历史（自动适配当前模式）
 * @param {Object} msg - 消息对象 {role, content}
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function addMessage(msg, e) {
    const mode = await getContextMode();
    const strategy = sessionStrategyFactory.getStrategy(mode);
    await strategy.addMessage(msg, e);
}

/**
 * 清除会话上下文（自动适配当前模式）
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function clearSessionContext(e) {
    const mode = await getContextMode();
    const strategy = sessionStrategyFactory.getStrategy(mode);
    await strategy.clearSessionContext(e);
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
