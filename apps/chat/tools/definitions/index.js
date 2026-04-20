/**
 * 工具定义汇总入口
 * 导出所有工具定义
 */

import { Config } from '../../../../components/index.js';
import { favorTools } from './favorTools.js';
import { friendTools } from './friendTools.js';
import { groupTools } from './groupTools.js';
import { musicTools } from './musicTools.js';
import { messageTools } from './messageTools.js';
import { interactTools } from './interactTools.js';
import { memoryTools } from './memoryTools.js';
import { outputTools } from './outputTools.js';
import { ALL_TOOL_NAMES, DEFAULT_DISABLED_TOOLS } from '../../../../guoba/schemas/toolSwitchSchema.js';

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
    ...musicTools,
    ...messageTools,
    ...interactTools,
    ...memoryTools,
    ...outputTools
];

/**
 * 按类型分组的工具
 */
export const toolsByCategory = {
    favor: favorTools,
    friend: friendTools,
    group: groupTools,
    music: musicTools,
    message: messageTools,
    interact: interactTools,
    memory: memoryTools,
    output: outputTools
};

/**
 * 工具名称到定义的映射（懒加载）
 */
let TOOL_NAME_MAP = null;

/**
 * 获取工具名称映射（懒加载）
 * @returns {Map} 工具名称映射
 */
function getToolNameMap() {
    if (!TOOL_NAME_MAP) {
        TOOL_NAME_MAP = new Map();
        for (const tool of allTools) {
            if (tool.function?.name) {
                TOOL_NAME_MAP.set(tool.function.name, tool);
            }
        }
    }
    return TOOL_NAME_MAP;
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

    return toolsConfig.EnableToolCalling === true;
}

/**
 * 工具分类字段映射（兼容旧配置）
 */
const TOOL_CATEGORY_FIELDS = [
    'favor_tools',
    'friend_tools',
    'group_tools',
    'music_tools',
    'message_tools',
    'interact_tools',
    'memory_tools',
    'output_tools'
];

/**
 * 从分类配置中获取所有启用的工具（兼容旧配置格式）
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
 * 根据黑名单/白名单模式计算启用的工具列表
 * @param {object} toolsConfig - 工具配置
 * @returns {Array} 启用的工具名称列表
 */
function getEnabledToolsByMode(toolsConfig) {
    const mode = toolsConfig.ToolManageMode || 'blacklist';
    const toolList = Array.isArray(toolsConfig.ToolList) ? toolsConfig.ToolList : [];

    if (mode === 'whitelist') {
        if (toolList.length === 0) {
            return [];
        }
        return toolList.filter(name => ALL_TOOL_NAMES.includes(name));
    }

    const disabledTools = toolList.length > 0 ? toolList : DEFAULT_DISABLED_TOOLS;
    return ALL_TOOL_NAMES.filter(name => !disabledTools.includes(name));
}

/**
 * 检查工具是否启用
 * 支持三种配置格式：
 * 1. 新格式：黑名单/白名单模式 (ToolManageMode + ToolList)
 * 2. 分类格式：按分类配置 (favor_tools, interact_tools 等)
 * 3. 旧格式：单一数组 (EnabledTools)
 * @param {string} toolName - 工具名称
 * @param {object} toolsConfig - 工具配置对象
 * @returns {boolean} 是否启用
 */
export function isToolEnabled(toolName, toolsConfig = null) {
    if (!toolsConfig) {
        toolsConfig = getToolsConfig();
    }

    if (toolsConfig.ToolManageMode || toolsConfig.ToolList) {
        const enabledTools = getEnabledToolsByMode(toolsConfig);
        return enabledTools.includes(toolName);
    }

    const enabledToolsFromCategories = getEnabledToolsFromCategories(toolsConfig);
    if (enabledToolsFromCategories.length > 0) {
        return enabledToolsFromCategories.includes(toolName);
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

        let enabledToolsList = [];

        if (toolsConfig.ToolManageMode || toolsConfig.ToolList) {
            enabledToolsList = getEnabledToolsByMode(toolsConfig);
        } else {
            enabledToolsList = getEnabledToolsFromCategories(toolsConfig);
            if (enabledToolsList.length === 0) {
                enabledToolsList = toolsConfig.EnabledTools || [];
            }
        }

        const enabledTools = [];

        for (const tool of allTools) {
            const toolName = tool.function?.name;
            if (toolName && enabledToolsList.includes(toolName)) {
                enabledTools.push(tool);
            }
        }

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
    return getToolNameMap().get(toolName) || null;
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

export { favorTools, friendTools, groupTools, musicTools, messageTools, interactTools, memoryTools, outputTools };
