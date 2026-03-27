/**
 * Guoba支持入口
 * 整合所有Schema和处理器模块
 * 
 * 设置面板结构（精简版）：
 * - 对话设置：基础+高级合并
 * - AI接口设置：API配置
 * - 角色管理：角色列表+复制+用户个人
 * - 工具开关设置：所有工具开关
 * - 搜剧设置：所有搜剧相关合并
 * - 系统设置：网络+语音+权限
 */

import path from 'path';

import {
    getChatBasicSchemas,
    getApiSchemas,
    getRoleSchemas,
    getVideoSearchSchemas,
    getSystemSchemas,
    getToolSwitchSchemas
} from './guoba/schemas/index.js';

import { getConfigData, setConfigData } from './guoba/handlers/index.js';

const Path = process.cwd();
const PluginPath = path.join(Path, 'plugins', 'zhishui-plugin');

/**
 * Guoba支持函数
 * @returns {Object} Guoba配置对象
 */
export function supportGuoba() {
    return {
        pluginInfo: {
            name: "zhishui-plugin",
            title: "止水插件",
            author: "@止水",
            authorLink: "http://zj.qxyys.com",
            link: "https://gitee.com/fjcq/zhishui-plugin",
            isV3: true,
            isV2: false,
            description: "提供了搜剧、AI对话、乐器演奏等娱乐功能。",
            icon: 'mdi:water-wave',
            iconColor: '#4fc3f7',
            iconPath: path.join(PluginPath, 'resources/img/zhishui.png'),
        },
        configInfo: {
            get schemas() {
                return [
                    // 对话设置（合并基础+高级）
                    ...getChatBasicSchemas(),
                    // AI接口设置
                    ...getApiSchemas(),
                    // 角色管理（合并角色列表+复制+用户个人）
                    ...getRoleSchemas(),
                    // 工具开关设置
                    ...getToolSwitchSchemas(),
                    // 搜剧设置（合并所有搜剧相关）
                    ...getVideoSearchSchemas(),
                    // 系统设置（网络+语音+权限）
                    ...getSystemSchemas()
                ];
            },

            async getConfigData() {
                return await getConfigData();
            },

            async setConfigData(data, { Result, action }) {
                return await setConfigData(data, { Result, action });
            }
        }
    };
}
