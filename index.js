import Ver from './components/Version.js'
import fs from 'fs'
import chalk from 'chalk'

logger.info(chalk.yellow(`止水插件${Ver.ver} 正在加载...`))

//检查依赖
import { checkPackage } from './components/check.js'
let passed = await checkPackage()
if (!passed) {
    throw '缺少必要的依赖项'
}

if (!global.segment) {
    try {
        global.segment = (await import('oicq')).segment
    } catch (err) {
        global.segment = (await import('icqq')).segment
    }
}

let ret = []
const files = fs
    .readdirSync('./plugins/zhishui-plugin/apps')
    .filter((file) => file.endsWith('.js'))

files.forEach((file) => {
    ret.push(import(`./apps/${file}`))
})

ret = await Promise.allSettled(ret)

let apps = {}
for (let i in files) {
    let name = files[i].replace('.js', '')

    if (ret[i].status != 'fulfilled') {
        logger.error(`载入插件错误：${logger.red(name)}`)
        logger.error(ret[i].reason)
        continue
    }
    apps[name] = ret[i].value[Object.keys(ret[i].value)[0]]
}
logger.info(chalk.yellow(`止水插件 加载完成~！`))
export { apps }