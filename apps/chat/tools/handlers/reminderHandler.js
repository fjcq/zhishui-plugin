/**
 * 提醒工具处理函数
 * 处理AI调用的提醒相关工具
 */

import { getRedis } from './shared/utils.js';

const logger = global.logger || console;

/**
 * 提醒存储键前缀
 */
const REMINDER_PREFIX = 'zhishui:reminder:';

/**
 * 处理提醒工具调用
 * @param {string} toolName - 工具名称
 * @param {object} params - 工具参数
 * @param {string} currentUserId - 当前对话用户ID
 * @returns {Promise<object>} 工具执行结果
 */
export async function handleReminderToolCall(toolName, params, currentUserId) {
    try {
        const user_id = params.user_id || currentUserId;

        switch (toolName) {
            case 'set_reminder':
                return await handleSetReminder(params, user_id);
            case 'get_reminders':
                return await handleGetReminders(params, user_id);
            case 'cancel_reminder':
                return await handleCancelReminder(params);
            default:
                return { error: true, error_message: `未知的提醒工具: ${toolName}` };
        }
    } catch (error) {
        logger.error(`[提醒工具] ${toolName} 执行失败: ${error.message}`);
        return { error: true, error_message: `操作失败: ${error.message}` };
    }
}

/**
 * 处理设置提醒
 */
async function handleSetReminder(params, user_id) {
    const { content, remind_time } = params;

    if (!content || !remind_time) {
        return { error: true, error_message: '缺少提醒内容或时间参数' };
    }

    if (!user_id) {
        return { error: true, error_message: '缺少用户ID参数' };
    }

    const redisClient = getRedis();
    if (!redisClient) {
        return { error: true, error_message: 'Redis服务不可用' };
    }

    try {
        const remindTimestamp = parseRemindTime(remind_time);
        if (!remindTimestamp) {
            return { error: true, error_message: '无法解析提醒时间，请使用格式：YYYY-MM-DD HH:MM 或相对时间' };
        }

        if (remindTimestamp <= Date.now()) {
            return { error: true, error_message: '提醒时间必须是将来的时间' };
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
            remind_time: new Date(remindTimestamp).toLocaleString()
        };
    } catch (error) {
        return { error: true, error_message: `设置提醒失败: ${error.message}` };
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
        return { error: true, error_message: '缺少用户ID参数' };
    }

    const redisClient = getRedis();
    if (!redisClient) {
        return { error: true, error_message: 'Redis服务不可用' };
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
            count: reminders.length
        };
    } catch (error) {
        return { error: true, error_message: `获取提醒失败: ${error.message}` };
    }
}

/**
 * 处理取消提醒
 */
async function handleCancelReminder(params) {
    const { reminder_id } = params;

    if (!reminder_id) {
        return { error: true, error_message: '缺少提醒ID参数' };
    }

    const redisClient = getRedis();
    if (!redisClient) {
        return { error: true, error_message: 'Redis服务不可用' };
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
            return { error: true, error_message: '未找到该提醒' };
        }

        return {
            success: true,
            reminder_id: reminder_id
        };
    } catch (error) {
        return { error: true, error_message: `取消提醒失败: ${error.message}` };
    }
}
