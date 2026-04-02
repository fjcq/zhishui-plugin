/**
 * 其他设置处理模块
 * 处理场景、代理、主人设置等其他命令
 */

import { Config } from '../../../components/index.js';
import { ReadScene, WriteScene, clearSessionContext, getContextMode, setContextMode, CONTEXT_MODES } from '../helpers.js';
import { clearAllSessions } from '../session.js';

/**
 * 设置对话身份
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleSetContext(e) {
    if (e.isMaster == false) {
        return;
    }

    let context = e.msg.replace(/^.*设置(对话)?身份/g, '').trim();
    if (context.length > 0) {
        await Config.modify('chat', 'Context', context);
        e.reply("对话身份修改为:" + context);
    }
}

/**
 * 设置对话场景
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleSetChatScene(e) {
    if (e.group_id) {
        e.reply('该指令只能在私聊中使用，请私聊机器人设置场景。');
        return;
    }
    let jsonStr = e.msg.replace(/^#?(止水)?(插件|对话)?设置(对话)?场景/, '').trim();
    if (!jsonStr) {
        e.reply('请提供完整的场景JSON内容。例如：#设置场景 {"key":"value"}');
        return;
    }
    try {
        JSON.parse(jsonStr);
        await WriteScene(jsonStr);
        e.reply('场景设定已成功保存！');
    } catch (err) {
        e.reply('场景JSON格式有误：' + err.message);
    }
}

/**
 * 查看场景设定
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleShowChatScene(e) {
    if (e.group_id) {
        e.reply('该指令只能在私聊中使用，请私聊机器人查看场景设定。');
        return;
    }
    const sceneJson = await ReadScene();
    if (!sceneJson) {
        e.reply('未找到任何场景设定。');
        return;
    }
    try {
        const scene = JSON.parse(sceneJson);
        let msg = '【当前场景设定】\n' + Object.entries(scene).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n');
        e.reply(msg);
    } catch {
        e.reply('场景设定数据格式有误。');
    }
}

/**
 * 设置对话主人
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleSetMaster(e) {
    if (!e.isMaster) {
        e.reply('只有主人可以设置对话主人');
        return;
    }

    const match = e.msg.match(/设置(对话)?主人\s*(.+?)\s*(\d+)/);
    if (!match) {
        e.reply('请按照格式设置对话主人：#设置对话主人 <主人名字> <主人QQ>');
        return;
    }

    const [, , masterName, masterQQ] = match;
    await Config.modify('chat', 'Master', masterName);
    await Config.modify('chat', 'MasterQQ', masterQQ);
    e.reply(`已设置对话主人为：${masterName} (${masterQQ})`);
}

/**
 * 设置代理
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleSetProxy(e) {
    if (!e.isMaster) {
        e.reply('只有主人可以设置代理');
        return;
    }

    const match = e.msg.match(/(设置|查看|开启|关闭)代理\s*(.*)/);
    if (!match) {
        e.reply('请使用正确的代理指令：#设置代理 <地址> 或 #开启/关闭代理');
        return;
    }

    const [, action, proxyUrl] = match;

    if (action === '查看') {
        const proxy = await Config.proxy;
        e.reply(`当前代理设置：${proxy.enable ? proxy.url : '未开启'}`);
    } else if (action === '设置') {
        if (!proxyUrl) {
            e.reply('请指定代理地址：#设置代理 <地址>');
            return;
        }
        await Config.modify('proxy', 'url', proxyUrl);
        await Config.modify('proxy', 'enable', true);
        e.reply(`已设置代理地址为：${proxyUrl}`);
    } else if (action === '开启' || action === '关闭') {
        const enable = action === '开启';
        await Config.modify('proxy', 'enable', enable);
        e.reply(`已${enable ? '开启' : '关闭'}代理`);
    }
}

/**
 * 设置连接模式
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleSetLinkMode(e) {
    if (!e.isMaster) {
        e.reply('只有主人可以设置连接模式');
        return;
    }

    const match = e.msg.match(/[链|连]接模式(开启|关闭)/);
    if (!match) {
        e.reply('请使用正确的连接模式指令：#连接模式开启 或 #连接模式关闭');
        return;
    }

    const [, mode] = match;
    const enable = mode === '开启';
    await Config.modify('chat', 'LinkMode', enable);
    e.reply(`已${enable ? '开启' : '关闭'}连接模式`);
}

/**
 * 测试指令
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleTalkTest(e) {
    if (!e.isMaster) {
        e.reply('只有主人可以使用测试指令');
        return;
    }

    const testContent = e.msg.replace(/^#?(止水)?(插件|对话)?测试/, '').trim();
    if (!testContent) {
        e.reply('请输入测试内容：#测试 <内容>');
        return;
    }

    try {
        e.reply(`测试内容：${testContent}\n测试成功！`);
    } catch (error) {
        e.reply(`测试失败：${error.message}`);
    }
}

/**
 * 查看上次对话的API原始返回数据
 * @param {Object} e - 事件对象
 * @param {Object} lastRawResponseMap - 原始响应映射
 * @returns {Promise<void>}
 */
