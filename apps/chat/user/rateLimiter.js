/**
 * 频率限制模块
 * 处理用户请求频率限制
 */

const logger = global.logger || console;

/**
 * 检查频率限制
 * @param {string} userId - 用户ID
 * @returns {Promise<Object>} 检查结果 {allowed: boolean, reason?: string, message?: string}
 */
export async function checkRateLimit(userId) {
    try {
        const now = Date.now();
        const minuteKey = `zhishui:chat:ratelimit:minute:${userId}`;
        const hourKey = `zhishui:chat:ratelimit:hour:${userId}`;
        const dayKey = `zhishui:chat:ratelimit:day:${userId}`;

        const minuteCount = await redis.get(minuteKey) || 0;
        const hourCount = await redis.get(hourKey) || 0;
        const dayCount = await redis.get(dayKey) || 0;

        if (parseInt(minuteCount) >= 10) {
            return {
                allowed: false,
                reason: 'minute',
                message: '您说话太快了，请稍后再试~'
            };
        }

        if (parseInt(hourCount) >= 50) {
            return {
                allowed: false,
                reason: 'hour',
                message: '今天聊得太多了，休息一下吧~'
            };
        }

        if (parseInt(dayCount) >= 200) {
            return {
                allowed: false,
                reason: 'day',
                message: '今天的对话次数已用完，明天再来吧~'
            };
        }

        const minuteExpire = 60 - (now % 60000) / 1000;
        const hourExpire = 3600 - (now % 3600000) / 1000;
        const dayExpire = 86400 - (now % 86400000) / 1000;

        await redis.incr(minuteKey);
        await redis.expire(minuteKey, Math.ceil(minuteExpire));

        await redis.incr(hourKey);
        await redis.expire(hourKey, Math.ceil(hourExpire));

        await redis.incr(dayKey);
        await redis.expire(dayKey, Math.ceil(dayExpire));

        return { allowed: true };
    } catch (error) {
        logger.error(`检查频率限制失败: ${error.message}`);
        return { allowed: true };
    }
}

/**
 * 清除用户频率限制
 * @param {string} userId - 用户ID
 * @returns {Promise<boolean>} 是否清除成功
 */
export async function clearRateLimit(userId) {
    try {
        const minuteKey = `zhishui:chat:ratelimit:minute:${userId}`;
        const hourKey = `zhishui:chat:ratelimit:hour:${userId}`;
        const dayKey = `zhishui:chat:ratelimit:day:${userId}`;

        await redis.del(minuteKey, hourKey, dayKey);
        return true;
    } catch (error) {
        logger.error(`清除频率限制失败: ${error.message}`);
        return false;
    }
}
