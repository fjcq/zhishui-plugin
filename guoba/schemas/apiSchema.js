/**
 * API设置Schema
 * 模型接口标签页：API配置列表 + 当前/视觉模型选择
 */

import { getApiTypeSelectOptions, getApiOptions, getVisionApiOptions } from '../utils/schemaUtils.js';

/**
 * 获取API设置Schema
 * @returns {Array} Schema配置
 */
export function getApiSchemas() {
    return [
        {
            label: '🤖 模型接口',
            component: 'SOFT_GROUP_BEGIN'
        },
        {
            field: 'chat.ApiList',
            label: 'API配置列表',
            helpMessage: '可配置多个API进行切换。每个API需填写类型、地址、密钥、模型名称，建议填写标题便于区分',
            bottomHelpMessage: '点卡片可编辑，按标题区分各个API',
            component: 'GSubForm',
            componentProps: {
                multiple: true,
                addButtonText: '添加API配置',
                modalTitle: '编辑API配置',
                schemas: [
                    {
                        field: 'ApiTitle',
                        label: 'API标题',
                        helpMessage: '用于区分不同API配置，显示在列表、切换下拉框和#查看API中。留空时自动按API地址识别服务商名',
                        component: 'Input',
                        componentProps: {
                            placeholder: '如: DeepSeek官方、硅基免费、本地Qwen3'
                        }
                    },
                    {
                        field: 'ApiType',
                        label: 'API类型',
                        helpMessage: '决定调用格式：OpenAI兼容格式覆盖绝大多数服务商（DeepSeek/Kimi/智谱/硅基流动等），Claude原生格式与Gemini格式用于对应官方API，腾讯元器用于混元助手',
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
                        helpMessage: 'API的基础地址，如 https://api.deepseek.com/v1',
                        component: 'Input',
                        required: true,
                        componentProps: {
                            placeholder: '如: https://api.deepseek.com/v1'
                        }
                    },
                    {
                        field: 'ApiKey',
                        label: 'API密钥',
                        helpMessage: '服务商提供的API密钥',
                        component: 'InputPassword',
                        required: true,
                        componentProps: {
                            placeholder: 'sk-...'
                        }
                    },
                    {
                        field: 'ApiModel',
                        label: '模型名称',
                        helpMessage: '要使用的模型名称，如 deepseek-chat、gpt-4o、kimi-k2 等',
                        component: 'Input',
                        required: true,
                        componentProps: {
                            placeholder: '如: deepseek-chat, gpt-4o'
                        }
                    },
                    {
                        field: 'TencentAssistantId',
                        label: '腾讯助手ID',
                        helpMessage: '仅腾讯元器类型需要，在腾讯云控制台创建助手后获取',
                        component: 'Input',
                        componentProps: {
                            placeholder: '仅腾讯元器类型需要'
                        }
                    }
                ]
            }
        },
        {
            field: 'chat.CurrentApiIndex',
            label: '当前使用的API',
            helpMessage: '选择当前激活的API配置，对应上方API列表的顺序',
            component: 'Select',
            componentProps: {
                options: getApiOptions(),
                placeholder: '请先添加API配置'
            }
        },
        {
            field: 'chat.VisionApiIndex',
            label: '图片识别视觉模型',
            helpMessage: '主对话模型无视觉能力时，图片交给此API识别；选"自动选择"则按列表顺序使用第一个带视觉能力的模型',
            component: 'Select',
            componentProps: {
                options: getVisionApiOptions(),
                placeholder: '自动选择'
            }
        }
    ];
}
