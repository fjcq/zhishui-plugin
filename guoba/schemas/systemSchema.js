/**
 * 系统设置Schema
 * 聚合网络/语音/音乐API/权限为单一标签页（内部Divider分节），
 * 避免锅巴顶部标签页碎片化（每个SOFT_GROUP_BEGIN会被渲染为独立标签页）
 */

import { getVoiceSettingSchemas } from './voiceSchema.js';
import { getMusicApiSchemas } from './musicApiSchema.js';

/**
 * 获取网络设置小节（无分组头，由系统设置统一分节）
 * @returns {Array} Schema配置
 */
function getNetworkSchemas() {
    return [
        {
            component: 'Divider',
            label: '🌐 网络代理'
        },
        {
            field: 'proxy.switchProxy',
            label: '启用代理',
            helpMessage: '开启后，搜剧和AI对话等网络请求将通过代理服务器发送',
            component: 'Switch'
        },
        {
            field: 'proxy.proxyAddress',
            label: '代理地址',
            helpMessage: '代理服务器地址，支持HTTP/HTTPS/SOCKS5协议',
            component: 'Input',
            componentProps: {
                placeholder: 'http://127.0.0.1:7890'
            }
        }
    ];
}

/**
 * 获取权限设置小节（无分组头，由系统设置统一分节）
 * @returns {Array} Schema配置
 */
function getPermissionSchemas() {
    return [
        {
            component: 'Divider',
            label: '🔐 主人与权限'
        },
        {
            field: 'chat.OnlyMaster',
            label: '仅限主人使用',
            helpMessage: '开启后，AI对话功能仅限主人可用，其他用户无法触发对话',
            component: 'Switch'
        },
        {
            field: 'chat.Master',
            label: '主人名字',
            helpMessage: '在角色扮演对话中，机器人对主人的称呼',
            component: 'Input',
            componentProps: {
                placeholder: '请输入主人名字'
            }
        },
        {
            field: 'chat.MasterQQ',
            label: '主人QQ',
            helpMessage: '主人的QQ号码，用于权限验证和角色扮演',
            component: 'Input',
            componentProps: {
                placeholder: '请输入主人QQ号'
            }
        }
    ];
}

/**
 * 获取完整的系统设置Schema
 * 结构：单一标签页 = 网络节 + 语音节 + 音乐API节 + 权限节
 * @returns {Array} Schema配置
 */
export function getSystemSchemas() {
    return [
        {
            label: '⚙️ 系统设置',
            component: 'SOFT_GROUP_BEGIN'
        },
        ...getNetworkSchemas(),
        ...getVoiceSettingSchemas(),
        ...getMusicApiSchemas(),
        ...getPermissionSchemas()
    ];
}
