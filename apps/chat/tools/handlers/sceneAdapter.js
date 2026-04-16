/**
 * 场景适配器
 * 自动检测当前场景（私聊/群聊），提供场景上下文信息和适配的消息发送方式
 */

import { SceneType, MessageResult } from './messageUtils.js';
import { isBotAdmin, isUserAdmin } from '../permissions.js';

const logger = global.logger || console;

/**
 * 场景上下文
 * 包含当前场景的所有相关信息
 */
export class SceneContext {
    constructor(e) {
        this.e = e;
        this.type = this._detectSceneType();
        this.userId = e.user_id ? String(e.user_id) : null;
        this.groupId = e.group_id ? String(e.group_id) : null;
        this.botId = e.bot?.uin || e.bot?.user_id || null;
        this.messageId = e.message_id || null;
        this.member = e.member || null;
        this.group = e.group || null;
        this.friend = e.friend || null;
    }

    /**
     * 检测场景类型
     * @returns {string} 场景类型
     */
    _detectSceneType() {
        if (this.e.isGroup || this.e.group_id) {
            return SceneType.GROUP;
        }
        return SceneType.PRIVATE;
    }

    /**
     * 是否为群聊场景
     * @returns {boolean}
     */
    isGroup() {
        return this.type === SceneType.GROUP;
    }

    /**
     * 是否为私聊场景
     * @returns {boolean}
     */
    isPrivate() {
        return this.type === SceneType.PRIVATE;
    }

    /**
     * 获取场景描述
     * @returns {string}
     */
    getDescription() {
        if (this.isGroup()) {
            return `群聊场景 | 群:${this.groupId} | 用户:${this.userId}`;
        }
        return `私聊场景 | 用户:${this.userId}`;
    }

    /**
     * 获取Bot权限信息
     * @returns {Promise<object>}
     */
    async getBotPermission() {
        if (this.isPrivate()) {
            return {
                isAdmin: false,
                isOwner: false,
                canMute: false,
                canKick: false,
                canSetCard: false,
                canSetTitle: false,
                canSetEssence: false
            };
        }

        try {
            const isAdmin = await isBotAdmin(this.e);
            const isOwner = this.member?.is_owner || false;

            return {
                isAdmin,
                isOwner,
                canMute: isAdmin,
                canKick: isAdmin,
                canSetCard: isAdmin,
                canSetTitle: isAdmin,
                canSetEssence: isAdmin
            };
        } catch (error) {
            logger.error(`[场景适配] 获取Bot权限失败: ${error.message}`);
            return {
                isAdmin: false,
                isOwner: false,
                canMute: false,
                canKick: false,
                canSetCard: false,
                canSetTitle: false,
                canSetEssence: false
            };
        }
    }

    /**
     * 获取用户权限信息
     * @param {string} [targetUserId] - 目标用户ID，不传则使用当前用户
     * @returns {Promise<object>}
     */
    async getUserPermission(targetUserId = null) {
        const userId = targetUserId || this.userId;

        if (this.isPrivate()) {
            return {
                isOwner: false,
                isAdmin: false,
                isMember: true
            };
        }

        try {
            const group = this.group || this.e.bot?.pickGroup?.(this.groupId);
            if (!group) {
                return {
                    isOwner: false,
                    isAdmin: false,
                    isMember: false
                };
            }

            const member = await group.getMember?.(userId);
            if (!member) {
                return {
                    isOwner: false,
                    isAdmin: false,
                    isMember: false
                };
            }

            return {
                isOwner: member.is_owner || false,
                isAdmin: member.is_admin || false,
                isMember: true
            };
        } catch (error) {
            logger.error(`[场景适配] 获取用户权限失败: ${error.message}`);
            return {
                isOwner: false,
                isAdmin: false,
                isMember: false
            };
        }
    }

