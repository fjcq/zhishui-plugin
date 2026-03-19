/**
 * JSON配置管理模块
 * 处理JSON格式的配置文件读写
 */

import fs from 'node:fs';
import path from 'node:path';

const Path = process.cwd();
const Plugin_Name = 'zhishui-plugin';
const Plugin_Path = path.join(Path, 'plugins', Plugin_Name);

const logger = global.logger || console;

/**
 * 读取JSON配置文件
 * @param {string} name - 文件名（不含扩展名）
 * @returns {string} 返回文件内容字符串
 */
export function getJsonConfig(name) {
    try {
        const userConfigPath = path.join(Plugin_Path, 'config', 'config', `${name}.json`);
        const defaultConfigPath = path.join(Plugin_Path, 'config', 'default_config', `${name}.json`);

        if (name === 'RoleProfile') {
            return getMergedRoleConfig(userConfigPath, defaultConfigPath);
        }

        if (fs.existsSync(userConfigPath)) {
            return fs.readFileSync(userConfigPath, 'utf8');
        } else if (fs.existsSync(defaultConfigPath)) {
            return fs.readFileSync(defaultConfigPath, 'utf8');
        }
        return '';
    } catch (error) {
        console.error(`读取JSON配置文件 ${name} 时发生错误:`, error);
        return '';
    }
}

/**
 * 合并角色配置
 * @param {string} userConfigPath - 用户配置文件路径
 * @param {string} defaultConfigPath - 默认配置文件路径
 * @returns {string} 返回合并后的JSON字符串
 */
function getMergedRoleConfig(userConfigPath, defaultConfigPath) {
    try {
        let mergedRoles = [];

        if (fs.existsSync(defaultConfigPath)) {
            try {
                const defaultContent = fs.readFileSync(defaultConfigPath, 'utf8');
                const defaultRoles = JSON.parse(defaultContent);
                if (Array.isArray(defaultRoles)) {
                    const markedDefaultRoles = defaultRoles.map(role => ({
                        ...role,
                        _isDefault: true
                    }));
                    mergedRoles = [...markedDefaultRoles];
                }
            } catch (error) {
                console.error('载入预设角色配置失败:', error);
            }
        }

        if (fs.existsSync(userConfigPath)) {
            try {
                const userContent = fs.readFileSync(userConfigPath, 'utf8');
                const userRoles = JSON.parse(userContent);
                if (Array.isArray(userRoles)) {
                    mergedRoles = [...mergedRoles, ...userRoles];
                }
            } catch (error) {
                console.error('载入用户角色配置失败:', error);
            }
        }

        return JSON.stringify(mergedRoles);
    } catch (error) {
        console.error('合并角色配置时发生错误:', error);
        if (fs.existsSync(userConfigPath)) {
            return fs.readFileSync(userConfigPath, 'utf8');
        } else if (fs.existsSync(defaultConfigPath)) {
            return fs.readFileSync(defaultConfigPath, 'utf8');
        }
        return '[]';
    }
}

/**
 * 写入JSON配置文件
 * @param {string} name - 文件名（不含扩展名）
 * @param {string} content - 文件内容
 * @returns {boolean} 返回是否写入成功
 */
export function setJsonConfig(name, content) {
    try {
        const configDir = path.join(Plugin_Path, 'config', 'config');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        if (name === 'RoleProfile') {
            return setUserRoleConfig(content);
        }

        const configPath = path.join(configDir, `${name}.json`);
        fs.writeFileSync(configPath, content, 'utf8');
        console.log(`JSON配置文件 ${name} 已成功保存到 config 目录。`);
        return true;
    } catch (error) {
        console.error(`写入JSON配置文件 ${name} 时发生错误:`, error);
        return false;
    }
}

/**
 * 保存用户角色配置
 * @param {string} mergedContent - 合并后的角色配置JSON字符串
 * @returns {boolean} 返回是否写入成功
 */
function setUserRoleConfig(mergedContent) {
    try {
        const userConfigPath = path.join(Plugin_Path, 'config', 'config', 'RoleProfile.json');
        const defaultConfigPath = path.join(Plugin_Path, 'config', 'default_config', 'RoleProfile.json');

        const mergedRoles = JSON.parse(mergedContent);
        if (!Array.isArray(mergedRoles)) {
            throw new Error('角色配置格式错误：应为数组');
        }

        const userRoles = mergedRoles.filter(role => !role._isDefault);

        const cleanUserRoles = userRoles.map(role => {
            const { _isDefault, ...cleanRole } = role;
            return cleanRole;
        });

        fs.writeFileSync(userConfigPath, JSON.stringify(cleanUserRoles, null, 2), 'utf8');
        console.log(`[角色配置] 已保存 ${cleanUserRoles.length} 个用户自定义角色到 config 目录`);
        return true;
    } catch (error) {
        console.error('保存用户角色配置时发生错误:', error);
        return false;
    }
}

export default {
    getJsonConfig,
    setJsonConfig
};
