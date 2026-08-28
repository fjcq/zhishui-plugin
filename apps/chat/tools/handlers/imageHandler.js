/**
 * 生图工具处理器
 * 处理 AI 调用的 generate_image / analyze_image 工具
 * 生图请求经 imageClient 统一入口分发（协议差异在 imageProviders 层消化），
 * 本文件只负责流程编排：参数校验、频率限制、结果图下载与发送
 */

import fs from 'node:fs';
import path from 'node:path';
import { getSegment } from './shared/utils.js';
import { downloadImageSmart } from '../../api/utils/requestUtils.js';
import { analyzeImage } from '../../core/visionAgent.js';
import { generateImage } from '../imageGen/imageClient.js';
import { rememberSessionImage, resolveImageTarget, IMAGE_SOURCES } from '../imageGen/imageMemory.js';
import Config from '../../../../components/Config.js';
import { logger } from '../../../../components/index.js';

/** 生图与识图工具名称列表 */
export const IMAGE_TOOLS = ['generate_image', 'analyze_image'];

/** 频率限制记录：用户ID -> 上次调用时间戳 */
const rateLimitMap = new Map();

/**
 * 处理生图工具调用
 * 注意：返回给 AI 的 message/error_message 必须使用中性自然语言，不暴露技术细节
 *       技术细节（接口名、配置项、错误代码等）只通过 logger 记录到日志
 * @param {string} toolName - 工具名称
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象
 * @param {string} currentUserId - 当前对话用户ID
 * @returns {Promise<object>} 工具执行结果
 */
export async function handleImageToolCall(toolName, params, e, currentUserId) {
    try {
        switch (toolName) {
            case 'generate_image':
                return await handleGenerateImage(params, e, currentUserId);
            case 'analyze_image':
                return await handleAnalyzeImage(params, e);
            default:
                return { error: true, error_message: '未知操作' };
        }
    } catch (error) {
        logger.error(`[图片工具] ${toolName} 执行失败: ${error.message}`);
        return { error: true, error_message: '暂时处理不了，请稍后再试' };
    }
}

/**
 * 处理识别图片
 * 经 downloadImageSmart 三级策略（直链/get_image本地缓存/get_image新链）取图，
 * 再委托视觉模型识别（视觉模型由 VisionApiIndex 指定，-1 时自动选择）
 * @param {object} params - 工具参数
 * @param {string} params.target - 图片URL或文件ID
 * @param {string} [params.question] - 针对图片的具体问题
 * @param {object} e - 事件对象
 * @returns {Promise<object>} 执行结果
 */
async function handleAnalyzeImage(params, e) {
    const rawTarget = String(params.target || '').trim();
    const question = String(params.question || '').trim();

    if (!rawTarget) {
        return { error: true, error_message: '缺少图片地址或文件ID，无法识别' };
    }

    // 解析取图参数（支持 last/last-N 引用、本地路径、URL、文件ID四种形态）
    const resolved = await resolveImageTarget(rawTarget, e);
    if (!resolved) {
        return { error: true, error_message: '缺少图片地址或文件ID，无法识别' };
    }
    if (resolved.refMiss) {
        return { error: true, error_message: '刚才的图片记录找不到了，请重新发一下' };
    }

    // 本地路径直读；URL 走链接识别；其余按文件ID经 get_image 取图
    const downloaded = await downloadImageSmart({
        url: resolved.url || resolved.localPath || '',
        fileId: resolved.fileId || '',
        e,
        source: '识图工具'
    });

    if (!downloaded) {
        return { error: true, error_message: '这张图片暂时获取不到，链接可能已失效或不是有效的图片地址' };
    }

    const result = await analyzeImage({
        base64: downloaded.base64,
        mime: downloaded.mime,
        prompt: question || undefined
    });

    if (!result.success) {
        return { error: true, error_message: '图片识别暂时不可用，请稍后再试' };
    }

    logger.info('[识图工具] analyze_image 识别成功');
    return { success: true, description: result.description };
}

/**
 * 处理生成图片
 * 模型由系统按 defaultText2Image 配置自动选择，AI 无需也无法指定
 * @param {object} params - 工具参数
 * @param {string} params.prompt - 图片描述提示词
 * @param {string} [params.size] - 图片尺寸
 * @param {string} [params.style] - 图片风格
 * @param {object} e - 事件对象
 * @param {string} currentUserId - 当前对话用户ID
 * @returns {Promise<object>} 执行结果
 */
