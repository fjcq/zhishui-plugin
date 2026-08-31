/**
 * 入群验证设置指令处理器
 * 提供验证群增删、总开关与配置查看的指令入口
 * 所有设置指令仅支持在群内使用，且启用验证要求 Bot 拥有群管理员权限
 */

import {
    getVerifyConfig,
    addVerifyGroup,
    removeVerifyGroup,
    setVerifyEnable
} from '../config.js';
import {
    isBotGroupAdmin,
    handleStopVerifyByCommand,
    handleRestartVerifyByCommand
} from './verifyHandler.js';

/**
 * 检查操作权限：主人或群管理员/群主
 * @param {object} e - 事件对象
 * @returns {boolean} 是否有权限
 */
function checkPermission(e) {
    if (e?.isMaster) {
        return true;
    }
    if (e?.isGroup && (e?.member?.is_admin || e?.member?.is_owner)) {
        return true;
    }
    return e?.sender?.role === 'admin' || e?.sender?.role === 'owner';
}

/**
 * 校验指令执行环境：必须为群聊（私聊禁用，防止远程指定群号添加）
 * @param {object} e - 事件对象
 * @returns {boolean} 是否在群内
 */
function requireGroup(e) {
    return !!e?.group_id;
}

/**
 * 校验 Bot 在当前群具备管理员权限（启用验证的前提条件）
 * @param {object} e - 事件对象
 * @returns {Promise<boolean>} true=可启用，false=不可启用
 */
async function checkBotAdminForEnable(e) {
    const isAdmin = await isBotGroupAdmin(e, e.group_id);
    if (isAdmin === false) {
        await e.reply('Bot 在本群没有管理员权限，无法踢出超时未验证的成员，请先授予 Bot 群管理员后再启用入群验证～', true);
        return false;
    }
    if (isAdmin === null) {
        logger.warn('[入群验证] 无法确认 Bot 群权限，已放行（运行时将再次校验）');
    }
    return true;
}

/**
 * 处理添加验证群指令（仅群内可用，直接作用于本群）
 * @param {object} e - 事件对象
 * @returns {Promise<boolean>} 是否拦截消息
 */
export async function handleAddVerifyGroup(e) {
    if (!requireGroup(e)) {
        await e.reply('该指令仅支持在群内使用，请在目标群中发送“#添加验证群”～', true);
        return true;
    }

    if (!checkPermission(e)) {
        await e.reply('只有主人或群管理员才能添加验证群哦～', true);
        return true;
    }

    if (!(await checkBotAdminForEnable(e))) {
        return true;
    }

    const result = addVerifyGroup(e.group_id);
    await e.reply(result.message, true);
    return true;
}

/**
 * 处理移除验证群指令（仅群内可用，直接作用于本群）
 * @param {object} e - 事件对象
 * @returns {Promise<boolean>} 是否拦截消息
 */
export async function handleRemoveVerifyGroup(e) {
    if (!requireGroup(e)) {
        await e.reply('该指令仅支持在群内使用，请在目标群中发送“#删除验证群”～', true);
        return true;
    }

    if (!checkPermission(e)) {
        await e.reply('只有主人或群管理员才能移除验证群哦～', true);
        return true;
    }

    const result = removeVerifyGroup(e.group_id);
    await e.reply(result.message, true);
    return true;
}

/**
 * 处理入群验证开关指令（群内开启时校验 Bot 管理员权限）
 * @param {object} e - 事件对象
 * @returns {Promise<boolean>} 是否拦截消息
 */
export async function handleToggleVerify(e) {
    if (!e?.isMaster) {
        await e.reply('只有主人才能开关入群验证哦～', true);
        return true;
    }

    const enable = /开启$/.test(String(e.msg || ''));

    // 开启时若在群内，校验 Bot 在本群的管理员权限
    if (enable && requireGroup(e) && !(await checkBotAdminForEnable(e))) {
        return true;
    }

    const result = setVerifyEnable(enable);
    await e.reply(result.message, true);
    return true;
}

/**
 * 处理停止验证指令（主人干预：放行指定成员或全群待验证成员，视为通过）
 * @param {object} e - 事件对象
 * @returns {Promise<boolean>} 是否拦截消息
 */
export async function handleStopVerifyCommand(e) {
    if (!requireGroup(e)) {
        await e.reply('该指令仅支持在群内使用，请@目标成员发送“#停止验证”～', true);
        return true;
    }

    if (!checkPermission(e)) {
        await e.reply('只有主人或群管理员才能停止验证哦～', true);
        return true;
    }

    return await handleStopVerifyByCommand(e);
}

/**
 * 处理重新验证指令（主人干预：对指定待验证成员重置会话并重新出题）
 * @param {object} e - 事件对象
 * @returns {Promise<boolean>} 是否拦截消息
 */
export async function handleRestartVerifyCommand(e) {
    if (!requireGroup(e)) {
        await e.reply('该指令仅支持在群内使用，请@目标成员发送“#重新验证”～', true);
        return true;
    }

    if (!checkPermission(e)) {
        await e.reply('只有主人或群管理员才能重新验证哦～', true);
        return true;
    }

    return await handleRestartVerifyByCommand(e);
}

/**
 * 处理查看验证设置指令
 * @param {object} e - 事件对象
 * @returns {Promise<boolean>} 是否拦截消息
 */
export async function handleVerifySettings(e) {
    const config = getVerifyConfig();

    const lines = [
        '【入群验证设置】',
        `状态：${config.enable ? '已开启' : '已关闭'}`,
        `AI 处理：${config.useAI ? '已开启（AI 出题、判定与回应）' : '未开启（本地出题与判定）'}`,
        `验证群：${config.verifyGroups.length > 0 ? config.verifyGroups.join('、') : '暂未配置'}`,
        `超时时限：${Math.max(1, Math.round(config.timeout / 60))} 分钟（超时公告后移出群聊）`,
        '答错处理：撤回答错消息并提醒继续作答，不限次数',
        `通过冷却：${config.passCooldown > 0 ? `${Math.round(config.passCooldown / 3600)} 小时` : '不冷却（每次入群都验证）'}`
    ];

    await e.reply(lines.join('\n'), true);
    return true;
}
