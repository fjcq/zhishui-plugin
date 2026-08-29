/**
 * 消息工具类
 * 封装消息发送的底层逻辑，提供统一的消息处理接口
 */

import { getSegment } from './shared/utils.js';
import { logger } from '../../../../components/index.js';

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
 * 清理图片 URL 首尾的杂质字符（最终咽喉点，所有图片发送必经）
 * 采用白名单提取：URL 主体限定 ASCII 可见字符，
 * NapCat 历史消息 url 可能包裹形似反引号的 Unicode 字符（全角｀、抑音符ˋ、
 * 智能引号等），黑名单无法穷举；非 ASCII 包裹字符天然落在白名单外无法混入。
 * 字符集排除逗号（\x2C）：CQ 码中 URL 与下一段参数以逗号分隔（如 ,file_size=xxx），
 * 含逗号会把下一段参数吃进 URL 导致图床 400。
 * 十六进制写法：\x21-\x2B（ASCII 33-43）与 \x2D-\x7E（45-126）。
 * 另外还原 CQ 码转义（& 被序列化为 &amp;），从 CQ 文本复制的链接同样可修复
 * @param {string} raw - 原始 URL 字符串
 * @returns {string} 清理后的 URL，无法提取时返回 trim 结果
 */
export function cleanImageUrl(raw) {
    let text = String(raw || '');
    // 还原 CQ 码实体转义：&amp; → &
    text = text.replace(/&amp;/gi, '&');
    const match = text.match(/https?:\/\/[\x21-\x2B\x2D-\x7E]+/i);
    if (match) {
        return match[0].replace(/[`'"<>,;)]+$/g, '');
    }
    return text.trim().replace(/^[\s`'"，。]+|[\s`'"，。]+$/g, '');
}

/**
 * 从消息发送返回值中提取消息ID
 * 兼容各协议适配器的返回结构：
 * - icqq：e.reply/sendMsg 直接返回 { message_id, seq, rand, time }
 * - TRSS OneBotv11（NapCat/LLOneBot/Lagrange）：透传协议端响应，
 *   常见 { message_id } 或标准包装 { data: { message_id } }
 * 注意 NapCat 正常发送的 message_id 是负数序列，不能用正负判断成败
 * @param {*} ret - e.reply / sendMsg / pickFriend().sendMsg 的返回值
 * @returns {string|null} 消息ID字符串，无法提取时返回 null
 */
export function extractMessageId(ret) {
    if (!ret || typeof ret !== 'object') {
        return null;
    }

    if (ret.message_id !== undefined && ret.message_id !== null) {
        return String(ret.message_id);
    }

    if (ret.data && ret.data.message_id !== undefined && ret.data.message_id !== null) {
        return String(ret.data.message_id);
    }

    for (const value of Object.values(ret)) {
        if (value && typeof value === 'object' && value.message_id !== undefined && value.message_id !== null) {
            return String(value.message_id);
        }
    }

    return null;
}

/**
 * 校验 e.reply 的返回结果是否为发送失败
 * TRSS-Yunzai 的 loader（lib/plugins/loader.js）会捕获发送异常，
 * 记录"发送消息错误"日志后以 { error: [err] } 形式返回而非抛出，
 * 调用方若不检查返回值，发送失败时仍会误报成功
 * @param {*} ret - e.reply 的返回值
 * @returns {string|null} 失败时返回错误信息，成功返回 null
 */
export function checkReplyResult(ret) {
    if (ret && ret.error) {
        const err = Array.isArray(ret.error) ? ret.error[0] : ret.error;
        return (err && err.message) ? err.message : String(err);
    }
    return null;
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
                    const ret = await e.reply([replyMsg, formattedMessage]);
                    const messageId = extractMessageId(ret);
                    return MessageResult.ok({ sent: true, ...(messageId ? { message_id: messageId } : {}) });
                }
            }

            const ret = await e.reply(formattedMessage);
            const messageId = extractMessageId(ret);

            logger.info(`[消息发送] 成功发送消息 | 场景:${e.isGroup ? '群聊' : '私聊'}${messageId ? ` | 消息ID:${messageId}` : ''}`);

            return MessageResult.ok({ sent: true, ...(messageId ? { message_id: messageId } : {}) });
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
                    {
                        // 最终咽喉点清理：无论上游传入什么形态的 URL，发送前统一白名单提取，
                        // 防 NapCat 历史消息反引号包裹、AI 从旧上下文复制脏 URL 等所有来源
                        const rawUrl = String(seg.data.url || '');
                        const cleanUrl = cleanImageUrl(rawUrl);
                        if (cleanUrl !== rawUrl) {
                            logger.info(`[消息工具] 图片URL已清理: ${cleanUrl.substring(0, 60)}${cleanUrl.length > 60 ? '...' : ''}`);
                        }
                        formattedSegments.push(segment.image(cleanUrl));
                        if (seg.data.caption) {
                            formattedSegments.push(seg.data.caption);
                        }
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

            const ret = await friend.sendMsg?.(message);
            const messageId = extractMessageId(ret);

            logger.info(`[私聊消息] 发送成功 | 用户:${userId}${messageId ? ` | 消息ID:${messageId}` : ''}`);

            return MessageResult.ok({ userId, sent: true, ...(messageId ? { message_id: messageId } : {}) });
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

            const ret = await group.sendMsg?.(message);
            const messageId = extractMessageId(ret);

            logger.info(`[群消息] 发送成功 | 群:${groupId}${messageId ? ` | 消息ID:${messageId}` : ''}`);

            return MessageResult.ok({ groupId, sent: true, ...(messageId ? { message_id: messageId } : {}) });
        } catch (error) {
            logger.error(`[群消息] 发送失败: ${error.message}`);
            return MessageResult.fail(`发送群消息失败: ${error.message}`);
        }
    }
}

