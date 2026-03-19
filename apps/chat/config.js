/**
 * 对话模块配置
 * 共享的配置变量和常量
 */

import path from 'path';
import { Plugin_Path, Config } from '../../components/index.js';
import { ReadScene } from './sceneManager.js';

export const CHAT_CONTEXT_PATH = path.join(Plugin_Path, 'data', 'chatContext');

export const chatActiveMap = {};

export const lastRequestTime = {};

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

        let systemMessage = '';

        const context = await Config.Chat.Context || '';
        if (context) {
            systemMessage += `## 对话身份\n${context}\n\n`;
        }

        if (currentRole['基础身份']) {
            const basicIdentity = currentRole['基础身份'];
            systemMessage += `## 角色身份\n`;
            systemMessage += `你是一个${basicIdentity.类型 || 'AI助手'}。\n\n`;

            if (basicIdentity.核心特征 && Array.isArray(basicIdentity.核心特征)) {
                systemMessage += `### 核心特征\n`;
                basicIdentity.核心特征.forEach(feature => {
                    systemMessage += `- ${feature}\n`;
                });
                systemMessage += '\n';
            }
        }

        if (currentRole['行为特征']) {
            const behavior = currentRole['行为特征'];
            systemMessage += `## 行为特征\n\n`;

            if (behavior.语言风格) {
                systemMessage += `### 语言风格\n${behavior.语言风格}\n\n`;
            }

            if (behavior.特殊机制 && Array.isArray(behavior.特殊机制)) {
                systemMessage += `### 特殊机制\n`;
                behavior.特殊机制.forEach(mechanism => {
                    systemMessage += `- ${mechanism}\n`;
                });
                systemMessage += '\n';
            }
        }

        if (currentRole['生物特征']) {
            const bio = currentRole['生物特征'];
            systemMessage += `## 生物特征\n\n`;

            if (bio.身高) {
                systemMessage += `- 身高：${bio.身高}\n`;
            }
            if (bio.体态) {
                systemMessage += `- 体态：${bio.体态}\n`;
            }
            if (bio.能量源) {
                systemMessage += `- 能量源：${bio.能量源}\n`;
            }
            systemMessage += '\n';
        }

        const sceneJson = await ReadScene();
        if (sceneJson) {
            try {
                const scene = JSON.parse(sceneJson);
                systemMessage += `## 场景设定\n\n`;
                Object.entries(scene).forEach(([key, value]) => {
                    if (typeof value === 'object') {
                        systemMessage += `### ${key}\n${JSON.stringify(value, null, 2)}\n\n`;
                    } else {
                        systemMessage += `- ${key}: ${value}\n`;
                    }
                });
                systemMessage += '\n';
            } catch (sceneError) {
                console.error('[mergeSystemMessage] 解析场景设定失败:', sceneError);
            }
        }

        systemMessage += buildResponseFormatSection(supportsToolCalling);

        const systemConfigJson = Config.getJsonConfig('SystemConfig');
        if (systemConfigJson) {
            try {
                const systemConfig = JSON.parse(systemConfigJson);
                systemMessage += `## 系统规则\n\n`;

                if (systemConfig['身份保密']) {
                    systemMessage += `### 身份保密\n`;
                    systemMessage += `- 核心原则：${systemConfig['身份保密'].核心原则}\n`;
                    if (systemConfig['身份保密'].必须行为) {
                        systemMessage += `- 必须行为：\n`;
                        systemConfig['身份保密'].必须行为.forEach(behavior => {
                            systemMessage += `  - ${behavior}\n`;
                        });
                    }
                    systemMessage += '\n';
                }

                if (systemConfig['好感度系统']) {
                    const favorSystem = systemConfig['好感度系统'];
                    systemMessage += `### 好感度系统\n`;
                    systemMessage += `- 核心原则：${favorSystem.核心原则}\n`;
                    systemMessage += `- 数值范围：${favorSystem.数值范围}\n`;
                    if (favorSystem.调整原则) {
                        systemMessage += `- 调整原则：\n`;
                        favorSystem.调整原则.forEach(principle => {
                            systemMessage += `  - ${principle}\n`;
                        });
                    }
                    systemMessage += '\n';
                }

                if (systemConfig['用户身份系统']) {
                    const userIdentity = systemConfig['用户身份系统'];
                    systemMessage += `### 用户身份系统\n`;
                    if (userIdentity.主人) {
                        systemMessage += `- 主人定义：${userIdentity.主人.定义}\n`;
                        systemMessage += `- 主人好感度状态：${userIdentity.主人.好感度状态}\n`;
                        systemMessage += `- 主人特殊地位：${userIdentity.主人.特殊地位}\n`;
                    }
                    if (userIdentity.普通用户) {
                        systemMessage += `- 普通用户定义：${userIdentity.普通用户.定义}\n`;
                        systemMessage += `- 普通用户好感度状态：${userIdentity.普通用户.好感度状态}\n`;
                    }
                    systemMessage += '\n';
                }

                if (systemConfig['@提及功能']) {
                    systemMessage += `### @提及功能\n`;
                    systemMessage += `- 说明：${systemConfig['@提及功能'].说明}\n`;
                    systemMessage += `- 示例：${systemConfig['@提及功能'].示例}\n\n`;
                }
            } catch (configError) {
                console.error('[mergeSystemMessage] 解析系统配置失败:', configError);
            }
        }

        const masterName = await Config.Chat.Master || '';
        const masterQQ = await Config.Chat.MasterQQ || '';
        if (masterName && masterQQ) {
            systemMessage += `## 主人设定\n\n`;
            systemMessage += `- 主人名称：${masterName}\n`;
            systemMessage += `- 主人QQ：${masterQQ}\n`;
            systemMessage += `- 主人是系统的唯一所有者，是角色最重要的人\n\n`;
        }

        if (currentRole['请求参数']) {
            systemMessage += `## 请求参数\n`;
            const params = currentRole['请求参数'];
            Object.entries(params).forEach(([key, value]) => {
                systemMessage += `- ${key}: ${value}\n`;
            });
            systemMessage += '\n';
        }

        return systemMessage || '你是一个有帮助的AI助手。';
    } catch (error) {
        console.error('[mergeSystemMessage] 构建系统消息失败:', error);
        return '你是一个有帮助的AI助手。';
    }
}

