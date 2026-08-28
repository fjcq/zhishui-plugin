/**
 * 图像编辑工具处理器
 * 处理 AI 调用的 edit_image 工具：换背景、转风格、画质增强、多图合成
 * 编辑请求经 imageClient 统一入口分发（使用 imageGen.yaml edit.model 引用的模型条目），
 * 本文件只负责流程编排：输入图获取、体积校验、频率限制、结果图下载与发送
 */

import { getSegment } from './shared/utils.js';
import { downloadImageSmart, extractCleanImageUrl } from '../../api/utils/requestUtils.js';
import { editImage } from '../imageGen/imageClient.js';
import { getImageGenConfig } from '../imageGen/imageManager.js';
import Config from '../../../../components/Config.js';
import { logger } from '../../../../components/index.js';
import { downloadImage, checkRateLimit, recordRateLimit, getRateLimitRemain } from './imageHandler.js';

/** 编辑工具名称列表 */
export const EDIT_IMAGE_TOOLS = ['edit_image'];

/** 单张输入图片体积上限（字节），Data URI 编码后会再膨胀约 33%，需保护请求体体积 */
const MAX_INPUT_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * 处理图像编辑工具调用
 * 注意：返回给 AI 的 message/error_message 必须使用中性自然语言，不暴露技术细节
 *       技术细节（接口名、配置项、错误代码等）只通过 logger 记录到日志
 * @param {string} toolName - 工具名称
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象
 * @param {string} currentUserId - 当前对话用户ID
 * @returns {Promise<object>} 工具执行结果
 */
export async function handleImageEditToolCall(toolName, params, e, currentUserId) {
    try {
        switch (toolName) {
            case 'edit_image':
                return await handleEditImage(params, e, currentUserId);
            default:
                return { error: true, error_message: '未知操作' };
        }
    } catch (error) {
        logger.error(`[编辑图片] ${toolName} 执行失败: ${error.message}`);
        return { error: true, error_message: '暂时处理不了，请稍后再试' };
    }
}

/**
 * 处理编辑图片主流程
 * 服务商由 imageGen.yaml 的 edit.model 引用决定，AI 无需也无法指定
 * @param {object} params - 工具参数
 * @param {string} params.prompt - 编辑指令
 * @param {string[]|string} params.target - 待编辑图片地址或 file_id（单元素可为字符串）
 * @param {string} [params.size] - 输出图片尺寸
 * @param {object} e - 事件对象
 * @param {string} currentUserId - 当前对话用户ID
 * @returns {Promise<object>} 执行结果
 */
