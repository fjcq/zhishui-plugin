/**
 * 会话并发控制模块
 * 在V2角色整合模式下，同一用户可能在群聊和私聊同时写入同一会话文件
 * 使用轻量级互斥锁防止数据竞争
 */

const logger = global.logger || console;

/**
 * 简易互斥锁实现
 * 不依赖外部包，基于Promise的异步锁
 */
class SimpleMutex {
    constructor() {
        this._queue = [];
        this._locked = false;
    }

    /**
     * 获取锁
     * @returns {Promise<Function>} 释放锁的函数
     */
    acquire() {
        return new Promise((resolve) => {
            const release = () => {
                this._locked = false;
                if (this._queue.length > 0) {
                    const next = this._queue.shift();
                    this._locked = true;
                    next(resolve);
                }
            };

            if (!this._locked) {
                this._locked = true;
                resolve(release);
            } else {
                this._queue.push(release);
            }
        });
    }
}

/**
 * 会话锁管理器
 * 为每个会话ID维护独立的互斥锁，防止并发写入冲突
 */
class SessionLockManager {
    constructor(options = {}) {
        this.locks = new Map();
        this.maxLocks = options.maxLocks || 1000;
        this.lockTimeout = options.lockTimeout || 5000;
    }

    /**
     * 获取指定会话的锁实例
     * @param {string} sessionId - 会话ID
     * @returns {SimpleMutex} 互斥锁实例
     */
    getLock(sessionId) {
        if (this.locks.has(sessionId)) {
            return this.locks.get(sessionId);
        }

        if (this.locks.size >= this.maxLocks) {
            this.evictOldest();
        }

        const mutex = new SimpleMutex();
        this.locks.set(sessionId, mutex);
        return mutex;
    }

    /**
     * 淘汰最旧的锁以释放内存
     */
    evictOldest() {
        const firstKey = this.locks.keys().next().value;
        if (firstKey !== undefined) {
            this.locks.delete(firstKey);
        }
    }

    /**
     * 带锁执行操作
     * 自动获取和释放锁，确保操作的原子性
     * @param {string} sessionId - 会话ID
     * @param {Function} operation - 要执行的异步操作
     * @param {number} timeout - 超时时间（毫秒）
     * @returns {Promise<any>} 操作结果
     */
    async withLock(sessionId, operation, timeout) {
        const effectiveTimeout = timeout || this.lockTimeout;
        const lock = this.getLock(sessionId);
        let release;

        try {
            const raceResult = await Promise.race([
                lock.acquire(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('获取锁超时')), effectiveTimeout))
            ]);

            release = raceResult;
            return await operation();
        } catch (error) {
            if (error.message.includes('超时')) {
                throw new Error(`会话 ${sessionId} 操作繁忙，请稍后重试`);
            }
            throw error;
        } finally {
            if (typeof release === 'function') {
                release();
            }
        }
    }

    /**
     * 清理指定会话的锁
     * @param {string} sessionId - 会话ID
     */
    removeLock(sessionId) {
        this.locks.delete(sessionId);
    }

    /**
     * 获取当前管理的锁数量（用于监控）
     * @returns {number}
     */
    get size() {
        return this.locks.size;
    }
}

/**
 * 全局会话锁管理器单例
 */
export const sessionLockManager = new SessionLockManager();

export default SessionLockManager;
