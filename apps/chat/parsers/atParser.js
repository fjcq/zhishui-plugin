/**
 * AT格式解析模块
 * 处理消息中的艾特格式转换
 */

const logger = global.logger || console;

/**
 * 用户昵称缓存
 * 用于避免重复查询同一用户信息
 */
const nicknameCache = new Map();
const CACHE_TTL = 60000;

/**
 * 获取用户昵称
 * @param {Object} e - 事件对象
 * @param {string} userId - 用户ID
 * @returns {Promise<string>} 用户昵称
 */
async function getUserNickname(e, userId) {
    const cacheKey = `${e.group_id || 'private'}_${userId}`;
    const cached = nicknameCache.get(cacheKey);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
        return cached.nickname;
    }

    let nickname = null;
    try {
        if (e.group_id) {
            const memberInfo = await e.bot?.pickMember?.(e.group_id, userId)?.getInfo?.() ||
                await e.group?.pickMember?.(userId)?.getInfo?.();
            if (memberInfo) {
                nickname = memberInfo.card || memberInfo.nickname || memberInfo.nick || null;
            }
        }
        if (!nickname) {
            const userInfo = await e.bot?.pickUser?.(userId)?.getInfo?.() ||
                await e.bot?.getStrangerInfo?.(userId);
            if (userInfo) {
                nickname = userInfo.nickname || userInfo.nick || null;
            }
        }
    } catch (err) {
        logger.debug(`[AT解析] 获取用户${userId}昵称失败: ${err.message}`);
    }

    nickname = nickname || `用户${userId}`;
    nicknameCache.set(cacheKey, { nickname, time: Date.now() });
    return nickname;
}

/**
 * 将消息中的 [CQ:at,qq=用户ID] 格式转换为 segment.at() 对象数组
 * @param {string} message - 原始消息内容
 * @returns {Array} 转换后的消息数组，包含文本和segment对象
 */
export function convertAtFormat(message) {
    if (!message || typeof message !== 'string') {
        return [message];
    }

    const result = [];
    const atRegex = /\[CQ:at,qq=(\d+)\]/g;
    let lastIndex = 0;
    let match;

    while ((match = atRegex.exec(message)) !== null) {
        if (match.index > lastIndex) {
            result.push(message.substring(lastIndex, match.index));
        }

        const userId = match[1];
        result.push(segment.at(userId));

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < message.length) {
        result.push(message.substring(lastIndex));
    }

    if (result.length === 0) {
        return [message];
    }

    return result;
}

/**
 * 将消息中的 [CQ:at,qq=用户ID] 格式转换为用户昵称文本
 * 用于语音消息等场景，避免播报数字ID
 * @param {string} message - 原始消息内容
 * @param {Object} e - 事件对象，用于获取群员信息
 * @returns {Promise<string>} 转换后的消息文本
 */
export async function convertAtToNames(message, e) {
    if (!message || typeof message !== 'string') {
        return message;
    }

    const atRegex = /\[CQ:at,qq=(\d+)\]/g;
    const matches = [...message.matchAll(atRegex)];

    if (matches.length === 0) {
        return message;
    }

    const userIds = [...new Set(matches.map(m => m[1]))];
    const nicknameMap = new Map();

    await Promise.all(userIds.map(async (userId) => {
        const nickname = await getUserNickname(e, userId);
        nicknameMap.set(userId, nickname);
    }));

    let result = message;
    for (const [userId, nickname] of nicknameMap) {
        result = result.replace(new RegExp(`\\[CQ:at,qq=${userId}\\]`, 'g'), `@${nickname}`);
    }

    return result;
}
