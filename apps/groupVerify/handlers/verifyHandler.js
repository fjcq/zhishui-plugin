/**
 * 入群验证核心处理器
 * 监听新成员入群发放随机验证问题，并在群消息中校验答案
 */

import { generateQuestion, checkAnswer } from '../questions.js';
import { askAiQuestion, askAiReply, trimHistory } from '../ai.js';
import {
    setPending,
    getPending,
    delPending,
    setPassed,
    isPassed
} from '../store.js';
import { getVerifyConfig, isVerifyGroup } from '../config.js';
import { logger } from '../../../components/index.js';

/** 超时定时器注册表：key 为 `${botId}:${groupId}:${userId}`（进程内有效，重启后由 Redis TTL 自然过期） */
const timeoutTimers = new Map();

/**
 * 获取事件对应的 Bot 账号标识
 * @param {object} e - 事件对象
 * @returns {string} Bot账号字符串
 */
function getBotId(e) {
    return String(e?.self_id || e?.bot?.uin || e?.bot?.id || '');
}

/**
 * 发送群消息（notice 事件无 reply 时兜底使用 Bot 群对象直发）
 * @param {object} e - 事件对象
 * @param {string|Array} message - 消息内容
 */
async function sendGroupMessage(e, message) {
    try {
        if (typeof e?.reply === 'function') {
            await e.reply(message);
            return;
        }
        await e?.bot?.pickGroup?.(e.group_id)?.sendMsg?.(message);
    } catch (error) {
        logger.error(`[入群验证] 发送群消息失败: ${error.message}`);
    }
}

/**
 * 清理 AI 文本中的艾特标记：代码已用 segment.at 艾特用户，AI 自带的艾特文本会变成假艾特
 * @param {string} text - AI 生成的文本
 * @returns {string} 清理后的文本
 */
function stripAtMarkers(text) {
    if (!text || typeof text !== 'string') {
        return text;
    }
    return text
        .replace(/\[CQ:at,qq=\d+\]/g, '')
        .replace(/@\[\d+\]/g, '')
        .replace(/\[@\d+\]/g, '')
        .replace(/^[ \t]+/, '');
}


/**
 * 检查 Bot 在指定群是否拥有管理员/群主权限（踢人所需）
 * @param {object} e - 事件对象
 * @param {string|number} groupId - 目标群号
 * @returns {Promise<boolean|null>} true=有权限，false=确认无权限，null=无法判断
 */
