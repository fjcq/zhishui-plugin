/**
 * 共享工具函数模块
 * 提供各Handler共用的基础功能
 */

/**
 * 获取Redis客户端
 * @returns {object|null} Redis客户端
 */
export function getRedis() {
    if (typeof redis !== 'undefined') {
        return redis;
    }
    return null;
}
