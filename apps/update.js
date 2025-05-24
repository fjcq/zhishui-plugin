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
        // 检查管理员权限
        if (!common.checkPermission(e, "master")) {
            return this.reply('⚠️ 更新失败：需要管理员权限')
        }

        try {
            e.isMaster = true
            e.msg = `#${e.msg.includes("强制") ? "强制" : ""}更新zhishui-plugin`
            const up = new update()  // 注意保持小写
            up.e = e
            return up.update()
        } catch (err) {
            // 返回详细的错误信息给用户
            return this.reply(`⚠️ 更新出错：${err.message}\n请查看日志获取详细信息`)
        }
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
