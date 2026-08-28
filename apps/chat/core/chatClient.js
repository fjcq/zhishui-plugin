/**
 * 统一调用编排层（新架构版）
 * 替代旧api/index.js的openAi主函数：
 * 模型解析（manager）→ provider创建 → 参数裁剪 → 消息组装（messageBuilder）
 * → provider.chat → 工具循环（toolLoop）→ 错误归一与主人通知。
 *
 * 对外签名与旧openAi保持一致（msg, e, systemMessage, chatMsg, recursionDepth），
 * 便于业务层（chatHandler）在阶段4平滑切换。
 */

import { Config, logger } from '../../../components/index.js';
import { resolveModel } from '../configs/manager.js';
import { createProvider } from '../providers/index.js';
import { buildMessages } from './messageBuilder.js';
import { executeToolLoop, MAX_TOOL_DEPTH } from './toolLoop.js';
import { getEnabledTools } from '../tools/index.js';
import { buildUserMessageContent } from '../api/utils/requestUtils.js';

/** 默认请求参数（与旧getDefaultParams语义一致） */
const DEFAULT_PARAMS = {
    temperature: 0.7,
    top_p: 0.95,
    max_tokens: 2048,
    presence_penalty: 0.2,
    frequency_penalty: 0.3
};

/** 主人通知冷却时间（秒），同类错误每冷却期最多通知一次 */
const NOTIFICATION_COOLDOWN_SECONDS = 12 * 60 * 60;

/** 内存级通知记录（Redis不可用时的降级方案） */
const memoryNotified = new Map();

/**
 * 判断模型是否支持思维链（基于模型名关键词）
 * @param {string} modelName - 模型名
 * @returns {boolean} 是否支持
 */
export function isThinkingModel(modelName) {
    const lower = (modelName || '').toLowerCase();
    if (lower.includes('deepseek')) return true;
    if (/\bo[134]-/.test(lower) || lower.includes('o1-mini') || lower.includes('o1-preview')) return true;
    if (lower.includes('qwq')) return true;
    if (lower.includes('qwen3') || lower.includes('qwen-3')) return true;
    if (lower.includes('claude') && (lower.includes('extended') || lower.includes('thinking'))) return true;
    if (lower.includes('glm-z1') || lower.includes('glmz1')) return true;
    return false;
}

/**
 * 获取当前角色的请求参数（人设中的"请求参数"覆盖默认值）
 * @param {Object} e - 事件对象
 * @returns {Promise<Object>} 合并后的请求参数
 */
async function getRoleParams(e) {
    let roleRequestParams = {};
    try {
        const roleJson = Config.getJsonConfig('RoleProfile');
        const roles = JSON.parse(roleJson);
        const { getCurrentRoleIndex } = await import('../configs/roleManager.js');
        const currentRoleIndex = await getCurrentRoleIndex(e);
        roleRequestParams = roles[currentRoleIndex]?.['请求参数'] || {};
    } catch (error) {
        logger.warn(`[chatClient] 获取角色请求参数失败: ${error.message}`);
    }
    return { ...DEFAULT_PARAMS, ...roleRequestParams };
}

/**
 * 生成通知记录的Redis键名
 * @param {string} providerName - provider名称
 * @param {string} errorType - 错误类型标识
 * @returns {string} Redis键名
 */
function getNotificationKey(providerName, errorType) {
    const date = new Date().toISOString().slice(0, 10);
    return `zhishui:master_notification:${errorType}:${providerName}:${date}`;
}

/**
 * 向主人发送一次性私信通知（同类错误每冷却期最多一次）
 * @param {Object} errorInfo - 统一错误 { code, message }
 * @param {string} providerName - provider名称
 * @returns {Promise<void>}
 */
async function notifyMasterOnce(errorInfo, providerName) {
    try {
        const masterQQ = await Config.Chat.MasterQQ;
        if (!masterQQ || String(masterQQ) === '10000') {
            return;
        }

        const key = getNotificationKey(providerName, errorInfo.code);
        try {
            const redisClient = globalThis.redis;
            if (redisClient?.get && await redisClient.get(key)) {
                return;
            }
        } catch {
            // Redis不可用走内存降级
        }
        if (memoryNotified.has(key)) {
            return;
        }

        const message = `⚠️ 止水插件AI服务异常通知\n` +
            `类型：${errorInfo.code}\n` +
            `Provider：${providerName}\n` +
            `错误：${errorInfo.message || '未知错误'}\n` +
            `建议：检查API账户余额或执行命令切换到其他模型。`;

        const friend = globalThis.Bot?.pickFriend?.(String(masterQQ));
        if (friend?.sendMsg) {
            await friend.sendMsg(message);
            try {
                const redisClient = globalThis.redis;
                if (redisClient?.set) {
                    await redisClient.set(key, '1', { EX: NOTIFICATION_COOLDOWN_SECONDS });
                }
            } catch {
                // 标记失败不影响通知本身
            }
            memoryNotified.set(key, true);
            logger.info(`[错误通知] 已向主人 ${masterQQ} 发送 ${errorInfo.code} 通知`);
        }
    } catch (notifyError) {
        logger.error(`[错误通知] 发送主人通知失败: ${notifyError.message}`);
    }
}

