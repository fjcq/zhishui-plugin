/**
 * 文心一格生图 Provider（百度千帆）
 * 同步阻塞模式（会等到图片生成完才返回，返回 base64）；
 * 需先用 AK/SK 换取 access_token（带缓存）
 * 仅支持文生图，不支持图像编辑
 *
 * 通过项目封装的 request 模块发起请求，自动遵循 proxy.yaml 代理配置
 */

import request from '../../../../../lib/request/request.js';

/** 文心一格接口端点 */
const WENXIN_TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token';
const WENXIN_API_BASE = 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/text2image/';

/** access_token 缓存（按 AK+SK 组合缓存，换密钥自动失效） */
const tokenCacheMap = new Map();

/**
 * 获取文心一格 access_token（带缓存）
 * 缓存默认 1 天，提前 5 分钟过期避免边界问题
 * @param {Object} provider - provider 条目（含 apiKey/secretKey/tokenCacheTtl）
 * @returns {Promise<string>} access_token
 */
async function getAccessToken(provider) {
    const cacheKey = `${provider.apiKey}:${provider.secretKey}`;
    const now = Date.now();
    const cached = tokenCacheMap.get(cacheKey);
    if (cached && now < cached.expireAt) {
        return cached.token;
    }

    const url = `${WENXIN_TOKEN_URL}?grant_type=client_credentials&client_id=${encodeURIComponent(provider.apiKey)}&client_secret=${encodeURIComponent(provider.secretKey)}`;

    const resp = await request.post(url, {
        headers: { 'Content-Type': 'application/json' },
        responseType: 'json',
        outErrorLog: false
    });

    if (!resp?.access_token) {
        throw new Error(`获取文心一格 access_token 失败: ${JSON.stringify(resp || {}).substring(0, 200)}`);
    }

    const cacheTTL = (Number(provider.tokenCacheTtl) || 86400) * 1000;
    tokenCacheMap.set(cacheKey, {
        token: resp.access_token,
        expireAt: now + cacheTTL - 5 * 60 * 1000
    });

    return resp.access_token;
}

/**
 * 文心一格文生图（同步阻塞模式，返回 base64）
 * @param {Object} options - 调用选项
 * @param {string} options.prompt - 提示词
 * @param {string} options.size - 图片尺寸
 * @param {Object} options.model - model 条目（含 model）
 * @param {Object} options.provider - provider 条目（含 apiKey/secretKey/tokenCacheTtl）
 * @returns {Promise<string>} data URL
 */
export async function generateWithWenxin({ prompt, size, model, provider }) {
    // 获取 access_token（带缓存）
    const accessToken = await getAccessToken(provider);

    // 调用生图接口（百度文心一格采用同步阻塞模式，会等到图片生成完才返回）
    const url = `${WENXIN_API_BASE}${model.model}?access_token=${accessToken}`;
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
    if (Array.isArray(resp.data) && resp.data.length > 0 && resp.data[0].b64_image) {
        return `data:image/png;base64,${resp.data[0].b64_image}`;
    }

    throw new Error(`文心一格返回数据格式异常: ${JSON.stringify(resp).substring(0, 200)}`);
}

export default { generate: generateWithWenxin };