export async function handleShowRawResponse(e, lastRawResponseMap) {
    try {
        const { generateSessionId } = await import('../session.js');
        const sessionId = await generateSessionId(e);
        const rawResponse = lastRawResponseMap[sessionId];

        if (!rawResponse) {
            e.reply('暂无API原始返回数据记录，请先进行一次对话。');
            return;
        }

        let formattedResponse;
        let isJson = false;
        try {
            const parsed = JSON.parse(rawResponse);
            formattedResponse = JSON.stringify(parsed, null, 2);
            isJson = true;
        } catch (error) {
            formattedResponse = rawResponse;
        }

        const maxLength = 4000;
        if (formattedResponse.length > maxLength) {
            e.reply(`【API原始返回数据】\n数据过长（${formattedResponse.length}字符），已截断显示前${maxLength}字符：\n\n${formattedResponse.substring(0, maxLength)}\n\n...（数据已截断）`);
        } else {
            e.reply(`【API原始返回数据】\n\n${formattedResponse}`);
        }
    } catch (error) {
        console.error('[ShowRawResponse] 查看API原始返回数据失败:', error);
        e.reply('获取API原始返回数据失败，请稍后重试。');
    }
}

/**
 * 查看当前存储模式
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleShowContextMode(e) {
    const mode = await getContextMode();
    const modeLabel = mode === 'role' ? '角色整合模式（方案二）' : '场景隔离模式（方案一）';
    const modeDesc = mode === 'role'
        ? '同一角色的群聊和私聊对话记录合并存储，AI可跨场景记忆对话内容'
        : '群聊和私聊的对话记录分开独立存储，互不干扰';
    e.reply(`【当前存储模式】${modeLabel}\n\n${modeDesc}\n\n可用命令：#切换存储模式 isolated|role`);
}

/**
 * 切换存储模式
 * 切换时会清除旧模式的全部聊天记录
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleSwitchContextMode(e) {
    if (!e.isMaster) {
        e.reply('只有主人可以切换存储模式');
        return;
    }

    const arg = e.msg
        .replace(/^#?(止水)?(插件|对话)?切换(存储|对话|上下文)模式/, '')
        .trim()
        .toLowerCase();

    if (!arg || (arg !== 'isolated' && arg !== 'role' && arg !== '方案一' && arg !== '方案二')) {
        const currentMode = await getContextMode();
        const currentLabel = currentMode === 'role' ? '角色整合（方案二）' : '场景隔离（方案一）';
        e.reply(
            `请指定要切换的存储模式：\n` +
            `当前模式: ${currentLabel}\n\n` +
            `用法: #切换存储模式 role\n` +
            `     #切换存储模式 isolated\n\n` +
            `【可选值】\n` +
            `  role     - 角色整合模式（方案二，推荐）：同角色跨场景记忆\n` +
            `  isolated - 场景隔离模式（方案一）：群聊/私聊完全隔离`
        );
        return;
    }

    let targetMode;
    if (arg === 'role' || arg === '方案二') {
        targetMode = CONTEXT_MODES.ROLE;
    } else if (arg === 'isolated' || arg === '方案一') {
        targetMode = CONTEXT_MODES.ISOLATED;
    } else {
        e.reply(`无效的模式参数: ${arg}，请使用 role 或 isolated`);
        return;
    }

    const currentMode = await getContextMode();
    if (currentMode === targetMode) {
        const label = targetMode === 'role' ? '角色整合模式（方案二）' : '场景隔离模式（方案一）';
        e.reply(`当前已经是${label}，无需切换。`);
        return;
    }

    const oldModeLabel = currentMode === 'role' ? '角色整合' : '场景隔离';
    const newModeLabel = targetMode === 'role' ? '角色整合（方案二）' : '场景隔离（方案一）';

    try {
        const clearTarget = currentMode === 'role' ? 'role' : 'isolated';
        const result = clearAllSessions(clearTarget);

        await setContextMode(targetMode);

        const { chatActiveMap, lastRequestTime } = await import('../config.js');
        Object.keys(chatActiveMap).forEach(key => chatActiveMap[key] = 0);
        Object.keys(lastRequestTime).forEach(key => delete lastRequestTime[key]);

        let replyMsg = `存储模式已从「${oldModeLabel}」切换为「${newModeLabel}」`;
        replyMsg += `\n已清除旧模式的全部聊天记录（共${result.count}个文件）`;

        if (result.errors.length > 0) {
            replyMsg += `\n⚠️ 部分文件清除失败: ${result.errors.slice(0, 2).join('; ')}`;
        }
        replyMsg += '\n新的对话将从零开始记录。';
        e.reply(replyMsg);
    } catch (error) {
        console.error('[SwitchContextMode] 切换存储模式失败:', error);
        e.reply(`切换失败: ${error.message}`);
    }
}
