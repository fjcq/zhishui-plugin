/**
 * 音乐服务实现模块
 * 提供音乐搜索、播放、歌词、歌单等功能
 */

import {
    validateMusicPlatform,
    loadMeting,
    getMeting,
    getSegment,
    createVoiceWithTimeout,
    formatDuration,
    getPlatformLink,
    getPlatformName
} from './musicCore.js';

const logger = global.logger || console;

/**
 * 搜索音乐列表
 * @param {string} keyword - 搜索关键词
 * @param {string} platform - 平台代码
 * @param {number} limit - 返回数量限制
 * @returns {Promise<Array<object>|null>} 歌曲列表
 */
export async function searchMusicList(keyword, platform, limit = 5) {
    try {
        const loaded = await loadMeting();
        if (!loaded) {
            logger.warn(`[音乐搜索] @meting/core 模块未安装`);
            return null;
        }

        const meting = getMeting(platform);
        if (!meting) {
            logger.error(`[音乐搜索] 获取Meting实例失败`);
            return null;
        }

        const searchResult = await meting.search(keyword, { page: 1, limit: limit });

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

        const results = songs.map((song, index) => ({
            index: index + 1,
            name: song.name || song.title,
            artist: Array.isArray(song.artist) ? song.artist.join(', ') : (song.artist || '未知歌手'),
            id: song.id,
            album: song.album || '',
            duration: song.duration || 0,
            link: getPlatformLink(platform, song.id)
        }));

        return results;
    } catch (error) {
        logger.error(`[音乐搜索] Meting搜索失败: ${error.message}`);
        return null;
    }
}

/**
 * 获取歌曲详情
 * @param {string} songId - 歌曲ID
 * @param {string} platform - 平台代码
 * @returns {Promise<object|null>} 歌曲详情
 */
export async function getSongDetail(songId, platform) {
    try {
        const loaded = await loadMeting();
        if (!loaded) {
            logger.warn(`[音乐播放] @meting/core 模块未安装`);
            return null;
        }

        const meting = getMeting(platform);
        if (!meting) {
            logger.error(`[音乐播放] 获取Meting实例失败`);
            return null;
        }

        let musicUrl = '';
        let duration = 0;
        try {
            const urlResult = await meting.url(songId, 320);
            const urlData = JSON.parse(urlResult);
            musicUrl = urlData?.url || '';
            // 优先使用API返回的duration
            if (urlData?.duration && urlData.duration > 0) {
                duration = urlData.duration;
            } else if (urlData?.size && urlData?.br && urlData.br > 0) {
                // 备用：通过文件大小和比特率计算
                duration = Math.round((urlData.size * 8) / (urlData.br * 1000));
            }
        } catch (urlError) {
            logger.warn(`[音乐播放] 获取播放链接失败: ${urlError.message}`);
        }

        let picUrl = '';
        let songName = '';
        let artistName = '';
        let albumName = '';
        try {
            const picResult = await meting.pic(songId, 300);
            const picData = JSON.parse(picResult);
            picUrl = picData?.url || '';
            songName = picData?.name || picData?.title || '';
            artistName = picData?.artist || '';
            albumName = picData?.album || '';
        } catch (picError) {
            logger.warn(`[音乐播放] 获取封面失败: ${picError.message}`);
        }

        return {
            name: songName,
            artist: Array.isArray(artistName) ? artistName.join(', ') : (artistName || '未知歌手'),
            id: songId,
            url: musicUrl,
            duration: duration,
            album: albumName,
            pic: picUrl,
            link: getPlatformLink(platform, songId)
        };
    } catch (error) {
        logger.error(`[音乐播放] 获取歌曲详情失败: ${error.message}`);
        return null;
    }
}

/**
 * 发送音乐卡片
 * @param {object} e - 事件对象
 * @param {object} songInfo - 歌曲信息
 * @param {string} platform - 平台类型
 */
export async function sendMusicCard(e, songInfo, platform) {
    try {
        const platformName = getPlatformName(platform);

        const MAX_VOICE_DURATION = 300;
        const duration = songInfo.duration || 0;
        const hasValidUrl = songInfo.url && songInfo.url.startsWith('http');

        // 判断是否可以发送语音
        // 条件：有有效URL，且时长不超过限制（时长为0时也尝试发送）
        const canSendVoice = hasValidUrl &&
            (duration === 0 || duration <= MAX_VOICE_DURATION);

        if (canSendVoice) {
            await e.reply(`正在获取《${songInfo.name}》，请稍等...`);

            try {
                const segment = await getSegment();

                if (segment) {
                    const recordMsg = await createVoiceWithTimeout(segment, songInfo.url);
                    await e.reply(recordMsg);
                    logger.info(`[点歌] 发送语音成功 | 平台:${platformName} | ${songInfo.name} - ${songInfo.artist} | 时长:${duration > 0 ? duration + '秒' : '未知'}`);
                    return;
                }
            } catch (recordError) {
                logger.warn(`[点歌] 语音发送失败: ${recordError.message}，将发送链接`);
            }
        } else if (duration > MAX_VOICE_DURATION) {
            logger.info(`[点歌] 歌曲时长${duration}秒超过限制，发送链接`);
        } else if (!hasValidUrl) {
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
 * 获取歌词
 * @param {string} keyword - 搜索关键词
 * @param {string} platform - 平台代码
 * @param {boolean} showTranslation - 是否显示翻译（默认true）
 * @returns {Promise<object|null>} 歌词信息
 */
export async function getLyrics(keyword, platform, showTranslation = true) {
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
        const parsedTranslation = (showTranslation && translationText) ? parseLyric(translationText) : [];

        return {
            name: song.name || song.title,
            artist: Array.isArray(song.artist) ? song.artist.join(', ') : (song.artist || '未知歌手'),
            album: song.album || '',
            lyrics: parsedLyrics,
            translation: parsedTranslation,
            hasTranslation: showTranslation && parsedTranslation.length > 0
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
 * @param {number} lyricTime - 原文歌词时间戳（秒）
 * @param {Array} translations - 翻译歌词数组
 * @returns {object|null} 匹配的翻译项或null
 */
export function findBestTranslation(lyricTime, translations) {
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
 * 获取歌单
 * @param {string} playlistId - 歌单ID
 * @param {string} platform - 平台代码
 * @param {number} limit - 返回数量限制
 * @returns {Promise<object|null>} 歌单信息
 */
export async function getPlaylist(playlistId, platform, limit) {
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
