/**
 * 聊天消息 SQLite 存储层
 * 使用 Node 内置 node:sqlite（v22.5+），零新增依赖
 * 设计原则：存读解耦——写入永不删除，读取按上下文窗口限量
 * 探测失败（Node版本低/目录不可写）时自动降级，策略层回退 KeyvFile
 */

import path from 'path';
import fs from 'fs';
import { Plugin_Path, logger } from '../../../components/index.js';

/** 数据库文件路径（与旧 KeyvFile 数据同目录） */
const DB_PATH = path.join(Plugin_Path, 'data', 'chatContext', 'chat_history.db');

/** 富媒体段类型 → content 占位文本映射 */
const MEDIA_PLACEHOLDER = {
    image: '[图片]',
    record: '[语音]',
    video: '[视频]',
    file: '[文件]',
    flash: '[闪照]'
};

/** 数据库实例（单进程单连接，懒加载） */
let db = null;

/** 是否可用（初始化成功后为 true） */
let available = false;

/** 初始化 Promise（防止并发重复初始化） */
let initPromise = null;

/** 降级警告是否已输出（避免刷屏） */
let downgradeWarned = false;

/** 预编译 SQL 语句缓存 */
const stmts = {};

/**
 * 初始化数据库连接与表结构
 * 失败时不抛异常，置 available=false 供策略层降级
 * @returns {Promise<void>}
 */
async function init() {
    try {
        const { DatabaseSync } = await import('node:sqlite');

        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        db = new DatabaseSync(DB_PATH);

        db.exec(`
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA busy_timeout = 5000;
            CREATE TABLE IF NOT EXISTS messages (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT    NOT NULL,
                role       TEXT    NOT NULL,
                content    TEXT,
                user_id    INTEGER,
                group_id   INTEGER,
                name       TEXT,
                message_id TEXT,
                timestamp  INTEGER NOT NULL,
                extra      TEXT,
                media      TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_msg_session ON messages(session_id, id);
            CREATE INDEX IF NOT EXISTS idx_msg_msgid   ON messages(message_id);
            CREATE INDEX IF NOT EXISTS idx_msg_user    ON messages(user_id, id);
            CREATE INDEX IF NOT EXISTS idx_msg_group   ON messages(group_id, id);
        `);

        prepareStatements();
        available = true;
        logger.info(`[消息存储] SQLite 已启用: ${DB_PATH}`);
    } catch (error) {
        available = false;
        logger.warn(`[消息存储] SQLite 初始化失败，将使用旧文件存储: ${error.message}`);
    }
}

/**
 * 预编译常用 SQL 语句
 */
