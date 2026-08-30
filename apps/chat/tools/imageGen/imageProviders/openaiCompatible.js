/**
 * OpenAI 兼容生图 Provider
 * 统一走 /images/generations 端点，覆盖 DALL-E、火山引擎 ARK、SiliconFlow、
 * Together AI、Agnes 等所有 OpenAI 兼容平台；文生图与图像编辑共用端点
 * （编辑仅是请求体多一个 image 数组参数）
 *
 * 通过项目封装的 request 模块发起请求，自动遵循 proxy.yaml 代理配置
 */

import request from '../../../../../lib/request/request.js';
import { logger } from '../../../../../components/index.js';

/** 默认生图接口路径 */
const DEFAULT_API_PATH = '/images/generations';

/**
 * 解析并合并额外参数（JSON 字符串）
 * @param {string} extraParamsStr - JSON 字符串
 * @param {string} logTag - 日志前缀
 * @returns {Object} 合法的额外参数对象，无参数时为空对象
 */
function parseExtraParams(extraParamsStr, logTag) {
    const raw = String(extraParamsStr || '').trim();
    if (!raw) {
        return {};
    }
    try {
        const extra = JSON.parse(raw);
        if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
            return extra;
        }
    } catch (error) {
        logger.warn(`${logTag} ExtraParams JSON 解析失败，已忽略: ${error.message}`);
    }
    return {};
}

/**
 * 尺寸分隔符转换
 * 将传入的 size（兼容 1024*1024 与 1024x1024 两种输入）统一转换为配置的分隔符
 * @param {string} size - 图片尺寸
 * @param {string} sizeSeparator - 目标分隔符（x 或 *）
 * @returns {string} 转换后的尺寸
 */
function convertSizeSeparator(size, sizeSeparator) {
    return String(size || '').replace(/[*x]/g, sizeSeparator || 'x');
}

/**
 * 从 OpenAI 兼容响应中提取图片 URL 或 data URL
 * @param {Object} resp - 接口响应
 * @param {string} responseFormat - 期望的返回格式（url/b64_json，仅影响解析优先级）
 * @param {string} logTag - 日志前缀
 * @returns {string} 图片 URL 或 data URL
 * @throws {Error} 响应为空、报错或无图片数据时抛出
 */
function extractImageUrl(resp, responseFormat, logTag) {
    // 错误信息处理（OpenAI 兼容格式）
    if (resp?.error?.message) {
        throw new Error(`${logTag} 接口错误: ${resp.error.message}`);
    }
    if (!resp?.data || !Array.isArray(resp.data) || resp.data.length === 0) {
        throw new Error(`${logTag} 返回数据为空: ${JSON.stringify(resp || {}).substring(0, 200)}`);
    }

    const item = resp.data[0];

    // base64 格式直接构造 data URL
    if (responseFormat === 'b64_json' && item.b64_json) {
        return `data:image/png;base64,${item.b64_json}`;
    }
    // 优先返回 URL
    if (item.url) {
        return item.url;
    }
    // 部分 SiliconFlow 模型返回 b64_image 字段
    if (item.b64_image) {
        return `data:image/png;base64,${item.b64_image}`;
    }
    if (item.b64_json) {
        return `data:image/png;base64,${item.b64_json}`;
    }

    throw new Error(`${logTag} 返回数据中未找到图片URL或base64`);
}

/**
 * 从 HTTPResponseError 中提取服务商返回的错误详情，避免只看到 "HTTP 400"
 * 底层 request.js 在非 2xx 时抛出 HTTPResponseError，其 response 仍是可读的 fetch Response 对象
 * @param {Error} error - 原始错误
 * @param {string} logTag - 日志前缀（用于 logger）
 * @returns {Promise<string>} 带详情的错误消息
 */
async function extractHttpErrorDetail(error, logTag) {
    const status = error?.response?.status;
    const statusText = error?.response?.statusText || '';
    let detail = '';
    try {
        if (error?.response?.text) {
            // 尝试作为文本读取，再解析可能的 JSON 错误体
            const rawText = await error.response.text();
            if (rawText) {
                try {
                    const json = JSON.parse(rawText);
                    // 常见格式：{ error: { message: '...' } } 或 { message: '...' }
                    const msg = json?.error?.message || json?.message || json?.error_description || '';
                    if (msg) {
                        detail = ` | 详情: ${String(msg).substring(0, 400)}`;
                    } else {
                        detail = ` | 响应体(${rawText.length}字): ${rawText.substring(0, 300)}`;
                    }
                } catch {
                    // 非 JSON，直接截断
                    detail = ` | 响应体: ${rawText.substring(0, 300)}`;
                }
            }
        }
    } catch {
        // 读取失败不影响原始错误抛出
    }
    const codeTag = status ? `HTTP ${status}${statusText ? ' ' + statusText : ''}` : '';
    logger.error(`${logTag} ${codeTag} 请求参数快照: model=${JSON.stringify(String(error?.__model || 'unknown'))}`
        + ` size=${JSON.stringify(String(error?.__size || ''))}`);
    return `${codeTag || '请求错误'}${detail}`;
}

