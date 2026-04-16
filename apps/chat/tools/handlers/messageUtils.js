/**
 * 消息工具类
 * 封装消息发送的底层逻辑，提供统一的消息处理接口
 */

import { getSegment } from './musicCore.js';

const logger = global.logger || console;

/**
 * 消息类型枚举
 */
export const MessageType = {
    TEXT: 'text',
    IMAGE: 'image',
    VOICE: 'voice',
    VIDEO: 'video',
    AT: 'at',
    REPLY: 'reply',
    FACE: 'face',
    SHARE: 'share',
    FORWARD: 'forward'
};

/**
 * 场景类型枚举
 */
export const SceneType = {
    PRIVATE: 'private',
    GROUP: 'group'
};

/**
 * 消息发送结果
 */
export class MessageResult {
    constructor(success, data = null, error = null) {
        this.success = success;
        this.data = data;
        this.error = error;
        this.timestamp = Date.now();
    }

    static ok(data) {
        return new MessageResult(true, data);
    }

    static fail(error) {
        return new MessageResult(false, null, error);
    }
}

/**
 * 消息构建器
 * 用于构建复杂的消息段
 */
export class MessageBuilder {
    constructor() {
        this.segments = [];
    }

    /**
     * 添加文本消息
     * @param {string} text - 文本内容
     * @returns {MessageBuilder}
     */
    text(text) {
        this.segments.push({ type: MessageType.TEXT, data: { text } });
        return this;
    }

    /**
     * 添加图片消息
     * @param {string} url - 图片URL或路径
     * @param {string} [caption] - 图片说明
     * @returns {MessageBuilder}
     */
    image(url, caption = null) {
        this.segments.push({ type: MessageType.IMAGE, data: { url, caption } });
        return this;
    }

    /**
     * 添加@消息
     * @param {string} userId - 用户ID
     * @returns {MessageBuilder}
     */
    at(userId) {
        this.segments.push({ type: MessageType.AT, data: { userId } });
        return this;
    }

    /**
     * 添加回复消息
     * @param {string} messageId - 消息ID
     * @returns {MessageBuilder}
     */
    reply(messageId) {
        this.segments.push({ type: MessageType.REPLY, data: { messageId } });
        return this;
    }

    /**
     * 构建消息段数组
     * @returns {Array} 消息段数组
     */
    build() {
        return this.segments;
    }

    /**
     * 清空消息段
     * @returns {MessageBuilder}
     */
    clear() {
        this.segments = [];
        return this;
    }
}

/**
 * 消息验证器
 */
export class MessageValidator {
    /**
     * 验证文本消息
     * @param {string} text - 文本内容
     * @returns {object} 验证结果 { valid: boolean, error?: string }
     */
    static validateText(text) {
        if (!text || typeof text !== 'string') {
            return { valid: false, error: '文本内容不能为空' };
        }

        const trimmed = text.trim();
        if (trimmed.length === 0) {
            return { valid: false, error: '文本内容不能为空' };
        }

        if (trimmed.length > 5000) {
            return { valid: false, error: '文本内容过长，请控制在5000字符以内' };
        }

        return { valid: true };
    }

    /**
     * 验证图片URL
     * @param {string} url - 图片URL
     * @returns {object} 验证结果
     */
    static validateImageUrl(url) {
        if (!url || typeof url !== 'string') {
            return { valid: false, error: '图片URL不能为空' };
        }

        const trimmed = url.trim();
        if (trimmed.length === 0) {
            return { valid: false, error: '图片URL不能为空' };
        }

        const isValidUrl = trimmed.startsWith('http://') ||
            trimmed.startsWith('https://') ||
            trimmed.startsWith('file://') ||
            trimmed.startsWith('base64://') ||
            trimmed.startsWith('data:image');

        if (!isValidUrl) {
            return { valid: false, error: '图片URL格式无效' };
        }

        return { valid: true };
    }

