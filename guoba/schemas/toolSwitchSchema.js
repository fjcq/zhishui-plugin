/**
 * 工具开关设置Schema
 * 用户可以通过锅巴面板控制每个工具的启用状态
 * 按分类分成多个独立的下拉框，便于用户操作
 */

/**
 * 工具分类配置
 * 每个分类包含 label（显示名称）、field（配置字段）和 tools（工具列表）
 */
const TOOL_CATEGORIES = [
    {
        label: '好感度工具',
        field: 'favor_tools',
        tools: [
            { value: 'change_user_favor', label: '调整好感度', desc: '允许AI增减用户好感度' },
            { value: 'get_user_favor', label: '获取好感度', desc: '允许AI查询用户好感度数值' },
            { value: 'set_user_favor', label: '设置好感度', desc: '允许AI精确设置好感度值' },
            { value: 'get_user_info', label: '获取用户信息', desc: '允许AI获取用户详细数据' },
            { value: 'get_group_info', label: '获取群信息', desc: '允许AI获取群组基本信息' },
            { value: 'get_user_profile', label: '获取QQ资料', desc: '允许AI获取用户QQ资料' },
            { value: 'get_group_members', label: '获取群成员', desc: '允许AI获取群成员列表' }
        ]
    },
    {
        label: '好友工具',
        field: 'friend_tools',
        tools: [
            { value: 'get_friend_list', label: '获取好友列表', desc: '允许AI获取Bot的全部好友列表' },
            { value: 'get_friend_info', label: '查询好友信息', desc: '允许AI查询指定好友的详细信息' }
        ]
    },
    {
        label: '群管理工具',
        field: 'group_tools',
        tools: [
            { value: 'mute_group_member', label: '禁言成员', desc: '允许AI禁言/解禁群成员（需Bot是管理员）' },
            { value: 'set_group_card', label: '修改群名片', desc: '允许AI修改群成员名片（需Bot是管理员）' },
            { value: 'set_group_title', label: '设置专属头衔', desc: '允许AI设置群成员专属头衔（需Bot是群主）' },
            { value: 'kick_group_member', label: '移出成员', desc: '允许AI将成员移出群组（需Bot是管理员）' },
            { value: 'delete_message', label: '撤回消息', desc: '允许AI撤回群消息（需Bot是管理员）' },
            { value: 'set_group_name', label: '修改群名称', desc: '允许AI修改群名称（需Bot是管理员）' },
            { value: 'set_group_announcement', label: '发布公告', desc: '允许AI发布群公告（需Bot是管理员）' }
        ]
    },
    {
        label: '互动工具',
        field: 'interact_tools',
        tools: [
            { value: 'poke_user', label: '戳一戳', desc: '允许AI戳一戳用户' },
            { value: 'search_music', label: '点歌', desc: '允许AI搜索并发送音乐' },
            { value: 'generate_meme', label: '表情包生成', desc: '允许AI使用用户头像生成表情包' },
            { value: 'send_image', label: '发送图片', desc: '允许AI发送图片消息' },
            { value: 'send_voice', label: '发送语音', desc: '允许AI发送语音消息' },
            { value: 'send_private_message', label: '发送私聊', desc: '允许AI发送私聊消息' },
            { value: 'forward_message', label: '转发消息', desc: '允许AI转发消息到其他群' },
            { value: 'set_essence_message', label: '设为精华', desc: '允许AI设置精华消息（需Bot是管理员）' }
        ]
    },
    {
        label: '记忆工具',
        field: 'memory_tools',
        tools: [
            { value: 'remember_user_info', label: '记录用户信息', desc: '允许AI记录用户信息到记忆库' },
            { value: 'recall_user_info', label: '获取记忆', desc: '允许AI从记忆库获取用户信息' },
            { value: 'forget_user_info', label: '删除记忆', desc: '允许AI删除记忆库中的用户信息' },
            { value: 'set_reminder', label: '设置提醒', desc: '允许AI为用户设置提醒' },
            { value: 'get_reminders', label: '获取提醒', desc: '允许AI获取用户的提醒列表' },
            { value: 'cancel_reminder', label: '取消提醒', desc: '允许AI取消用户的提醒' },
            { value: 'record_interaction', label: '记录互动', desc: '允许AI记录与用户的重要互动' },
            { value: 'get_interaction_history', label: '获取互动历史', desc: '允许AI获取与用户的历史互动记录' }
        ]
    }
];

