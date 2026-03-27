/**
 * 工具决策引擎
 * 让AI拥有判断能力，决定是否执行敏感操作
 */

import { getUserFavor } from '../user/index.js';
import { Config } from '../../../components/index.js';
import { generateDenyFeedback } from './feedbackGenerator.js';

/**
 * 决策结果枚举
 */
export const DecisionResult = {
    ALLOW: 'allow',
    DENY: 'deny',
    NEED_CONFIRM: 'need_confirm',
    NEED_REASON: 'need_reason'
};

/**
 * 敏感操作等级
 */
export const SensitivityLevel = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4
};

/**
 * 工具敏感度配置
 */
const TOOL_SENSITIVITY = {
    mute_group_member: SensitivityLevel.HIGH,
    kick_group_member: SensitivityLevel.CRITICAL,
    set_group_card: SensitivityLevel.LOW,
    set_group_title: SensitivityLevel.MEDIUM,
    delete_message: SensitivityLevel.MEDIUM,
    set_group_name: SensitivityLevel.MEDIUM,
    set_group_announcement: SensitivityLevel.MEDIUM,
    poke_user: SensitivityLevel.LOW,
    send_image: SensitivityLevel.LOW,
    send_voice: SensitivityLevel.LOW,
    send_private_message: SensitivityLevel.LOW,
    forward_message: SensitivityLevel.LOW,
    set_essence_message: SensitivityLevel.LOW,
    change_user_favor: SensitivityLevel.LOW,
    get_user_favor: SensitivityLevel.LOW,
    set_user_favor: SensitivityLevel.MEDIUM,
    get_user_info: SensitivityLevel.LOW,
    get_group_info: SensitivityLevel.LOW,
    get_user_profile: SensitivityLevel.LOW,
    get_group_members: SensitivityLevel.LOW,
    remember_user_info: SensitivityLevel.LOW,
    recall_user_info: SensitivityLevel.LOW,
    forget_user_info: SensitivityLevel.LOW,
    set_reminder: SensitivityLevel.LOW,
    get_reminders: SensitivityLevel.LOW,
    cancel_reminder: SensitivityLevel.LOW,
    record_interaction: SensitivityLevel.LOW,
    get_interaction_history: SensitivityLevel.LOW
};

/**
 * 好感度阈值配置
 */
const FAVOR_THRESHOLDS = {
    [SensitivityLevel.LOW]: -20,
    [SensitivityLevel.MEDIUM]: 0,
    [SensitivityLevel.HIGH]: 30,
    [SensitivityLevel.CRITICAL]: 60
};

/**
 * 决策理由模板
 */
const DENY_REASONS = {
    low_favor: {
        [SensitivityLevel.LOW]: 'low_favor',
        [SensitivityLevel.MEDIUM]: 'low_favor',
        [SensitivityLevel.HIGH]: 'low_favor',
        [SensitivityLevel.CRITICAL]: 'low_favor'
    },
    not_master: {
        [SensitivityLevel.HIGH]: 'not_master',
        [SensitivityLevel.CRITICAL]: 'not_master'
    },
    need_reason: {
        [SensitivityLevel.HIGH]: 'need_reason',
        [SensitivityLevel.CRITICAL]: 'need_reason'
    },
    target_admin: 'target_admin',
    self_protection: 'self_protection',
    unknown_user: 'unknown_user'
};

/**
 * 检查用户是否为主人
 * @param {string} userId - 用户ID
 * @returns {Promise<boolean>} 是否为主人
 */
async function isMaster(userId) {
    try {
        const masterQQ = await Config.Chat.MasterQQ;
        return String(userId) === String(masterQQ);
    } catch {
        return false;
    }
}

/**
 * 获取工具敏感度等级
 * @param {string} toolName - 工具名称
 * @returns {number} 敏感度等级
 */
export function getToolSensitivity(toolName) {
    return TOOL_SENSITIVITY[toolName] || SensitivityLevel.MEDIUM;
}

/**
 * 核心决策函数
 * @param {string} toolName - 工具名称
 * @param {object} params - 工具参数
 * @param {object} context - 上下文信息
 * @returns {Promise<{result: string, reason: string, suggestedAction: string}>} 决策结果
 */
