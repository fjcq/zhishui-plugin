/**
 * 入群验证模块入口（入群通知事件）
 * 新成员入群时发送随机验证问题
 */

import { plugin } from '../adapter/index.js';
import { handleGroupIncrease } from './groupVerify/handlers/index.js';

export class GroupVerifyNotice extends plugin {
    constructor() {
        super({
            name: '[止水插件]入群验证通知',
            dsc: '新成员入群真人验证（通知监听）',
            event: 'notice.group.increase',
            priority: 500,
            rule: [
                {
                    reg: '',
                    fnc: 'GroupIncrease',
                    log: false
                }
            ]
        });
    }

    /**
     * 处理新成员入群事件
     * @param {object} e - notice 事件对象
     */
    async GroupIncrease(e) {
        return await handleGroupIncrease(e);
    }
}

export default GroupVerifyNotice;
