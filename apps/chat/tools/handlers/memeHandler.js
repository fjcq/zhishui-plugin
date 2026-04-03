/**
 * 表情包工具处理函数
 * 处理AI调用的表情包相关工具
 */

import { getSegment } from './musicCore.js';

const logger = global.logger || console;

/**
 * 表情包API基础URL
 */
const MEME_API_BASE = 'https://h.winterqkl.cn/memes';

/**
 * 关键词到表情key的映射表
 * 包含热门表情的中英文关键词映射
 */
const KEYWORD_MAP = {
    '摸头': 'petpet', '摸摸': 'petpet', '摸': 'petpet', 'petpet': 'petpet',
    '爬': 'crawl', '爬行': 'crawl', 'crawl': 'crawl',
    '玩': 'play', 'play': 'play',
    '拍': 'pat', 'pat': 'pat',
    '打拳': 'punch', 'punch': 'punch',
    '一直': 'always', 'always': 'always',
    '跳': 'jump', 'jump': 'jump',
    '吃': 'eat', 'eat': 'eat',
    '啃': 'bite', 'bite': 'bite',
    '加油': 'support', 'support': 'support',
    '扔': 'throw', 'throw': 'throw',
    '舔': 'prpr', '舔屏': 'prpr', 'prpr': 'prpr',
    '看扁': 'look_flat', 'look_flat': 'look_flat',
    '对称': 'symmetric', 'symmetric': 'symmetric',
    '迷惑': 'confuse', 'confuse': 'confuse',
    '恐龙': 'dinosaur', 'dinosaur': 'dinosaur',
    '弹': 'flick', 'flick': 'flick',
    '锤': 'hammer', 'hammer': 'hammer',
    '敲': 'knock', 'knock': 'knock',
    '捣': 'pound', 'pound': 'pound',
    '急急国王': 'jiji_king', 'jiji_king': 'jiji_king',
    '卡比锤': 'kirby_hammer', 'kirby_hammer': 'kirby_hammer',
    '小天使': 'little_angel', 'little_angel': 'little_angel',
    '交个朋友': 'make_friend', 'make_friend': 'make_friend',
    '结婚申请': 'marriage', 'marriage': 'marriage',
    '你需要': 'need', 'need': 'need',
    '看图标': 'look_this_icon', 'look_this_icon': 'look_this_icon',
    '打印': 'printing', 'printing': 'printing',
    '金字塔': 'pyramid', 'pyramid': 'pyramid',
    '完美': 'perfect', 'perfect': 'perfect',
    '捏': 'pinch', 'pinch': 'pinch',
    '像素化': 'pixelate', 'pixelate': 'pixelate',
    '出警': 'police', 'police': 'police',
    '土豆': 'potato', 'potato': 'potato',
    '甩锅': 'pass_the_buck', 'pass_the_buck': 'pass_the_buck',
    '小画家': 'painter', 'painter': 'painter',
    '这像画吗': 'paint', 'paint': 'paint',
    'out': 'out',
    '我朋友说': 'my_friend', 'my_friend': 'my_friend',
    '亲亲': 'kiss', '亲': 'kiss', 'kiss': 'kiss',
    '贴贴': 'rub', '贴': 'rub', 'rub': 'rub',
    '抱抱': 'support', '抱': 'support',
    '踢': 'kick', 'kick': 'kick',
    '撕': 'tear', 'tear': 'tear',
    '滚': 'roll', 'roll': 'roll',
    '冲': 'rush', 'rush': 'rush',
    '顶': 'push', 'push': 'push',
    '哭': 'cry', 'cry': 'cry',
    '笑': 'laugh', 'laugh': 'laugh',
    '发疯': 'crazy', 'crazy': 'crazy',
    '急': 'jiji_king',
    '敲打': 'knock',
    '捶': 'hammer',
    '搓': 'rub'
};

/**
 * 表情包类型配置
 * @property {string} name - 表情包中文名称
 * @property {number} minImages - 需要的头像数量（1=单个用户头像，2=两个用户头像）
 * @property {boolean} needsAvatar - 是否需要用户ID来获取头像
 * @property {boolean} needsText - 是否必须提供文字
 * @property {string} textHint - 文字输入提示
 */