async function handleEditImage(params, e, currentUserId) {
    const { prompt, size } = params;

    // 编辑指令校验
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        return { error: true, error_message: '想怎么改这张图呢？请告诉我具体的修改要求' };
    }

    // 读取配置
    const config = getImageGenConfig();
    const editConfig = config.edit || {};

    // target 归一化：兼容 AI 传单个字符串或数组两种形态
    const rawTargets = Array.isArray(params.target) ? params.target : [params.target];
    const targets = rawTargets.map(t => String(t || '').trim()).filter(Boolean);

    // 输入图数量校验（上限从配置读取并夹紧到 1~4）
    const maxImages = Math.max(1, Math.min(4, Number(editConfig.maxImages) || 4));
    if (targets.length === 0) {
        return { error: true, error_message: '请先提供要修改的图片' };
    }
    if (targets.length > maxImages) {
        return { error: true, error_message: `一次最多只能处理 ${maxImages} 张图片` };
    }

    // 校验事件对象
    if (!e || !e.reply) {
        logger.error('[编辑图片] 缺少事件对象 e.reply，无法发送图片');
        return { error: true, error_message: '暂时改不了，请在对话中使用' };
    }

    // 检查编辑功能开关
    if (!editConfig.enable) {
        logger.warn('[编辑图片] 图像编辑功能未开启（imageGen.edit.enable = false）');
        return { error: true, error_message: '修图功能还没开启呢' };
    }

    // 频率限制（与生图共享同一冷却池，防止"生图+编辑"组合高频调用）
    const userId = currentUserId || (e && e.user_id ? String(e.user_id) : 'unknown');
    const rateLimitSec = Number(config.RateLimit) || 0;
    if (rateLimitSec > 0 && !checkRateLimit(userId, rateLimitSec)) {
        const remain = getRateLimitRemain(userId, rateLimitSec);
        return { error: true, error_message: `刚刚才处理过图片，${remain} 秒后再来好吗` };
    }

    const startTime = Date.now();

    logger.info(`[编辑图片] 开始编辑 | 用户:${userId} | 输入图:${targets.length}张 | 指令:"${prompt.substring(0, 50)}..."`);

    try {
        // 获取输入图片（编辑语义要求完整输入集，任一失败则整体失败）
        const fetched = await fetchEditImages(targets, e);
        if (!fetched.ok) {
            return { error: true, error_message: fetched.message };
        }

        // 记录调用时间，避免失败后立即重试刷接口
        recordRateLimit(userId);

        // 统一入口编辑（配置解析与协议分发在 imageClient 内完成）
        const result = await editImage({ prompt, images: fetched.images, size });

        if (!result.success) {
            if (result.reason === 'not-configured') {
                return { error: true, error_message: '修图工具还没配置好，暂时用不了' };
            }
            return { error: true, error_message: '暂时改不了，请稍后再试' };
        }

        // 下载结果图到本地（复用生图的保存目录与下载逻辑）
        const localPath = await downloadImage(result.imageUrl, config);
        if (!localPath) {
            logger.error(`[编辑图片] 结果图下载失败 | 服务商URL: ${result.imageUrl.substring(0, 100)}...`);
            return { error: true, error_message: '改图时遇到网络问题，没拿到图片，请稍后再试' };
        }

        // 发送图片到对话
        const segment = await getSegment();
        if (!segment) {
            logger.error('[编辑图片] segment 模块加载失败，无法发送图片');
            return { error: true, error_message: '暂时改不了，请稍后再试' };
        }

        // 转换为 file:/// 协议路径，确保跨平台兼容
        const fileUri = `file:///${localPath.replace(/\\/g, '/')}`;
        await e.reply(segment.image(fileUri));

        // 写入会话图片记忆（后续 edit_image/analyze_image 可用 "last" 引用本图）
        await rememberSessionImage(e, {
            source: IMAGE_SOURCES.EDIT,
            localPath,
            prompt
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info(`[编辑图片] 编辑成功 | 耗时:${elapsed}s | 服务商:${result.providerName} | 输入:${fetched.images.length}张 | 本地路径:${localPath}`);

        return {
            success: true,
            message: '改好了',
            image_count: fetched.images.length,
            model: result.modelName,
            prompt,
            elapsed_sec: parseFloat(elapsed),
            local_path: localPath,
            image_ref: 'last'
        };
    } catch (error) {
        logger.error(`[编辑图片] 编辑失败: ${error.message}`);
        return {
            error: true,
            error_message: '暂时改不了，请稍后再试'
        };
    }
}

/**
 * 获取待编辑图片并转为 Data URI 数组
 * 逐张解析 target（last/last-N 引用、本地路径、URL、文件ID）后经
 * downloadImageSmart 多级策略（本地直读/直链/get_image）取图
 * @param {string[]} targets - 图片 target 数组（引用/地址/文件ID）
 * @param {object} e - 事件对象（提供 bot.sendApi 与会话定位）
 * @returns {Promise<{ok: boolean, images?: string[], message?: string}>} 全部成功返回 ok+images，任一失败返回 ok:false+自然语言提示
 */
async function fetchEditImages(targets, e) {
    const images = [];

    for (const rawTarget of targets) {
        // 解析取图参数（last/last-N 引用 → 会话记忆；本地路径 → 直读；URL → 直链；其余 → 文件ID）
        const resolved = await resolveImageTarget(rawTarget, e);
        if (!resolved) {
            logger.warn(`[编辑图片] 输入图 target 为空`);
            return { ok: false, message: '请先提供要修改的图片' };
        }
        if (resolved.refMiss) {
            logger.warn(`[编辑图片] 图片引用越界: ${rawTarget}`);
            return { ok: false, message: '刚才的图片记录找不到了，请重新发一下' };
        }

        const downloaded = await downloadImageSmart({
            url: resolved.url || resolved.localPath || '',
            fileId: resolved.fileId || '',
            e,
            source: '编辑图片'
        });

        if (!downloaded || !downloaded.base64) {
            logger.warn(`[编辑图片] 输入图获取失败: ${rawTarget.substring(0, 80)}`);
            return { ok: false, message: '这张图片暂时获取不到，链接可能已失效或不是有效的图片地址' };
        }

        // 体积校验（base64 长度反推原始字节数，约 3/4 比例）
        const bytes = Math.floor(downloaded.base64.length * 3 / 4);
        if (bytes > MAX_INPUT_IMAGE_BYTES) {
            logger.warn(`[编辑图片] 输入图过大: ${(bytes / 1024 / 1024).toFixed(1)}MB`);
            return { ok: false, message: '这张图片太大了，换一张小一点的试试吧' };
        }

        images.push(`data:${downloaded.mime || 'image/jpeg'};base64,${downloaded.base64}`);
    }

    return { ok: true, images };
}

export default {
    handleImageEditToolCall,
    EDIT_IMAGE_TOOLS
};
