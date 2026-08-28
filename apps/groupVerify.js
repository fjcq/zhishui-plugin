/**
 * 入群验证模块入口（消息事件）
 * 负责验证答案校验与设置指令处理
 */

import { plugin } from '../adapter/index.js';
import {
    handleVerifyAnswer,
    handleAddVerifyGroup,
    handleRemoveVerifyGroup,
    handleToggleVerify,
    handleVerifySettings
} from './groupVerify/handlers/index.js';

export class GroupVerify extends plugin {
    constructor() {
        super({
            name: '[止水插件]入群验证',
            dsc: '新成员入群真人验证',
            event: 'message',
            priority: 999,
            rule: [
                {
                    reg: '^(#|\\/)?添加验证群.*$',
                    fnc: 'AddVerifyGroup'
                },
                {
                    reg: '^(#|\\/)?(移除|删除)验证群.*$',
                    fnc: 'RemoveVerifyGroup'
                },
                {
                    reg: '^(#|\\/)?入群验证(开启|关闭)$',
                    fnc: 'ToggleVerify'
                },
                {
                    reg: '^(#|\\/)?(入群验证|验证群)(设置|状态|查看)$',
                    fnc: 'VerifySettings'
                },
                {
                    reg: '',
                    fnc: 'VerifyAnswer',
                    log: false
                }
            ]
        });
    }

    /**
     * 添加验证群
     * @param {object} e - 事件对象
     */
    async AddVerifyGroup(e) {
        return await handleAddVerifyGroup(e);
    }

    /**
     * 移除验证群
     * @param {object} e - 事件对象
     */
    async RemoveVerifyGroup(e) {
        return await handleRemoveVerifyGroup(e);
    }

    /**
     * 入群验证开关
     * @param {object} e - 事件对象
     */
    async ToggleVerify(e) {
        return await handleToggleVerify(e);
    }

    /**
     * 查看验证设置
     * @param {object} e - 事件对象
     */
    async VerifySettings(e) {
        return await handleVerifySettings(e);
    }

    /**
     * 校验验证答案（仅对待验证成员生效）
     * @param {object} e - 事件对象
     */
    async VerifyAnswer(e) {
        return await handleVerifyAnswer(e);
    }
}

export default GroupVerify;
