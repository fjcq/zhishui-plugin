/**
 * 用户数据管理模块
 * 使用Redis存储用户好感度、历史记录等数据
 */

/**
 * 获取用户好感度
 * @param {string} userId - 用户ID
 * @returns {Promise<number>} 好感度值，默认0
 */
export async function getUserFavor(userId) {
    try {
        const key = `zhishui:chat:favor:${userId}`;
        const value = await redis.get(key);
        return value ? parseInt(value) : 0;
    } catch (error) {
        logger.error(`获取用户好感度失败: ${error.message}`);
        return 0;
    }
}

/**
 * 设置用户好感度
 * @param {string} userId - 用户ID
 * @param {number} favor - 好感度值
 * @returns {Promise<boolean>} 是否设置成功
 */
export async function setUserFavor(userId, favor) {
    try {
        const key = `zhishui:chat:favor:${userId}`;
        const clampedFavor = Math.max(-100, Math.min(100, favor));
        await redis.set(key, clampedFavor, { EX: 86400 });
        return true;
    } catch (error) {
        logger.error(`设置用户好感度失败: ${error.message}`);
        return false;
    }
}

/**
 * 获取用户完整信息
 * @param {string} userId - 用户ID
 * @returns {Promise<Object>} 用户信息对象
 */
export async function getUserData(userId) {
    try {
        const key = `zhishui:chat:user:${userId}`;
        const data = await redis.hgetall(key);
        
        if (!data || Object.keys(data).length === 0) {
            return {
                userId,
                favor: 0,
                chatCount: 0,
                lastChatTime: 0,
                nickname: '',
                achievements: []
            };
        }

        return {
            userId,
            favor: parseInt(data.favor || 0),
            chatCount: parseInt(data.chatCount || 0),
            lastChatTime: parseInt(data.lastChatTime || 0),
            nickname: data.nickname || '',
            achievements: data.achievements ? JSON.parse(data.achievements) : []
        };
    } catch (error) {
        logger.error(`获取用户数据失败: ${error.message}`);
        return {
            userId,
            favor: 0,
            chatCount: 0,
            lastChatTime: 0,
            nickname: '',
            achievements: []
        };
    }
}

/**
 * 设置用户昵称
 * @param {string} userId - 用户ID
 * @param {string} nickname - 昵称
 * @returns {Promise<boolean>} 是否设置成功
 */
export async function setUserNickname(userId, nickname) {
    try {
        const key = `zhishui:chat:user:${userId}`;
        await redis.hset(key, 'nickname', nickname);
        await redis.expire(key, 86400);
        return true;
    } catch (error) {
        logger.error(`设置用户昵称失败: ${error.message}`);
        return false;
    }
}

/**
 * 更新最后聊天时间
 * @param {string} userId - 用户ID
 * @returns {Promise<boolean>} 是否更新成功
 */
export async function updateLastChatTime(userId) {
    try {
        const key = `zhishui:chat:user:${userId}`;
        const now = Date.now();
        await redis.hset(key, 'lastChatTime', now);
        await redis.expire(key, 86400);
        return true;
    } catch (error) {
        logger.error(`更新最后聊天时间失败: ${error.message}`);
        return false;
    }
}

/**
 * 增加聊天次数
 * @param {string} userId - 用户ID
 * @returns {Promise<number>} 新的聊天次数
 */
export async function incrementChatCount(userId) {
    try {
        const key = `zhishui:chat:user:${userId}`;
        const count = await redis.hincrby(key, 'chatCount', 1);
        await redis.expire(key, 86400);
        return count;
    } catch (error) {
        logger.error(`增加聊天次数失败: ${error.message}`);
        return 0;
    }
}

/**
 * 添加好感度变化历史
 * @param {string} userId - 用户ID
 * @param {number} change - 变化值
 * @param {string} reason - 变化原因
 * @param {number} favorBefore - 变化前好感度
 * @param {number} favorAfter - 变化后好感度
 * @returns {Promise<boolean>} 是否添加成功
 */
export async function addFavorHistory(userId, change, reason, favorBefore, favorAfter) {
    try {
        // 检查redis对象是否支持列表操作
        if (typeof redis.lpush !== 'function') {
            // 如果不支持列表操作，使用简单的get/set操作存储最近的记录
            const key = `zhishui:chat:history:${userId}`;
            let history = [];
            
            // 获取现有历史记录
            const existing = await redis.get(key);
            if (existing) {
                try {
                    history = JSON.parse(existing);
                    // 确保是数组
                    if (!Array.isArray(history)) {
                        history = [];
                    }
                } catch (e) {
                    history = [];
                }
            }
            
            // 添加新记录到开头
            const record = {
                time: Date.now(),
                change,
                reason,
                favorBefore,
                favorAfter
            };
            history.unshift(record);
            
            // 只保留最近100条记录
            if (history.length > 100) {
                history = history.slice(0, 100);
            }
            
            // 保存回Redis
            await redis.set(key, JSON.stringify(history), { EX: 604800 });
            return true;
        }
        
        // 如果支持列表操作，使用原有的实现
        const key = `zhishui:chat:history:${userId}`;
        const record = {
            time: Date.now(),
            change,
            reason,
            favorBefore,
            favorAfter
        };
        
        await redis.lpush(key, JSON.stringify(record));
        await redis.ltrim(key, 0, 99);
        await redis.expire(key, 604800);
        
        return true;
    } catch (error) {
        logger.error(`添加好感度历史失败: ${error.message}`);
        return false;
    }
}

/**
 * 获取好感度历史记录
 * @param {string} userId - 用户ID
 * @param {number} limit - 返回记录数量，默认10条
 * @returns {Promise<Array>} 历史记录数组
 */
export async function getFavorHistory(userId, limit = 10) {
    try {
        const key = `zhishui:chat:history:${userId}`;
        const records = await redis.lrange(key, 0, limit - 1);
        return records.map(record => JSON.parse(record));
    } catch (error) {
        logger.error(`获取好感度历史失败: ${error.message}`);
        return [];
    }
}

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
 * 添加成就
 * @param {string} userId - 用户ID
 * @param {string} achievementId - 成就ID
 * @returns {Promise<boolean>} 是否是新解锁的成就
 */
export async function addAchievement(userId, achievementId) {
    try {
        const key = `zhishui:chat:achievements:${userId}`;
        const isNew = await redis.sadd(key, achievementId) === 1;
        await redis.expire(key, 2592000);
        
        if (isNew) {
            const userKey = `zhishui:chat:user:${userId}`;
            const achievements = await getUserAchievements(userId);
            await redis.hset(userKey, 'achievements', JSON.stringify([...achievements, achievementId]));
            await redis.expire(userKey, 86400);
        }
        
        return isNew;
    } catch (error) {
        logger.error(`添加成就失败: ${error.message}`);
        return false;
    }
}

/**
 * 获取用户成就列表
 * @param {string} userId - 用户ID
 * @returns {Promise<Array>} 成就ID数组
 */
export async function getUserAchievements(userId) {
    try {
        const key = `zhishui:chat:achievements:${userId}`;
        return await redis.smembers(key);
    } catch (error) {
        logger.error(`获取用户成就失败: ${error.message}`);
        return [];
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
