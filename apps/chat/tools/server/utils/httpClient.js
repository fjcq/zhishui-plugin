/**
 * 通用 HTTP 请求工具
 * 封装 fetch 调用，提供超时控制、JSON 解析、错误处理
 */

/** 默认请求超时（毫秒） */
const DEFAULT_TIMEOUT = 10000;

/** 浏览器 User-Agent */
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * 发送 GET 请求并解析 JSON
 * @param {string} url - 完整请求 URL
 * @param {object} options - 请求选项
 * @param {object} options.headers - 自定义请求头
 * @param {number} options.timeout - 超时时间（毫秒）
 * @returns {Promise<object|null>} 解析后的 JSON 数据或 null
 */
export async function httpGet(url, options = {}) {
    const { headers = {}, timeout = DEFAULT_TIMEOUT } = options;

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': DEFAULT_UA,
                ...headers
            }
        });

        clearTimeout(timer);

        if (!response.ok) {
            return null;
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json') || contentType.includes('text/')) {
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (_) {
                return null;
            }
        }
        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError') {
            // 超时静默处理
        }
        return null;
    }
}

/**
 * 发送 POST 请求并解析 JSON
 * @param {string} url - 完整请求 URL
 * @param {object} options - 请求选项
 * @param {object} options.headers - 自定义请求头
 * @param {string|object} options.body - 请求体
 * @param {number} options.timeout - 超时时间（毫秒）
 * @returns {Promise<object|null>} 解析后的 JSON 数据或 null
 */
export async function httpPost(url, options = {}) {
    const { headers = {}, body, timeout = DEFAULT_TIMEOUT } = options;

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const requestHeaders = {
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': DEFAULT_UA,
            ...headers
        };

        let requestBody;
        if (typeof body === 'string') {
            requestBody = body;
        } else if (body !== undefined && body !== null) {
            requestBody = JSON.stringify(body);
            if (!requestHeaders['Content-Type']) {
                requestHeaders['Content-Type'] = 'application/json';
            }
        }

        const response = await fetch(url, {
            method: 'POST',
            signal: controller.signal,
            headers: requestHeaders,
            body: requestBody
        });

        clearTimeout(timer);

        if (!response.ok) {
            return null;
        }

        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (_) {
            return null;
        }
    } catch (error) {
        return null;
    }
}

/**
 * 发送 HEAD 请求，仅获取响应状态和头部
 * @param {string} url - 完整请求 URL
 * @param {object} options - 请求选项
 * @param {object} options.headers - 自定义请求头
 * @param {number} options.timeout - 超时时间（毫秒）
 * @returns {Promise<object|null>} 包含 status、contentType、ok 的对象
 */
export async function httpHead(url, options = {}) {
    const { headers = {}, timeout = 8000 } = options;

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            redirect: 'follow',
            headers: {
                'User-Agent': DEFAULT_UA,
                ...headers
            }
        });

        clearTimeout(timer);

        return {
            status: response.status,
            ok: response.ok,
            contentType: response.headers.get('content-type') || '',
            url: response.url
        };
    } catch (error) {
        return null;
    }
}

export { DEFAULT_UA, DEFAULT_TIMEOUT };
