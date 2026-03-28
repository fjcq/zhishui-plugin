/**
 * 互动工具处理函数
 * 处理AI调用的互动相关工具
 */

import { isBotAdmin } from '../permissions.js';

/**
 * 处理互动工具调用
 * @param {string} toolName - 工具名称
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象
 * @param {string} currentUserId - 当前对话用户ID
 * @returns {Promise<object>} 工具执行结果
 */
export async function handleInteractToolCall(toolName, params, e, currentUserId) {
    try {
        switch (toolName) {
            case 'poke_user':
                return await handlePokeUser(params, e, currentUserId);
            case 'send_image':
                return await handleSendImage(params, e);
            case 'send_voice':
                return await handleSendVoice(params, e);
            case 'send_private_message':
                return await handleSendPrivateMessage(params, e);
            case 'forward_message':
                return await handleForwardMessage(params, e);
            case 'set_essence_message':
                return await handleSetEssenceMessage(params, e);
            case 'search_music':
                return await handleSearchMusic(params, e);
            case 'generate_meme':
                return await handleGenerateMeme(params, e, currentUserId);
            default:
                return { error: true, message: `未知的互动工具: ${toolName}` };
        }
    } catch (error) {
        logger.error(`[互动工具] ${toolName} 执行失败: ${error.message}`);
        return { error: true, message: `操作失败: ${error.message}` };
    }
}

/**
 * 处理戳一戳用户
 */
async function handlePokeUser(params, e, currentUserId) {
    const user_id = params.user_id || currentUserId;

    if (!user_id) {
        return { error: true, message: '缺少用户ID参数' };
    }

    if (!e || !e.group_id) {
        return { error: true, message: '戳一戳功能仅在群组中可用' };
    }

    try {
        const group = e.group || e.bot?.pickGroup?.(e.group_id);
        if (!group) {
            return { error: true, message: '无法获取群组信息' };
        }

        const errors = [];

        if (typeof e.bot?.sendGroupPoke === 'function') {
            try {
                await e.bot.sendGroupPoke(e.group_id, user_id);
                logger.info(`[互动] 戳一戳(sendGroupPoke) | 群:${e.group_id} | 用户:${user_id}`);
                return {
                    success: true,
                    user_id: String(user_id),
                    message: `已戳一戳用户 ${user_id}`
                };
            } catch (err) {
                errors.push(`sendGroupPoke: ${err.message}`);
            }
        }

        if (typeof group.pokeMember === 'function') {
            try {
                await group.pokeMember(user_id);
                logger.info(`[互动] 戳一戳(pokeMember) | 群:${e.group_id} | 用户:${user_id}`);
                return {
                    success: true,
                    user_id: String(user_id),
                    message: `已戳一戳用户 ${user_id}`
                };
            } catch (err) {
                errors.push(`pokeMember: ${err.message}`);
            }
        }

        if (typeof group.sendMsg === 'function') {
            try {
                await group.sendMsg({ type: 'poke', qq: Number(user_id) });
                logger.info(`[互动] 戳一戳(sendMsg) | 群:${e.group_id} | 用户:${user_id}`);
                return {
                    success: true,
                    user_id: String(user_id),
                    message: `已戳一戳用户 ${user_id}`
                };
            } catch (err) {
                errors.push(`sendMsg: ${err.message}`);
            }
        }

        if (e.bot?.sendApi) {
            try {
                await e.bot.sendApi('set_group_poke', {
                    group_id: e.group_id,
                    user_id: user_id
                });
                logger.info(`[互动] 戳一戳(API) | 群:${e.group_id} | 用户:${user_id}`);
                return {
                    success: true,
                    user_id: String(user_id),
                    message: `已戳一戳用户 ${user_id}`
                };
            } catch (err) {
                errors.push(`sendApi: ${err.message}`);
            }
        }

        logger.warn(`[互动] 戳一戳失败，尝试过的方法: ${errors.join('; ')}`);
        return { error: true, message: `戳一戳功能暂不支持，错误详情: ${errors.join('; ')}` };
    } catch (error) {
        return { error: true, message: `戳一戳失败: ${error.message}` };
    }
}

