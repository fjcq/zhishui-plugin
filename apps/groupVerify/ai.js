/**
 * 入群验证 AI 对话模块
 * 将入群验证融入 AI 人设对话：验证作为一场独立的多轮对话（复用群聊人设系统消息），
 * 出题、答案判定（语义等价即算对）、欢迎与提醒等表达均由 AI 以平时口吻逐轮生成；
 * 判定协议：AI 按约定格式输出结果标记，代码解析后掌控流程（通过/超时/踢出）。
 * AI 不可用（未配置模型/调用失败/输出不合规）时由调用方回退本地模板逻辑。
 */

import { resolveModel } from '../chat/configs/manager.js';
import { createProvider } from '../chat/providers/index.js';
import { mergeSystemMessage } from '../chat/configs/systemMessage.js';
import { logger } from '../../components/index.js';

/** 验证会话历史最大保留条数（user/assistant 各算一条） */
const MAX_HISTORY = 10;

/** 单次 AI 调用超时时间（毫秒） */
const CHAT_TIMEOUT_MS = 60000;

/** 验证职责附加到人设 system 的说明段 */
const VERIFY_ROLE_PROMPT = [
    '【入群验证职责】当前你正在本群执行入群真人验证流程，共有两类任务：',
    '一、提问任务：系统告知你有新成员入群，你需要提出一个简单的验证问题（口算算术或生活常识，答案唯一明确），',
    '   回复必须严格遵循协议格式：<verify answer="标准答案">面向新成员的完整发言</verify>',
    '   发言中自然包含欢迎、说明这是入群验证、以及问题本身，保持你的人设风格，两三句话即可。',
    '二、判定任务：系统告知新成员的回答与判定上下文，你负责判定其回答是否正确，并生成回应。',
    '   语义等价即算正确（例如"12""十二""十二个月"等价），回复必须严格遵循协议格式：',
    '   <verify result="pass">回应内容</verify>（判定正确，回应为对新成员的欢迎）或',
    '   <verify result="fail">回应内容</verify>（判定错误，回应需温和提醒并重申问题与剩余时间）。',
    '   除上述两类任务外，其余场景（如超时公告）直接输出给群成员看的内容，不要输出任何协议标记。',
    '注意：所有发言中不要包含任何艾特（@新成员）的文本，系统发送时会自动艾特对方。'
].join('\n');

/**
 * 执行一次纯文本对话调用（无工具注入、不写入常规会话历史）
 * @param {object} e - 事件对象（用于人设与模型解析）
 * @param {string} systemMessage - 完整 system 消息（人设 + 验证职责）
 * @param {Array<{role: string, content: string}>} history - 验证会话历史
 * @param {string} userContent - 本轮 user 消息
 * @returns {Promise<string|null>} AI 回复文本，失败返回 null
 */
async function chatOnce(e, systemMessage, history, userContent) {
    try {
        const resolved = await resolveModel(e);
        if (!resolved) {
            return null;
        }

        const { model, provider: providerConfig } = resolved;
        const provider = createProvider(providerConfig);

        const messages = [
            { role: 'system', content: systemMessage },
            ...history,
            { role: 'user', content: userContent }
        ];

        const params = provider.sanitizeParams({ temperature: 0.8, max_tokens: 600 });
        const signal = typeof AbortSignal.timeout === 'function'
            ? AbortSignal.timeout(CHAT_TIMEOUT_MS)
            : undefined;

        const response = await provider.chat({ model: model.model, messages, params, signal });
        const text = (response?.content || '').trim();
        return text || null;
    } catch (error) {
        logger.warn(`[入群验证] AI 对话调用失败，回退本地模式: ${error.message}`);
        return null;
    }
}

/**
 * 组装验证会话的 system 消息（复用群聊人设 + 验证职责）
 * @param {object} e - 事件对象
 * @returns {Promise<string>} system 消息
 */
async function buildVerifySystemMessage(e) {
    try {
        const persona = await mergeSystemMessage(e, false);
        return `${persona}\n\n${VERIFY_ROLE_PROMPT}`;
    } catch {
        return VERIFY_ROLE_PROMPT;
    }
}

/**
 * 剥离文本中可能残留的协议标记
 * @param {string} text - 原始文本
 * @returns {string} 剥离后的文本
 */
