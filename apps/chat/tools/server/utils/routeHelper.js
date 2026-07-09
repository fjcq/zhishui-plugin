/**
 * 路由辅助工具
 * 提供统一响应格式、参数校验、错误处理
 */

/**
 * 成功响应
 * @param {*} data - 响应数据
 * @param {string} message - 响应消息
 * @returns {object} 标准响应对象
 */
export function successResponse(data = null, message = 'success') {
    return { code: 200, message, data };
}

/**
 * 错误响应
 * @param {string} message - 错误消息
 * @param {number} code - 错误码
 * @returns {object} 标准响应对象
 */
export function errorResponse(message, code = 400) {
    return { code, message, data: null };
}

/**
 * 处理异步路由处理器
 * 自动捕获异常并返回标准错误响应
 * @param {Function} handler - 异步处理器
 * @returns {Function} 包装后的处理器
 */
export function asyncHandler(handler) {
    return async (req, res) => {
        try {
            await handler(req, res);
        } catch (error) {
            const msg = error.message || '内部错误';
            // 不暴露内部错误细节给外部
            res.status(500).json(errorResponse(`服务异常: ${msg}`, 500));
        }
    };
}

/**
 * 校验必填参数
 * @param {object} params - 参数对象
 * @param {Array<string>} required - 必填字段名列表
 * @returns {string|null} 第一个缺失字段描述，无缺失返回 null
 */
export function validateRequired(params, required) {
    for (const field of required) {
        const value = params[field];
        if (value === undefined || value === null || value === '') {
            return `参数错误: 缺少${field}`;
        }
    }
    return null;
}

/**
 * 从查询参数中提取数值并限制范围
 * @param {object} query - 查询参数对象
 * @param {string} field - 字段名
 * @param {number} defaultValue - 默认值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 处理后的数值
 */
export function clampNumber(query, field, defaultValue, min, max) {
    const raw = query[field];
    if (raw === undefined || raw === null || raw === '') return defaultValue;
    const num = parseInt(raw, 10);
    if (isNaN(num)) return defaultValue;
    return Math.min(Math.max(num, min), max);
}

export default {
    successResponse,
    errorResponse,
    asyncHandler,
    validateRequired,
    clampNumber
};
