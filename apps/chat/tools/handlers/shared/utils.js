/**
 * 共享工具函数模块
 * 提供各Handler共用的基础功能
 */

import { logger } from '../../../../components/index.js';

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

/**
 * 动态加载segment模块
 * 按优先级尝试从 oicq、icqq 加载 segment 对象，用于构建消息段
 * @returns {Promise<object|null>} segment模块或null
 */
export async function getSegment() {
    try {
        return await import('oicq').then(m => m.segment).catch(() =>
            import('icqq').then(m => m.segment)
        );
    } catch (error) {
        logger.warn(`[工具] 加载segment模块失败: ${error.message}`);
        return null;
    }
}
