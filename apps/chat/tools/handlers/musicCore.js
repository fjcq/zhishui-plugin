/**
 * 音乐核心功能模块
 * 提供Meting加载、平台验证、segment加载等基础功能
 */

import { logger } from '../../../../components/index.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { setTimeout as sleep } from 'timers/promises';

/**
 * 支持的音乐平台列表
 */
const VALID_MUSIC_PLATFORMS = ['netease', 'tencent', 'kugou', 'kuwo'];

/**
 * 验证音乐平台是否有效
 * @param {string} platform - 平台名称
 * @returns {object|null} 验证失败返回错误对象，成功返回null
 */
export function validateMusicPlatform(platform) {
    if (!VALID_MUSIC_PLATFORMS.includes(platform)) {
        return {
            error: true,
            error_message: `不支持的音乐平台: ${platform}，支持的平台: ${VALID_MUSIC_PLATFORMS.join(', ')}`
        };
    }
    return null;
}

let Meting = null;
let metingLoadError = null;

/**
 * 动态加载Meting模块
 * @returns {Promise<boolean>} 是否加载成功
 */
export async function loadMeting() {
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
export function getMeting(platform) {
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
export async function getSegment() {
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
export async function createVoiceWithTimeout(segment, source, timeout = 30000) {
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
 * 格式化时长
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时长
 */
export function formatDuration(seconds) {
    if (!seconds) return '未知';
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

/**
 * 获取平台链接
 * @param {string} platform - 平台代码
 * @param {string} songId - 歌曲ID
 * @returns {string} 平台链接
 */
export function getPlatformLink(platform, songId) {
    const platformLinks = {
        netease: `https://music.163.com/#/song?id=${songId}`,
        tencent: `https://y.qq.com/n/ryqq/songDetail/${songId}`,
        kugou: `https://www.kugou.com/song/#hash=${songId}`,
        kuwo: `https://www.kuwo.cn/play_detail/${songId}`
    };
    return platformLinks[platform] || '';
}

/**
 * 获取平台名称
 * @param {string} platform - 平台代码
 * @returns {string} 平台名称
 */
export function getPlatformName(platform) {
    const platformNames = {
        netease: '网易云',
        tencent: 'QQ音乐',
        kugou: '酷狗',
        kuwo: '酷我'
    };
    return platformNames[platform] || platform;
}

/**
 * 验证 Buffer 前缀是否为有效的音频文件头
 * 支持 MP3(含ID3标签)/M4A/FLAC/OGG
 * @param {Buffer} buffer - 音频数据缓冲区
 * @returns {{ valid: boolean, format: string, reason?: string }} 验证结果
 */
export function validateAudioHeader(buffer) {
    if (!buffer || buffer.length < 12) {
        return { valid: false, format: 'unknown', reason: '文件过小' };
    }

    const b0 = buffer[0];
    const b1 = buffer[1];

    // MP3: FF FB / FF FA / FF F3 / FF E3 / FF F2 / FF E2（直接以 MP3 帧头开始）
    if (b0 === 0xFF && (b1 === 0xFB || b1 === 0xFA || b1 === 0xF3 || b1 === 0xE3 || b1 === 0xF2 || b1 === 0xE2)) {
        return { valid: true, format: 'mp3' };
    }

    // M4A/AAC: 偏移 4 处包含 'ftyp'
    if (buffer.length >= 8 &&
        buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
        return { valid: true, format: 'm4a' };
    }

    // FLAC: 'fLaC'
    if (b0 === 0x66 && b1 === 0x4C && buffer[2] === 0x61 && buffer[3] === 0x43) {
        return { valid: true, format: 'flac' };
    }

    // OGG: 'OggS'
    if (b0 === 0x4F && b1 === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
        return { valid: true, format: 'ogg' };
    }

    // ID3v2 标签开头：合法的 MP3 文件可能带 ID3 元数据标签
    // 需要跳过 ID3 头部后查找 MP3 帧头（FF Fx），以区分版权声明音频
    if (b0 === 0x49 && b1 === 0x44 && buffer[2] === 0x33) {
        // ID3v2 头部结构：'ID3' + 版本(2字节) + 标志(1字节) + 大小(4字节同步整型)
        // 总头部大小 = 10 字节 + 同步整型表示的大小
        const sizeBytes = buffer.subarray(6, 10);
        const id3Size = (sizeBytes[0] << 21) | (sizeBytes[1] << 14) | (sizeBytes[2] << 7) | sizeBytes[3];
        const headerSize = 10 + id3Size;

        // 在 ID3 头部之后查找 MP3 帧头（FF Fx）
        const maxScan = Math.min(buffer.length, headerSize + 4096);
        for (let i = headerSize; i < maxScan - 1; i++) {
            if (buffer[i] === 0xFF && (buffer[i + 1] & 0xE0) === 0xE0) {
                // 找到 MP3 帧头，是合法的 MP3 文件
                return { valid: true, format: 'mp3' };
            }
        }
        // ID3 标签后没有 MP3 帧头，可能是 ID3+MP4 容器的版权声明
        return { valid: false, format: 'id3-no-mp3', reason: 'ID3 后未找到 MP3 帧头（疑似版权声明）' };
    }

    return { valid: false, format: 'unknown', reason: `未识别的文件头: ${b0.toString(16)}${b1.toString(16)}` };
}

/**
 * 下载音频文件到临时目录
 * @param {string} url - 音频URL
 * @param {string} fileName - 保存的文件名
 * @param {number} timeout - 下载超时时间(毫秒)，默认60秒
 * @returns {Promise<string|null>} 下载后的本地文件路径，失败返回null
 */
export async function downloadAudioFile(url, fileName, timeout = 60000) {
    if (!url || !url.startsWith('http')) {
        return null;
    }

    // 下载前清理过期临时文件，防止长期积累
    cleanupTempAudioFiles();

    const tmpDir = path.join(os.tmpdir(), 'zhishui-music');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }

    const filePath = path.join(tmpDir, fileName);

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://music.163.com/'
            }
        });

        clearTimeout(timer);

        if (!response.ok) {
            logger.warn(`[音乐下载] HTTP ${response.status}: ${url.substring(0, 60)}`);
            return null;
        }

        const contentLength = parseInt(response.headers.get('content-length') || '0');
        const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB
        if (contentLength > MAX_FILE_SIZE) {
            logger.warn(`[音乐下载] 文件过大(${Math.round(contentLength / 1024 / 1024)}MB)，跳过下载`);
            return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length < 1024) {
            logger.warn(`[音乐下载] 文件过小(${buffer.length}字节)，可能不是有效音频`);
            return null;
        }

        // 验证音频文件头，过滤版权声明/试听片段
        const headerCheck = validateAudioHeader(buffer);
        if (!headerCheck.valid) {
            logger.warn(`[音乐下载] 音频文件头验证失败(${headerCheck.reason || headerCheck.format})，URL: ${url.substring(0, 80)}`);
            return null;
        }

        fs.writeFileSync(filePath, buffer);
        logger.info(`[音乐下载] 下载成功 | 格式:${headerCheck.format} | 大小:${Math.round(buffer.length / 1024)}KB | ${fileName}`);
        return filePath;
    } catch (error) {
        if (error.name === 'AbortError') {
            logger.warn(`[音乐下载] 下载超时: ${url.substring(0, 60)}`);
        } else {
            logger.warn(`[音乐下载] 下载失败: ${error.message}`);
        }
        return null;
    }
}

/**
 * 清理过期的临时音频文件（超过1小时的）
 */
export function cleanupTempAudioFiles() {
    const tmpDir = path.join(os.tmpdir(), 'zhishui-music');
    if (!fs.existsSync(tmpDir)) return;

    try {
        const files = fs.readdirSync(tmpDir);
        const ONE_HOUR = 60 * 60 * 1000;
        const now = Date.now();

        for (const file of files) {
            const filePath = path.join(tmpDir, file);
            try {
                const stat = fs.statSync(filePath);
                if (now - stat.mtimeMs > ONE_HOUR) {
                    fs.unlinkSync(filePath);
                }
            } catch (error) {
                logger.warn(`[音乐清理] 处理文件失败: ${filePath}, ${error.message}`);
            }
        }
    } catch (error) {
        // 清理失败不影响主流程
    }
}
