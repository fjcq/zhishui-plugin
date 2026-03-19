/**
 * 对话基础设置Schema
 */

import { getLatestRoles, getRoleOptions, getApiOptions } from '../utils/schemaUtils.js';

/**
 * 获取对话基础设置Schema
 * @returns {Array} Schema配置
 */
export function getChatBasicSchemas() {
    const currentRoles = getLatestRoles();
    
    return [
        {
            label: '对话基础设置',
            component: 'SOFT_GROUP_BEGIN'
        },
        {
            field: 'chat.NickName',
            label: '对话昵称',
            bottomHelpMessage: '对话触发昵称，如"小止水"',
            component: 'Input',
            componentProps: {
                placeholder: '请输入对话昵称'
            }
        },
        {
            field: 'chat.EnableAt',
            label: '艾特触发',
            bottomHelpMessage: '机器人被艾特时也能触发对话',
            component: 'Switch'
        },
        {
            field: 'chat.EnablePrivateChat',
            label: '私聊AI回复',
            bottomHelpMessage: '开启后，私聊消息将由AI自动回复',
            component: 'Switch'
        },
        {
            field: 'chat.OnlyMaster',
            label: '仅限主人使用',
            bottomHelpMessage: '限制对话功能，仅限主人可用',
            component: 'Switch'
        },
        {
            field: 'chat.Master',
            label: '主人名字',
            bottomHelpMessage: '场景对话中机器人的主人名字',
            component: 'Input',
            componentProps: {
                placeholder: '请输入主人名字'
            }
        },
        {
            field: 'chat.MasterQQ',
            label: '主人QQ',
            bottomHelpMessage: '场景对话中机器人的主人QQ号码',
            component: 'Input',
            componentProps: {
                placeholder: '请输入主人QQ号'
            }
        }
    ];
}

/**
 * 获取对话高级设置Schema
 * @returns {Array} Schema配置
 */
export function getChatAdvancedSchemas() {
    return [
        {
            label: '对话高级设置',
            component: 'SOFT_GROUP_BEGIN'
        },
        {
            field: 'chat.MaxHistory',
            label: '最大历史记录',
            bottomHelpMessage: '最多保存几条对话记录（不含system设定）',
            component: 'InputNumber',
            componentProps: {
                min: 1,
                max: 50
            }
        },
        {
            field: 'chat.ShowReasoning',
            label: '显示推理过程',
            bottomHelpMessage: '是否在回复中显示AI的推理过程',
            component: 'Switch'
        },
        {
            field: 'chat.EnableThinking',
            label: '启用思考模式',
            bottomHelpMessage: '启用DeepSeek思考模式，模型会先输出思维链再给出回答。注意：该模式下不支持temperature、top_p等参数',
            component: 'Switch'
        },
        {
            field: 'chat.LinkMode',
            label: '链接模式',
            bottomHelpMessage: '是否开启对话链接模式',
            component: 'Switch'
        }
    ];
}

/**
 * 获取代理设置Schema
 * @returns {Array} Schema配置
 */
export function getProxySchemas() {
    return [
        {
            label: '代理设置',
            component: 'SOFT_GROUP_BEGIN'
        },
        {
            field: 'proxy.switchProxy',
            label: '启用代理',
            bottomHelpMessage: '是否在搜剧和对话中使用代理',
            component: 'Switch'
        },
        {
            field: 'proxy.proxyAddress',
            label: '代理地址',
            bottomHelpMessage: '代理服务器地址，如 http://127.0.0.1:7890',
            component: 'Input'
        }
    ];
}

export default {
    getChatBasicSchemas,
    getChatAdvancedSchemas,
    getProxySchemas
};
