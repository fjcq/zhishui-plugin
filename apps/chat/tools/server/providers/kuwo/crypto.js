/**
 * 酷我音乐签名/Token算法
 *
 * 来源：参考 kuwoMusicApi 开源项目及逆向资料
 *
 * 算法说明：
 * - 新版酷我使用 Cookie 字段 `Hm_Iuvt_cdb524f42f23cer9b268564v7y735ewrq2324` 作为 CSRF Token
 * - 该 Cookie 通过访问首页 https://www.kuwo.cn/ 时由 Set-Cookie 返回
 * - 请求头需携带 `Secret: <token>` 和 `Cookie: Hm_Iuvt_cdb524f42f23cer9b268564v7y735ewrq2324=<token>`
 * - token 在同一会话内基本稳定，建议缓存复用
 */

import cache from '../../utils/cache.js';

/** 酷我首页 */
const KUWO_HOME = 'https://www.kuwo.cn/';

/** 新版 CSRF Cookie 名称 */
const KUWO_CSRF_COOKIE = 'Hm_Iuvt_cdb524f42f23cer9b268564v7y735ewrq2324';

/** Token 缓存时间（秒），1小时 */
const TOKEN_CACHE_TTL = 3600;

/** Token 缓存键 */
const TOKEN_CACHE_KEY = 'kuwo:token';

/**
 * 从 Set-Cookie 字符串中提取 CSRF Token
 * @param {string|string[]} setCookie - Set-Cookie 头部值
 * @returns {string|null} token 或 null
 */
function extractKwToken(setCookie) {
    if (!setCookie) return null;

    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    for (const cookie of cookies) {
        const regex = new RegExp(`${KUWO_CSRF_COOKIE}=([^;]+)`);
        const match = cookie.match(regex);
        if (match) return match[1];
    }
    return null;
}

/**
 * 获取酷我 CSRF Token
 * 通过访问首页获取 Set-Cookie 中的 Hm_Iuvt cookie
 * @param {boolean} forceRefresh - 是否强制刷新
 * @returns {Promise<string|null>} token 或 null
 */
export async function getKuwoToken(forceRefresh = false) {
    if (!forceRefresh) {
        const cached = cache.get(TOKEN_CACHE_KEY);
        if (cached) return cached;
    }

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(KUWO_HOME, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });

        clearTimeout(timer);

        if (!response.ok) return null;

        // Node fetch 可读取 set-cookie 头部
        const setCookie = response.headers.get('set-cookie');
        const token = extractKwToken(setCookie);

        if (token) {
            cache.set(TOKEN_CACHE_KEY, token, TOKEN_CACHE_TTL);
        }
        return token;
    } catch (error) {
        return null;
    }
}

/**
 * 构造酷我请求头
 * @param {string} token - CSRF token
 * @returns {object} 请求头对象
 */
export function buildKuwoHeaders(token) {
    return {
        'Referer': 'https://www.kuwo.cn/',
        'Secret': token || '',
        'Cookie': `${KUWO_CSRF_COOKIE}=${token || ''}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
}

export default {
    getKuwoToken,
    buildKuwoHeaders
};
