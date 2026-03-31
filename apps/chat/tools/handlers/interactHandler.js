/**
 * 互动工具处理函数
 * 处理AI调用的互动相关工具
 */

import { isBotAdmin } from '../permissions.js';

const logger = global.logger || console;

let Meting = null;
let metingLoadError = null;

/**
 * 动态加载Meting模块
 * @returns {Promise<boolean>} 是否加载成功
 */
async function loadMeting() {
    if (Meting) return true;
    if (metingLoadError) return false;

    try {
        const module = await import('@meting/core');
        Meting = module.default;
        return true;
    } catch (error) {
        metingLoadError = error;
        logger.warn(`[音乐搜索] @meting/core 模块未安装，音乐搜索功能不可用。请运行: pnpm add @meting/core -w`);
        return false;
    }
}

const metingCache = {};

/**
 * 获取Meting实例
 * @param {string} platform - 平台代码
 * @returns {Meting|null} Meting实例
 */
function getMeting(platform) {
    if (!Meting) return null;
    if (!metingCache[platform]) {
        metingCache[platform] = new Meting(platform);
        metingCache[platform].format(true);
    }
    return metingCache[platform];
}

/**
 * 动态加载segment模块
 * @returns {Promise<object|null>} segment模块或null
 */
async function getSegment() {
    try {
        return await import('oicq').then(m => m.segment).catch(() =>
            import('icqq').then(m => m.segment)
        );
    } catch (error) {
        logger.warn(`[互动] 加载segment模块失败: ${error.message}`);
        return null;
    }
}

/**
 * 带超时控制的语音生成
 * @param {object} segment - segment模块
 * @param {string} source - 文本或URL
 * @param {number} timeout - 超时时间(毫秒)，默认30秒
 * @returns {Promise<object>} 语音消息段
 */