/**
 * 默认启用的工具（按分类）
 * 禁言和踢人工具默认关闭，其他工具默认开启
 */
const DEFAULT_ENABLED_TOOLS_BY_CATEGORY = {
    favor_tools: [
        'change_user_favor',
        'get_user_favor',
        'set_user_favor',
        'get_user_info',
        'get_group_info',
        'get_user_profile',
        'get_group_members'
    ],
    friend_tools: [
        'get_friend_list',
        'get_friend_info'
    ],
    group_tools: [
        'set_group_card',
        'set_group_title',
        'delete_message',
        'set_group_name',
        'set_group_announcement'
    ],
    interact_tools: [
        'poke_user',
        'search_music',
        'generate_meme',
        'send_image',
        'send_voice',
        'send_private_message',
        'forward_message',
        'set_essence_message'
    ],
    memory_tools: [
        'remember_user_info',
        'recall_user_info',
        'forget_user_info',
        'set_reminder',
        'get_reminders',
        'cancel_reminder',
        'record_interaction',
        'get_interaction_history'
    ]
};

/**
 * 获取工具开关设置Schema
 * 按分类生成多个独立的下拉框
 * @returns {Array} Schema配置
 */
export function getToolSwitchSchemas() {
    const schemas = [
        {
            label: '🔧 工具调用设置',
            component: 'SOFT_GROUP_BEGIN'
        },
        {
            field: 'tools.EnableToolCalling',
            label: '启用工具调用',
            bottomHelpMessage: '开启后AI可以调用工具执行各种操作，关闭后所有工具都将禁用',
            component: 'Switch'
        }
    ];

    for (const category of TOOL_CATEGORIES) {
        schemas.push({
            field: `tools.${category.field}`,
            label: category.label,
            bottomHelpMessage: `选择允许AI调用的${category.label}，支持多选`,
            component: 'Select',
            componentProps: {
                mode: 'multiple',
                allowClear: true,
                showSearch: true,
                options: category.tools.map(tool => ({
                    value: tool.value,
                    label: tool.label
                })),
                filterOption: (input, option) => {
                    const label = option.label || '';
                    return label.toLowerCase().includes(input.toLowerCase());
                }
            }
        });
    }

    return schemas;
}

/**
 * 所有工具名称列表
 */
export const ALL_TOOL_NAMES = TOOL_CATEGORIES.flatMap(cat => cat.tools.map(t => t.value));

/**
 * 获取默认启用的工具列表（兼容旧格式）
 * @returns {Array} 默认启用的工具名称数组
 */
export function getDefaultEnabledTools() {
    return Object.values(DEFAULT_ENABLED_TOOLS_BY_CATEGORY).flat();
}

/**
 * 默认启用的工具（兼容旧格式）
 */
export const DEFAULT_ENABLED_TOOLS = getDefaultEnabledTools();

/**
 * 获取工具分类配置
 * @returns {Array} 工具分类配置
 */
export function getToolCategories() {
    return TOOL_CATEGORIES;
}

/**
 * 获取按分类的默认启用工具
 * @returns {object} 按分类的默认启用工具
 */
export function getDefaultEnabledToolsByCategory() {
    return DEFAULT_ENABLED_TOOLS_BY_CATEGORY;
}

export default {
    getToolSwitchSchemas,
    ALL_TOOL_NAMES,
    DEFAULT_ENABLED_TOOLS,
    DEFAULT_ENABLED_TOOLS_BY_CATEGORY,
    getDefaultEnabledTools,
    getToolCategories
};
