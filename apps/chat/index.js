/**
 * 对话处理类 - 主入口
 * 整合所有处理器模块
 */

import { plugin } from '../../adapter/index.js';
import { Config, Plugin_Path } from '../../components/index.js';
import Data from '../../components/Data.js';
import { puppeteer } from '../../model/index.js';

import { chatActiveMap, lastRequestTime, CHAT_CONTEXT_PATH } from './config.js';
import { ForwardMsg, msgToAt, sendCodeAsForwardMsg } from './utils.js';
import { textToImage, shouldResponseAsImage } from './chatHelper.js';
import voiceManager from '../voice/voiceManager.js';

import * as handlers from './handlers/index.js';

const logger = global.logger || console;

const voiceList = await Data.readVoiceList();
let chatNickname = await Config.Chat.NickName;

const lastRawResponseMap = {};

export class ChatHandler extends plugin {
    /**
     * 构造函数
     * 初始化对话处理器，配置指令规则
     */
    constructor() {
        super({
            name: '[止水插件]对话',
            dsc: '智能对话',
            event: 'message',
            priority: 8888,
            rule: [
                { reg: `^#?(止水)?(插件|对话)?(取消|结束|重置|关闭)(全部)?(对话|聊天)$`, fnc: 'ResetChat' },
                { reg: `^#?(止水)?(插件|对话)?(语|发)音(开启|关闭)$`, fnc: 'SetVoiceEnable' },
                { reg: `^#?(止水)?(插件|对话)?艾特(开启|关闭)$`, fnc: 'SetAtEnable' },
                { reg: `^#?(止水)?(插件|对话)??设置(对话)?发音人(.*)$`, fnc: 'SetVoiceId' },
                { reg: `^#?(止水)?(插件|对话)??查看(对话)?发音人$`, fnc: 'ShowVoiceId' },
                { reg: '^#?(止水)?(插件|对话)?设置(对话)?身份(.*)', fnc: 'SetContext' },
                { reg: `^#?(止水)?(插件|对话)??查看(对话)?角色$`, fnc: 'ShowContext' },
                { reg: `^#?(止水)?(插件|对话)??设置(对话)?场景(.*)`, fnc: 'SetChatScene' },
                { reg: `^#?(止水)?(插件|对话)??查看(对话)?场景$`, fnc: 'ShowChatScene' },
                { reg: '^#?(止水)?(插件|对话)?查看(好感|亲密)度$', fnc: 'ShowFavor' },
                { reg: `^#?(止水)?(插件|对话)?设置(好感|亲密)度(.*)$`, fnc: 'SetUserFavor' },
                { reg: `^#?(止水)?(插件|对话)?(好感|亲密)度排名$`, fnc: 'ShowFavorRank' },
                { reg: `^#?(止水)?(插件|对话)?查看(好感|亲密)度历史\\s*(\\d*)\\s*$`, fnc: 'ShowFavorHistory' },
                { reg: `^#?(止水)?(插件|对话)?清空(好感|亲密)度$`, fnc: 'ClearAllFavor' },
                { reg: `^#?(止水)?(插件|对话)?设置(对话)?主人(.*)$`, fnc: 'SetMaster' },
                { reg: `^#?(止水)?(插件|对话)?(设置|查看|开启|关闭)代理(.*)$`, fnc: 'SetProxy' },
                { reg: `^#?(止水)?(插件|对话)?[链|连]接模式(开启|关闭)$`, fnc: 'SetLinkMode' },
                { reg: `^#?(止水)?(插件|对话)?设置(对话)?(API|api)(.*)$`, fnc: 'SetApi' },
                { reg: `^#?(止水)?(插件|对话)?切换(对话)?(API|api)(.*)$`, fnc: 'SwitchApi' },
                { reg: `^#?(止水)?(插件|对话)?查看(对话)?(API|api)$`, fnc: 'ShowApi' },
                { reg: `^#?(止水)?(插件|对话)?测试(.*)$`, fnc: 'talkTest' },
                { reg: '^#?(止水)?(插件|对话)?角色列表$', fnc: 'ShowRoleList' },
                { reg: '^#?(止水)?(插件|对话)?切换(对话)?角色(.+)$', fnc: 'SwitchRole' },
                { reg: '^#?(止水)?(插件|对话)?添加(对话)?角色(.*)', fnc: 'AddRole' },
                { reg: '^#?(止水)?私聊回复(开启|关闭)$', fnc: 'SetPrivateChatEnable' },
                { reg: `^#?(止水)?(插件|对话)?查看对话(历史)?$`, fnc: 'ShowChatHistory' },
                { reg: `^#?(止水)?(插件|对话)?重置个人配置$`, fnc: 'ResetUserConfig' },
                { reg: `^#?(止水)?(插件|对话)?查看个人配置$`, fnc: 'ShowUserConfig' },
                { reg: `^#?(止水)?(插件|对话)?查看用户配置\\s*(\\d+)?$`, fnc: 'ShowOtherUserConfig' },
                { reg: `^#?(止水)?(插件|对话)?重置用户配置\\s*(\\d+)$`, fnc: 'ResetOtherUserConfig' },
                { reg: `^#?(止水)?(插件|对话)?查看用户配置统计$`, fnc: 'ShowUserConfigStats' },
                { reg: `^#?(止水)?(插件|对话)?查看(对话)?原始(数据|返回)$`, fnc: 'ShowRawResponse' },
                { reg: `^#?(止水)?(插件|对话)?(查看)?(存储|上下文)模式$`, fnc: 'ShowContextMode' },
                { reg: `^#?(止水)?(插件|对话)?切换?模式\s*(角色|整合|role|方案二)$`, fnc: 'SwitchContextModeRole' },
                { reg: `^#?(止水)?(插件|对话)?切换?模式\s*(场景|隔离|isolated|方案一)$`, fnc: 'SwitchContextModeIsolated' },
                { reg: ``, fnc: 'chat', log: false }
            ]
        });
    }

