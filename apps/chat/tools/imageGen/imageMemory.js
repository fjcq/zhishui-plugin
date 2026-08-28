/**
 * 会话级图片记忆模块
 * 按 chat 会话隔离的最近图片环形缓存（Redis 存储，zhishui: 前缀），
 * 记录三类来源：AI 生成图（generate）、AI 编辑图（edit）、用户发送图（user）
 *
 * 解决场景：用户说"改刚才那张/上次画的那张"时，AI 通过 "last" / "last-N" 稳定引用
 * 历史图片，无需用户重发，也不依赖对话上下文窗口（截断后依然有效）
 *
 * 设计要点：
 * - 条目同时记录 url/fileId/localPath 三种引用方式，取图时全部下传给 downloadImageSmart 三级策略
 * - 环形容量 8 张，TTL 24 小时（与图链时效性对齐，QQ 图链 rkey 分钟级过期靠 fileId 兜底重新签发）
 * - Redis 异常静默降级（返回空/失败），绝不阻断生图编辑主流程
 */

import { generateSessionId } from '../../session.js';
import { extractCleanImageUrl } from '../../api/utils/requestUtils.js';
import { logger } from '../../../../components/index.js';

/** 缓存容量上限（环形，超出裁最旧） */
const MEMORY_CAPACITY = 8;

/** 缓存TTL（秒）：24小时 */
const MEMORY_TTL_SEC = 86400;

/** 图片来源枚举 */
export const IMAGE_SOURCES = {
    GENERATE: 'generate',
    EDIT: 'edit',
    USER: 'user'
};

/** last-N 引用匹配（last / last-2 / last-3 ...，大小写不敏感） */
const LAST_REF_PATTERN = /^last-(\d+)$/;

/**
 * 安全解析 JSON 数组
 * @param {string} raw - Redis 原始字符串
 * @returns {Array} 解析结果，异常返回空数组
 */
