/**
 * 工具定义汇总入口
 * 导出所有工具定义
 */

import { Config, logger } from '../../../../components/index.js';
import { favorTools } from './favorTools.js';
import { friendTools } from './friendTools.js';
import { groupTools } from './groupTools.js';
import { musicTools } from './musicTools.js';
import { messageTools } from './messageTools.js';
import { interactTools } from './interactTools.js';
import { memoryTools } from './memoryTools.js';
import { outputTools } from './outputTools.js';
import { searchTools } from './searchTools.js';
import { videoTools } from './videoTools.js';
import { imageTools } from './imageTools.js';
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
    ...outputTools,
    ...searchTools,
    ...videoTools,
    ...imageTools
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
    output: outputTools,
    search: searchTools,
    video: videoTools,
    image: imageTools
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
    'output_tools',
    'search_tools',
    'video_tools',
    'image_tools'
];

/** 搜剧相关工具名，需要注入资源站索引映射描述 */
const VIDEO_TOOL_NAMES = ['search_videos', 'get_video_episodes', 'get_video_play_url'];

/**
 * 生成搜剧资源站索引映射文本
 * 从运行时配置读取站点列表，拼接为 "0:量子资源, 1:非凡资源, ..."，供 AI 正确选择站点
 * @returns {string} 站点索引映射文本，资源站未配置时返回空字符串
 */
function buildSiteIndexMapText() {
    try {
        const resources = Config.SearchVideos?.resources;
        if (!Array.isArray(resources) || resources.length === 0) {
            return '';
        }
        return resources
            .map((resource, index) => {
                const site = resource?.site || resource || {};
                return `${index}:${site.title || '未命名'}`;
            })
            .join(', ');
    } catch {
        return '';
    }
}

/**
 * 为搜剧工具副本注入资源站索引映射描述
 * 通过深拷贝返回新对象，避免污染共享的 allTools 定义
 * @param {object} tool - 原始搜剧工具定义
 * @returns {object} 注入映射后的工具定义副本
 */
function enrichVideoToolWithSiteMap(tool) {
    const siteMap = buildSiteIndexMapText();
    if (!siteMap) {
        return tool;
    }
    const enriched = JSON.parse(JSON.stringify(tool));
    const fn = enriched.function;
    if (fn?.parameters?.properties?.site_index) {
        const siteIndexDesc = `资源站索引：${siteMap}。不填则使用用户配置的默认资源站`;
        fn.parameters.properties.site_index.description = siteIndexDesc;
    }
    return enriched;
}

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
                // 搜剧工具注入资源站索引映射，AI 才能正确选择指定站点
                enabledTools.push(VIDEO_TOOL_NAMES.includes(toolName) ? enrichVideoToolWithSiteMap(tool) : tool);
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

export { favorTools, friendTools, groupTools, musicTools, messageTools, interactTools, memoryTools, outputTools, searchTools, videoTools, imageTools };
