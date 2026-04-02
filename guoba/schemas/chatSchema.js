/**
 * 对话基础设置Schema
 * 合并基础设置和高级设置，减少分页
 */

import { getLatestRoles, getRoleOptions, getApiOptions } from '../utils/schemaUtils.js';

/**
 * 获取对话设置Schema（合并基础+高级）
 * @returns {Array} Schema配置
 */
export function getChatBasicSchemas() {
    return [
        {
            label: '💬 对话设置',
            component: 'SOFT_GROUP_BEGIN'
        },
        {
            field: 'chat.NickName',
            label: '对话昵称',
            helpMessage: '设置机器人的昵称，用户可以通过这个昵称来触发对话',
            bottomHelpMessage: '对话触发昵称，如"小止水"',
            component: 'Input',
            componentProps: {
                placeholder: '请输入对话昵称'
            }
        },
        {
            field: 'chat.EnableAt',
            label: '艾特触发',
            helpMessage: '开启后，用户艾特机器人时也会触发AI对话',
            bottomHelpMessage: '机器人被艾特时也能触发对话',
            component: 'Switch'
        },
        {
            field: 'chat.EnablePrivateChat',
            label: '私聊AI回复',
            helpMessage: '开启后，用户私聊机器人时会自动由AI回复',
            bottomHelpMessage: '开启后，私聊消息将由AI自动回复',
            component: 'Switch'
        },
        {
            component: 'Divider',
            label: '高级设置'
        },
        {
            field: 'chat.MaxHistory',
            label: '最大历史记录',
            helpMessage: 'AI对话时会参考的历史消息数量，数量越多上下文越完整，但消耗token也越多',
            bottomHelpMessage: '最多保存几条对话记录，建议10-20条',
            component: 'InputNumber',
            componentProps: {
                min: 1,
                max: 50,
                placeholder: '10'
            }
        },
        {
            field: 'chat.ShowReasoning',
            label: '显示推理过程',
            helpMessage: '开启后，AI会在回复前先展示其推理思考过程（仅部分模型支持）',
            bottomHelpMessage: '是否在回复中显示AI的推理过程',
            component: 'Switch'
        },
        {
            field: 'chat.EnableThinking',
            label: '启用思考模式',
            helpMessage: '启用DeepSeek的思考模式，模型会先进行深度思考再给出回答。注意：此模式下不支持temperature等参数',
            bottomHelpMessage: '启用DeepSeek思考模式，模型会先输出思维链再给出回答',
            component: 'Switch'
        },
        {
            field: 'chat.LinkMode',
            label: '链接模式',
            helpMessage: '开启后，AI回复中的链接会以可点击的形式展示',
            bottomHelpMessage: '是否开启对话链接模式',
            component: 'Switch'
        },
        {
            component: 'Divider',
            label: '存储模式'
        },
        {
            field: 'chat.ContextMode',
            label: '上下文存储模式',
            helpMessage: '控制AI对话记录的保存方式。切换模式会清除当前模式的全部聊天记录。',
            bottomHelpMessage: '角色整合：同角色跨场景记忆；场景隔离：群聊/私聊分开存储（默认角色整合）',
            component: 'Select',
            componentProps: {
                options: [
                    { label: '角色整合（推荐）', value: 'role' },
                    { label: '场景隔离', value: 'isolated' }
                ],
                placeholder: '选择存储模式'
            }
        }
    ];
}

/**
 * 获取对话高级设置Schema（已合并到基础设置，返回空数组）
 * @returns {Array} Schema配置
 */
export function getChatAdvancedSchemas() {
    return [];
}

/**
 * 获取代理设置Schema（已合并到系统设置）
 * @returns {Array} Schema配置
 */
export function getProxySchemas() {
    return [];
}

export default {
    getChatBasicSchemas,
    getChatAdvancedSchemas,
    getProxySchemas
};
