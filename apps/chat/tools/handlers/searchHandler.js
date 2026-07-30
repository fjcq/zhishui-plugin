/**
 * 联网搜索工具处理函数
 * 处理AI调用的网络搜索相关工具
 * 默认使用 DuckDuckGo HTML 接口，无需 API Key
 * 通过项目封装的 request 模块发起请求，自动遵循 proxy.yaml 代理配置
 */

import request from '../../../../lib/request/request.js';
import { logger } from '../../../../components/index.js';

/** DuckDuckGo HTML 搜索接口地址 */
const DDG_HTML_ENDPOINT = 'https://html.duckduckgo.com/html/';

/** 浏览器 User-Agent，避免被识别为爬虫 */
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** 默认返回结果数量 */
const DEFAULT_MAX_RESULTS = 5;

/** 返回结果数量上限 */
const MAX_RESULTS_LIMIT = 10;

/**
 * 处理联网搜索工具调用
 * @param {string} toolName - 工具名称
 * @param {object} params - 工具参数
 * @returns {Promise<object>} 工具执行结果
 */
export async function handleSearchToolCall(toolName, params) {
    try {
        switch (toolName) {
            case 'web_search':
                return await handleWebSearch(params);
            default:
                return { error: true, error_message: `未知的搜索工具: ${toolName}` };
        }
    } catch (error) {
        logger.error(`[搜索工具] ${toolName} 执行失败: ${error.message}`);
        return { error: true, error_message: `搜索失败: ${error.message}` };
    }
}

/**
 * 执行网页搜索
 * @param {object} params - 搜索参数
 * @param {string} params.query - 搜索关键词
 * @param {number} params.max_results - 最大返回结果数
 * @returns {Promise<object>} 搜索结果
 */
async function handleWebSearch(params) {
    const { query } = params;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return { error: true, error_message: '搜索关键词不能为空' };
    }

    const trimmedQuery = query.trim();
    const maxResults = clampMaxResults(params.max_results);

    logger.info(`[搜索工具] 开始搜索: "${trimmedQuery}" | 限制: ${maxResults}条`);

    const html = await fetchDuckDuckGoHtml(trimmedQuery);
    if (!html) {
        return {
            error: true,
            error_message: '无法连接到 DuckDuckGo 搜索接口。可能原因：网络不通或被屏蔽。若服务器在中国大陆，请在 plugins/zhishui-plugin/config/config/proxy.yaml 中开启 switchProxy 并配置可用代理地址（如 http://127.0.0.1:7890），或将 *.duckduckgo.com 加入代理白名单'
        };
    }

    const results = parseDuckDuckGoResults(html, maxResults);

    if (results.length === 0) {
        return {
            success: true,
            query: trimmedQuery,
            total_results: 0,
            results: [],
            message: '未找到相关结果，请尝试更换关键词'
        };
    }

    logger.info(`[搜索工具] 搜索完成: "${trimmedQuery}" | 找到${results.length}条结果`);

    return {
        success: true,
        query: trimmedQuery,
        total_results: results.length,
        results: results
    };
}

/**
 * 校验并限制最大结果数
 * @param {number|null|undefined} value - 用户传入的值
 * @returns {number} 修正后的结果数量
 */
function clampMaxResults(value) {
    if (!Number.isInteger(value) || value <= 0) {
        return DEFAULT_MAX_RESULTS;
    }
    return Math.min(value, MAX_RESULTS_LIMIT);
}

/**
 * 请求 DuckDuckGo HTML 接口获取搜索结果页面
 * 通过项目封装的 request 模块发起，自动遵循 proxy.yaml 的代理配置
 * @param {string} query - 搜索关键词
 * @returns {Promise<string|null>} HTML 内容，失败返回 null
 */
