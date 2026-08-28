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