/**
 * 检查撤回调用返回值中的真实失败
 * TRSS OneBotv11 适配器的 recallMsg 内部用 .catch(i => i) 吞掉协议端错误，
 * 失败时不抛异常而是把 Error 对象（或含 Error 的数组）作为返回值；
 * icqq 的 recallMsg 则返回 boolean（false 为失败）
 * @param {*} ret - recallMsg / deleteMsg 的返回值
 * @returns {string|null} 失败原因，未发现失败时返回 null
 */
function checkRecallFailure(ret) {
    const checkItem = (item) => {
        if (item instanceof Error) {
            return item.message || '协议端撤回失败';
        }
        if (item && typeof item === 'object' && item.status === 'failed') {
            return item.msg || item.wording || '协议端返回失败状态';
        }
        return null;
    };

    if (typeof ret === 'boolean' && !ret) {
        return '协议端返回撤回失败';
    }

    if (Array.isArray(ret)) {
        for (const item of ret) {
            const reason = checkItem(item);
            if (reason) {
                return reason;
            }
        }
        return null;
    }

    return checkItem(ret);
}

/**
 * 消息撤回器
 */
export class MessageRecaller {
    /**
     * 撤回消息
     * 私聊优先走 friend.recallMsg（TRSS OneBotv11 pickFriend 与 icqq 均绑定该方法），
     * 严禁依赖 e.bot.deleteMsg——TRSS OneBotv11 适配器上不存在此方法，
     * 可选链调用会静默无操作，导致"提示成功但消息未撤回"
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

            // 群聊判定兼容无 isGroup 属性的适配器（与 sceneAdapter 一致）
            if (e.isGroup || e.group_id) {
                const group = e.group || e.bot?.pickGroup?.(e.group_id);
                if (typeof group?.recallMsg !== 'function') {
                    return MessageResult.fail('无法获取群组信息或当前适配器不支持群消息撤回');
                }

                const ret = await group.recallMsg(messageId);
                const failure = checkRecallFailure(ret);
                if (failure) {
                    return MessageResult.fail(`撤回消息失败: ${failure}`);
                }

                logger.info(`[消息撤回] 群消息撤回成功 | 群:${e.group_id} | 消息ID:${messageId}`);
            } else {
                // 私聊撤回：优先 e.friend.recallMsg，缺失时经 pickFriend 补建，最后兼容 icqq 原生 deleteMsg
                const friend = e.friend || e.bot?.pickFriend?.(e.user_id);
                let ret;
                if (typeof friend?.recallMsg === 'function') {
                    ret = await friend.recallMsg(messageId);
                } else if (typeof e.bot?.deleteMsg === 'function') {
                    ret = await e.bot.deleteMsg(messageId);
                } else {
                    return MessageResult.fail('当前协议适配器不支持私聊消息撤回');
                }

                const failure = checkRecallFailure(ret);
                if (failure) {
                    return MessageResult.fail(`撤回消息失败: ${failure}`);
                }

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
