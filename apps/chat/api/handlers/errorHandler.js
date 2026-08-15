/**
 * 错误处理器
 * 处理AI API通信过程中的各类错误，提供分类化的用户提示与主人通知
 */

import { Config, logger } from '../../../../components/index.js';
import { isBalanceErrorMessage } from '../../parsers/jsonParser.js';

/**
 * 主人通知冷却时间（秒）
 * 同一类错误每天最多通知一次
 */
const NOTIFICATION_COOLDOWN_SECONDS = 12 * 60 * 60;

/**
 * 内存级通知记录（Redis不可用时的降级方案）
 * @type {Map<string, boolean>}
 */
const memoryNotified = new Map();

/**
 * 检查错误消息是否包含余额或配额不足关键词
 * @param {Error} error - 错误对象
 * @returns {boolean} 是否为余额/配额不足错误
 */
function isBalanceError(error) {
    return isBalanceErrorMessage(error?.message);
}

/**
 * 检查错误消息是否包含API密钥相关关键词
 * @param {Error} error - 错误对象
 * @returns {boolean} 是否为API密钥错误
 */
function isApiKeyError(error) {
    if (!error || typeof error.message !== 'string') {
        return false;
    }
    const msg = error.message;
    return msg.includes('API密钥无效') ||
        msg.includes('invalid_api_key') ||
        msg.includes('Unauthorized') ||
        msg.includes('401');
}

/**
 * 检查错误消息是否包含地区限制关键词
 * @param {Error} error - 错误对象
 * @returns {boolean} 是否为地区限制错误
 */
function isRegionError(error) {
    if (!error || typeof error.message !== 'string') {
        return false;
    }
    const msg = error.message;
    return msg.includes('地区无法使用') ||
        msg.includes('User location is not supported');
}

/**
 * 检查错误消息是否包含频率限制关键词
 * @param {Error} error - 错误对象
 * @returns {boolean} 是否为频率限制错误
 */
function isRateLimitError(error) {
    if (!error || typeof error.message !== 'string') {
        return false;
    }
    const msg = error.message;
    return msg.includes('请求过于频繁') ||
        msg.includes('rate_limit_exceeded') ||
        msg.includes('429');
}

/**
 * 检查错误消息是否包含模型无效关键词
 * @param {Error} error - 错误对象
 * @returns {boolean} 是否为模型无效错误
 */
function isModelError(error) {
    if (!error || typeof error.message !== 'string') {
        return false;
    }
    const msg = error.message.toLowerCase();
    return msg.includes('model') && msg.includes('invalid');
}

/**
 * 从错误消息中提取HTTP状态码
 * @param {Error} error - 错误对象
 * @returns {number|null} 状态码，无法提取时返回null
 */
function extractHttpStatus(error) {
    if (!error || typeof error.message !== 'string') {
        return null;
    }
    const msg = error.message;

    const httpMatch = msg.match(/\bHTTP\s+(\d{3})\b/i);
    if (httpMatch) {
        return parseInt(httpMatch[1], 10);
    }

    const codeMatch = msg.match(/\b(\d{3})\b/);
    if (codeMatch) {
        const code = parseInt(codeMatch[1], 10);
        if (code >= 400 && code < 600) {
            return code;
        }
    }

    return null;
}

/**
 * 生成通知记录的Redis键名
 * @param {string|number} apiIndex - API配置索引
 * @param {string} errorType - 错误类型标识
 * @returns {string} Redis键名
 */
function getNotificationKey(apiIndex, errorType) {
    const date = new Date().toISOString().slice(0, 10);
    return `zhishui:master_notification:${errorType}:${apiIndex}:${date}`;
}

/**
 * 检查今日是否已向主人发送过同类通知
 * @param {string} key - 通知记录键名
 * @returns {Promise<boolean>} 是否已通知
 */
async function hasNotifiedToday(key) {
    try {
        const redisClient = globalThis.redis;
        if (redisClient?.get) {
            const value = await redisClient.get(key);
            return !!value;
        }
    } catch (redisError) {
        logger.warn(`[错误通知] Redis检查失败: ${redisError.message}`);
    }
    return memoryNotified.has(key);
}

/**
 * 标记今日已发送通知
 * @param {string} key - 通知记录键名
 * @returns {Promise<void>}
 */
async function markNotifiedToday(key) {
    try {
        const redisClient = globalThis.redis;
        if (redisClient?.set) {
            await redisClient.set(key, '1', { EX: NOTIFICATION_COOLDOWN_SECONDS });
            return;
        }
    } catch (redisError) {
        logger.warn(`[错误通知] Redis标记失败: ${redisError.message}`);
    }
    memoryNotified.set(key, true);
}

/**
 * 向主人发送一次性私信通知
 * 同一API同类错误每天仅通知一次，避免刷屏
 * @param {Error} error - 原始错误对象
 * @param {string} errorType - 错误类型
 * @param {string} apiType - API类型
 * @param {Object} apiConfig - API配置对象
 * @param {number|string} apiIndex - API配置索引
 * @returns {Promise<void>}
 */
