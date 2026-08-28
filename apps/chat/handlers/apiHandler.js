/**
 * API管理处理模块（新架构版）
 * 三指令改操作providers/models新结构：
 * - #设置API类型/标题/地址/密钥/模型/助手ID 值 → 修改当前生效provider/model
 * - #切换API 序号或模型别名 → 切换全局默认模型
 * - #查看API → 展示新结构配置
 */

import { Config } from '../../../components/index.js';
import { loadChatMsg, saveChatMsg, convertChatContextForModel, clearSessionContext, generateSessionId } from '../helpers.js';
import { resolveModel, getAllModels, getAllProviders, setDefaultModel } from '../configs/manager.js';
import { PROVIDER_TYPES } from '../configs/schema.js';
import { createProvider } from '../providers/index.js';

/** 敏感字段：仅允许私聊设置 */
const SENSITIVE_FIELDS = ['密钥', '助手ID'];

/**
 * 解析用户指定的模型（序号或别名）
 * @param {string} arg - 序号（1~N）或模型别名
 * @param {Array} models - models配置列表
 * @returns {Object|null} 匹配到的model条目
 */
function parseModelArg(arg, models) {
    const trimmed = String(arg || '').trim();
    if (!trimmed) {
        return null;
    }
    if (/^\d+$/.test(trimmed)) {
        const idx = parseInt(trimmed, 10) - 1;
        return models[idx] || null;
    }
    return models.find(m => m.name === trimmed) || null;
}

/**
 * 生成模型显示文本（别名 - 提供商/模型名）
 * @param {Object} modelEntry - model条目
 * @returns {string} 显示文本
 */
function modelLabel(modelEntry) {
    return `${modelEntry.name}（${modelEntry.provider}/${modelEntry.model}）`;
}

