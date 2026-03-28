/**
 * 工具定义汇总入口
 * 导出所有工具定义
 */

import { Config } from '../../../../components/index.js';
import { favorTools } from './favorTools.js';
import { friendTools } from './friendTools.js';
import { groupTools } from './groupTools.js';
import { interactTools } from './interactTools.js';
import { memoryTools } from './memoryTools.js';

/**
 * 敏感度等级（本地定义，避免循环依赖）
 */
const SensitivityLevel = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4
};

/**
 * 所有工具定义的集合
 */
export const allTools = [
    ...favorTools,
    ...friendTools,
    ...groupTools,
    ...interactTools,
    ...memoryTools
];

/**
 * 按类型分组的工具
 */
export const toolsByCategory = {
    favor: favorTools,
    friend: friendTools,
    group: groupTools,
    interact: interactTools,
    memory: memoryTools
};

/**
 * 工具名称到定义的映射
 */
const TOOL_NAME_MAP = new Map();
for (const tool of allTools) {
    if (tool.function?.name) {
        TOOL_NAME_MAP.set(tool.function.name, tool);
    }
}

/**
 * 获取工具配置
 * @returns {object} 工具配置对象
 */
function getToolsConfig() {
    try {
        return Config.getDefOrConfig('tools') || {};
    } catch {
        return {};
    }
}

/**
 * 检查工具调用是否全局启用
 * @param {object} toolsConfig - 工具配置
 * @returns {boolean} 是否启用
 */
export function isToolCallingEnabled(toolsConfig = null) {
    if (!toolsConfig) {
        toolsConfig = getToolsConfig();
    }

    const enabled = toolsConfig.EnableToolCalling === true;
    logger.info(`[工具定义] 全局开关状态: EnableToolCalling=${toolsConfig.EnableToolCalling}, 结果=${enabled}`);
    return enabled;
}

/**
 * 工具分类字段映射
 */
const TOOL_CATEGORY_FIELDS = [
    'favor_tools',
    'friend_tools',
    'group_tools',
    'interact_tools',
    'memory_tools'
];

/**
 * 从分类配置中获取所有启用的工具
 * @param {object} toolsConfig - 工具配置
 * @returns {Array} 启用的工具名称列表
 */
function getEnabledToolsFromCategories(toolsConfig) {
    const enabledTools = [];

    for (const field of TOOL_CATEGORY_FIELDS) {
        const tools = toolsConfig[field];
        if (Array.isArray(tools)) {
            enabledTools.push(...tools);
        }
    }

    return enabledTools;
}

/**
 * 检查工具是否启用
 * 支持两种配置格式：
 * 1. 新格式：按分类配置 (favor_tools, interact_tools 等)
 * 2. 旧格式：单一数组 (EnabledTools)
 * @param {string} toolName - 工具名称
 * @param {object} toolsConfig - 工具配置对象
 * @returns {boolean} 是否启用
 */
export function isToolEnabled(toolName, toolsConfig = null) {
    if (!toolsConfig) {
        toolsConfig = getToolsConfig();
    }

    const enabledTools = getEnabledToolsFromCategories(toolsConfig);

    if (enabledTools.length > 0) {
        return enabledTools.includes(toolName);
    }

    const legacyEnabledTools = toolsConfig.EnabledTools;
    if (!legacyEnabledTools || !Array.isArray(legacyEnabledTools)) {
        return false;
    }

    return legacyEnabledTools.includes(toolName);
}

/**
 * 根据配置获取启用的工具列表
 * @returns {Array} 启用的工具定义数组
 */
export function getEnabledTools() {
    try {
        const toolsConfig = getToolsConfig();

        if (!isToolCallingEnabled(toolsConfig)) {
            logger.info('[工具定义] 工具调用全局开关已关闭，返回空工具列表');
            return [];
        }

        let enabledToolsList = getEnabledToolsFromCategories(toolsConfig);

        if (enabledToolsList.length === 0) {
            enabledToolsList = toolsConfig.EnabledTools || [];
        }

        const enabledTools = [];

        for (const tool of allTools) {
            const toolName = tool.function?.name;
            if (toolName && enabledToolsList.includes(toolName)) {
                enabledTools.push(tool);
            }
        }

        logger.info(`[工具定义] 已启用 ${enabledTools.length} 个工具`);
        return enabledTools;
    } catch (error) {
        logger.error(`[工具定义] 获取启用工具失败: ${error.message}`);
        return [];
    }
}

/**
 * 获取工具定义
 * @param {string} toolName - 工具名称
 * @returns {object|null} 工具定义
 */
export function getToolDefinition(toolName) {
    return TOOL_NAME_MAP.get(toolName) || null;
}

/**
 * 获取工具的敏感度等级
 * @param {string} toolName - 工具名称
 * @returns {number} 敏感度等级
 */
export function getToolSensitivity(toolName) {
    const HIGH_SENSITIVITY = ['mute_group_member', 'kick_group_member'];
    const MEDIUM_SENSITIVITY = ['set_group_card', 'set_group_title', 'delete_message', 'set_group_name', 'set_group_announcement'];

    if (HIGH_SENSITIVITY.includes(toolName)) {
        return SensitivityLevel.HIGH;
    }
    if (MEDIUM_SENSITIVITY.includes(toolName)) {
        return SensitivityLevel.MEDIUM;
    }
    return SensitivityLevel.LOW;
}

export { favorTools, friendTools, groupTools, interactTools, memoryTools };
