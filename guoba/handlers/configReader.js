/**
 * 配置读取处理模块
 */

import { Config } from '../../components/index.js';
import { getApiDisplayName } from '../../apps/chat/api-types.js';

/**
 * 为chat配置中的ApiList补全显示标题
 * 旧配置未填写ApiTitle时按API地址自动推断服务商名，使锅巴卡片列表可直接区分各个API
 * 仅处理返回给锅巴的数据副本，不污染配置缓存；用户在锅巴保存后标题固化到配置文件
 * @param {Object} chat - 对话配置对象
 * @returns {Object} 补全标题后的配置副本
 */
function enrichChatApiDisplay(chat) {
    if (!chat || !Array.isArray(chat.ApiList)) {
        return chat;
    }
    return {
        ...chat,
        ApiList: chat.ApiList.map(api =>
            api && !String(api.ApiTitle || '').trim()
                ? { ...api, ApiTitle: getApiDisplayName(api) }
                : api
        )
    };
}

/**
 * 获取配置数据
 * @returns {Promise<Object>} 配置数据
 */
export async function getConfigData() {
    try {
        const latestRoleContent = Config.getJsonConfig('RoleProfile');
        let roleList = [];
        if (latestRoleContent) {
            try {
                const rawRoles = JSON.parse(latestRoleContent);
                roleList = rawRoles.map(role => {
                    const { _isDefault, ...roleWithoutInternalMarks } = role;
                    const isDefault = _isDefault || false;
                    return {
                        title: role['角色标题'] || '',
                        jsonEditor: JSON.stringify(roleWithoutInternalMarks, null, 2),
                        _isDefault: isDefault,
                        roleType: isDefault ? '预设角色' : '自定义角色'
                    };
                });
            } catch (parseErr) {
                console.error('解析角色配置JSON失败:', parseErr);
                roleList = [];
            }
        }

        let userRoleList = [];
        try {
            const userRoleConfigs = await Config.GetAllUserRoleConfigs();
            userRoleList = userRoleConfigs.map(config => {
                const role = roleList[config.roleIndex];
                return {
                    qq: config.qq,
                    roleName: role ? role.title : `角色${config.roleIndex + 1}`
                };
            });
        } catch (err) {
            console.error('获取用户个人角色列表失败:', err);
            userRoleList = [];
        }

        let userResourceList = [];
        try {
            const userResourceConfigs = await Config.GetAllUserResourceConfigs();
            const videoSearchConfig = Config.getDefOrConfig('videoSearch') || {};
            const resources = videoSearchConfig.resources || [];
            userResourceList = userResourceConfigs.map(config => {
                const resource = resources[config.resourceIndex];
                const site = resource?.site || resource;
                return {
                    qq: config.qq,
                    resourceIndex: config.resourceIndex,
                    resourceName: site?.title || `资源站${config.resourceIndex + 1}`
                };
            });
        } catch (err) {
            console.error('获取用户个人资源站列表失败:', err);
            userResourceList = [];
        }

        const videoSearchConfig = Config.getDefOrConfig('videoSearch') || {};
        if (Array.isArray(videoSearchConfig.resources)) {
            videoSearchConfig.resources = videoSearchConfig.resources.map(item => {
                if (item.site) {
                    return item.site;
                }
                return item;
            });
        }

        return {
            videoSearch: videoSearchConfig,
            chat: enrichChatApiDisplay(Config.getDefOrConfig('chat') || {}),
            voice: Config.getDefOrConfig('voice') || {},
            proxy: Config.getDefOrConfig('proxy') || {},
            tools: Config.getDefOrConfig('tools') || {},
            musicApi: Config.getDefOrConfig('musicApi') || {},
            imageGen: Config.getDefOrConfig('imageGen') || {},
            roleList: roleList || [],
            userRoleList: userRoleList || [],
            userResourceList: userResourceList || []
        };
    } catch (err) {
        console.error('止水插件-获取配置数据失败:', err);
        return {
            videoSearch: {},
            chat: {},
            voice: {},
            proxy: {},
            tools: {},
            musicApi: {},
            imageGen: {},
            roleList: []
        };
    }
}

/**
 * 获取最新配置数据（用于刷新）
 * @returns {Object} 配置数据
 */
export function getLatestConfigData() {
    try {
        const latestRoleContent = Config.getJsonConfig('RoleProfile');
        let roleList = [];
        if (latestRoleContent) {
            try {
                const rawRoles = JSON.parse(latestRoleContent);
                roleList = rawRoles.map(role => {
                    const { _isDefault, ...roleWithoutInternalMarks } = role;
                    const isDefault = _isDefault || false;
                    return {
                        title: role['角色标题'] || '',
                        jsonEditor: JSON.stringify(roleWithoutInternalMarks, null, 2),
                        _isDefault: isDefault,
                        roleType: isDefault ? '预设角色' : '自定义角色'
                    };
                });
            } catch (parseErr) {
                console.error('解析角色配置JSON失败:', parseErr);
                roleList = [];
            }
        }

        const videoSearchConfig = Config.getDefOrConfig('videoSearch') || {};
        if (Array.isArray(videoSearchConfig.resources)) {
            videoSearchConfig.resources = videoSearchConfig.resources.map(item => {
                if (item.site) {
                    return item.site;
                }
                return item;
            });
        }

        return {
            videoSearch: videoSearchConfig,
            chat: enrichChatApiDisplay(Config.getDefOrConfig('chat') || {}),
            voice: Config.getDefOrConfig('voice') || {},
            proxy: Config.getDefOrConfig('proxy') || {},
            tools: Config.getDefOrConfig('tools') || {},
            musicApi: Config.getDefOrConfig('musicApi') || {},
            imageGen: Config.getDefOrConfig('imageGen') || {},
            roleList: roleList || []
        };
    } catch (err) {
        console.error('止水插件-获取配置数据失败:', err);
        return {
            videoSearch: {},
            chat: {},
            voice: {},
            proxy: {},
            tools: {},
            musicApi: {},
            imageGen: {},
            roleList: []
        };
    }
}
