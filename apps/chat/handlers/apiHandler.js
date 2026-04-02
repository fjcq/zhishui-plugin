/**
 * API管理处理模块
 * 处理API相关的命令
 */

import { Config } from '../../../components/index.js';
import { getCurrentApiConfig, clearSessionContext, loadChatMsg, saveChatMsg, convertChatContextForModel, generateSessionId } from '../helpers.js';
import { getCurrentRoleIndex } from '../config.js';

/**
 * 设置API
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleSetApi(e) {
    if (!e.isMaster) {
        e.reply('只有主人可以设置API参数。');
        return;
    }

    const sensitiveFields = ['ApiKey', 'TencentAssistantId'];
    const match = e.msg.match(/^#?设置API(类型|地址|密钥|模型|助手ID)\s+(.+)$/i);
    if (!match) {
        e.reply('格式错误，请用如 #设置API类型 openai');
        return;
    }

    const keyMap = {
        '类型': 'ApiType',
        '地址': 'ApiUrl',
        '密钥': 'ApiKey',
        '模型': 'ApiModel',
        '助手ID': 'TencentAssistantId'
    };
    const field = keyMap[match[1]];
    const value = match[2].trim();

    if (e.group_id && sensitiveFields.includes(field)) {
        e.reply('该参数（如密钥、助手ID）只能在私聊中设置，请私聊机器人操作。');
        return;
    }

    const ApiList = await Config.Chat.ApiList || [];

    let idx = typeof (await Config.Chat.CurrentApiIndex) === 'number'
        ? await Config.Chat.CurrentApiIndex
        : parseInt(await Config.Chat.CurrentApiIndex) || 0;

    if (e.group_id && Array.isArray(await Config.Chat.GroupRoleIndex)) {
        const groupRoleList = await Config.Chat.GroupRoleIndex;
        const found = groupRoleList.find(item => String(item.group) === String(e.group_id));
        if (found && typeof found.apiIndex === 'number') {
            idx = found.apiIndex;
        }
    }

    if (idx < 0 || idx >= ApiList.length) {
        e.reply(`当前API索引无效，当前共${ApiList.length}个API`);
        return;
    }
    if (!field) {
        e.reply('不支持设置该参数');
        return;
    }
    ApiList[idx][field] = value;
    await Config.modify('chat', 'ApiList', ApiList);
    await clearSessionContext(e);
    e.reply(`当前API的${field}已设置为：${value}\n已自动清除上下文缓存，请重新开始对话。`);
}

/**
 * 切换API
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleSwitchApi(e) {
    if (!e.isMaster) {
        e.reply('只有主人可以切换API。');
        return;
    }

    const apiIndexStr = e.msg.replace(/^#?(止水)?(插件|对话)?切换(对话)?(API|api)/, '').trim();
    const ApiList = await Config.Chat.ApiList || [];
    let idx = parseInt(apiIndexStr, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= ApiList.length) {
        e.reply(`请输入正确的API序号（1~${ApiList.length}），如：#切换API1`);
        return;
    }

    const sessionId = await generateSessionId(e);

    const { apiIndex: oldApiIndex, apiConfig: oldApi } = await getCurrentApiConfig(e);
    const newApi = ApiList[idx] || {};
    const oldModel = (oldApi.ApiModel || '').toLowerCase();
    const newModel = (newApi.ApiModel || '').toLowerCase();
    const oldType = (oldApi.ApiType || '').toLowerCase();
    const newType = (newApi.ApiType || '').toLowerCase();

    await Config.modify('chat', 'CurrentApiIndex', idx);

    let lost = false;
    let chatMsg = await loadChatMsg(e);
    if (Array.isArray(chatMsg) && chatMsg.length > 0) {
        const { converted, lostContent } = convertChatContextForModel(chatMsg, oldType, newType, oldModel, newModel);
        await saveChatMsg(sessionId, converted);
        if (lostContent) lost = true;
    }
    await clearSessionContext(e);

    let tip = `已切换到API序号${idx + 1}，类型：${newApi.ApiType || '未知类型'}`;
    if (lost) tip += `\n注意：因模型/接口格式不兼容，历史上下文已被简化或部分丢失。建议重新开始对话。`;
    else tip += `\n已自动清除上下文缓存，请重新开始对话。`;
    e.reply(tip);
}

/**
 * 查看API
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleShowApi(e) {
    if (!e.isMaster) {
        e.reply('只有主人可以查看API参数。');
        return;
    }

    if (e.group_id) {
        e.reply('该指令只能在私聊中使用，请私聊机器人查看API参数。');
        return;
    }

    const ApiList = await Config.Chat.ApiList || [];
    if (!ApiList.length) {
        e.reply('未配置任何API。');
        return;
    }

    const { apiIndex: idx, apiConfig: api } = await getCurrentApiConfig(e);

    let apiTypeLabel = '全局API';

    if (Array.isArray(await Config.Chat.GroupRoleIndex)) {
        const groupRoleList = await Config.Chat.GroupRoleIndex;
        const found = groupRoleList.find(item => String(item.group) === String(e.group_id));
        if (found && typeof found.apiIndex === 'number') {
            apiTypeLabel = '群专属API';
        }
    }

    if (idx < 0 || idx >= ApiList.length) {
        e.reply('当前API索引无效。');
        return;
    }

    const nameMap = {
        ApiType: '类型',
        ApiUrl: '地址',
        ApiKey: '密钥',
        ApiModel: '模型',
        TencentAssistantId: '助手ID'
    };

    let msg = `【当前API参数】（${apiTypeLabel}）\n${Object.entries(api).map(([k, v]) => `${nameMap[k] || k}: ${v}`).join('\n')}`;

    msg += `\n\n【API列表】\n`;
    ApiList.forEach((item, i) => {
        msg += `${i + 1}. ${item.ApiType || '未知类型'}${i === idx ? ' ✅当前' : ''}\n`;
    });

    msg += `\n切换API：#切换API序号  例如 #切换API1\n`;
    msg += `设置当前API参数：#设置API类型/地址/密钥/模型/助手ID 值  例如 #设置API类型 openai`;

    e.reply(msg.trim());
}