export async function isBotGroupAdmin(e, groupId) {
    try {
        // 群消息事件可直接读群对象的 is_admin（icqq 语义：Bot 自身在该群的管理员身份）
        if (e?.group && e.group.is_admin !== undefined) {
            return e.group.is_admin === true || e.group.is_owner === true;
        }

        const botId = getBotId(e);
        const group = e?.bot?.pickGroup?.(groupId);
        if (!group) {
            return null;
        }

        if (group.is_admin !== undefined) {
            return group.is_admin === true || group.is_owner === true;
        }

        if (typeof group.getMember === 'function' && botId) {
            const member = await group.getMember(botId);
            return member?.role === 'admin' || member?.role === 'owner';
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * 撤回待验证成员刚发送的消息（答错时使用，需Bot是管理员，失败仅记日志不影响流程）
 * @param {object} e - 事件对象
 */
async function recallMessage(e) {
    try {
        const messageId = e?.message_id;
        if (messageId === undefined || messageId === null) {
            return;
        }

        if (typeof e?.recall === 'function') {
            await e.recall();
            return;
        }

        // 适配器无 recall 方法时走 OneBot 删除消息接口
        if (e?.bot?.pickGroup && typeof e.bot.pickGroup(e.group_id)?.recallMsg === 'function') {
            await e.bot.pickGroup(e.group_id).recallMsg(messageId);
        }
    } catch (error) {
        logger.warn(`[入群验证] 撤回答错消息失败（Bot可能无权限）: ${error.message}`);
    }
}

/**
 * 清理验证超时定时器
 * @param {string} botId - Bot账号
 * @param {string} groupId - 群号
 * @param {string} userId - 用户QQ
 */
function clearTimer(botId, groupId, userId) {
    const key = `${botId}:${groupId}:${userId}`;
    const timer = timeoutTimers.get(key);
    if (timer) {
        clearTimeout(timer);
        timeoutTimers.delete(key);
    }
}

/**
 * 将成员移出群聊（Bot 无权限或踢出失败时降级为提示管理员）
 * @param {object} e - 事件对象
 * @param {string} userId - 目标用户
 * @param {string} reason - 处置原因文案
 */
async function kickMember(e, userId, reason) {
    try {
        const group = e?.bot?.pickGroup?.(e.group_id);
        if (group?.kickMember) {
            await group.kickMember(userId);
            logger.mark(`[入群验证] 已移出群:${e.group_id} 用户:${userId} 原因:${reason}`);
            return;
        }
    } catch (error) {
        logger.warn(`[入群验证] 移出成员失败（Bot可能无权限）: ${error.message}`);
    }

    await sendGroupMessage(e, [
        segment.at(userId),
        `\n${reason}，请管理员留意该成员是否为机器人。`
    ]);
}

/**
 * 格式化剩余验证时间为可读文本
 * @param {number} seconds - 剩余秒数
 * @returns {string} 可读文本（如 "4 分钟" / "30 秒"）
 */
function formatRemainText(seconds) {
    if (seconds >= 60) {
        return `${Math.max(1, Math.round(seconds / 60))} 分钟`;
    }
    return `${Math.max(1, seconds)} 秒`;
}

/**
 * 注册验证超时定时器
 * @param {object} e - 事件对象
 * @param {string} botId - Bot账号
 * @param {string} userId - 待验证用户
 * @param {object} config - 验证配置
 */
function scheduleTimeout(e, botId, userId, config) {
    const key = `${botId}:${e.group_id}:${userId}`;
    clearTimer(botId, e.group_id, userId);

    const timer = setTimeout(async () => {
        timeoutTimers.delete(key);
        try {
            // 会话已被移除说明已通过验证或已处置
            const pending = await getPending(botId, e.group_id, userId);
            if (!pending) {
                return;
            }

            await delPending(botId, e.group_id, userId);

            // 超时公告：AI 模式由 AI 生成告别文案，失败或本地模式用模板
            let announced = false;
            if (config.useAI && Array.isArray(pending.history) && pending.history.length > 0) {
                const aiReply = await askAiReply(e, pending.history,
                    `（入群验证：新成员未在时限内回答问题"${pending.question}"，即将被移出群聊，请生成简短的公告与告别）`);
                if (aiReply) {
                    await sendGroupMessage(e, [segment.at(userId), '\n', stripAtMarkers(aiReply.text)]);
                    announced = true;
                }
            }
            if (!announced) {
                await sendGroupMessage(e, [
                    segment.at(userId),
                    '\n回答超时，未完成入群验证，即将移出群聊。'
                ]);
            }

            // 超时统一直接踢出（Bot 无权限时由 kickMember 内部降级提示管理员）
            await kickMember(e, userId, '回答超时，未完成入群验证');
        } catch (error) {
            logger.error(`[入群验证] 超时处理失败: ${error.message}`);
        }
    }, config.timeout * 1000);

    timeoutTimers.set(key, timer);
}

/**
 * 处理新成员入群事件：发送随机验证问题
 * @param {object} e - notice.group.increase 事件对象
 * @returns {Promise<boolean>} 是否拦截事件（始终不拦截）
 */
export async function handleGroupIncrease(e) {
    try {
        const config = getVerifyConfig();
        if (!config.enable || !isVerifyGroup(config.verifyGroups, e.group_id)) {
            return false;
        }

        const botId = getBotId(e);
        const userId = String(e.user_id || '');

        // Bot 自身入群不验证
        if (!userId || userId === botId) {
            return false;
        }

        // Bot 无群管理权限时无法踢人，验证失去意义，跳过并告警
        const botAdmin = await isBotGroupAdmin(e, e.group_id);
        if (botAdmin === false) {
            logger.warn(`[入群验证] Bot 在群:${e.group_id} 无管理员权限，跳过验证（请先授予Bot群管理员）`);
            return false;
        }

        // 冷却期内曾通过验证的成员，跳过验证
        if (await isPassed(botId, e.group_id, userId)) {
            logger.info(`[入群验证] 用户:${userId} 在冷却期内已通过，跳过验证`);
            return false;
        }

        // AI 模式：由 AI 以人设口吻发起验证提问；失败回退本地出题
        let question = '';
        let answers = [];
        let history = [];

        if (config.useAI) {
            const aiResult = await askAiQuestion(e, userId);
            if (aiResult) {
                question = aiResult.text;
                answers = [aiResult.answer];
                history = aiResult.history;
                logger.mark(`[入群验证] 群:${e.group_id} 用户:${userId} AI 已出题`);
            }
        }

        // 本地出题兜底（AI 关闭或 AI 不可用）
        if (!history.length) {
            const local = generateQuestion();
            question = local.question;
            answers = local.answers;
        }

        await setPending(botId, e.group_id, userId, { question, answers, history }, config.timeout);

        if (history.length) {
            // AI 文案已含欢迎、规则说明与问题本身
            await sendGroupMessage(e, [segment.at(userId), '\n', stripAtMarkers(question)]);
        } else {
            const minutes = Math.max(1, Math.round(config.timeout / 60));
            const tips = [
                `欢迎加入本群！为确认您是真人，请在 ${minutes} 分钟内回答下面的问题：`,
                '超时未答对将被移出群聊，答错可以继续尝试。'
            ];
            await sendGroupMessage(e, [
                segment.at(userId),
                `\n${tips.join('')}\n`,
                `【${question}】`
            ]);
        }

        scheduleTimeout(e, botId, userId, config);
        logger.mark(`[入群验证] 群:${e.group_id} 用户:${userId} 已发送验证问题`);
        return false;
    } catch (error) {
        logger.error(`[入群验证] 处理入群事件失败: ${error.message}`);
        return false;
    }
}

/**
 * 校验群消息中的验证答案
 * @param {object} e - message 事件对象
 * @returns {Promise<boolean>} 是否拦截消息
 */
export async function handleVerifyAnswer(e) {
    try {
        if (!e?.group_id || !e?.user_id) {
            return false;
        }

        const config = getVerifyConfig();
        if (!config.enable || !isVerifyGroup(config.verifyGroups, e.group_id)) {
            return false;
        }

        const botId = getBotId(e);
        const userId = String(e.user_id);
        if (userId === botId) {
            return false;
        }

        // 读取会话同时取剩余时间（用于答错提示）
        const pendingWithTtl = await getPending(botId, e.group_id, userId, true);
        if (!pendingWithTtl) {
            return false;
        }
        const pending = pendingWithTtl.data;

        const replyText = (e.msg || '').trim();
        if (!replyText) {
            await e.reply('请直接用文字回答验证问题哦～', true);
            return true;
        }

        const remainSeconds = pendingWithTtl.ttl;
        const remainText = formatRemainText(remainSeconds);

        // AI 判定模式：由 AI 判定回答是否正确（语义等价即算对）并生成回应
        if (config.useAI && Array.isArray(pending.history) && pending.history.length > 0) {
            const judged = await askAiJudge(e, pending.history, pending.question,
                (pending.answers || [])[0] || '', replyText, remainText);

            if (judged) {
                if (judged.correct) {
                    await delPending(botId, e.group_id, userId);
                    clearTimer(botId, e.group_id, userId);
                    await setPassed(botId, e.group_id, userId, config.passCooldown);
                    await e.reply([segment.at(userId), '\n', stripAtMarkers(judged.text)]);
                    logger.mark(`[入群验证] 用户:${userId} 通过群:${e.group_id} 验证（AI 判定）`);
                    return true;
                }

                // 答错：撤回消息，AI 回应并重申问题，更新会话历史（保留剩余时长）
                await recallMessage(e);
                await setPending(botId, e.group_id, userId, {
                    ...pending,
                    history: trimHistory(judged.history)
                }, remainSeconds);
                await e.reply([segment.at(userId), '\n', stripAtMarkers(judged.text)], true);
                logger.info(`[入群验证] 用户:${userId} 群:${e.group_id} 答错（AI 判定），已撤回并提醒`);
                return true;
            }
            // AI 判定失败：回退本地判定（使用出题时预存的预期答案）
        }

        // 本地判定：答对清理会话并记录通过
        if (checkAnswer(replyText, pending.answers)) {
            await delPending(botId, e.group_id, userId);
            clearTimer(botId, e.group_id, userId);
            await setPassed(botId, e.group_id, userId, config.passCooldown);
            await e.reply([
                segment.at(userId),
                '\n🎉 回答正确！欢迎正式加入本群～'
            ]);
            logger.mark(`[入群验证] 用户:${userId} 通过群:${e.group_id} 验证`);
            return true;
        }

        // 答错：撤回该成员消息，提示剩余时间并重发问题，请其继续作答
        await recallMessage(e);
        await e.reply([
            segment.at(userId),
            `\n答案不对哦～距离验证超时还有 ${remainText}，请继续回答刚才的问题：\n`,
            `【${pending.question}】`
        ], true);
        logger.info(`[入群验证] 用户:${userId} 群:${e.group_id} 答错一次，已撤回并重发问题`);
        return true;
    } catch (error) {
        logger.error(`[入群验证] 校验答案失败: ${error.message}`);
        return false;
    }
}
