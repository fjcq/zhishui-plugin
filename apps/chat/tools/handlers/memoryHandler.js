/**
 * 记忆工具处理函数
 * 处理AI调用的记忆相关工具
 */

import { handleReminderToolCall } from './reminderHandler.js';
import { getRedis } from './shared/utils.js';

const logger = global.logger || console;

/**
 * 记忆存储键前缀
 */
const MEMORY_PREFIX = 'zhishui:memory:';
const INTERACTION_PREFIX = 'zhishui:interaction:';

/**
 * 处理记忆工具调用
 * @param {string} toolName - 工具名称
 * @param {object} params - 工具参数
 * @param {string} currentUserId - 当前对话用户ID
 * @returns {Promise<object>} 工具执行结果
 */
export async function handleMemoryToolCall(toolName, params, currentUserId) {
    try {
        const user_id = params.user_id || currentUserId;

        switch (toolName) {
            case 'remember_user_info':
                return await handleRememberUserInfo(params, user_id);
            case 'recall_user_info':
                return await handleRecallUserInfo(params, user_id);
            case 'forget_user_info':
                return await handleForgetUserInfo(params, user_id);
            case 'set_reminder':
            case 'get_reminders':
            case 'cancel_reminder':
                return await handleReminderToolCall(toolName, params, user_id);
            case 'record_interaction':
                return await handleRecordInteraction(params, user_id);
            case 'get_interaction_history':
                return await handleGetInteractionHistory(params, user_id);
            default:
                return { error: true, error_message: `未知的记忆工具: ${toolName}` };
        }
    } catch (error) {
        logger.error(`[记忆工具] ${toolName} 执行失败: ${error.message}`);
        return { error: true, error_message: `操作失败: ${error.message}` };
    }
}

/**
 * 处理记录用户信息
 */
async function handleRememberUserInfo(params, user_id) {
    const { key, value, expire_days = 30 } = params;

    if (!key || !value) {
        return { error: true, error_message: '缺少键名或内容参数' };
    }

    if (!user_id) {
        return { error: true, error_message: '缺少用户ID参数' };
    }

    const redisClient = getRedis();
    if (!redisClient) {
        return { error: true, error_message: 'Redis服务不可用' };
    }

    try {
        const memoryKey = `${MEMORY_PREFIX}${user_id}`;
        const timestamp = Date.now();
        const memoryData = {
            value: value,
            created_at: timestamp,
            updated_at: timestamp,
            expire_days: expire_days
        };

        await redisClient.hSet(memoryKey, key, JSON.stringify(memoryData));

        if (expire_days > 0) {
            const expireSeconds = expire_days * 24 * 60 * 60;
            await redisClient.expire(memoryKey, expireSeconds);
        }

        logger.info(`[记忆] 记录用户信息 | 用户:${user_id} | 键:${key}`);

        return {
            success: true,
            user_id: user_id,
            key: key,
            value: value,
            expire_days: expire_days
        };
    } catch (error) {
        return { error: true, error_message: `记录失败: ${error.message}` };
    }
}

/**
 * 处理获取用户信息
 */
async function handleRecallUserInfo(params, user_id) {
    const { key } = params;

    if (!user_id) {
        return { error: true, error_message: '缺少用户ID参数' };
    }

    const redisClient = getRedis();
    if (!redisClient) {
        return { error: true, error_message: 'Redis服务不可用' };
    }

    try {
        const memoryKey = `${MEMORY_PREFIX}${user_id}`;

        if (key) {
            const data = await redisClient.hGet(memoryKey, key);
            if (!data) {
                return {
                    success: true,
                    user_id: user_id,
                    key: key,
                    value: null
                };
            }

            const memoryData = JSON.parse(data);
            return {
                success: true,
                user_id: user_id,
                key: key,
                value: memoryData.value,
                created_at: memoryData.created_at
            };
        }

        const allData = await redisClient.hGetAll(memoryKey);
        const memories = {};

        for (const [k, v] of Object.entries(allData)) {
            try {
                const parsed = JSON.parse(v);
                memories[k] = {
                    value: parsed.value,
                    created_at: parsed.created_at
                };
            } catch {
                memories[k] = { value: v };
            }
        }

        const count = Object.keys(memories).length;
        return {
            success: true,
            user_id: user_id,
            memories: memories,
            count: count
        };
    } catch (error) {
        return { error: true, error_message: `获取记忆失败: ${error.message}` };
    }
}

