/**
 * 会话策略模式实现
 * 通过策略模式消除重复的模式判断逻辑
 */

import { KeyvFile } from 'keyv-file';
import path from 'path';
import fs from 'fs';
import { CHAT_CONTEXT_PATH, CHAT_CONTEXT_V2_PATH, getUserRoleIndex } from '../config.js';
import { filterMessagesByPrivacy, DEFAULT_PRIVACY_CONFIG } from '../privacy/sceneFilter.js';
import { Config } from '../../../components/index.js';

const logger = global.logger || console;

/**
 * 会话策略基类
 * 定义会话操作的抽象接口
 */
export class SessionStrategy {
    /**
     * 生成会话ID
     * @param {Object} e - 事件对象
     * @param {number|null} roleId - 角色ID（可选，仅V2模式使用）
     * @returns {Promise<string>} 会话ID
     */
    async generateSessionId(e, roleId = null) {
        throw new Error('子类必须实现 generateSessionId 方法');
    }

    /**
     * 加载聊天消息
     * @param {string} sessionId - 会话ID
     * @param {Object} e - 事件对象
     * @returns {Promise<Array>} 聊天消息数组
     */
    async loadChatMsg(sessionId, e) {
        throw new Error('子类必须实现 loadChatMsg 方法');
    }

    /**
     * 保存聊天消息
     * @param {string} sessionId - 会话ID
     * @param {Array} chatMsg - 聊天消息数组
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async saveChatMsg(sessionId, chatMsg, e) {
        throw new Error('子类必须实现 saveChatMsg 方法');
    }

    /**
     * 添加消息到聊天历史
     * @param {Object} msg - 消息对象
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async addMessage(msg, e) {
        throw new Error('子类必须实现 addMessage 方法');
    }

    /**
     * 清除会话上下文
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async clearSessionContext(e) {
        throw new Error('子类必须实现 clearSessionContext 方法');
    }
}

/**
 * V1模式策略（按场景隔离）
 * 群聊和私聊分别存储，互不干扰
 */
export class IsolatedSessionStrategy extends SessionStrategy {
    /**
     * 生成V1格式的会话ID（按场景隔离）
     * 群聊: group_{群号}
     * 私聊: user_{用户ID}
     * @param {Object} e - 事件对象
     * @param {number|null} roleId - 角色ID（V1模式不使用此参数）
     */
    async generateSessionId(e, roleId = null) {
        return e.group_id ? `group_${e.group_id}` : `user_${e.user_id}`;
    }

    /**
     * V1模式加载聊天消息
     */
    async loadChatMsg(sessionId, e) {
        const keyv = this.getSessionKeyv(sessionId);
        const chatMsg = await keyv.get('chatMsg');
        return chatMsg || [];
    }

    /**
     * V1模式保存聊天消息
     */
    async saveChatMsg(sessionId, chatMsg, e) {
        const keyv = this.getSessionKeyv(sessionId);
        await keyv.set('chatMsg', chatMsg);
    }

    /**
     * V1模式添加消息
     */
    async addMessage(msg, e) {
        const sessionId = await this.generateSessionId(e);
        const chatMsg = await this.loadChatMsg(sessionId, e);
        chatMsg.push(msg);
        this.trimHistory(chatMsg);
        await this.saveChatMsg(sessionId, chatMsg, e);
    }

    /**
     * V1模式清除会话上下文
     */
    async clearSessionContext(e) {
        const sessionId = await this.generateSessionId(e);
        const keyv = this.getSessionKeyv(sessionId);
        await keyv.clear();
    }

    /**
     * 获取Keyv实例（V1格式 - 按场景隔离）
     */
    getSessionKeyv(sessionId) {
        return new KeyvFile({
            filename: path.join(CHAT_CONTEXT_PATH, `${sessionId}.json`),
            writeDelay: 100,
            encode: JSON.stringify,
            decode: JSON.parse
        });
    }

    /**
     * 修剪历史消息数组，保持在最大限制内
     */
    trimHistory(messages) {
        const limit = Config.Chat.MaxHistory ?? 50;
        if (messages.length > limit) {
            const removeCount = messages.length - limit;
            messages.splice(0, removeCount);
        }
        return messages;
    }
}

/**
 * V2模式策略（按角色整合）
 * 同一角色的所有场景共用一个会话
 */
export class RoleSessionStrategy extends SessionStrategy {
    constructor() {
        super();
        this.ensureV2Directory();
    }

    /**
     * 确保V2数据目录存在
     */
    ensureV2Directory() {
        if (!fs.existsSync(CHAT_CONTEXT_V2_PATH)) {
            fs.mkdirSync(CHAT_CONTEXT_V2_PATH, { recursive: true });
        }
    }