/**
 * 构建响应格式部分
 * @param {boolean} supportsToolCalling - 是否支持工具调用
 * @returns {string} 响应格式说明
 */
function buildResponseFormatSection(supportsToolCalling) {
    let section = `## 响应格式\n\n`;
    
    if (supportsToolCalling) {
        section += `### 响应要求\n`;
        section += `- 所有响应必须是合法的JSON格式\n`;
        section += `- 系统已启用工具调用功能，你可以通过调用工具来修改用户好感度\n\n`;
        
        section += `### 响应结构\n`;
        section += `- message: 【必填】你的回复内容，这是唯一必需的字段\n`;
        section += `- code_example: 【可选】代码示例，如果回复包含代码可以放在这里\n\n`;
        
        section += `### 示例响应\n`;
        section += `\`\`\`json\n`;
        section += `{\n`;
        section += `  "message": "你好呀~很高兴见到你！"\n`;
        section += `}\n`;
        section += `\`\`\`\n\n`;
        
        section += `### 注意事项\n`;
        section += `- message字段必须存在且为字符串类型\n`;
        section += `- 如需修改好感度，请使用 change_user_favor 工具，不要在响应中包含favor_changes字段\n`;
        section += `- 确保返回的是合法的JSON格式，不要有多余的文本\n\n`;
    } else {
        section += `### 响应要求\n`;
        section += `- 所有响应必须是合法的JSON格式\n`;
        section += `- 系统需要解析响应内容来处理好感度变化等功能\n\n`;
        
        section += `### 响应结构\n`;
        section += `- message: 【必填】你的回复内容，这是唯一必需的字段\n`;
        section += `- favor_changes: 【可选】好感度变化数组，格式：[{"user_id": 用户ID, "change": 变化值, "reason": "原因"}]\n`;
        section += `- code_example: 【可选】代码示例，如果回复包含代码可以放在这里\n\n`;
        
        section += `### 示例响应\n`;
        section += `\`\`\`json\n`;
        section += `{\n`;
        section += `  "message": "你好呀~很高兴见到你！",\n`;
        section += `  "favor_changes": [\n`;
        section += `    {\n`;
        section += `      "user_id": "123456",\n`;
        section += `      "change": 2,\n`;
        section += `      "reason": "友好的问候"\n`;
        section += `    }\n`;
        section += `  ]\n`;
        section += `}\n`;
        section += `\`\`\`\n\n`;
        
        section += `### 注意事项\n`;
        section += `- message字段必须存在且为字符串类型\n`;
        section += `- favor_changes是数组类型，每个元素包含user_id、change、reason三个字段\n`;
        section += `- change数值范围建议在-10到10之间\n`;
        section += `- 确保返回的是合法的JSON格式，不要有多余的文本\n\n`;
    }
    
    return section;
}