/**
 * 处理发送图片
 */
async function handleSendImage(params, e) {
    const { url, caption = '' } = params;

    if (!url) {
        return { error: true, message: '缺少图片URL参数' };
    }

    if (!e) {
        return { error: true, message: '无法发送消息：缺少事件对象' };
    }

    try {
        const segment = await import('oicq').then(m => m.segment).catch(() =>
            import('icqq').then(m => m.segment)
        );

        if (!segment) {
            return { error: true, message: '无法加载segment模块' };
        }

        const imageMsg = segment.image(url);
        const message = caption ? [imageMsg, caption] : [imageMsg];

        await e.reply(message);
        logger.info(`[互动] 发送图片 | URL:${url.substring(0, 50)}...`);

        return {
            success: true,
            url: url,
            caption: caption,
            message: '图片已发送'
        };
    } catch (error) {
        return { error: true, message: `发送图片失败: ${error.message}` };
    }
}

/**
 * 处理发送语音
 */
async function handleSendVoice(params, e) {
    const { text } = params;

    if (!text) {
        return { error: true, message: '缺少语音文本参数' };
    }

    if (!e) {
        return { error: true, message: '无法发送消息：缺少事件对象' };
    }

    try {
        const segment = await import('oicq').then(m => m.segment).catch(() =>
            import('icqq').then(m => m.segment)
        );

        if (!segment) {
            return { error: true, message: '无法加载segment模块' };
        }

        const voiceMsg = await segment.record(text);
        await e.reply(voiceMsg);
        logger.info(`[互动] 发送语音 | 文本:${text.substring(0, 30)}...`);

        return {
            success: true,
            text: text,
            message: '语音已发送'
        };
    } catch (error) {
        return { error: true, message: `发送语音失败: ${error.message}` };
    }
}

/**
 * 处理发送私聊消息
 */
async function handleSendPrivateMessage(params, e) {
    const { user_id, message } = params;

    if (!user_id || !message) {
        return { error: true, message: '缺少用户ID或消息内容参数' };
    }

    if (!e || !e.bot) {
        return { error: true, message: '无法发送私聊消息：缺少Bot实例' };
    }

    try {
        const friend = e.bot.pickFriend?.(user_id);
        if (!friend) {
            return { error: true, message: `用户 ${user_id} 不是好友，无法发送私聊消息` };
        }

        await friend.sendMsg?.(message);
        logger.info(`[互动] 发送私聊 | 用户:${user_id} | 内容:${message.substring(0, 30)}...`);

        return {
            success: true,
            user_id: String(user_id),
            message: `私聊消息已发送给用户 ${user_id}`
        };
    } catch (error) {
        return { error: true, message: `发送私聊消息失败: ${error.message}` };
    }
}

/**
 * 处理转发消息
 */
async function handleForwardMessage(params, e) {
    const { target_group_id, message } = params;

    if (!target_group_id || !message) {
        return { error: true, message: '缺少目标群ID或消息内容参数' };
    }

    if (!e || !e.bot) {
        return { error: true, message: '无法转发消息：缺少Bot实例' };
    }

    try {
        const targetGroup = e.bot.pickGroup?.(target_group_id);
        if (!targetGroup) {
            return { error: true, message: `无法访问群组 ${target_group_id}` };
        }

        await targetGroup.sendMsg?.(message);
        logger.info(`[互动] 转发消息 | 目标群:${target_group_id} | 内容:${message.substring(0, 30)}...`);

        return {
            success: true,
            target_group_id: String(target_group_id),
            message: `消息已转发到群 ${target_group_id}`
        };
    } catch (error) {
        return { error: true, message: `转发消息失败: ${error.message}` };
    }
}

/**
 * 处理设置精华消息
 */