    /**
     * 生成V2格式的会话ID（全局整合模式）
     * 所有用户、所有群、所有私聊共用一个全局会话
     * @param {Object} e - 事件对象
     * @param {number|null} roleId - 角色ID（可选，不传则从配置获取）
     */
    async generateSessionId(e, roleId = null) {
        const effectiveRoleId = typeof roleId === 'number' ? roleId : await getUserRoleIndex(e);
        return `role_${effectiveRoleId}_global`;
    }

    /**
     * V2模式加载聊天消息（按角色整合，返回纯消息数组供API使用）
     * 自动应用隐私过滤，防止跨场景敏感信息泄露
     */
    async loadChatMsg(sessionId, e) {
        const keyv = this.getSessionKeyvV2(sessionId);
        const sessionData = await keyv.get('session');

        if (!sessionData || !Array.isArray(sessionData.messages)) {
            return [];
        }

        const currentScene = this.getCurrentScene(e);
        return filterMessagesByPrivacy(sessionData.messages, currentScene, DEFAULT_PRIVACY_CONFIG);
    }

    /**
     * V2模式保存聊天消息（完整会话结构）
     */
    async saveChatMsg(sessionId, messages, e) {
        const keyv = this.getSessionKeyvV2(sessionId);

        let sessionData = await keyv.get('session');

        if (!sessionData) {
            sessionData = this.createInitialSessionData(sessionId);
        }

        sessionData.messages = messages;
        sessionData.updatedAt = Date.now();

        const stats = this.computeStats(messages);
        sessionData.stats = stats;

        await keyv.set('session', sessionData);
    }

    /**
     * V2模式添加消息（使用 additional_info 格式，与 SystemConfig.json 约定一致）
     */
    async addMessage(msg, e) {
        const sessionId = await this.generateSessionId(e);

        const enhancedMessage = this.createEnhancedMessage(msg, e);

        const keyv = this.getSessionKeyvV2(sessionId);
        let sessionData = await keyv.get('session');

        if (!sessionData) {
            sessionData = this.createInitialSessionData(sessionId);
        }

        sessionData.messages.push(enhancedMessage);
        this.trimHistory(sessionData.messages);

        sessionData.updatedAt = Date.now();
        sessionData.stats = this.computeStats(sessionData.messages);

        await keyv.set('session', sessionData);
    }

    /**
     * V2模式清除会话上下文（清除当前角色的所有对话记录）
     */
    async clearSessionContext(e) {
        const sessionId = await this.generateSessionId(e);
        const keyv = this.getSessionKeyvV2(sessionId);
        await keyv.clear();
    }

    /**
     * 获取V2格式Keyv实例（按角色整合）
     */
    getSessionKeyvV2(sessionId) {
        this.ensureV2Directory();
        return new KeyvFile({
            filename: path.join(CHAT_CONTEXT_V2_PATH, `${sessionId}.json`),
            writeDelay: 100,
            encode: JSON.stringify,
            decode: JSON.parse
        });
    }

    /**
     * 获取当前场景信息
     */
    getCurrentScene(e) {
        return {
            type: e.group_id ? 'group' : 'private',
            source_id: String(e.group_id || e.user_id)
        };
    }

    /**
     * 创建初始会话数据结构
     * @param {string} sessionId - V2会话ID（格式：role_{roleId}_global）
     * @returns {Object} 初始会话数据对象
     */
    createInitialSessionData(sessionId) {
        const roleIdStr = sessionId.replace('role_', '').replace('_global', '');
        return {
            version: '2.0',
            sessionId,
            roleId: parseInt(roleIdStr) || 0,
            userId: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            stats: { totalMessages: 0, groupMessages: 0, privateMessages: 0 },
            messages: []
        };
    }

    /**
     * 创建增强型消息
     */
    createEnhancedMessage(msg, e) {
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

        return enhancedMessage;
    }

    /**
     * 计算会话统计信息
     */
    computeStats(messages) {
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
     */
    trimHistory(messages) {
        const limit = Config.Chat.MaxHistory ?? 50;
        if (messages.length > limit) {
            const removeCount = messages.length - limit;
            messages.splice(0, removeCount);
        }
        return messages;
    }
}

/**
 * 会话策略工厂
 * 根据当前配置模式返回对应的策略实例
 */
export class SessionStrategyFactory {
    constructor() {
        this.strategies = {
            'isolated': new IsolatedSessionStrategy(),
            'role': new RoleSessionStrategy()
        };
    }

    /**
     * 获取当前模式对应的策略实例
     * @param {string} mode - 存储模式
     * @returns {SessionStrategy} 策略实例
     */
    getStrategy(mode) {
        return this.strategies[mode] || this.strategies['role'];
    }

    /**
     * 注册新的策略
     * @param {string} name - 策略名称
     * @param {SessionStrategy} strategy - 策略实例
     */
    registerStrategy(name, strategy) {
        this.strategies[name] = strategy;
    }
}

// 导出单例工厂实例
export const sessionStrategyFactory = new SessionStrategyFactory();
