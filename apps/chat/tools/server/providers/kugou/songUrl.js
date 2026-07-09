/**
 * 酷狗音乐播放链接接口
 *
 * 使用酷狗旧版 getSongInfo 接口（无需签名）：
 *   http://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=<hash>
 *
 * 响应说明：
 * - status=1 且 url 非空：返回直链（如 https://sharefs.kugou.com/...）
 *   sharefs.kugou.com 是酷狗的合法音频 CDN，返回真实完整 MP3 文件（4-5MB）
 * - status=0：VIP/付费歌曲，未登录时无法获取直链
 *
 * 早期版本错误地将 sharefs.kugou.com 标记为版权声明 URL，导致免费歌曲无法播放。
 * 现在通过实际下载文件头验证音频有效性，避免误判。
 */

import cache from '../../utils/cache.js';
import { logger } from '../../../../../../components/index.js';

/** 酷狗旧版播放信息接口 */
const KUGOU_PLAY_INFO_API = 'http://m.kugou.com/app/i/getSongInfo.php';

/** 播放链接缓存时间（秒） */
const URL_CACHE_TTL = 1800;

/** 请求超时（毫秒） */
const REQUEST_TIMEOUT = 8000;

/** 音频验证超时（毫秒） */
const VERIFY_TIMEOUT = 10000;

/** 版权声明音频最大大小（200KB 以下视为版权声明/试听片段） */
const COPYRIGHT_AUDIO_MAX_SIZE = 200 * 1024;

/** 浏览器 User-Agent */
const DEFAULT_UA = 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

/**
 * 直接请求酷狗 getSongInfo 接口并返回 JSON
 * @param {string} hash - 歌曲 hash
 * @returns {Promise<object|null>} 响应数据或 null
 */
async function fetchSongInfo(hash) {
    const params = new URLSearchParams({
        cmd: 'playInfo',
        hash
    });
    const url = `${KUGOU_PLAY_INFO_API}?${params.toString()}`;

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'User-Agent': DEFAULT_UA,
                'Accept': 'application/json, text/plain, */*'
            }
        });

        clearTimeout(timer);

        if (!response.ok) return null;

        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (_) {
            return null;
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            logger.error(`[酷狗] getSongInfo 请求异常: ${error.message}`);
        }
        return null;
    }
}

/**
 * 验证音频 URL 是否为真实可播放的音频文件
 * 通过下载前 16 字节检查文件头，并验证文件大小
 * @param {string} url - 音频 URL
 * @returns {Promise<{isValid: boolean, format: string, size: number}>} 验证结果
 */
async function verifyAudioUrl(url) {
    if (!url || !url.startsWith('http')) {
        return { isValid: false, format: '', size: 0 };
    }

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT);

        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: { 'User-Agent': DEFAULT_UA }
        });

        clearTimeout(timer);

        if (!response.ok) {
            return { isValid: false, format: '', size: 0 };
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const header = buffer.subarray(0, 4);
        let format = '';

        // MP3 (ID3v2) - 文件头 "ID3"
        if (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) {
            format = 'MP3';
        }
        // MP3 帧同步
        else if (header[0] === 0xFF && (header[1] & 0xE0) === 0xE0) {
            format = 'MP3';
        }
        // M4A/M4P - "ftyp" 在偏移 4
        else if (buffer.length >= 8 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
            format = 'M4A';
        }
        // FLAC - "fLaC"
        else if (header[0] === 0x66 && header[1] === 0x4C && header[2] === 0x61 && header[3] === 0x43) {
            format = 'FLAC';
        }
        // OGG - "OggS"
        else if (header[0] === 0x4F && header[1] === 0x67 && header[2] === 0x67 && header[3] === 0x53) {
            format = 'OGG';
        }

        // 版权声明/试听片段通常小于 200KB
        const isCopyright = buffer.length < COPYRIGHT_AUDIO_MAX_SIZE;
        const isValid = format !== '' && !isCopyright;

        return { isValid, format, size: buffer.length };
    } catch (error) {
        if (error.name !== 'AbortError') {
            logger.error(`[酷狗] 音频验证失败: ${error.message}`);
        }
        return { isValid: false, format: '', size: 0 };
    }
}

/**
 * 解析 getSongInfo 响应
 * @param {object} data - 响应数据
 * @returns {Promise<object>} 标准化的播放链接信息 { url, canPlay, quality }
 */
async function parseSongInfo(data) {
    if (!data) {
        return { url: '', canPlay: false, quality: '0' };
    }

    // VIP/付费歌曲：status=0
    if (data.status === 0) {
        return { url: '', canPlay: false, quality: '0' };
    }

    const url = data.url || '';
    if (!url || !url.startsWith('http')) {
        return { url: '', canPlay: false, quality: '0' };
    }

    // 验证音频 URL 是否为真实可播放文件
    const verification = await verifyAudioUrl(url);
    if (!verification.isValid) {
        logger.info(`[酷狗] URL 验证失败（格式=${verification.format || '未知'}, 大小=${verification.size}字节），标记为不可播放`);
        return { url: '', canPlay: false, quality: '0' };
    }

    // 估算音质
    const bitRate = Number(data.bitRate) || 0;
    let quality = '128';
    if (bitRate >= 320) quality = '320';
    else if (bitRate >= 192) quality = '192';
    else if (bitRate >= 128) quality = '128';

    return {
        url,
        canPlay: true,
        quality
    };
}

/**
 * 获取酷狗播放链接
 * @param {string} hash - 歌曲 hash
 * @returns {Promise<object|null>} 播放链接信息 { url, canPlay, quality }
 */
export async function getKugouPlayUrl(hash) {
    if (!hash) return null;

    const cacheKey = `kugou:url:${hash}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const data = await fetchSongInfo(hash);
    const result = await parseSongInfo(data);

    cache.set(cacheKey, result, URL_CACHE_TTL);
    return result;
}

export default getKugouPlayUrl;
