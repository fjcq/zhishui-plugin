import { Config } from '../../components/index.js';
import path from 'path';
import { isToolCallingSupported } from './api-types.js';

/**
 * 对话上下文缓存路径
 */
export const CHAT_CONTEXT_PATH = path.join(process.cwd(), 'plugins', 'zhishui-plugin', 'resources', 'data', 'chat');

/**
 * 存储每个会话的活跃状态
 * 0: 空闲, 1: 处理中
 */
export const chatActiveMap = {};

/**
 * 存储每个会话的最后请求时间
 */
export const lastRequestTime = {};

/**
 * API请求间隔配置（毫秒）
 * 不同API类型有不同的请求频率限制
 */
export const API_INTERVALS = {
    openai: 1000,        // OpenAI: 1秒
    siliconflow: 500,    // 硅基流动: 0.5秒
    deepseek: 500,       // DeepSeek: 0.5秒
    zhipu: 500,          // 智谱AI: 0.5秒
    tencent: 1000,       // 腾讯元器: 1秒
    gemini: 500,         // Gemini: 0.5秒
    default: 1000        // 默认: 1秒
};

/**
 * 获取当前角色索引
 * @param {Object} e - 事件对象
 * @returns {Promise<number>} 角色索引
 */
export async function getCurrentRoleIndex(e) {
    // 私聊：优先使用用户个人角色配置
    if (!e.group_id && e.user_id) {
        try {
            const userRoleIndex = await Config.GetUserChatConfig(e.user_id, 'RoleIndex');
            if (typeof userRoleIndex === 'number') {
                return userRoleIndex;
            }
        } catch (error) {
            logger.error('[getCurrentRoleIndex] 获取用户角色配置失败:', error);
        }
    }

    // 群聊：使用群专属角色配置
    const groupRoleList = (await Config.Chat.GroupRoleIndex) || [];
    const groupId = e && e.group_id ? String(e.group_id) : null;
    if (groupId && Array.isArray(groupRoleList)) {
        const found = groupRoleList.find(item => String(item.group) === groupId);
        if (found && typeof found.index === 'number') {
            return found.index;
        }
    }

    // 默认：使用全局角色配置
    const globalRoleIndex = await Config.Chat.CurrentRoleIndex;
    return typeof globalRoleIndex === 'number' ? globalRoleIndex : 0;
}

/**
 * 获取当前API配置
 * @param {Object} e - 事件对象
 * @returns {Object} API配置对象 { apiIndex: number, apiConfig: Object }
 */
export async function getCurrentApiConfig(e) {
    const ApiList = await Config.Chat.ApiList || [];
    let apiIndex = typeof (await Config.Chat.CurrentApiIndex) === 'number'
        ? await Config.Chat.CurrentApiIndex
        : parseInt(await Config.Chat.CurrentApiIndex) || 0;

    // 群聊：使用群专属API配置
    if (e.group_id) {
        const groupRoleList = (await Config.Chat.GroupRoleIndex) || [];
        const found = groupRoleList.find(item => String(item.group) === String(e.group_id));
        if (found && typeof found.apiIndex === 'number') {
            apiIndex = found.apiIndex;
        }
    }

    const apiConfig = ApiList[apiIndex] || ApiList[0] || {};
    return { apiIndex, apiConfig };
}

/**
 * 组建 system 消息
 * @param {Object} e - 用户对象，包含用户ID等信息
 * @returns {Promise<string>} 返回组建完成的 system 消息
 */