export async function makeDecision(toolName, params, context = {}) {
    const { e, currentUserId, requesterFavor } = context;
    const sensitivity = getToolSensitivity(toolName);

    const requesterId = currentUserId || e?.user_id;
    if (!requesterId) {
        return {
            result: DecisionResult.DENY,
            reason: DENY_REASONS.unknown_user,
            suggestedAction: '请先建立用户身份'
        };
    }

    const isMasterUser = await isMaster(requesterId);
    const favor = requesterFavor !== undefined ? requesterFavor : await getUserFavor(requesterId);

    if (toolName === 'mute_group_member' || toolName === 'kick_group_member') {
        return await decideOnMemberAction(toolName, params, {
            ...context,
            sensitivity,
            isMasterUser,
            favor,
            requesterId
        });
    }

    if (toolName === 'set_group_card' || toolName === 'set_group_title') {
        return await decideOnProfileAction(toolName, params, {
            ...context,
            sensitivity,
            isMasterUser,
            favor,
            requesterId
        });
    }

    if (sensitivity >= SensitivityLevel.HIGH) {
        return await decideHighSensitivityAction(toolName, params, {
            ...context,
            sensitivity,
            isMasterUser,
            favor,
            requesterId
        });
    }

    if (sensitivity >= SensitivityLevel.MEDIUM) {
        return await decideMediumSensitivityAction(toolName, params, {
            ...context,
            sensitivity,
            isMasterUser,
            favor,
            requesterId
        });
    }

    return {
        result: DecisionResult.ALLOW,
        reason: '',
        suggestedAction: ''
    };
}

/**
 * 决定成员管理操作（禁言、踢人）
 */
async function decideOnMemberAction(toolName, params, context) {
    const { sensitivity, isMasterUser, favor, requesterId, e } = context;
    const targetUserId = params.user_id;

    if (targetUserId === requesterId) {
        return {
            result: DecisionResult.DENY,
            reason: DENY_REASONS.self_protection,
            suggestedAction: '拒绝自我操作'
        };
    }

    if (sensitivity === SensitivityLevel.CRITICAL && !isMasterUser) {
        return {
            result: DecisionResult.DENY,
            reason: DENY_REASONS.not_master[sensitivity],
            suggestedAction: '仅主人可执行'
        };
    }

    const requiredFavor = FAVOR_THRESHOLDS[sensitivity];
    if (favor < requiredFavor) {
        return {
            result: DecisionResult.DENY,
            reason: DENY_REASONS.low_favor[sensitivity],
            suggestedAction: `好感度不足（当前${favor}，需要${requiredFavor}）`
        };
    }

    if (!params.reason && sensitivity >= SensitivityLevel.HIGH) {
        if (favor < 70) {
            return {
                result: DecisionResult.NEED_REASON,
                reason: DENY_REASONS.need_reason[sensitivity],
                suggestedAction: '需要提供操作理由'
            };
        }
    }

    if (toolName === 'mute_group_member') {
        const duration = params.duration || 60;
        const maxDuration = isMasterUser ? 2592000 : (favor >= 80 ? 86400 : (favor >= 50 ? 3600 : 600));

        if (duration > maxDuration) {
            return {
                result: DecisionResult.NEED_CONFIRM,
                reason: `${duration > 3600 ? '禁言时间有点长呢...' : '禁言时间可能太长了'}，你确定要禁言这么久吗？最多可以禁言${formatDuration(maxDuration)}哦。`,
                suggestedAction: `限制禁言时长（请求${duration}秒，最大${maxDuration}秒）`,
                maxAllowedDuration: maxDuration
            };
        }
    }

    return {
        result: DecisionResult.ALLOW,
        reason: '',
        suggestedAction: ''
    };
}

/**
 * 决定资料修改操作（名片、头衔）
 */
async function decideOnProfileAction(toolName, params, context) {
    const { sensitivity, isMasterUser, favor, requesterId } = context;
    const targetUserId = params.user_id;

    if (targetUserId === requesterId) {
        return {
            result: DecisionResult.ALLOW,
            reason: '',
            suggestedAction: '允许修改自己的资料'
        };
    }

    if (toolName === 'set_group_title' && !isMasterUser) {
        return {
            result: DecisionResult.DENY,
            reason: '设置专属头衔只有群主才能操作，我只是管理员呢...',
            suggestedAction: '仅群主可设置头衔'
        };
    }

    const requiredFavor = FAVOR_THRESHOLDS[sensitivity];
    if (favor < requiredFavor) {
        return {
            result: DecisionResult.DENY,
            reason: DENY_REASONS.low_favor[sensitivity],
            suggestedAction: `好感度不足（当前${favor}，需要${requiredFavor}）`
        };
    }

    const card = params.card || params.title || '';
    if (containsInappropriateContent(card)) {
        return {
            result: DecisionResult.DENY,
            reason: '这个名字好像不太合适呢...换一个吧？',
            suggestedAction: '内容审核不通过'
        };
    }

    return {
        result: DecisionResult.ALLOW,
        reason: '',
        suggestedAction: ''
    };
}

/**
 * 决定高敏感度操作
 */
