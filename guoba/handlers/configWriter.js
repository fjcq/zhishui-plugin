/**
 * 配置保存处理模块
 */

import { Config } from '../../components/index.js';
import { getLatestConfigData } from './configReader.js';
import { clearAllSessions } from '../../apps/chat/session.js';

/**
 * 保存配置数据
 * @param {Object} data - 配置数据
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 保存结果
 */
export async function setConfigData(data, { Result, action }) {
    try {
        if (action?.key === 'copy' && action?.formData) {
            return await handleCopyRole(action.formData, Result);
        }

        for (let key in data) {
            switch (key) {
                case 'roleList':
                    await handleRoleListSave(data[key]);
                    break;
                case 'copyRole':
                    await handleCopyRoleSave(data[key]);
                    break;
                case 'userRoleList':
                    await handleUserRoleListSave(data[key]);
                    break;
                case 'userResourceList':
                    await handleUserResourceListSave(data[key]);
                    break;
                case 'videoSearch':
                    handleVideoSearchSave(data[key]);
                    break;
                case 'voice':
                case 'proxy':
                    Config.modify(key, '', data[key], 'config');
                    break;
                case 'chat':
                    await handleChatSave(data[key]);
                    break;
                default:
                    handleGenericSave(key, data[key]);
            }
        }
        
        return Result.ok({
            refreshData: getLatestConfigData()
        });
    } catch (err) {
        console.error('止水插件-保存配置失败:', err);
        return Result.error('保存失败: ' + err.message);
    }
}

/**
 * 处理角色复制操作
 * @param {Object} copyRole - 复制角色数据
 * @param {Object} Result - 结果对象
 * @returns {Promise<Object>} 操作结果
 */
async function handleCopyRole(copyRole, Result) {
    try {
        const latestRoleContent = Config.getJsonConfig('RoleProfile');
        let roles = latestRoleContent ? JSON.parse(latestRoleContent) : [];

        const parsedRole = JSON.parse(copyRole.jsonEditor);

        const newRole = {
            ...parsedRole,
            '角色标题': `${parsedRole['角色标题']} (副本)`,
            _isDefault: false
        };

        roles.push(newRole);

        const roleListJson = JSON.stringify(roles, null, 2);
        Config.setJsonConfig('RoleProfile', roleListJson);

        return Result.ok({
            refreshData: { roleList: getLatestConfigData().roleList }
        });
    } catch (err) {
        console.error('复制角色失败:', err);
        return Result.error('复制角色失败: ' + err.message);
    }
}

/**
 * 处理角色列表保存
 * @param {Array} roleData - 角色数据列表
 * @returns {Promise<void>}
 */
async function handleRoleListSave(roleData) {
    try {
        const latestRoleContent = Config.getJsonConfig('RoleProfile');
        const originalRoles = latestRoleContent ? JSON.parse(latestRoleContent) : [];

        const processedRoles = roleData.map(role => {
            if (role.jsonEditor && role.jsonEditor.trim()) {
                try {
                    const parsedData = JSON.parse(role.jsonEditor);
                    const { _isDefault, ...roleWithoutInternalMarks } = parsedData;
                    roleWithoutInternalMarks['角色标题'] = role.title || roleWithoutInternalMarks['角色标题'] || '新角色';
                    if (role._isDefault) {
                        roleWithoutInternalMarks._isDefault = true;
                    }
                    return roleWithoutInternalMarks;
                } catch (e) {
                    console.error('JSON编辑器数据解析失败:', e);
                    return null;
                }
            }
            return null;
        }).filter(role => role !== null);

        const processedDefaultRoles = processedRoles.filter(role => role._isDefault);
        const originalDefaultRoles = originalRoles.filter(role => role._isDefault);

        if (processedDefaultRoles.length < originalDefaultRoles.length) {
            const deletedDefaultRoles = originalDefaultRoles.filter(originalRole => {
                return !processedDefaultRoles.some(processedRole =>
                    processedRole['角色标题'] === originalRole['角色标题']
                );
            });

            if (deletedDefaultRoles.length > 0) {
                console.log(`[角色配置] 检测到 ${deletedDefaultRoles.length} 个预设角色被删除，已自动恢复`);
                processedRoles.push(...deletedDefaultRoles);
            }
        }

        const roleListJson = JSON.stringify(processedRoles, null, 2);
        Config.setJsonConfig('RoleProfile', roleListJson);
    } catch (err) {
        console.error('保存角色配置失败:', err);
        throw new Error('角色配置保存失败: ' + err.message);
    }
}

