/**
 * 其他设置处理模块
 * 处理场景、代理、主人设置等其他命令
 */

import { Config } from '../../../components/index.js';
import { ReadScene, WriteScene, clearSessionContext } from '../helpers.js';

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
        const sessionId = e.group_id ? `group_${e.group_id}` : `user_${e.user_id}`;
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
