/**
 * 系统消息组装模块（新架构版）
 * 从旧config.js移植mergeSystemMessage，角色索引改经configs/roleManager
 * （读groupOverrides.roleIndex，消除旧版读GroupRoleIndex的数据分叉）。
 * 整合角色设定、场景设定、系统配置、主人设定、工具自然化规范。
 */

import { Config } from '../../../components/index.js';
import { ReadScene } from '../sceneManager.js';
import { getCurrentRoleIndex } from './roleManager.js';
import { getToolNaturalnessGuide, shouldInjectToolGuide } from '../tools/toolNaturalnessGuide.js';

/**
 * 合并系统消息
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

        // 角色自带完整系统提示词时直接使用
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
                        ...restModeConfig
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

        // 工具调用模式下注入自然化使用规范，约束 AI 用角色视角表达而非技术化措辞
        if (shouldInjectToolGuide(supportsToolCalling)) {
            systemConfig.工具使用规范 = getToolNaturalnessGuide();
        }

        return JSON.stringify(systemConfig, null, 2) || '你是一个有帮助的AI助手。';
    } catch (error) {
        console.error('[mergeSystemMessage] 合并系统消息失败:', error);
        return '你是一个有帮助的AI助手。';
    }
}
