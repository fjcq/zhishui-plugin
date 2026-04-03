/**
 * 音乐工具处理函数
 * 处理AI调用的音乐相关工具
 */

import {
    validateMusicPlatform,
    formatDuration
} from './musicCore.js';
import {
    searchMusicList,
    getSongDetail,
    sendMusicCard,
    getLyrics,
    getPlaylist,
    findBestTranslation
} from './musicService.js';

const logger = global.logger || console;

/**
 * 处理音乐工具调用
 * @param {string} toolName - 工具名称
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象
 * @returns {Promise<object>} 工具执行结果
 */
export async function handleMusicToolCall(toolName, params, e) {
    let result;
    try {
        switch (toolName) {
            case 'search_music':
                result = await handleSearchMusic(params, e);
                break;
            case 'play_music':
                result = await handlePlayMusic(params, e);
                break;
            case 'get_lyrics':
                result = await handleGetLyrics(params, e);
                break;
            case 'get_playlist':
                result = await handleGetPlaylist(params, e);
                break;
            default:
                result = { error: true, error_message: `未知的音乐工具: ${toolName}` };
        }
    } catch (error) {
        logger.error(`[音乐工具] ${toolName} 执行失败: ${error.message}`);
        result = { error: true, error_message: `操作失败: ${error.message}` };
    }

    return result;
}

/**
 * 处理搜索音乐
 * @param {object} params - 参数对象
 * @param {string} params.keyword - 搜索关键词
 * @param {string} params.platform - 音乐平台 netease/tencent/kugou/kuwo
 * @param {number} params.limit - 返回结果数量
 * @param {object} e - 事件对象
 * @returns {Promise<object>} 执行结果
 */
async function handleSearchMusic(params, e) {
    const { keyword, platform = 'kugou', limit = 5 } = params;

    if (!keyword) {
        return { error: true, error_message: '缺少歌曲关键词参数' };
    }

    const platformError = validateMusicPlatform(platform);
    if (platformError) return platformError;

    const actualLimit = Math.min(Math.max(1, limit), 10);

    try {
        const songs = await searchMusicList(keyword, platform, actualLimit);

        if (!songs || songs.length === 0) {
            return { error: true, error_message: `没有找到"${keyword}"相关的歌曲` };
        }

        logger.info(`[互动] 搜索音乐 | 平台:${platform} | 关键词:${keyword} | 结果数:${songs.length}`);

        return {
            success: true,
            keyword: keyword,
            platform: platform,
            total_count: songs.length,
            songs: songs
        };
    } catch (error) {
        logger.error(`[互动] 搜索音乐失败: ${error.message}`);
        return { error: true, error_message: `搜索音乐失败: ${error.message}` };
    }
}

/**
 * 处理播放音乐
 * @param {object} params - 参数对象
 * @param {string} params.song_id - 歌曲ID
 * @param {string} params.platform - 音乐平台 netease/tencent/kugou/kuwo
 * @param {string} params.song_name - 歌曲名称（可选）
 * @param {string} params.artist - 歌手名称（可选）
 * @param {object} e - 事件对象
 * @returns {Promise<object>} 执行结果
 */
async function handlePlayMusic(params, e) {
    const { song_id, platform, song_name = '', artist = '' } = params;

    if (!song_id) {
        return { error: true, error_message: '缺少歌曲ID参数' };
    }

    if (!platform) {
        return { error: true, error_message: '缺少音乐平台参数' };
    }

    const platformError = validateMusicPlatform(platform);
    if (platformError) return platformError;

    if (!e) {
        return { error: true, error_message: '无法发送消息：缺少事件对象' };
    }

    try {
        const songInfo = await getSongDetail(song_id, platform, { songName: song_name, artist });

        if (!songInfo) {
            return { error: true, error_message: `无法获取歌曲信息，ID: ${song_id}` };
        }

        await sendMusicCard(e, songInfo, platform);

        logger.info(`[互动] 播放音乐 | 平台:${platform} | 歌曲:${songInfo.name} - ${songInfo.artist}`);

        return {
            success: true,
            name: songInfo.name,
            artist: songInfo.artist,
            platform: platform,
            song_id: song_id
        };
    } catch (error) {
        logger.error(`[互动] 播放音乐失败: ${error.message}`);
        return { error: true, error_message: `播放音乐失败: ${error.message}` };
    }
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
    const { keyword, platform = 'kugou', show_translation = true } = params;

    if (!keyword) {
        return { error: true, error_message: '缺少歌曲关键词参数' };
    }

    const platformError = validateMusicPlatform(platform);
    if (platformError) return platformError;

    try {
        const lyricsInfo = await getLyrics(keyword, platform, show_translation);

        if (!lyricsInfo) {
            return { error: true, error_message: `没有找到"${keyword}"的歌词` };
        }

        logger.info(`[互动] 获取歌词 | 平台:${platform} | 歌曲:${lyricsInfo.name} - ${lyricsInfo.artist}`);

        return {
            success: true,
            name: lyricsInfo.name,
            artist: lyricsInfo.artist,
            album: lyricsInfo.album,
            lyrics: lyricsInfo.lyrics,
            translation: lyricsInfo.translation,
            has_translation: lyricsInfo.hasTranslation
        };
    } catch (error) {
        logger.error(`[互动] 获取歌词失败: ${error.message}`);
        return { error: true, error_message: `获取歌词失败: ${error.message}` };
    }
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
    const { playlist_id, platform = 'kugou', limit = 10 } = params;

    if (!playlist_id) {
        return { error: true, error_message: '缺少歌单ID参数' };
    }

    const platformError = validateMusicPlatform(platform);
    if (platformError) return platformError;

    const actualLimit = Math.min(Math.max(1, limit), 30);

    try {
        const playlistInfo = await getPlaylist(playlist_id, platform, actualLimit);

        if (!playlistInfo) {
            return { error: true, error_message: `没有找到歌单 ${playlist_id}` };
        }

        logger.info(`[互动] 获取歌单 | 平台:${platform} | 歌单:${playlistInfo.name} | 歌曲数:${playlistInfo.songs.length}`);

        return {
            success: true,
            name: playlistInfo.name,
            description: playlistInfo.description,
            total_count: playlistInfo.totalCount,
            songs: playlistInfo.songs
        };
    } catch (error) {
        logger.error(`[互动] 获取歌单失败: ${error.message}`);
        return { error: true, error_message: `获取歌单失败: ${error.message}` };
    }
}

export { findBestTranslation };
