import plugin from '../../../lib/plugins/plugin.js'
import fs from 'fs'
import _ from 'lodash'
import { Data } from '../components/index.js'
import { puppeteer } from '../model/index.js'
const helpType = {
  搜剧: 'souju',
  对话: 'duihua'
}
const helpReg = new RegExp(
  `^#?止水(插件)?(${Object.keys(helpType).join('|')})?(帮助|菜单|功能)$`
)
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

async function help (e) {
  let custom = {}
  // let help = {}
  const special = e.msg.match(helpReg)[2]

  let diyCfg, sysCfg
  if (special) {
    let gpAdminHelp = await Data.importCfg(helpType[special])
    diyCfg = gpAdminHelp.diyCfg
    sysCfg = gpAdminHelp.sysCfg
  } else {
    let indexHelp = await Data.importCfg('help')
    diyCfg = indexHelp.diyCfg
    sysCfg = indexHelp.sysCfg
  }

  // custom = help

  let helpConfig = _.defaults(diyCfg.helpCfg || {}, custom.helpCfg, sysCfg.helpCfg)
  let helpList = diyCfg.helpList || custom.helpList || sysCfg.helpList
  let helpGroup = []

  _.chain(helpList)
    .filter(group => !(group.auth === 'master' && !e.isMaster))
    .forEach(group => {
      _.forEach(group.list, help => {
        if (!help.icon * 1) {
          help.css = 'display:none'
        } else {
          const x = (help.icon - 1) % 10
          const y = (help.icon - x - 1) / 10
          help.css = `background-position:-${x * 50}px -${y * 50}px`
        }
      })
      helpGroup.push(group)
    })
    .value()
  return await puppeteer.render('help/index', {
    helpCfg: helpConfig,
    helpGroup,
    bg: await rodom(),
    colCount: 3,
    element: 'default'
  }, {
    e,
    scale: 1.6
  })
}

const rodom = async function () {
  let image = fs.readdirSync('./plugins/zhishui-plugin/resources/help/imgs/')
  let list_img = []
  for (let val of image) {
    list_img.push(val)
  }
  let imgs = list_img.length == 1 ? list_img[0] : list_img[_.random(0, list_img.length - 1)]
  return imgs
}
