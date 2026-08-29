/**
 * 联网搜索工具处理函数
 * 处理AI调用的网络搜索相关工具
 * 主引擎使用必应（Bing）网页接口，国内网络可直连，无需 API Key 与代理
 * 备用引擎为 DuckDuckGo HTML 接口（国内需代理，海外服务器可用）
 * 通过项目封装的 request 模块发起请求，自动遵循 proxy.yaml 代理配置
 */

import request from '../../../../lib/request/request.js';
import { logger } from '../../../../components/index.js';

/** 必应网页搜索接口地址（国内可直连） */
const BING_SEARCH_ENDPOINT = 'https://www.bing.com/search';

/** DuckDuckGo HTML 搜索接口地址（备用引擎，国内需代理） */
const DDG_HTML_ENDPOINT = 'https://html.duckduckgo.com/html/';

/** 浏览器 User-Agent，避免被识别为爬虫 */
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** 默认返回结果数量 */
const DEFAULT_MAX_RESULTS = 5;

/** 返回结果数量上限 */
const MAX_RESULTS_LIMIT = 10;

/** 网页正文最大返回字符数，超出部分截断 */
const MAX_PAGE_CONTENT_LENGTH = 6000;

/** 网页原始内容字节上限，超过则仅处理前一部分 */
const MAX_HTML_BYTES = 3 * 1024 * 1024;

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
            case 'read_web_page':
                return await handleReadWebPage(params);
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

    // 主引擎：必应，国内网络可直连
    let results = [];
    const bingHtml = await fetchBingHtml(trimmedQuery);
    if (bingHtml) {
        results = parseBingResults(bingHtml, maxResults);
    }

    // 备用引擎：DuckDuckGo（必应失败或无结果时尝试，国内需代理）
    if (results.length === 0) {
        logger.info('[搜索工具] 必应无可用结果，尝试 DuckDuckGo 备用引擎');
        const ddgHtml = await fetchDuckDuckGoHtml(trimmedQuery);
        if (ddgHtml) {
            results = parseDuckDuckGoResults(ddgHtml, maxResults);
        }
    }

    // 两个引擎均未取到结果时返回错误提示
    if (results.length === 0) {
        return {
            error: true,
            error_message: '必应与 DuckDuckGo 均未返回搜索结果。可能原因：网络不通、搜索引擎限流或关键词无匹配。请稍后重试或更换关键词'
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
 * 请求必应搜索接口获取结果数据
 * 优先请求 RSS 格式输出（format=rss），返回结构化 XML：
 * 无 HTML 推荐流污染、不受页面改版影响、无需复杂解析
 * 必应在国内网络可直连，无需代理与 API Key
 * @param {string} query - 搜索关键词
 * @returns {Promise<string|null>} 响应内容（RSS 或降级时的 HTML），失败返回 null
 */
async function fetchBingHtml(query) {
    const requestUrl = `${BING_SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}&format=rss&mkt=zh-CN&setlang=zh-hans`;

    try {
        const response = await request.get(requestUrl, {
            headers: {
                'User-Agent': BROWSER_UA,
                'Accept': 'application/rss+xml, application/xml, text/html;q=0.9, */*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Referer': 'https://www.bing.com/'
            },
            responseType: 'text',
            closeCheckStatus: false,
            outErrorLog: false
        });

        if (!response || typeof response !== 'string') {
            logger.warn('[搜索工具] 必应返回空内容');
            return null;
        }

        return response;
    } catch (error) {
        const msg = error?.message || String(error);
        logger.warn(`[搜索工具] 必应请求失败: ${msg}`);
        return null;
    }
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
 * 处理读取网页工具调用
 * 抓取指定 URL 的网页并提取正文文本，返回给 AI 阅读
 * @param {object} params - 工具参数
 * @param {string} params.url - 要读取的网页链接
 * @returns {Promise<object>} 读取结果
 */
async function handleReadWebPage(params) {
    const { url } = params;

    // 参数与协议校验，仅放行 http/https，防止 file:// 等协议读取本地文件
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
        return { error: true, error_message: '请提供要读取的网页链接' };
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(url.trim());
    } catch {
        return { error: true, error_message: '链接格式不正确，请检查后重试' };
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return { error: true, error_message: '仅支持 http 或 https 开头的网页链接' };
    }

    logger.info(`[搜索工具] 开始读取网页: ${parsedUrl.href}`);

    let buffer;
    try {
        buffer = await request.get(parsedUrl.href, {
            headers: {
                'User-Agent': BROWSER_UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
            },
            responseType: 'buffer',
            closeCheckStatus: false,
            outErrorLog: false
        });
    } catch (error) {
        const msg = error?.message || String(error);
        logger.warn(`[搜索工具] 网页请求失败: ${msg}`);
        return { error: true, error_message: '打不开这个网页，可能是网络问题或网站拒绝访问' };
    }

    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        return { error: true, error_message: '这个网页没有返回任何内容' };
    }

    // 过大的页面仅处理前一部分，避免内存与解析开销失控
    if (buffer.length > MAX_HTML_BYTES) {
        buffer = buffer.subarray(0, MAX_HTML_BYTES);
    }

    const html = decodeHtmlBuffer(buffer);
    const { title, text } = extractReadableText(html);

    if (!text) {
        return { error: true, error_message: '这个页面没有可读取的正文内容，可能是纯脚本渲染页面或文件下载链接' };
    }

    const truncated = text.length > MAX_PAGE_CONTENT_LENGTH;
    const content = truncated ? text.slice(0, MAX_PAGE_CONTENT_LENGTH) : text;

    logger.info(`[搜索工具] 网页读取完成: ${parsedUrl.href} | 标题: ${title || '(无)'} | 长度: ${content.length}${truncated ? '(已截断)' : ''}`);

    return {
        success: true,
        url: parsedUrl.href,
        title,
        content,
        truncated
    };
}

/**
 * 按编码探测结果解码网页字节流
 * 探测顺序：BOM 标记 → head 区域 meta charset 声明 → 默认 utf-8
 * 中文站点常见的 gbk/gb2312 由 TextDecoder（Node 内置 ICU）负责解码
 * @param {Buffer} buffer - 网页原始字节
 * @returns {string} 解码后的 HTML 字符串
 */
function decodeHtmlBuffer(buffer) {
    // UTF-8 BOM
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        return buffer.toString('utf-8', 3);
    }

    // UTF-16 BOM
    if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
        return safeDecode('utf-16le', buffer.subarray(2));
    }
    if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
        return safeDecode('utf-16be', buffer.subarray(2));
    }

    // 用 latin1 读取 head 区域可保持字节原样，确保 ASCII 形式的 meta 声明可被匹配
    const head = buffer.toString('latin1', 0, Math.min(buffer.length, 2048));
    const charsetMatch = head.match(/<meta[^>]+charset\s*=\s*["']?\s*([\w-]+)/i);
    let charset = charsetMatch ? charsetMatch[1].toLowerCase() : 'utf-8';

    // gb2312 是 gbk 的子集，统一交给 gbk 解码器以覆盖更多汉字
    if (charset === 'gb2312') {
        charset = 'gbk';
    }

    return safeDecode(charset, buffer);
}

/**
 * 安全调用 TextDecoder，编码不受支持时逐级降级
 * @param {string} charset - 编码名称
 * @param {Buffer} buffer - 待解码字节
 * @returns {string} 解码结果
 */
function safeDecode(charset, buffer) {
    try {
        return new TextDecoder(charset).decode(buffer);
    } catch {
        try {
            return new TextDecoder('gbk').decode(buffer);
        } catch {
            return buffer.toString('utf-8');
        }
    }
}

/**
 * 从 HTML 中提取标题与可读正文
 * 处理流程：移除脚本/样式/导航等噪音块 → 块级标签转换为换行 → 去标签并解码实体 → 规整空白
 * @param {string} html - HTML 内容
 * @returns {{title: string, text: string}} 标题与正文文本
 */
function extractReadableText(html) {
    let title = '';
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
        title = cleanHtmlText(titleMatch[1]);
    }

    let text = html
        // HTML 注释
        .replace(/<!--[\s\S]*?-->/g, '')
        // 标题标签整块移除，避免标题文本混入正文
        .replace(/<title[^>]*>[\s\S]*?<\/title\s*>/gi, '')
        // 脚本、样式等含内容的噪音标签整块移除
        .replace(/<(script|style|noscript|svg|iframe|template)[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
        // 导航、页脚、表单等结构性区块整块移除
        .replace(/<(nav|footer|header|aside|form|button|select|option)[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
        // 换行标签
        .replace(/<br\s*\/?>/gi, '\n')
        // 块级标签闭合转换为换行
        .replace(/<\/(p|div|li|tr|h[1-6]|blockquote|pre|section|article|ul|ol|dl|dd|dt|table|figure|figcaption)\s*>/gi, '\n')
        // 表格单元格之间以空格分隔
        .replace(/<(td|th)[^>]*>/gi, ' ')
        // 移除其余所有标签
        .replace(/<[^>]+>/g, '');

    text = decodeHtmlEntities(text)
        // 压缩行内空白
        .replace(/[ \t\f\v]+/g, ' ')
        // 清理行首尾空白
        .replace(/ *\n */g, '\n')
        // 三个以上连续换行压缩为两个
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return { title, text };
}

/**
 * 解析必应搜索响应
 * 响应为 RSS（含 <item> 节点）时走结构化解析；
 * 接口降级返回 HTML 结果页时，走 b_algo 区块解析
 * @param {string} content - RSS XML 或 HTML 内容
 * @param {number} maxResults - 最大返回结果数
 * @returns {Array<object>} 解析出的搜索结果列表
 */
function parseBingResults(content, maxResults) {
    if (/<item[\s>]/i.test(content)) {
        return parseBingRssResults(content, maxResults);
    }
    return parseBingHtmlResults(content, maxResults);
}

/**
 * 解析必应 RSS 输出
 * 每个 <item> 节点含 <title>、<link>、<description> 三个子节点，
 * 文本内容可能被 CDATA 包裹，链接中的 & 需解码实体
 * @param {string} xml - RSS XML 内容
 * @param {number} maxResults - 最大返回结果数
 * @returns {Array<object>} 解析出的搜索结果列表
 */
function parseBingRssResults(xml, maxResults) {
    const results = [];
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;

    let itemMatch;
    while ((itemMatch = itemRegex.exec(xml)) !== null) {
        if (results.length >= maxResults) {
            break;
        }

        const block = itemMatch[1];
        const rawTitle = extractXmlTag(block, 'title');
        const rawLink = extractXmlTag(block, 'link');
        if (!rawTitle || !rawLink) {
            continue;
        }

        const title = cleanHtmlText(stripCdata(rawTitle));
        const url = sanitizeBingUrl(stripCdata(rawLink).trim());
        if (!title || !url) {
            continue;
        }

        const snippet = cleanHtmlText(stripCdata(extractXmlTag(block, 'description')));

        results.push({ title, url, snippet });
    }

    return results;
}

/**
 * 提取 XML 节点的内部文本
 * @param {string} block - XML 片段
 * @param {string} tag - 节点名称
 * @returns {string} 节点内部文本，无匹配返回空字符串
 */
function extractXmlTag(block, tag) {
    const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return match ? match[1] : '';
}

/**
 * 剥离 XML CDATA 包裹
 * @param {string} text - 可能含 CDATA 包裹的文本
 * @returns {string} 剥离后的文本
 */
function stripCdata(text) {
    return text
        .replace(/^\s*<!\[CDATA\[/i, '')
        .replace(/\]\]>\s*$/i, '')
        .trim();
}

/**
 * 解析必应 HTML 结果页（RSS 不可用时的降级路径）
 * 必应每条结果为一个 <li class="b_algo"> 区块：
 * 标题位于区块内 <h2><a href="...">标题</a></h2>，摘要位于 b_caption 区块内的 <p>
 * 解析采用按 b_algo 起点切分区块的方式，不依赖完整闭合标签结构，
 * 区块内标题与摘要天然绑定，不会出现跨结果错位
 * @param {string} html - HTML 内容
 * @param {number} maxResults - 最大返回结果数
 * @returns {Array<object>} 解析出的搜索结果列表
 */
function parseBingHtmlResults(html, maxResults) {
    const results = [];

    // 以 b_algo 结果项起点切分页面，切分后每段对应一条结果的完整内容
    const blocks = html.split(/<li[^>]+class="[^"]*\bb_algo\b[^"]*"/i).slice(1);

    for (const block of blocks) {
        if (results.length >= maxResults) {
            break;
        }

        // 标题链接：区块内 <h2> 中的第一个 <a href="...">标题</a>
        const titleMatch = block.match(/<h2[^>]*>[\s\S]*?<a[^>]+href\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
        if (!titleMatch) {
            continue;
        }

        const url = sanitizeBingUrl(titleMatch[1]);
        const title = cleanHtmlText(titleMatch[2]);
        if (!title || !url) {
            continue;
        }

        // 摘要：优先 b_caption 区块内的 <p>，缺失时退化取区块内第一个 <p>
        const captionMatch = block.match(/class="[^"]*\bb_caption\b[^"]*"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
        const pMatch = captionMatch || block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
        const snippet = pMatch ? cleanHtmlText(pMatch[1]) : '';

        results.push({ title, url, snippet });
    }

    return results;
}

/**
 * 清洗必应结果链接
 * 剔除必应搜索页与 go.microsoft.com 跳转页等非目标站点链接，
 * 保留 learn.microsoft.com 等真实内容页
 * @param {string} rawUrl - 原始 href
 * @returns {string} 有效返回规范化的 URL，无效返回空字符串
 */
function sanitizeBingUrl(rawUrl) {
    if (!rawUrl) {
        return '';
    }

    try {
        // 先解码 HTML 实体（&amp; 等），避免拼出含实体的无效 URL
        let url = decodeHtmlEntities(rawUrl).trim();

        if (url.startsWith('//')) {
            url = 'https:' + url;
        }

        const parsed = new URL(url);

        // 过滤必应自身页面（搜索结果页、二级跳转页等）
        if (/(^|\.)bing\.com$/i.test(parsed.hostname)) {
            return '';
        }

        // 过滤微软通用跳转链接（真实内容页如 learn.microsoft.com 不受影响）
        if (parsed.hostname === 'go.microsoft.com') {
            return '';
        }

        return parsed.href;
    } catch {
        return '';
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
 * 解码 HTML 实体为对应字符
 * @param {string} text - 含 HTML 实体的字符串
 * @returns {string} 解码后的文本
 */
function decodeHtmlEntities(text) {
    if (!text) {
        return '';
    }

    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

/**
 * 清理 HTML 标签和实体，提取纯文本
 * 处理顺序：先移除标签再解码实体——若先解码，&lt; 等实体转为 < 后会被误认为标签而删除
 * @param {string} html - 含 HTML 标签的字符串
 * @returns {string} 纯文本
 */
function cleanHtmlText(html) {
    if (!html) {
        return '';
    }

    // 先移除标签，此时实体尚未解码不会被误删
    const stripped = html.replace(/<[^>]+>/g, '');

    return decodeHtmlEntities(stripped)
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * 联网搜索工具名称列表
 */
export const SEARCH_TOOLS = ['web_search', 'read_web_page'];

/**
 * 内部函数导出，仅供单元测试使用，不应在业务代码中调用
 * @internal
 */
export const __test__ = {
    parseBingResults,
    parseBingRssResults,
    sanitizeBingUrl,
    stripCdata,
    parseDuckDuckGoResults,
    cleanHtmlText,
    extractRealUrl,
    clampMaxResults,
    decodeHtmlBuffer,
    extractReadableText,
    decodeHtmlEntities
};
