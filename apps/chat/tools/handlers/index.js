/**
 * 工具处理函数汇总入口
 * 导出所有工具处理函数
 */

import { handleFavorToolCall } from './favorHandler.js';
import { handleFriendToolCall } from './friendHandler.js';
import { handleGroupToolCall } from './groupHandler.js';
import { handleInteractToolCall } from './interactHandler.js';
import { handleMemoryToolCall } from './memoryHandler.js';
import { handleCodeToolCall } from './codeHandler.js';
import { handleMessageToolCall, MESSAGE_TOOLS as NEW_MESSAGE_TOOLS } from './messageHandler.js';
import { handleSearchToolCall, SEARCH_TOOLS } from './searchHandler.js';
import { handleVideoToolCall, VIDEO_TOOLS } from './videoHandler.js';
import { handleImageToolCall, IMAGE_TOOLS } from './imageHandler.js';
import { handleImageEditToolCall, EDIT_IMAGE_TOOLS } from './imageEditHandler.js';
import { makeDecision, DecisionResult } from '../decisionEngine.js';
import { getToolSensitivity, isToolCallingEnabled, isToolEnabled } from '../definitions/index.js';
import { getUserFavor } from '../../user/index.js';
import { generateDenyFeedback } from '../feedbackGenerator.js';
import { logger } from '../../../../components/index.js';

/**
 * 群管理工具名称列表
 */
const GROUP_TOOLS = [
    'get_group_list',
    'get_group_info',
    'mute_group_member',
    'set_group_card',
    'set_group_title',
    'kick_group_member',
    'delete_message',
    'set_group_name',
    'set_group_announcement'
];

/**
 * 音乐工具名称列表
 */
const MUSIC_TOOLS = [
    'search_music',
    'play_music',
    'get_lyrics',
    'get_playlist'
];

/**
 * 消息工具名称列表（旧版，保留兼容）
 */
const MESSAGE_TOOLS_LEGACY = [
    'send_image',
    'send_voice',
    'send_private_message',
    'forward_message',
    'set_essence_message'
];

/**
 * 消息工具名称列表（新版）
 */
const MESSAGE_TOOLS = [
    ...MESSAGE_TOOLS_LEGACY,
    ...NEW_MESSAGE_TOOLS
];

/**
 * 互动工具名称列表
 */
const INTERACT_TOOLS = [
    'poke_user',
    'generate_meme'
];

/**
 * 互动类工具集合（包含互动、音乐、消息工具）
 * 用于快速判断工具是否由 handleInteractToolCall 处理
 */
const INTERACT_HANDLER_TOOLS = new Set([
    ...INTERACT_TOOLS,
    ...MUSIC_TOOLS,
    ...MESSAGE_TOOLS
]);

/**
 * 记忆工具名称列表
 */
const MEMORY_TOOLS = [
    'remember_user_info',
    'recall_user_info',
    'forget_user_info',
    'set_reminder',
    'get_reminders',
    'cancel_reminder',
    'record_interaction',
    'get_interaction_history'
];

/**
 * 好感度工具名称列表
 */
const FAVOR_TOOLS = [
    'change_user_favor',
    'get_user_favor',
    'set_user_favor',
    'get_user_info',
    'get_user_profile',
    'get_group_members'
];

/**
 * 好友工具名称列表
 */
const FRIEND_TOOLS = [
    'get_friend_list',
    'get_friend_info'
];

/**
 * 输出工具名称列表
 */
const OUTPUT_TOOLS = [
    'output_code'
];

/**
 * 联网搜索工具名称列表
 */
const SEARCH_TOOLS_LIST = SEARCH_TOOLS;

/**
 * 搜剧工具名称列表
 */
const VIDEO_TOOLS_LIST = VIDEO_TOOLS;

/**
 * 生图工具名称列表
 */
const IMAGE_TOOLS_LIST = IMAGE_TOOLS;

/**
 * 需要决策判断的工具列表
 */
const TOOLS_NEED_DECISION = [
    ...GROUP_TOOLS,
    'set_user_favor'
];

/**
 * 技术性错误关键词正则列表
 * 用于检测 error_message 中是否含有技术细节，需要自然化过滤
 */
const TECH_ERROR_PATTERNS = [
    /ApiKey|API\s*Key|api_key|SecretKey/i,
    /\.yaml|\.json|配置文件|锅巴面板/i,
    /\b(401|403|404|500|502|503)\b/,
    /https?:\/\//i,
    /[A-Z]:\\|\/[a-z_-]+\//i,
    /工具\s*\w+|调用工具|执行操作|启动模块/i,
    /未配置|未连接|未启用/i,
    /TypeError|ReferenceError|SyntaxError|RangeError/i,
    /is not a function|is not defined|is null|is undefined/i,
    /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET/i,
    /segment|oicq|icqq|NapCatQQ|PacketBackend/i,
    /参数格式错误|参数解析失败|JSON parse/i
];