/**
 * 处理角色复制保存
 * @param {Object} copyRoleData - 复制角色数据
 * @returns {Promise<void>}
 */
async function handleCopyRoleSave(copyRoleData) {
    try {
        const { sourceRole, newRoleTitle } = copyRoleData || {};

        if (sourceRole !== undefined) {
            const latestRoleContent = Config.getJsonConfig('RoleProfile');
            let roles = latestRoleContent ? JSON.parse(latestRoleContent) : [];

            if (sourceRole >= 0 && sourceRole < roles.length) {
                const sourceRoleData = roles[sourceRole];
                const title = newRoleTitle || `${sourceRoleData['角色标题']} (副本)`;

                const newRole = {
                    ...sourceRoleData,
                    '角色标题': title,
                    _isDefault: false
                };

                roles.push(newRole);

                const roleListJson = JSON.stringify(roles, null, 2);
                Config.setJsonConfig('RoleProfile', roleListJson);
            }
        }
    } catch (err) {
        console.error('复制角色失败:', err);
        throw new Error('复制角色失败: ' + err.message);
    }
}

/**
 * 处理用户角色列表保存
 * @param {Array} userRoleData - 用户角色数据
 * @returns {Promise<void>}
 */
async function handleUserRoleListSave(userRoleData) {
    try {
        const currentUserRoleConfigs = await Config.GetAllUserRoleConfigs();

        const deletedUserConfigs = currentUserRoleConfigs.filter(config => {
            return !userRoleData.some(user => user.qq === config.qq);
        });

        for (const deletedConfig of deletedUserConfigs) {
            await Config.DeleteUserChatConfig(deletedConfig.qq, 'RoleIndex');
            console.log(`[用户角色] 已删除用户 ${deletedConfig.qq} 的个人角色配置`);
        }
    } catch (err) {
        console.error('处理用户个人角色列表失败:', err);
        throw new Error('用户个人角色列表处理失败: ' + err.message);
    }
}

/**
 * 处理用户资源站列表保存
 * @param {Array} userResourceData - 用户资源站数据
 * @returns {Promise<void>}
 */
async function handleUserResourceListSave(userResourceData) {
    try {
        const currentUserResourceConfigs = await Config.GetAllUserResourceConfigs();

        const deletedUserConfigs = currentUserResourceConfigs.filter(config => {
            return !userResourceData.some(user => user.qq === config.qq);
        });

        for (const deletedConfig of deletedUserConfigs) {
            await Config.DeleteUserSearchVideos(deletedConfig.qq, 'idx');
            console.log(`[用户资源站] 已删除用户 ${deletedConfig.qq} 的个人资源站配置`);
        }
    } catch (err) {
        console.error('处理用户个人资源站列表失败:', err);
        throw new Error('用户个人资源站列表处理失败: ' + err.message);
    }
}

/**
 * 处理搜剧配置保存
 * @param {Object} videoSearch - 搜剧配置
 */
function handleVideoSearchSave(videoSearch) {
    let config = { ...videoSearch };
    if (Array.isArray(config.resources)) {
        config.resources = config.resources.map(site => ({ site }));
    }
    Config.modify('videoSearch', '', config, 'config');
}

/**
 * 处理通用配置保存
 * @param {string} key - 配置键
 * @param {*} value - 配置值
 */
function handleGenericSave(key, value) {
    const pathArr = key.split('.');
    const fileName = pathArr[0];
    const configKey = pathArr.slice(1).join('.');

    if (configKey) {
        Config.modify(fileName, configKey, value, 'config');
    } else {
        Config.modify(fileName, '', value, 'config');
    }
}

/**
 * 处理对话配置保存
 * 检测ContextMode变化，切换时清除旧模式的会话数据
 * @param {Object} chatData - 对话配置数据
 * @returns {Promise<void>}
 */
async function handleChatSave(chatData) {
    try {
        const oldMode = await Config.Chat.ContextMode;
        const newMode = chatData.ContextMode || 'role';

        if (oldMode && newMode && oldMode !== newMode) {
            const clearTarget = oldMode;
            const result = clearAllSessions(clearTarget);
            console.log(`[锅巴面板] ContextMode ${oldMode}→${newMode}: 已清除${clearTarget}模式${result.count}个会话文件`);
        }

        Config.modify('chat', '', chatData, 'config');
    } catch (error) {
        console.error('[锅巴面板] 保存对话配置失败:', error);
        throw error;
    }
}
