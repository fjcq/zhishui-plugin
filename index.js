logger.info(chalk.yellow('正在加载 止水插件……'))

import { Data, Version } from './components/index.js'
import fs from "node:fs"
import chalk from 'chalk'

const files = fs
    .readdirSync("./plugins/zhishui-plugin/apps")
    .filter((file) => file.endsWith(".js"))

let ret = []

files.forEach((file) => {
    ret.push(import(`./apps/${file}`))
})

ret = await Promise.allSettled(ret)

let apps = {}
for (let i in files) {
    let name = files[i].replace(".js", "")

    if (ret[i].status != "fulfilled") {
        logger.error("载入插件错误：" + logger.red(name))
        logger.error(ret[i].reason)
        continue
    }

    apps[name] = ret[i].value[name]
}

export { apps }

logger.info(chalk.yellow(`止水插件${Version.version} 加载完成！`))
logger.info(chalk.yellow('-------------------------'))