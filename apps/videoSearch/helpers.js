import request from '../../lib/request/request.js';
import { Config, logger } from '../../components/index.js';
import { puppeteer } from '../../model/index.js';

/**
 * 关键词搜索视频
 * 统一使用 GET 方式请求（规避部分资源站的 POST 地区限制/CF 风控），仅传必要参数
 * @param {string} keyword - 搜索关键词
 * @param {number} [page=1] - 页码，默认为1
 * @param {number} [type=0] - 搜索类型（保留参数兼容，实际不传）
 * @param {number} [hour=0] - 搜索几小时内的数据（保留参数兼容，实际不传）
 * @param {string} [domain=''] - 资源站网址
 * @param {string} [from=''] - 指定线路代码（CMS_V10 通过 from 参数过滤线路，留空返回全部线路）
 * @throws {Error} 请求失败或返回异常时抛出带友好提示的错误
 * @returns {Promise<object>} 返回搜索结果对象 { code, list, pagecount, ... }
 */
export async function SearchVideo(keyword = '', page = 1, type = 0, hour = 0, domain = '', from = '') {
    if (page < 1) { page = 1; }

    // 仅传必要参数 ac/wd/pg，避免某些资源站对 t=0&h=0 的过滤导致结果为空或触发 CF 风控
    const params = new URLSearchParams({
        ac: 'detail',
        wd: keyword,
        pg: String(page)
    });
    if (from && typeof from === 'string' && from.trim() !== '') {
        params.set('from', from.trim());
    }
    const url = `${domain}?${params.toString()}`;

    // 模拟真实浏览器请求头（实测：只要是 GET，UA 正常即可通过；POST 则会被地区限制返回 403）
    // 注：request.js _prepareRequest 中默认 UA 是 Chrome 79，这里显式传入覆盖，且会展开在 ...options.headers 后面，实际以后者为准
    let referer = '';
    try {
        referer = domain ? new URL(domain).origin + '/' : '';
    } catch (_) {
        referer = '';
    }
    const browserHeaders = {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        // 伪装成从资源站首页跳转过来（domain 非法时省略该头）
        ...(referer ? { 'Referer': referer } : {}),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
    };

    /**
     * 从错误对象中提取原始 HTTP 响应（兼容 request.js 包装的 RequestError / HTTPResponseError）
     * @param {Error} err - 错误对象
     * @returns {Response|null} 原始 fetch Response 或 null
     */
    function getOriginalResponse(err) {
        if (!err || typeof err !== 'object') return null;
        // HTTPResponseError 直接挂在 response 属性
        if (err.response && typeof err.response.status === 'number') {
            return err.response;
        }
        // 兼容直接由我们自己 throw 的附 response 对象的 Error
        if (err.status && typeof err.status === 'number' && err.headers) {
            return err;
        }
        // RequestError 内层可能嵌套
        const cause = err.cause || err.innerError || err.originalError;
        if (cause && cause.response && typeof cause.response.status === 'number') {
            return cause.response;
        }
        return null;
    }

    /**
     * 判断响应是否来自 Cloudflare 拦截（403/503/429 + cf-ray/server:cloudflare）
     * @param {Response|null} resp - fetch Response 对象
     * @returns {boolean}
     */
    function isCloudflareBlocked(resp) {
        if (!resp) return false;
        const s = resp.status;
        if (s !== 403 && s !== 503 && s !== 429) return false;
        const server = typeof resp.headers.get === 'function' ? (resp.headers.get('server') || '') : '';
        const cfRay = typeof resp.headers.get === 'function' ? (resp.headers.get('cf-ray') || '') : '';
        return server.toLowerCase().includes('cloudflare') || cfRay !== '';
    }

    /**
     * 根据错误类型生成对用户友好的中文提示并抛出
     * @param {Error} err - 捕获到的错误
     * @param {Response|null} [resp] - 关联的 HTTP 响应（如果有）
     * @returns {never} 始终抛出 Error，不返回
     */
    function buildUserFriendlyError(err, resp) {
        resp = resp || getOriginalResponse(err);
        const status = resp?.status;
        const errText = `${err.code || ''} ${err.message || ''} ${err.toString ? err.toString() : ''}`;

        // ===== Cloudflare / 地区限制 =====
        if (isCloudflareBlocked(resp)) {
            let domainHint = '<资源站域名>';
            try {
                const host = new URL(url).hostname;
                const parts = host.split('.');
                domainHint = parts.length >= 2 ? `*.${parts.slice(-2).join('.')}` : host;
            } catch (_) { /* ignore */ }
            const tips = [
                `当前搜剧接口被 Cloudflare 安全防护拦截(GET ${status || ''})。`,
                `解决方案（管理员可操作）：`,
                `  1. 在 config/config/proxy.yaml 中把 switchProxy 改为 true 并配置可用代理，或`,
                `  2. 在 proxy.yaml whitelist 中加入资源站域名 ${domainHint} 后开代理，或`,
                `  3. 在锅巴面板「搜剧设置」中切换到其他未被 CF 拦截的资源站。`
            ].join('\n');
            logger.warn(`[搜剧] Cloudflare 拦截: status=${status} url=${url}`);
            throw new Error(tips);
        }

        // ===== HTTPS / 证书类错误 =====
        const certErrorPatterns = [
            'CERT_HAS_EXPIRED', 'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT',
            'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_OSSL_EVP_UNSUPPORTED', 'certificate',
            'SSL', 'tls', 'unable to verify the first certificate'
        ];
        const isCertError = certErrorPatterns.some(p => errText.toLowerCase().includes(p.toLowerCase()));
        if (isCertError) {
            throw new Error(`搜剧接口的 HTTPS 证书异常(${err.message})，请联系管理员修复证书或切换接口。`);
        }

        // ===== 服务器 5xx =====
        const serverErrorPatterns = [
            '500', '502', '503', '504',
            'internal server error', 'bad gateway', 'service unavailable', 'gateway timeout'
        ];
        const isServerError = serverErrorPatterns.some(p => errText.toLowerCase().includes(p.toLowerCase()))
            || (status && status >= 500 && status < 600);
        if (isServerError) {
            throw new Error(`当前搜剧接口服务器繁忙或发生内部错误(${status || err.message})，建议切换到其他接口再试。`);
        }

        // ===== 404 / 非 JSON 等 =====
        if (status === 404) {
            throw new Error(`搜剧接口 404 不存在(${new URL(url).hostname})，资源站可能已下线，请切换接口。`);
        }

        // 其他错误，保留原始信息
        throw new Error(`请求搜剧接口失败(GET ${status || ''})：${err.message}`);
    }

    // ========== 统一使用 GET 发起请求 ==========
    // 实测（cj.lziapi.com 量子资源）：中国大陆IP + POST 会返回"地区限制/403"；
    // GET 方式（即使不带任何自定义头）也能 200。故不再保留 POST 回退。
    let response;
    try {
        logger.debug(`[搜剧] GET 请求: ${decodeURIComponent(url)}`);
        // closeCheckStatus: true 关闭 request.js 内部的 checkStatus 自动抛错
        // 这样无论 HTTP 200 / 403 / 500 都能拿到 Response 对象，便于我们自行判断 CF 拦截等语义
        response = await request.get(url, {
            headers: browserHeaders,
            closeCheckStatus: true,
            outErrorLog: false
        });
    } catch (networkErr) {
        // DNS 解析失败 / ECONNRESET / 超时等纯网络层错误，还没拿到 HTTP 响应
        buildUserFriendlyError(networkErr, null);
        return; // unreachable - buildUserFriendlyError always throws
    }

    // ===== 处理 HTTP 响应 =====
    // response 有两种形态：1) 原生 fetch Response 对象（未传 responseType 时）；2) 已被 request 按 responseType 解析后的数据
    // 不传 responseType 时走形态 1，我们可以自己检查 status + json()

    // 形态 2：request 已经解析（通常是调用方传了 responseType），直接返回
    if (!(response && typeof response.status === 'number' && typeof response.json === 'function')) {
        return response;
    }

    // 形态 1：原生 Response
    if (!response.ok) {
        let bodyPreview = '';
        try { bodyPreview = (await response.text()).slice(0, 120).replace(/\s+/g, ' '); } catch (_) { /* ignore */ }
        const err = new Error(`HTTP Error Response: ${response.status} ${response.statusText}. ${bodyPreview ? 'Preview: ' + bodyPreview : ''}`);
        // 把 Response 当作 cause 挂到 err 上，便于 buildUserFriendlyError 里识别 CF
        err.response = response;
        buildUserFriendlyError(err, response);
        return; // unreachable
    }

    // 200 OK：解析 JSON
    let data;
    try {
        data = await response.json();
    } catch (jsonErr) {
        // 某些资源站 200 返回的其实是 HTML（cf 中间页 / 502 伪装成 200）
        let bodyPreview = '';
        try {
            // response.json() 消费过 body 后无法再 .text()，这里构造假 Response 来做提示即可
            bodyPreview = jsonErr.message;
        } catch (_) { /* ignore */ }
        const err = new Error(`搜剧接口返回非 JSON 内容：${jsonErr.message}`);
        err.response = response;
        buildUserFriendlyError(err, response);
        return; // unreachable
    }

    return data;
}

