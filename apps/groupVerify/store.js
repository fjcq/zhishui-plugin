/**
 * 入群验证会话存储
 * 基于 Redis 的待验证会话与通过记录管理，键名统一携带 zhishui: 前缀
 */

const PENDING_KEY_PREFIX = 'zhishui:groupVerify:pending';
const PASSED_KEY_PREFIX = 'zhishui:groupVerify:passed';

/**
 * 构建键名
 * @param {string} prefix - 键前缀
 * @param {string} botId - Bot账号
 * @param {string} groupId - 群号
 * @param {string} userId - 用户QQ
 * @returns {string} 完整键名
 */
function buildKey(prefix, botId, groupId, userId) {
    return `${prefix}:${botId}:${groupId}:${userId}`;
}

/**
 * 写入待验证会话
 * @param {string} botId - Bot账号
 * @param {string} groupId - 群号
 * @param {string} userId - 用户QQ
 * @param {object} data - 会话数据 { question, answers }
 * @param {number} ttl - 过期时间（秒）
 */
export async function setPending(botId, groupId, userId, data, ttl) {
    const key = buildKey(PENDING_KEY_PREFIX, botId, groupId, userId);
    await redis.set(key, JSON.stringify(data));
    await redis.expire(key, ttl);
}

/**
 * 读取待验证会话
 * @param {string} botId - Bot账号
 * @param {string} groupId - 群号
 * @param {string} userId - 用户QQ
 * @param {boolean} withTtl - 是否同时返回剩余有效期（秒）
 * @returns {Promise<{question: string, answers: string[]}|null>} 会话数据，无会话时返回 null；
 *           withTtl 时返回 { data, ttl } 结构
 */
export async function getPending(botId, groupId, userId, withTtl = false) {
    const key = buildKey(PENDING_KEY_PREFIX, botId, groupId, userId);
    const raw = await redis.get(key);
    if (!raw) {
        return null;
    }

    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        return null;
    }

    if (!withTtl) {
        return data;
    }

    const ttl = await redis.ttl(key);
    return { data, ttl: Number(ttl) > 0 ? Number(ttl) : 0 };
}

/**
 * 删除待验证会话
 * @param {string} botId - Bot账号
 * @param {string} groupId - 群号
 * @param {string} userId - 用户QQ
 */
export async function delPending(botId, groupId, userId) {
    await redis.del(buildKey(PENDING_KEY_PREFIX, botId, groupId, userId));
}

/**
 * 写入验证通过记录（用于冷却期内免验证）
 * @param {string} botId - Bot账号
 * @param {string} groupId - 群号
 * @param {string} userId - 用户QQ
 * @param {number} ttl - 免验证时长（秒），小于等于 0 时不记录
 */
export async function setPassed(botId, groupId, userId, ttl) {
    if (!ttl || ttl <= 0) {
        return;
    }
    const key = buildKey(PASSED_KEY_PREFIX, botId, groupId, userId);
    await redis.set(key, '1');
    await redis.expire(key, Math.ceil(ttl));
}

/**
 * 查询用户是否在冷却期内已通过验证
 * @param {string} botId - Bot账号
 * @param {string} groupId - 群号
 * @param {string} userId - 用户QQ
 * @returns {Promise<boolean>} 是否已通过
 */
export async function isPassed(botId, groupId, userId) {
    const count = await redis.exists(buildKey(PASSED_KEY_PREFIX, botId, groupId, userId));
    return Number(count) > 0;
}