async function handleGenerateImage(params, e, currentUserId) {
    const { prompt, size, style } = params;

    // 参数校验
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        return { error: true, error_message: '想画什么呢？请告诉我具体的画面内容' };
    }

    // 读取配置
    const config = Config.getDefOrConfig('imageGen') || {};

    // 检查全局开关
    if (!config.Enable) {
        logger.warn('[生图工具] 生图功能未开启（imageGen.Enable = false）');
        return { error: true, error_message: '画图功能还没开启呢' };
    }

    // 校验事件对象
    if (!e || !e.reply) {
        logger.error('[生图工具] 缺少事件对象 e.reply，无法发送图片');
        return { error: true, error_message: '暂时画不出来，请在对话中使用' };
    }

    // 频率限制
    const userId = currentUserId || (e && e.user_id ? String(e.user_id) : 'unknown');
    const rateLimitSec = Number(config.RateLimit) || 0;
    if (rateLimitSec > 0 && !checkRateLimit(userId, rateLimitSec)) {
        const remain = getRateLimitRemain(userId, rateLimitSec);
        return { error: true, error_message: `画累了，${remain} 秒后再画好吗` };
    }

    // 记录调用时间，避免失败后立即重试刷接口
    recordRateLimit(userId);

    // 统一入口生图（配置解析与协议分发在 imageClient 内完成）
    const result = await generateImage({ prompt, size, style });

    if (!result.success) {
        if (result.reason === 'not-configured') {
            return { error: true, error_message: '画具还没准备好，暂时画不出来' };
        }
        return { error: true, error_message: '暂时画不出来，请稍后再试' };
    }

    // 下载图片到本地
    const localPath = await downloadImage(result.imageUrl, config);
    if (!localPath) {
        logger.error(`[生图工具] 图片下载失败 | 服务商URL: ${result.imageUrl.substring(0, 100)}...`);
        return { error: true, error_message: '画作生成中遇到网络问题，没拿到图片，请稍后再试' };
    }

    // 发送图片到对话
    const segment = await getSegment();
    if (!segment) {
        logger.error('[生图工具] segment 模块加载失败，无法发送图片');
        return { error: true, error_message: '暂时画不出来，请稍后再试' };
    }

    // 转换为 file:/// 协议路径，确保跨平台兼容
    const fileUri = `file:///${localPath.replace(/\\/g, '/')}`;
    await e.reply(segment.image(fileUri));

    // 写入会话图片记忆（后续 edit_image/analyze_image 可用 "last" 引用本图）
    await rememberSessionImage(e, {
        source: IMAGE_SOURCES.GENERATE,
        localPath,
        prompt
    });

    logger.info(`[生图工具] 生图成功 | 耗时:${result.elapsedSec}s | 服务商:${result.providerName} | 本地路径:${localPath}`);

    return {
        success: true,
        message: '画好了',
        model: result.modelName,
        prompt,
        size: size || config.DefaultSize || '1024*1024',
        elapsed_sec: parseFloat(result.elapsedSec),
        local_path: localPath,
        image_ref: 'last'
    };
}

/**
 * 下载图片到本地
 * 支持远程 URL 和 data URL 两种格式
 * 使用 request 模块自动遵循 proxy.yaml 代理配置
 * @param {string} imageUrl - 图片URL或 data URL
 * @param {object} config - 全局配置
 * @returns {Promise<string|null>} 本地文件路径，失败返回 null
 */
export async function downloadImage(imageUrl, config) {
    try {
        const saveDir = getSaveDir(config);
        if (!fs.existsSync(saveDir)) {
            fs.mkdirSync(saveDir, { recursive: true });
        }

        const filename = `img_${Date.now()}_${Math.floor(Math.random() * 10000)}.png`;
        const filePath = path.join(saveDir, filename);

        // 处理 data URL（base64 内联图片）
        if (imageUrl.startsWith('data:')) {
            const base64Data = imageUrl.split(',')[1];
            fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
            return filePath;
        }

        // 下载远程图片：使用 arrayBuffer 避免 node-fetch v3 无 buffer() 方法的问题
        // request 模块会自动处理代理，responseType:'arrayBuffer' 调用 res.arrayBuffer()
        const arrayBuffer = await request.get(imageUrl, {
            responseType: 'arrayBuffer',
            outErrorLog: false
        });

        if (!arrayBuffer) {
            return null;
        }

        const buffer = Buffer.from(arrayBuffer);
        if (buffer.length === 0) {
            return null;
        }

        fs.writeFileSync(filePath, buffer);
        return filePath;
    } catch (error) {
        logger.error(`[生图工具] 下载图片失败: ${error.message}`);
        return null;
    }
}

/**
 * 获取图片保存目录
 * 优先使用配置的 SaveDir，否则使用默认目录 resources/output/imagegen
 * @param {object} config - 全局配置
 * @returns {string} 保存目录绝对路径
 */
function getSaveDir(config) {
    const pluginPath = path.join(process.cwd(), 'plugins', 'zhishui-plugin');
    if (config.SaveDir && typeof config.SaveDir === 'string' && config.SaveDir.trim()) {
        return path.isAbsolute(config.SaveDir) ? config.SaveDir : path.join(pluginPath, config.SaveDir);
    }
    return path.join(pluginPath, 'resources', 'output', 'imagegen');
}

/**
 * 检查频率限制是否通过
 * @param {string} userId - 用户ID
 * @param {number} rateLimitSec - 限制间隔（秒）
 * @returns {boolean} 是否允许调用
 */
export function checkRateLimit(userId, rateLimitSec) {
    if (rateLimitSec <= 0) return true;
    const now = Date.now();
    const lastTime = rateLimitMap.get(userId) || 0;
    return (now - lastTime) >= rateLimitSec * 1000;
}

/**
 * 获取剩余冷却秒数
 * @param {string} userId - 用户ID
 * @param {number} rateLimitSec - 限制间隔（秒）
 * @returns {number} 剩余秒数
 */
export function getRateLimitRemain(userId, rateLimitSec) {
    const now = Date.now();
    const lastTime = rateLimitMap.get(userId) || 0;
    const remain = Math.ceil((rateLimitSec * 1000 - (now - lastTime)) / 1000);
    return Math.max(remain, 0);
}

/**
 * 记录用户调用时间
 * @param {string} userId - 用户ID
 */
export function recordRateLimit(userId) {
    rateLimitMap.set(userId, Date.now());
}

/**
 * 安全的 JSON 序列化，避免循环引用和超大对象
 * @param {any} obj - 待序列化对象
 * @param {number} [maxLen=200] - 最大返回长度
 * @returns {string} 序列化后的字符串
 */
export function safeStringify(obj, maxLen = 200) {
    try {
        const str = JSON.stringify(obj) || '';
        return str.substring(0, maxLen);
    } catch {
        return '[无法序列化的对象]';
    }
}

export default {
    handleImageToolCall,
    IMAGE_TOOLS
};
