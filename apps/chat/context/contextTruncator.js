/**
 * 上下文窗口管理模块
 * 在V2角色整合模式下，同一会话可能包含大量跨场景消息
 * 提供智能截断策略，在不超过API token限制的前提下保留最有价值的内容
 */

const logger = global.logger || console;

/**
 * 默认截断配置
 */
const DEFAULT_TRUNCATE_CONFIG = {
    maxTokens: 4000,
    maxMessages: 50,
    recentKeepCount: 10,
    summaryTokens: 500,
    enableSummary: true
};

/**
 * 简易Token估算器
 * 针对中英文混合内容的近似计算
 * @param {string|Object} message - 消息内容或消息对象
 * @returns {number} 预估token数
 */
export function estimateTokens(message) {
    if (!message) {
        return 0;
    }

    const content = typeof message === 'string' ? message : (message.content || '');

    const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (content.match(/[a-zA-Z]+/g) || []).length;
    const otherChars = Math.max(0, content.length - chineseChars - englishWords);

    return Math.ceil(chineseChars * 1.5 + englishWords * 1.3 + otherChars * 0.5);
}

/**
 * 消息重要性评分器
 * 根据多维度评估消息的保留价值
 */
class MessageScorer {
    constructor(options = {}) {
        this.currentSceneId = options.currentSceneId || null;
        this.timeDecayFactor = options.timeDecayFactor || 100;
        this.contentWeight = options.contentWeight || 50;
        this.sceneWeight = options.sceneWeight || 20;
        this.substantiveBonus = options.substantiveBonus || 30;
        this.tagBonus = options.tagBonus || 50;
    }

    /**
     * 计算单条消息的重要性得分
     * @param {Object} msg - 消息对象（V2增强格式）
     * @returns {number} 重要性得分
     */
    score(msg) {
        let score = 0;

        const meta = msg.meta || {};
        const createdTime = meta.created_at || Date.now();
        const ageMs = Date.now() - createdTime;
        const ageHours = ageMs / (1000 * 60 * 60);
        score += Math.max(0, this.timeDecayFactor - ageHours);

        const content = msg.content || '';
        score += Math.min(this.contentWeight, content.length / 20);

        if (this.isSubstantiveMessage(content)) {
            score += this.substantiveBonus;
        }

        const scene = msg.scene || {};
        if (this.currentSceneId && scene.source_id === this.currentSceneId) {
            score += this.sceneWeight;
        }

        if (meta.tags && Array.isArray(meta.tags)) {
            for (const tag of meta.tags) {
                if (tag === '重要' || tag === 'important') {
                    score += this.tagBonus;
                }
            }
        }

        return score;
    }

    /**
     * 判断是否为实质性消息（非简单回应）
     * @param {string} content - 消息文本
     * @returns {boolean}
     */
    isSubstantiveMessage(content) {
        if (!content || typeof content !== 'string') {
            return false;
        }
        if (content.length <= 10) {
            return false;
        }
        const trivialPattern = /^(好的|嗯|哦|哈|呵|笑|好|行|OK|ok|嗯嗯|哈哈)/;
        return !trivialPattern.test(content.trim());
    }
}

/**
 * 智能截断函数
 * 在保持上下文连贯性的前提下将消息列表压缩到目标限制内
 * @param {Array} messages - 完整消息列表
 * @param {Object} options - 截断选项
 * @returns {Promise<Object>} { truncatedMessages: Array, summary: string|null, stats: Object }
 */
export async function truncateContext(messages, options = {}) {
    const config = { ...DEFAULT_TRUNCATE_CONFIG, ...options };

    if (!Array.isArray(messages) || messages.length === 0) {
        return {
            truncatedMessages: [],
            summary: null,
            stats: { originalCount: 0, keptCount: 0, removedCount: 0, tokenReduction: 0 }
        };
    }

    const totalTokens = messages.reduce((sum, m) => sum + estimateTokens(m), 0);

    if (totalTokens <= config.maxTokens && messages.length <= config.maxMessages) {
        return {
            truncatedMessages: stripMetadata(messages),
            summary: null,
            stats: { originalCount: messages.length, keptCount: messages.length, removedCount: 0, tokenReduction: 0 }
        };
    }

    const scorer = new MessageScorer({
        currentSceneId: options.currentSceneId
    });

    const recentMessages = messages.slice(-config.recentKeepCount);
    const olderMessages = messages.slice(0, -config.recentKeepCount);

    const scoredOlder = olderMessages.map(msg => ({
        ...msg,
        _score: scorer.score(msg),
        _tokens: estimateTokens(msg)
    }));

    const sortedOlder = [...scoredOlder].sort((a, b) => b._score - a._score);

    let keptTokens = recentMessages.reduce((sum, m) => sum + estimateTokens(m), 0);
    const reservedTokens = config.enableSummary ? config.summaryTokens : 0;
    const maxOlderTokens = config.maxTokens - keptTokens - reservedTokens;
    const keptOlder = [];

    for (const msg of sortedOlder) {
        if (keptTokens + msg._tokens <= maxOlderTokens && keptOlder.length + recentMessages.length < config.maxMessages) {
            keptOlder.push(msg);
            keptTokens += msg._tokens;
        }
    }

    const removedMessages = olderMessages.filter(m => !keptOlder.includes(m));
    let summary = null;

    if (config.enableSummary && removedMessages.length > 0) {
        summary = generateSimpleSummary(removedMessages);
    }

    keptOlder.sort((a, b) => {
        const timeA = a.meta?.created_at || 0;
        const timeB = b.meta?.created_at || 0;
        return timeA - timeB;
    });

    const finalMessages = [];

    if (summary) {
        finalMessages.push({
            role: 'system',
            content: `[历史对话摘要]\n${summary}`
        });
    }

    finalMessages.push(...stripMetadata(keptOlder));
    finalMessages.push(...stripMetadata(recentMessages));

    return {
        truncatedMessages: finalMessages,
        summary,
        stats: {
            originalCount: messages.length,
            keptCount: finalMessages.length,
            removedCount: removedMessages.length,
            tokenReduction: totalTokens - keptTokens
        }
    };
}

/**
 * 移除消息的内部元数据字段，仅保留API所需字段
 * @param {Array} messages - 增强型消息数组
 * @returns {Array} 纯净消息数组
 */
function stripMetadata(messages) {
    return messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        tool_calls: msg.tool_calls,
        tool_call_id: msg.tool_call_id,
        reasoning_content: msg.reasoning_content
    }));
}

/**
 * 生成简易对话摘要
 * 从被移除的消息中提取关键信息
 * @param {Array} messages - 被移除的消息数组
 * @returns {string} 摘要文本
 */
function generateSimpleSummary(messages) {
    if (!messages || messages.length === 0) {
        return '';
    }

    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');

    const topics = userMessages.slice(-5).map(m => {
        const content = (m.content || '').substring(0, 30);
        return content.replace(/\n/g, ' ');
    }).filter(t => t.length > 0);

    const sceneTypes = new Set(messages.map(m => m.scene?.type).filter(Boolean));
    const sceneLabel = sceneTypes.has('group') && sceneTypes.has('private')
        ? '群聊和私聊'
        : (sceneTypes.has('group') ? '群聊' : '私聊');

    const lines = [
        `此前有${messages.length}条${sceneLabel}对话记录`,
        `最近讨论的话题包括：${topics.slice(0, 3).join('、') || '无'}`
    ];

    return lines.join('\n');
}
