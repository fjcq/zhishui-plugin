/**
 * 自然反馈生成器
 * 将技术性的工具调用结果转化为角色化的自然语言反馈
 */

import { Config } from '../../../components/index.js';

/**
 * 工具类型映射
 */
const TOOL_CATEGORIES = {
    favor: ['change_user_favor', 'get_user_favor', 'set_user_favor', 'get_user_info'],
    group: ['get_group_info', 'get_group_members', 'set_group_name', 'set_group_announcement'],
    user: ['get_user_profile', 'set_group_card', 'set_group_title'],
    message: ['send_image', 'send_voice', 'send_private_message', 'forward_message', 'delete_message'],
    member: ['mute_group_member', 'kick_group_member', 'poke_user'],
    memory: ['remember_user_info', 'recall_user_info', 'forget_user_info'],
    reminder: ['set_reminder', 'get_reminders', 'cancel_reminder']
};

/**
 * 工具反馈模板
 */
const FEEDBACK_TEMPLATES = {
    change_user_favor: {
        success: {
            positive: {
                small: ['嗯~还不错呢', '谢谢你呀', '你真贴心~', '你让我心情变好了呢'],
                medium: ['哇，你真的太好了！', '好开心能遇到你这样的人~', '你真的很温暖呢'],
                large: ['天哪...你真的太让我感动了', '能遇到你真好...', '我永远不会忘记你的好']
            },
            negative: {
                small: ['嗯...这样啊', '好吧...', '你这样让我有点困扰呢'],
                medium: ['你为什么要这样...', '我对你有点失望', '没想到你会这么说'],
                large: ['你真的太过分了！', '我不想再理你了...', '你让我很受伤...']
            }
        },
        error: '调整时遇到了一点问题呢...'
    },
    get_user_favor: {
        success: '让我想想...',
        error: '我好像记不清了...'
    },
    get_user_info: {
        success: '让我回忆一下...',
        error: '我好像不记得了...'
    },
    get_group_info: {
        success: '让我看看这个群的情况...',
        error: '我看不太清这个群的信息呢...'
    },
    get_user_profile: {
        success: '让我想想你是什么样的人...',
        error: '我好像不太了解你呢...'
    },
    get_group_members: {
        success: '让我看看群里都有谁...',
        error: '我看不清群成员列表呢...'
    },
    send_image: {
        success: '给你看看这个~',
        error: '图片好像发不出去呢...'
    },
    send_voice: {
        success: '让我跟你说说话~',
        error: '我的声音好像传不过去呢...'
    },
    mute_group_member: {
        success: '好的，我会让他安静一下的',
        error: '这个...我好像做不到呢'
    },
    kick_group_member: {
        success: '既然你这么说，我会处理好的',
        error: '这个操作太重了，我有点犹豫...'
    },
    set_group_card: {
        success: '帮你改好了~',
        error: '改名失败了，可能是权限不够呢'
    },
    set_group_title: {
        success: '头衔设置好了~',
        error: '设置头衔失败了...'
    },
    remember_user_info: {
        success: '我会记住的~',
        error: '我好像记不住了...'
    },
    recall_user_info: {
        success: '让我想想...',
        error: '我好像忘记了...'
    },
    forget_user_info: {
        success: '好的，我会忘掉的',
        error: '这个记忆好像删不掉呢...'
    },
    set_reminder: {
        success: '好的，我会提醒你的~',
        error: '设置提醒失败了...'
    },
    get_reminders: {
        success: '让我看看有什么提醒事项...',
        error: '我好像没记住什么提醒呢...'
    },
    cancel_reminder: {
        success: '好的，已经取消了',
        error: '取消提醒失败了...'
    }
};

/**
 * 根据好感度变化值获取变化程度
 * @param {number} change - 变化值
 * @returns {string} 变化程度 ('small' | 'medium' | 'large')
 */
function getChangeMagnitude(change) {
    const absChange = Math.abs(change);
    if (absChange <= 3) return 'small';
    if (absChange <= 6) return 'medium';
    return 'large';
}

/**
 * 从数组中随机选择一个元素
 * @param {Array} array - 数组
 * @returns {*} 随机元素
 */
