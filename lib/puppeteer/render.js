import fs from "fs"
import { Config, Data, Plugin_Name, Version } from "../../components/index.js"
import puppeteer from "../../../../lib/puppeteer/puppeteer.js"
const _path = process.cwd()

export default class {
    /**
     * 渲染HTML
     * @param {string} path 文件路径
     * @param {object} params 参数
     * @param {object} cfg
     */
    async render(path, params, cfg) {
        let [app, tpl] = path.split("/")
        let { e } = cfg
        let layoutPath =
            process.cwd() + `/plugins/${Plugin_Name}/resources/common/layout/`
        let resPath = `../../../../../plugins/${Plugin_Name}/resources/`
        Data.createDir(`data/html/${Plugin_Name}/${app}/${tpl}`, "root")
        let data = {
            ...params,
            _plugin: Plugin_Name,
            saveId: params.saveId || params.save_id || tpl,
            tplFile: `./plugins/${Plugin_Name}/resources/${app}/${tpl}.html`,
            pluResPath: resPath,
            _res_path: resPath,
            _layout_path: layoutPath,
            _tpl_path:
                process.cwd() + `/plugins/${Plugin_Name}/resources/common/tpl/`,
            defaultLayout: layoutPath + "default.html",
            elemLayout: layoutPath + "elem.html",
            pageGotoParams: {
                waitUntil: "networkidle0"
            },
            sys: {
                scale: this.#scale(cfg.scale || 1),
                copyright: params.copyright || `Created By ${Version.name}<span class="version">${Version.yunzai}</span> & 止水插件<span class="version">v${Version.ver}</span>`
            },
            quality: 100
        }
        if (process.argv.includes("debug")) {
            // debug下保存当前页面的渲染数据，方便模板编写与调试
            // 由于只用于调试，开发者只关注自己当时开发的文件即可，暂不考虑app及plugin的命名冲突
            let saveDir = _path + "/data/ViewData/"
            if (!fs.existsSync(saveDir)) {
                fs.mkdirSync(saveDir)
            }
            let file = saveDir + tpl + ".json"
            data._app = app
            fs.writeFileSync(file, JSON.stringify(data))
        }
        let base64 = await puppeteer.screenshot(`${Plugin_Name}/${app}/${tpl}`, data)
        let ret = true
        if (base64) {
            ret = await this.safeReply(e, base64)
        }
        return cfg.retMsgId ? ret : true
    }

    /**
     * 渲染HTML为图片段（不自动发送）
     * 用于需要手动控制发送目标的场景，如工具发送私聊/群聊消息
     * @param {string} path 文件路径
     * @param {object} params 参数
     * @param {object} cfg 配置（不需要e对象）
     * @returns {Promise<object|null>} 图片消息段，失败返回null
     */
    async renderToSegment(path, params, cfg = {}) {
        let [app, tpl] = path.split("/")
        let layoutPath =
            process.cwd() + `/plugins/${Plugin_Name}/resources/common/layout/`
        let resPath = `../../../../../plugins/${Plugin_Name}/resources/`
        Data.createDir(`data/html/${Plugin_Name}/${app}/${tpl}`, "root")
        let data = {
            ...params,
            _plugin: Plugin_Name,
            saveId: params.saveId || params.save_id || tpl,
            tplFile: `./plugins/${Plugin_Name}/resources/${app}/${tpl}.html`,
            pluResPath: resPath,
            _res_path: resPath,
            _layout_path: layoutPath,
            _tpl_path:
                process.cwd() + `/plugins/${Plugin_Name}/resources/common/tpl/`,
            defaultLayout: layoutPath + "default.html",
            elemLayout: layoutPath + "elem.html",
            pageGotoParams: {
                waitUntil: "networkidle0"
            },
            sys: {
                scale: this.#scale(cfg.scale || 1),
                copyright: params.copyright || `Created By ${Version.name}<span class="version">${Version.yunzai}</span> & 止水插件<span class="version">v${Version.ver}</span>`
            },
            quality: 100
        }
        let imgSegment = await puppeteer.screenshot(`${Plugin_Name}/${app}/${tpl}`, data)
        return imgSegment || null
    }

    #scale(pct = 1) {
        let scale = Config.whole.renderScale
        scale = Math.min(2, Math.max(0.5, scale / 100))
        pct = pct * scale
        return `style='transform:scale(${pct})'`
    }

    /**
     * 带重试的安全消息发送
     * 处理NTQQ客户端超时问题（retcode 1200）
     * @param {object} e - 事件对象
     * @param {*} content - 消息内容
     * @param {number} maxRetries - 最大重试次数
     * @param {number} retryDelay - 重试延迟(ms)
     * @returns {Promise<*>} 发送结果
     */
    async safeReply(e, content, maxRetries = 2, retryDelay = 1000) {
        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
            try {
                const ret = await e.reply(content);
                if (attempt > 1) {
                    logger.info(`[止水渲染] 图片发送重试成功 (第${attempt}次)`);
                }
                return ret;
            } catch (error) {
                lastError = error;
                const isTimeout = error.message?.includes('Timeout') ||
                    error.message?.includes('NTEvent') ||
                    error.error?.retcode === 1200;

                if (isTimeout && attempt <= maxRetries) {
                    logger.warn(`[止水渲染] 图片发送超时，${retryDelay}ms后重试 (第${attempt}/${maxRetries}次)`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    retryDelay *= 1.5;
                } else {
                    logger.error(`[止水渲染] 图片发送失败: ${error.message}`);
                    break;
                }
            }
        }

        throw lastError;
    }
}
