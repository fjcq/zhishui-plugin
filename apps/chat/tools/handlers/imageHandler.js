/**
 * 生图工具处理器
 * 处理 AI 调用的 generate_image 工具
 * 支持通义万相（阿里云）、DALL-E（OpenAI）、文心一格（百度）三种服务商
 * 通过项目封装的 request 模块发起请求，自动遵循 proxy.yaml 代理配置
 */

import fs from 'node:fs';
import path from 'node:path';
import request from '../../../../lib/request/request.js';
import { getSegment } from './shared/utils.js';
import { downloadImageSmart, extractCleanImageUrl } from '../../api/utils/requestUtils.js';
import { analyzeImage } from '../../api/visionAgent.js';
import Config from '../../../../components/Config.js';
import { logger } from '../../../../components/index.js';

/** 生图与识图工具名称列表 */
export const IMAGE_TOOLS = ['generate_image', 'analyze_image'];

/** 频率限制记录：用户ID -> 上次调用时间戳 */
const rateLimitMap = new Map();

/** 文心一格 access_token 缓存 */
let wenxinTokenCache = { token: '', expireAt: 0 };

/** 通义万相接口端点 */
const TONGYI_SUBMIT_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis';
const TONGYI_QUERY_BASE = 'https://dashscope.aliyuncs.com/api/v1/tasks/';