async function handleSetEssenceMessage(params, e) {
    const { message_id } = params;

    if (!message_id) {
        return { error: true, message: '缺少消息ID参数' };
    }

    if (!e || !e.group_id) {
        return { error: true, message: '设置精华消息仅在群组中可用' };
    }

    const isAdmin = await isBotAdmin(e);
    if (!isAdmin) {
        return { error: true, message: '设置精华消息需要Bot是管理员' };
    }

    try {
        const group = e.group || e.bot?.pickGroup?.(e.group_id);
        if (!group) {
            return { error: true, message: '无法获取群组信息' };
        }

        await group.setEssenceMessage?.(message_id);
        logger.mark(`[互动] 设置精华 | 群:${e.group_id} | 消息ID:${message_id}`);

        return {
            success: true,
            message_id: message_id,
            message: '消息已设为精华'
        };
    } catch (error) {
        return { error: true, message: `设置精华消息失败: ${error.message}` };
    }
}

/**
 * 处理搜索音乐
 * @param {object} params - 参数对象
 * @param {string} params.keyword - 搜索关键词
 * @param {string} params.platform - 音乐平台 qq/netease
 * @param {object} e - 事件对象
 * @returns {Promise<object>} 执行结果
 */
async function handleSearchMusic(params, e) {
    const { keyword, platform = 'qq' } = params;

    if (!keyword) {
        return { error: true, message: '请告诉我你想听什么歌' };
    }

    if (!e) {
        return { error: true, message: '无法发送消息：缺少事件对象' };
    }

    try {
        let songInfo = null;

        if (platform === 'netease') {
            songInfo = await searchNeteaseMusic(keyword);
        } else {
            songInfo = await searchQQMusic(keyword);
        }

        if (!songInfo) {
            return { error: true, message: `没有找到"${keyword}"相关的歌曲` };
        }

        await sendMusicCard(e, songInfo, platform);

        logger.info(`[互动] 点歌 | 平台:${platform} | 歌曲:${songInfo.name} - ${songInfo.artist}`);

        return {
            success: true,
            name: songInfo.name,
            artist: songInfo.artist,
            platform: platform,
            message: `已为你找到《${songInfo.name}》- ${songInfo.artist}`
        };
    } catch (error) {
        logger.error(`[互动] 点歌失败: ${error.message}`);
        return { error: true, message: `点歌失败: ${error.message}` };
    }
}

/**
 * 搜索QQ音乐（使用网易云API作为备用）
 * @param {string} keyword - 搜索关键词
 * @returns {Promise<object|null>} 歌曲信息
 */
async function searchQQMusic(keyword) {
    return await searchNeteaseMusic(keyword);
}

/**
 * 搜索网易云音乐
 * @param {string} keyword - 搜索关键词
 * @returns {Promise<object|null>} 歌曲信息
 */
async function searchNeteaseMusic(keyword) {
    try {
        const searchUrl = `http://music.163.com/api/search/get/web?csrf_token=hlpretag=&hlposttag=&s=${encodeURIComponent(keyword)}&type=1&offset=0&total=true&limit=1`;
        const response = await fetch(searchUrl);
        const data = await response.json();

        if (data.code === 200 && data.result?.songs?.length > 0) {
            const song = data.result.songs[0];
            const songId = song.id;
            const musicUrl = `http://music.163.com/song/media/outer/url?id=${songId}.mp3`;

            return {
                name: song.name,
                artist: song.artists?.[0]?.name || '未知歌手',
                url: musicUrl,
                pic: song.album?.picId ? `http://music.163.com/api/img/blur/${song.album.picId}` : '',
                link: `https://music.163.com/#/song?id=${songId}`
            };
        }
        return null;
    } catch (error) {
        logger.error(`[网易云搜索] 失败: ${error.message}`);
        return null;
    }
}

/**
 * 发送音乐文件（语音形式）
 * @param {object} e - 事件对象
 * @param {object} songInfo - 歌曲信息
 * @param {string} platform - 平台类型
 */
