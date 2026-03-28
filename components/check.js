import chalk from 'chalk';

/** 必需依赖库列表 */
export const needPackage = [
    'yaml',
    'fetch-undici',
    'keyv-file',
    'undici',
    'tencentcloud-sdk-nodejs',
];

/** 可选依赖库列表（缺失时仅影响部分功能） */
export const optionalPackage = [
    { name: '@meting/core', feature: '音乐搜索' },
];

/** 可选依赖检查结果 */
export const optionalPackageStatus = {};

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
    
    checkOptionalPackage();
    return true;
}

/** 检查可选依赖库 */
export async function checkOptionalPackage() {
    const loggerMark = logger.mark.bind(logger);
    let hasMissing = false;
    
    for (let pkg of optionalPackage) {
        try {
            await import(pkg.name);
            optionalPackageStatus[pkg.name] = true;
        } catch (e) {
            optionalPackageStatus[pkg.name] = false;
            if (!hasMissing) {
                loggerMark('---- 止水插件可选依赖提示 ----');
                hasMissing = true;
            }
            loggerMark(`可选依赖 ${chalk.yellow(pkg.name)} 未安装，${pkg.feature}功能将不可用`);
        }
    }
    
    if (hasMissing) {
        loggerMark('可执行安装命令: pnpm add @meting/core -w');
        loggerMark('---------------------');
    }
}

function extractPackageName(errorStack) {
    const match = errorStack.match(/'(.+?)'/);
    return match ? match[0].replace(/'/g, '') : null;
}

export function packageTips(error) {
    const loggerMark = logger.mark.bind(logger);

    loggerMark('---- 止水插件启动失败 ----');
    const missingPackage = chalk.red(extractPackageName(error.stack));
    loggerMark(`缺少依赖：${missingPackage}`);
    loggerMark(`请执行安装依赖命令：pnpm install --filter=zhishui-plugin`);
    loggerMark('---------------------');
}
