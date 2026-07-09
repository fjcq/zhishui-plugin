/**
 * 内存缓存工具
 * 提供带 TTL 的键值缓存，用于缓存签名参数、搜索结果、音频直链等
 * 不引入外部依赖，使用 Map + 定时清理实现
 */

/** 默认清理间隔（毫秒） */
const DEFAULT_CLEANUP_INTERVAL = 5 * 60 * 1000;

/**
 * 内存缓存类
 * 每个键值对存储 { value, expireAt }，过期自动返回 null
 */
class MemoryCache {
    /**
     * 构造函数
     * @param {object} options - 配置项
     * @param {number} options.cleanupInterval - 清理间隔（毫秒）
     */
    constructor(options = {}) {
        this.store = new Map();
        this.cleanupInterval = options.cleanupInterval || DEFAULT_CLEANUP_INTERVAL;
        this.timer = null;
        this.startCleanup();
    }

    /**
     * 设置缓存
     * @param {string} key - 缓存键
     * @param {*} value - 缓存值
     * @param {number} ttl - 过期时间（秒），0表示永不过期
     */
    set(key, value, ttl = 0) {
        if (!key) return;
        const expireAt = ttl > 0 ? Date.now() + ttl * 1000 : 0;
        this.store.set(key, { value, expireAt });
    }

    /**
     * 获取缓存
     * @param {string} key - 缓存键
     * @returns {*} 缓存值或 null（过期/不存在）
     */
    get(key) {
        if (!key) return null;
        const entry = this.store.get(key);
        if (!entry) return null;
        if (entry.expireAt > 0 && Date.now() > entry.expireAt) {
            this.store.delete(key);
            return null;
        }
        return entry.value;
    }

    /**
     * 删除缓存
     * @param {string} key - 缓存键
     */
    delete(key) {
        if (!key) return;
        this.store.delete(key);
    }

    /**
     * 清空所有缓存
     */
    clear() {
        this.store.clear();
    }

    /**
     * 启动定时清理
     */
    startCleanup() {
        if (this.timer) return;
        this.timer = setInterval(() => {
            const now = Date.now();
            for (const [key, entry] of this.store) {
                if (entry.expireAt > 0 && now > entry.expireAt) {
                    this.store.delete(key);
                }
            }
        }, this.cleanupInterval);
        if (this.timer.unref) {
            this.timer.unref();
        }
    }

    /**
     * 停止定时清理
     */
    stopCleanup() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /**
     * 获取缓存大小
     * @returns {number} 当前缓存条目数
     */
    get size() {
        return this.store.size;
    }
}

/** 全局单例缓存实例 */
const cache = new MemoryCache();

export default cache;
export { MemoryCache };