/**
 * 统一错误码 → 用户可见文案
 * @param {Object} errorInfo - 统一错误 { code, status?, message }
 * @param {string} providerType - provider格式类型
 * @returns {string} 用户可见文案
 */
function errorToUserMessage(errorInfo, providerType) {
    const apiName = String(providerType || 'AI').toUpperCase();
    switch (errorInfo.code) {
        case 'auth':
            return `【${apiName} API密钥无效】请检查配置文件中的API密钥是否正确`;
        case 'forbidden':
            return `【地区限制】当前地区无法访问${apiName} API，建议：1.使用VPN/代理 2.切换到其他模型`;
        case 'rate_limit':
            return `【请求频繁】${apiName} API请求过于频繁，请稍后重试`;
        case 'balance':
            return `【余额不足】${apiName} API账户余额或配额已用完，请：1.充值续费 2.切换到其他模型`;
        case 'model_not_found':
            return `【模型错误】${apiName} API不支持当前模型，请检查模型名称是否正确`;
        case 'network':
            return `【网络错误】无法连接${apiName} API，请检查：1.网络连接 2.API地址是否正确`;
        case 'server_error':
            return `【服务器错误】${apiName} API暂时不可用 (${errorInfo.status || ''})，请稍后重试`;
        default:
            return `【AI服务异常】${errorInfo.message || '未知错误'}，请稍后重试`;
    }
}

/**
 * 处理provider调用错误：归一错误码、生成文案、余额类通知主人，抛详细错误
 * @param {Error} err - provider抛出的原始错误
 * @param {Object} providerInstance - Provider实例（parseError）
 * @param {Object} providerConfig - provider配置
 * @returns {Promise<never>} 抛出带分类信息的错误
 */
async function handleProviderError(err, providerInstance, providerConfig) {
    let errorInfo;
    try {
        errorInfo = await Promise.resolve(providerInstance.parseError(err));
    } catch {
        errorInfo = { code: 'unknown', message: err?.message || String(err) };
    }
    logger.error(`[chatClient] 与AI通信错误 [${errorInfo.code}] ${errorInfo.message}`);

    if (errorInfo.code === 'balance') {
        await notifyMasterOnce(errorInfo, providerConfig.name);
    }

    const detailedError = new Error(errorToUserMessage(errorInfo, providerConfig.type));
    detailedError.classified = true;
    detailedError.type = errorInfo.code;
    detailedError.providerName = providerConfig.name;
    throw detailedError;
}

/**
 * 统一对话入口
 * @param {string} msg - 用户消息（JSON字符串）
 * @param {Object} e - 事件对象
 * @param {string} systemMessage - 系统消息
 * @param {Array} chatMsg - 聊天历史
 * @param {number} [recursionDepth=0] - 递归深度
 * @returns {Promise<{content: string, rawResponse: string}>} 回复内容
 */
export async function chat(msg, e, systemMessage, chatMsg, recursionDepth = 0) {
    if (recursionDepth > MAX_TOOL_DEPTH) {
        logger.error(`[chatClient] 工具调用递归深度超过限制: ${recursionDepth} > ${MAX_TOOL_DEPTH}`);
        return {
            content: JSON.stringify({ message: '工具调用过于频繁，请稍后再试', favor_changes: [] }),
            rawResponse: '{}'
        };
    }

    const resolved = await resolveModel(e);
    if (!resolved) {
        return {
            content: JSON.stringify({ message: '未配置可用的AI模型，请先在配置文件中设置providers/models', favor_changes: [] }),
            rawResponse: '{}'
        };
    }

    const { model, provider: providerConfig } = resolved;
    const provider = createProvider(providerConfig);
    const { fullUserMsg } = buildUserMessageContent(msg);

    try {
        // 思维链模式判断
        const enableThinking = await Config.Chat.EnableThinking;
        const isThinkingMode = Boolean(enableThinking) && isThinkingModel(model.model);

        // 参数：角色参数覆盖默认，thinking模式不传采样参数
        const rawParams = await getRoleParams(e);
        let params = provider.sanitizeParams(rawParams);
        if (isThinkingMode) {
            const { temperature, top_p, presence_penalty, frequency_penalty, ...rest } = params;
            params = rest;
        }

        // 消息组装（多模态注入/视觉代理降级/工具跟进轮图片回收）
        const messages = await buildMessages({
            systemMessage, chatMsg, msg, e, provider, model: model.model, isThinkingMode
        });

        // 工具注入（provider支持且非thinking模式）
        const tools = provider.supportsTools() && !isThinkingMode ? getEnabledTools() : [];

        const response = await provider.chat({
            model: model.model,
            messages,
            tools: tools.length > 0 ? tools : undefined,
            params
        });

        // 工具调用循环
        if (response.toolCalls.length > 0) {
            const content = await executeToolLoop({
                response,
                chatContext: { msg, e, systemMessage, chatMsg, fullUserMsg },
                recursionDepth,
                chatFn: chat
            });
            return { content, rawResponse: JSON.stringify(response.raw || {}) };
        }

        return {
            content: response.content,
            rawResponse: JSON.stringify(response.raw || {})
        };
    } catch (error) {
        // 已分类的详细错误直接上抛
        if (error?.classified) {
            throw error;
        }
        await handleProviderError(error, provider, providerConfig);
    }
}
