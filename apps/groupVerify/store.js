/**
 * 入群验证会话存储
 * 基于 Redis 的待验证会话与通过记录管理，键名统一携带 zhishui: 前缀
 */

const PENDING_KEY_PREFIX = 'zhishui:groupVerify:pending';
const PASSED_KEY_PREFIX = 'zhishui:groupVerify:passed';

// Redis TTL 缓冲秒数：需略大于验证时长，避免定时器到期前会话因 TTL 先过期导致超时处置丢失
const TTL_BUFFER_SECONDS = 120;

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
 * @param {object} data - 会话数据 { question, answers, history }
 * @param {number} ttl - 验证时长（秒），用于计算真实过期时间 expireAt
 */
export async function setPending(botId, groupId, userId, data, ttl) {
    const key = buildKey(PENDING_KEY_PREFIX, botId, groupId, userId);
    const ttlSec = Math.max(0, Number(ttl) || 0);
    // 记录真实过期时间戳，Redis TTL 额外加缓冲，确保超时定时器到期前会话仍存在
    await redis.set(key, JSON.stringify({ ...data, expireAt: Date.now() + ttlSec * 1000 }));
    await redis.expire(key, ttlSec + TTL_BUFFER_SECONDS);
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

/**
 * 列出某群全部待验证成员 QQ（用于批量取消验证）
 * @param {string} botId - Bot账号
 * @param {string} groupId - 群号
 * @returns {Promise<string[]>} 待验证成员QQ数组
 */
export async function listPendingUsers(botId, groupId) {
    const pattern = `${PENDING_KEY_PREFIX}:${botId}:${groupId}:*`;
    const keys = await redis.keys(pattern);
    if (!Array.isArray(keys) || keys.length === 0) {
        return [];
    }
    const prefix = `${PENDING_KEY_PREFIX}:${botId}:${groupId}:`;
    return keys.map(key => String(key).slice(prefix.length));
}