/**
 * 长链接转短链接
 * @param {string} longLink - 长链接
 * @returns {string} shortLink - 返回短链接
 */
export async function linkLongToShort(longLink) {
    // 将API URL和请求头中的值提取为常量
    const API_URL = 'https://api.45t.cn/pc/site/index';
    const BASE_HEADERS = {
        Accept: 'application/json',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Content-type': 'application/json',
        Host: 'api.45t.cn',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
    };

    // 检查输入的长链接是否为空或不合法
    if (!longLink || typeof longLink !== 'string' || longLink.trim() === '') {
        console.error('输入的长链接无效。');
        return longLink; // 返回原链接或指定的错误链接
    }

    const body = {
        "url": longLink,
        "sg": "6a9537e0120bb886f989b12563737c47" // 固定值或从配置获取
    };

    // 直接在headers中计算Content-Length
    const headers = {
        ...BASE_HEADERS,
        'Content-Length': JSON.stringify(body).length
    };

    const options = {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    };

    let res = '';
    try {
        const response = await fetch(API_URL, options);
        if (!response.ok) {
            throw new Error(`API请求失败，状态码：${response.status}`);
        }
        res = await response.json();
        console.log(`短链接：${JSON.stringify(res)}`);
    } catch (err) {
        console.error(`链接转换出错: ${err.message}`);
    }

    // 返回短链接或在错误情况下返回原链接
    return res?.data?.url || longLink;
}

