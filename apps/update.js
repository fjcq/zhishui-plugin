/* eslint-disable import/no-unresolved */
import { common } from "../model/index.js"
import { Plugin_Name } from "../components/index.js"
let Update = null
try {
    Update = (await import("../model/update.js").catch(e => null))?.update
    Update ||= (await import("./system/update.js")).update
    if (!Update) throw new Error('Update component not found')
} catch (e) {
    logger.error(`[止水插件]模块加载失败: ${e.message}`)
    logger.debug(e.stack)
    logger.mark(`请尝试执行 ${logger.yellow("#止水强制更新")} 修复问题`)
}

export class zhishuiUpdate extends plugin {
    constructor() {
        super({
            name: "止水更新插件",
            event: "message",
            priority: 1000,
            rule: [
                {
                    reg: "^#*止水(插件)?(强制)?更新$",
                    fnc: "update"
                },
                {
                    reg: "^#?止水(插件)?更新日志$",
                    fnc: "update_log"
                }
            ]
        })
    }

    async update(e = this.e) {
        if (!common.checkPermission(e, "master")) return
        e.msg = `#${e.msg.includes("强制") ? "强制" : ""}更新止水插件`
        const up = new Update()
        await up.init(e)
        return up.update()
    }

    async update_log() {
        // eslint-disable-next-line new-cap
        let Update_Plugin = new Update()
        Update_Plugin.e = this.e
        Update_Plugin.reply = this.reply

        if (Update_Plugin.getPlugin(Plugin_Name)) {
            this.e.reply(await Update_Plugin.getLog(Plugin_Name))
        }
        return true
    }
}
