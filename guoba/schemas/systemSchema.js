/**
 * 系统设置Schema
 * 整合网络设置、语音设置、权限设置
 */

import { getVoiceSettingSchemas } from './voiceSchema.js';

/**
 * 获取网络设置Schema
 * @returns {Array} Schema配置
 */
export function getNetworkSchemas() {
    return [
        {
            label: '🌐 网络设置',
            component: 'SOFT_GROUP_BEGIN'
        },
        {
            field: 'proxy.switchProxy',
            label: '启用代理',
            helpMessage: '开启后，搜剧和AI对话等网络请求将通过代理服务器发送',
            bottomHelpMessage: '是否在搜剧和对话中使用代理服务器',
            component: 'Switch'
        },
        {
            field: 'proxy.proxyAddress',
            label: '代理地址',
            helpMessage: '代理服务器地址，支持HTTP/HTTPS/SOCKS5协议',
            bottomHelpMessage: '代理服务器地址，如 http://127.0.0.1:7890',
            component: 'Input',
            componentProps: {
                placeholder: 'http://127.0.0.1:7890'
            }
        }
    ];
}

/**
 * 获取权限设置Schema
 * @returns {Array} Schema配置
 */
export function getPermissionSchemas() {
    return [
        {
            label: '🔐 权限设置',
            component: 'SOFT_GROUP_BEGIN'
        },
        {
            field: 'chat.OnlyMaster',
            label: '仅限主人使用',
            helpMessage: '开启后，AI对话功能仅限主人可用，其他用户无法触发对话',
            bottomHelpMessage: '开启后，对话功能仅限主人可用',
            component: 'Switch'
        },
        {
            field: 'chat.Master',
            label: '主人名字',
            helpMessage: '在角色扮演对话中，机器人对主人的称呼',
            bottomHelpMessage: '场景对话中机器人的主人名字',
            component: 'Input',
            componentProps: {
                placeholder: '请输入主人名字'
            }
        },
        {
            field: 'chat.MasterQQ',
            label: '主人QQ',
            helpMessage: '主人的QQ号码，用于权限验证和角色扮演',
            bottomHelpMessage: '场景对话中机器人的主人QQ号码',
            component: 'Input',
            componentProps: {
                placeholder: '请输入主人QQ号'
            }
        }
    ];
}

/**
 * 获取完整的系统设置Schema
 * @returns {Array} Schema配置
 */
export function getSystemSchemas() {
    return [
        ...getNetworkSchemas(),
        ...getVoiceSettingSchemas(),
        ...getPermissionSchemas()
    ];
}

export default {
    getNetworkSchemas,
    getPermissionSchemas,
    getSystemSchemas
};