/**
 * 保存搜索结果至缓存
 * @param {number} userId 用户ID
 * @param {any} searchResults 搜索结果
 */
export async function saveUserSearchCache(userId, searchResults) {
    await Promise.all([
        Config.SetUserSearchVideos(userId, 'keyword', searchResults.keyword),
        Config.SetUserSearchVideos(userId, 'page', searchResults.page),
        Config.SetUserSearchVideos(userId, 'SearchResults', JSON.stringify(searchResults)),
    ]);
}

/**
 * 处理并显示搜索结果
 * @param {Event} e 事件对象
 * @param {any} searchResults 搜索结果
 * @param {boolean} showPic 图片显示设置
 * @param {string} keyword 搜索关键词
 */
export async function handleAndDisplaySearchResults(e, searchResults, showPic, keyword) {
    if (searchResults.list) {
        const IDs = searchResults.list.map(item => item.vod_id);
        console.log(`获取数组：${IDs}`);

        try {
            // 渲染搜索结果图片，render方法内部会自动发送图片给用户
            await puppeteer.render("videoSearch/result", {
                list: searchResults.list,
                keyword: keyword || '最新视频',
                showpic: showPic,
            }, { e });
        } catch (error) {
            console.error("渲染搜索结果时出错:", error);
            e.reply(`渲染搜索结果时发生错误：${error.message}`);
        }
    } else {
        // 没有搜索结果的情况
        e.reply(`未找到与 "${keyword}" 相关的视频资源`);
    }
}
