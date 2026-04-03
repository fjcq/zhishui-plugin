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
 * 表情包类型配置
 * @property {string} name - 表情包中文名称
 * @property {number} minImages - 需要的头像数量（1=单个用户头像，2=两个用户头像）
 * @property {boolean} needsAvatar - 是否需要用户ID来获取头像
 * @property {boolean} needsText - 是否必须提供文字
 * @property {string} textHint - 文字输入提示，告诉AI应该输入什么内容
 */
const MEME_CONFIG = {
    // === 单头像表情 ===
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
    // === 文字类表情 ===
    my_friend: { name: '我朋友说', minImages: 1, needsAvatar: true, needsText: true, textHint: '必须输入朋友的名字' },
    // === 双头像表情 ===
    kiss: { name: '亲亲', minImages: 2, needsAvatar: true, needsText: false, textHint: '需要两个头像，不填第二个则使用你的头像' },
    rub: { name: '贴贴', minImages: 2, needsAvatar: true, needsText: false, textHint: '需要两个头像，不填第二个则使用你的头像' }
};

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
 * @param {string} params.meme_type - 表情包类型
 * @param {string} params.user_id - 目标用户ID
 * @param {string} params.text - 文字内容
 * @param {object} e - 事件对象
 * @param {string} currentUserId - 当前用户ID
 * @returns {Promise<object>} 执行结果
 */
async function handleGenerateMeme(params, e, currentUserId) {
    const { meme_type, user_id, user_id_2, text = '' } = params;

    if (!meme_type) {
        return { error: true, error_message: '缺少表情包类型参数' };
    }

    const memeConfig = MEME_CONFIG[meme_type];
    if (!memeConfig) {
        return { error: true, error_message: `不支持的表情包类型: ${meme_type}` };
    }

    if (memeConfig.needsText && !text) {
        return { error: true, error_message: `${memeConfig.name}表情包需要提供文字内容。${memeConfig.textHint}` };
    }

    const targetUserId = user_id || currentUserId;
    if (!targetUserId) {
        return { error: true, error_message: '缺少目标用户ID参数' };
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

        if (text) {
            formData.append('texts', text);
        }

        const args = buildMemeArgs(meme_type, text, userName);
        formData.set('args', args);

        const response = await fetch(`${MEME_API_BASE}/${meme_type}/`, {
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

        logger.info(`[表情包] 生成成功 | 类型:${meme_type} | 用户:${targetUserId}`);

        return {
            success: true,
            meme_type: meme_type,
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
 * 构建表情包参数（参考土块插件实现）
 * @param {string} memeType - 表情包类型
 * @param {string} text - 文字
 * @param {string} userName - 用户昵称
 * @returns {string} JSON字符串参数
 */
function buildMemeArgs(memeType, text, userName) {
    let argsObj = {};

    switch (memeType) {
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
