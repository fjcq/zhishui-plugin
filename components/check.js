import chalk from 'chalk';

/** 依赖库列表 */
export const needPackage = [
    'yaml',
    'fetch-undici',
    'keyv-file',
    'undici',
    'tencentcloud-sdk-nodejs',
];

/** 检查依赖库 */
export async function checkPackage() {
    for (let pkgName of needPackage) {
        try {
            await import(pkgName);
        } catch (e) {
            packageTips(e);
            return false;
        }
    }
    return true;
}

function extractPackageName(errorStack) {
    return errorStack.match(/'(.+?)'/)[0].replace(/'/g, '');
}

export function packageTips(error) {
    const loggerMark = logger.mark.bind(logger);

    loggerMark('---- 止水插件启动失败 ----');
    const missingPackage = chalk.red(extractPackageName(error.stack));
    loggerMark(`缺少依赖：${missingPackage}`);
    loggerMark(`请执行安装依赖命令：pnpm install --filter=zhishui-plugin`);
    loggerMark('---------------------');
}