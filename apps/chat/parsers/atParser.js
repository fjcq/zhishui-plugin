/**
 * 消息格式解析模块
 * 处理消息中的各种格式标记转换（@、图片、回复等）
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
        logger.debug(`[消息解析] 获取用户${userId}昵称失败: ${err.message}`);
    }

    nickname = nickname || `用户${userId}`;
    nicknameCache.set(cacheKey, { nickname, time: Date.now() });
    return nickname;
}

/**
 * 将消息中的各种格式标记转换为消息段对象
 * 支持的格式：
 * - [CQ:at,qq=用户ID] -> @某人
 * - [CQ:image,url=URL] -> 图片
 * - [CQ:reply,id=消息ID] -> 回复消息
 * - @[用户ID] -> @某人（简化格式）
 * - [image:URL] -> 图片（简化格式）
 * @param {string} message - 原始消息内容
 * @returns {Array} 转换后的消息数组，包含文本和segment对象
 */
export function convertMessageFormat(message) {
    if (!message || typeof message !== 'string') {
        return [message];
    }

    const result = [];
    const markers = [];

    const atCqRegex = /\[CQ:at,qq=(\d+)\]/g;
    const imageCqRegex = /\[CQ:image,url=([^\]]+)\]/g;
    const replyCqRegex = /\[CQ:reply,id=([^\]]+)\]/g;
    const atSimpleRegex = /@\[(\d+)\]/g;
    const imageSimpleRegex = /\[image:([^\]]+)\]/g;

    let match;

    while ((match = atCqRegex.exec(message)) !== null) {
        markers.push({
            type: 'at',
            userId: match[1],
            start: match.index,
            end: match.index + match[0].length
        });
    }

    while ((match = imageCqRegex.exec(message)) !== null) {
        markers.push({
            type: 'image',
            url: match[1],
            start: match.index,
            end: match.index + match[0].length
        });
    }

    while ((match = replyCqRegex.exec(message)) !== null) {
        markers.push({
            type: 'reply',
            messageId: match[1],
            start: match.index,
            end: match.index + match[0].length
        });
    }

    while ((match = atSimpleRegex.exec(message)) !== null) {
        markers.push({
            type: 'at',
            userId: match[1],
            start: match.index,
            end: match.index + match[0].length
        });
    }

    while ((match = imageSimpleRegex.exec(message)) !== null) {
        markers.push({
            type: 'image',
            url: match[1],
            start: match.index,
            end: match.index + match[0].length
        });
    }

    markers.sort((a, b) => a.start - b.start);

    const filteredMarkers = [];
    for (let i = 0; i < markers.length; i++) {
        let isOverlapped = false;
        for (let j = 0; j < filteredMarkers.length; j++) {
            if (markers[i].start >= filteredMarkers[j].start &&
                markers[i].end <= filteredMarkers[j].end) {
                isOverlapped = true;
                break;
            }
        }
        if (!isOverlapped) {
            filteredMarkers.push(markers[i]);
        }
    }

    let lastIndex = 0;
    for (const marker of filteredMarkers) {
        if (marker.start > lastIndex) {
            const textPart = message.substring(lastIndex, marker.start);
            if (textPart) {
                result.push(textPart);
            }
        }

        switch (marker.type) {
            case 'at':
                result.push(segment.at(marker.userId));
                break;

            case 'image':
                result.push(segment.image(marker.url));
                break;

            case 'reply':
                result.push(segment.reply(marker.messageId));
                break;
        }

        lastIndex = marker.end;
    }

    if (lastIndex < message.length) {
        const textPart = message.substring(lastIndex);
        if (textPart) {
            result.push(textPart);
        }
    }

    if (result.length === 0) {
        return [message];
    }

    return result;
}

/**
 * 将消息中的 [CQ:at,qq=用户ID] 格式转换为 segment.at() 对象数组
 * @param {string} message - 原始消息内容
 * @returns {Array} 转换后的消息数组，包含文本和segment对象
 */
export function convertAtFormat(message) {
    return convertMessageFormat(message);
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
    const atSimpleRegex = /@\[(\d+)\]/g;
    const matches = [...message.matchAll(atRegex), ...message.matchAll(atSimpleRegex)];

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
        result = result.replace(new RegExp(`@\\[${userId}\\]`, 'g'), `@${nickname}`);
    }

    const imageCqRegex = /\[CQ:image,url=[^\]]+\]/g;
    const imageSimpleRegex = /\[image:[^\]]+\]/g;
    result = result.replace(imageCqRegex, '[图片]');
    result = result.replace(imageSimpleRegex, '[图片]');

    const replyCqRegex = /\[CQ:reply,id=[^\]]+\]/g;
    result = result.replace(replyCqRegex, '[回复]');

    return result;
}

/**
 * 检查消息是否包含混合消息段（非纯文本）
 * @param {string} message - 消息内容
 * @returns {boolean} 是否包含混合消息段
 */
export function hasMixedSegments(message) {
    if (!message || typeof message !== 'string') {
        return false;
    }

    const patterns = [
        /\[CQ:at,qq=\d+\]/,
        /\[CQ:image,url=/,
        /\[CQ:reply,id=/,
        /@\[\d+\]/,
        /\[image:/
    ];

    return patterns.some(pattern => pattern.test(message));
}

export default {
    convertMessageFormat,
    convertAtFormat,
    convertAtToNames,
    hasMixedSegments
};
