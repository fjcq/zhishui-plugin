/**
 * API设置Schema
 */

import { getApiTypeSelectOptions, getApiOptions } from '../utils/schemaUtils.js';

/**
 * 获取API设置Schema
 * @returns {Array} Schema配置
 */
export function getApiSchemas() {
    return [
        {
            label: '⚙️ 模型接口',
            component: 'SOFT_GROUP_BEGIN'
        },
        {
            field: 'chat.ApiList',
            label: 'API配置列表',
            helpMessage: '支持OpenAI、DeepSeek、腾讯混元、智谱AI等多种API，可配置多个API进行切换。每个API需填写类型、地址、密钥、模型名称。',
            bottomHelpMessage: '点击"添加API配置"按钮添加新的API，支持多API切换',
            component: 'GSubForm',
            componentProps: {
                multiple: true,
                addButtonText: '添加API配置',
                modalTitle: '编辑API配置',
                schemas: [
                    {
                        field: 'ApiType',
                        label: 'API类型',
                        helpMessage: '不同API类型有不同的调用方式，请选择与您密钥对应的类型',
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
                        helpMessage: 'API的基础地址，如 https://api.openai.com/v1',
                        component: 'Input',
                        required: true,
                        componentProps: {
                            placeholder: '如: https://api.openai.com/v1'
                        }
                    },
                    {
                        field: 'ApiKey',
                        label: 'API密钥',
                        helpMessage: '您的API密钥，将安全存储不会泄露',
                        component: 'Input',
                        required: true,
                        componentProps: {
                            type: 'password',
                            placeholder: 'sk-...'
                        }
                    },
                    {
                        field: 'ApiModel',
                        label: '模型名称',
                        helpMessage: '要使用的模型名称，如 gpt-4、deepseek-chat 等',
                        component: 'Input',
                        required: true,
                        componentProps: {
                            placeholder: '如: gpt-4, deepseek-chat'
                        }
                    },
                    {
                        field: 'TencentAssistantId',
                        label: '腾讯助手ID',
                        helpMessage: '仅腾讯混元API需要，在腾讯云控制台创建助手后获取',
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
            helpMessage: '选择当前激活的API配置，对应上方API列表的顺序',
            bottomHelpMessage: '选择当前激活的API配置',
            component: 'Select',
            componentProps: {
                options: getApiOptions(),
                placeholder: '请先添加API配置'
            }
        }
    ];
}