function prepareStatements() {
    stmts.insert = db.prepare(`
        INSERT INTO messages (session_id, role, content, user_id, group_id, name, message_id, timestamp, extra, media)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmts.findBoundary = db.prepare(`
        SELECT MAX(id) AS boundary_id FROM messages WHERE session_id = ? AND role = 'system'
    `);
    stmts.getRecentDesc = db.prepare(`
        SELECT * FROM messages WHERE session_id = ? AND id > ? ORDER BY id DESC LIMIT ?
    `);
    stmts.countSession = db.prepare(`
        SELECT COUNT(*) AS total FROM messages WHERE session_id = ?
    `);
}

/**
 * 检查存储层是否可用（首次调用触发初始化）
 * @returns {Promise<boolean>} 可用返回 true，否则走 KeyvFile 降级路径
 */
export async function isAvailable() {
    if (!initPromise) {
        initPromise = init();
    }
    await initPromise;
    if (!available && !downgradeWarned) {
        downgradeWarned = true;
        logger.warn('[消息存储] 当前环境不支持 SQLite，历史容量仍受 MaxHistory 限制');
    }
    return available;
}

/**
 * 从事件对象提取富媒体元数据（图片/语音/视频/文件/闪照）
 * @param {Object} e - 事件对象
 * @returns {Array<Object>} 富媒体元数据数组 [{type, url, fileId}]
 */
function extractMedia(e) {
    if (!e || !Array.isArray(e.message) || !e.message.length) {
        return [];
    }
    const media = [];
    for (const seg of e.message) {
        const type = seg?.type;
        if (!(type in MEDIA_PLACEHOLDER)) continue;
        media.push({
            type,
            url: String(seg.url || seg.data?.url || ''),
            fileId: String(seg.file || seg.file_id || seg.data?.file || seg.data?.file_id || '')
        });
    }
    return media;
}

/**
 * 向消息内容注入富媒体占位文本（纯文本消费方可预期）
 * 内容为 JSON 字符串（含 message 字段）时注入 message 内部，否则追加尾部
 * @param {string} content - 原始内容
 * @param {Array<Object>} media - 富媒体元数据数组
 * @returns {string} 注入占位符后的内容
 */
function injectMediaPlaceholders(content, media) {
    if (!media.length) {
        return content;
    }
    const placeholders = media.map(item => MEDIA_PLACEHOLDER[item.type] || '[消息]').join('');

    let obj = null;
    try {
        obj = JSON.parse(content);
    } catch { /* 非JSON内容直接尾部追加 */ }

    if (obj && typeof obj === 'object' && typeof obj.message === 'string') {
        obj.message = obj.message + placeholders;
        return JSON.stringify(obj);
    }
    return (content || '') + placeholders;
}

/**
 * 解析 extra JSON 字段
 * @param {string} extraRaw - extra 列原始值
 * @returns {Object} 解析结果（空对象兜底）
 */
function parseExtra(extraRaw) {
    if (!extraRaw) {
        return {};
    }
    try {
        return JSON.parse(extraRaw) || {};
    } catch {
        return {};
    }
}

/**
 * 解析 media JSON 字段
 * @param {string} mediaRaw - media 列原始值
 * @returns {Array<Object>} 富媒体元数据数组
 */
function parseMedia(mediaRaw) {
    if (!mediaRaw) {
        return [];
    }
    try {
        const parsed = JSON.parse(mediaRaw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/**
 * 数据库行 → 纯消息格式（V1 场景隔离模式）
 * @param {Object} row - 数据库行
 * @returns {Object} OpenAI 格式消息 {role, content, tool_calls?, ...}
 */
function rowToPlainMessage(row) {
    const msg = { role: row.role, content: row.content };
    const extra = parseExtra(row.extra);
    for (const key of ['tool_calls', 'tool_call_id', 'reasoning_content']) {
        if (extra[key] !== undefined) {
            msg[key] = extra[key];
        }
    }
    return msg;
}

/**
 * 数据库行 → 增强消息格式（V2 角色整合模式）
 * @param {Object} row - 数据库行
 * @returns {Object} 增强消息 {role, content, additional_info, tool_calls?, ...}
 */
function rowToEnhancedMessage(row) {
    const msg = {
        role: row.role,
        content: row.content,
        additional_info: {
            user_id: row.user_id,
            group_id: row.group_id || 0,
            name: row.name || '',
            timestamp: row.timestamp
        }
    };
    if (row.message_id) {
        msg.additional_info.message_id = row.message_id;
    }
    const extra = parseExtra(row.extra);
    for (const key of ['tool_calls', 'tool_call_id', 'reasoning_content']) {
        if (extra[key] !== undefined) {
            msg[key] = extra[key];
        }
    }
    return msg;
}

/**
 * 插入单条消息（对话主链路）
 * @param {string} sessionId - 会话ID
 * @param {Object} msg - 消息对象（V1纯格式或V2增强格式）
 * @param {Object} e - 事件对象（可空，saveChatMsg 全量转换时可能为 null）
 * @param {Object} [options] - 选项
 * @param {boolean} [options.enhanced=false] - V2增强消息格式（读取 additional_info 列）
 * @returns {Promise<number|null>} 新行ID，失败返回 null
 */
export async function insertMessage(sessionId, msg, e, options = {}) {
    if (!await isAvailable() || !msg || !msg.role) {
        return null;
    }

    let userId = null;
    let groupId = 0;
    let name = '';
    let messageId = null;
    let timestamp = Date.now();

    if (options.enhanced && msg.additional_info) {
        const info = msg.additional_info;
        userId = info.user_id ?? null;
        groupId = info.group_id || 0;
        name = info.name || '';
        timestamp = info.timestamp || timestamp;
        messageId = info.message_id || null;
    } else if (e && msg.role === 'user') {
        userId = e.user_id ?? null;
        groupId = e.group_id || 0;
        name = e.sender?.nickname || '';
        if (e.message_id !== undefined && e.message_id !== null) {
            messageId = String(e.message_id);
        }
    }

    const extra = {};
    for (const key of ['tool_calls', 'tool_call_id', 'reasoning_content']) {
        if (msg[key] !== undefined) {
            extra[key] = msg[key];
        }
    }

    // 富媒体提取与占位注入：仅用户消息（assistant/tool 消息无原始消息段）
    let content = msg.content;
    let media = null;
    if (msg.role === 'user') {
        media = extractMedia(e);
        if (media.length > 0) {
            content = injectMediaPlaceholders(content, media);
        }
    }

    try {
        const result = stmts.insert.run(
            sessionId,
            msg.role,
            content ?? null,
            userId,
            groupId,
            name,
            messageId,
            timestamp,
            Object.keys(extra).length > 0 ? JSON.stringify(extra) : null,
            media && media.length > 0 ? JSON.stringify(media) : null
        );
        return Number(result.lastInsertRowid);
    } catch (error) {
        logger.error(`[消息存储] 插入消息失败: ${error.message}`);
        return null;
    }
}

/**
 * 获取会话最近消息（AI 上下文窗口，自动跳过最近分界标记之前的历史）
 * @param {string} sessionId - 会话ID
 * @param {number} limit - 上下文窗口大小（取最近 N 条）
 * @param {Object} [options] - 选项
 * @param {boolean} [options.enhanced=false] - 返回 V2 增强消息格式
 * @returns {Promise<Array<Object>>} 按时间正序排列的消息数组
 */
export async function getRecentMessages(sessionId, limit, options = {}) {
    if (!await isAvailable()) {
        return [];
    }

    try {
        const boundary = stmts.findBoundary.get(sessionId);
        const boundaryId = boundary?.boundary_id || 0;

        const rows = stmts.getRecentDesc.all(sessionId, boundaryId, limit || 50);
        rows.reverse();

        const mapper = options.enhanced ? rowToEnhancedMessage : rowToPlainMessage;
        // 分界标记行（role=system）本身不进入上下文
        return rows.filter(row => row.role !== 'system').map(mapper);
    } catch (error) {
        logger.error(`[消息存储] 读取会话消息失败: ${error.message}`);
        return [];
    }
}

/**
 * 插入对话重置分界标记（"重置对话"= AI 失忆，历史数据保留）
 * @param {string} sessionId - 会话ID
 * @returns {Promise<boolean>} 是否成功
 */
export async function insertBoundary(sessionId) {
    if (!await isAvailable()) {
        return false;
    }
    try {
        stmts.insert.run(sessionId, 'system', '[对话已重置]', null, 0, '', null, Date.now(), '{"boundary":true}', null);
        return true;
    } catch (error) {
        logger.error(`[消息存储] 插入分界标记失败: ${error.message}`);
        return false;
    }
}

/**
 * 对所有已知会话插入分界标记（"重置对话全部"= 全局 AI 失忆，数据保留）
 * @returns {Promise<number>} 成功插入分界的会话数
 */
export async function insertBoundaryAll() {
    if (!await isAvailable()) {
        return 0;
    }
    try {
        const rows = db.prepare('SELECT DISTINCT session_id FROM messages').all();
        let count = 0;
        for (const row of rows) {
            if (await insertBoundary(row.session_id)) {
                count++;
            }
        }
        return count;
    } catch (error) {
        logger.error(`[消息存储] 全局插入分界失败: ${error.message}`);
        return 0;
    }
}

/**
 * 全量替换会话消息（切换API/角色转换后写回，事务保证原子性）
 * @param {string} sessionId - 会话ID
 * @param {Array<Object>} messages - 完整消息数组
 * @param {Object} [options] - 选项
 * @param {boolean} [options.enhanced=false] - 消息为 V2 增强格式
 * @returns {Promise<boolean>} 是否成功
 */
export async function replaceSessionMessages(sessionId, messages, options = {}) {
    if (!await isAvailable() || !Array.isArray(messages)) {
        return false;
    }

    try {
        db.exec('BEGIN');
        try {
            db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
            for (const msg of messages) {
                stmts.insert.run(
                    sessionId,
                    msg.role,
                    msg.content ?? null,
                    options.enhanced ? (msg.additional_info?.user_id ?? null) : null,
                    options.enhanced ? (msg.additional_info?.group_id || 0) : 0,
                    options.enhanced ? (msg.additional_info?.name || '') : '',
                    options.enhanced ? (msg.additional_info?.message_id || null) : null,
                    options.enhanced ? (msg.additional_info?.timestamp || Date.now()) : Date.now(),
                    null,
                    null
                );
            }
            db.exec('COMMIT');
            return true;
        } catch (txError) {
            db.exec('ROLLBACK');
            throw txError;
        }
    } catch (error) {
        logger.error(`[消息存储] 替换会话消息失败: ${error.message}`);
        return false;
    }
}

/**
 * 按 QQ 消息ID 精确查找（撤回/引用/审计定位）
 * @param {string} messageId - QQ 消息ID
 * @returns {Promise<Object|null>} 匹配的首条数据库行
 */
export async function findByMessageId(messageId) {
    if (!await isAvailable() || !messageId) {
        return null;
    }
    try {
        return db.prepare('SELECT * FROM messages WHERE message_id = ? LIMIT 1').get(String(messageId)) || null;
    } catch (error) {
        logger.error(`[消息存储] 按消息ID查找失败: ${error.message}`);
        return null;
    }
}

/**
 * 条件检索消息（#查聊天记录 指令）
 * @param {Object} conditions - 检索条件
 * @param {number} [conditions.userId] - 发送者QQ（限定用户消息）
 * @param {number} [conditions.groupId] - 群号（0 表示私聊）
 * @param {string} [conditions.keyword] - 关键词（LIKE 模糊匹配）
 * @param {number} [conditions.startTime] - 起始时间戳（毫秒）
 * @param {number} [conditions.endTime] - 结束时间戳（毫秒）
 * @param {number} [conditions.limit=50] - 返回条数上限
 * @returns {Promise<Array<Object>>} 按时间正序排列的数据库行
 */
export async function searchMessages(conditions = {}) {
    if (!await isAvailable()) {
        return [];
    }

    const { userId, groupId, keyword, startTime, endTime, limit = 50 } = conditions;
    const where = ["role != 'system'"];
    const params = [];

    if (userId !== undefined && userId !== null) {
        where.push('user_id = ?');
        params.push(Number(userId));
    }
    if (groupId !== undefined && groupId !== null) {
        where.push('group_id = ?');
        params.push(Number(groupId));
    }
    if (keyword) {
        where.push('content LIKE ?');
        params.push(`%${keyword}%`);
    }
    if (startTime !== undefined && startTime !== null) {
        where.push('timestamp >= ?');
        params.push(Number(startTime));
    }
    if (endTime !== undefined && endTime !== null) {
        where.push('timestamp <= ?');
        params.push(Number(endTime));
    }

    try {
        const sql = `SELECT * FROM messages WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ?`;
        const rows = db.prepare(sql).all(...params, Math.min(limit, 200));
        rows.reverse();
        return rows;
    } catch (error) {
        logger.error(`[消息存储] 检索消息失败: ${error.message}`);
        return [];
    }
}

/**
 * 获取会话统计信息（COUNT 聚合，不读全量）
 * @param {string} sessionId - 会话ID
 * @returns {Promise<Object>} 统计 {total, afterBoundary}
 */
export async function getSessionStats(sessionId) {
    if (!await isAvailable()) {
        return { total: 0, afterBoundary: 0 };
    }
    try {
        const total = stmts.countSession.get(sessionId)?.total || 0;
        const boundary = stmts.findBoundary.get(sessionId)?.boundary_id || 0;
        const after = db.prepare('SELECT COUNT(*) AS c FROM messages WHERE session_id = ? AND id > ?')
            .get(sessionId, boundary)?.c || 0;
        return { total, afterBoundary: after };
    } catch (error) {
        logger.error(`[消息存储] 获取会话统计失败: ${error.message}`);
        return { total: 0, afterBoundary: 0 };
    }
}

/**
 * 删除指定会话的全部消息（专门清除指令，非"重置对话"）
 * @param {string} sessionId - 会话ID
 * @returns {Promise<boolean>} 是否成功
 */
export async function deleteSession(sessionId) {
    if (!await isAvailable()) {
        return false;
    }
    try {
        db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
        return true;
    } catch (error) {
        logger.error(`[消息存储] 删除会话失败: ${error.message}`);
        return false;
    }
}
