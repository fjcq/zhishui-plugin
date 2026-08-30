/**
 * 请求构建工具函数
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import request from '../../../../lib/request/request.js';
import { Config, logger } from '../../../../components/index.js';

/**
 * 获取有效的用户ID
 * @param {string|number} userId - 原始用户ID
 * @returns {Promise<string>} 处理后的有效用户ID
 */
export async function getValidUserId(userId) {
    if (userId === 'stdin' || !userId || isNaN(userId) || String(userId).length < 5) {
        const masterQQ = await Config.Chat.MasterQQ;
        return masterQQ || "10000";
    }
    return String(userId);
}

/**
 * 构建用户消息内容
 * @param {string} msg - 原始消息
 * @returns {Object} 包含 fullUserMsg 和 userInfo 的对象
 */
export function buildUserMessageContent(msg) {
    let userMsg = msg;
    let userInfo = null;
    try {
        let msgObj = JSON.parse(msg);
        userMsg = msgObj.message || msg;
        userInfo = msgObj.additional_info || null;
    } catch (err) {
    }

    let fullUserMsg;
    if (userInfo) {
        const userRequestFormat = {
            message: userMsg,
            additional_info: {
                name: userInfo.name || '未知用户',
                user_id: userInfo.user_id || '',
                group_id: userInfo.group_id || 0,
                favor: userInfo.favor
            }
        };
        fullUserMsg = JSON.stringify(userRequestFormat);
    } else {
        fullUserMsg = userMsg;
    }

    return { fullUserMsg, userInfo };
}

/**
 * 下载图片并转换为Base64
 * @param {string} imgUrl - 图片URL
 * @returns {Promise<Object>} 包含 base64 和 mime 的对象
 */
export async function downloadImageAsBase64(imgUrl) {
    // QQ 图链等 CDN 会拒绝无浏览器 UA 的请求，携带标准 UA 提高下载成功率
    const res = await fetch(imgUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
    });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    let mime = 'image/jpeg';
    if (imgUrl.endsWith('.png')) mime = 'image/png';
    if (imgUrl.endsWith('.webp')) mime = 'image/webp';
    if (imgUrl.endsWith('.gif')) mime = 'image/gif';
    return { base64, mime };
}

/** 本地图片文件大小上限（20MB），防止误读超大文件撑爆内存 */
const MAX_LOCAL_IMAGE_SIZE = 20 * 1024 * 1024;

/**
 * 白名单提取并清理图片 URL
 * NapCat/OneBot 链路的 URL 可能被反引号、引号包裹或粘连 CQ 分隔逗号，
 * URL 主体限定 ASCII 可见字符提取，任何非 ASCII 包裹字符天然无法混入；
 * 字符集额外排除逗号（\x2C），避免 CQ 码粘连时把下一段参数（如 ,file_size=xxx）吃进 URL。
 * 字符类采用十六进制转义写法：\x21-\x2B（ASCII 33-43）与 \x2D-\x7E（45-126），
 * 直观跳过逗号(44)，防止后续维护者误读简写范围
 * @param {string} raw - 原始 URL 字符串
 * @returns {string} 清理后的 URL，无法提取时返回空字符串
 */
