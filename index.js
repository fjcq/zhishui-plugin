import Ver from './components/Version.js'
import fs from "node:fs"
import chalk from 'chalk'

//检查依赖
import {checkPackage} from './components/check.js'
let passed = await checkPackage()
if (!passed) {
  throw 'Missing necessary dependencies'
}

const files = fs
    .readdirSync("./plugins/zhishui-plugin/apps")
    .filter((file) => file.endsWith(".js"));

let ret = []

logger.info(chalk.yellow(`正在加载 止水插件${Ver.ver}`))



files.forEach((file) => {
    ret.push(import(`./apps/${file}`))
})

if (!global.segment) {
    global.segment = (await import("oicq")).segment
  }
  
  if (!global.core) {
    try {
      global.core = (await import("oicq")).core
    } catch (err) {}
  }

ret = await Promise.allSettled(ret)

let apps = {}
for (let i in files) {
    let name = files[i].replace(".js", "")

    if (ret[i].status != "fulfilled") {
        logger.error("载入插件错误：" + logger.red(name))
        logger.error(ret[i].reason)
        continue
    }

    apps[name] = ret[i].value[Object.keys(ret[i].value)[0]]
}

export { apps }