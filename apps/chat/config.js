/**
 * 对话模块配置
 * 共享的配置变量和常量
 */

import path from 'path';
import { Plugin_Path, Config } from '../../components/index.js';
import { ReadScene } from './sceneManager.js';
import { getDecisionPrompt } from './tools/decisionEngine.js';

export const CHAT_CONTEXT_PATH = path.join(Plugin_Path, 'data', 'chatContext');

export const CHAT_CONTEXT_V2_PATH = path.join(CHAT_CONTEXT_PATH, 'v2');

export const chatActiveMap = {};

export const lastRequestTime = {};

/**
 * 上下文存储模式
 * isolated: 按场景隔离存储（群聊/私聊分开）- 方案一
 * role:     按角色整合存储（同一角色跨场景合并）- 方案二
 */
const CONTEXT_MODES = {
    ISOLATED: 'isolated',
    ROLE: 'role'
};

/**
 * 获取当前上下文存储模式
 * @returns {Promise<string>} 存储模式标识
 */
export async function getContextMode() {
    try {
        const mode = await Config.Chat.ContextMode;
        if (mode === CONTEXT_MODES.ISOLATED || mode === CONTEXT_MODES.ROLE) {
            return mode;
        }
    } catch (error) {
    }
    return CONTEXT_MODES.ROLE;
}

/**
 * 设置上下文存储模式
 * @param {string} mode - 存储模式 (isolated | role)
 * @returns {Promise<void>}
 */
export async function setContextMode(mode) {
    if (mode !== CONTEXT_MODES.ISOLATED && mode !== CONTEXT_MODES.ROLE) {
        throw new Error(`无效的存储模式: ${mode}，仅支持 ${CONTEXT_MODES.ISOLATED} 或 ${CONTEXT_MODES.ROLE}`);
    }
    await Config.modify('chat', 'ContextMode', mode);
}

export { CONTEXT_MODES };

export const API_INTERVALS = {
    'default': 3000,
    'openai': 3000,
    'gemini': 2000,
    'tencent': 2000,
    'qwen': 3000,
    'deepseek': 3000
};

/**
 * 获取当前角色索引
 * @param {Object} e - 事件对象
 * @returns {Promise<number>} 角色索引
 */
export async function getCurrentRoleIndex(e) {
    let currentRoleIndex = await Config.Chat.CurrentRoleIndex || 0;

    if (!e.group_id) {
        try {
            const userRoleIndex = await Config.GetUserChatConfig(e.user_id, 'RoleIndex');
            if (typeof userRoleIndex === 'number') {
                currentRoleIndex = userRoleIndex;
            }
        } catch (error) {
        }
    } else {
        const groupRoleList = (await Config.Chat.GroupRoleIndex) || [];
        const found = groupRoleList.find(item => String(item.group) === String(e.group_id));
        if (found && typeof found.index === 'number') {
            currentRoleIndex = found.index;
        }
    }

    return currentRoleIndex;
}

/**
 * 获取用户个人角色索引（V2模式专用）
 * V2角色整合模式忽略所有个人和群的角色配置，一律采用全局设置
 * 确保同一用户在不同场景使用相同的roleId，实现跨场景对话整合
 * @param {Object} e - 事件对象
 * @returns {Promise<number>} 全局角色索引
 */
export async function getUserRoleIndex(e) {
    return await Config.Chat.CurrentRoleIndex || 0;
}

/**
 * 获取当前API配置
 * @param {Object} e - 事件对象
 * @returns {Promise<Object>} 包含 apiIndex 和 apiConfig 的对象
 */
export async function getCurrentApiConfig(e) {
    const ApiList = await Config.Chat.ApiList || [];
    let apiIndex = typeof (await Config.Chat.CurrentApiIndex) === 'number'
        ? await Config.Chat.CurrentApiIndex
        : parseInt(await Config.Chat.CurrentApiIndex) || 0;

    if (e.group_id && Array.isArray(await Config.Chat.GroupRoleIndex)) {
        const groupRoleList = await Config.Chat.GroupRoleIndex;
        const found = groupRoleList.find(item => String(item.group) === String(e.group_id));
        if (found && typeof found.apiIndex === 'number') {
            apiIndex = found.apiIndex;
        }
    }

    const apiConfig = ApiList[apiIndex] || ApiList[0] || {};

    return { apiIndex, apiConfig };
}

/**
 * 合并系统消息
 * 整合角色设定、场景设定、系统配置、主人设定等
 * @param {Object} e - 事件对象
 * @param {boolean} supportsToolCalling - 是否支持工具调用
 * @returns {Promise<string>} 系统消息字符串
 */
export async function mergeSystemMessage(e, supportsToolCalling = false) {
    try {
        const currentRoleIndex = await getCurrentRoleIndex(e);
        const roleJson = Config.getJsonConfig('RoleProfile');
        const roles = JSON.parse(roleJson);
        const currentRole = roles[currentRoleIndex] || {};

        if (currentRole.系统提示词) {
            return currentRole.系统提示词;
        }

        const systemConfig = {};

        const context = await Config.Chat.Context || '';
        if (context) {
            systemConfig.对话身份 = context;
        }

        const excludeKeys = ['系统提示词', '请求参数'];
        for (const [key, value] of Object.entries(currentRole)) {
            if (!excludeKeys.includes(key) && value !== undefined && value !== null) {
                systemConfig[key] = value;
            }
        }

        const sceneJson = await ReadScene();
        if (sceneJson) {
            try {
                systemConfig.场景设定 = JSON.parse(sceneJson);
            } catch (sceneError) {
                console.error('[mergeSystemMessage] 解析场景设定失败:', sceneError);
            }
        }

        const systemConfigJson = Config.getJsonConfig('SystemConfig');
        if (systemConfigJson) {
            try {
                const parsedConfig = JSON.parse(systemConfigJson);
                const { 响应格式配置, ...restConfig } = parsedConfig;

                if (Object.keys(restConfig).length > 0) {
                    systemConfig.系统规则 = restConfig;
                }

                if (响应格式配置) {
                    const modeKey = supportsToolCalling ? '工具调用模式' : '非工具调用模式';
                    const modeConfig = 响应格式配置[modeKey] || {};
                    const { 艾特功能, ...restModeConfig } = 响应格式配置;

                    systemConfig.响应格式 = {
                        艾特功能,
                        ...modeConfig
                    };
                }
            } catch (configError) {
                console.error('[mergeSystemMessage] 解析系统配置失败:', configError);
            }
        }

        const masterName = await Config.Chat.Master || '';
        const masterQQ = await Config.Chat.MasterQQ || '';
        if (masterName && masterQQ) {
            systemConfig.主人设定 = {
                masterName,
                masterQQ,
                description: '主人是系统的唯一所有者，是角色最重要的人'
            };
        }

        return JSON.stringify(systemConfig, null, 2) || '你是一个有帮助的AI助手。';
    } catch (error) {
        console.error('[mergeSystemMessage] 构建系统消息失败:', error);
        return '你是一个有帮助的AI助手。';
    }
}


