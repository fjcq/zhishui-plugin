/**
 * 配置读取处理模块
 */

import { Config } from '../../components/index.js';

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
            chat: Config.getDefOrConfig('chat') || {},
            voice: Config.getDefOrConfig('voice') || {},
            proxy: Config.getDefOrConfig('proxy') || {},
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
            chat: Config.getDefOrConfig('chat') || {},
            voice: Config.getDefOrConfig('voice') || {},
            proxy: Config.getDefOrConfig('proxy') || {},
            roleList: roleList || []
        };
    } catch (err) {
        console.error('止水插件-获取配置数据失败:', err);
        return {
            videoSearch: {},
            chat: {},
            voice: {},
            proxy: {},
            roleList: []
        };
    }
}
