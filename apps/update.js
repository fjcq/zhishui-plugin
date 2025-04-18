/* eslint-disable import/no-unresolved */
import { common } from "../model/index.js"
import { Plugin_Name } from "../components/index.js"
import { update } from "../../other/update.js"

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
        const up = new update()
        await up.init(e)
        return up.update()
    }

    async update_log() {
        // eslint-disable-next-line new-cap
        let Update_Plugin = new update()
        Update_Plugin.e = this.e
        Update_Plugin.reply = this.reply

        if (Update_Plugin.getPlugin(Plugin_Name)) {
            this.e.reply(await Update_Plugin.getLog(Plugin_Name))
        }
        return true
    }
}
