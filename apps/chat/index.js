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
                { reg: `^#?(止水)?(插件|对话)?查看存储模式$`, fnc: 'ShowContextMode' },
                { reg: `^#?(止水)?(插件|对话)?切换(存储|对话|上下文)模式(.*)$`, fnc: 'SwitchContextMode' },
                { reg: ``, fnc: 'chat', log: false }
            ]
        });
    }

    async ResetChat(e) {
        if (!e.isMaster) return;
        await handlers.handleResetChat(e);
    }

    async chat(e) {
        return await handlers.handleChat(e, chatNickname);
    }

    async SetVoiceEnable(e) {
        return await handlers.handleSetVoiceEnable(e);
    }

    async SetVoiceId(e) {
        return await handlers.handleSetVoiceId(e);
    }

    async ShowVoiceId(e) {
        await handlers.handleShowVoiceId(e);
    }

    async SetAtEnable(e) {
        return await handlers.handleSetAtEnable(e);
    }

    async SetContext(e) {
        if (!e.isMaster) return;
        await handlers.handleSetContext(e);
    }

    async ShowContext(e) {
        await handlers.handleShowContext(e);
    }

    async SetChatScene(e) {
        await handlers.handleSetChatScene(e);
    }

    async ShowChatScene(e) {
        await handlers.handleShowChatScene(e);
    }

    async ShowFavor(e) {
        await handlers.handleShowFavor(e);
    }

    async SetUserFavor(e) {
        await handlers.handleSetUserFavor(e);
    }

    async ShowFavorRank(e) {
        await handlers.handleShowFavorRank(e);
    }

    async ShowFavorHistory(e) {
        await handlers.handleShowFavorHistory(e);
    }

    async ClearAllFavor(e) {
        await handlers.handleClearAllFavor(e);
    }

    async SetMaster(e) {
        await handlers.handleSetMaster(e);
    }

    async SetProxy(e) {
        await handlers.handleSetProxy(e);
    }

    async SetLinkMode(e) {
        await handlers.handleSetLinkMode(e);
    }

    async SetApi(e) {
        await handlers.handleSetApi(e);
    }

    async SwitchApi(e) {
        await handlers.handleSwitchApi(e);
    }

    async ShowApi(e) {
        await handlers.handleShowApi(e);
    }

    async talkTest(e) {
        await handlers.handleTalkTest(e);
    }

    async ShowRoleList(e) {
        await handlers.handleShowRoleList(e);
    }

    async SwitchRole(e) {
        await handlers.handleSwitchRole(e);
    }

    async AddRole(e) {
        await handlers.handleAddRole(e);
    }

    async SetPrivateChatEnable(e) {
        return await handlers.handleSetPrivateChatEnable(e);
    }

    async ShowChatHistory(e) {
        await handlers.handleShowChatHistory(e);
    }

    async ResetUserConfig(e) {
        await handlers.handleResetUserConfig(e);
    }

    async ShowUserConfig(e) {
        await handlers.handleShowUserConfig(e);
    }

    async ShowOtherUserConfig(e) {
        await handlers.handleShowOtherUserConfig(e);
    }

    async ResetOtherUserConfig(e) {
        await handlers.handleResetOtherUserConfig(e);
    }

    async ShowUserConfigStats(e) {
        await handlers.handleShowUserConfigStats(e);
    }

    async ShowRawResponse(e) {
        await handlers.handleShowRawResponse(e, lastRawResponseMap);
    }

    async ShowContextMode(e) {
        await handlers.handleShowContextMode(e);
    }

    async SwitchContextMode(e) {
        await handlers.handleSwitchContextMode(e);
    }
}

export default ChatHandler;