/**
 * 设置API参数（修改当前生效的provider/model字段）
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleSetApi(e) {
    if (!e.isMaster) {
        e.reply('只有主人可以设置API参数。');
        return;
    }

    const match = e.msg.match(/^#?(止水)?(插件|对话)?设置(对话)?(API|api)(类型|标题|地址|密钥|模型|助手ID)\s+(.+)$/i);
    if (!match) {
        e.reply('格式错误，请用如 #设置API模型 deepseek-chat 或 #设置API密钥 sk-xxx');
        return;
    }

    const field = match[6];
    const value = match[7].trim();

    if (e.group_id && SENSITIVE_FIELDS.includes(field)) {
        e.reply('该参数（如密钥、助手ID）只能在私聊中设置，请私聊机器人操作。');
        return;
    }

    const resolved = await resolveModel(e);
    if (!resolved) {
        e.reply('当前没有可用的模型配置，请先在配置文件中设置providers/models。');
        return;
    }

    const models = await getAllModels();
    const providers = await getAllProviders();
    const modelEntry = models.find(m => m.name === resolved.model.name) || resolved.model;
    const providerIndex = providers.findIndex(p => p.name === modelEntry.provider);
    if (providerIndex === -1) {
        e.reply(`未找到模型"${modelEntry.name}"关联的provider配置。`);
        return;
    }

    switch (field) {
        case '类型': {
            const type = value.toLowerCase();
            if (!Object.values(PROVIDER_TYPES).includes(type)) {
                e.reply(`类型无效，仅支持：${Object.values(PROVIDER_TYPES).join(' / ')}`);
                return;
            }
            providers[providerIndex].type = type;
            break;
        }
        case '标题': {
            // 重命名provider需同步models中的引用，且不能与现有名冲突
            const newName = value;
            if (providers.some(p => p.name === newName)) {
                e.reply(`名称"${newName}"已被其他provider使用，请换一个。`);
                return;
            }
            const oldName = providers[providerIndex].name;
            providers[providerIndex].name = newName;
            models.forEach(m => {
                if (m.provider === oldName) {
                    m.provider = newName;
                }
            });
            await Config.modify('chat', 'models', models);
            await Config.modify('chat', 'providers', providers);
            e.reply(`当前provider已重命名为：${newName}`);
            return;
        }
        case '地址':
            providers[providerIndex].baseUrl = value;
            break;
        case '密钥':
            providers[providerIndex].apiKey = value;
            break;
        case '模型':
            modelEntry.model = value;
            await Config.modify('chat', 'models', models);
            break;
        case '助手ID':
            providers[providerIndex].tencentAssistantId = value;
            break;
        default:
            e.reply('不支持设置该参数');
            return;
    }

    if (field !== '模型') {
        await Config.modify('chat', 'providers', providers);
    }

    let setTip = `当前模型的${field}已设置为：${value}`;
    if (field !== '标题') {
        await clearSessionContext(e);
        setTip += '\n已自动清除上下文缓存，请重新开始对话。';
    }
    e.reply(setTip);
}

/**
 * 切换API（全局默认模型；支持序号或别名）
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleSwitchApi(e) {
    if (!e.isMaster) {
        e.reply('只有主人可以切换API。');
        return;
    }

    const arg = e.msg.replace(/^#?(止水)?(插件|对话)?切换(对话)?(API|api)/i, '').trim();
    const models = await getAllModels();
    if (!models.length) {
        e.reply('未配置任何模型。');
        return;
    }

    const target = parseModelArg(arg, models);
    if (!target) {
        const list = models.map((m, i) => `${i + 1}. ${modelLabel(m)}`).join('\n');
        e.reply(`请输入正确的模型序号或别名，如：#切换API1 或 #切换API${models[0].name}\n【可用模型】\n${list}`);
        return;
    }

    const sessionId = await generateSessionId(e);

    const resolved = await resolveModel(e);
    const oldProvider = resolved?.provider || {};
    const newProvider = (await getAllProviders()).find(p => p.name === target.provider) || {};

    await setDefaultModel(target.name);

    // 跨格式切换时转换历史上下文（语义保留）
    let lost = false;
    const chatMsg = await loadChatMsg(e);
    if (Array.isArray(chatMsg) && chatMsg.length > 0) {
        const { converted, lostContent } = convertChatContextForModel(
            chatMsg,
            String(oldProvider.type || '').toLowerCase(),
            String(newProvider.type || '').toLowerCase(),
            String(resolved?.model?.model || '').toLowerCase(),
            String(target.model || '').toLowerCase()
        );
        await saveChatMsg(sessionId, converted);
        if (lostContent) {
            lost = true;
        }
    }
    await clearSessionContext(e);

    let tip = `已切换到模型：${modelLabel(target)}，格式：${newProvider.type || '未知'}`;
    if (e.group_id) {
        tip += `\n（当前为全局默认；本群如有groupOverrides覆盖则仍以覆盖为准）`;
    }
    if (lost) {
        tip += `\n注意：因模型/接口格式不兼容，历史上下文已被简化或部分丢失。建议重新开始对话。`;
    } else {
        tip += `\n已自动清除上下文缓存，请重新开始对话。`;
    }
    e.reply(tip);
}

/**
 * 查看API（新结构：providers + models + 当前生效模型）
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

    const providers = await getAllProviders();
    const models = await getAllModels();
    if (!models.length) {
        e.reply('未配置任何模型。');
        return;
    }

    const resolved = await resolveModel(e);
    const currentLabel = resolved ? modelLabel(resolved.model) : '无';

    const providerLines = providers.map((p, i) => {
        const attrs = [
            `${i + 1}. ${p.name} [${p.type}]`,
            `   地址: ${p.baseUrl}`,
            `   密钥: ${p.apiKey ? `${String(p.apiKey).slice(0, 6)}****` : '未配置'}`
        ];
        if (p.tencentAssistantId) {
            attrs.push(`   助手ID: ${p.tencentAssistantId}`);
        }
        return attrs.join('\n');
    }).join('\n');

    const modelLines = models.map((m, i) => {
        let visionTag = '';
        try {
            const providerConfig = providers.find(p => p.name === m.provider);
            if (providerConfig && createProvider(providerConfig).supportsVision(m.model)) {
                visionTag = ' [视觉]';
            }
        } catch {
            // 类型异常时跳过视觉标记
        }
        const isCurrent = resolved && m.name === resolved.model.name;
        return `${i + 1}. ${modelLabel(m)}${visionTag}${isCurrent ? ' ✅当前' : ''}`;
    }).join('\n');

    const msg = [
        `【当前生效模型】${currentLabel}`,
        '',
        '【Providers接入点】',
        providerLines,
        '',
        '【Models可用模型】',
        modelLines,
        '',
        `切换模型：#切换API序号或别名  例如 #切换API1 或 #切换API${models[0].name}`,
        '设置参数：#设置API类型/标题/地址/密钥/模型/助手ID 值  例如 #设置API模型 deepseek-chat'
    ].join('\n');

    e.reply(msg);
}