async function notifyMasterOnce(error, errorType, apiType, apiConfig, apiIndex) {
    try {
        const masterQQ = await Config.Chat.MasterQQ;
        if (!masterQQ || String(masterQQ) === '10000') {
            logger.warn('[错误通知] 未配置有效的主人QQ，跳过通知');
            return;
        }

        const key = getNotificationKey(apiIndex ?? apiType, errorType);
        if (await hasNotifiedToday(key)) {
            return;
        }

        const apiUrl = apiConfig?.ApiUrl || '未知地址';
        const apiModel = apiConfig?.ApiModel || '未知模型';
        const message = `⚠️ 止水插件AI服务异常通知\n` +
            `类型：${errorType}\n` +
            `API：${apiType.toUpperCase()}\n` +
            `地址：${apiUrl}\n` +
            `模型：${apiModel}\n` +
            `错误：${error.message || '未知错误'}\n` +
            `建议：检查API账户余额或执行命令切换到其他API。`;

        const friend = globalThis.Bot?.pickFriend?.(String(masterQQ));
        if (!friend) {
            logger.warn(`[错误通知] 无法获取主人 ${masterQQ} 的好友对象`);
            return;
        }

        await friend.sendMsg?.(message);
        await markNotifiedToday(key);
        logger.info(`[错误通知] 已向主人 ${masterQQ} 发送 ${errorType} 通知`);
    } catch (notifyError) {
        logger.error(`[错误通知] 发送主人通知失败: ${notifyError.message}`);
    }
}

/**
 * 根据HTTP状态码生成友好的错误提示
 * @param {number} status - HTTP状态码
 * @param {string} apiType - API类型
 * @param {Error} error - 原始错误对象
 * @returns {string} 用户可见的错误提示
 */
function getMessageByHttpStatus(status, apiType, error) {
    const apiName = apiType.toUpperCase();
    switch (status) {
        case 400:
            return `【请求参数错误】${apiName} API无法处理当前请求，请检查模型或参数配置`;
        case 402:
            return `【账户欠费】${apiName} API余额不足，请充值或切换其他API`;
        case 403:
            return `【访问被拒绝】${apiName} API拒绝了请求，可能是密钥权限不足或地区受限`;
        case 404:
            return `【接口不存在】${apiName} API请求地址错误，请检查ApiUrl配置`;
        case 408:
            return `【请求超时】${apiName} API响应超时，请稍后重试`;
        case 413:
            return `【请求过大】${apiName} API请求内容过长，请缩短输入内容`;
        case 429:
            return `【请求频繁】${apiName} API请求过于频繁，请稍后再试`;
        case 500:
        case 502:
        case 503:
        case 504:
            return `【服务器错误】${apiName} API暂时不可用 (${status})，请稍后重试`;
        default:
            return `【AI服务错误】${apiName} API返回错误 (${status})，请稍后重试或联系管理员`;
    }
}

/**
 * 处理通信错误
 * 对错误进行分类并生成友好的用户提示，必要时通知主人
 * @param {Error} error - 错误对象
 * @param {string} apiType - API类型
 * @param {Object} [options={}] - 额外选项
 * @param {Object} [options.e] - 事件对象
 * @param {Object} [options.apiConfig] - 当前API配置
 * @param {number} [options.apiIndex] - 当前API索引
 * @returns {Promise<never>} 抛出带有分类信息的详细错误
 */
export async function handleCommunicationError(error, apiType, options = {}) {
    logger.error(`[openAi] 与 AI 通信时发生错误: ${error.message}`);

    const { apiConfig, apiIndex } = options;
    const apiName = apiType.toUpperCase();

    let errorType = '未知错误';
    let errorMessage = 'AI服务暂时无法响应，请稍后重试。';
    let shouldNotifyMaster = false;

    if (isApiKeyError(error)) {
        errorType = 'API密钥错误';
        errorMessage = `【${apiName} API密钥无效】请检查配置文件中的API密钥是否正确`;
    } else if (isRegionError(error)) {
        errorType = '地区限制';
        errorMessage = `【地区限制】当前地区无法访问${apiName} API，建议：1.使用VPN/代理 2.切换到其他API`;
    } else if (isRateLimitError(error)) {
        errorType = '频率限制';
        errorMessage = `【请求频繁】${apiName} API请求过于频繁，请稍后重试`;
    } else if (error.code === 'ENOTFOUND') {
        errorType = 'DNS解析失败';
        errorMessage = `【网络错误】无法解析${apiName} API域名，请检查：1.网络连接 2.DNS设置 3.API地址是否正确`;
    } else if (error.code === 'ECONNREFUSED') {
        errorType = '连接被拒绝';
        errorMessage = `【网络错误】连接${apiName} API被拒绝，请检查：1.网络连接 2.防火墙设置 3.代理配置`;
    } else if (error.code === 'ETIMEDOUT') {
        errorType = '连接超时';
        errorMessage = `【网络超时】连接${apiName} API超时，可能原因：1.网络较慢 2.服务器繁忙 3.需要代理`;
    } else if (error.code === 'ECONNRESET') {
        errorType = '连接重置';
        errorMessage = `【网络错误】与${apiName} API连接被重置，建议：1.检查网络稳定性 2.尝试使用代理`;
    } else if (isBalanceError(error)) {
        errorType = 'API余额不足';
        errorMessage = `【余额不足】${apiName} API账户余额或配额已用完，请：1.充值续费 2.切换到其他API`;
        shouldNotifyMaster = true;
    } else if (isModelError(error)) {
        errorType = '模型无效';
        errorMessage = `【模型错误】${apiName} API不支持当前模型，请检查模型名称是否正确`;
    } else {
        const status = extractHttpStatus(error);
        if (status) {
            errorType = `HTTP ${status}`;
            errorMessage = getMessageByHttpStatus(status, apiType, error);
            if (status === 402) {
                shouldNotifyMaster = true;
            }
        } else {
            errorType = '通信异常';
            errorMessage = `【AI服务异常】${error.message || '未知错误'}，请稍后重试`;
        }
    }

    logger.error(`[错误分析] 类型: ${errorType}, API: ${apiType}, 错误: ${error.message}`);

    if (shouldNotifyMaster) {
        await notifyMasterOnce(error, errorType, apiType, apiConfig, apiIndex);
    }

    const detailedError = new Error(errorMessage);
    detailedError.type = errorType;
    detailedError.apiType = apiType;
    detailedError.originalError = error;
    throw detailedError;
}
