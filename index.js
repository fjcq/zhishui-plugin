import Ver from './components/Version.js'
import fs from 'fs'
import path from 'path'
import chalk from 'chalk'

logger.info(chalk.yellow(`止水插件 v${Ver.ver} 正在加载...`))

// 检查依赖
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

const appsDir = path.join('./plugins/zhishui-plugin/apps')
if (!fs.existsSync(appsDir)) {
    logger.error(chalk.red('apps 目录不存在！'))
    throw new Error('apps 目录不存在')
}

let files = fs
    .readdirSync(appsDir)
    .filter((file) => file.endsWith('.js'))

let ret = await Promise.allSettled(
    files.map((file) => import(`./apps/${file}`))
)

let apps = {}
for (let i in files) {
    let name = files[i].replace('.js', '')
    if (ret[i].status != 'fulfilled') {
        logger.error(`载入插件错误：${chalk.red(name)}`)
        logger.error(ret[i].reason)
        continue
    }
    // 取模块默认导出或第一个导出
    apps[name] = ret[i].value[Object.keys(ret[i].value)[0]]
}
logger.info(chalk.yellow(`止水插件 加载完成~！`))
export { apps }