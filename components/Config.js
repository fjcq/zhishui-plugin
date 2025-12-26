import YAML from 'yaml';
import chokidar from 'chokidar';
import fs from 'node:fs';
import YamlReader from './YamlReader.js';
import _ from 'lodash';

const Path = process.cwd();
const Plugin_Name = 'zhishui-plugin';
const Plugin_Path = `${Path}/plugins/${Plugin_Name}`;
class Config {
    constructor() {
        this.config = {};

        /** 监听文件 */
        this.watcher = { config: {}, defSet: {} };

        this.initCfg();
    }

    /** 初始化配置 */
    initCfg() {
        let path = `${Plugin_Path}/config/config/`;
        let pathDef = `${Plugin_Path}/config/default_config/`;
        const files = fs.readdirSync(pathDef).filter(file => file.endsWith('.yaml'));
        for (let file of files) {
            if (!fs.existsSync(`${path}${file}`)) {
                fs.copyFileSync(`${pathDef}${file}`, `${path}${file}`);
            }
            this.watch(`${path}${file}`, file.replace('.yaml', ''), 'config');
        }
    }


    /** 获取全局设置 */
    get whole() {
        return this.getDefOrConfig("whole")
    }

    /** 群配置 */
    getGroup(groupId = '') {
        let config = this.getConfig('whole');
        let group = this.getConfig('group');
        let defCfg = this.getdefSet('whole');

        if (group[groupId]) {
            return { ...defCfg, ...config, ...group[groupId] };
        }
        return { ...defCfg, ...config };
    }

    /** 获取全局设置 */
    get Notice() {
        return this.getDefOrConfig('whole');
    }

    /** 获取搜剧设置 */
    get SearchVideos() {
        return this.getDefOrConfig('souju');
    }

    /** 获取对话设置 */
    get Chat() {
        return this.getDefOrConfig('duihua');
    }

    /** 获取演奏设置 */
    get YanZou() {
        return this.getDefOrConfig('yanzou');
    }


    /** 代理 */
    get proxy() {
        return this.getDefOrConfig('proxy');
    }

    /** 默认配置和用户配置 */
    getDefOrConfig(name) {
        let def = this.getdefSet(name);
        let config = this.getConfig(name);
        return { ...def, ...config };
    }

    /** 默认配置 */
    getdefSet(name) {
        return this.getYaml('default_config', name);
    }

    /** 用户配置 */
    getConfig(name) {
        return this.getYaml('config', name);
    }

    /**
     * 获取配置yaml
     * @param type 默认跑配置-defSet，用户配置-config
     * @param name 名称
     */
    getYaml(type, name) {
        let file = `${Plugin_Path}/config/${type}/${name}.yaml`;
        let key = `${type}.${name}`;

        if (this.config[key]) return this.config[key];

        this.config[key] = YAML.parse(
            fs.readFileSync(file, 'utf8')
        );

        this.watch(file, name, type);

        return this.config[key];
    }