    /**
     * 验证用户ID
     * @param {string} userId - 用户ID
     * @returns {object} 验证结果
     */
    static validateUserId(userId) {
        if (!userId) {
            return { valid: false, error: '用户ID不能为空' };
        }

        const userIdStr = String(userId);
        if (!/^\d+$/.test(userIdStr)) {
            return { valid: false, error: '用户ID格式无效' };
        }

        return { valid: true };
    }

    /**
     * 验证群ID
     * @param {string} groupId - 群ID
     * @returns {object} 验证结果
     */
    static validateGroupId(groupId) {
        if (!groupId) {
            return { valid: false, error: '群ID不能为空' };
        }

        const groupIdStr = String(groupId);
        if (!/^\d+$/.test(groupIdStr)) {
            return { valid: false, error: '群ID格式无效' };
        }

        return { valid: true };
    }

    /**
     * 验证消息ID
     * @param {string} messageId - 消息ID
     * @returns {object} 验证结果
     */
    static validateMessageId(messageId) {
        if (!messageId) {
            return { valid: false, error: '消息ID不能为空' };
        }

        return { valid: true };
    }
}

/**
 * 消息发送器
 * 封装消息发送的底层逻辑
 */
export class MessageSender {
    /**
     * 发送消息到指定目标
     * @param {object} e - 事件对象
     * @param {Array|string} message - 消息内容
     * @param {object} options - 发送选项
     * @returns {Promise<MessageResult>}
     */
    static async send(e, message, options = {}) {
        try {
            if (!e) {
                return MessageResult.fail('事件对象不能为空');
            }

            const segment = await getSegment();
            if (!segment) {
                return MessageResult.fail('无法加载segment模块');
            }

            const formattedMessage = await this.formatMessage(message, segment);

            if (options.replyTo) {
                const replyMsg = segment.reply(options.replyTo);
                if (Array.isArray(formattedMessage)) {
                    formattedMessage.unshift(replyMsg);
                } else {
                    await e.reply([replyMsg, formattedMessage]);
                    return MessageResult.ok({ sent: true });
                }
            }

            await e.reply(formattedMessage);

            logger.info(`[消息发送] 成功发送消息 | 场景:${e.isGroup ? '群聊' : '私聊'}`);

            return MessageResult.ok({ sent: true });
        } catch (error) {
            logger.error(`[消息发送] 发送失败: ${error.message}`);
            return MessageResult.fail(`发送消息失败: ${error.message}`);
        }
    }

    /**
     * 格式化消息
     * @param {Array|string} message - 原始消息
     * @param {object} segment - segment模块
     * @returns {Promise<Array>} 格式化后的消息段数组
     */
    static async formatMessage(message, segment) {
        if (typeof message === 'string') {
            return message;
        }

        if (!Array.isArray(message)) {
            return message;
        }

        const formattedSegments = [];

        for (const seg of message) {
            if (typeof seg === 'string') {
                formattedSegments.push(seg);
                continue;
            }

            if (!seg || !seg.type) {
                continue;
            }

            switch (seg.type) {
                case MessageType.TEXT:
                    formattedSegments.push(seg.data.text);
                    break;

                case MessageType.IMAGE:
                    formattedSegments.push(segment.image(seg.data.url));
                    if (seg.data.caption) {
                        formattedSegments.push(seg.data.caption);
                    }
                    break;

                case MessageType.AT:
                    formattedSegments.push(segment.at(seg.data.userId));
                    break;

                case MessageType.REPLY:
                    formattedSegments.push(segment.reply(seg.data.messageId));
                    break;

                default:
                    logger.warn(`[消息格式化] 未知的消息类型: ${seg.type}`);
            }
        }

        return formattedSegments;
    }