export async function mergeSystemMessage(e) {
    let merged = {};
    try {
        const sceneJson = await ReadScene();
        const sceneSetting = JSON.parse(sceneJson);
        const roleJson = Config.getJsonConfig('RoleProfile');
        const roles = JSON.parse(roleJson);
        const currentRoleIndex = await getCurrentRoleIndex(e);
        // 深拷贝角色设定，避免污染原数据
        const identitySetting = JSON.parse(JSON.stringify(roles[currentRoleIndex] || {}));
        // 移除请求参数，防止污染上下文
        if ('请求参数' in identitySetting) {
            delete identitySetting['请求参数'];
        }

        // 合并场景设定和角色设定
        merged = {
            ...sceneSetting,
            ...identitySetting
        };

        // 动态更新主人信息，使用实际配置的主人信息
        if (merged['用户身份系统'] && merged['用户身份系统']['主人']) {
            merged['用户身份系统']['主人'].master_name = await Config.Chat.Master || '默认主人昵称';
            merged['用户身份系统']['主人'].master_qq = await Config.Chat.MasterQQ || '10001';
        }

        // 动态更新角色名称，使用用户配置的昵称
        if (merged['基础身份']) {
            merged['基础身份'].名称 = await Config.Chat.NickName || '默认角色名';
        }

        // 获取当前API配置，判断是否支持工具调用
        const { apiConfig } = await getCurrentApiConfig(e);
        const apiType = apiConfig.ApiType || 'default';
        const supportsToolCalling = isToolCallingSupported(apiType);

        // 添加好感度管理说明（角色扮演友好的表述）
        merged['好感度管理'] = {
            '操作指南': supportsToolCalling ? [
                '当需要了解用户好感度时，必须调用get_user_favor工具获取真实数据',
                '当需要调整好感度时，必须调用set_user_favor工具记录变化',
                '不要编造好感度数值，必须通过工具获取真实数据'
            ] : [
                '从用户信息中感知当前好感度状态',
                '根据对话内容自然地调整好感度',
                '好感度变化会自动记录，无需向用户说明',
                '请以角色的自然语言表达方式与用户互动'
            ]
        };

        // 添加信息查询能力说明（角色扮演友好的表述）
        if (supportsToolCalling) {
            merged['信息查询能力'] = {
                '群组信息': '当用户询问群名、群号、群成员数量时，必须调用get_group_info或get_group_members工具获取真实数据',
                '用户资料': '当需要知道用户的真实昵称、头像、等级时，必须调用get_user_profile工具获取真实数据',
                '好感度查询': '当需要了解用户好感度时，必须调用get_user_favor工具获取真实数据',
                '重要提醒': [
                    '所有群名、用户昵称、群成员数量等信息必须通过工具调用获取真实数据，严禁编造',
                    '不要说"让我看看"然后编造数据，必须真正调用工具',
                    '如果工具调用失败，如实告知用户无法获取信息，不要编造'
                ]
            };

            // 添加自然回复指南
            merged['回复风格指南'] = {
                '核心原则': '回复必须像人类一样自然流畅，不能暴露工具调用或数据查询的过程痕迹',
                '禁止行为': [
                    '禁止使用"让我查一下"、"让我看看"、"稍等片刻"、"正在查询"等暗示正在执行查询过程的表述',
                    '禁止使用"根据查询结果"、"数据显示"、"系统返回"等暴露数据是通过查询获得的表述',
                    '禁止在回复中解释你是如何获取到这些信息的'
                ],
                '推荐行为': [
                    '直接说出结果，仿佛你本来就记得或知道这些信息',
                    '用自然的语气增加亲和力',
                    '可以适当加入角色的个人感受和互动',
                    '如果信息不可用，用角色特有的方式委婉表达'
                ],
                '示例对比': {
                    '错误示范': '让我查一下您的等级...根据查询结果，您的等级信息暂时无法获取。',
                    '正确示范': '唔...我这边好像看不到您的等级信息呢，可能是数据还没同步过来~不过没关系，等级又不重要，重要的是我们之间的羁绊呀！'
                }
            };
        }
    } catch (error) {
        console.error('[mergeSystemMessage] 合并系统消息失败:', error);
        merged = {};
    }

    // 转换为JSON字符串
    return JSON.stringify(merged);
}

/**
 * 读场景设定
 * @returns {Promise<string>} 场景设定JSON字符串
 */
export async function ReadScene() {
    return Config.getJsonConfig('SystemConfig');
}

/**
 * 写场景设定
 * @param {Object} Context - 场景设定对象
 * @returns {Promise<void>}
 */
export async function WriteScene(Context) {
    return Config.setJsonConfig('SystemConfig', Context);
}

/**
 * 写主人设定
 * @param {string} Master - 主人名字
 * @param {string} MasterQQ - 主人QQ号
 * @returns {Promise<void>}
 */
export async function WriteMaster(Master, MasterQQ) {
    Config.modify('chat', 'Master', Master);
    Config.modify('chat', 'MasterQQ', MasterQQ);
}
