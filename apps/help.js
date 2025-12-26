import plugin from '../../../lib/plugins/plugin.js'
import { helpReg } from './help/config.js'
import { help } from './help/helpers.js'

export class ZhishuiHelp extends plugin {
  constructor () {
    super({
      name: '[止水插件]帮助',
      event: 'message',
      priority: 2000,
      rule: [
        {
          reg: helpReg,
          fnc: 'HelpMessage'
        }
      ]
    })
  }

  async HelpMessage () {
    return await help(this.e)
  }
}
