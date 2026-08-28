/**
 * 通义万相生图 Provider（阿里云 DashScope）
 * 异步任务模式：提交任务后轮询任务状态，直到任务完成或超时
 * 仅支持文生图，不支持图像编辑
 *
 * 通过项目封装的 request 模块发起请求，自动遵循 proxy.yaml 代理配置
 */

import request from '../../../../../lib/request/request.js';
import { logger } from '../../../../../components/index.js';

/** 通义万相接口端点 */
const TONGYI_SUBMIT_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis';
const TONGYI_QUERY_BASE = 'https://dashscope.aliyuncs.com/api/v1/tasks/';

/**
 * sleep 工具函数
 * @param {number} ms - 毫秒
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 通义万相文生图（异步任务轮询）
 * @param {Object} options - 调用选项
 * @param {string} options.prompt - 提示词
 * @param {string} options.size - 图片尺寸
 * @param {string} [options.style] - 图片风格（仅 wanx-v1 有效）
 * @param {number} [options.timeout=120000] - 超时时间（毫秒）
 * @param {Object} options.model - model 条目（含 model/style）
 * @param {Object} options.provider - provider 条目（含 apiKey/pollInterval）
 * @returns {Promise<string>} 图片 URL
 */
export async function generateWithTongyi({ prompt, size, style, timeout = 120000, model, provider }) {
    const apiKey = provider.apiKey;
    const pollInterval = Number(provider.pollInterval) || 2000;
    // 优先级：调用参数传入的风格 > model 条目配置的默认风格
    const finalStyle = style || model.style || '';

    // 构造提交任务请求体
    const submitBody = {
        model: model.model,
        input: { prompt },
        parameters: { size, n: 1 }
    };
    // 仅 wanx-v1 支持 style 参数
    if (model.model === 'wanx-v1' && finalStyle) {
        submitBody.parameters.style = finalStyle;
    }

    // 提交异步任务
    const submitResp = await request.post(TONGYI_SUBMIT_URL, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'X-DashScope-Async': 'enable',
            'Content-Type': 'application/json'
        },
        data: submitBody,
        responseType: 'json',
        outErrorLog: false
    });

    const taskId = submitResp?.output?.task_id;
    if (!taskId) {
        throw new Error(`通义万相提交任务失败: ${JSON.stringify(submitResp || {}).substring(0, 200)}`);
    }
    logger.info(`[生图工具] 通义万相任务已提交 | task_id:${taskId}`);

    // 轮询任务状态
    const queryUrl = TONGYI_QUERY_BASE + taskId;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        await sleep(pollInterval);

        const queryResp = await request.get(queryUrl, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            responseType: 'json',
            outErrorLog: false
        });

        const status = queryResp?.output?.task_status;

        if (status === 'SUCCEEDED') {
            const results = queryResp.output.results;
            if (Array.isArray(results) && results.length > 0 && results[0].url) {
                return results[0].url;
            }
            throw new Error('通义万相任务成功但未返回图片URL');
        }

        if (status === 'FAILED') {
            throw new Error(`通义万相任务失败: ${queryResp?.output?.message || '未知错误'}`);
        }
        // PENDING / RUNNING 继续轮询
    }

    throw new Error('通义万相任务超时，未在规定时间内完成');
}

export default { generate: generateWithTongyi };
