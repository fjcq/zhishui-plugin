import request from '../../lib/request/request.js';
import { Config } from '../../components/index.js';
import { puppeteer } from '../../model/index.js';

/**
 * 关键词搜索视频
 * @param {string} keyword - 搜索关键词
 * @param {number} [page=1] - 页码，默认为1
 * @param {number} [type=0] - 搜索类型
 * @param {number} [hour=0] - 搜索几小时内的数据
 * @param {string} [domain=''] - 资源站网址
 * @throws {Error} 当未找到作品时，会抛出异常
 * @returns {Array<string>} 返回搜索结果信息数组
 */
export async function SearchVideo(keyword = '', page = 1, type = 0, hour = 0, domain = '') {
    if (page < 1) { page = 1 }
    if (type < 0) { type = 0 }
    if (hour < 0) { hour = 0 }

    try {
        // 使用URLSearchParams来构造查询字符串，避免直接URL拼接
        const params = new URLSearchParams({
            ac: 'detail',
            wd: keyword,
            t: type,
            h: hour,
            pg: page
        });

        const url = `${domain}?${params.toString()}`;

        let res;
        try {
            // 兼容不同 request.post 返回值（可能是 fetch Response 或已解析的对象）
            const response = await request.post(url);
            if (response && typeof response.json === 'function') {
                res = await response.json();
            } else {
                res = response;
            }
        } catch (err) {
            // 记录原始错误
            logger.error(err);

            // 常见的 HTTPS / 证书错误关键字和错误码
            const certErrorPatterns = [
                'CERT_HAS_EXPIRED',
                'SELF_SIGNED_CERT_IN_CHAIN',
                'DEPTH_ZERO_SELF_SIGNED_CERT',
                'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
                'ERR_OSSL_EVP_UNSUPPORTED',
                'certificate',
                'SSL',
                'tls',
                'unable to verify the first certificate'
            ];

            // 常见的服务器错误状态码
            const serverErrorPatterns = [
                '500 internal server error',
                '502 bad gateway',
                '503 service unavailable',
                '504 gateway timeout'
            ];

            const errText = `${err.code || ''} ${err.message || ''} ${err.toString ? err.toString() : ''}`.toLowerCase();
            const isCertError = certErrorPatterns.some(p => errText.includes(p.toLowerCase()));
            const isServerError = serverErrorPatterns.some(p => errText.includes(p.toLowerCase()));

            if (isCertError) {
                // 返回更友好的提示，便于用户或管理员诊断问题
                throw new Error(`搜剧接口的 HTTPS 证书异常，可能已过期或为自签名证书，导致无法建立安全连接。请联系管理员修复证书或切换到可用的接口。错误详情：${err.message}`);
            } else if (isServerError) {
                // 服务器内部错误，提示用户切换接口
                throw new Error(`当前搜剧接口服务器繁忙或发生内部错误(${err.message})，建议切换到其他接口再试。`);
            } else {
                // 非证书类错误，返回更明确的请求错误信息
                throw new Error(`请求搜剧接口时发生网络或响应错误：${err.message}`);
            }
        }

        return res;
    } catch (error) {
        // 适当地处理异常，比如可以抛出供前端捕获的异常或返回错误信息
        throw error; // 维持原函数的行为：当未找到作品时，抛出异常
    }
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
 * 获取用户搜索结果，优先使用缓存（当keyword和page与传入参数一致时且SearchResults存在），否则在线搜索
 * @param {number} userId 用户ID
 * @param {string} SearchName 搜索名称
 * @param {number} defaultPage 默认页码
 * @param {string} defaultUrl 默认接口URL
 * @returns {any} SearchResults
 */
export async function getSearchResultsWithCache(userId, SearchName, defaultPage = 1, defaultUrl = "") {
    try {
        // 获取用户搜索缓存数据
        const keyword = await Config.GetUserSearchVideos(userId, 'keyword') || '';
        const page = parseInt(await Config.GetUserSearchVideos(userId, 'page') || '1');
        const SearchResultsStr = await Config.GetUserSearchVideos(userId, 'SearchResults');

        // 判断缓存的keyword和page是否与传入参数一致，且SearchResults存在
        if (keyword === SearchName && page === defaultPage && SearchResultsStr !== undefined) {
            console.log("载入用户搜索缓存");
            return JSON.parse(SearchResultsStr);
        }
    } catch (error) {
        console.warn("获取用户搜索缓存时出现错误:", error);
    }

    // 在线搜索
    console.log("调用搜索接口");
    return await SearchVideo(SearchName, defaultPage, 0, 0, defaultUrl);
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
