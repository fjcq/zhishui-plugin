import { Version } from "../components/index.js"
import { puppeteer } from "../model/index.js"

export class NewVersion extends plugin {
  constructor() {
    super({
      name: "止水版本信息",
      event: "message",
      priority: 400,
      rule: [
        {
          reg: "^#?止水(插件)?版本$",
          fnc: "plugin_version"
        }
      ]
    })
  }

  async plugin_version(e) {
    return await puppeteer.render(
      "help/version-info",
      {
        currentVersion: Version.ver,
        changelogs: Version.logs,
        elem: "cryo"
      },
      { e, scale: 1.4 }
    )
  }
}
