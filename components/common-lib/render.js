import { Data, Version } from '../index.js'
import Cfg from '../Cfg.js'
import fs from 'fs'
import { puppeteer } from '../../adapter/index.js'

const plugin = 'earth-k-plugin'
const _path = process.cwd()

export default async function (path, params, cfg) {
  let [app, tpl] = path.split('/')
  let { e } = cfg
  let layoutPath = process.cwd() + '/plugins/earth-k-plugin/resources/common/layout/'
  let resPath = `../../../../../plugins/${plugin}/resources/`
  Data.createDir(`data/html/${plugin}/${app}/${tpl}`, 'root')
  let data = {
    ...params,
    _plugin: plugin,
    saveId: params.saveId || params.save_id || tpl,
    tplFile: `./plugins/${plugin}/resources/${app}/${tpl}.html`,
    pluResPath: resPath,
    _res_path: resPath,
    _layout_path: layoutPath,
    _tpl_path: process.cwd() + '/plugins/earth-k-plugin/resources/common/tpl/',
    defaultLayout: layoutPath + 'default.html',
    elemLayout: layoutPath + 'elem.html',
    pageGotoParams: {
      waitUntil: 'networkidle0'
    },
    sys: {
      scale: Cfg.scale(cfg.scale || 1),
      copyright: `Created By Yunzai-Bot<span class="version">${Version.yunzai}</span> & Earth-K-Plugin<span class="version">${Version.version}</span>`
    }
  }
  if (process.argv.includes('web-debug')) {
    // debug下保存当前页面的渲染数据，方便模板编写与调试
    // 由于只用于调试，开发者只关注自己当时开发的文件即可，暂不考虑app及plugin的命名冲突
    let saveDir = _path + '/data/ViewData/'
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir)
    }
    let file = saveDir + tpl + '.json'
    data._app = app
    fs.writeFileSync(file, JSON.stringify(data))
  }
  let base64 = await puppeteer.screenshot(`earth-k-plugin/${app}/${tpl}`, data)
  let ret = true
  if (base64) {
    ret = await e.reply(base64)
  }
  return cfg.retMsgId ? ret : true
}