function safeParseList(raw) {
    try {
        const list = JSON.parse(raw);
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

/**
 * 构造 Redis 缓存键
 * @param {string} sessionId - 会话ID
 * @returns {string} 缓存键
 */
function buildKey(sessionId) {
    return `zhishui:chat:imgmem:${sessionId}`;
}

/**
 * 判断字符串是否像本地绝对路径
 * Windows 盘符（C:\ 或 D:/）或 POSIX 根路径（/home/...）
 * @param {string} text - 待判断字符串
 * @returns {boolean} 是否本地绝对路径
 */
export function isLocalImagePath(text) {
    return /^[a-zA-Z]:[\\/]/.test(text) || text.startsWith('/');
}

/**
 * 解析 last 引用（"last" / "last-2"）
 * @param {string} target - 引用字符串
 * @returns {{index: number}|null} 倒数序号（1=最新），非引用格式返回 null
 */
export function parseImageRef(target) {
    const text = String(target || '').trim().toLowerCase();
    if (text === 'last') {
        return { index: 1 };
    }
    const match = text.match(LAST_REF_PATTERN);
    if (match) {
        const n = parseInt(match[1], 10);
        if (n >= 1) {
            return { index: n };
        }
    }
    return null;
}

/**
 * 读取会话图片记忆
 * @param {Object} e - 事件对象（用于确定会话）
 * @param {number} [limit] - 返回最近 N 张，默认全部
 * @returns {Promise<Array<Object>>} 条目数组（旧→新排序），异常返回空数组
 */
export async function getSessionImages(e, limit = 0) {
    try {
        const sessionId = await generateSessionId(e);
        if (!sessionId) {
            return [];
        }
        const raw = await redis.get(buildKey(sessionId));
        const list = safeParseList(raw);
        return limit > 0 ? list.slice(-limit) : list;
    } catch (error) {
        logger.debug(`[图片记忆] 读取失败: ${error.message}`);
        return [];
    }
}

/**
 * 记录一张图片到会话记忆
 * 与最新条目引用完全一致时跳过（避免重复对话轮次堆积重复条目）
 * @param {Object} e - 事件对象（用于确定会话）
 * @param {Object} entry - 图片条目
 * @param {string} entry.source - 来源（IMAGE_SOURCES 之一）
 * @param {string} [entry.url] - 图片直链（QQ 图链等会过期，作为首选尝试）
 * @param {string} [entry.fileId] - 文件ID（经 get_image 可重新签发，最可靠）
 * @param {string} [entry.localPath] - 本地文件路径（AI 生成/编辑图）
 * @param {string} [entry.prompt] - 提示词/指令摘要（供诊断与后续语义检索）
 * @returns {Promise<boolean>} 是否写入成功
 */
export async function rememberSessionImage(e, entry) {
    try {
        const item = {
            source: entry.source || IMAGE_SOURCES.USER,
            url: String(entry.url || ''),
            fileId: String(entry.fileId || ''),
            localPath: String(entry.localPath || ''),
            prompt: String(entry.prompt || '').substring(0, 60),
            time: Date.now()
        };

        // 三种引用全空视为无效条目
        if (!item.url && !item.fileId && !item.localPath) {
            return false;
        }

        const sessionId = await generateSessionId(e);
        if (!sessionId) {
            return false;
        }

        const key = buildKey(sessionId);
        const list = safeParseList(await redis.get(key));

        // 去重：与最新条目引用完全一致时跳过
        const latest = list[list.length - 1];
        if (latest
            && latest.url === item.url
            && latest.fileId === item.fileId
            && latest.localPath === item.localPath) {
            return true;
        }

        list.push(item);
        // 环形裁剪（保留最新 N 张）
        while (list.length > MEMORY_CAPACITY) {
            list.shift();
        }

        await redis.set(key, JSON.stringify(list));
        await redis.expire(key, MEMORY_TTL_SEC);
        return true;
    } catch (error) {
        logger.debug(`[图片记忆] 写入失败: ${error.message}`);
        return false;
    }
}

/**
 * 解析图片 target 为归一化取图参数
 * 支持四种形态（优先级从上到下）：
 *   ① "last" / "last-N" 引用 → 从会话记忆取倒数第 N 张
 *   ② 本地绝对路径（生成图 local_path）→ localPath 直读
 *   ③ http(s) URL（含被 markdown/CQ 包裹，自动清理）→ url 直链
 *   ④ 其他字符串 → 按文件ID处理（fileId）
 * @param {string} target - AI 传入的原始 target
 * @param {Object} e - 事件对象（引用解析需确定会话）
 * @returns {Promise<{refMiss?: boolean, url: string, fileId: string, localPath: string}|null>}
 *          解析结果；refMiss=true 表示 last 引用越界（记忆中无对应图片）；target 为空返回 null
 */
export async function resolveImageTarget(target, e) {
    const text = String(target || '').trim();
    if (!text) {
        return null;
    }

    // ① last 引用：从会话记忆取图
    const ref = parseImageRef(text);
    if (ref) {
        const images = await getSessionImages(e);
        if (images.length < ref.index) {
            return { refMiss: true, url: '', fileId: '', localPath: '' };
        }
        const item = images[images.length - ref.index];
        return { url: item.url || '', fileId: item.fileId || '', localPath: item.localPath || '' };
    }

    // ② 本地绝对路径
    if (isLocalImagePath(text)) {
        return { url: '', fileId: '', localPath: text };
    }

    // ③ URL（清理包裹字符后成功提取则走直链）
    const cleaned = extractCleanImageUrl(text);
    if (cleaned) {
        return { url: cleaned, fileId: '', localPath: '' };
    }

    // ④ 其余按文件ID处理
    return { url: '', fileId: text, localPath: '' };
}

export default {
    IMAGE_SOURCES,
    isLocalImagePath,
    parseImageRef,
    getSessionImages,
    rememberSessionImage,
    resolveImageTarget
};
