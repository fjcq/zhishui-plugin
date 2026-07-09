/**
 * 健康检查工具
 * 用于检测各平台 API 可用性，结果缓存5分钟避免频繁检测
 */

import cache from './cache.js';

/** 健康检查缓存时间（秒） */
const HEALTH_CACHE_TTL = 300;

/**
 * 检查指定平台是否可用
 * @param {string} platform - 平台代码 qq/kugou/kuwo
 * @param {Function} checkFn - 实际检查函数，返回 Promise<boolean>
 * @returns {Promise<boolean>} 平台是否可用
 */
export async function checkPlatformHealth(platform, checkFn) {
    if (!platform || typeof checkFn !== 'function') return false;

    const cacheKey = `health:${platform}`;
    const cached = cache.get(cacheKey);
    if (cached !== null) return cached;

    try {
        const result = await Promise.race([
            checkFn(),
            new Promise(resolve => setTimeout(() => resolve(false), 5000))
        ]);
        cache.set(cacheKey, !!result, HEALTH_CACHE_TTL);
        return !!result;
    } catch (error) {
        cache.set(cacheKey, false, 60);
        return false;
    }
}

/**
 * 标记平台不可用（接口失败时主动标记，避免后续请求继续触发）
 * @param {string} platform - 平台代码
 */
export function markPlatformUnavailable(platform) {
    if (!platform) return;
    cache.set(`health:${platform}`, false, 60);
}

/**
 * 清除平台健康状态缓存
 * @param {string} platform - 平台代码
 */
export function clearPlatformHealth(platform) {
    if (!platform) return;
    cache.delete(`health:${platform}`);
}

export default {
    checkPlatformHealth,
    markPlatformUnavailable,
    clearPlatformHealth
};
