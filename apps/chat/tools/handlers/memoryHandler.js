/**
 * 记忆工具处理函数
 * 处理AI调用的记忆相关工具
 */

/**
 * 记忆存储键前缀
 */
const MEMORY_PREFIX = 'zhishui:memory:';
const REMINDER_PREFIX = 'zhishui:reminder:';
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
                return await handleSetReminder(params, user_id);
            case 'get_reminders':
                return await handleGetReminders(params, user_id);
            case 'cancel_reminder':
                return await handleCancelReminder(params);
            case 'record_interaction':
                return await handleRecordInteraction(params, user_id);
            case 'get_interaction_history':
                return await handleGetInteractionHistory(params, user_id);
            default:
                return { error: true, message: `未知的记忆工具: ${toolName}` };
        }
    } catch (error) {
        logger.error(`[记忆工具] ${toolName} 执行失败: ${error.message}`);
        return { error: true, message: `操作失败: ${error.message}` };
    }
}

/**
 * 获取Redis客户端
 * @returns {object|null} Redis客户端
 */
function getRedis() {
    if (typeof redis !== 'undefined') {
        return redis;
    }
    return null;
}

/**
 * 处理记录用户信息
 */
async function handleRememberUserInfo(params, user_id) {
    const { key, value, expire_days = 30 } = params;

    if (!key || !value) {
        return { error: true, message: '缺少键名或内容参数' };
    }

    if (!user_id) {
        return { error: true, message: '缺少用户ID参数' };
    }

    const redisClient = getRedis();
    if (!redisClient) {
        return { error: true, message: 'Redis服务不可用' };
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
            expire_days: expire_days,
            message: `已记住: ${key} = ${value}`
        };
    } catch (error) {
        return { error: true, message: `记录失败: ${error.message}` };
    }
}

/**
 * 处理获取用户信息
 */
async function handleRecallUserInfo(params, user_id) {
    const { key } = params;

    if (!user_id) {
        return { error: true, message: '缺少用户ID参数' };
    }

    const redisClient = getRedis();
    if (!redisClient) {
        return { error: true, message: 'Redis服务不可用' };
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
                    value: null,
                    message: `没有找到关于 "${key}" 的记忆`
                };
            }

            const memoryData = JSON.parse(data);
            return {
                success: true,
                user_id: user_id,
                key: key,
                value: memoryData.value,
                created_at: memoryData.created_at,
                message: `回忆起: ${key} = ${memoryData.value}`
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
            count: count,
            message: count > 0 ? `找到 ${count} 条记忆` : '暂无记忆'
        };
    } catch (error) {
        return { error: true, message: `获取记忆失败: ${error.message}` };
    }
}

/**
 * 处理删除用户信息
 */
async function handleForgetUserInfo(params, user_id) {
    const { key } = params;

    if (!user_id) {
        return { error: true, message: '缺少用户ID参数' };
    }

    const redisClient = getRedis();
    if (!redisClient) {
        return { error: true, message: 'Redis服务不可用' };
    }

    try {
        const memoryKey = `${MEMORY_PREFIX}${user_id}`;

        if (key) {
            await redisClient.hDel(memoryKey, key);
            logger.info(`[记忆] 删除用户信息 | 用户:${user_id} | 键:${key}`);
            return {
                success: true,
                user_id: user_id,
                key: key,
                message: `已忘记: ${key}`
            };
        }

        await redisClient.del(memoryKey);
        logger.info(`[记忆] 清空用户记忆 | 用户:${user_id}`);
        return {
            success: true,
            user_id: user_id,
            message: '已清空所有记忆'
        };
    } catch (error) {
        return { error: true, message: `删除记忆失败: ${error.message}` };
    }
}

/**
 * 处理设置提醒
 */
async function handleSetReminder(params, user_id) {
    const { content, remind_time } = params;

    if (!content || !remind_time) {
        return { error: true, message: '缺少提醒内容或时间参数' };
    }

    if (!user_id) {
        return { error: true, message: '缺少用户ID参数' };
    }

    const redisClient = getRedis();
    if (!redisClient) {
        return { error: true, message: 'Redis服务不可用' };
    }

    try {
        const remindTimestamp = parseRemindTime(remind_time);
        if (!remindTimestamp) {
            return { error: true, message: '无法解析提醒时间，请使用格式：YYYY-MM-DD HH:MM 或相对时间' };
        }

        if (remindTimestamp <= Date.now()) {
            return { error: true, message: '提醒时间必须是将来的时间' };
        }

        const reminderId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const reminderKey = `${REMINDER_PREFIX}${user_id}`;

        const reminder = {
            id: reminderId,
            content: content,
            remind_time: remindTimestamp,
            created_at: Date.now(),
            status: 'pending'
        };

        await redisClient.hSet(reminderKey, reminderId, JSON.stringify(reminder));

        const ttl = Math.floor((remindTimestamp - Date.now()) / 1000) + 86400;
        await redisClient.expire(reminderKey, ttl);

        logger.info(`[记忆] 设置提醒 | 用户:${user_id} | 时间:${new Date(remindTimestamp).toLocaleString()}`);

        return {
            success: true,
            reminder_id: reminderId,
            user_id: user_id,
            content: content,
            remind_time: new Date(remindTimestamp).toLocaleString(),
            message: `已设置提醒: ${content}，将在 ${new Date(remindTimestamp).toLocaleString()} 提醒`
        };
    } catch (error) {
        return { error: true, message: `设置提醒失败: ${error.message}` };
    }
}

