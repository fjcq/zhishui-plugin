/**
 * 音乐服务实现模块（多源策略）
 *
 * 降级链：
 * - 网易云：官方API（ncmService）→ @meting/core
 * - QQ/酷狗/酷我：自建API（musicApiClient）→ @meting/core
 *
 * 自建API服务随Yunzai启动/停止，仅本机访问，提供音频直链能力
 */

import {
    validateMusicPlatform,
    loadMeting,
    getMeting,
    getSegment,
    createVoiceWithTimeout,
    formatDuration,
    getPlatformLink,
    getPlatformName,
    downloadAudioFile
} from './musicCore.js';
import {
    ncmSearch,
    ncmSongUrl,
    ncmSongDetail,
    ncmLyric,
    ncmPlaylist,
    checkNcmAvailable,
    kugouSearch,
    checkKugouAvailable
} from './ncmService.js';
import {
    checkMusicApiAvailable,
    musicApiSearch,
    musicApiSongUrl,
    musicApiLyric,
    musicApiDetail,
    musicApiPlaylist
} from './musicApiClient.js';
import { logger } from '../../../../components/index.js';
import fs from 'fs';

/** 自建API支持的平台列表 */
const MUSIC_API_PLATFORMS = ['tencent', 'kugou', 'kuwo'];

/** 自建API可用性缓存（5分钟） */
let musicApiAvailableCache = null;
let musicApiAvailableExpire = 0;

/**
 * 异步判断是否应使用官方 API 搜索（含连通性检查）
 * @param {string} platform - 平台代码
 * @returns {Promise<boolean>} 是否使用官方 API 搜索
 */
async function shouldUseOfficialSearchAsync(platform) {
    if (platform === 'netease') {
        return await checkNcmAvailable();
    }
    if (platform === 'kugou') {
        return await checkKugouAvailable();
    }
    return false;
}

/**
 * 检查自建 API 是否可用（带5分钟缓存）
 * @param {boolean} forceRefresh - 是否强制刷新
 * @returns {Promise<boolean>} 是否可用
 */
async function isMusicApiAvailable(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && musicApiAvailableCache !== null && now < musicApiAvailableExpire) {
        return musicApiAvailableCache;
    }
    const result = await checkMusicApiAvailable();
    musicApiAvailableCache = result;
    musicApiAvailableExpire = now + 5 * 60 * 1000;
    return result;
}

/**
 * 判断平台是否应使用自建 API
 * @param {string} platform - 平台代码
 * @returns {boolean} 是否走自建API
 */
function shouldUseMusicApi(platform) {
    return MUSIC_API_PLATFORMS.includes(platform);
}

/**
 * 搜索音乐列表（多源策略）
 *
 * 降级顺序：
 * 1. 网易云：官方API → @meting/core
 * 2. QQ/酷狗/酷我：自建API → @meting/core
 *
 * @param {string} keyword - 搜索关键词
 * @param {string} platform - 平台代码
 * @param {number} limit - 返回数量限制
 * @returns {Promise<Array<object>|null>} 歌曲列表
 */
export async function searchMusicList(keyword, platform, limit = 5) {
    const actualLimit = Math.min(Math.max(1, limit), 10);

    // 自建API优先（QQ/酷狗/酷我）
    if (shouldUseMusicApi(platform) && await isMusicApiAvailable()) {
        try {
            const results = await musicApiSearch(platform, keyword, actualLimit);
            if (results && results.length > 0) {
                return results.map(song => ({
                    ...song,
                    link: getPlatformLink(platform, song.id)
                }));
            }
            logger.info(`[搜索] 自建API无结果，尝试降级`);
        } catch (error) {
            logger.warn(`[搜索] 自建API失败: ${error.message}, 尝试降级`);
        }
    }

    // 优先使用官方API搜索（先检查可用性）
    if (await shouldUseOfficialSearchAsync(platform)) {
        try {
            let results = null;

            if (platform === 'netease') {
                results = await ncmSearch(keyword, actualLimit);
            } else if (platform === 'kugou') {
                results = await kugouSearch(keyword, actualLimit);
            }

            if (results && results.length > 0) {
                return results.map(song => ({
                    ...song,
                    link: getPlatformLink(platform, song.id)
                }));
            }
            logger.info(`[搜索] 官方API无结果，尝试Meting降级`);
        } catch (error) {
            logger.warn(`[搜索] 官方API失败: ${error.message}, 尝试Meting降级`);
        }
    }

    // 降级：使用 @meting/core
    return await searchMusicListByMeting(keyword, platform, actualLimit);
}

