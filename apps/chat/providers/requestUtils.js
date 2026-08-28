/**
 * Provider层共享请求工具
 * 手写provider（anthropic/gemini/tencent）共用的fetch封装与信号合并
 */

import fetch from 'node-fetch';

/** 默认请求超时（毫秒） */
const DEFAULT_TIMEOUT_MS = 120000;

/**
 * 合并外部中止信号与超时信号
 * 超时或外部任一触发即中止，dispose后清理定时器避免泄漏
 * @param {AbortSignal} [externalSignal] - 外部中止信号
 * @param {number} [timeoutMs=120000] - 超时毫秒数
 * @returns {{ mergedSignal: AbortSignal, dispose: Function }} 合并信号与清理函数
 */
export function mergeSignal(externalSignal, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
        controller.abort(new Error(`请求超时（${timeoutMs}ms）`));
    }, timeoutMs);

    const onExternalAbort = () => controller.abort(externalSignal?.reason);
    if (externalSignal) {
        if (externalSignal.aborted) {
            controller.abort(externalSignal.reason);
        } else {
            externalSignal.addEventListener('abort', onExternalAbort, { once: true });
        }
    }

    return {
        mergedSignal: controller.signal,
        dispose() {
            clearTimeout(timer);
            if (externalSignal) {
                externalSignal.removeEventListener('abort', onExternalAbort);
            }
        }
    };
}

/**
 * 发起JSON POST请求并解析响应
 * 非JSON响应与错误状态码统一抛错（错误对象带status与errorData供parseError消费）
 * @param {string} url - 请求地址
 * @param {Object} options - fetch选项（method/headers/body/signal）
 * @returns {Promise<Object>} 解析后的JSON响应
 * @throws {Error} 含status（HTTP状态码）与errorData（响应体JSON）的错误
 */
export async function fetchJson(url, options) {
    let response;
    try {
        response = await fetch(url, options);
    } catch (err) {
        // 网络层错误（DNS/连接拒绝/中止）：透传AbortError的reason
        const error = new Error(err?.message || String(err));
        error.code = 'network';
        throw error;
    }

    const text = await response.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = null;
    }

    if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.errorData = data;
        throw error;
    }

    if (data === null) {
        const error = new Error('响应不是有效JSON');
        error.code = 'invalid_response';
        throw error;
    }
    return data;
}