async function createVoiceWithTimeout(segment, source, timeout = 30000) {
    try {
        return await Promise.race([
            segment.record(source),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('语音生成超时')), timeout)
            )
        ]);
    } catch (error) {
        if (error.message === '语音生成超时') {
            throw error;
        }
        throw new Error(`语音生成失败: ${error.message}`);
    }
}

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
            case 'get_lyrics':
                return await handleGetLyrics(params, e);
            case 'get_playlist':
                return await handleGetPlaylist(params, e);
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
        const segment = await getSegment();

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

    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
        return { error: true, message: '语音文本不能为空' };
    }

    if (trimmedText.length > 500) {
        return { error: true, message: '语音文本过长，请控制在500字符以内' };
    }

    if (!e) {
        return { error: true, message: '无法发送消息：缺少事件对象' };
    }

    try {
        const segment = await getSegment();

        if (!segment) {
            return { error: true, message: '无法加载segment模块' };
        }

        const voiceMsg = await createVoiceWithTimeout(segment, trimmedText);
        await e.reply(voiceMsg);
        logger.info(`[互动] 发送语音 | 文本:${trimmedText.substring(0, 30)}...`);


        return {
            success: true,
            text: trimmedText,
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
 * @param {string} params.platform - 音乐平台 netease/tencent/kugou/kuwo
 * @param {object} e - 事件对象
 * @returns {Promise<object>} 执行结果
 */
async function handleSearchMusic(params, e) {
    const { keyword, platform = 'tencent' } = params;

    if (!keyword) {
        return { error: true, message: '请告诉我你想听什么歌' };
    }

    if (!e) {
        return { error: true, message: '无法发送消息：缺少事件对象' };
    }

    try {
        const songInfo = await searchMusicByMeting(keyword, platform);

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
 * 使用Meting搜索音乐
 * @param {string} keyword - 搜索关键词
 * @param {string} platform - 平台代码 netease/tencent/kugou/kuwo
 * @returns {Promise<object|null>} 歌曲信息
 */
async function searchMusicByMeting(keyword, platform) {
    try {
        const loaded = await loadMeting();
        if (!loaded) {
            logger.warn(`[音乐搜索] @meting/core 模块未安装，音乐搜索功能不可用。请运行: pnpm add @meting/core -w`);
            return null;
        }

        const meting = getMeting(platform);
        if (!meting) {
            logger.error(`[音乐搜索] 获取Meting实例失败`);
            return null;
        }

        const searchResult = await meting.search(keyword, { page: 1, limit: 5 });

        let songs;
        try {
            songs = JSON.parse(searchResult);
        } catch (parseError) {
            logger.error(`[音乐搜索] JSON解析失败: ${parseError.message}`);
            return null;
        }

        if (!songs || songs.length === 0) {
            return null;
        }

        const song = songs[0];

        let musicUrl = '';
        try {
            const urlResult = await meting.url(song.url_id || song.id, 320);
            const urlData = JSON.parse(urlResult);
            musicUrl = urlData?.url || '';
        } catch (urlError) {
            logger.warn(`[音乐搜索] 获取播放链接失败: ${urlError.message}`);
        }

        let picUrl = '';
        try {
            const picResult = await meting.pic(song.pic_id, 300);
            const picData = JSON.parse(picResult);
            picUrl = picData?.url || '';
        } catch (picError) {
            logger.warn(`[音乐搜索] 获取封面失败: ${picError.message}`);
        }

        const platformLinks = {
            netease: `https://music.163.com/#/song?id=${song.id}`,
            tencent: `https://y.qq.com/n/ryqq/songDetail/${song.id}`,
            kugou: `https://www.kugou.com/song/#hash=${song.id}`,
            kuwo: `https://www.kuwo.cn/play_detail/${song.id}`
        };

        return {
            name: song.name || song.title,
            artist: Array.isArray(song.artist) ? song.artist.join(', ') : (song.artist || '未知歌手'),
            id: song.id,
            url: musicUrl,
            duration: song.duration || 0,
            album: song.album || '',
            pic: picUrl || song.pic || '',
            link: platformLinks[platform] || ''
        };
    } catch (error) {
        logger.error(`[音乐搜索] Meting搜索失败: ${error.message}`);
        return null;
    }
}

/**
 * 发送音乐卡片
 * @param {object} e - 事件对象
 * @param {object} songInfo - 歌曲信息
 * @param {string} platform - 平台类型
 */
async function sendMusicCard(e, songInfo, platform) {
    try {
        const platformNames = {
            netease: '网易云',
            tencent: 'QQ音乐',
            kugou: '酷狗',
            kuwo: '酷我'
        };
        const platformName = platformNames[platform] || platform;

        const MAX_VOICE_DURATION = 300;
        const duration = songInfo.duration || 0;
        const canSendVoice = songInfo.url &&
            songInfo.url.startsWith('http') &&
            duration > 0 &&
            duration <= MAX_VOICE_DURATION;

        if (canSendVoice) {
            await e.reply(`正在获取《${songInfo.name}》，请稍等...`);

            try {
                const segment = await getSegment();

                if (segment) {
                    const recordMsg = await createVoiceWithTimeout(segment, songInfo.url);
                    await e.reply(recordMsg);
                    logger.info(`[点歌] 发送语音成功 | 平台:${platformName} | ${songInfo.name} - ${songInfo.artist} | 时长:${duration}秒`);
                    return;
                }
            } catch (recordError) {
                logger.warn(`[点歌] 语音发送失败: ${recordError.message}，将发送链接`);
            }
        } else if (duration > MAX_VOICE_DURATION) {
            logger.info(`[点歌] 歌曲时长${duration}秒超过限制，发送链接`);
        } else if (!songInfo.url || !songInfo.url.startsWith('http')) {
            logger.info(`[点歌] 无有效播放链接，发送歌曲信息`);
        }

        const textMsg = `🎵 ${songInfo.name}\n👤 ${songInfo.artist}\n💿 ${songInfo.album || '未知专辑'}\n⏱️ ${formatDuration(duration)}\n🔗 ${songInfo.link}`;
        await e.reply(textMsg);
        logger.info(`[点歌] 发送链接成功 | 平台:${platformName} | ${songInfo.name} - ${songInfo.artist}`);
    } catch (error) {
        logger.error(`[发送音乐] 失败: ${error.message}`);
        await e.reply(`歌曲：${songInfo.name} - ${songInfo.artist}\n链接：${songInfo.link}`);
    }
}

/**
 * 格式化时长
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时长
 */
function formatDuration(seconds) {
    if (!seconds) return '未知';
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

/**
 * 处理获取歌词
 * @param {object} params - 参数对象
 * @param {string} params.keyword - 搜索关键词
 * @param {string} params.platform - 音乐平台 netease/tencent/kugou/kuwo
 * @param {boolean} params.show_translation - 是否显示翻译
 * @param {object} e - 事件对象
 * @returns {Promise<object>} 执行结果
 */
async function handleGetLyrics(params, e) {
    const { keyword, platform = 'tencent', show_translation = true } = params;

    if (!keyword) {
        return { error: true, message: '请告诉我你想查看哪首歌的歌词' };
    }

    try {
        const lyricsInfo = await getLyricsByMeting(keyword, platform, show_translation);

        if (!lyricsInfo) {
            return { error: true, message: `没有找到"${keyword}"的歌词` };
        }

        logger.info(`[互动] 获取歌词 | 平台:${platform} | 歌曲:${lyricsInfo.name} - ${lyricsInfo.artist}`);

        return {
            success: true,
            name: lyricsInfo.name,
            artist: lyricsInfo.artist,
            album: lyricsInfo.album,
            lyrics: lyricsInfo.lyrics,
            translation: lyricsInfo.translation,
            has_translation: lyricsInfo.hasTranslation,
            formatted_message: formatLyricsMessage(lyricsInfo)
        };
    } catch (error) {
        logger.error(`[互动] 获取歌词失败: ${error.message}`);
        return { error: true, message: `获取歌词失败: ${error.message}` };
    }
}

/**
 * 使用Meting获取歌词
 * @param {string} keyword - 搜索关键词
 * @param {string} platform - 平台代码
 * @param {boolean} showTranslation - 是否显示翻译
 * @returns {Promise<object|null>} 歌词信息
 */
async function getLyricsByMeting(keyword, platform, showTranslation) {
    try {
        const loaded = await loadMeting();
        if (!loaded) {
            logger.warn(`[歌词获取] @meting/core 模块未安装`);
            return null;
        }

        const meting = getMeting(platform);
        if (!meting) {
            logger.error(`[歌词获取] 获取Meting实例失败`);
            return null;
        }

        const searchResult = await meting.search(keyword, { page: 1, limit: 1 });
        let songs;
        try {
            songs = JSON.parse(searchResult);
        } catch (parseError) {
            logger.error(`[歌词获取] JSON解析失败: ${parseError.message}`);
            return null;
        }

        if (!songs || songs.length === 0) {
            return null;
        }

        const song = songs[0];
        logger.info(`[歌词获取] 找到歌曲: ${song.name} - ID: ${song.id}, lyric_id: ${song.lyric_id}`);

        let lyricText = '';
        let translationText = '';
        try {
            const lyricId = song.lyric_id || song.id;
            logger.info(`[歌词获取] 尝试获取歌词，ID: ${lyricId}`);

            const lyricResult = await meting.lyric(lyricId);
            logger.info(`[歌词获取] 原始返回类型: ${typeof lyricResult}, 长度: ${lyricResult?.length || 0}`);

            let lyricData;
            if (typeof lyricResult === 'string') {
                try {
                    lyricData = JSON.parse(lyricResult);
                } catch (e) {
                    logger.warn(`[歌词获取] JSON解析失败，可能是纯文本歌词`);
                    lyricText = lyricResult;
                }
            } else {
                lyricData = lyricResult;
            }

            if (lyricData) {
                logger.info(`[歌词获取] 解析后的数据结构: ${JSON.stringify(Object.keys(lyricData))}`);

                if (typeof lyricData === 'string') {
                    lyricText = lyricData;
                } else {
                    lyricText = lyricData.lyric || lyricData.lrc?.lyric || lyricData.lrc || '';
                    translationText = lyricData.tlyric?.lyric || lyricData.translate || lyricData.translation || '';
                }
            }

            logger.info(`[歌词获取] 歌词文本长度: ${lyricText.length}, 翻译长度: ${translationText.length}`);
        } catch (lyricError) {
            logger.warn(`[歌词获取] 获取歌词失败: ${lyricError.message}`);
            logger.warn(`[歌词获取] 错误堆栈: ${lyricError.stack}`);
        }

        if (!lyricText) {
            logger.warn(`[歌词获取] 未获取到歌词文本`);
            return null;
        }

        const parsedLyrics = parseLyric(lyricText);
        const parsedTranslation = translationText ? parseLyric(translationText) : [];

        return {
            name: song.name || song.title,
            artist: Array.isArray(song.artist) ? song.artist.join(', ') : (song.artist || '未知歌手'),
            album: song.album || '',
            lyrics: parsedLyrics,
            translation: parsedTranslation,
            hasTranslation: parsedTranslation.length > 0
        };
    } catch (error) {
        logger.error(`[歌词获取] Meting获取失败: ${error.message}`);
        return null;
    }
}

/**
 * 解析LRC格式歌词
 * @param {string} lrcText - LRC格式歌词文本
 * @returns {Array<{time: number, text: string}>} 解析后的歌词数组
 */
function parseLyric(lrcText) {
    if (!lrcText) return [];

    const lines = lrcText.split('\n');
    const result = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;

    for (const line of lines) {
        const matches = [...line.matchAll(timeRegex)];
        if (matches.length === 0) continue;

        const text = line.replace(timeRegex, '').trim();
        if (!text) continue;

        for (const match of matches) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            const milliseconds = parseInt(match[3].padEnd(3, '0'));
            const time = minutes * 60 + seconds + milliseconds / 1000;

            result.push({ time, text });
        }
    }

    return result.sort((a, b) => a.time - b.time);
}

/**
 * 查找最佳匹配的翻译歌词
 * 采用精确匹配优先策略，避免错误匹配
 * @param {number} lyricTime - 原文歌词时间戳（秒）
 * @param {Array} translations - 翻译歌词数组
 * @returns {object|null} 匹配的翻译项或null
 */
function findBestTranslation(lyricTime, translations) {
    const EXACT_THRESHOLD = 0.1;
    const FALLBACK_THRESHOLD = 0.5;
    let bestMatch = null;
    let minDiff = FALLBACK_THRESHOLD;

    for (const t of translations) {
        const diff = Math.abs(t.time - lyricTime);
        if (diff <= EXACT_THRESHOLD) {
            return t;
        }
        if (diff < minDiff) {
            minDiff = diff;
            bestMatch = t;
        }
    }

    return bestMatch;
}

/**
 * 格式化歌词消息
 * @param {object} lyricsInfo - 歌词信息
 * @returns {string} 格式化后的消息
 */
function formatLyricsMessage(lyricsInfo) {
    const header = `🎵 《${lyricsInfo.name}》\n👤 ${lyricsInfo.artist}\n💿 ${lyricsInfo.album || '未知专辑'}\n${'─'.repeat(20)}`;

    let lyricsText = '';
    const maxLines = 30;
    const displayLyrics = lyricsInfo.lyrics.slice(0, maxLines);

    if (lyricsInfo.translation.length > 0) {
        for (let i = 0; i < displayLyrics.length; i++) {
            lyricsText += `\n${displayLyrics[i].text}`;
            const transItem = findBestTranslation(displayLyrics[i].time, lyricsInfo.translation);
            if (transItem) {
                lyricsText += `\n  📝 ${transItem.text}`;
            }
        }
    } else {
        lyricsText = '\n' + displayLyrics.map(l => l.text).join('\n');
    }

    if (lyricsInfo.lyrics.length > maxLines) {
        lyricsText += `\n\n... 共 ${lyricsInfo.lyrics.length} 行歌词`;
    }

    return header + lyricsText;
}

/**
 * 处理获取歌单
 * @param {object} params - 参数对象
 * @param {string} params.playlist_id - 歌单ID
 * @param {string} params.platform - 音乐平台
 * @param {number} params.limit - 返回歌曲数量限制
 * @param {object} e - 事件对象
 * @returns {Promise<object>} 执行结果
 */
async function handleGetPlaylist(params, e) {
    const { playlist_id, platform = 'tencent', limit = 10 } = params;

    if (!playlist_id) {
        return { error: true, message: '请提供歌单ID' };
    }

    const actualLimit = Math.min(Math.max(1, limit), 30);

    try {
        const playlistInfo = await getPlaylistByMeting(playlist_id, platform, actualLimit);

        if (!playlistInfo) {
            return { error: true, message: `没有找到歌单 ${playlist_id}` };
        }

        logger.info(`[互动] 获取歌单 | 平台:${platform} | 歌单:${playlistInfo.name} | 歌曲数:${playlistInfo.songs.length}`);

        return {
            success: true,
            name: playlistInfo.name,
            description: playlistInfo.description,
            total_count: playlistInfo.totalCount,
            songs: playlistInfo.songs,
            formatted_message: formatPlaylistMessage(playlistInfo)
        };
    } catch (error) {
        logger.error(`[互动] 获取歌单失败: ${error.message}`);
        return { error: true, message: `获取歌单失败: ${error.message}` };
    }
}

/**
 * 使用Meting获取歌单
 * @param {string} playlistId - 歌单ID
 * @param {string} platform - 平台代码
 * @param {number} limit - 返回数量限制
 * @returns {Promise<object|null>} 歌单信息
 */
async function getPlaylistByMeting(playlistId, platform, limit) {
    try {
        const loaded = await loadMeting();
        if (!loaded) {
            logger.warn(`[歌单获取] @meting/core 模块未安装`);
            return null;
        }

        const meting = getMeting(platform);
        if (!meting) {
            logger.error(`[歌单获取] 获取Meting实例失败`);
            return null;
        }

        const playlistResult = await meting.playlist(playlistId);
        let playlistData;
        try {
            playlistData = JSON.parse(playlistResult);
        } catch (parseError) {
            logger.error(`[歌单获取] JSON解析失败: ${parseError.message}`);
            return null;
        }

        if (!playlistData || (Array.isArray(playlistData) && playlistData.length === 0)) {
            return null;
        }

        const tracks = Array.isArray(playlistData) ? playlistData : (playlistData.tracks || playlistData.songs || []);
        const playlistName = playlistData.name || playlistData.title || '未知歌单';
        const description = playlistData.description || playlistData.desc || '';

        const songs = tracks.slice(0, limit).map((track, index) => ({
            index: index + 1,
            name: track.name || track.title,
            artist: Array.isArray(track.artist) ? track.artist.join(', ') : (track.artist || '未知歌手'),
            album: track.album || '',
            id: track.id,
            duration: track.duration || 0
        }));

        return {
            name: playlistName,
            description: description,
            totalCount: tracks.length,
            songs: songs
        };
    } catch (error) {
        logger.error(`[歌单获取] Meting获取失败: ${error.message}`);
        return null;
    }
}

/**
 * 格式化歌单消息
 * @param {object} playlistInfo - 歌单信息
 * @returns {string} 格式化后的消息
 */
function formatPlaylistMessage(playlistInfo) {
    let msg = `📋 《${playlistInfo.name}》\n`;
    if (playlistInfo.description) {
        msg += `📝 ${playlistInfo.description.substring(0, 50)}${playlistInfo.description.length > 50 ? '...' : ''}\n`;
    }
    msg += `🎵 共 ${playlistInfo.totalCount} 首歌曲\n`;
    msg += `${'─'.repeat(20)}\n`;

    for (const song of playlistInfo.songs) {
        msg += `\n${song.index}. ${song.name}`;
        msg += `\n   👤 ${song.artist}`;
        if (song.album) {
            msg += ` | 💿 ${song.album}`;
        }
    }

    if (playlistInfo.totalCount > playlistInfo.songs.length) {
        msg += `\n\n... 还有 ${playlistInfo.totalCount - playlistInfo.songs.length} 首歌曲`;
    }

    return msg;
}

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

    const memeConfig = MEME_CONFIG[meme_type];
    if (!memeConfig) {
        return { error: true, message: `不支持的表情包类型: ${meme_type}` };
    }

    if (memeConfig.needsText && !text) {
        return { error: true, message: `${memeConfig.name}表情包需要提供文字内容。${memeConfig.textHint}` };
    }

    const targetUserId = user_id || currentUserId;
    if (!targetUserId) {
        return { error: true, message: '缺少目标用户ID，请提供user_id参数' };
    }

    if (!e) {
        return { error: true, message: '无法获取用户信息：缺少事件对象' };
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
                return { error: true, message: '无法获取用户头像' };
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
            return { error: true, message: `表情包生成失败，API返回错误: ${response.status}` };
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
            user_id: String(targetUserId),
            message: `已生成${memeConfig.name}表情包`
        };
    } catch (error) {
        logger.error(`[表情包] 生成失败: ${error.message}`);
        return { error: true, message: `表情包生成失败: ${error.message}` };
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