/**
 * OpenAI 兼容文生图
 * @param {Object} options - 调用选项
 * @param {string} options.prompt - 提示词
 * @param {string} options.size - 图片尺寸
 * @param {Object} options.model - model 条目（含 model/apiPath/sizeSeparator/responseFormat/quality/extraParams）
 * @param {Object} options.provider - provider 条目（含 baseUrl/apiKey）
 * @returns {Promise<string>} 图片 URL 或 data URL
 */
export async function generateWithOpenAI({ prompt, size, model, provider }) {
    const baseUrl = String(provider.baseUrl || '').replace(/\/$/, '');
    const apiPath = model.apiPath || DEFAULT_API_PATH;
    const responseFormat = model.responseFormat || 'url';

    // 构造请求体（OpenAI 兼容格式）
    const body = {
        model: model.model,
        prompt,
        n: 1,
        size: convertSizeSeparator(size, model.sizeSeparator),
        response_format: responseFormat
    };
    // 部分模型支持 quality 参数（dall-e-3 等），统一透传由平台决定是否生效
    if (model.quality) {
        body.quality = model.quality;
    }
    Object.assign(body, parseExtraParams(model.extraParams, '[生图工具]'));

    try {
        const resp = await request.post(baseUrl + apiPath, {
            headers: {
                'Authorization': `Bearer ${provider.apiKey}`,
                'Content-Type': 'application/json'
            },
            data: body,
            responseType: 'json',
            outErrorLog: false
        });

        return extractImageUrl(resp, responseFormat, '生图接口');
    } catch (error) {
        if (error?.response) {
            // 挂快照参数给日志提取函数
            error.__model = model.model;
            error.__size = size;
            const detail = await extractHttpErrorDetail(error, `[生图工具] 服务商(${provider.name}/${model.name})接口拒绝`);
            throw new Error(detail);
        }
        throw error;
    }
}

/**
 * OpenAI 兼容图像编辑
 * 与文生图共用 /images/generations 端点，仅是请求体多一个 image 字段（Data URI 数组）
 * 编辑场景只传必要字段，避免无关参数触发平台严格校验
 * @param {Object} options - 调用选项
 * @param {string} options.prompt - 编辑指令
 * @param {string[]} options.images - 待编辑图片的 Data URI 数组
 * @param {string} [options.size] - 输出尺寸（空则由模型跟随原图决定）
 * @param {Object} options.model - model 条目
 * @param {Object} options.provider - provider 条目
 * @returns {Promise<string>} 结果图 URL 或 data URL
 */
export async function editWithOpenAI({ prompt, images, size, model, provider }) {
    const baseUrl = String(provider.baseUrl || '').replace(/\/$/, '');
    const apiPath = model.apiPath || DEFAULT_API_PATH;
    const responseFormat = model.responseFormat || 'url';

    const body = {
        model: model.model,
        prompt,
        image: images
    };
    // 尺寸分隔符转换（仅当指定了输出尺寸时）
    if (size) {
        body.size = convertSizeSeparator(size, model.sizeSeparator);
    }
    Object.assign(body, parseExtraParams(model.extraParams, '[编辑图片]'));

    try {
        const resp = await request.post(baseUrl + apiPath, {
            headers: {
                'Authorization': `Bearer ${provider.apiKey}`,
                'Content-Type': 'application/json'
            },
            data: body,
            responseType: 'json',
            outErrorLog: false
        });

        return extractImageUrl(resp, responseFormat, '编辑接口');
    } catch (error) {
        if (error?.response) {
            error.__model = model.model;
            error.__size = size || '';
            const detail = await extractHttpErrorDetail(
                error, `[编辑图片] 服务商(${provider.name}/${model.name})接口拒绝`
            );
            throw new Error(detail);
        }
        throw error;
    }
}

export default { generate: generateWithOpenAI, edit: editWithOpenAI };
