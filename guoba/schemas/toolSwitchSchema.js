/**
 * 工具开关设置Schema
 * 用户可以通过锅巴面板控制每个工具的启用状态
 * 支持黑名单/白名单两种管理模式
 */

/**
 * 工具分类配置
 * 每个分类包含 label（显示名称）和 tools（工具列表）
 */
const TOOL_CATEGORIES = [
    {
        label: '好感度工具',
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
        tools: [
            { value: 'get_friend_list', label: '获取好友列表', desc: '允许AI获取Bot的全部好友列表' },
            { value: 'get_friend_info', label: '查询好友信息', desc: '允许AI查询指定好友的详细信息' }
        ]
    },
    {
        label: '群管理工具',
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
        label: '音乐工具',
        tools: [
            { value: 'search_music', label: '搜索音乐', desc: '允许AI搜索音乐并返回列表' },
            { value: 'play_music', label: '播放音乐', desc: '允许AI播放指定音乐' },
            { value: 'get_lyrics', label: '获取歌词', desc: '允许AI获取歌曲歌词' },
            { value: 'get_playlist', label: '获取歌单', desc: '允许AI获取歌单内容' }
        ]
    },
    {
        label: '消息工具',
        tools: [
            { value: 'send_message', label: '发送消息', desc: '允许AI发送混合消息（文本、@、图片、回复）' },
            { value: 'send_image', label: '发送图片', desc: '允许AI发送图片消息' },
            { value: 'send_voice', label: '发送语音', desc: '允许AI发送语音消息' },
            { value: 'send_private_message', label: '发送私聊', desc: '允许AI发送私聊消息' },
            { value: 'send_group_message', label: '发送群消息', desc: '允许AI发送群消息到指定群组' },
            { value: 'forward_message', label: '转发消息', desc: '允许AI转发消息到其他群' },
            { value: 'recall_message', label: '撤回消息', desc: '允许AI撤回消息' },
            { value: 'set_essence_message', label: '设为精华', desc: '允许AI设置精华消息（需Bot是管理员）' },
            { value: 'get_scene_info', label: '获取场景信息', desc: '允许AI获取当前对话场景信息' },
            { value: 'get_group_member_info', label: '获取群成员信息', desc: '允许AI获取群成员详细信息' },
            { value: 'get_group_info', label: '获取群组信息', desc: '允许AI获取群组详细信息' }
        ]
    },
    {
        label: '互动工具',
        tools: [
            { value: 'poke_user', label: '戳一戳', desc: '允许AI戳一戳用户' },
            { value: 'generate_meme', label: '表情包生成', desc: '允许AI使用用户头像生成表情包' }
        ]
    },
    {
        label: '记忆工具',
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
    },
    {
        label: '输出工具',
        tools: [
            { value: 'output_code', label: '输出代码', desc: '允许AI以结构化方式输出代码示例' }
        ]
    }
];

/**
 * 默认禁用的工具（黑名单模式的默认值）
 * 敏感操作默认禁用，需要用户手动开启
 */
const DEFAULT_DISABLED_TOOLS = [
    'mute_group_member',
    'kick_group_member'
];

/**
 * 获取所有工具选项（扁平化）
 * @returns {Array} 工具选项数组
 */
function getAllToolOptions() {
    return TOOL_CATEGORIES.flatMap(cat =>
        cat.tools.map(tool => ({
            value: tool.value,
            label: `[${cat.label}] ${tool.label}`
        }))
    );
}

/**
 * 获取工具开关设置Schema
 * 支持黑名单/白名单两种管理模式
 * @returns {Array} Schema配置
 */
export function getToolSwitchSchemas() {
    const allToolOptions = getAllToolOptions();

    return [
        {
            label: '🔧 工具管理',
            component: 'SOFT_GROUP_BEGIN'
        },
        {
            field: 'tools.EnableToolCalling',
            label: '启用工具调用',
            bottomHelpMessage: '开启后AI可以调用工具执行各种操作，关闭后所有工具都将禁用',
            component: 'Switch'
        },
        {
            field: 'tools.ToolManageMode',
            label: '管理模式',
            bottomHelpMessage: '黑名单：启用所有工具，排除列表中的工具；白名单：只启用列表中的工具',
            component: 'Select',
            componentProps: {
                options: [
                    { value: 'blacklist', label: '黑名单模式（推荐）' },
                    { value: 'whitelist', label: '白名单模式' }
                ]
            }
        },
        {
            field: 'tools.ToolList',
            label: '工具列表',
            bottomHelpMessage: '黑名单模式：填写要禁用的工具；白名单模式：填写要启用的工具。支持搜索和多选。',
            component: 'Select',
            componentProps: {
                mode: 'multiple',
                allowClear: true,
                showSearch: true,
                options: allToolOptions,
                filterOption: (input, option) => {
                    const label = option.label || '';
                    return label.toLowerCase().includes(input.toLowerCase());
                }
            }
        }
    ];
}

/**
 * 所有工具名称列表
 */
export const ALL_TOOL_NAMES = TOOL_CATEGORIES.flatMap(cat => cat.tools.map(t => t.value));

/**
 * 获取默认禁用的工具列表
 * @returns {Array} 默认禁用的工具名称数组
 */
export function getDefaultDisabledTools() {
    return [...DEFAULT_DISABLED_TOOLS];
}

/**
 * 获取默认启用的工具列表（黑名单模式下的默认值）
 * @returns {Array} 默认启用的工具名称数组
 */
export function getDefaultEnabledTools() {
    return ALL_TOOL_NAMES.filter(name => !DEFAULT_DISABLED_TOOLS.includes(name));
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
 * 获取默认禁用的工具
 * @returns {Array} 默认禁用的工具名称数组
 */
export function getDefaultDisabledToolsList() {
    return DEFAULT_DISABLED_TOOLS;
}

export default {
    getToolSwitchSchemas,
    ALL_TOOL_NAMES,
    DEFAULT_ENABLED_TOOLS,
    DEFAULT_DISABLED_TOOLS,
    getDefaultEnabledTools,
    getDefaultDisabledTools,
    getDefaultDisabledToolsList,
    getToolCategories
};