async function sendMusicCard(e, songInfo, platform) {
    try {
        if (!songInfo.url) {
            throw new Error('无法获取音乐播放链接');
        }

        const segment = await import('oicq').then(m => m.segment).catch(() =>
            import('icqq').then(m => m.segment)
        );

        if (!segment) {
            throw new Error('无法加载segment模块');
        }

        await e.reply(`正在下载《${songInfo.name}》，请稍等...`);

        try {
            const recordMsg = await segment.record(songInfo.url);
            await e.reply(recordMsg);
            logger.info(`[点歌] 发送语音成功 | ${songInfo.name} - ${songInfo.artist}`);
        } catch (recordError) {
            logger.warn(`[点歌] 语音发送失败: ${recordError.message}，尝试文本链接`);
            const textMsg = `🎵 ${songInfo.name}\n👤 ${songInfo.artist}\n🔗 ${songInfo.link}`;
            await e.reply(textMsg);
        }
    } catch (error) {
        logger.error(`[发送音乐] 失败: ${error.message}`);
        const textMsg = `🎵 ${songInfo.name}\n👤 ${songInfo.artist}\n🔗 ${songInfo.link}`;
        await e.reply(textMsg);
    }
}

/**
 * 表情包API基础URL
 */
const MEME_API_BASE = 'https://h.winterqkl.cn/memes';

/**
 * 表情包类型配置
 */
const MEME_CONFIG = {
    petpet: { name: '摸头', minImages: 1, minTexts: 0 },
    crawl: { name: '爬行', minImages: 1, minTexts: 0 },
    slap: { name: '拍打', minImages: 1, minTexts: 0 },
    kiss: { name: '亲亲', minImages: 2, minTexts: 0 },
    rub: { name: '蹭蹭', minImages: 1, minTexts: 0 },
    play: { name: '玩弄', minImages: 1, minTexts: 0 },
    pat: { name: '拍', minImages: 1, minTexts: 0 },
    tear: { name: '撕', minImages: 1, minTexts: 0 },
    punch: { name: '拳击', minImages: 1, minTexts: 0 },
    kick: { name: '踢', minImages: 1, minTexts: 0 },
    cry: { name: '哭', minImages: 1, minTexts: 0 },
    support: { name: '加油', minImages: 1, minTexts: 0 },
    always: { name: '一直', minImages: 1, minTexts: 0 },
    any: { name: '任意门', minImages: 1, minTexts: 0 },
    spin: { name: '旋转', minImages: 1, minTexts: 0 },
    jump: { name: '跳', minImages: 1, minTexts: 0 },
    throw: { name: '扔', minImages: 1, minTexts: 0 },
    wall: { name: '墙', minImages: 1, minTexts: 0 },
    eat: { name: '吃', minImages: 1, minTexts: 0 },
    my_friend: { name: '我朋友', minImages: 1, minTexts: 0 },
    looklook: { name: '看看', minImages: 1, minTexts: 0 }
};

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
        return { error: true, message: '请指定表情包类型' };
    }

    if (!e) {
        return { error: true, message: '无法发送消息：缺少事件对象' };
    }

    const memeConfig = MEME_CONFIG[meme_type];
    if (!memeConfig) {
        return { error: true, message: `不支持的表情包类型: ${meme_type}` };
    }

    try {
        const targetUserId = user_id || currentUserId;
        if (!targetUserId) {
            return { error: true, message: '缺少目标用户ID' };
        }

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

        const avatarUrl = await getUserAvatar(e, targetUserId);
        if (!avatarUrl) {
            return { error: true, message: '无法获取用户头像' };
        }
        const avatarBuffer = await fetchImageBuffer(avatarUrl);
        formData.append('images', new Blob([avatarBuffer]));

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
            return { error: true, message: `该表情包至少需要${memeConfig.minImages}张图片，${memeConfig.minTexts}个文字描述` };
        }

        const resultBuffer = Buffer.from(await response.arrayBuffer());

        const segment = await import('oicq').then(m => m.segment).catch(() =>
            import('icqq').then(m => m.segment)
        );

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
            user_id: String(targetUserId),
            message: `已生成${memeConfig.name}表情包`
        };
    } catch (error) {
        logger.error(`[表情包] 生成失败: ${error.message}`);
        return { error: true, message: `表情包生成失败: ${error.message}` };
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

        return `http://q2.qlogo.cn/headimg_dl?dst_uin=${userId}&spec=5`;
    } catch (error) {
        logger.warn(`[获取头像] 失败: ${error.message}`);
        return `http://q2.qlogo.cn/headimg_dl?dst_uin=${userId}&spec=5`;
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