/** 文心一格接口端点 */
const WENXIN_TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token';
const WENXIN_API_BASE = 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/text2image/';

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

    // 清理 AI 可能带入的包裹字符（markdown 图片语法、反引号、CQ 参数粘连等），提取纯 URL
    const cleanedUrl = extractCleanImageUrl(rawTarget);

    // URL（含被包裹后提取成功的）走链接识别；否则按文件ID经 get_image 取图
    const downloaded = await downloadImageSmart({
        url: cleanedUrl || '',
        fileId: cleanedUrl ? '' : rawTarget,
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
 * 服务商由系统按 DefaultProvider 配置自动选择，AI 无需也无法指定
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

    // 确定服务商：
    // - DefaultProvider 为空（默认）= 自动模式，静默使用第一个可用服务商
    // - DefaultProvider 指定了具体服务商：若已配置则使用，否则回退到第一个可用服务商并提示
    const availableProviders = getAvailableProviders(config);
    if (availableProviders.length === 0) {
        logger.warn('[生图工具] 未配置任何可用的生图服务商（请在 imageGen.yaml 或锅巴面板配置 Tongyi/DallE/Wenxin/Custom 任一）');
        return {
            error: true,
            error_message: '画具还没准备好，暂时画不出来'
        };
    }

    const defaultProvider = (config.DefaultProvider || '').trim();
    let finalProvider;
    if (defaultProvider && availableProviders.includes(defaultProvider)) {
        // 用户明确指定了服务商且已配置
        finalProvider = defaultProvider;
    } else if (!defaultProvider) {
        // 自动模式：静默使用第一个可用服务商（只配置一个时即用户的唯一选择）
        finalProvider = availableProviders[0];
    } else {
        // 用户指定的服务商未配置，回退到第一个可用服务商
        finalProvider = availableProviders[0];
        logger.warn(`[生图工具] 默认服务商 ${defaultProvider} 未配置，自动使用 ${finalProvider}`);
    }

    // 记录调用时间，避免失败后立即重试刷接口
    recordRateLimit(userId);

    const finalSize = size || config.DefaultSize || '1024*1024';
    const timeout = Number(config.Timeout) || 120000;
    const startTime = Date.now();

    logger.info(`[生图工具] 开始生图 | 用户:${userId} | 服务商:${finalProvider} | 提示词:"${prompt.substring(0, 50)}..."`);

    try {
        // 调用对应服务商获取图片URL或data URL
        let imageUrl;
        switch (finalProvider) {
            case 'tongyi':
                imageUrl = await generateWithTongyi(prompt, finalSize, style, config, timeout);
                break;
            case 'dall_e':
                imageUrl = await generateWithDallE(prompt, finalSize, config);
                break;
            case 'wenxin':
                imageUrl = await generateWithWenxin(prompt, finalSize, config);
                break;
            case 'custom':
                imageUrl = await generateWithCustom(prompt, finalSize, config);
                break;
        }

        if (!imageUrl) {
            logger.error('[生图工具] 服务商未返回图片URL');
            return { error: true, error_message: '没画出来，请稍后再试' };
        }

        // 下载图片到本地
        const localPath = await downloadImage(imageUrl, config);
        if (!localPath) {
            logger.error(`[生图工具] 图片下载失败 | 服务商URL: ${imageUrl.substring(0, 100)}...`);
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

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info(`[生图工具] 生图成功 | 耗时:${elapsed}s | 本地路径:${localPath}`);

        return {
            success: true,
            message: '画好了',
            provider: finalProvider,
            prompt,
            size: finalSize,
            elapsed_sec: parseFloat(elapsed),
            local_path: localPath
        };
    } catch (error) {
        logger.error(`[生图工具] 生图失败: ${error.message}`);
        return {
            error: true,
            error_message: '暂时画不出来，请稍后再试'
        };
    }
}

/**
 * 通义万相生图（异步任务模式）
 * 提交任务后轮询任务状态，直到任务完成或超时
 * @param {string} prompt - 提示词
 * @param {string} size - 图片尺寸
 * @param {string} [style] - 图片风格（仅 wanx-v1 有效）
 * @param {object} config - 全局配置
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<string>} 图片URL
 */
async function generateWithTongyi(prompt, size, style, config, timeout) {
    const tongyiConfig = config.Tongyi || {};
    const apiKey = tongyiConfig.ApiKey;
    const model = tongyiConfig.Model || 'wanx2.1-t2i-turbo';
    const pollInterval = Number(tongyiConfig.PollInterval) || 2000;

    // 构造提交任务请求体
    const submitBody = {
        model,
        input: { prompt },
        parameters: { size, n: 1 }
    };
    // 仅 wanx-v1 支持 style 参数
    if (model === 'wanx-v1' && style) {
        submitBody.parameters.style = style;
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
        throw new Error(`通义万相提交任务失败: ${safeStringify(submitResp)}`);
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

/**
 * DALL-E 生图（同步模式，直接返回结果）
 * @param {string} prompt - 提示词
 * @param {string} size - 图片尺寸
 * @param {object} config - 全局配置
 * @returns {Promise<string>} 图片URL或data URL
 */
async function generateWithDallE(prompt, size, config) {
    const dallEConfig = config.DallE || {};
    const apiKey = dallEConfig.ApiKey;
    const baseUrl = (dallEConfig.BaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = dallEConfig.Model || 'dall-e-3';
    const quality = dallEConfig.Quality || 'standard';
    const responseFormat = dallEConfig.ResponseFormat || 'url';

    // DALL-E 尺寸使用 x 分隔符（1024x1024），统一转换
    const dallESize = size.replace('*', 'x');

    const body = {
        model,
        prompt,
        n: 1,
        size: dallESize,
        response_format: responseFormat
    };
    // 仅 dall-e-3 支持 quality 参数
    if (model === 'dall-e-3') {
        body.quality = quality;
    }

    const resp = await request.post(`${baseUrl}/images/generations`, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        data: body,
        responseType: 'json',
        outErrorLog: false
    });

    if (resp?.error?.message) {
        throw new Error(`DALL-E 接口错误: ${resp.error.message}`);
    }

    if (!resp?.data || !Array.isArray(resp.data) || resp.data.length === 0) {
        throw new Error(`DALL-E 返回数据为空: ${safeStringify(resp)}`);
    }

    const item = resp.data[0];

    // base64 格式直接构造 data URL
    if (responseFormat === 'b64_json' && item.b64_json) {
        return `data:image/png;base64,${item.b64_json}`;
    }

    if (item.url) {
        return item.url;
    }

    throw new Error('DALL-E 返回数据中未找到图片URL或base64');
}

/**
 * 文心一格生图（同步阻塞模式，返回 base64）
 * @param {string} prompt - 提示词
 * @param {string} size - 图片尺寸
 * @param {object} config - 全局配置
 * @returns {Promise<string>} data URL
 */
async function generateWithWenxin(prompt, size, config) {
    const wenxinConfig = config.Wenxin || {};
    const apiKey = wenxinConfig.ApiKey;
    const secretKey = wenxinConfig.SecretKey;
    const model = wenxinConfig.Model || 'wenxin-yige-2.0';

    // 获取 access_token（带缓存）
    const accessToken = await getWenxinAccessToken(apiKey, secretKey, wenxinConfig.TokenCacheTTL);

    // 调用生图接口（百度文心一格采用同步阻塞模式，会等到图片生成完才返回）
    const url = `${WENXIN_API_BASE}${model}?access_token=${accessToken}`;
    const body = { prompt, size, n: 1 };

    const resp = await request.post(url, {
        headers: { 'Content-Type': 'application/json' },
        data: body,
        responseType: 'json',
        outErrorLog: false
    });

    if (!resp) {
        throw new Error('文心一格返回数据为空');
    }

    if (resp.error_code) {
        throw new Error(`文心一格错误[${resp.error_code}]: ${resp.error_msg || '未知错误'}`);
    }

    if (Array.isArray(resp.data) && resp.data.length > 0) {
        const b64 = resp.data[0].b64_image;
        if (b64) {
            return `data:image/png;base64,${b64}`;
        }
    }

    throw new Error(`文心一格返回数据格式异常: ${safeStringify(resp)}`);
}

/**
 * 自定义服务商生图（OpenAI 兼容接口）
 * 适用于火山引擎 ARK、SiliconFlow、Together AI 等第三方平台
 * 这些平台均兼容 OpenAI 的 /images/generations 接口格式
 * @param {string} prompt - 提示词
 * @param {string} size - 图片尺寸
 * @param {object} config - 全局配置
 * @returns {Promise<string>} 图片URL或data URL
 */
async function generateWithCustom(prompt, size, config) {
    const customConfig = config.Custom || {};
    const apiKey = customConfig.ApiKey;
    const baseUrl = String(customConfig.BaseUrl || '').replace(/\/$/, '');
    const apiPath = customConfig.ApiPath || '/images/generations';
    const model = customConfig.Model;
    const quality = customConfig.Quality || 'standard';
    const responseFormat = customConfig.ResponseFormat || 'url';
    const sizeSeparator = customConfig.SizeSeparator || 'x';
    const extraParamsStr = customConfig.ExtraParams || '';

    // 尺寸分隔符转换：将传入的 size 统一转换为配置的分隔符
    // 同时支持 OpenAI 风格 1024x1024 和国内平台 1024*1024 两种输入
    const finalSize = size.replace(/[*x]/g, sizeSeparator);

    // 构造请求体（OpenAI 兼容格式）
    const body = {
        model,
        prompt,
        n: 1,
        size: finalSize,
        response_format: responseFormat,
        quality
    };

    // 解析并合并额外参数（部分平台需要 guidance_scale、num_inference_steps 等）
    if (extraParamsStr && extraParamsStr.trim()) {
        try {
            const extra = JSON.parse(extraParamsStr);
            if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
                Object.assign(body, extra);
            }
        } catch (error) {
            logger.warn(`[生图工具] Custom.ExtraParams JSON 解析失败，已忽略: ${error.message}`);
        }
    }

    const url = baseUrl + apiPath;
    const resp = await request.post(url, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        data: body,
        responseType: 'json',
        outErrorLog: false
    });

    // 错误信息处理（OpenAI 兼容格式）
    if (resp?.error?.message) {
        throw new Error(`自定义服务商接口错误: ${resp.error.message}`);
    }

    if (!resp?.data || !Array.isArray(resp.data) || resp.data.length === 0) {
        throw new Error(`自定义服务商返回数据为空: ${safeStringify(resp)}`);
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

    // 部分 SiliconFlow 模型可能返回 b64_image 字段
    if (item.b64_image) {
        return `data:image/png;base64,${item.b64_image}`;
    }

    throw new Error('自定义服务商返回数据中未找到图片URL或base64');
}

/**
 * 获取文心一格 access_token（带缓存）
 * 缓存默认 1 天，提前 5 分钟过期避免边界问题
 * @param {string} apiKey - API Key（AK）
 * @param {string} secretKey - Secret Key（SK）
 * @param {number} [ttl=86400] - 缓存时间（秒）
 * @returns {Promise<string>} access_token
 */
async function getWenxinAccessToken(apiKey, secretKey, ttl = 86400) {
    const now = Date.now();
    if (wenxinTokenCache.token && now < wenxinTokenCache.expireAt) {
        return wenxinTokenCache.token;
    }

    const url = `${WENXIN_TOKEN_URL}?grant_type=client_credentials&client_id=${encodeURIComponent(apiKey)}&client_secret=${encodeURIComponent(secretKey)}`;

    const resp = await request.post(url, {
        headers: { 'Content-Type': 'application/json' },
        responseType: 'json',
        outErrorLog: false
    });

    if (!resp?.access_token) {
        throw new Error(`获取文心一格 access_token 失败: ${safeStringify(resp)}`);
    }

    const cacheTTL = (Number(ttl) || 86400) * 1000;
    wenxinTokenCache = {
        token: resp.access_token,
        expireAt: now + cacheTTL - 5 * 60 * 1000
    };

    return resp.access_token;
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
 * 获取已配置可用的服务商列表
 * 按预置顺序检查每个服务商的必要配置项是否完整
 * @param {object} config - 全局配置
 * @returns {string[]} 已配置可用的服务商标识数组
 */
function getAvailableProviders(config) {
    const available = [];

    // 通义万相：需要 ApiKey
    const tongyi = config.Tongyi || {};
    if (tongyi.ApiKey) {
        available.push('tongyi');
    }

    // DALL-E：需要 ApiKey
    const dallE = config.DallE || {};
    if (dallE.ApiKey) {
        available.push('dall_e');
    }

    // 文心一格：需要 ApiKey 和 SecretKey
    const wenxin = config.Wenxin || {};
    if (wenxin.ApiKey && wenxin.SecretKey) {
        available.push('wenxin');
    }

    // 自定义：需要 ApiKey、BaseUrl、Model
    const custom = config.Custom || {};
    if (custom.ApiKey && custom.BaseUrl && custom.Model) {
        available.push('custom');
    }

    return available;
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

/**
 * sleep 工具函数
 * @param {number} ms - 毫秒
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
    handleImageToolCall,
    IMAGE_TOOLS
};
