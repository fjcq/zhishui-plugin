/**
 * 配置保存处理模块
 */

import { Config } from '../../components/index.js';
import { getLatestConfigData } from './configReader.js';
import { clearAllSessions } from '../../apps/chat/session.js';
import { mergePanelModels, cleanupChatReferences } from '../../apps/chat/configs/sync.js';

/**
 * 保存配置数据
 * 锅巴前端按schema field扁平提交（key形如'chat.models'、'voice.Enable'），
 * 顶层key几乎不含裸组名，绝大多数走default→handleGenericSave逐键落盘
 * @param {Object} data - 配置数据
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 保存结果
 */
export async function setConfigData(data, { Result, action }) {
    try {
        if (action?.key === 'copy' && action?.formData) {
            return await handleCopyRole(action.formData, Result);
        }

        // 写盘前记录ContextMode，供落盘后的chat副作用对比（切换会话模式需清旧会话）
        const oldContextMode = (await Config.Chat)?.ContextMode;
        let touchedChat = false;

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
                    Config.modify('chat', '', data[key], 'config');
                    break;
                case 'chat.models':
                    // GSubForm只提交schema定义字段，写前钩子回填params并转换vision三态
                    await handleChatModelsSave(data[key]);
                    break;
                default:
                    handleGenericSave(key, data[key]);
            }
            if (key === 'chat' || key.startsWith('chat.')) {
                touchedChat = true;
            }
        }

        // chat相关键落盘后统一触发副作用：ContextMode切换清会话 + 失效模型引用清理
        if (touchedChat) {
            await handleChatSideEffects(oldContextMode);
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
 * 处理对话模型列表保存（写前钩子）
 * 面板提交的models经mergePanelModels转换（params保留+vision三态转布尔）后落盘
 * @param {Array<Object>} submittedModels - 面板提交的model列表
 * @returns {Promise<void>}
 */
async function handleChatModelsSave(submittedModels) {
    const currentModels = (await Config.Chat)?.models || [];
    const merged = mergePanelModels(submittedModels, currentModels);
    Config.modify('chat', 'models', merged, 'config');
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
 * chat配置落盘后的副作用处理
 * 1. ContextMode变化时清除旧模式的会话数据
 * 2. 清理失效模型引用（defaultModel/visionModel/groupOverrides指向已删除模型时置空/摘除）
 * @param {string} oldContextMode - 写盘前的ContextMode值
 * @returns {Promise<void>}
 */
async function handleChatSideEffects(oldContextMode) {
    try {
        const chat = await Config.Chat;
        const newMode = chat?.ContextMode || 'role';

        if (oldContextMode && newMode && oldContextMode !== newMode) {
            const result = await clearAllSessions(oldContextMode);
            if (result.retained) {
                console.log(`[锅巴面板] ContextMode ${oldContextMode}→${newMode}: SQLite 已启用，${oldContextMode}模式历史数据保留`);
            } else {
                console.log(`[锅巴面板] ContextMode ${oldContextMode}→${newMode}: 已清除${oldContextMode}模式${result.count}个会话文件`);
            }
        }

        // 面板编辑（改名/删除模型）可能产生失效引用，统一清理防止悬空
        const cleanupResult = await cleanupChatReferences();
        if (cleanupResult.cleaned) {
            console.log('[锅巴面板] 已清理指向已删除模型的失效引用');
        }
    } catch (error) {
        console.error('[锅巴面板] chat配置副作用处理失败:', error);
    }
}
