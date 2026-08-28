/**
 * 生图模块统一入口
 * 文生图（generateImage）与图像编辑（editImage）的单一调用门面：
 * 配置解析（imageManager）→ 协议分发（imageProviders）→ 结果归一
 *
 * 业务层（imageHandler/imageEditHandler）只与本模块交互，不再关心服务商协议差异
 */

import { logger } from '../../../../components/index.js';
import { resolveText2ImageModel, resolveEditModel, getImageGenConfig } from './imageManager.js';
import { getImageProvider } from './imageProviders/index.js';

/**
 * 生图/编辑结果对象
 * @typedef {Object} ImageGenResult
 * @property {boolean} success - 是否成功
 * @property {string} [imageUrl] - 图片 URL 或 data URL（成功时）
 * @property {string} [modelName] - 使用的 model 别名（成功时）
 * @property {string} [providerName] - 使用的 provider 名称（成功时）
 * @property {string} [elapsedSec] - 耗时秒数（成功时）
 * @property {string} [reason] - 失败原因标识（not-configured / provider-error，失败时）
 * @property {Error} [error] - 原始错误对象（失败时，供日志）
 */

/**
 * 生成图片（文生图）
 * 服务商由 defaultText2Image 配置自动选择，AI 无需也无法指定
 * @param {Object} options - 调用选项
 * @param {string} options.prompt - 图片描述提示词
 * @param {string} [options.size] - 图片尺寸（空则使用全局 DefaultSize）
 * @param {string} [options.style] - 图片风格（仅通义万相 wanx-v1 有效）
 * @returns {Promise<ImageGenResult>} 执行结果
 */
export async function generateImage({ prompt, size, style }) {
    const config = getImageGenConfig();
    const resolved = resolveText2ImageModel();

    if (!resolved) {
        logger.warn('[生图工具] 未配置任何可用的生图服务商（请在 imageGen.yaml 或锅巴面板配置 providers/models）');
        return { success: false, reason: 'not-configured' };
    }

    const { model, provider } = resolved;
    const finalSize = size || config.DefaultSize || '1024*1024';
    const timeout = Number(config.Timeout) || 120000;
    const startTime = Date.now();

    logger.info(`[生图工具] 开始生图 | 服务商:${provider.name}(${provider.type}) | 模型:${model.model} | 提示词:"${String(prompt).substring(0, 50)}..."`);

    try {
        const impl = getImageProvider(provider.type);
        const imageUrl = await impl.generate({ prompt, size: finalSize, style, model, provider, timeout });

        if (!imageUrl) {
            throw new Error('服务商未返回图片URL');
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        return { success: true, imageUrl, modelName: model.name, providerName: provider.name, elapsedSec: elapsed };
    } catch (error) {
        logger.error(`[生图工具] 生图失败(${provider.name}/${model.model}): ${error.message}`);
        return { success: false, reason: 'provider-error', error };
    }
}

/**
 * 编辑图片（图像编辑）
 * 使用 edit.model 引用的模型条目（OpenAI 兼容协议），不做自动回退
 * @param {Object} options - 调用选项
 * @param {string} options.prompt - 编辑指令
 * @param {string[]} options.images - 待编辑图片的 Data URI 数组
 * @param {string} [options.size] - 输出尺寸（空则由模型跟随原图决定）
 * @returns {Promise<ImageGenResult>} 执行结果
 */
export async function editImage({ prompt, images, size }) {
    const resolved = resolveEditModel();

    if (!resolved) {
        logger.warn('[编辑图片] 编辑模型未配置或不可用（请在 imageGen.yaml 配置 edit.model 指向的 providers/models）');
        return { success: false, reason: 'not-configured' };
    }

    const { model, provider } = resolved;
    const startTime = Date.now();

    logger.info(`[编辑图片] 开始编辑 | 服务商:${provider.name}(${provider.type}) | 模型:${model.model} | 输入图:${images.length}张 | 指令:"${String(prompt).substring(0, 50)}..."`);

    try {
        const impl = getImageProvider(provider.type);
        // 仅 OpenAI 兼容协议支持图像编辑
        if (typeof impl.edit !== 'function') {
            throw new Error(`服务商类型 ${provider.type} 不支持图像编辑`);
        }

        const imageUrl = await impl.edit({ prompt, images, size, model, provider });
        if (!imageUrl) {
            throw new Error('服务商未返回图片URL');
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        return { success: true, imageUrl, modelName: model.name, providerName: provider.name, elapsedSec: elapsed };
    } catch (error) {
        logger.error(`[编辑图片] 编辑失败(${provider.name}/${model.model}): ${error.message}`);
        return { success: false, reason: 'provider-error', error };
    }
}

export default { generateImage, editImage };