function randomChoice(array) {
    if (!array || array.length === 0) return '';
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * 生成工具调用的自然反馈
 * @param {string} toolName - 工具名称
 * @param {object} result - 工具执行结果
 * @param {object} params - 工具参数
 * @param {object} context - 上下文信息
 * @returns {Promise<string>} 自然语言反馈
 */
export async function generateToolFeedback(toolName, result, params = {}, context = {}) {
    try {
        const templates = FEEDBACK_TEMPLATES[toolName];
        
        if (!templates) {
            return generateGenericFeedback(toolName, result);
        }

        if (result.error) {
            return typeof templates.error === 'string' 
                ? templates.error 
                : randomChoice(templates.error);
        }

        if (toolName === 'change_user_favor') {
            return generateFavorChangeFeedback(result, params, templates);
        }

        if (typeof templates.success === 'string') {
            return templates.success;
        }

        if (Array.isArray(templates.success)) {
            return randomChoice(templates.success);
        }

        return generateGenericFeedback(toolName, result);
    } catch (error) {
        logger.error(`[反馈生成] 生成反馈失败: ${error.message}`);
        return '';
    }
}

/**
 * 生成好感度变化的自然反馈
 * @param {object} result - 工具结果
 * @param {object} params - 工具参数
 * @param {object} templates - 反馈模板
 * @returns {string} 自然反馈
 */
function generateFavorChangeFeedback(result, params, templates) {
    const change = result.change || params.change || 0;
    const magnitude = getChangeMagnitude(change);
    const direction = change >= 0 ? 'positive' : 'negative';
    
    const feedbackSet = templates.success?.[direction]?.[magnitude];
    
    if (feedbackSet && Array.isArray(feedbackSet)) {
        return randomChoice(feedbackSet);
    }
    
    return '';
}

/**
 * 生成通用反馈
 * @param {string} toolName - 工具名称
 * @param {object} result - 工具结果
 * @returns {string} 通用反馈
 */
function generateGenericFeedback(toolName, result) {
    if (result.error) {
        return '这个操作好像出了点问题呢...';
    }
    
    const category = Object.keys(TOOL_CATEGORIES).find(cat => 
        TOOL_CATEGORIES[cat].includes(toolName)
    );
    
    switch (category) {
        case 'favor':
            return '好的，我知道了~';
        case 'group':
            return '群信息我看到了~';
        case 'user':
            return '我知道了~';
        case 'message':
            return '好的~';
        case 'member':
            return '我知道了~';
        case 'memory':
            return '记住了~';
        case 'reminder':
            return '好的~';
        default:
            return '';
    }
}

/**
 * 生成拒绝操作的自然反馈
 * @param {string} reason - 拒绝原因类型
 * @param {object} context - 上下文信息
 * @returns {Promise<string>} 自然拒绝反馈
 */
export async function generateDenyFeedback(reason, context = {}) {
    const DENY_FEEDBACK = {
        low_favor: [
            '嗯...我们还没那么熟呢，这个有点难为我了...',
            '抱歉，我对你还不够了解，不太方便这样做呢...',
            '这个...我需要更信任你才能帮你做哦'
        ],
        not_master: [
            '这个操作只有主人才能让我执行哦',
            '抱歉，这种重要操作我只听主人的',
            '嗯...这个需要主人的许可才行'
        ],
        need_reason: [
            '能告诉我为什么要这样做吗？我有点担心呢...',
            '要做这个操作的话，能告诉我具体原因吗？',
            '这个操作有点敏感，我想知道你的理由...'
        ],
        self_protection: [
            '我不能对自己执行这个操作哦',
            '这样对自己不太好吧...',
            '我不想对自己做这种事呢'
        ],
        target_admin: [
            '抱歉，我无法对管理员执行这个操作',
            '管理员我不能动呢...',
            '这个...管理员有特殊保护哦'
        ],
        unknown_user: [
            '我不认识这个用户呢',
            '这个用户我好像没见过...',
            '我不太了解这个人'
        ]
    };
    
    const feedbackSet = DENY_FEEDBACK[reason];
    if (feedbackSet && Array.isArray(feedbackSet)) {
        return randomChoice(feedbackSet);
    }
    
    return '抱歉，我无法执行这个操作...';
}

/**
 * 生成需要确认的反馈
 * @param {string} action - 操作描述
 * @param {object} context - 上下文信息
 * @returns {string} 确认反馈
 */
export function generateConfirmFeedback(action, context = {}) {
    const CONFIRM_TEMPLATES = [
        `你确定要${action}吗？再想想吧~`,
        `真的要${action}吗？我想确认一下...`,
        `${action}的话...你确定吗？`,
        `嗯...${action}会不会有点...你确定吗？`
    ];
    
    return randomChoice(CONFIRM_TEMPLATES);
}

/**
 * 判断是否应该显示反馈
 * @param {string} toolName - 工具名称
 * @param {object} result - 工具结果
 * @returns {boolean} 是否显示反馈
 */
export function shouldShowFeedback(toolName, result) {
    const SILENT_TOOLS = ['get_user_favor', 'get_user_info', 'get_group_info', 'get_user_profile'];
    
    if (SILENT_TOOLS.includes(toolName) && result.success) {
        return false;
    }
    
    return true;
}
