/**
 * API设置Schema
 * 模型接口标签页：providers/models 两级结构（对齐运行时新架构与生图面板）
 * 服务商列表（接入点）+ 模型列表（引用服务商）+ 默认/视觉模型选择
 */

import { getChatModelOptions, getChatProviderOptions } from '../utils/schemaUtils.js';

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
            field: 'chat.providers',
            label: '对话服务商列表',
            helpMessage: '按接口格式配置接入点，同一服务商的多个模型共用一条（密钥/地址只填一次）。openai 类型覆盖绝大多数平台，anthropic/gemini/tencent 为对应官方原生格式',
            bottomHelpMessage: '点卡片可编辑，按名称区分各个服务商',
            component: 'GSubForm',
            componentProps: {
                multiple: true,
                addButtonText: '添加服务商',
                modalTitle: '编辑服务商',
                schemas: [
                    {
                        field: 'name',
                        label: '服务商名称',
                        helpMessage: '唯一标识，模型列表中的"所属服务商"引用此名称，如 DeepSeek官方、硅基免费、本地Qwen3',
                        component: 'Input',
                        required: true,
                        componentProps: {
                            placeholder: '如: DeepSeek官方、硅基流动、本地Ollama'
                        }
                    },
                    {
                        field: 'type',
                        label: '接口类型',
                        helpMessage: 'openai：OpenAI兼容格式（DeepSeek/Kimi/智谱/硅基流动等绝大多数平台）；anthropic：Claude原生格式；gemini：Gemini原生格式；tencent：腾讯元器（需助手ID）',
                        component: 'Select',
                        required: true,
                        componentProps: {
                            options: [
                                { value: 'openai', label: 'OpenAI 兼容（绝大多数平台）' },
                                { value: 'anthropic', label: 'Anthropic 原生（Claude）' },
                                { value: 'gemini', label: 'Google Gemini 原生' },
                                { value: 'tencent', label: '腾讯元器（需助手ID）' }
                            ],
                            placeholder: '请选择接口类型'
                        }
                    },
                    {
                        field: 'baseUrl',
                        label: '接口地址',
                        helpMessage: 'openai 格式填基础地址（自动拼接 /chat/completions），如 https://api.deepseek.com/v1；anthropic/gemini 填对应端点前缀；tencent 填完整接口地址',
                        component: 'Input',
                        required: true,
                        componentProps: {
                            placeholder: '如: https://api.deepseek.com/v1'
                        }
                    },
                    {
                        field: 'apiKey',
                        label: 'API密钥',
                        helpMessage: '服务商提供的API密钥',
                        component: 'InputPassword',
                        required: true,
                        componentProps: {
                            placeholder: 'sk-...'
                        }
                    },
                    {
                        field: 'tencentAssistantId',
                        label: '腾讯助手ID',
                        helpMessage: '仅腾讯元器类型需要，在腾讯元器平台创建智能体后获取',
                        component: 'Input',
                        componentProps: {
                            placeholder: '仅腾讯元器类型需要'
                        }
                    }
                ]
            }
        },
        {
            field: 'chat.models',
            label: '对话模型列表',
            helpMessage: '模型条目通过"所属服务商"引用上方服务商，切换对话模型只需改下方默认模型下拉。高级参数（temperature等）在 config/chat.yaml 对应模型的 params 下手动配置，面板保存时自动保留',
            bottomHelpMessage: '点卡片可编辑，按别名区分各个模型',
            component: 'GSubForm',
            componentProps: {
                multiple: true,
                addButtonText: '添加模型',
                modalTitle: '编辑模型',
                schemas: [
                    {
                        field: 'name',
                        label: '模型别名',
                        helpMessage: '唯一标识，默认模型/视觉模型/群覆盖引用此名称',
                        component: 'Input',
                        required: true,
                        componentProps: {
                            placeholder: '如: DeepSeek-V3、Kimi-K2、本地Qwen3'
                        }
                    },
                    {
                        field: 'provider',
                        label: '所属服务商',
                        helpMessage: '从已添加的服务商列表中选择。若下拉为空，请先在上方"对话服务商列表"中添加并保存',
                        component: 'Select',
                        required: true,
                        componentProps: {
                            options: getChatProviderOptions(),
                            placeholder: '请选择所属服务商',
                            showSearch: true,
                            filterOption: (input, option) =>
                                String(option.label || '').toLowerCase().includes(String(input).toLowerCase())
                        }
                    },
                    {
                        field: 'model',
                        label: '模型名称',
                        helpMessage: '按平台填写的模型标识，如 deepseek-chat、gpt-4o、kimi-k2、gemini-2.5-flash',
                        component: 'Input',
                        required: true,
                        componentProps: {
                            placeholder: '如: deepseek-chat, gpt-4o'
                        }
                    },
                    {
                        field: 'vision',
                        label: '视觉能力',
                        helpMessage: '该模型能否看懂图片：自动判断按模型名推断（gpt-4o/glm-4v/qwen-vl等）；关键词识别不准时可在此强制开启或关闭',
                        component: 'Select',
                        componentProps: {
                            options: [
                                { label: '自动判断', value: 'auto' },
                                { label: '强制开启（有视觉能力）', value: 'true' },
                                { label: '强制关闭（无视觉能力）', value: 'false' }
                            ]
                        }
                    }
                ]
            }
        },
        {
            field: 'chat.defaultModel',
            label: '默认对话模型',
            helpMessage: '当前生效的全局对话模型。自动选择 = 使用模型列表中第一个条目；群聊可通过群覆盖指令单独指定',
            component: 'Select',
            componentProps: {
                options: getChatModelOptions(true),
                placeholder: '自动选择（第一个模型）',
                showSearch: true,
                filterOption: (input, option) =>
                    String(option.label || '').toLowerCase().includes(String(input).toLowerCase())
            }
        },
        {
            field: 'chat.visionModel',
            label: '图片识别视觉模型',
            helpMessage: '主对话模型无视觉能力时，图片交给此模型识别；自动选择则按列表顺序使用第一个带视觉能力的模型',
            component: 'Select',
            componentProps: {
                options: getChatModelOptions(true),
                placeholder: '自动选择（第一个视觉模型）',
                showSearch: true,
                filterOption: (input, option) =>
                    String(option.label || '').toLowerCase().includes(String(input).toLowerCase())
            }
        }
    ];
}