/**
 * 将技术性 error_message 过滤为自然语言
 * 保留已经是自然语言的 error_message（如 decision_denied 等业务反馈）
 * @param {string} message - 原始 error_message
 * @param {string} toolName - 工具名称（用于日志）
 * @returns {string} 过滤后的自然语言错误信息
 */
function sanitizeToolErrorMessage(message, toolName) {
    if (!message) {
        return '暂时做不到，请稍后再试';
    }

    // 检测是否含技术细节
    const hasTech = TECH_ERROR_PATTERNS.some(p => p.test(message));
    if (hasTech) {
        logger.debug(`[工具调用] ${toolName} error_message 含技术细节，已过滤 | 原始: ${message}`);
        return '暂时做不到，请稍后再试';
    }

    return message;
}

/**
 * 对工具返回结果做自然化过滤
 * 跳过 natural_feedback=true 的业务反馈（如好感度不足等已是自然语言的反馈）
 * @param {object} result - 工具执行结果
 * @param {string} toolName - 工具名称
 * @returns {object} 过滤后的结果
 */
function sanitizeToolResult(result, toolName) {
    if (!result || !result.error) {
        return result;
    }

    // 已标记为自然反馈的不过滤
    if (result.natural_feedback) {
        return result;
    }

    // 对 error_message 做自然化过滤
    if (result.error_message) {
        result.error_message = sanitizeToolErrorMessage(result.error_message, toolName);
    }

    return result;
}

/**
 * 统一的工具调用处理入口
 * 出口处对 error_message 做自然化过滤，避免技术细节暴露给 AI
 * @param {string} toolName - 工具名称
 * @param {object} toolParams - 工具参数
 * @param {object} e - 事件对象
 * @param {string} currentUserId - 当前对话用户ID
 * @returns {Promise<object>} 工具执行结果
 */
export async function handleToolCall(toolName, toolParams, e = null, currentUserId = null) {
    const result = await _handleToolCallImpl(toolName, toolParams, e, currentUserId);
    return sanitizeToolResult(result, toolName);
}

/**
 * 工具调用内部实现
 * @param {string} toolName - 工具名称
 * @param {object} toolParams - 工具参数
 * @param {object} e - 事件对象
 * @param {string} currentUserId - 当前对话用户ID
 * @returns {Promise<object>} 工具执行结果
 */
async function _handleToolCallImpl(toolName, toolParams, e = null, currentUserId = null) {
    logger.info(`[工具调用] 开始执行: ${toolName} | 参数: ${JSON.stringify(toolParams)}`);

    if (!isToolCallingEnabled()) {
        logger.warn(`[工具调用] 全局开关已关闭，拒绝执行: ${toolName}`);
        return {
            error: true,
            disabled: true,
            error_message: '工具调用功能已禁用'
        };
    }

    if (!isToolEnabled(toolName)) {
        logger.warn(`[工具调用] 工具已禁用，拒绝执行: ${toolName}`);
        return {
            error: true,
            disabled: true,
            error_message: `工具 ${toolName} 已禁用`
        };
    }

    try {
        const params = { ...toolParams };

        autoFillParams(toolName, params, e, currentUserId);

        const sensitivity = getToolSensitivity(toolName);

        if (TOOLS_NEED_DECISION.includes(toolName) || sensitivity >= 2) {
            const requesterFavor = currentUserId ? await getUserFavor(currentUserId) : 0;

            const decision = await makeDecision(toolName, params, {
                e,
                currentUserId,
                requesterFavor
            });

            if (decision.result === DecisionResult.DENY) {
                logger.info(`[工具决策] 拒绝执行 ${toolName}: ${decision.suggestedAction}`);
                const naturalFeedback = await generateDenyFeedback(decision.reason);
                return {
                    error: true,
                    decision_denied: true,
                    error_message: naturalFeedback,
                    suggested_action: decision.suggestedAction,
                    natural_feedback: true
                };
            }

            if (decision.result === DecisionResult.NEED_REASON) {
                logger.info(`[工具决策] 需要理由 ${toolName}`);
                const naturalFeedback = await generateDenyFeedback(decision.reason);
                return {
                    error: true,
                    need_reason: true,
                    error_message: naturalFeedback,
                    suggested_action: decision.suggestedAction,
                    natural_feedback: true
                };
            }

            if (decision.result === DecisionResult.NEED_CONFIRM) {
                logger.info(`[工具决策] 需要确认 ${toolName}`);
                return {
                    error: true,
                    need_confirm: true,
                    error_message: decision.reason,
                    suggested_action: decision.suggestedAction,
                    max_allowed_duration: decision.maxAllowedDuration,
                    natural_feedback: true
                };
            }

            if (decision.maxAllowedDuration && params.duration > decision.maxAllowedDuration) {
                params.duration = decision.maxAllowedDuration;
                logger.info(`[工具决策] 限制禁言时长为 ${decision.maxAllowedDuration} 秒`);
            }
        }

        if (FAVOR_TOOLS.includes(toolName)) {
            const result = await handleFavorToolCall(toolName, params, e, currentUserId);
            logToolResult(toolName, result);
            return result;
        }

        if (FRIEND_TOOLS.includes(toolName)) {
            const result = await handleFriendToolCall(toolName, params, e);
            logToolResult(toolName, result);
            return result;
        }

        if (GROUP_TOOLS.includes(toolName)) {
            const result = await handleGroupToolCall(toolName, params, e);
            logToolResult(toolName, result);
            return result;
        }

        if (NEW_MESSAGE_TOOLS.includes(toolName)) {
            const result = await handleMessageToolCall(toolName, params, e, currentUserId);
            logToolResult(toolName, result);
            return result;
        }

        if (INTERACT_HANDLER_TOOLS.has(toolName)) {
            const result = await handleInteractToolCall(toolName, params, e, currentUserId);
            logToolResult(toolName, result);
            return result;
        }

        if (MEMORY_TOOLS.includes(toolName)) {
            const result = await handleMemoryToolCall(toolName, params, currentUserId);
            logToolResult(toolName, result);
            return result;
        }

        if (OUTPUT_TOOLS.includes(toolName)) {
            const result = await handleCodeToolCall(toolName, params, e);
            logToolResult(toolName, result);
            return result;
        }

        if (SEARCH_TOOLS_LIST.includes(toolName)) {
            const result = await handleSearchToolCall(toolName, params);
            logToolResult(toolName, result);
            return result;
        }

        if (VIDEO_TOOLS_LIST.includes(toolName)) {
            const result = await handleVideoToolCall(toolName, params, e, currentUserId);
            logToolResult(toolName, result);
            return result;
        }

        if (IMAGE_TOOLS_LIST.includes(toolName)) {
            const result = await handleImageToolCall(toolName, params, e, currentUserId);
            logToolResult(toolName, result);
            return result;
        }

        if (EDIT_IMAGE_TOOLS.includes(toolName)) {
            const result = await handleImageEditToolCall(toolName, params, e, currentUserId);
            logToolResult(toolName, result);
            return result;
        }

        return {
            error: true,
            error_message: `未知的工具: ${toolName}`
        };
    } catch (error) {
        logger.error(`[工具调用] ${toolName} 异常: ${error.message}`);
        return {
            error: true,
            error_message: `工具执行失败: ${error.message}`
        };
    }
}

