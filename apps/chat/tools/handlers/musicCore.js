/**
 * 音乐核心功能模块
 * 提供Meting加载、平台验证、segment加载等基础功能
 */

const logger = global.logger || console;

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