    /**
     * 发送私聊消息
     * @param {object} bot - Bot实例
     * @param {string} userId - 用户ID
     * @param {Array|string} message - 消息内容
     * @returns {Promise<MessageResult>}
     */
    static async sendPrivate(bot, userId, message) {
        try {
            if (!bot) {
                return MessageResult.fail('Bot实例不能为空');
            }

            const validation = MessageValidator.validateUserId(userId);
            if (!validation.valid) {
                return MessageResult.fail(validation.error);
            }

            const friend = bot.pickFriend?.(userId);
            if (!friend) {
                return MessageResult.fail(`用户 ${userId} 不是好友，无法发送私聊消息`);
            }

            await friend.sendMsg?.(message);

            logger.info(`[私聊消息] 发送成功 | 用户:${userId}`);

            return MessageResult.ok({ userId, sent: true });
        } catch (error) {
            logger.error(`[私聊消息] 发送失败: ${error.message}`);
            return MessageResult.fail(`发送私聊消息失败: ${error.message}`);
        }
    }

    /**
     * 发送群消息
     * @param {object} bot - Bot实例
     * @param {string} groupId - 群ID
     * @param {Array|string} message - 消息内容
     * @returns {Promise<MessageResult>}
     */
    static async sendGroup(bot, groupId, message) {
        try {
            if (!bot) {
                return MessageResult.fail('Bot实例不能为空');
            }

            const validation = MessageValidator.validateGroupId(groupId);
            if (!validation.valid) {
                return MessageResult.fail(validation.error);
            }

            const group = bot.pickGroup?.(groupId);
            if (!group) {
                return MessageResult.fail(`无法访问群组 ${groupId}`);
            }

            await group.sendMsg?.(message);

            logger.info(`[群消息] 发送成功 | 群:${groupId}`);

            return MessageResult.ok({ groupId, sent: true });
        } catch (error) {
            logger.error(`[群消息] 发送失败: ${error.message}`);
            return MessageResult.fail(`发送群消息失败: ${error.message}`);
        }
    }
}

/**
 * 消息撤回器
 */
export class MessageRecaller {
    /**
     * 撤回消息
     * @param {object} e - 事件对象
     * @param {string} messageId - 消息ID
     * @returns {Promise<MessageResult>}
     */
    static async recall(e, messageId) {
        try {
            if (!e) {
                return MessageResult.fail('事件对象不能为空');
            }

            const validation = MessageValidator.validateMessageId(messageId);
            if (!validation.valid) {
                return MessageResult.fail(validation.error);
            }

            if (e.isGroup) {
                const group = e.group || e.bot?.pickGroup?.(e.group_id);
                if (!group) {
                    return MessageResult.fail('无法获取群组信息');
                }

                await group.recallMsg?.(messageId);
                logger.info(`[消息撤回] 群消息撤回成功 | 群:${e.group_id} | 消息ID:${messageId}`);
            } else {
                await e.bot?.deleteMsg?.(messageId);
                logger.info(`[消息撤回] 私聊消息撤回成功 | 消息ID:${messageId}`);
            }

            return MessageResult.ok({ recalled: true, messageId });
        } catch (error) {
            logger.error(`[消息撤回] 撤回失败: ${error.message}`);
            return MessageResult.fail(`撤回消息失败: ${error.message}`);
        }
    }
}

/**
 * 转发消息构建器
 */
export class ForwardMessageBuilder {
    /**
     * 构建转发消息
     * @param {object} bot - Bot实例
     * @param {Array} messages - 消息列表
     * @returns {object} 转发消息对象
     */
    static build(bot, messages) {
        if (!bot || !bot.makeForwardMsg) {
            throw new Error('Bot实例不支持转发消息');
        }

        if (!Array.isArray(messages) || messages.length === 0) {
            throw new Error('消息列表不能为空');
        }

        return bot.makeForwardMsg(messages);
    }
}

export default {
    MessageType,
    SceneType,
    MessageResult,
    MessageBuilder,
    MessageValidator,
    MessageSender,
    MessageRecaller,
    ForwardMessageBuilder
};