function stripVerifyTags(text) {
    return String(text || '').replace(/<\/?verify[^>]*>/gi, '').trim();
}

/**
 * 让 AI 向新成员提出验证问题（提问任务）
 * @param {object} e - notice.group.increase 事件对象
 * @param {string} userId - 新成员QQ
 * @returns {Promise<{answer: string, text: string, history: Array}|null>} 提问结果，失败返回 null
 */
export async function askAiQuestion(e, userId) {
    const systemMessage = await buildVerifySystemMessage(e);
    const userContent = `（入群验证：新成员（QQ:${userId}）刚加入本群，请按提问任务向 TA 提出验证问题）`;

    const raw = await chatOnce(e, systemMessage, [], userContent);
    if (!raw) {
        return null;
    }

    const match = raw.match(
        /<verify[^>]*answer\s*=\s*["']?([^"'>\s]+)["']?[^>]*>([\s\S]*?)<\/verify>/i
    );
    if (!match) {
        logger.warn('[入群验证] AI 提问输出不符合协议格式，回退本地出题');
        return null;
    }

    const answer = match[1].trim();
    const text = stripVerifyTags(match[2]);
    if (!answer || !text) {
        return null;
    }

    return {
        answer,
        text,
        history: [
            { role: 'user', content: userContent },
            { role: 'assistant', content: text }
        ]
    };
}

/**
 * 让 AI 判定新成员的回答并生成回应（判定任务）
 * 语义等价即算正确，解决答案不唯一与表达多样导致的代码误判
 * @param {object} e - 事件对象
 * @param {Array<{role: string, content: string}>} history - 验证会话历史
 * @param {string} question - 此前提出的验证问题原文
 * @param {string} expectedAnswer - 出题时 AI 给出的预期答案
 * @param {string} userReply - 新成员的回答原文
 * @param {string} remainText - 剩余验证时间可读文本（如 "4 分钟"）
 * @returns {Promise<{correct: boolean, text: string, history: Array}|null>} 判定结果，失败返回 null
 */
export async function askAiJudge(e, history, question, expectedAnswer, userReply, remainText) {
    const systemMessage = await buildVerifySystemMessage(e);
    const userContent = `（入群验证判定：你此前向新成员提出的问题是："${question}"，预期答案："${expectedAnswer}"。` +
        `新成员刚刚回答："${userReply}"。距离验证超时还有 ${remainText}。请按判定任务协议格式回复）`;

    const raw = await chatOnce(e, systemMessage, history, userContent);
    if (!raw) {
        return null;
    }

    const match = raw.match(
        /<verify[^>]*result\s*=\s*["']?(pass|fail)["']?[^>]*>([\s\S]*?)<\/verify>/i
    );
    if (!match) {
        logger.warn('[入群验证] AI 判定输出不符合协议格式，回退本地判定');
        return null;
    }

    const text = stripVerifyTags(match[2]);
    if (!text) {
        return null;
    }

    return {
        correct: match[1].toLowerCase() === 'pass',
        text,
        history: [
            ...history,
            { role: 'user', content: userContent },
            { role: 'assistant', content: text }
        ]
    };
}

/**
 * 让 AI 按场景提示生成普通回应（超时公告等，无协议标记）
 * @param {object} e - 事件对象
 * @param {Array<{role: string, content: string}>} history - 验证会话历史
 * @param {string} userContent - 场景提示
 * @returns {Promise<{text: string, history: Array}|null>} 回应结果，失败返回 null
 */
export async function askAiReply(e, history, userContent) {
    const systemMessage = await buildVerifySystemMessage(e);
    const raw = await chatOnce(e, systemMessage, history, userContent);
    if (!raw) {
        return null;
    }

    const text = stripVerifyTags(raw);
    if (!text) {
        return null;
    }

    return {
        text,
        history: [
            ...history,
            { role: 'user', content: userContent },
            { role: 'assistant', content: text }
        ]
    };
}

/**
 * 裁剪验证会话历史至最近 N 条
 * @param {Array<{role: string, content: string}>} history - 待裁剪历史
 * @returns {Array} 裁剪后的历史
 */
export function trimHistory(history) {
    if (!Array.isArray(history)) {
        return [];
    }
    return history.slice(-MAX_HISTORY);
}
