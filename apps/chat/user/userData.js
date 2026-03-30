/**
 * 用户数据模块
 * 处理用户完整信息的存储和读取
 */

const logger = global.logger || console;

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
        return count;
    } catch (error) {
        logger.error(`增加聊天次数失败: ${error.message}`);
        return 0;
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

        if (isNew) {
            const userKey = `zhishui:chat:user:${userId}`;
            const achievements = await getUserAchievements(userId);
            await redis.hset(userKey, 'achievements', JSON.stringify([...achievements, achievementId]));
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
