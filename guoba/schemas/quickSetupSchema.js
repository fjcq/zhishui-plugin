/**
 * 快速配置Schema
 * 聚合必填项和高频操作，提供新用户引导入口
 */

import { getRoleOptions, getApiOptions, getApiTypeSelectOptions, getResourceOptions } from '../utils/schemaUtils.js';

/**
 * 获取AI对话快速配置Schema
 * @returns {Array} Schema配置
 */
export function getChatQuickSetupSchemas() {
    return [
        {
            label: '⚡ 快速配置',
            component: 'SOFT_GROUP_BEGIN'
        },
        {
            field: 'chat.ApiList',
            label: 'API配置',
            bottomHelpMessage: '必填：配置AI服务的API地址、密钥和模型。支持OpenAI、DeepSeek等多种API。',
            component: 'GSubForm',
            componentProps: {
                multiple: true,
                addButtonText: '添加API配置',
                modalTitle: '编辑API配置',
                schemas: [
                    {
                        field: 'ApiType',
                        label: 'API类型',
                        component: 'Select',
                        required: true,
                        componentProps: {
                            options: getApiTypeSelectOptions(),
                            placeholder: '请选择API类型'
                        }
                    },
                    {
                        field: 'ApiUrl',
                        label: 'API地址',
                        component: 'Input',
                        required: true,
                        componentProps: {
                            placeholder: '如: https://api.openai.com/v1'
                        }
                    },
                    {
                        field: 'ApiKey',
                        label: 'API密钥',
                        component: 'Input',
                        required: true,
                        componentProps: {
                            type: 'password',
                            placeholder: '请输入API密钥'
                        }
                    },
                    {
                        field: 'ApiModel',
                        label: '模型名称',
                        component: 'Input',
                        required: true,
                        componentProps: {
                            placeholder: '如: gpt-4, deepseek-chat'
                        }
                    },
                    {
                        field: 'TencentAssistantId',
                        label: '腾讯助手ID',
                        component: 'Input',
                        componentProps: {
                            placeholder: '仅腾讯API需要'
                        }
                    }
                ]
            }
        },
        {
            field: 'chat.CurrentApiIndex',
            label: '当前使用的API',
            bottomHelpMessage: '选择当前激活的API配置',
            component: 'Select',
            componentProps: {
                options: getApiOptions(),
                placeholder: '请先添加API配置'
            }
        },
        {
            field: 'chat.CurrentRoleIndex',
            label: '当前使用的角色',
            bottomHelpMessage: '选择AI对话的角色人格',
            component: 'Select',
            componentProps: {
                options: getRoleOptions(),
                placeholder: '请选择角色'
            }
        }
    ];
}

/**
 * 获取搜剧快速配置Schema
 * @returns {Array} Schema配置
 */
export function getVideoSearchQuickSetupSchemas() {
    return [
        {
            label: '⚡ 快速配置',
            component: 'SOFT_GROUP_BEGIN'
        },
        {
            field: 'videoSearch.CurrentResourceIndex',
            label: '当前资源站',
            bottomHelpMessage: '选择默认使用的视频资源站点',
            component: 'Select',
            componentProps: {
                options: getResourceOptions(),
                placeholder: '请选择资源站'
            }
        },
        {
            field: 'videoSearch.analysis',
            label: '解析接口',
            bottomHelpMessage: '必填：用于解析视频播放地址的接口',
            component: 'Input',
            componentProps: {
                placeholder: '请输入解析接口地址'
            }
        }
    ];
}
