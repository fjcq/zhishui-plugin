/**
 * YAML配置管理模块
 * 处理YAML格式的配置文件读写和监听
 */

import YAML from 'yaml';
import chokidar from 'chokidar';
import fs from 'node:fs';
import path from 'node:path';
import YamlReader from './YamlReader.js';

const Path = process.cwd();
const Plugin_Name = 'zhishui-plugin';
const Plugin_Path = path.join(Path, 'plugins', Plugin_Name);

const logger = global.logger || console;

/**
 * YAML配置管理类
 */
class YamlConfigManager {
    constructor() {
        this.config = {};
        this.watcher = { config: {}, defSet: {} };
        this.initCfg();
    }

    /**
     * 初始化配置
     */
    initCfg() {
        let configPath = path.join(Plugin_Path, 'config', 'config');
        let pathDef = path.join(Plugin_Path, 'config', 'default_config');
        const files = fs.readdirSync(pathDef).filter(file => file.endsWith('.yaml'));
        for (let file of files) {
            if (!fs.existsSync(path.join(configPath, file))) {
                fs.copyFileSync(path.join(pathDef, file), path.join(configPath, file));
            }
            this.watch(path.join(configPath, file), file.replace('.yaml', ''), 'config');
        }
    }

    /**
     * 获取全局设置
     */
    get whole() {
        return this.getDefOrConfig("whole");
    }

    /**
     * 群配置
     * @param {String} groupId - 群号
     * @returns {Object} 群配置
     */
    getGroup(groupId = '') {
        let config = this.getConfig('whole');
        let group = this.getConfig('group');
        let defCfg = this.getdefSet('whole');

        if (group[groupId]) {
            return { ...defCfg, ...config, ...group[groupId] };
        }
        return { ...defCfg, ...config };
    }

    /**
     * 获取全局设置
     */
    get Notice() {
        return this.getDefOrConfig('whole');
    }

    /**
     * 获取搜剧设置
     */
    get SearchVideos() {
        return this.getDefOrConfig('videoSearch');
    }

    /**
     * 获取对话设置
     */
    get Chat() {
        return this.getDefOrConfig('chat');
    }

    /**
     * 获取演奏设置
     */
    get InstrumentPlay() {
        return this.getDefOrConfig('instrumentPlay');
    }

    /**
     * 获取语音设置
     */
    get Voice() {
        return this.getDefOrConfig('voice');
    }

    /**
     * 代理
     */
    get proxy() {
        return this.getDefOrConfig('proxy');
    }

    /**
     * 默认配置和用户配置
     * @param {String} name - 配置名称
     * @returns {Object} 合并后的配置
     */
    getDefOrConfig(name) {
        let def = this.getdefSet(name);
        let config = this.getConfig(name);
        return { ...def, ...config };
    }

    /**
     * 默认配置
     * @param {String} name - 配置名称
     * @returns {Object} 默认配置
     */
    getdefSet(name) {
        return this.getYaml('default_config', name);
    }

    /**
     * 用户配置
     * @param {String} name - 配置名称
     * @returns {Object} 用户配置
     */
    getConfig(name) {
        return this.getYaml('config', name);
    }

    /**
     * 获取配置yaml
     * @param {String} type - 配置类型
     * @param {String} name - 配置名称
     * @returns {Object} 配置对象
     */
    getYaml(type, name) {
        let file = path.join(Plugin_Path, 'config', type, `${name}.yaml`);
        let key = `${type}.${name}`;

        if (this.config[key]) return this.config[key];

        // 如果文件不存在，尝试从默认配置复制
        if (!fs.existsSync(file)) {
            let defPath = path.join(Plugin_Path, 'config', 'default_config', `${name}.yaml`);
            if (fs.existsSync(defPath)) {
                fs.copyFileSync(defPath, file);
            } else {
                // 如果默认配置也不存在，返回空对象
                this.config[key] = {};
                return {};
            }
        }

        this.config[key] = YAML.parse(
            fs.readFileSync(file, 'utf8')
        );

        this.watch(file, name, type);

        return this.config[key];
    }

    /**
     * 监听配置文件
     * @param {String} file - 文件路径
     * @param {String} name - 配置名称
     * @param {String} type - 配置类型
     */
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
     * 修改设置
     * @param {String} name - 文件名
     * @param {String} key - 修改的key值
     * @param {String|Number} value - 修改的value值
     * @param {'config'|'default_config'} type - 配置文件或默认
     * @returns {Boolean} 修改成功返回true，失败返回false
     */
    async modify(name, key, value, type = 'config') {
        try {
            let filePath = path.join(Plugin_Path, 'config', type, `${name}.yaml`);
            
            // 如果文件不存在，尝试从默认配置复制
            if (!fs.existsSync(filePath)) {
                let defPath = path.join(Plugin_Path, 'config', 'default_config', `${name}.yaml`);
                if (fs.existsSync(defPath)) {
                    fs.copyFileSync(defPath, filePath);
                    this.watch(filePath, name, type);
                } else {
                    // 如果默认配置也不存在，创建空文件
                    fs.writeFileSync(filePath, '{}', 'utf8');
                }
            }
            
            new YamlReader(filePath).set(key, value);
            delete this.config[`${type}.${name}`];
            return true;
        } catch (error) {
            console.error(`[止水插件] 配置修改失败: ${error.message}`);
            return false;
        }
    }

    /**
     * 群单独设置
     * @param {String|Number} groupId - 群号
     * @param {String} key - 设置项
     * @param {unknown} value - 设置值
     * @param {Boolean} isDel - 是否删除
     */
    aloneModify(groupId, key, value, isDel) {
        let filePath = path.join(Plugin_Path, 'config', 'config', 'group.yaml');
        let yaml = new YamlReader(filePath);
        let groupCfg = yaml.jsonData[groupId] ?? {};
        isDel ? delete groupCfg[key] : groupCfg[key] = value;
        yaml.set(groupId, groupCfg);
        delete this.config['config.group'];
    }

    /**
     * 修改配置数组
     * @param {String} name - 文件名
     * @param {String|Number} key - key值
     * @param {String|Number} value - value
     * @param {'add'|'del'} category - 类别
     * @param {'config'|'default_config'} type - 配置文件或默认
     */
    async modifyarr(name, key, value, category = 'add', type = 'config') {
        let filePath = path.join(Plugin_Path, 'config', type, `${name}.yaml`);
        let yaml = new YamlReader(filePath);
        if (category == 'add') {
            yaml.addIn(key, value);
        } else {
            let index = yaml.jsonData[key].indexOf(value);
            yaml.delete(`${key}.${index}`);
        }
    }
}

export default new YamlConfigManager();