/**
 * 通过 Meting 搜索音乐（降级方案）
 * @param {string} keyword - 搜索关键词
 * @param {string} platform - 平台代码
 * @param {number} limit - 返回数量限制
 * @returns {Promise<Array<object>|null>} 歌曲列表
 */
async function searchMusicListByMeting(keyword, platform, limit) {
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
 * 获取歌曲详情（多源策略）
 *
 * 降级顺序：
 * 1. 网易云：官方API（获取音频直链）
 * 2. QQ/酷狗/酷我：自建API（获取音频直链）
 * 3. 所有平台：@meting/core 降级
 *
 * @param {string} songId - 歌曲ID
 * @param {string} platform - 平台代码
 * @param {object} options - 可选参数
 * @param {string} options.songName - 歌曲名称（备选）
 * @param {string} options.artist - 歌手名称（备选）
 * @param {string} [options.mediaMid] - QQ音乐 media_mid（来自搜索结果，避免重复请求）
 * @returns {Promise<object|null>} 歌曲详情
 */
export async function getSongDetail(songId, platform, options = {}) {
    const { songName: fallbackName = '', artist: fallbackArtist = '', mediaMid = '' } = options;

    // 网易云：优先使用官方API获取音频直链（先检查可用性）
    if (platform === 'netease' && await checkNcmAvailable()) {
        try {
            const result = await getSongDetailByNcm(songId, platform, fallbackName, fallbackArtist);
            if (result) return result;
        } catch (error) {
            logger.warn(`[歌曲详情] 官方API失败: ${error.message}, 尝试降级`);
        }
    }

    // 自建API：QQ/酷狗/酷我
    if (shouldUseMusicApi(platform) && await isMusicApiAvailable()) {
        try {
            const result = await getSongDetailByMusicApi(songId, platform, fallbackName, fallbackArtist, mediaMid);
            if (result) return result;
        } catch (error) {
            logger.warn(`[歌曲详情] 自建API失败: ${error.message}, 尝试Meting降级`);
        }
    }

    // 降级：使用 @meting/core
    return await getSongDetailByMeting(songId, platform, fallbackName, fallbackArtist);
}

/**
 * 通过自建API获取歌曲详情
 *
 * QQ音乐：先调 detail 接口获取 name/artist/album/mediaMid，再用 mediaMid 调 url
 *   - detail 接口已切换为公开的 fcg_play_single_song.fcg，无需签名
 *   - 如果 detail 失败，回退到用 songName+artist 搜索获取
 *   - 上游透传的 mediaMid 作为最后兜底
 *
 * 其他平台（酷狗/酷我）：并行请求 detail 和 url
 *
 * @param {string} songId - 歌曲ID
 * @param {string} platform - 平台代码
 * @param {string} fallbackName - 备用歌名
 * @param {string} fallbackArtist - 备用歌手名
 * @param {string} [mediaMid=''] - 上游透传的 mediaMid
 * @returns {Promise<object|null>} 歌曲详情
 */
async function getSongDetailByMusicApi(songId, platform, fallbackName, fallbackArtist, mediaMid = '') {
    const isQQ = platform === 'qq' || platform === 'tencent';

    let detailData = null;
    let urlInfo = null;

    if (isQQ) {
        // QQ音乐：优先调用 detail 接口获取完整歌曲信息和 mediaMid
        try {
            detailData = await musicApiDetail(platform, songId);
        } catch (e) {
            logger.warn(`[歌曲详情] QQ detail 失败: ${e.message}`);
        }

        // detail 提供的 mediaMid 优先；上游透传的 mediaMid 作为兜底
        let resolvedMediaMid = detailData?.mediaMid || mediaMid || '';

        // 如果 detail 失败且没有 mediaMid，用 fallbackName+artist 搜索回补
        if (!resolvedMediaMid && fallbackName) {
            try {
                const keyword = fallbackArtist ? `${fallbackName} ${fallbackArtist}` : fallbackName;
                const searchResults = await musicApiSearch(platform, keyword, 5);
                const matched = searchResults?.find(s => s.id === songId) || searchResults?.[0];
                if (matched?.mediaMid) {
                    resolvedMediaMid = matched.mediaMid;
                    if (!detailData) detailData = matched;
                    logger.info(`[歌曲详情] 通过搜索回补 mediaMid | ${matched.name}`);
                }
            } catch (e) {
                logger.warn(`[歌曲详情] QQ 搜索回补 mediaMid 失败: ${e.message}`);
            }
        }

        // 用 mediaMid 请求播放链接
        try {
            urlInfo = await musicApiSongUrl(platform, songId, resolvedMediaMid);
        } catch (e) {
            logger.warn(`[歌曲详情] QQ url 失败: ${e.message}`);
        }
    } else {
        // 酷狗/酷我：并行请求 detail 和 url
        const [detailInfo, urlInfoRes] = await Promise.allSettled([
            musicApiDetail(platform, songId),
            musicApiSongUrl(platform, songId)
        ]);

        if (detailInfo.status === 'fulfilled') detailData = detailInfo.value;
        if (urlInfoRes.status === 'fulfilled') urlInfo = urlInfoRes.value;
    }

    let name = fallbackName;
    let artist = fallbackArtist;
    let album = '';
    let pic = '';
    let duration = 0;
    let musicUrl = '';

    // 解析详情
    if (detailData) {
        name = name || detailData.name;
        artist = artist || detailData.artist;
        album = album || detailData.album;
        pic = pic || detailData.pic;
        duration = duration || detailData.duration;
    }

    // 解析URL
    if (urlInfo) {
        musicUrl = urlInfo.url || '';
        if (urlInfo.canPlay === false) {
            logger.info(`[歌曲详情] 歌曲《${name || songId}》需要VIP或受版权保护，将发送链接`);
        }
    }

    if (!name && !musicUrl) {
        return null;
    }

    return {
        name: name || fallbackName,
        artist: artist || fallbackArtist || '未知歌手',
        id: songId,
        url: musicUrl,
        duration: duration,
        album: album,
        pic: pic,
        link: getPlatformLink(platform, songId),
        canPlayDirectly: urlInfo?.canPlay !== false && !!musicUrl
    };
}

/**
 * 通过 NCM API 获取歌曲详情（核心优势：返回音频直链）
 * @param {string} songId - 歌曲ID
 * @param {string} platform - 平台代码
 * @param {string} fallbackName - 备用歌名
 * @param {string} fallbackArtist - 备用歌手名
 * @returns {Promise<object|null>} 歌曲详情
 */
async function getSongDetailByNcm(songId, platform, fallbackName, fallbackArtist) {
    // 并行获取详情和URL以提高速度
    const [detailInfo, urlInfo] = await Promise.allSettled([
        ncmSongDetail(songId),
        ncmSongUrl(songId)
    ]);

    let name = fallbackName;
    let artist = fallbackArtist;
    let album = '';
    let pic = '';
    let duration = 0;
    let musicUrl = '';

    // 解析详情
    if (detailInfo.status === 'fulfilled' && detailInfo.value) {
        const d = detailInfo.value;
        name = name || d.name;
        artist = artist || d.artist;
        album = album || d.album;
        pic = pic || d.pic;
        duration = duration || d.duration;
    }

    // 解析URL
    if (urlInfo.status === 'fulfilled' && urlInfo.value) {
        const u = urlInfo.value;
        musicUrl = u.url;
        if (u.canPlay === false) {
            logger.info(`[歌曲详情] 歌曲《${name || songId}》需要VIP或受版权保护，将发送卡片`);
        }
    }

    if (!name && !musicUrl) {
        return null;
    }

    return {
        name: name || fallbackName,
        artist: artist || fallbackArtist || '未知歌手',
        id: songId,
        url: musicUrl,
        duration: duration,
        album: album,
        pic: pic,
        link: getPlatformLink(platform, songId),
        canPlayDirectly: urlInfo?.value?.canPlay !== false && !!musicUrl
    };
}

/**
 * 通过 Meting 获取歌曲详情（降级方案）
 * @param {string} songId - 歌曲ID
 * @param {string} platform - 平台代码
 * @param {string} fallbackName - 备用歌名
 * @param {string} fallbackArtist - 备用歌手名
 * @returns {Promise<object|null>} 歌曲详情
 */
async function getSongDetailByMeting(songId, platform, fallbackName, fallbackArtist) {
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
            // 依次尝试不同音质：320 > 192 > 128
            const bitrates = [320, 192, 128];
            for (const br of bitrates) {
                const urlResult = await meting.url(songId, br);
                const urlData = JSON.parse(urlResult);
                const candidateUrl = urlData?.url || '';

                if (!candidateUrl) continue;

                // 快速验证URL是否看起来像音频直链
                const isHtmlPage = candidateUrl.includes('/song') &&
                    !candidateUrl.includes('.mp3') &&
                    !candidateUrl.includes('.m4a');
                if (isHtmlPage) {
                    logger.info(`[音乐播放] ${br}kbps URL疑似网页链接，尝试更低音质`);
                    continue;
                }

                musicUrl = candidateUrl;

                if (urlData?.duration && urlData.duration > 0) {
                    duration = urlData.duration;
                } else if (urlData?.size && urlData?.br && urlData.br > 0) {
                    duration = Math.round((urlData.size * 8) / (urlData.br * 1000));
                }

                logger.info(`[音乐播放] 获取${br}kbps链接成功 | ${songId}`);
                break;
            }

            if (!musicUrl) {
                logger.warn(`[音乐播放] 所有音质均未获取到有效播放链接 | ${songId}`);
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

        songName = songName || fallbackName;
        artistName = artistName || fallbackArtist;

        return {
            name: songName,
            artist: Array.isArray(artistName) ? artistName.join(', ') : (artistName || '未知歌手'),
            id: songId,
            url: musicUrl,
            duration: duration,
            album: albumName,
            pic: picUrl,
            link: getPlatformLink(platform, songId),
            canPlayDirectly: !!musicUrl
        };
    } catch (error) {
        logger.error(`[音乐播放] 获取歌曲详情失败: ${error.message}`);
        return null;
    }
}

/**
 * 发送音乐
 * 降级策略：语音消息 → 文本+链接
 * @param {object} e - 事件对象
 * @param {object} songInfo - 歌曲信息
 * @param {string} platform - 平台类型
 */
export async function sendMusic(e, songInfo, platform) {
    try {
        const platformName = getPlatformName(platform);
        const duration = songInfo.duration || 0;
        const hasValidUrl = songInfo.url && songInfo.url.startsWith('http');
        // canPlayDirectly=false 表示 VIP/版权歌曲，直接跳过语音发送
        const canPlayDirectly = songInfo.canPlayDirectly !== false && hasValidUrl;

        // 策略1：发送语音消息（需可播放、有效音频URL且时长 ≤ 5分钟）
        if (canPlayDirectly && (duration === 0 || duration <= 300)) {
            const voiceSent = await trySendVoice(e, songInfo, platformName, duration);
            if (voiceSent) return;
        } else if (hasValidUrl && duration > 300) {
            logger.info(`[点歌] 歌曲时长${duration}秒超过语音限制(300秒)，跳过语音发送`);
        } else if (!canPlayDirectly && hasValidUrl) {
            logger.info(`[点歌] 歌曲《${songInfo.name}》不可直接播放（VIP/版权），跳过语音发送`);
        }

        // 策略2：降级为文本+链接
        await sendFallbackText(e, songInfo, platformName, duration);
    } catch (error) {
        logger.error(`[发送音乐] 失败: ${error.message}`);
        await e.reply(`歌曲：${songInfo.name} - ${songInfo.artist}\n链接：${songInfo.link}`);
    }
}

/**
 * 尝试发送语音消息
 * @param {object} e - 事件对象
 * @param {object} songInfo - 歌曲信息
 * @param {string} platformName - 平台中文名
 * @param {number} duration - 歌曲时长(秒)
 * @returns {Promise<boolean>} 是否发送成功
 */
async function trySendVoice(e, songInfo, platformName, duration) {
    try {
        // 兜底显示：name 为空时不显示《》
        const displayName = songInfo.name || '歌曲';
        await e.reply(`正在获取《${displayName}》，请稍等...`);

        const segment = await getSegment();
        if (!segment) return false;

        // 所有 URL 统一走下载到本地路径，并在 downloadAudioFile 中验证音频头
        // 这样可以避免直链发送版权声明音频（ID3+MP4 容器）
        const fileName = `${songInfo.id || Date.now()}.mp3`;
        const localPath = await downloadAudioFile(songInfo.url, fileName);
        if (!localPath) {
            logger.warn(`[点歌] 音频下载或文件头验证失败，跳过语音发送 | ${songInfo.url.substring(0, 80)}`);
            return false;
        }

        try {
            const recordMsg = segment.record(localPath);
            await e.reply(recordMsg);
            // 发送成功后删除临时文件
            try { fs.unlinkSync(localPath); } catch (_) { /* 忽略清理失败 */ }
            logger.info(`[点歌] 发送语音成功 | 平台:${platformName} | ${songInfo.name} - ${songInfo.artist} | 时长:${formatDuration(duration)}`);
            return true;
        } catch (localError) {
            logger.warn(`[点歌] 本地文件语音发送失败: ${localError.message}`);
            try { fs.unlinkSync(localPath); } catch (_) { /* 忽略清理失败 */ }
        }

        return false;
    } catch (error) {
        logger.warn(`[点歌] 语音发送失败: ${error.message}`);
        return false;
    }
}

/**
 * 降级发送文本+链接
 * @param {object} e - 事件对象
 * @param {object} songInfo - 歌曲信息
 * @param {string} platformName - 平台中文名
 * @param {number} duration - 歌曲时长(秒)
 */
async function sendFallbackText(e, songInfo, platformName, duration) {
    const textMsg = `🎵 ${songInfo.name}\n👤 ${songInfo.artist}\n💿 ${songInfo.album || '未知专辑'}\n⏱️ ${formatDuration(duration)}\n🔗 ${songInfo.link}`;
    await e.reply(textMsg);
    logger.info(`[点歌] 发送链接成功 | 平台:${platformName} | ${songInfo.name} - ${songInfo.artist}`);
}

/**
 * 获取歌词（多源策略）
 *
 * 降级顺序：
 * 1. 网易云：官方API
 * 2. QQ/酷狗/酷我：自建API（搜索取ID后获取歌词）
 * 3. 所有平台：@meting/core
 *
 * @param {string} keyword - 搜索关键词
 * @param {string} platform - 平台代码
 * @param {boolean} showTranslation - 是否显示翻译（默认true）
 * @returns {Promise<object|null>} 歌词信息
 */
export async function getLyrics(keyword, platform, showTranslation = true) {
    // 网易云：优先使用官方API获取歌词
    if (platform === 'netease' && await checkNcmAvailable()) {
        try {
            const result = await getLyricsByNcm(keyword, showTranslation);
            if (result) return result;
        } catch (error) {
            logger.warn(`[歌词获取] NCM失败: ${error.message}, 尝试降级`);
        }
    }

    // 自建API：QQ/酷狗/酷我
    if (shouldUseMusicApi(platform) && await isMusicApiAvailable()) {
        try {
            const result = await getLyricsByMusicApi(keyword, platform, showTranslation);
            if (result) return result;
            logger.info(`[歌词获取] 自建API无结果，尝试Meting降级`);
        } catch (error) {
            logger.warn(`[歌词获取] 自建API失败: ${error.message}, 尝试Meting降级`);
        }
    }

    // 降级：使用 @meting/core
    return await getLyricsByMeting(keyword, platform, showTranslation);
}

/**
 * 通过 NCM API 获取歌词
 * @param {string} keyword - 搜索关键词
 * @param {boolean} showTranslation - 是否显示翻译
 * @returns {Promise<object|null>} 歌词信息
 */
async function getLyricsByNcm(keyword, showTranslation) {
    const searchResults = await ncmSearch(keyword, 1);
    if (!searchResults || searchResults.length === 0) return null;

    const songId = searchResults[0].id;
    const lyricData = await ncmLyric(songId, showTranslation);
    if (!lyricData || !lyricData.lyricText) return null;

    const parsedLyrics = parseLyric(lyricData.lyricText);
    const parsedTranslation = (showTranslation && lyricData.translationText)
        ? parseLyric(lyricData.translationText) : [];

    return {
        name: searchResults[0].name,
        artist: searchResults[0].artist,
        album: searchResults[0].album,
        lyrics: parsedLyrics,
        translation: parsedTranslation,
        hasTranslation: showTranslation && parsedTranslation.length > 0
    };
}

/**
 * 通过自建API获取歌词
 * @param {string} keyword - 搜索关键词
 * @param {string} platform - 平台代码
 * @param {boolean} showTranslation - 是否显示翻译
 * @returns {Promise<object|null>} 歌词信息
 */
async function getLyricsByMusicApi(keyword, platform, showTranslation) {
    const searchResults = await musicApiSearch(platform, keyword, 1);
    if (!searchResults || searchResults.length === 0) return null;

    const song = searchResults[0];
    const lyricData = await musicApiLyric(platform, song.id);
    if (!lyricData || !lyricData.lyric) return null;

    const parsedLyrics = parseLyric(lyricData.lyric);
    const parsedTranslation = (showTranslation && lyricData.translation)
        ? parseLyric(lyricData.translation) : [];

    return {
        name: song.name,
        artist: song.artist,
        album: song.album,
        lyrics: parsedLyrics,
        translation: parsedTranslation,
        hasTranslation: showTranslation && parsedTranslation.length > 0
    };
}

/**
 * 通过 Meting 获取歌词（降级方案）
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
        logger.info(`[歌词获取] 找到歌曲: ${song.name} - ID: ${song.id}`);

        let lyricText = '';
        let translationText = '';
        try {
            const lyricId = song.lyric_id || song.id;
            const lyricResult = await meting.lyric(lyricId);

            let lyricData;
            if (typeof lyricResult === 'string') {
                try {
                    lyricData = JSON.parse(lyricResult);
                } catch (e) {
                    lyricText = lyricResult;
                }
            } else {
                lyricData = lyricResult;
            }

            if (lyricData) {
                if (typeof lyricData === 'string') {
                    lyricText = lyricData;
                } else {
                    lyricText = lyricData.lyric || lyricData.lrc?.lyric || lyricData.lrc || '';
                    translationText = lyricData.tlyric?.lyric ||
                        lyricData.translate || lyricData.translation || '';
                }
            }
        } catch (lyricError) {
            logger.warn(`[歌词获取] 获取歌词失败: ${lyricError.message}`);
        }

        if (!lyricText) return null;

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
 * 获取歌单（多源策略）
 *
 * 降级顺序：
 * 1. 网易云：官方API
 * 2. QQ/酷狗/酷我：自建API
 * 3. 所有平台：@meting/core
 *
 * @param {string} playlistId - 歌单ID
 * @param {string} platform - 平台代码
 * @param {number} limit - 返回数量限制
 * @returns {Promise<object|null>} 歌单信息
 */
export async function getPlaylist(playlistId, platform, limit) {
    const actualLimit = Math.min(Math.max(1, limit), 30);

    // 网易云：优先使用官方API获取歌单
    if (platform === 'netease' && await checkNcmAvailable()) {
        try {
            const result = await ncmPlaylist(playlistId, actualLimit);
            if (result) return result;
        } catch (error) {
            logger.warn(`[歌单获取] NCM失败: ${error.message}, 尝试降级`);
        }
    }

    // 自建API：QQ/酷狗/酷我
    if (shouldUseMusicApi(platform) && await isMusicApiAvailable()) {
        try {
            const result = await musicApiPlaylist(platform, playlistId, actualLimit);
            if (result) return result;
            logger.info(`[歌单获取] 自建API无结果，尝试Meting降级`);
        } catch (error) {
            logger.warn(`[歌单获取] 自建API失败: ${error.message}, 尝试Meting降级`);
        }
    }

    // 降级：使用 @meting/core
    return await getPlaylistByMeting(playlistId, platform, actualLimit);
}

/**
 * 通过 Meting 获取歌单（降级方案）
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

        const tracks = Array.isArray(playlistData)
            ? playlistData
            : (playlistData.tracks || playlistData.songs || []);
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
