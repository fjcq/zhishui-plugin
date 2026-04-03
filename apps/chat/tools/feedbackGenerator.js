/**
 * 工具反馈模块
 * 工具只返回执行结果，AI自己决定如何回复
 */

/**
 * 生成工具调用的反馈
 * @param {string} toolName - 工具名称
 * @param {object} result - 工具执行结果
 * @param {object} params - 工具参数
 * @param {object} context - 上下文信息
 * @returns {Promise<string>} 反馈内容（空字符串，让AI自己决定）
 */
export async function generateToolFeedback(toolName, result, params = {}, context = {}) {
    return '';
}

/**
 * 生成拒绝操作的反馈
 * @param {string} reason - 拒绝原因类型
 * @param {object} context - 上下文信息
 * @returns {Promise<string>} 拒绝原因描述
 */
export async function generateDenyFeedback(reason, context = {}) {
    const REASON_MAP = {
        low_favor: '好感度不足',
        not_master: '需要主人权限',
        need_reason: '需要提供理由',
        self_protection: '不能对自己执行此操作',
        target_admin: '不能对管理员执行此操作',
        unknown_user: '用户不存在或未知'
    };
    return REASON_MAP[reason] || '无法执行此操作';
}

/**
 * 生成需要确认的反馈
 * @param {string} action - 操作描述
 * @param {object} context - 上下文信息
 * @returns {string} 确认反馈（空字符串，让AI自己决定）
 */
export function generateConfirmFeedback(action, context = {}) {
    return '';
}

/**
 * 判断是否应该显示反馈
 * @param {string} toolName - 工具名称
 * @param {object} result - 工具结果
 * @returns {boolean} 是否显示反馈
 */
export function shouldShowFeedback(toolName, result) {
    return false;
}
