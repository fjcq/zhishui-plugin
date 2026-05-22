/**
 * 统一日志模块
 * 提供统一的日志接口，避免直接依赖全局变量
 */

/**
 * 获取日志实例
 * 优先使用宿主框架提供的 logger，否则回退到 console
 * @returns {object} 日志实例
 */
function getLogger() {
    return global.logger || console;
}

const logger = getLogger();

export default logger;
