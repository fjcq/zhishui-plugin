/**
 * 工具模块入口
 * 导出工具定义和处理函数
 */

// 导出所有工具定义（包含 getToolSensitivity）
export {
    allTools,
    favorTools,
    groupTools,
    interactTools,
    memoryTools,
    outputTools,
    toolsByCategory,
    getEnabledTools,
    isToolEnabled,
    getToolDefinition
} from './definitions/index.js';

// 导出工具处理函数
export { handleToolCall, handleFavorToolCall, handleGroupToolCall, handleInteractToolCall, handleMemoryToolCall } from './handlers/index.js';

// 导出权限控制模块
export {
    SENSITIVE_TOOLS,
    NEED_CONFIRM_TOOLS,
    MUTE_DURATION_LIMITS,
    checkToolPermission,
    isBotAdmin,
    isUserAdmin,
    isBotOwner,
    canOperateUser,
    validateMuteDuration,
    formatMuteDuration
} from './permissions.js';

// 导出决策引擎
export {
    makeDecision,
    DecisionResult,
    SensitivityLevel,
    generateDenyResponse,
    getDecisionPrompt
} from './decisionEngine.js';

// 导出自然反馈生成器
export {
    generateToolFeedback,
    generateDenyFeedback,
    generateConfirmFeedback,
    shouldShowFeedback
} from './feedbackGenerator.js';

// 从 definitions 导出 getToolSensitivity
export { getToolSensitivity } from './definitions/index.js';

// 兼容旧接口
export { favorTools as default } from './definitions/favorTools.js';
