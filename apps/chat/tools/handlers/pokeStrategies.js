/**
 * 戳一戳策略模式实现
 * 为不同的QQ机器人实现提供统一的API调用接口
 */

const logger = global.logger || console;

/**
 * 戳一戳策略基类
 * 定义统一的execute方法接口
 */
class PokeStrategy {
    /**
     * 获取策略名称
     * @returns {string} 策略名称
     */
    getName() {
        throw new Error('子类必须实现getName方法');
    }

    /**
     * 执行戳一戳操作
     * @param {string} userId - 目标用户ID
     * @param {object} context - 上下文信息
     * @param {object} context.e - 事件对象
     * @param {boolean} context.isGroup - 是否为群聊
     * @returns {Promise<{success: boolean, error?: string}>} 执行结果
     */
    async execute(userId, context) {
        throw new Error('子类必须实现execute方法');
    }
}

/**
 * NapCatQQ策略
 * 使用NapCatQQ的原生API实现戳一戳
 */
class NapCatPokeStrategy extends PokeStrategy {
    getName() {
        return 'NapCat';
    }

    async execute(userId, context) {
        const { e, isGroup } = context;

        if (!e.bot?.sendApi) {
            return { success: false };
        }

        try {
            if (isGroup) {
                await e.bot.sendApi('group_poke', {
                    group_id: Number(e.group_id),
                    user_id: Number(userId)
                });
                logger.info(`[互动] 戳一戳(group_poke) | 群:${e.group_id} | 用户:${userId}`);
            } else {
                await e.bot.sendApi('friend_poke', {
                    user_id: Number(userId)
                });
                logger.info(`[互动] 戳一戳(friend_poke) | 私聊用户:${userId}`);
            }
            return { success: true };
        } catch (err) {
            return { success: false, error: `${this.getName()}: ${err.message}` };
        }
    }
}

/**
 * OneBot标准API策略
 * 使用OneBot标准的set_group_poke/set_friend_poke API
 */
class OneBotApiPokeStrategy extends PokeStrategy {
    getName() {
        return 'OneBot-API';
    }

    async execute(userId, context) {
        const { e, isGroup } = context;

        if (!e.bot?.sendApi || !isGroup) {
            return { success: false };
        }

        try {
            await e.bot.sendApi('set_group_poke', {
                group_id: e.group_id,
                user_id: userId
            });
            logger.info(`[互动] 戳一戳(set_group_poke) | 群:${e.group_id} | 用户:${userId}`);
            return { success: true };
        } catch (err) {
            return { success: false, error: `${this.getName()}: ${err.message}` };
        }
    }
}

/**
 * OneBot标准方法策略
 * 使用OneBot标准的sendGroupPoke/sendFriendPoke方法
 */
class OneBotMethodPokeStrategy extends PokeStrategy {
    getName() {
        return 'OneBot-Method';
    }

    async execute(userId, context) {
        const { e, isGroup } = context;

        try {
            if (isGroup && typeof e.bot?.sendGroupPoke === 'function') {
                await e.bot.sendGroupPoke(e.group_id, userId);
                logger.info(`[互动] 戳一戳(sendGroupPoke) | 群:${e.group_id} | 用户:${userId}`);
                return { success: true };
            } else if (!isGroup && typeof e.bot?.sendFriendPoke === 'function') {
                await e.bot.sendFriendPoke(userId);
                logger.info(`[互动] 戳一戳(sendFriendPoke) | 私聊用户:${userId}`);
                return { success: true };
            }
            return { success: false };
        } catch (err) {
            return { success: false, error: `${this.getName()}: ${err.message}` };
        }
    }
}

/**
 * Yunzai原生策略
 * 使用Yunzai原生的pokeMember方法
 */
class YunzaiPokeStrategy extends PokeStrategy {
    getName() {
        return 'Yunzai';
    }

    async execute(userId, context) {
        const { e, isGroup } = context;

        if (!isGroup) {
            return { success: false };
        }

        const group = e.group || e.bot?.pickGroup?.(e.group_id);
        if (!group || typeof group.pokeMember !== 'function') {
            return { success: false };
        }

        try {
            await group.pokeMember(userId);
            logger.info(`[互动] 戳一戳(pokeMember) | 群:${e.group_id} | 用户:${userId}`);
            return { success: true };
        } catch (err) {
            return { success: false, error: `${this.getName()}: ${err.message}` };
        }
    }
}

/**
 * 消息格式策略
 * 通过发送特殊消息格式实现戳一戳
 */
class MessageFormatPokeStrategy extends PokeStrategy {
    getName() {
        return 'MessageFormat';
    }

    async execute(userId, context) {
        const { e, isGroup } = context;

        if (!isGroup) {
            return { success: false };
        }

        const group = e.group || e.bot?.pickGroup?.(e.group_id);
        if (!group || typeof group.sendMsg !== 'function') {
            return { success: false };
        }

        try {
            await group.sendMsg({ type: 'poke', data: { qq: Number(userId) } });
            logger.info(`[互动] 戳一戳(sendMsg) | 群:${e.group_id} | 用户:${userId}`);
            return { success: true };
        } catch (err) {
            return { success: false, error: `${this.getName()}: ${err.message}` };
        }
    }
}

/**
 * 戳一戳策略工厂
 * 负责创建和管理所有可用的策略
 */
class PokeStrategyFactory {
    /**
     * 创建所有可用的策略实例
     * @returns {PokeStrategy[]} 策略实例数组
     */
    static createStrategies() {
        return [
            new NapCatPokeStrategy(),
            new OneBotApiPokeStrategy(),
            new OneBotMethodPokeStrategy(),
            new YunzaiPokeStrategy(),
            new MessageFormatPokeStrategy()
        ];
    }

    /**
     * 根据策略名称创建策略实例
     * @param {string} name - 策略名称
     * @returns {PokeStrategy|null} 策略实例
     */
    static createStrategyByName(name) {
        const strategyMap = {
            'NapCat': NapCatPokeStrategy,
            'OneBot-API': OneBotApiPokeStrategy,
            'OneBot-Method': OneBotMethodPokeStrategy,
            'Yunzai': YunzaiPokeStrategy,
            'MessageFormat': MessageFormatPokeStrategy
        };

        const StrategyClass = strategyMap[name];
        return StrategyClass ? new StrategyClass() : null;
    }
}

export {
    PokeStrategy,
    NapCatPokeStrategy,
    OneBotApiPokeStrategy,
    OneBotMethodPokeStrategy,
    YunzaiPokeStrategy,
    MessageFormatPokeStrategy,
    PokeStrategyFactory
};