/**
 * 处理删除用户信息
 */
async function handleForgetUserInfo(params, user_id) {
    const { key } = params;

    if (!user_id) {
        return { error: true, error_message: '缺少用户ID参数' };
    }

    const redisClient = getRedis();
    if (!redisClient) {
        return { error: true, error_message: 'Redis服务不可用' };
    }

    try {
        const memoryKey = `${MEMORY_PREFIX}${user_id}`;

        if (key) {
            await redisClient.hDel(memoryKey, key);
            logger.info(`[记忆] 删除用户信息 | 用户:${user_id} | 键:${key}`);
            return {
                success: true,
                user_id: user_id,
                key: key
            };
        }

        await redisClient.del(memoryKey);
        logger.info(`[记忆] 清空用户记忆 | 用户:${user_id}`);
        return {
            success: true,
            user_id: user_id
        };
    } catch (error) {
        return { error: true, error_message: `删除记忆失败: ${error.message}` };
    }
}

/**
 * 处理记录互动事件
 */
async function handleRecordInteraction(params, user_id) {
    const { event_type, content } = params;

    if (!event_type || !content) {
        return { error: true, error_message: '缺少事件类型或内容参数' };
    }

    if (!user_id) {
        return { error: true, error_message: '缺少用户ID参数' };
    }

    const redisClient = getRedis();
    if (!redisClient) {
        return { error: true, error_message: 'Redis服务不可用' };
    }

    try {
        const interactionKey = `${INTERACTION_PREFIX}${user_id}`;
        const timestamp = Date.now();
        const interactionId = `${timestamp}_${Math.random().toString(36).substring(2, 8)}`;

        const interaction = {
            id: interactionId,
            event_type: event_type,
            content: content,
            created_at: timestamp
        };

        await redisClient.zAdd(interactionKey, [{ score: timestamp, value: JSON.stringify(interaction) }]);

        const maxRecords = 100;
        const total = await redisClient.zCard(interactionKey);
        if (total > maxRecords) {
            await redisClient.zRemRangeByRank(interactionKey, 0, total - maxRecords - 1);
        }

        logger.info(`[记忆] 记录互动 | 用户:${user_id} | 类型:${event_type}`);

        return {
            success: true,
            interaction_id: interactionId,
            user_id: user_id,
            event_type: event_type
        };
    } catch (error) {
        return { error: true, error_message: `记录互动失败: ${error.message}` };
    }
}

/**
 * 处理获取互动历史
 */
async function handleGetInteractionHistory(params, user_id) {
    const { event_type, limit = 10 } = params;

    if (!user_id) {
        return { error: true, error_message: '缺少用户ID参数' };
    }

    const redisClient = getRedis();
    if (!redisClient) {
        return { error: true, error_message: 'Redis服务不可用' };
    }

    try {
        const interactionKey = `${INTERACTION_PREFIX}${user_id}`;

        const interactions = await redisClient.zRange(interactionKey, -limit, -1, { REV: true });

        const result = [];
        for (const data of interactions) {
            try {
                const interaction = JSON.parse(data);
                if (!event_type || interaction.event_type === event_type) {
                    result.push({
                        id: interaction.id,
                        event_type: interaction.event_type,
                        content: interaction.content,
                        created_at: new Date(interaction.created_at).toLocaleString()
                    });
                }
            } catch {
                // 忽略解析错误
            }
        }

        return {
            success: true,
            user_id: user_id,
            interactions: result,
            count: result.length
        };
    } catch (error) {
        return { error: true, error_message: `获取互动历史失败: ${error.message}` };
    }
}
