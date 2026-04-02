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
    petpet: { name: '摸头', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    crawl: { name: '爬行', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    slap: { name: '拍打', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    kiss: { name: '亲亲', minImages: 2, needsAvatar: true, needsText: false, textHint: '需要两个用户的头像，会自动使用Bot头像作为第二个头像' },
    rub: { name: '蹭蹭', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    play: { name: '玩弄', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    pat: { name: '拍', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    tear: { name: '撕', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    punch: { name: '拳击', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    kick: { name: '踢', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    cry: { name: '哭', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    support: { name: '加油', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    always: { name: '一直', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    any: { name: '任意门', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    spin: { name: '旋转', minImages: 1, needsAvatar: true, needsText: false, textHint: '可选：输入数字表示旋转比例，默认为2' },
    jump: { name: '跳', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    throw: { name: '扔', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    wall: { name: '墙', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    eat: { name: '吃', minImages: 1, needsAvatar: true, needsText: false, textHint: '' },
    my_friend: { name: '我朋友', minImages: 1, needsAvatar: true, needsText: true, textHint: '必须输入朋友的名字，例如"小明"、"老王"等' },
    looklook: { name: '看看', minImages: 1, needsAvatar: true, needsText: false, textHint: '可选：输入"翻转"可以镜像翻转图片' }
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
    const { meme_type, user_id, text = '' } = params;

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
            const selfAvatarUrl = await getUserAvatar(e, e.bot?.uin || e.self_id);
            if (selfAvatarUrl) {
                const selfAvatarBuffer = await fetchImageBuffer(selfAvatarUrl);
                formData.append('images', new Blob([selfAvatarBuffer]));
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
            argsObj.number = Math.floor(Math.random() * 92) + 1;
            break;
        case 'spin':
            argsObj.ratio = parseInt(text) || 2;
            break;
        case 'my_friend':
            argsObj.name = text || userName || '朋友';
            break;
        case 'looklook':
            argsObj.mirror = text === '翻转';
            break;
        case 'always':
            argsObj.mode = 'normal';
            break;
        case 'petpet':
            argsObj.circle = text?.startsWith('圆') || false;
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