    /**
     * 读取JSON配置文件（优先config目录，不存在则使用default_config目录）
     * @param {string} name - 文件名（不含扩展名，如 'RoleProfile' 或 'SystemConfig'）
     * @returns {string} 返回文件内容字符串
     */
    getJsonConfig(name) {
        try {
            const userConfigPath = `${Plugin_Path}/config/config/${name}.json`;
            const defaultConfigPath = `${Plugin_Path}/config/default_config/${name}.json`;

            // 特殊处理角色配置：合并两个目录的内容
            if (name === 'RoleProfile') {
                return this.getMergedRoleConfig(userConfigPath, defaultConfigPath);
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
     * 合并角色配置：同时载入默认配置和用户自定义配置
     * @param {string} userConfigPath - 用户配置文件路径
     * @param {string} defaultConfigPath - 默认配置文件路径
     * @returns {string} 返回合并后的JSON字符串
     */
    getMergedRoleConfig(userConfigPath, defaultConfigPath) {
        try {
            let mergedRoles = [];
            let userRoleCount = 0;
            let defaultRoleCount = 0;

            // 先载入默认配置（放在前面，并标记为预设角色）
            if (fs.existsSync(defaultConfigPath)) {
                try {
                    const defaultContent = fs.readFileSync(defaultConfigPath, 'utf8');
                    const defaultRoles = JSON.parse(defaultContent);
                    if (Array.isArray(defaultRoles)) {
                        // 为预设角色添加标记
                        const markedDefaultRoles = defaultRoles.map(role => ({
                            ...role,
                            _isDefault: true  // 添加内部标记
                        }));
                        mergedRoles = [...markedDefaultRoles];
                        defaultRoleCount = defaultRoles.length;
                        // console.log(`[角色配置] 已载入 ${defaultRoles.length} 个预设角色`); // 只在出错时输出日志
                    }
                } catch (error) {
                    console.error('载入预设角色配置失败:', error);
                }
            }

            // 再载入用户自定义配置（放在后面）
            if (fs.existsSync(userConfigPath)) {
                try {
                    const userContent = fs.readFileSync(userConfigPath, 'utf8');
                    const userRoles = JSON.parse(userContent);
                    if (Array.isArray(userRoles)) {
                        mergedRoles = [...mergedRoles, ...userRoles];
                        userRoleCount = userRoles.length;
                        // console.log(`[角色配置] 已载入 ${userRoles.length} 个用户自定义角色`); // 只在出错时输出日志
                    }
                } catch (error) {
                    console.error('载入用户角色配置失败:', error);
                }
            }

            // console.log(`[角色配置] 总共载入 ${mergedRoles.length} 个角色（${defaultRoleCount} 个默认 + ${userRoleCount} 个自定义）`); // 只在出错时输出日志
            return JSON.stringify(mergedRoles);
        } catch (error) {
            console.error('合并角色配置时发生错误:', error);
            // 发生错误时，尝试返回任一可用的配置
            if (fs.existsSync(userConfigPath)) {
                return fs.readFileSync(userConfigPath, 'utf8');
            } else if (fs.existsSync(defaultConfigPath)) {
                return fs.readFileSync(defaultConfigPath, 'utf8');
            }
            return '[]';
        }
    }

    /**
     * 写入JSON配置文件（写入到config目录）
     * @param {string} name - 文件名（不含扩展名，如 'RoleProfile' 或 'SystemConfig'）
     * @param {string} content - 文件内容
     * @returns {boolean} 返回是否写入成功
     */
    setJsonConfig(name, content) {
        try {
            const configDir = `${Plugin_Path}/config/config`;
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }

            // 特殊处理角色配置：只保存用户新增的角色到用户配置目录
            if (name === 'RoleProfile') {
                return this.setUserRoleConfig(content);
            }

            const configPath = `${configDir}/${name}.json`;
            fs.writeFileSync(configPath, content, 'utf8');
            console.log(`JSON配置文件 ${name} 已成功保存到 config 目录。`);
            return true;
        } catch (error) {
            console.error(`写入JSON配置文件 ${name} 时发生错误:`, error);
            return false;
        }
    }

    /**
     * 保存用户角色配置：从合并后的角色列表中提取用户新增的角色
     * @param {string} mergedContent - 合并后的角色配置JSON字符串
     * @returns {boolean} 返回是否写入成功
     */
    setUserRoleConfig(mergedContent) {
        try {
            const userConfigPath = `${Plugin_Path}/config/config/RoleProfile.json`;
            const defaultConfigPath = `${Plugin_Path}/config/default_config/RoleProfile.json`;

            // 解析合并后的角色列表
            const mergedRoles = JSON.parse(mergedContent);
            if (!Array.isArray(mergedRoles)) {
                throw new Error('角色配置格式错误：应为数组');
            }

            // 获取预设角色数量
            let defaultRoleCount = 0;
            if (fs.existsSync(defaultConfigPath)) {
                try {
                    const defaultContent = fs.readFileSync(defaultConfigPath, 'utf8');
                    const defaultRoles = JSON.parse(defaultContent);
                    if (Array.isArray(defaultRoles)) {
                        defaultRoleCount = defaultRoles.length;
                    }
                } catch (error) {
                    console.warn('读取预设角色配置失败，将保存全部非预设角色:', error.message);
                }
            }

            // 提取用户自定义角色（排除标记为预设的角色）
            const userRoles = mergedRoles.filter(role => !role._isDefault);

            // 清理内部标记字段
            const cleanUserRoles = userRoles.map(role => {
                const { _isDefault, ...cleanRole } = role;
                return cleanRole;
            });

            // 写入用户配置文件
            fs.writeFileSync(userConfigPath, JSON.stringify(cleanUserRoles, null, 2), 'utf8');
            console.log(`[角色配置] 已保存 ${cleanUserRoles.length} 个用户自定义角色到 config 目录`);
            return true;
        } catch (error) {
            console.error('保存用户角色配置时发生错误:', error);
            return false;
        }
    }

    /** 监听配置文件 */
    watch(file, name, type = 'default_config') {
        let key = `${type}.${name}`;

        if (this.watcher[key]) return;

        const watcher = chokidar.watch(file);
        watcher.on('change', path => {
            delete this.config[key];
            if (typeof Bot == 'undefined') return;
            logger.mark(`[止水修改配置文件][${type}][${name}]`);
            if (this[`change_${name}`]) {
                this[`change_${name}`]();
            }
        });

        this.watcher[key] = watcher;
    }

    /**
     * @description: 修改设置
     * @param {String} name 文件名
     * @param {String} key 修改的key值
     * @param {String|Number} value 修改的value值
     * @param {'config'|'default_config'} type 配置文件或默认
     * @returns {Boolean} 修改成功返回true，失败返回false
     */
    async modify(name, key, value, type = 'config') {
        try {
            let path = `${Plugin_Path}/config/${type}/${name}.yaml`;
            new YamlReader(path).set(key, value);
            delete this.config[`${type}.${name}`];
            return true; // 操作成功返回true
        } catch (error) {
            console.error(`[止水插件] 配置修改失败: ${error.message}`);
            return false; // 操作失败返回false
        }
    }

    /**
     * @description: 群单独设置
     * @param {String|Number} groupId 群号
     * @param {String} key 设置项
     * @param {unknown} value
     */
    aloneModify(groupId, key, value, isDel) {
        let path = `${Plugin_Path}/config/config/group.yaml`;
        let yaml = new YamlReader(path);
        let groupCfg = yaml.jsonData[groupId] ?? {};
        isDel ? delete groupCfg[key] : groupCfg[key] = value;
        yaml.set(groupId, groupCfg);
        delete this.config['config.group'];
    }

    /**
     * @description: 修改配置数组
     * @param {String} name 文件名
     * @param {String|Number} key key值
     * @param {String|Number} value value
     * @param {'add'|'del'} category 类别 add or del
     * @param {'config'|'default_config'} type 配置文件或默认
     */
    async modifyarr(name, key, value, category = 'add', type = 'config') {
        let path = `${Plugin_Path}/config/${type}/${name}.yaml`;
        let yaml = new YamlReader(path);
        if (category == 'add') {
            yaml.addIn(key, value);
        } else {
            let index = yaml.jsonData[key].indexOf(value);
            yaml.delete(`${key}.${index}`);
        }
    }


    /**
     * 获取用户搜剧配置
     * @description: 获取用户搜剧配置
     * @param {String} qq 用户QQ号码
     * @param {String} keys key值，支持数组
    */
    async GetUserSearchVideos(qq, keys) {
        if (typeof keys === 'string') {
            // 单个键查询，直接返回结果
            const path = `zhishui:SearchVideos:${qq.toString()}:${keys}`;
            const value = await redis.get(path);
            return value !== null && value !== undefined ? value : '';
        } else {
            try {
                let promises = keys.map(async (key) => {
                    const path = `zhishui:SearchVideos:${qq.toString()}:${key}`;
                    const value = await redis.get(path);
                    return value !== null && value !== undefined ? value : '';
                });

                const results = await Promise.all(promises);

                return keys.reduce((acc, key, index) => {
                    acc[key] = results[index];
                    return acc;
                }, {});
            } catch (error) {
                logger.error(`获取 [${qq}] 搜剧记录 时发生错误：${error.message}`);
                throw error;
            }

        }

    }

    /**
   * @description: 写入用户搜剧配置
   * @param {String} qq 用户QQ号码
   * @param {String} key key值
   * @param {String|Number} value value
   */
    async SetUserSearchVideos(qq, key, value) {
        try {
            const path = `zhishui:SearchVideos:${qq.toString()}:${key}`;
            const ret = await redis.set(path, value);
            return ret;
        } catch (error) {
            logger.error(`为 [${qq}] 设置 ${key} : ${value} 时，发生错误：${error.message}`);
            throw error;
        }
    }

    /**
     * 获取用户对话配置
     * @description: 获取用户私聊对话配置
     * @param {String} qq 用户QQ号码
     * @param {String} keys key值，支持数组
     */
    async GetUserChatConfig(qq, keys) {
        if (typeof keys === 'string') {
            // 单个键查询，直接返回结果
            const path = `zhishui:ChatConfig:${qq.toString()}:${keys}`;
            const value = await redis.get(path);
            return value !== null && value !== undefined ? JSON.parse(value) : null;
        } else {
            try {
                let promises = keys.map(async (key) => {
                    const path = `zhishui:ChatConfig:${qq.toString()}:${key}`;
                    const value = await redis.get(path);
                    return value !== null && value !== undefined ? JSON.parse(value) : null;
                });

                const results = await Promise.all(promises);

                return keys.reduce((acc, key, index) => {
                    acc[key] = results[index];
                    return acc;
                }, {});
            } catch (error) {
                logger.error(`获取 [${qq}] 对话配置 时发生错误：${error.message}`);
                throw error;
            }
        }
    }

    /**
     * @description: 写入用户对话配置
     * @param {String} qq 用户QQ号码
     * @param {String} key key值
     * @param {String|Number|Object} value value
     */
    async SetUserChatConfig(qq, key, value) {
        try {
            const path = `zhishui:ChatConfig:${qq.toString()}:${key}`;
            const ret = await redis.set(path, JSON.stringify(value));
            return ret;
        } catch (error) {
            logger.error(`为 [${qq}] 设置对话配置 ${key} : ${value} 时，发生错误：${error.message}`);
            throw error;
        }
    }

    /**
     * @description: 删除用户对话配置
     * @param {String} qq 用户QQ号码
     * @param {String} key key值
     */
    async DeleteUserChatConfig(qq, key) {
        try {
            const path = `zhishui:ChatConfig:${qq.toString()}:${key}`;
            const ret = await redis.del(path);
            return ret;
        } catch (error) {
            logger.error(`删除 [${qq}] 对话配置 ${key} 时，发生错误：${error.message}`);
            throw error;
        }
    }

}
export default new Config();