/**
 * 解析提醒时间
 * @param {string} timeStr - 时间字符串
 * @returns {number|null} 时间戳
 */
function parseRemindTime(timeStr) {
    const now = Date.now();

    const relativePatterns = [
        { pattern: /^(\d+)\s*秒后$/, unit: 1000 },
        { pattern: /^(\d+)\s*分钟后$/, unit: 60000 },
        { pattern: /^(\d+)\s*小时后$/, unit: 3600000 },
        { pattern: /^(\d+)\s*天后$/, unit: 86400000 },
        { pattern: /^(\d+)\s*周后$/, unit: 604800000 }
    ];

    for (const { pattern, unit } of relativePatterns) {
        const match = timeStr.match(pattern);
        if (match) {
            return now + parseInt(match[1]) * unit;
        }
    }

    const absolutePattern = /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2})$/;
    const match = timeStr.match(absolutePattern);
    if (match) {
        const [, year, month, day, hour, minute] = match;
        return new Date(year, month - 1, day, hour, minute).getTime();
    }

    const tomorrowPattern = /^明天\s*(上午|下午|晚上)?\s*(\d{1,2}):?(\d{1,2})?$/;
    const tomorrowMatch = timeStr.match(tomorrowPattern);
    if (tomorrowMatch) {
        const [, period, hour, minute = 0] = tomorrowMatch;
        let h = parseInt(hour);
        if (period === '下午' || period === '晚上') {
            h += 12;
        }
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(h, parseInt(minute), 0, 0);
        return tomorrow.getTime();
    }

    return null;
}

/**
 * 处理获取提醒列表
 */
async function handleGetReminders(params, user_id) {
    if (!user_id) {
        return { error: true, message: '缺少用户ID参数' };
    }

    const redisClient = getRedis();
    if (!redisClient) {
        return { error: true, message: 'Redis服务不可用' };
    }

    try {
        const reminderKey = `${REMINDER_PREFIX}${user_id}`;
        const allData = await redisClient.hGetAll(reminderKey);

        const reminders = [];
        const now = Date.now();

        for (const [, v] of Object.entries(allData)) {
            try {
                const reminder = JSON.parse(v);
                if (reminder.status === 'pending' && reminder.remind_time > now) {
                    reminders.push({
                        id: reminder.id,
                        content: reminder.content,
                        remind_time: new Date(reminder.remind_time).toLocaleString()
                    });
                }
            } catch {
                // 忽略解析错误
            }
        }

        reminders.sort((a, b) => new Date(a.remind_time) - new Date(b.remind_time));

        return {
            success: true,
            user_id: user_id,
            reminders: reminders,
            count: reminders.length,
            message: reminders.length > 0 ? `有 ${reminders.length} 个待提醒` : '暂无待提醒'
        };
    } catch (error) {
        return { error: true, message: `获取提醒失败: ${error.message}` };
    }
}

/**
 * 处理取消提醒
 */
async function handleCancelReminder(params) {
    const { reminder_id } = params;

    if (!reminder_id) {
        return { error: true, message: '缺少提醒ID参数' };
    }

    const redisClient = getRedis();
    if (!redisClient) {
        return { error: true, message: 'Redis服务不可用' };
    }

    try {
        const keys = await redisClient.keys(`${REMINDER_PREFIX}*`);
        let found = false;

        for (const key of keys) {
            const data = await redisClient.hGet(key, reminder_id);
            if (data) {
                const reminder = JSON.parse(data);
                reminder.status = 'cancelled';
                await redisClient.hSet(key, reminder_id, JSON.stringify(reminder));
                found = true;
                logger.info(`[记忆] 取消提醒 | ID:${reminder_id}`);
                break;
            }
        }

        if (!found) {
            return { error: true, message: '未找到该提醒' };
        }

        return {
            success: true,
            reminder_id: reminder_id,
            message: '提醒已取消'
        };
    } catch (error) {
        return { error: true, message: `取消提醒失败: ${error.message}` };
    }
}

/**
 * 处理记录互动事件
 */
async function handleRecordInteraction(params, user_id) {
    const { event_type, content } = params;

    if (!event_type || !content) {
        return { error: true, message: '缺少事件类型或内容参数' };
    }

    if (!user_id) {
        return { error: true, message: '缺少用户ID参数' };
    }

    const redisClient = getRedis();
    if (!redisClient) {
        return { error: true, message: 'Redis服务不可用' };
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
            event_type: event_type,
            message: `已记录互动事件: ${event_type}`
        };
    } catch (error) {
        return { error: true, message: `记录互动失败: ${error.message}` };
    }
}

/**
 * 处理获取互动历史
 */
async function handleGetInteractionHistory(params, user_id) {
    const { event_type, limit = 10 } = params;

    if (!user_id) {
        return { error: true, message: '缺少用户ID参数' };
    }

    const redisClient = getRedis();
    if (!redisClient) {
        return { error: true, message: 'Redis服务不可用' };
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
            count: result.length,
            message: result.length > 0 ? `找到 ${result.length} 条互动记录` : '暂无互动记录'
        };
    } catch (error) {
        return { error: true, message: `获取互动历史失败: ${error.message}` };
    }
}