const MEME_CONFIG = {
    petpet: { name: '摸头', minImages: 1, needsAvatar: true, needsText: false, textHint: '可选：输入"圆"让头像为圆形' },
    crawl: { name: '爬', minImages: 1, needsAvatar: true, needsText: false, textHint: '可选：输入数字指定爬行样式(1-92)' },
    play: { name: '玩', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    pat: { name: '拍', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    punch: { name: '打拳', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    always: { name: '一直', minImages: 1, needsAvatar: true, needsText: false, textHint: '可选：输入"循环"或"套娃"' },
    jump: { name: '跳', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    eat: { name: '吃', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    bite: { name: '啃', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    support: { name: '加油', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    throw: { name: '扔', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    prpr: { name: '舔屏', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    look_flat: { name: '看扁', minImages: 1, needsAvatar: true, needsText: false, textHint: '可选：输入数字指定缩放倍数' },
    symmetric: { name: '对称', minImages: 1, needsAvatar: true, needsText: false, textHint: '可选：输入"左"、"右"、"上"、"下"' },
    confuse: { name: '迷惑', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    dinosaur: { name: '恐龙', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    flick: { name: '弹', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    hammer: { name: '锤', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    knock: { name: '敲', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    pound: { name: '捣', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    jiji_king: { name: '急急国王', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    kirby_hammer: { name: '卡比锤', minImages: 1, needsAvatar: true, needsText: false, textHint: '可选：输入"圆"让头像为圆形' },
    little_angel: { name: '小天使', minImages: 1, needsAvatar: true, needsText: false, textHint: '可选：输入名字' },
    make_friend: { name: '交个朋友', minImages: 1, needsAvatar: true, needsText: false, textHint: '可选：输入名字' },
    marriage: { name: '结婚申请', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    need: { name: '你需要', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    look_this_icon: { name: '看图标', minImages: 1, needsAvatar: true, needsText: false, textHint: '可选：输入描述' },
    printing: { name: '打印', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    pyramid: { name: '金字塔', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    perfect: { name: '完美', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    pinch: { name: '捏', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    pixelate: { name: '像素化', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    police: { name: '出警', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    potato: { name: '土豆', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    pass_the_buck: { name: '甩锅', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    painter: { name: '小画家', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    paint: { name: '这像画吗', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    out: { name: 'out', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    my_friend: { name: '我朋友说', minImages: 1, needsAvatar: true, needsText: true, textHint: '必须输入朋友的名字' },
    kiss: { name: '亲亲', minImages: 2, needsAvatar: true, needsText: false, textHint: '需要两个头像，不填第二个则使用你的头像' },
    rub: { name: '贴贴', minImages: 2, needsAvatar: true, needsText: false, textHint: '需要两个头像，不填第二个则使用你的头像' },
    kick: { name: '踢', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    tear: { name: '撕', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    roll: { name: '滚', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    rush: { name: '冲', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    push: { name: '顶', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    cry: { name: '哭', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    laugh: { name: '笑', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    crazy: { name: '发疯', minImages: 1, needsAvatar: true, needsText: false, textHint: '' }
};

/**
 * 根据关键词获取表情key
 * @param {string} keyword - 关键词
 * @returns {string|null} 表情key
 */
function getMemeKeyByKeyword(keyword) {
    if (!keyword) return null;
    const normalizedKeyword = keyword.toLowerCase().trim();
    return KEYWORD_MAP[normalizedKeyword] || KEYWORD_MAP[keyword.trim()] || null;
}

/**
 * 处理表情包工具调用
 * @param {string} toolName - 工具名称
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象
 * @param {string} currentUserId - 当前用户ID
 * @returns {Promise<object>} 工具执行结果
 */
export async function handleMemeToolCall(toolName, params, e, currentUserId) {
    let result;
    try {
        switch (toolName) {
            case 'generate_meme':
                result = await handleGenerateMeme(params, e, currentUserId);
                break;
            default:
                result = { error: true, error_message: `未知的表情包工具: ${toolName}` };
        }
    } catch (error) {
        logger.error(`[表情包工具] ${toolName} 执行失败: ${error.message}`);
        result = { error: true, error_message: `操作失败: ${error.message}` };
    }

    return result;
}

/**
 * 处理生成表情包
 * @param {object} params - 参数对象
 * @param {string} params.keyword - 表情关键词
 * @param {string} params.user_id - 目标用户QQ号
 * @param {string} params.user_id_2 - 第二个用户QQ号（双头像表情）
 * @param {string} params.text - 文字内容
 * @param {object} e - 事件对象
 * @param {string} currentUserId - 当前用户ID
 * @returns {Promise<object>} 执行结果
 */
async function handleGenerateMeme(params, e, currentUserId) {
    const { keyword, user_id, user_id_2, text = '' } = params;

    if (!keyword) {
        return { error: true, error_message: '缺少表情关键词参数' };
    }

    const memeKey = getMemeKeyByKeyword(keyword);
    if (!memeKey) {
        return { error: true, error_message: `不支持的表情关键词: ${keyword}。支持的关键词包括：摸头、爬、打拳、亲亲、贴贴等` };
    }

    const memeConfig = MEME_CONFIG[memeKey];
    if (!memeConfig) {
        return { error: true, error_message: `表情配置缺失: ${memeKey}` };
    }

    if (memeConfig.needsText && !text) {
        return { error: true, error_message: `${memeConfig.name}表情包需要提供文字内容。${memeConfig.textHint}` };
    }

    const targetUserId = user_id || currentUserId;
    if (!targetUserId) {
        return { error: true, error_message: '缺少目标用户QQ号参数' };
    }

    if (!e) {
        return { error: true, error_message: '无法获取用户信息：缺少事件对象' };
    }

    try {
        const targetUserInfo = await getUserInfo(e, targetUserId);
        const userName = targetUserInfo?.nickname || targetUserInfo?.card || String(targetUserId);

        const formData = new FormData();

        if (memeConfig.minImages > 1) {
            const secondUserId = user_id_2 || e.bot?.uin || e.bot?.user_id || e.self_id;
            if (secondUserId) {
                const secondAvatarUrl = await getUserAvatar(e, secondUserId);
                if (secondAvatarUrl) {
                    const secondAvatarBuffer = await fetchImageBuffer(secondAvatarUrl);
                    formData.append('images', new Blob([secondAvatarBuffer]));
                }
            }
        }

        const replyImage = await getReplyMessageImage(e);
        if (replyImage) {
            const imageBuffer = await fetchImageBuffer(replyImage);
            formData.append('images', new Blob([imageBuffer]));
        } else {
            const avatarUrl = await getUserAvatar(e, targetUserId);
            if (!avatarUrl) {
                return { error: true, error_message: '无法获取用户头像' };
            }
            const avatarBuffer = await fetchImageBuffer(avatarUrl);
            formData.append('images', new Blob([avatarBuffer]));
        }

        if (text && text.trim()) {
            formData.append('texts', text.trim());
        }

        const args = buildMemeArgs(memeKey, text, userName);
        formData.set('args', args);

        const response = await fetch(`${MEME_API_BASE}/${memeKey}/`, {
            method: 'POST',
            body: formData
        });

        if (response.status > 299) {
            const errorText = await response.text().catch(() => '');
            logger.warn(`[表情包] API返回错误: ${response.status} - ${errorText}`);
            return { error: true, error_message: `表情包生成失败，API返回错误: ${response.status}` };
        }

        const resultBuffer = Buffer.from(await response.arrayBuffer());

        const segment = await getSegment();

        if (segment) {
            await e.reply(segment.image(resultBuffer));
        } else {
            await e.reply({ type: 'image', file: `base64://${resultBuffer.toString('base64')}` });
        }

        logger.info(`[表情包] 生成成功 | 关键词:${keyword} | key:${memeKey} | 用户:${targetUserId}`);

        return {
            success: true,
            keyword: keyword,
            meme_key: memeKey,
            meme_name: memeConfig.name,
            user_id: String(targetUserId)
        };
    } catch (error) {
        logger.error(`[表情包] 生成失败: ${error.message}`);
        return { error: true, error_message: `表情包生成失败: ${error.message}` };
    }
}

/**
 * 从回复消息中提取图片URL
 * @param {object} e - 事件对象
 * @returns {Promise<string|null>} 图片URL
 */
async function getReplyMessageImage(e) {
    try {
        let reply = null;

        if (typeof e.getReply === 'function') {
            reply = await e.getReply();
        } else if (e.source) {
            if (e.group?.getChatHistory) {
                reply = (await e.group.getChatHistory(e.source.seq, 1)).pop();
            } else if (e.friend?.getChatHistory) {
                reply = (await e.friend.getChatHistory(e.source.time, 1)).pop();
            }
        }

        if (reply?.message) {
            for (const msg of reply.message) {
                if (msg.type === 'image' && msg.url) {
                    return msg.url;
                }
                if (msg.type === 'file' && msg.url) {
                    return msg.url;
                }
            }
        }

        return null;
    } catch (error) {
        logger.warn(`[获取回复图片] 失败: ${error.message}`);
        return null;
    }
}

/**
 * 获取用户信息
 * @param {object} e - 事件对象
 * @param {string} userId - 用户ID
 * @returns {Promise<object|null>} 用户信息
 */
async function getUserInfo(e, userId) {
    try {
        const pick = await e.group?.pickMember?.(userId) || await e.bot?.pickFriend?.(userId);
        const info = await pick?.getInfo?.() || pick?.info || pick;
        return info;
    } catch (error) {
        return null;
    }
}

/**
 * 获取用户头像URL
 * @param {object} e - 事件对象
 * @param {string} userId - 用户ID
 * @returns {Promise<string>} 头像URL
 */
async function getUserAvatar(e, userId) {
    try {
        if (e.group?.pickMember) {
            const member = e.group.pickMember(userId);
            const avatarUrl = await member?.getAvatarUrl?.();
            if (avatarUrl) return avatarUrl;
        }

        if (e.bot?.pickFriend) {
            const friend = e.bot.pickFriend(userId);
            const avatarUrl = await friend?.getAvatarUrl?.();
            if (avatarUrl) return avatarUrl;
        }

        return `https://q2.qlogo.cn/headimg_dl?dst_uin=${userId}&spec=5`;
    } catch (error) {
        logger.warn(`[获取头像] 失败: ${error.message}`);
        return `https://q2.qlogo.cn/headimg_dl?dst_uin=${userId}&spec=5`;
    }
}

/**
 * 获取图片Buffer
 * @param {string} url - 图片URL
 * @returns {Promise<Buffer>} 图片Buffer
 */
async function fetchImageBuffer(url) {
    const response = await fetch(url);
    return Buffer.from(await response.arrayBuffer());
}

/**
 * 构建表情包参数
 * @param {string} memeKey - 表情包key
 * @param {string} text - 文字
 * @param {string} userName - 用户昵称
 * @returns {string} JSON字符串参数
 */
function buildMemeArgs(memeKey, text, userName) {
    let argsObj = {};

    switch (memeKey) {
        case 'crawl':
            argsObj.number = parseInt(text) || Math.floor(Math.random() * 92) + 1;
            break;
        case 'my_friend':
            argsObj.name = text || userName || '朋友';
            break;
        case 'always':
            const alwaysModeMap = { '': 'normal', '循环': 'loop', '套娃': 'circle' };
            argsObj.mode = alwaysModeMap[text] || 'normal';
            break;
        case 'petpet':
        case 'kirby_hammer':
            argsObj.circle = text?.startsWith('圆') || false;
            break;
        case 'look_flat':
            argsObj.ratio = parseInt(text) || 2;
            break;
        case 'symmetric':
            const directionMap = { '左': 'left', '右': 'right', '上': 'top', '下': 'bottom' };
            argsObj.direction = directionMap[text] || 'left';
            break;
        case 'little_angel':
        case 'make_friend':
            argsObj.name = text || userName || '朋友';
            break;
        case 'look_this_icon':
            argsObj.text = text || '';
            break;
        default:
            break;
    }

    argsObj.user_infos = [{
        name: userName,
        gender: 'unknown'
    }];

    return JSON.stringify(argsObj);
}