export function extractCleanImageUrl(raw) {
    let text = String(raw || '');
    // 还原 CQ 码实体转义：&amp; → &
    text = text.replace(/&amp;/gi, '&');
    const match = text.match(/https?:\/\/[\x21-\x2B\x2D-\x7E]+/i);
    if (match) {
        return match[0].replace(/[`'"<>,;)]+$/g, '');
    }
    return '';
}

/**
 * 判断字符串是否为本地绝对路径
 * Windows 盘符（C:\ 或 D:/）或 POSIX 根路径（/home/...）
 * @param {string} text - 待判断字符串
 * @returns {boolean} 是否本地绝对路径
 */
function isLocalAbsolutePath(text) {
    return /^[a-zA-Z]:[\\/]/.test(String(text || '')) || String(text || '').startsWith('/');
}

/**
 * 读取本地图片文件为 base64
 * @param {string} filePath - 本地文件绝对路径
 * @returns {Promise<{base64: string, mime: string}>} 读取结果
 */
async function readLocalImageFile(filePath) {
    if (!filePath || !path.isAbsolute(filePath)) {
        throw new Error('非本地绝对路径');
    }
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
        throw new Error('路径不是文件');
    }
    if (stat.size > MAX_LOCAL_IMAGE_SIZE) {
        throw new Error(`文件过大: ${stat.size}`);
    }
    const buf = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp' };
    return { base64: buf.toString('base64'), mime: mimeMap[ext] || 'image/jpeg' };
}

/**
 * 经 OneBot get_image 接口查询图片资源
 * @param {string} fileId - 图片文件ID或文件名
 * @param {object} [e] - 事件对象（提供 bot.sendApi）
 * @returns {Promise<{url: string, file: string}|null>} 新鲜链接与本地缓存路径（可能为空），失败返回 null
 */
export async function fetchImageViaOneBot(fileId, e) {
    if (!fileId || typeof e?.bot?.sendApi !== 'function') {
        return null;
    }
    try {
        const res = await e.bot.sendApi('get_image', { file: fileId });
        const url = extractCleanImageUrl(res?.url || res?.data?.url || '');
        const file = String(res?.file || res?.data?.file || '');
        return { url, file };
    } catch (err) {
        logger.debug(`[图片] get_image 查询失败: ${err.message}`);
        return null;
    }
}

/** 网络图片下载大小上限（20MB），与本地图片读取上限一致 */
const MAX_NETWORK_IMAGE_BYTES = 20 * 1024 * 1024;

/**
 * 经项目 request 模块下载任意网络图片（自动遵循 proxy.yaml 代理配置）
 * 用于识别网络图片链接的场景：国外图床等直连失败的地址可经代理拉取；
 * 优先从 Content-Type 判定 MIME（网络图片 URL 常无扩展名），
 * 非 image/* 内容（如误传的 HTML 页面）直接拦截，避免发给视觉模型报错
 * @param {string} imgUrl - 图片直链
 * @returns {Promise<{base64: string, mime: string}>} 下载结果
 */
export async function downloadNetworkImageAsBase64(imgUrl) {
    const res = await request.get(imgUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
        },
        closeCheckStatus: false,
        outErrorLog: false
    });

    if (!res || typeof res.status !== 'number') {
        throw new Error('网络图片响应异常');
    }
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const contentType = String(res.headers?.get?.('content-type') || '').split(';')[0].trim().toLowerCase();
    if (contentType && !contentType.startsWith('image/')) {
        throw new Error(`链接内容不是图片(${contentType})`);
    }

    const buffer = await res.buffer();
    if (!buffer || buffer.length === 0) {
        throw new Error('图片内容为空');
    }
    if (buffer.length > MAX_NETWORK_IMAGE_BYTES) {
        throw new Error(`图片过大(${Math.round(buffer.length / 1048576)}MB，上限20MB)`);
    }

    let mime = contentType.startsWith('image/') ? contentType : '';
    if (!mime) {
        // Content-Type 缺失时按扩展名回退
        if (/\.png(\?|$)/i.test(imgUrl)) mime = 'image/png';
        else if (/\.webp(\?|$)/i.test(imgUrl)) mime = 'image/webp';
        else if (/\.gif(\?|$)/i.test(imgUrl)) mime = 'image/gif';
        else mime = 'image/jpeg';
    }
    return { base64: buffer.toString('base64'), mime };
}

/**
 * 判断是否为 QQ 图床链接
 * QQ 图链直连腾讯 CDN 最快且无需代理，仅在直链失败时跳过代理通道直接走 get_image
 * @param {string} url - 图片URL
 * @returns {boolean} 是否QQ图床链接
 */
function isQqImageLink(url) {
    try {
        const host = new URL(url).hostname.toLowerCase();
        return host.endsWith('.qpic.cn') || host.endsWith('.qq.com');
    } catch {
        return false;
    }
}

/**
 * 三级策略获取图片 base64（用户消息图片/工具结果图片/AI发图的统一入口）
 * 策略：⓪ 本地绝对路径直接读取（AI 生成/编辑图的 local_path，以及历史工具结果中的路径引用）
 *      ① URL 直链下载（适合普通网络图片与刚收到的新鲜 QQ 图）
 *      ①+ 非QQ图床直链失败时经 request 模块代理下载重试（国外图床等需代理场景）
 *      ② get_image 返回的本地缓存文件直接读取（QQ 图链 rkey 分钟级过期后唯一可靠途径）
 *      ③ get_image 签发的新鲜 URL 下载（NapCat 远程部署无本地文件时兜底）
 * @param {object} options - 参数对象
 * @param {string} [options.url] - 图片直链或本地绝对路径（可能被包裹，函数内清理）
 * @param {string} [options.fileId] - 图片文件ID（QQ 图片建议必传）
 * @param {object} [options.e] - 事件对象（提供 bot.sendApi）
 * @param {string} [options.source] - 日志来源标记
 * @returns {Promise<{base64: string, mime: string}|null>} 成功返回图片数据，全部失败返回 null
 */
export async function downloadImageSmart({ url, fileId, e, source = '多模态' } = {}) {
    // ⓪ 本地绝对路径直接读取（生图/编辑结果的 local_path 引用，无需网络请求）
    if (isLocalAbsolutePath(url)) {
        try {
            return await readLocalImageFile(String(url));
        } catch (err) {
            logger.debug(`[${source}] 本地文件读取失败(${err.message})，尝试get_image...`);
        }
    }

    const cleanUrl = extractCleanImageUrl(url);

    // ① 直链下载（仅当有链接时；QQ 图链 rkey 新鲜时可行）
    if (cleanUrl) {
        try {
            return await downloadImageAsBase64(cleanUrl);
        } catch (err) {
            logger.debug(`[${source}] 直链下载失败(${err.message})，尝试get_image...`);
        }

        // ①+ 非QQ图床的网络图片：经代理通道重试（QQ图链过期走代理无意义，直接进get_image）
        if (!isQqImageLink(cleanUrl)) {
            try {
                const data = await downloadNetworkImageAsBase64(cleanUrl);
                logger.info(`[${source}] 已经代理通道下载网络图片`);
                return data;
            } catch (err) {
                logger.debug(`[${source}] 代理通道下载失败(${err.message})，尝试get_image...`);
            }
        }
    }

    // ②③ 经 get_image 取本地缓存文件或新鲜链接
    if (fileId) {
        const info = await fetchImageViaOneBot(fileId, e);
        if (info) {
            if (info.file) {
                try {
                    const data = await readLocalImageFile(info.file);
                    logger.info(`[${source}] 已通过get_image本地缓存读取图片`);
                    return data;
                } catch (err) {
                    logger.debug(`[${source}] 本地缓存读取失败(${err.message})，尝试新链下载...`);
                }
            }
            if (info.url) {
                try {
                    return await downloadImageAsBase64(info.url);
                } catch (err) {
                    logger.debug(`[${source}] get_image新链下载失败: ${err.message}`);
                }
            }
        }
    }

    return null;
}

/**
 * 模型内部控制 token 正则列表。
 * thinking / tool-calling 类模型（DeepSeek-R1、Qwen3、o1/o3、GLM-Z1 等）
 * 有时会在最终文本末尾残留这些仅供推理框架内部使用的分段标记，
 * 必须在用户可见之前彻底剥离，避免泄漏 JSON 外壳 / 控制符。
 * 所有 <|FOO|> 形式的标记统一处理，兼顾未来新增的未知控制符。
 */
const MODEL_CONTROL_TOKENS = [
    /<\|tool_call_start\|>.*?<\|tool_call_end\|>/gs,     // 完整内联工具调用块
    /<\|tool_call_start\|>[^<]*/g,                        // 残留的工具调用起始
    /<\|tool_call_end\|>/g,                               // 残留的工具调用结束
    /<\|tool_calls_section_start\|>[^<]*/g,               // 工具调用段起始
    /<\|tool_calls_section_end\|>/g,                      // 工具调用段结束
    /<\|tool_calls_section\|>/g,                          // 简写段标记
    /<\|reasoning_start\|>.*?<\|reasoning_end\|>/gs,      // 思维链条形块
    /<\|reasoning_start\|>[^<]*/g,                        // 思维链起始残留
    /<\|reasoning_end\|>/g,                               // 思维链结束残留
    /<\|thinking_start\|>.*?<\|thinking_end\|>/gs,        // 思考段变体
    /<\|thinking_start\|>[^<]*/g,
    /<\|thinking_end\|>/g,
    /<\|assistant_start\|>[^<]*/g,                        // 角色起始标记残留
    /<\|assistant_end\|>/g,
    /<\|system_end\|>/g,
    /<\|user_end\|>/g,
    /<\|im_start\|>[^<]*/g,                               // Qwen 系列分段
    /<\|im_end\|>/g,
    /<\|end_of_thought\|>/g,                              // 思维结束符
    /<\|begin_of_thought\|>[^<]*/g,
    // Gemini / Google 系函数调用标记：functions.工具名:调用ID
    // 典型输出: {"message":"..."}functions.generate_image:33{"prompt":"..."}
    /functions\.[A-Za-z_][\w.-]*:\d+/g,
    // 兜底：移除未知的 <|...|> 控制符（不包含内容，纯控制标记）
    /<\|[A-Za-z0-9_:-]{1,40}\|>/g
];

/**
 * 清理模型输出中残留的内部控制 token 与多余空白。
 * 在 chatClient、toolLoop、chatHandler 三个发送出口均需调用，
 * 确保 thinking / tool-calling 类模型的内部标记不会泄漏到用户端。
 * @param {string} text - 原始模型输出
 * @returns {string} 清理后的文本
 */
export function sanitizeModelOutput(text) {
    if (typeof text !== 'string' || !text) return '';
    let cleaned = text;
    for (const re of MODEL_CONTROL_TOKENS) {
        cleaned = cleaned.replace(re, '');
    }
    return cleaned.trim();
}

/**
 * 当模型返回的"纯文本"实际上是单层 JSON 外壳时，
 * 提取其中的消息内容字段（message / content / text / output / answer / reply）
 * 作为真正要发送给用户的自然语言文本。
 *
 * 典型场景：
 *   1) 模型用原生 JSON 包一层：`{"message": "画好啦喵"}`
 *   2) 多段 functions.name:id 被 sanitize 后，剩下：`{"message": "…"}{"prompt": "…"}`
 *   3) safeParseJsonWithTail 路径3 fallback 时，外层 JSON 仍可能作为 message 被保存
 *
 * 规则（与 extractMessageFromMultiJsonBlock 类似，但仅用于字符串剥壳）：
 *   - 字符串不是 `{`/`[` 开头：原样返回（避免误操作纯文本）
 *   - 能 parse 成对象：递归收集 message/content/text 等字段值，
 *     命中 TOOL_HINT_KEYS 的对象中 message 仍保留；若提取结果为空，返回原串的 sanitize 版
 *   - 不能 parse：尝试 extractMessageFromMultiJsonBlock 提取多段
 *   - 提取出的字符串再走 sanitizeModelOutput
 *   - 最多剥 3 层，避免 `{"message":"{\"message\":\"内层\"}"}` 嵌套剥不干净
 * @param {string} text - 疑似 JSON 包装的文本
 * @param {number} [depth=3] - 剥壳深度（默认 3 层）
 * @returns {string} 剥壳后的纯文本；若文本无 JSON 外壳特征则原样 trim 后返回
 */
export function extractPlainTextFromJson(text, depth = 3) {
    if (typeof text !== 'string') return text == null ? '' : String(text);
    let result = text;
    for (let i = 0; i < depth; i++) {
        const stripped = result.trim();
        // 没有 JSON 对象/数组特征就直接返回
        if (!stripped) return '';
        const fc = stripped[0];
        if (fc !== '{' && fc !== '[') break;

        let extracted = null;
        // 先尝试整段解析
        try {
            const parsed = parseJsonLenient(stripped);
            // 优先使用 findAllJsonBlocks 提取逻辑（统一工具参数忽略规则）
            const viaBlocks = extractMessageFromMultiJsonBlock(stripped);
            if (viaBlocks && typeof viaBlocks === 'string' && viaBlocks !== stripped) {
                extracted = viaBlocks;
            } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                // 单独识别：只有 message/content/text 等 1-2 个字段的简单包装
                const MSG_KEYS = ['message', 'content', 'text', 'output', 'answer', 'reply'];
                const firstMsgKey = MSG_KEYS.find(k => typeof parsed[k] === 'string' && parsed[k]);
                if (firstMsgKey) extracted = parsed[firstMsgKey];
            } else if (typeof parsed === 'string') {
                extracted = parsed;
            }
        } catch {
            // parse 失败，试试多段提取
            const viaBlocks = extractMessageFromMultiJsonBlock(stripped);
            if (viaBlocks && typeof viaBlocks === 'string' && viaBlocks !== stripped) {
                extracted = viaBlocks;
            }
        }

        if (!extracted || extracted === stripped) break;
        const cleanedEx = sanitizeModelOutput(extracted);
        // 没变化就不要循环（防止死循环/空跑）
        if (cleanedEx === result.trim()) break;
        result = cleanedEx;
        // 再次 trim 下一轮（避免外层是多段拼接一次没剥干净）
    }
    return sanitizeModelOutput(result);
}

/**
 * 宽松 JSON.parse：当严格 parse 失败时，将候选字符串中所有 JSON 字符串片段里
 * 的未转义换行(U+000A)、回车(U+000D)、制表(U+0009)转义为 \\n/\\r/\\t 后重试。
 * 兼容 thinking/tool-calling 模型把带真实换行的字符串"裸输出"到 JSON 里的情况。
 * @param {string} raw - 候选 JSON 字符串
 * @returns {*} 解析结果
 */
function parseJsonLenient(raw) {
    try {
        return JSON.parse(raw);
    } catch (e) {
        // 扫描字符串，将未转义的 U+000A/000D/0009 替换
        let out = '';
        let inStr = false;
        let esc = false;
        for (let k = 0; k < raw.length; k++) {
            const c = raw[k];
            if (inStr) {
                if (esc) { out += c; esc = false; continue; }
                if (c === '\\') { out += c; esc = true; continue; }
                if (c === '"') { out += c; inStr = false; continue; }
                if (c === '\n') { out += '\\n'; continue; }
                if (c === '\r') { out += '\\r'; continue; }
                if (c === '\t') { out += '\\t'; continue; }
                out += c;
            } else {
                if (c === '"') inStr = true;
                out += c;
            }
        }
        if (out === raw) throw e; // 没有任何修改，没必要再 parse 一次
        return JSON.parse(out);
    }
}

/**
 * 在字符串中定位所有顶级 JSON 块（对象或数组），返回 {start, end, value} 列表。
 * 算法：遍历字符并维护括号栈（忽略字符串内与转义的括号），栈回 0 时即一个完整块。
 * 用于解析 Gemini 等模型输出的"多段 JSON 拼接 + functions.name:id 分隔"格式。
 * @param {string} text - 待扫描的原始文本
 * @returns {Array<{start:number, end:number, value:*}>} 每个 JSON 块的起止位置与解析值
 */
function findAllJsonBlocks(text) {
    const blocks = [];
    if (typeof text !== 'string') return blocks;

    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (ch !== '{' && ch !== '[') {
            i++;
            continue;
        }
        const open = ch;
        const close = open === '{' ? '}' : ']';
        let depth = 0;
        let inStr = false;
        let esc = false;
        let j = i;
        for (; j < text.length; j++) {
            const c = text[j];
            if (esc) { esc = false; continue; }
            if (c === '\\') { esc = true; continue; }
            if (c === '"') { inStr = !inStr; continue; }
            if (inStr) continue;
            if (c === open) depth++;
            else if (c === close) {
                depth--;
                if (depth === 0) break;
            }
        }
        if (j < text.length && text[j] === close) {
            const raw = text.substring(i, j + 1);
            try {
                const value = parseJsonLenient(raw);
                blocks.push({ start: i, end: j + 1, value });
            } catch {
                // 解析失败，跳过起始字符继续向后找
            }
        }
        i = j >= i ? j + 1 : i + 1;
    }
    return blocks;
}

/**
 * 从包含多段 JSON 块（典型为 Gemini/OpenRouter 函数调用格式：
 *   `{"message":"文本"}functions.generate_image:33{"prompt":"参数"}`
 *  或 `{"content":"文本"}{"tool_calls":[...]}`）
 * 的文本中，提取所有"消息内容字段"并拼接为纯文本回复。
 * 消息内容字段按优先级：message / content / text / output / answer / reply。
 * 同时忽略工具参数 JSON（包含 tool_name/tool_calls/name/arguments/prompt 等典型工具字段的对象）。
 * 若未提取到任何消息字段，返回 null（调用方应回退到常规解析逻辑）。
 * @param {string} text - 原始模型输出
 * @returns {string|null} 提取出的消息文本，或 null 表示未命中
 */
function extractMessageFromMultiJsonBlock(text) {
    if (typeof text !== 'string' || !text) return null;
    const blocks = findAllJsonBlocks(text);
    if (blocks.length === 0) return null;

    const MSG_KEYS = ['message', 'content', 'text', 'output', 'answer', 'reply'];
    const THINK_KEYS = ['reasoning', 'thinking'];
    const TOOL_HINT_KEYS = ['tool_calls', 'tool_call', 'function_call', 'tool_use',
        'arguments', 'prompt', 'name', 'input', 'function'];

    const collect = (value, depth = 0) => {
        const msg = [];
        const think = [];
        let isToolLike = false;
        if (depth > 6) return { msg, think, isToolLike };

        if (value && typeof value === 'object' && !Array.isArray(value)) {
            const keys = Object.keys(value);
            if (TOOL_HINT_KEYS.some(k => keys.includes(k))) isToolLike = true;
            for (const k of keys) {
                const v = value[k];
                if (typeof v === 'string' && v) {
                    if (MSG_KEYS.includes(k)) msg.push(v);
                    else if (THINK_KEYS.includes(k)) think.push(v);
                } else if (v && typeof v === 'object') {
                    const sub = collect(v, depth + 1);
                    msg.push(...sub.msg);
                    think.push(...sub.think);
                    if (sub.isToolLike) isToolLike = true;
                }
            }
        } else if (Array.isArray(value)) {
            for (const item of value) {
                const sub = collect(item, depth + 1);
                msg.push(...sub.msg);
                think.push(...sub.think);
                if (sub.isToolLike) isToolLike = true;
            }
        } else if (typeof value === 'string' && value) {
            msg.push(value);
        }
        return { msg, think, isToolLike };
    };

    const messages = [];
    const thinkings = [];
    for (const b of blocks) {
        const { msg, think } = collect(b.value);
        messages.push(...msg);
        thinkings.push(...think);
    }

    if (messages.length === 0 && thinkings.length === 0) {
        if (blocks.length === 1 && typeof blocks[0].value === 'string') return sanitizeModelOutput(blocks[0].value) || null;
        return null;
    }

    const cleanStr = (s) => sanitizeModelOutput(s).trim();
    const thinkingCombined = thinkings.map(cleanStr).filter(Boolean).join('\n\n');
    const msgCombined = messages.map(cleanStr).filter(Boolean).join('\n\n');
    let result = '';
    if (thinkingCombined) result += thinkingCombined + '\n\n';
    result += msgCombined;
    return result.trim() || null;
}

/**
 * 尝试解析可能尾部附带垃圾字符的 JSON 字符串。
 * 思路：先用 sanitizeModelOutput 清理控制 token，
 * 再优先走原生 JSON.parse；若仍失败，检测到 Gemini 多段 JSON +
 * functions.name:id 模式时先尝试 extractMessageFromMultiJsonBlock 提取
 * 消息字段返回 {message,content}；最后再按"最大合法 JSON 子串"
 * 从第一个 {/[ 开始，逐段缩短直到 parse 成功。
 * @param {string} raw - 原始 JSON 字符串（可能带尾巴垃圾）
 * @returns {Object|null} 解析结果，全部失败返回 null
 */
export function safeParseJsonWithTail(raw) {
    if (typeof raw !== 'string' || !raw) return null;
    const cleaned = sanitizeModelOutput(raw);
    if (!cleaned) return null;

    // 路径1：清理后直接是合法 JSON
    try {
        return JSON.parse(cleaned);
    } catch {
        // 继续后续路径
    }

    // 路径2：命中"多段 JSON + functions.name:id"模式，优先提取消息字段
    const hasFuncMark = /functions\.[A-Za-z_][\w.-]*:\d+/.test(raw);
    const jsonCount = (cleaned.match(/[{]/g) || []).length;
    if (hasFuncMark || jsonCount >= 2) {
        const extracted = extractMessageFromMultiJsonBlock(raw);
        if (extracted) {
            return { message: extracted, content: extracted };
        }
        const cleanedAgain = sanitizeModelOutput(raw);
        try {
            return JSON.parse(cleanedAgain);
        } catch { /* 继续 */ }
    }

    // 路径3：找到首个 { 或 [ 作为起始，逐次缩短右边界尝试解析
    const firstObj = cleaned.indexOf('{');
    const firstArr = cleaned.indexOf('[');
    let start;
    if (firstObj === -1 && firstArr === -1) return null;
    if (firstObj === -1) start = firstArr;
    else if (firstArr === -1) start = firstObj;
    else start = Math.min(firstObj, firstArr);

    const openChar = cleaned[start];
    const closeChar = openChar === '{' ? '}' : ']';
    const candidate = cleaned.substring(start);

    try {
        return JSON.parse(candidate);
    } catch {
        // 继续收缩
    }

    const maxShrink = Math.min(200, candidate.length - 2);
    for (let i = 1; i <= maxShrink; i++) {
        const endIdx = candidate.length - i;
        if (candidate[endIdx - 1] === closeChar) {
            try {
                return JSON.parse(candidate.substring(0, endIdx));
            } catch {
                // 继续尝试
            }
        }
    }
    return null;
}
