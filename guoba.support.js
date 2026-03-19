/**
 * Guoba支持入口
 * 整合所有Schema和处理器模块
 */

import path from 'path';

import {
    getChatBasicSchemas,
    getChatAdvancedSchemas,
    getProxySchemas,
    getVoiceSchemas,
    getApiSchemas,
    getRoleSchemas,
    getRoleListSchema,
    getCopyRoleSchema,
    getVideoSearchSchemas
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
                const schemas = [
                    ...getChatBasicSchemas(),
                    ...getVoiceSchemas(),
                    ...getApiSchemas(),
                    ...getRoleSchemas(),
                    ...getChatAdvancedSchemas(),
                    ...getVideoSearchSchemas(),
                    ...getProxySchemas()
                ];

                const roleManageIndex = schemas.findIndex(item =>
                    item.label === '角色管理' && item.component === 'SOFT_GROUP_BEGIN'
                );

                if (roleManageIndex !== -1) {
                    const roleAppSettingsIndex = schemas.findIndex(item =>
                        item.label === '角色应用设置' &&
                        item.component === 'SOFT_GROUP_BEGIN'
                    );

                    schemas.splice(roleAppSettingsIndex, 0, getRoleListSchema());
                    schemas.splice(roleAppSettingsIndex + 1, 0, getCopyRoleSchema());
                }

                return schemas;
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