    /**
     * 重置对话
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async ResetChat(e) {
        if (!e.isMaster) return;
        await handlers.handleResetChat(e);
    }

    /**
     * 处理对话消息
     * @param {Object} e - 事件对象
     * @returns {Promise<boolean>} 是否处理成功
     */
    async chat(e) {
        return await handlers.handleChat(e, chatNickname);
    }

    /**
     * 设置语音开关
     * @param {Object} e - 事件对象
     * @returns {Promise<boolean>} 是否处理成功
     */
    async SetVoiceEnable(e) {
        return await handlers.handleSetVoiceEnable(e);
    }

    /**
     * 设置语音发音人
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async SetVoiceId(e) {
        return await handlers.handleSetVoiceId(e);
    }

    /**
     * 显示语音发音人
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async ShowVoiceId(e) {
        await handlers.handleShowVoiceId(e);
    }

    /**
     * 设置艾特开关
     * @param {Object} e - 事件对象
     * @returns {Promise<boolean>} 是否处理成功
     */
    async SetAtEnable(e) {
        return await handlers.handleSetAtEnable(e);
    }

    /**
     * 设置对话身份
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async SetContext(e) {
        if (!e.isMaster) return;
        await handlers.handleSetContext(e);
    }

    /**
     * 显示对话角色
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async ShowContext(e) {
        await handlers.handleShowContext(e);
    }

    /**
     * 设置对话场景
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async SetChatScene(e) {
        await handlers.handleSetChatScene(e);
    }

    /**
     * 显示对话场景
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async ShowChatScene(e) {
        await handlers.handleShowChatScene(e);
    }

    /**
     * 显示好感度
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async ShowFavor(e) {
        await handlers.handleShowFavor(e);
    }

    /**
     * 设置用户好感度
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async SetUserFavor(e) {
        await handlers.handleSetUserFavor(e);
    }

    /**
     * 显示好感度排名
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async ShowFavorRank(e) {
        await handlers.handleShowFavorRank(e);
    }

    /**
     * 显示好感度历史
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async ShowFavorHistory(e) {
        await handlers.handleShowFavorHistory(e);
    }

    /**
     * 清空所有好感度
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async ClearAllFavor(e) {
        await handlers.handleClearAllFavor(e);
    }

    /**
     * 设置主人
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async SetMaster(e) {
        await handlers.handleSetMaster(e);
    }

    /**
     * 设置代理
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async SetProxy(e) {
        await handlers.handleSetProxy(e);
    }

    /**
     * 设置链接模式
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async SetLinkMode(e) {
        await handlers.handleSetLinkMode(e);
    }

    /**
     * 设置API
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async SetApi(e) {
        await handlers.handleSetApi(e);
    }

    /**
     * 切换API
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async SwitchApi(e) {
        await handlers.handleSwitchApi(e);
    }

    /**
     * 显示API配置
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async ShowApi(e) {
        await handlers.handleShowApi(e);
    }

    /**
     * 测试对话
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async talkTest(e) {
        await handlers.handleTalkTest(e);
    }

    /**
     * 显示角色列表
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async ShowRoleList(e) {
        await handlers.handleShowRoleList(e);
    }

    /**
     * 切换角色
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async SwitchRole(e) {
        await handlers.handleSwitchRole(e);
    }

    /**
     * 添加角色
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async AddRole(e) {
        await handlers.handleAddRole(e);
    }

    /**
     * 设置私聊回复开关
     * @param {Object} e - 事件对象
     * @returns {Promise<boolean>} 是否处理成功
     */
    async SetPrivateChatEnable(e) {
        return await handlers.handleSetPrivateChatEnable(e);
    }

    /**
     * 显示对话历史
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async ShowChatHistory(e) {
        await handlers.handleShowChatHistory(e);
    }

    /**
     * 重置个人配置
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async ResetUserConfig(e) {
        await handlers.handleResetUserConfig(e);
    }

    /**
     * 显示个人配置
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async ShowUserConfig(e) {
        await handlers.handleShowUserConfig(e);
    }

    /**
     * 显示其他用户配置
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async ShowOtherUserConfig(e) {
        await handlers.handleShowOtherUserConfig(e);
    }

    /**
     * 重置其他用户配置
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async ResetOtherUserConfig(e) {
        await handlers.handleResetOtherUserConfig(e);
    }

    /**
     * 显示用户配置统计
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async ShowUserConfigStats(e) {
        await handlers.handleShowUserConfigStats(e);
    }

    /**
     * 显示原始响应
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async ShowRawResponse(e) {
        await handlers.handleShowRawResponse(e, lastRawResponseMap);
    }

    /**
     * 显示上下文模式
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async ShowContextMode(e) {
        await handlers.handleShowContextMode(e);
    }

    /**
     * 切换到角色模式
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async SwitchContextModeRole(e) {
        await handlers.handleSwitchContextMode(e, 'role');
    }

    /**
     * 切换到隔离模式
     * @param {Object} e - 事件对象
     * @returns {Promise<void>}
     */
    async SwitchContextModeIsolated(e) {
        await handlers.handleSwitchContextMode(e, 'isolated');
    }
}

export default ChatHandler;
