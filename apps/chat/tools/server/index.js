/**
 * 自建音乐 API 服务入口
 * 基于 Express 实现，监听本地端口，提供 QQ/酷狗/酷我 三个平台的音频直链获取能力
 *
 * 生命周期：
 * - Yunzai 启动 → zhishui-plugin index.js 加载 → startMusicApiServer()
 * - 监听 127.0.0.1:PORT（端口冲突自动 +1，最多3次）
 * - Yunzai 关闭 → 插件卸载 → stopMusicApiServer()
 */

import express from 'express';
import { logger } from '../../../../components/index.js';
import { Config } from '../../../../components/index.js';
import kugouRouter from './routes/kugou.js';
import qqRouter from './routes/qq.js';
import kuwoRouter from './routes/kuwo.js';
import cache from './utils/cache.js';

/** 服务单例 */
let serverInstance = null;

/** 当前监听端口 */
let currentPort = null;

/** 端口冲突时最大重试次数 */
const MAX_PORT_RETRY = 3;

/**
 * 获取 musicApi 配置
 * @returns {object} 配置对象
 */
function getMusicApiConfig() {
    const config = Config.getDefOrConfig('musicApi') || {};
    return {
        enabled: config.enabled !== false,
        port: config.port || 3210,
        host: config.host || '127.0.0.1',
        timeout: config.timeout || 15000,
        cacheTtl: config.cache?.ttl || 1800
    };
}

/**
 * 创建 Express 应用
 * @param {object} config - 配置
 * @returns {import('express').Express} Express 应用
 */
function createExpressApp(config) {
    const app = express();

    // 解析 JSON 请求体
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // 请求超时控制
    app.use((req, res, next) => {
        req.setTimeout(config.timeout, () => {
            if (!res.headersSent) {
                res.status(504).json({ code: 504, message: '请求超时', data: null });
            }
        });
        next();
    });

    // 频率限制（单IP每秒最多5次）
    const rateLimitMap = new Map();
    app.use('/api', (req, res, next) => {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        const windowStart = now - 1000;
        const entry = rateLimitMap.get(ip) || [];
        const recent = entry.filter(t => t > windowStart);
        if (recent.length >= 5) {
            return res.status(429).json({ code: 429, message: '请求过于频繁', data: null });
        }
        recent.push(now);
        rateLimitMap.set(ip, recent);
        next();
    });

    // 健康检查路由
    app.get('/api/health', (req, res) => {
        res.json({
            code: 200,
            message: 'success',
            data: {
                status: 'ok',
                port: currentPort,
                uptime: process.uptime(),
                cacheSize: cache.size
            }
        });
    });

    // 注册平台路由
    app.use('/api/kugou', kugouRouter);
    app.use('/api/qq', qqRouter);
    app.use('/api/kuwo', kuwoRouter);

    // 404 处理
    app.use((req, res) => {
        res.status(404).json({ code: 404, message: `路径不存在: ${req.path}`, data: null });
    });

    // 错误处理
    app.use((err, req, res, next) => {
        logger.error(`[自建API] 服务异常: ${err.message}`);
        if (res.headersSent) return;
        res.status(500).json({ code: 500, message: `服务异常: ${err.message}`, data: null });
    });

    return app;
}

/**
 * 在指定端口尝试启动服务
 * @param {import('express').Express} app - Express 应用
 * @param {number} port - 端口
 * @param {string} host - 主机
 * @returns {Promise<number|null>} 实际监听的端口，失败返回 null
 */
function listenOnPort(app, port, host) {
    return new Promise(resolve => {
        const server = app.listen(port, host, () => {
            resolve(port);
        });

        server.on('error', err => {
            if (err.code === 'EADDRINUSE') {
                resolve(null);
            } else {
                logger.error(`[自建API] 启动失败: ${err.message}`);
                resolve(null);
            }
        });

        // 把实例存到 app 上以便后续关闭
        app.locals.server = server;
    });
}

/**
 * 启动自建 API 服务
 * 端口冲突时自动尝试 +1 端口，最多3次
 * @returns {Promise<boolean>} 是否启动成功
 */
export async function startMusicApiServer() {
    if (serverInstance) {
        logger.info(`[自建API] 服务已在运行 | 端口:${currentPort}`);
        return true;
    }

    const config = getMusicApiConfig();
    if (!config.enabled) {
        logger.info(`[自建API] 已配置为禁用，跳过启动`);
        return false;
    }

    const app = createExpressApp(config);

    // 尝试启动，端口冲突自动+1
    for (let attempt = 0; attempt < MAX_PORT_RETRY; attempt++) {
        const tryPort = config.port + attempt;
        const listenPort = await listenOnPort(app, tryPort, config.host);

        if (listenPort !== null) {
            serverInstance = app.locals.server;
            currentPort = listenPort;

            // 进程退出时自动关闭
            serverInstance.on('close', () => {
                serverInstance = null;
                currentPort = null;
            });

            logger.info(`[自建API] 服务启动成功 | 地址:http://${config.host}:${listenPort}`);
            return true;
        }
    }

    logger.warn(`[自建API] 连续 ${MAX_PORT_RETRY} 次启动失败，放弃启动。降级到 @meting/core`);
    return false;
}

/**
 * 停止自建 API 服务
 * @returns {Promise<void>}
 */
export async function stopMusicApiServer() {
    if (!serverInstance) return;

    const server = serverInstance;
    serverInstance = null;
    const port = currentPort;
    currentPort = null;

    cache.stopCleanup();

    return new Promise(resolve => {
        server.close(err => {
            if (err) {
                logger.warn(`[自建API] 关闭服务异常: ${err.message}`);
            } else {
                logger.info(`[自建API] 服务已关闭 | 端口:${port}`);
            }
            resolve();
        });
    });
}

/**
 * 查询服务状态
 * @returns {object} 状态信息
 */
export function getServerStatus() {
    return {
        running: !!serverInstance,
        port: currentPort,
        cacheSize: cache.size
    };
}

/**
 * 检查服务是否运行中
 * @returns {boolean} 服务是否运行
 */
export function isServerRunning() {
    return !!serverInstance;
}

export default {
    startMusicApiServer,
    stopMusicApiServer,
    getServerStatus,
    isServerRunning
};