async function decideHighSensitivityAction(toolName, params, context) {
    const { sensitivity, isMasterUser, favor } = context;

    if (!isMasterUser && sensitivity === SensitivityLevel.CRITICAL) {
        return {
            result: DecisionResult.DENY,
            reason: DENY_REASONS.not_master[sensitivity],
            suggestedAction: '仅主人可执行'
        };
    }

    const requiredFavor = FAVOR_THRESHOLDS[sensitivity];
    if (favor < requiredFavor) {
        return {
            result: DecisionResult.DENY,
            reason: DENY_REASONS.low_favor[sensitivity],
            suggestedAction: `好感度不足（当前${favor}，需要${requiredFavor}）`
        };
    }

    if (!params.reason) {
        return {
            result: DecisionResult.NEED_REASON,
            reason: DENY_REASONS.need_reason[sensitivity],
            suggestedAction: '需要提供操作理由'
        };
    }

    return {
        result: DecisionResult.ALLOW,
        reason: '',
        suggestedAction: ''
    };
}

/**
 * 决定中等敏感度操作
 */
async function decideMediumSensitivityAction(toolName, params, context) {
    const { sensitivity, favor } = context;

    const requiredFavor = FAVOR_THRESHOLDS[sensitivity];
    if (favor < requiredFavor) {
        return {
            result: DecisionResult.DENY,
            reason: DENY_REASONS.low_favor[sensitivity],
            suggestedAction: `好感度不足（当前${favor}，需要${requiredFavor}）`
        };
    }

    return {
        result: DecisionResult.ALLOW,
        reason: '',
        suggestedAction: ''
    };
}

/**
 * 检查内容是否包含不适当内容
 * @param {string} content - 内容
 * @returns {boolean} 是否包含不适当内容
 */
function containsInappropriateContent(content) {
    const inappropriatePatterns = [
        /傻[逼比]/i,
        /操你/i,
        /妈的/i,
        /他妈/i,
        /畜生/i,
        /垃圾/i,
        /废物/i,
        /去死/i,
        /滚/i
    ];

    return inappropriatePatterns.some(pattern => pattern.test(content));
}

/**
 * 格式化时长
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时长
 */
function formatDuration(seconds) {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时`;
    return `${Math.floor(seconds / 86400)}天`;
}

/**
 * 生成AI拒绝回复
 * @param {object} decision - 决策结果
 * @param {string} toolName - 工具名称
 * @param {object} params - 工具参数
 * @returns {Promise<string>} AI回复
 */
export async function generateDenyResponse(decision, toolName, params) {
    const toolNames = {
        mute_group_member: '禁言',
        kick_group_member: '移出群组',
        set_group_card: '修改名片',
        set_group_title: '设置头衔',
        delete_message: '撤回消息',
        set_group_name: '修改群名',
        set_group_announcement: '发布公告'
    };

    const actionName = toolNames[toolName] || '这个操作';
    
    if (decision.result === DecisionResult.NEED_REASON) {
        const baseFeedback = await generateDenyFeedback(decision.reason);
        return `${baseFeedback} 如果你能告诉我为什么要${actionName}，我会考虑帮你的~`;
    }

    if (decision.result === DecisionResult.NEED_CONFIRM) {
        return decision.reason;
    }

    return await generateDenyFeedback(decision.reason);
}

/**
 * 获取工具的决策提示词
 * 用于在系统提示词中告知AI如何判断
 * @returns {string} 决策提示词
 */
export function getDecisionPrompt() {
    return `
## 工具调用决策规则

你拥有自主判断能力，不应盲目执行所有请求。在执行敏感操作前，请根据以下规则进行判断：

### 敏感度等级
- **低敏感度**：查询信息、记忆操作、戳一戳等无害操作
- **中敏感度**：修改群名、发布公告、撤回消息等
- **高敏感度**：禁言成员、修改他人名片等
- **极高敏感度**：踢出成员等不可逆操作

### 好感度要求
- 低敏感度操作：好感度 ≥ -20
- 中敏感度操作：好感度 ≥ 0
- 高敏感度操作：好感度 ≥ 30
- 极高敏感度操作：好感度 ≥ 60（非主人直接拒绝）

### 决策原则
1. **主人特权**：主人可以执行任何操作，但仍需考虑合理性
2. **好感度判断**：好感度越高，越愿意帮助执行敏感操作
3. **理由要求**：高敏感度操作应要求用户提供合理理由
4. **自我保护**：不执行针对自己的恶意操作
5. **管理员保护**：不执行针对群管理员的惩罚操作
6. **合理性判断**：即使有权限，也要判断操作是否合理

### 拒绝示例
- "抱歉，我对你还不够了解，不太方便这样做呢..."
- "这个操作比较敏感，我需要更信任你才能帮你做。"
- "要做这个操作的话，能告诉我具体原因吗？"
- "这是很重要的操作，只有主人才能让我这样做。"

### 注意事项
- 用角色性格的方式表达拒绝，保持角色一致性
- 拒绝时可以给出替代方案或建议
- 不要生硬地拒绝，要有情感温度
`;
}
