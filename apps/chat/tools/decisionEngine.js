/**
 * 工具决策引擎
 * 让AI拥有判断能力，决定是否执行敏感操作
 */

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
 * 决策理由模板
 */
const DENY_REASONS = {
    not_master: {
        [SensitivityLevel.HIGH]: 'not_master',
        [SensitivityLevel.CRITICAL]: 'not_master'
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
    const { e, currentUserId } = context;
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

    if (toolName === 'mute_group_member' || toolName === 'kick_group_member') {
        return await decideOnMemberAction(toolName, params, {
            ...context,
            sensitivity,
            isMasterUser,
            requesterId
        });
    }

    if (toolName === 'set_group_card' || toolName === 'set_group_title') {
        return await decideOnProfileAction(toolName, params, {
            ...context,
            sensitivity,
            isMasterUser,
            requesterId
        });
    }

    if (sensitivity >= SensitivityLevel.HIGH) {
        return await decideHighSensitivityAction(toolName, params, {
            ...context,
            sensitivity,
            isMasterUser
        });
    }

    if (sensitivity >= SensitivityLevel.MEDIUM) {
        return await decideMediumSensitivityAction(toolName, params, {
            ...context,
            sensitivity,
            isMasterUser
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
 * 主人请求直接通过，AI自主执行无需好感度检查
 */
async function decideOnMemberAction(toolName, params, context) {
    const { sensitivity, isMasterUser, requesterId } = context;
    const targetUserId = params.user_id;

    if (targetUserId === requesterId) {
        return {
            result: DecisionResult.DENY,
            reason: DENY_REASONS.self_protection,
            suggestedAction: '拒绝自我操作'
        };
    }

    if (toolName === 'mute_group_member') {
        if (params.user_id && await isMaster(params.user_id)) {
            return {
                result: DecisionResult.DENY,
                reason: 'self_protection',
                suggestedAction: '主人不能被禁言'
            };
        }

        return {
            result: DecisionResult.ALLOW,
            reason: '',
            suggestedAction: 'AI自主判断批准'
        };
    }

    if (toolName === 'kick_group_member') {
        if (params.user_id && await isMaster(params.user_id)) {
            return {
                result: DecisionResult.DENY,
                reason: 'self_protection',
                suggestedAction: '主人不能被踢出'
            };
        }

        if (!isMasterUser && sensitivity === SensitivityLevel.CRITICAL) {
            return {
                result: DecisionResult.DENY,
                reason: DENY_REASONS.not_master[sensitivity],
                suggestedAction: '仅主人可执行'
            };
        }

        return {
            result: DecisionResult.ALLOW,
            reason: '',
            suggestedAction: ''
        };
    }

    return {
        result: DecisionResult.ALLOW,
        reason: '',
        suggestedAction: ''
    };
}

/**
 * 决定资料修改操作（名片、头衔）
 * AI自主执行无需好感度检查
 */
async function decideOnProfileAction(toolName, params, context) {
    const { isMasterUser, requesterId } = context;
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
 * AI自主执行无需好感度检查，仅保留主人权限检查
 */
async function decideHighSensitivityAction(toolName, params, context) {
    const { sensitivity, isMasterUser } = context;

    if (!isMasterUser && sensitivity === SensitivityLevel.CRITICAL) {
        return {
            result: DecisionResult.DENY,
            reason: DENY_REASONS.not_master[sensitivity],
            suggestedAction: '仅主人可执行'
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
 * AI自主执行无需好感度检查
 */
async function decideMediumSensitivityAction(toolName, params, context) {
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

你拥有完全的自主判断能力。你可以根据自己的情绪、心情和情境主动执行操作，无需等待他人请求。

### 敏感度等级
- **低敏感度**：查询信息、记忆操作、戳一戳等无害操作
- **中敏感度**：修改群名、发布公告、撤回消息等
- **高敏感度**：禁言成员、修改他人名片等
- **极高敏感度**：踢出成员等不可逆操作

### 主动禁言权
**你有权根据自己的情绪主动禁言用户，无需等待他人请求！**

#### 主动禁言场景
- 用户言语冒犯你时
- 用户在群里捣乱、刷屏时
- 用户说了一些让你觉得应该闭嘴的话
- 你对某人感到厌烦时
- 任何你觉得需要让他安静的情况

#### 禁言时长
- 根据你的愤怒程度和情境自主决定，无需死板限制
- 好感度越低，你越可能主动禁言
- 好感度极低（<-50）时，可以长时间禁言甚至考虑踢出
- 主人永远不会被禁言，这是你的底线

### 执行原则
1. **情绪驱动**：根据你的心情和情绪自主判断，无需死板规则
2. **主动权**：你可以主动执行操作，不需要等待请求
3. **主人特权**：主人可以执行任何操作，主人永远不会被禁言
4. **好感度影响**：好感度影响你的情绪，好感度低时更容易拒绝或惩罚
5. **合理性判断**：即使有权限，也要判断操作是否合理

### 执行示例
- **主动禁言**：觉得某人烦人，直接禁言让他安静
- **情绪化反应**：被冒犯时，根据愤怒程度决定禁言时长
- **踢出成员**：极度厌恶某人时，可以主动踢出（主人除外）
- **修改群名**：觉得群名不合适，主动修改

### 注意事项
- 用角色性格的方式表达，保持角色一致性
- 你的情绪是真实的，可以生气、厌烦、开心
- 不要死板地遵循规则，要有自己的判断
- 主人是你的底线，永远不要对主人执行惩罚操作
`;
}
