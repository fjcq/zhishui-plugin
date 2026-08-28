/**
 * AI 生图功能设置 Schema
 * providers/models 两级结构（对齐 chat 模块新架构）：
 * 全局参数 + 服务商列表 + 模型列表 + 图像编辑设置
 */

import { getImageModelOptions, getImageProviderOptions } from '../utils/schemaUtils.js';

/**
 * 获取 AI 生图设置的 Schema
 * @returns {Array} Schema 配置
 */
export function getImageGenSchemas() {
    return [
        {
            label: '🎨 AI 生图设置',
            component: 'SOFT_GROUP_BEGIN'
        },
        {
            field: 'imageGen.Enable',
            label: '启用生图功能',
            helpMessage: '开启后，AI 可在对话中调用 generate_image 工具按提示词生成图片。需要先在下方配置至少一个服务商和模型',
            component: 'Switch'
        },
        {
            field: 'imageGen.defaultText2Image',
            label: '默认生图模型',
            helpMessage: '留空（推荐）= 自动选择：使用第一个已配置可用的模型。指定时引用下方模型列表中的条目名称',
            component: 'Select',
            componentProps: {
                options: getImageModelOptions(true),
                placeholder: '自动选择（推荐）',
                showSearch: true,
                filterOption: (input, option) =>
                    String(option.label || '').toLowerCase().includes(String(input).toLowerCase())
            }
        },
        {
            field: 'imageGen.Timeout',
            label: '请求超时(ms)',
            helpMessage: '生图接口调用超时时间，生图通常较慢，建议 60000 以上',
            component: 'InputNumber',
            componentProps: {
                min: 30000,
                max: 300000,
                step: 10000,
                placeholder: '120000（默认）'
            }
        },
        {
            field: 'imageGen.RateLimit',
            label: '频率限制(秒)',
            helpMessage: '同一用户两次生图/编辑调用的最小间隔，0 表示不限制',
            component: 'InputNumber',
            componentProps: {
                min: 0,
                max: 3600,
                placeholder: '10（默认）'
            }
        },
        {
            field: 'imageGen.DefaultSize',
            label: '默认尺寸',
            helpMessage: 'AI 未指定尺寸时使用此默认值。通义万相：1024*1024、720*1280、1280*720；OpenAI 兼容平台按各自模型支持为准（DALL-E：1024x1024 等）',
            component: 'Input',
            componentProps: {
                placeholder: '1024*1024（默认）'
            }
        },
        {
            field: 'imageGen.SaveDir',
            label: '保存目录',
            helpMessage: '生成图片的本地保存目录，留空则保存到 resources/output/imagegen。可填绝对路径或相对插件根目录的路径',
            component: 'Input',
            componentProps: {
                placeholder: '留空使用 resources/output/imagegen'
            }
        },
        {
            field: 'imageGen.providers',
            label: '生图服务商列表',
            helpMessage: 'openai 类型覆盖绝大多数平台（DALL-E/火山方舟/SiliconFlow/Together/Agnes 等）；tongyi 为通义万相（仅需 ApiKey）；wenxin 为文心一格（需 AK+SK）',
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
                        helpMessage: '唯一标识，模型列表中的"所属服务商"引用此名称',
                        component: 'Input',
                        required: true,
                        componentProps: {
                            placeholder: '如: 通义万相、硅基流动、火山方舟'
                        }
                    },
                    {
                        field: 'type',
                        label: '接口类型',
                        helpMessage: 'openai：OpenAI兼容（绝大多数平台）；tongyi：通义万相（阿里云DashScope）；wenxin：文心一格（百度千帆）',
                        component: 'Select',
                        required: true,
                        componentProps: {
                            options: [
                                { value: 'openai', label: 'OpenAI 兼容（DALL-E/火山/SiliconFlow/Agnes 等）' },
                                { value: 'tongyi', label: '通义万相（阿里云 DashScope）' },
                                { value: 'wenxin', label: '文心一格（百度千帆）' }
                            ],
                            placeholder: '请选择接口类型'
                        }
                    },
                    {
                        field: 'baseUrl',
                        label: '接口地址',
                        helpMessage: '仅 openai 类型需要。不含 API 路径的基础地址，如 https://api.siliconflow.cn/v1',
                        component: 'Input',
                        componentProps: {
                            placeholder: 'https://api.siliconflow.cn/v1'
                        }
                    },
                    {
                        field: 'apiKey',
                        label: 'ApiKey',
                        helpMessage: '服务商 API 密钥',
                        component: 'InputPassword',
                        required: true,
                        componentProps: {
                            placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxx'
                        }
                    },
                    {
                        field: 'secretKey',
                        label: 'SecretKey',
                        helpMessage: '仅文心一格类型需要，百度智能云 SK',
                        component: 'InputPassword',
                        componentProps: {
                            placeholder: '仅文心一格需要'
                        }
                    }
                ]
            }
        },
        {
            field: 'imageGen.models',
            label: '生图模型列表',
            helpMessage: '模型条目通过"所属服务商"引用上方服务商。切换生图模型只需改默认生图模型下拉，无需改配置结构',
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
                        helpMessage: '唯一标识，默认生图模型与图像编辑引用此名称',
                        component: 'Input',
                        required: true,
                        componentProps: {
                            placeholder: '如: 万相极速版、豆包Seedream'
                        }
                    },
                    {
                        field: 'provider',
                        label: '所属服务商',
                        helpMessage: '从已添加的服务商列表中选择。若下拉为空，请先在上方"生图服务商列表"中添加并保存',
                        component: 'Select',
                        required: true,
                        componentProps: {
                            options: getImageProviderOptions(),
                            placeholder: '请选择所属服务商',
                            showSearch: true,
                            filterOption: (input, option) =>
                                String(option.label || '').toLowerCase().includes(String(input).toLowerCase())
                        }
                    },
                    {
                        field: 'model',
                        label: '模型名称',
                        helpMessage: '按平台填写。通义：wanx2.1-t2i-turbo 等；DALL-E：dall-e-3；火山：doubao-seedream-3-0-t2i-250415；SiliconFlow：Kwai-Kolors/Kolors 等',
                        component: 'Input',
                        required: true,
                        componentProps: {
                            placeholder: '如: wanx2.1-t2i-turbo'
                        }
                    },
                    {
                        field: 'sizeSeparator',
                        label: '尺寸分隔符',
                        helpMessage: '仅 openai 类型。OpenAI/Together/SiliconFlow 用 x，部分国内平台用 *',
                        component: 'Select',
                        componentProps: {
                            options: [
                                { value: 'x', label: 'x（OpenAI 风格）' },
                                { value: '*', label: '*（国内平台风格）' }
                            ]
                        }
                    },
                    {
                        field: 'responseFormat',
                        label: '返回格式',
                        helpMessage: '仅 openai 类型。url 返回链接；b64_json 返回 base64。部分平台仅支持其中一种',
                        component: 'Select',
                        componentProps: {
                            options: [
                                { value: 'url', label: 'url（链接，推荐）' },
                                { value: 'b64_json', label: 'b64_json（base64）' }
                            ]
                        }
                    },
                    {
                        field: 'quality',
                        label: '图片质量',
                        helpMessage: '仅 openai 类型且部分模型支持（dall-e-3 等）。standard 标准；hd 高清',
                        component: 'Select',
                        componentProps: {
                            options: [
                                { value: 'standard', label: 'standard（标准）' },
                                { value: 'hd', label: 'hd（高清）' }
                            ]
                        }
                    },
                    {
                        field: 'style',
                        label: '默认风格',
                        helpMessage: '仅通义万相 wanx-v1 有效。可选：<auto>、<photography>、<portrait>、<anime>、<oil painting> 等',
                        component: 'Input',
                        componentProps: {
                            placeholder: '<auto>（默认）'
                        }
                    },
                    {
                        field: 'extraParams',
                        label: '额外参数',
                        helpMessage: '仅 openai 类型。JSON 字符串，部分平台需要额外参数，如 {"guidance_scale": 7.5}。无需时留空',
                        component: 'InputTextArea',
                        componentProps: {
                            placeholder: '{"guidance_scale": 7.5, "num_inference_steps": 30}',
                            rows: 2
                        }
                    }
                ]
            }
        },
        {
            component: 'Divider',
            label: '图像编辑'
        },
        {
            field: 'imageGen.edit.enable',
            label: '启用图像编辑',
            helpMessage: '开启后，AI 可在对话中调用 edit_image 工具修改/合成用户图片（换背景、转风格、多图合成）',
            component: 'Switch'
        },
        {
            field: 'imageGen.edit.model',
            label: '编辑模型',
            helpMessage: '引用上方模型列表中的条目名称（需为 openai 类型服务商）。推荐 Agnes agnes-image-2.1-flash（免费）',
            component: 'Select',
            componentProps: {
                options: getImageModelOptions(),
                placeholder: '请先在模型列表添加编辑模型',
                showSearch: true,
                filterOption: (input, option) =>
                    String(option.label || '').toLowerCase().includes(String(input).toLowerCase())
            }
        },
        {
            field: 'imageGen.edit.maxImages',
            label: '最大输入图数',
            helpMessage: '单次编辑允许传入的最大图片数（1~4），多图合成场景使用',
            component: 'InputNumber',
            componentProps: {
                min: 1,
                max: 4,
                step: 1,
                placeholder: '4（默认）'
            }
        }
    ];
}