async function fetchDuckDuckGoHtml(query) {
    const requestUrl = `${DDG_HTML_ENDPOINT}?q=${encodeURIComponent(query)}&kl=cn-zh`;

    try {
        const html = await request.get(requestUrl, {
            headers: {
                'User-Agent': BROWSER_UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Referer': 'https://duckduckgo.com/'
            },
            responseType: 'text',
            closeCheckStatus: false,
            outErrorLog: false
        });

        if (!html || typeof html !== 'string') {
            logger.warn('[搜索工具] DuckDuckGo 返回空内容');
            return null;
        }

        return html;
    } catch (error) {
        const msg = error?.message || String(error);
        logger.warn(`[搜索工具] DuckDuckGo 请求失败: ${msg}`);
        return null;
    }
}

/**
 * 解析 DuckDuckGo HTML 结果页
 * 采用流式聚合：按出现顺序匹配 result__a 和 result__snippet，
 * 遇到 result__a 即开启新结果，遇到 result__snippet 则填入当前结果的摘要。
 * 无论是否有外层 <div class="result"> 包裹都能正确工作，
 * 即使某条缺 snippet 也不会跨越到下一个结果的 snippet
 * @param {string} html - HTML 内容
 * @param {number} maxResults - 最大返回结果数
 * @returns {Array<object>} 解析出的搜索结果列表
 */
function parseDuckDuckGoResults(html, maxResults) {
    const results = [];

    // 第一步：匹配所有 <a class="result__a|result__snippet" ...>...</a> 标签
    // 仅捕获类型与完整属性段，href 留待第二步提取，避免 [^>]* 贪婪吃掉 href 属性
    const tagRegex = /<a([^>]*)class="[^"]*result__(a|snippet)[^"]*"([^>]*)>([\s\S]*?)<\/a>/g;
    const hrefRegex = /\bhref\s*=\s*"([^"]+)"/i;

    let current = null;
    let tagMatch;
    while ((tagMatch = tagRegex.exec(html)) !== null) {
        const attrsBefore = tagMatch[1] || '';
        const kind = tagMatch[2];
        const attrsAfter = tagMatch[3] || '';
        const innerHtml = tagMatch[4];

        if (kind === 'a') {
            if (results.length >= maxResults) {
                break;
            }
            const hrefMatch = hrefRegex.exec(attrsBefore + ' ' + attrsAfter);
            const href = hrefMatch ? hrefMatch[1] : '';
            const url = extractRealUrl(href);
            const title = cleanHtmlText(innerHtml);
            if (!title || !url) {
                current = null;
                continue;
            }
            current = { title, url, snippet: '' };
            results.push(current);
        } else if (kind === 'snippet') {
            if (current && !current.snippet) {
                current.snippet = cleanHtmlText(innerHtml);
            }
        }
    }

    return results;
}

/**
 * 从 DuckDuckGo 跳转链接中提取真实 URL
 * 跳转链接格式：//duckduckgo.com/l/?uddg=<编码URL>&rut=...
 * 也兼容直接出现的真实 URL（某些场景下 DuckDuckGo 不做跳转）
 * @param {string} rawUrl - 原始 href
 * @returns {string} 真实 URL，解析失败时返回空字符串
 */
function extractRealUrl(rawUrl) {
    if (!rawUrl) {
        return '';
    }

    try {
        let url = rawUrl;

        if (url.startsWith('//')) {
            url = 'https:' + url;
        }

        const parsed = new URL(url);
        const uddg = parsed.searchParams.get('uddg');
        if (uddg) {
            return uddg;
        }

        if (parsed.hostname.includes('duckduckgo.com')) {
            return '';
        }

        return parsed.href;
    } catch {
        return '';
    }
}

/**
 * 清理 HTML 标签和实体，提取纯文本
 * @param {string} html - 含 HTML 标签的字符串
 * @returns {string} 纯文本
 */
function cleanHtmlText(html) {
    if (!html) {
        return '';
    }

    return html
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * 联网搜索工具名称列表
 */
export const SEARCH_TOOLS = ['web_search'];

/**
 * 内部函数导出，仅供单元测试使用，不应在业务代码中调用
 * @internal
 */
export const __test__ = {
    parseDuckDuckGoResults,
    cleanHtmlText,
    extractRealUrl,
    clampMaxResults
};