    /**
     * 获取群成员信息
     * @param {string} [targetUserId] - 目标用户ID
     * @returns {Promise<object|null>}
     */
    async getMemberInfo(targetUserId = null) {
        if (this.isPrivate()) {
            return null;
        }

        const userId = targetUserId || this.userId;

        try {
            const group = this.group || this.e.bot?.pickGroup?.(this.groupId);
            if (!group) {
                return null;
            }

            const member = await group.getMember?.(userId);
            if (!member) {
                return null;
            }

            return {
                userId: String(member.user_id || userId),
                nickname: member.nickname || member.card || '',
                card: member.card || '',
                title: member.title || '',
                level: member.level || 0,
                joinTime: member.join_time || 0,
                lastSpeakTime: member.last_speak_time || 0,
                isOwner: member.is_owner || false,
                isAdmin: member.is_admin || false
            };
        } catch (error) {
            logger.error(`[场景适配] 获取群成员信息失败: ${error.message}`);
            return null;
        }
    }

    /**
     * 获取群组信息
     * @returns {Promise<object|null>}
     */
    async getGroupInfo() {
        if (this.isPrivate()) {
            return null;
        }

        try {
            const group = this.group || this.e.bot?.pickGroup?.(this.groupId);
            if (!group) {
                return null;
            }

            return {
                groupId: String(this.groupId),
                groupName: group.name || group.group_name || '',
                memberCount: group.member_count || 0,
                maxMemberCount: group.max_member_count || 0,
                owner: group.owner || group.owner_id || '',
                createTime: group.create_time || 0
            };
        } catch (error) {
            logger.error(`[场景适配] 获取群组信息失败: ${error.message}`);
            return null;
        }
    }
}

/**
 * 场景适配器
 * 根据场景自动选择合适的消息发送方式
 */
export class SceneAdapter {
    /**
     * 创建场景适配器
     * @param {object} e - 事件对象
     * @returns {SceneAdapter}
     */
    static create(e) {
        return new SceneAdapter(e);
    }

    constructor(e) {
        this.context = new SceneContext(e);
        this.e = e;
    }

    /**
     * 发送消息（自动适配场景）
     * @param {Array|string} message - 消息内容
     * @param {object} options - 发送选项
     * @returns {Promise<MessageResult>}
     */
    async sendMessage(message, options = {}) {
        try {
            const { MessageSender } = await import('./messageUtils.js');

            if (this.context.isPrivate()) {
                return await this._sendPrivateMessage(message, options);
            } else {
                return await this._sendGroupMessage(message, options);
            }
        } catch (error) {
            logger.error(`[场景适配] 发送消息失败: ${error.message}`);
            return MessageResult.fail(`发送消息失败: ${error.message}`);
        }
    }

    /**
     * 发送私聊消息
     * @param {Array|string} message - 消息内容
     * @param {object} options - 发送选项
     * @returns {Promise<MessageResult>}
     */
    async _sendPrivateMessage(message, options) {
        const { MessageSender } = await import('./messageUtils.js');

        if (options.targetUserId) {
            return await MessageSender.sendPrivate(this.e.bot, options.targetUserId, message);
        }

        return await MessageSender.send(this.e, message, options);
    }

    /**
     * 发送群消息
     * @param {Array|string} message - 消息内容
     * @param {object} options - 发送选项
     * @returns {Promise<MessageResult>}
     */
    async _sendGroupMessage(message, options) {
        const { MessageSender } = await import('./messageUtils.js');

        if (options.targetGroupId) {
            return await MessageSender.sendGroup(this.e.bot, options.targetGroupId, message);
        }

        return await MessageSender.send(this.e, message, options);
    }

    /**
     * 发送图片
     * @param {string} url - 图片URL
     * @param {string} [caption] - 图片说明
     * @returns {Promise<MessageResult>}
     */
    async sendImage(url, caption = null) {
        const { MessageBuilder, MessageSender } = await import('./messageUtils.js');

        const builder = new MessageBuilder();
        builder.image(url, caption);

        return await MessageSender.send(this.e, builder.build());
    }