/**
 * 输出工具执行结果日志
 * @param {string} toolName - 工具名称
 * @param {object} result - 执行结果
 */
function logToolResult(toolName, result) {
    if (result.error) {
        logger.warn(`[工具调用] ${toolName} 失败: ${result.error_message || '未知错误'}`);
    } else {
        const resultSummary = JSON.stringify(result).substring(0, 200);
        logger.info(`[工具调用] ${toolName}: 成功 | 结果: ${resultSummary}`);
    }
}

/**
 * 自动填充参数
 * @param {string} toolName - 工具名称
 * @param {object} params - 参数对象
 * @param {object} e - 事件对象
 * @param {string} currentUserId - 当前用户ID
 */
function autoFillParams(toolName, params, e, currentUserId) {
    const toolsNeedUserId = [
        ...FAVOR_TOOLS,
        'poke_user',
        'remember_user_info',
        'recall_user_info',
        'forget_user_info',
        'set_reminder',
        'get_reminders',
        'record_interaction',
        'get_interaction_history'
    ];

    if (toolsNeedUserId.includes(toolName) && !params.user_id) {
        if (currentUserId) {
            params.user_id = currentUserId;
        } else if (e && e.user_id) {
            params.user_id = String(e.user_id);
        }
    }

    const toolsNeedGroupId = [
        'get_group_info',
        'get_group_members',
        'get_user_profile'
    ];

    if (toolsNeedGroupId.includes(toolName) && params.group_id === undefined) {
        if (e && e.group_id) {
            params.group_id = String(e.group_id);
        } else {
            params.group_id = '';
        }
    }
}

export {
    handleFavorToolCall,
    handleFriendToolCall,
    handleGroupToolCall,
    handleInteractToolCall,
    handleMemoryToolCall,
    handleCodeToolCall,
    handleMessageToolCall,
    handleSearchToolCall,
    handleVideoToolCall,
    handleImageToolCall,
    handleImageEditToolCall,
    GROUP_TOOLS,
    MUSIC_TOOLS,
    MESSAGE_TOOLS,
    INTERACT_TOOLS,
    MEMORY_TOOLS,
    FAVOR_TOOLS,
    FRIEND_TOOLS,
    OUTPUT_TOOLS,
    SEARCH_TOOLS_LIST,
    VIDEO_TOOLS_LIST,
    IMAGE_TOOLS_LIST
};
