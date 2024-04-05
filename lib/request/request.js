import fetch from 'node-fetch'
import { Config, Plugin_Path } from '../../components/index.js'
import { Agent } from 'https'
import { HttpsProxyAgent } from './httpsProxyAgentMod.js'
import _ from 'lodash'

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const POSTMAN_UA = 'PostmanRuntime/7.29.0'

class HTTPResponseError extends Error {
    constructor(response) {
        super(`HTTP Error Response: ${response.status} ${response.statusText}`)
        this.response = response
    }
}

const checkStatus = response => {
    if (response.ok) {
        // response.status >= 200 && response.status < 300
        return response
    } else {
        throw new HTTPResponseError(response)
    }
}

export const qs = (obj) => {
    let res = ''
    for (const [k, v] of Object.entries(obj)) { res += `${k}=${encodeURIComponent(v)}&` }
    return res.slice(0, res.length - 1)
}

export default new class {
    /**
     * 发送HTTP GET请求并返回响应
     * @async
     * @function
     * @param {string} url - 请求的URL
     * @param {import('node-fetch').RequestInit} [options={}] - 请求的配置项
     * @param {Object} [options.params] - 请求的参数
     * @param {Object} [options.headers] - 请求的HTTP头部
     * @param {boolean} [options.closeCheckStatus=false] - 是否关闭状态检查
     * @param {'buffer'|'json'|'text'|'arrayBuffer'|'formData'|'blob'}[options.statusCode] - 期望的返回数据，如果设置了该值，则返回响应数据的特定的方法（如json()、text()等）
     * @returns {Promise<Response|*>} - HTTP响应或响应数据
     * @throws {Error} - 如果请求失败，则抛出错误
     */
    async get(url, options = {}) {
        const mergedOptions = {
            headers: {
                'User-Agent': CHROME_UA,
                ...options.headers,
            },
        };

        if (options.params) {
            url += '?' + qs(options.params);
        }

        logger.debug(`[止水插件] GET请求：${decodeURI(url)}`);

        // 若 options.agent 未定义，尝试从外部获取（例如：this.getAgent()）
        // 注意：此处假设外部环境提供了合适的代理方法来获取agent
        if (!mergedOptions.agent) mergedOptions.agent = getAgent();

        try {
            const res = await fetch(url, mergedOptions);

            if (!options.skipCheckStatus) {
                await checkStatus(res);
            }

            return getResponseData(res, options.responseType);
        } catch (err) {
            logger.error(err);
            throw new Error(`GET请求发送失败，原因：${err.message}`);
        }
    }

    /**
    * 发送HTTP POST请求并返回响应
    * @async
    * @function
    * @param {string} url - 请求的URL
    * @param {import('node-fetch').RequestInit} [options={}] - 请求的配置项
    * @param {Object} [options.params] - 请求的参数
    * @param {Object} [options.headers] - 请求的HTTP头部
    * @param {Object} [options.data] - 请求的数据
    * @param {boolean} [options.skipCheckStatus=false] - 是否跳过状态检查
    * @param {'buffer'|'json'|'text'|'arrayBuffer'|'formData'|'blob'} [options.responseType] - 期望的响应数据类型，若设置，将调用相应方法解析响应数据
    * @returns {Promise<*>} - 解析后的响应数据或原始响应对象
    * @throws {Error} - 如果请求失败，则抛出错误
    */
    async post(url, options = {}) {
        const mergedOptions = {
            method: 'POST',
            headers: {
                'User-Agent': CHROME_UA,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        };

        if (options.params) {
            url += '?' + qs(options.params);
        }

        console.log(`[止水插件] POST请求：${decodeURI(url)}`);

        if (options.data) {
            if (/json/i.test(mergedOptions.headers['Content-Type'])) {
                mergedOptions.body = JSON.stringify(options.data);
            } else if (
                /x-www-form-urlencoded/i.test(mergedOptions.headers['Content-Type'])
            ) {
                mergedOptions.body = qs(options.data);
            } else {
                mergedOptions.body = options.data;
            }
        }

        try {
            const res = await fetch(url, mergedOptions);

            if (!options.skipCheckStatus) {
                await checkStatus(res);
            }

            return getResponseData(res, options.responseType);
        } catch (err) {
            logger.error(err);
            throw new Error(`请求发送失败，原因：${err.message}`);
        }
    }

    /**
     * @description: 绕cf Get请求
     * @param {String} url
     * @param {Object} options 同fetch第二参数
     * @param {Object} options.params 请求参数
     * @return {FetchObject}
     */
    async cfGet(url, options = {}) {
        options.agent = this.getAgent(true)
        options.headers = {
            'User-Agent': POSTMAN_UA,
            ...options.headers
        }
        return this.get(url, options)
    }

    /**
     * @description: 绕cf Post请求
     * @param {String} url
     * @param {Object} options 同fetch第二参数
     * @param {Object|String} options.data 请求参数
     * @return {FetchObject}
     */
    async cfPost(url, options = {}) {
        options.agent = this.getAgent(true)
        options.headers = {
            'User-Agent': POSTMAN_UA,
            ...options.headers
        }
        return this.post(url, options)
    }

    getAgent(cf) {
        let { proxyAddress, switchProxy } = Config.proxy
        let { cfTLSVersion } = Config.SearchVideos
        return cf
            ? this.getTlsVersionAgent(proxyAddress, cfTLSVersion)
            : switchProxy
                ? new HttpsProxyAgent(proxyAddress)
                : false
    }

    /**
     * 从代理字符串获取指定 TLS 版本的代理
     * @param {string} str
     * @param {import('tls').SecureVersion} tlsVersion
     */
    getTlsVersionAgent(str, tlsVersion) {
        const tlsOpts = {
            maxVersion: tlsVersion,
            minVersion: tlsVersion
        }
        if (typeof str === 'string') {
            const isHttp = str.startsWith('http')
            if (isHttp && Config.proxy.switchProxy) {
                const opts = {
                    ..._.pick(new URL(str), [
                        'protocol',
                        'hostname',
                        'port',
                        'username',
                        'password'
                    ]),
                    tls: tlsOpts
                }
                return new HttpsProxyAgent(opts)
            }
        }
        return new Agent(tlsOpts)
    }

    /**
     * @description: 代理请求图片
     * @param {String} url 图片链接
     * @param {Boolean} cache 是否缓存
     * @param {Number} timeout 超时时间
     * @param {Object} headers 请求头
     * @return {Porimes<import('icqq').ImageElem>} 构造图片消息
     */
    async proxyRequestImg(url, { cache, timeout, headers } = {}) {
        if (!this.getAgent()) return segment.image(url, cache, timeout, headers)
        let Request = await this.get(url, {
            headers
        }).catch(err => logger.error(err))
        return segment.image(Request?.body ?? `${Plugin_Path}/resoures/img/imgerror.png`, cache, timeout)
    }
}()

/**
 * 获取并解析响应数据
 * @param {Response} response - 响应对象
 * @param {'buffer'|'json'|'text'|'arrayBuffer'|'formData'|'blob'} [responseType] - 期望的响应数据类型
 * @returns {*} - 解析后的响应数据
 */
function getResponseData(response, responseType) {
    if (!responseType) return response;

    switch (responseType) {
        case 'json':
            return response.json();
        case 'text':
            return response.text();
        case 'arrayBuffer':
            return response.arrayBuffer();
        case 'formData':
            return response.formData();
        case 'blob':
            return response.blob();
        default:
            throw new Error('未知的响应数据类型');
    }
}