    /**
     * 发送@消息
     * @param {string} userId - 用户ID
     * @param {string} text - 文本内容
     * @returns {Promise<MessageResult>}
     */
    async sendAtMessage(userId, text) {
        if (this.context.isPrivate()) {
            return MessageResult.fail('私聊场景不支持@功能');
        }

        const { MessageBuilder, MessageSender } = await import('./messageUtils.js');

        const builder = new MessageBuilder();
        builder.at(userId).text(text);

        return await MessageSender.send(this.e, builder.build());
    }

    /**
     * 发送回复消息
     * @param {string} messageId - 消息ID
     * @param {string} text - 文本内容
     * @returns {Promise<MessageResult>}
     */
    async sendReplyMessage(messageId, text) {
        const { MessageSender } = await import('./messageUtils.js');

        return await MessageSender.send(this.e, text, { replyTo: messageId });
    }

    /**
     * 撤回消息
     * @param {string} messageId - 消息ID
     * @returns {Promise<MessageResult>}
     */
    async recallMessage(messageId) {
        const { MessageRecaller } = await import('./messageUtils.js');

        return await MessageRecaller.recall(this.e, messageId);
    }

    /**
     * 转发消息到其他群
     * @param {string} targetGroupId - 目标群ID
     * @param {Array|string} message - 消息内容
     * @returns {Promise<MessageResult>}
     */
    async forwardMessage(targetGroupId, message) {
        const { MessageSender } = await import('./messageUtils.js');

        return await MessageSender.sendGroup(this.e.bot, targetGroupId, message);
    }

    /**
     * 设置精华消息
     * @param {string} messageId - 消息ID
     * @returns {Promise<MessageResult>}
     */
    async setEssenceMessage(messageId) {
        if (this.context.isPrivate()) {
            return MessageResult.fail('私聊场景不支持设置精华消息');
        }

        const permission = await this.context.getBotPermission();
        if (!permission.canSetEssence) {
            return MessageResult.fail('设置精华消息需要Bot是管理员');
        }

        try {
            const group = this.context.group || this.e.bot?.pickGroup?.(this.context.groupId);
            if (!group) {
                return MessageResult.fail('无法获取群组信息');
            }

            await group.setEssenceMessage?.(messageId);

            logger.mark(`[精华消息] 设置成功 | 群:${this.context.groupId} | 消息ID:${messageId}`);

            return MessageResult.ok({ messageId, set: true });
        } catch (error) {
            logger.error(`[精华消息] 设置失败: ${error.message}`);
            return MessageResult.fail(`设置精华消息失败: ${error.message}`);
        }
    }

    /**
     * 检查是否可以执行操作
     * @param {string} operation - 操作类型
     * @param {string} [targetUserId] - 目标用户ID
     * @returns {Promise<object>}
     */
    async canPerformOperation(operation, targetUserId = null) {
        const botPermission = await this.context.getBotPermission();

        const operationMap = {
            mute: 'canMute',
            kick: 'canKick',
            setCard: 'canSetCard',
            setTitle: 'canSetTitle',
            setEssence: 'canSetEssence'
        };

        const permissionKey = operationMap[operation];
        if (!permissionKey) {
            return { canPerform: false, reason: `未知操作: ${operation}` };
        }

        if (!botPermission[permissionKey]) {
            return { canPerform: false, reason: `Bot没有${operation}权限` };
        }

        if (targetUserId && this.context.isGroup()) {
            const userPermission = await this.context.getUserPermission(targetUserId);

            if (userPermission.isOwner) {
                return { canPerform: false, reason: '无法对群主执行此操作' };
            }

            if (userPermission.isAdmin && !botPermission.isOwner) {
                return { canPerform: false, reason: 'Bot不是群主，无法对管理员执行此操作' };
            }
        }

        return { canPerform: true };
    }

    /**
     * 获取场景上下文信息
     * @returns {object}
     */
    getContextInfo() {
        return {
            type: this.context.type,
            userId: this.context.userId,
            groupId: this.context.groupId,
            botId: this.context.botId,
            messageId: this.context.messageId,
            description: this.context.getDescription()
        };
    }
}

export default {
    SceneType,
    SceneContext,
    SceneAdapter
};
