import { Config } from '../../components/index.js';
import path from 'path';

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
    const globalRoleIndex = await Config.Chat.RoleIndex;
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
        if (merged['主人信息']) {
            merged['主人信息'].master_name = await Config.Chat.Master || '默认主人昵称';
            merged['主人信息'].master_qq = await Config.Chat.MasterQQ || '10001';
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
