import chalk from 'chalk'

export const needPackage = [
    'yaml',
    'fetch-undici',
    'keyv',
    'keyv-file',
    'undici',
    'ws'
]

export async function checkPackage() {
    for (let pkgName of needPackage) {
        try {
            await import(pkgName)
        } catch (e) {
            packageTips(e)
            return false
        }
    }
    return true
}

export function packageTips(error) {
    logger.mark('---- 止水插件启动失败 ----')
    let pack = error.stack.match(/'(.+?)'/g)[0].replace(/'/g, '')
    logger.mark(`缺少依赖：${chalk.red(pack)}`)
    logger.mark(`请执行安装依赖命令：pnpm install --filter=zhishui-plugin`)
    logger.mark('---------------------')
}
