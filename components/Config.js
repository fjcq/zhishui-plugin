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

}
export default new Config();
