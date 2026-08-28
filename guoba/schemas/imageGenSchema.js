/**
 * AI 生图功能设置 Schema
 * 全局参数 + 四服务商分节（通义万相/DALL-E/文心一格/自定义）+ 图像编辑
 */

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
            helpMessage: '开启后，AI 可在对话中调用 generate_image 工具按提示词生成图片。需要先配置至少一个服务商的 API Key',
            component: 'Switch'
        },
        {
            field: 'imageGen.DefaultProvider',
            label: '默认服务商',
            helpMessage: '留空（推荐）= 自动选择：只配置一个服务商时自动使用，配置多个时按 tongyi → dall_e → wenxin → custom 顺序选择',
            component: 'Select',
            componentProps: {
                options: [
                    { value: '', label: '自动选择（推荐）' },
                    { value: 'tongyi', label: '通义万相（阿里云 DashScope）' },
                    { value: 'dall_e', label: 'DALL-E（OpenAI）' },
                    { value: 'wenxin', label: '文心一格（百度千帆）' },
                    { value: 'custom', label: '自定义（OpenAI 兼容接口：火山/SiliconFlow 等）' }
                ]
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
            helpMessage: '同一用户两次生图调用的最小间隔，0 表示不限制',
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
            helpMessage: 'AI 未指定尺寸时使用此默认值。通义万相：1024*1024、720*1280、1280*720；DALL-E：1024x1024、1792x1024、1024x1792；文心一格：1024*1024、1024*1536、1536*1024',
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
            component: 'Divider',
            label: '通义万相（阿里云 DashScope）'
        },
        {
            field: 'imageGen.Tongyi.ApiKey',
            label: 'ApiKey',
            helpMessage: '阿里云 DashScope API Key，在阿里云控制台开通百炼服务后获取',
            component: 'InputPassword',
            componentProps: {
                placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxx'
            }
        },
        {
            field: 'imageGen.Tongyi.Model',
            label: '模型',
            helpMessage: 'wanx2.1-t2i-turbo 极速版（推荐）；wanx2.1-t2i-plus 高质量版；wanx-v1 旧版通用模型',
            component: 'Select',
            componentProps: {
                options: [
                    { value: 'wanx2.1-t2i-turbo', label: 'wanx2.1-t2i-turbo（极速版，推荐）' },
                    { value: 'wanx2.1-t2i-plus', label: 'wanx2.1-t2i-plus（高质量版）' },
                    { value: 'wanx-v1', label: 'wanx-v1（旧版通用）' }
                ]
            }
        },
        {
            field: 'imageGen.Tongyi.Style',
            label: '默认风格',
            helpMessage: '仅 wanx-v1 模型有效。可选：<auto>、<photography>、<portrait>、<3d cartoon>、<anime>、<oil painting>、<watercolor>、<sketch>、<chinese painting>、<flat illustration>',
            component: 'Input',
            componentProps: {
                placeholder: '<auto>（默认）'
            }
        },
        {
            component: 'Divider',
            label: 'DALL-E（OpenAI）'
        },
        {
            field: 'imageGen.DallE.ApiKey',
            label: 'ApiKey',
            helpMessage: 'OpenAI API Key，需有 DALL-E 调用权限',
            component: 'InputPassword',
            componentProps: {
                placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxx'
            }
        },
        {
            field: 'imageGen.DallE.BaseUrl',
            label: '接口地址',
            helpMessage: 'OpenAI 接口基础地址，可替换为代理地址',
            component: 'Input',
            componentProps: {
                placeholder: 'https://api.openai.com/v1（默认）'
            }
        },
        {
            field: 'imageGen.DallE.Model',
            label: '模型',
            helpMessage: 'dall-e-3 推荐，质量更好；dall-e-2 更便宜',
            component: 'Select',
            componentProps: {
                options: [
                    { value: 'dall-e-3', label: 'dall-e-3（推荐）' },
                    { value: 'dall-e-2', label: 'dall-e-2（更便宜）' }
                ]
            }
        },
        {
            field: 'imageGen.DallE.Quality',
            label: '图片质量',
            helpMessage: '仅 dall-e-3 有效。standard 标准；hd 高清（消耗更多额度）',
            component: 'Select',
            componentProps: {
                options: [
                    { value: 'standard', label: 'standard（标准）' },
                    { value: 'hd', label: 'hd（高清）' }
                ]
            }
        },
        {
            field: 'imageGen.DallE.ResponseFormat',
            label: '返回格式',
            helpMessage: 'url 返回图片链接（1小时有效）；b64_json 返回 base64 数据',
            component: 'Select',
            componentProps: {
                options: [
                    { value: 'url', label: 'url（链接，推荐）' },
                    { value: 'b64_json', label: 'b64_json（base64）' }
                ]
            }
        },
        {
            component: 'Divider',
            label: '文心一格（百度千帆）'
        },
        {
            field: 'imageGen.Wenxin.ApiKey',
            label: 'ApiKey',
            helpMessage: '百度智能云 API Key（AK），需开通文心一言/千帆大模型平台服务',
            component: 'InputPassword',
            componentProps: {
                placeholder: '百度智能云 AK'
            }
        },
        {
            field: 'imageGen.Wenxin.SecretKey',
            label: 'SecretKey',
            helpMessage: '百度智能云 Secret Key（SK）',
            component: 'InputPassword',
            componentProps: {
                placeholder: '百度智能云 SK'
            }
        },
        {
            field: 'imageGen.Wenxin.Model',
            label: '模型',
            helpMessage: 'wenxin-yige-2.0 文心一格 2.0',
            component: 'Input',
            componentProps: {
                placeholder: 'wenxin-yige-2.0',
                disabled: true
            }
        },
        {
            component: 'Divider',
            label: '自定义服务商（OpenAI 兼容接口）'
        },
        {
            field: 'imageGen.Custom.ApiKey',
            label: 'ApiKey',
            helpMessage: '第三方平台 API Key',
            component: 'InputPassword',
            componentProps: {
                placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxx'
            }
        },
        {
            field: 'imageGen.Custom.BaseUrl',
            label: '接口基础地址',
            helpMessage: '不含 API 路径的基础地址。火山引擎 ARK：https://ark.cn-beijing.volces.com/api/v3；SiliconFlow：https://api.siliconflow.cn/v1；Together AI：https://api.together.xyz/v1',
            component: 'Input',
            componentProps: {
                placeholder: 'https://ark.cn-beijing.volces.com/api/v3'
            }
        },
        {
            field: 'imageGen.Custom.ApiPath',
            label: 'API 路径',
            helpMessage: '生图接口路径，默认 /images/generations。火山 ARK、SiliconFlow、Together AI 均使用此路径',
            component: 'Input',
            componentProps: {
                placeholder: '/images/generations（默认）'
            }
        },
        {
            field: 'imageGen.Custom.Model',
            label: '模型',
            helpMessage: '火山引擎 ARK：doubao-seedream-3-0-t2i-250415（豆包 Seedream 3.0）；SiliconFlow：Kwai-Kolors/Kolors、black-forest-labs/FLUX.1-schnell 等；Together AI：black-forest-labs/FLUX.1-schnell',
            component: 'Input',
            componentProps: {
                placeholder: 'doubao-seedream-3-0-t2i-250415'
            }
        },
        {
            field: 'imageGen.Custom.Quality',
            label: '图片质量',
            helpMessage: '部分模型支持。standard 标准；hd 高清',
            component: 'Select',
            componentProps: {
                options: [
                    { value: 'standard', label: 'standard（标准）' },
                    { value: 'hd', label: 'hd（高清）' }
                ]
            }
        },
        {
            field: 'imageGen.Custom.ResponseFormat',
            label: '返回格式',
            helpMessage: 'url 返回图片链接；b64_json 返回 base64 数据。部分平台仅支持其中一种',
            component: 'Select',
            componentProps: {
                options: [
                    { value: 'url', label: 'url（链接）' },
                    { value: 'b64_json', label: 'b64_json（base64）' }
                ]
            }
        },
        {
            field: 'imageGen.Custom.SizeSeparator',
            label: '尺寸分隔符',
            helpMessage: 'OpenAI/Together/SiliconFlow 使用 x（如 1024x1024），部分国内平台使用 *（如 1024*1024）',
            component: 'Select',
            componentProps: {
                options: [
                    { value: 'x', label: 'x（OpenAI 风格）' },
                    { value: '*', label: '*（国内平台风格）' }
                ]
            }
        },
        {
            field: 'imageGen.Custom.ExtraParams',
            label: '额外参数',
            helpMessage: 'JSON 字符串格式。部分平台需要额外参数，如 SiliconFlow 的 FLUX 模型可设置 {"guidance_scale": 7.5, "num_inference_steps": 30}。无需时留空',
            component: 'InputTextArea',
            componentProps: {
                placeholder: '{"guidance_scale": 7.5, "num_inference_steps": 30}',
                rows: 3
            }
        },
        {
            component: 'Divider',
            label: '图像编辑（OpenAI 兼容接口）'
        },
        {
            field: 'imageGen.Edit.Enable',
            label: '启用图像编辑',
            helpMessage: '开启后，AI 可在对话中调用 edit_image 工具修改/合成用户图片（换背景、转风格、多图合成）。需要配置 Edit 段的 API Key',
            component: 'Switch'
        },
        {
            field: 'imageGen.Edit.ApiKey',
            label: 'ApiKey',
            helpMessage: '图像编辑服务商 API Key。Agnes 与 SiliconFlow 均可（Key 与 chat.yaml 的 Agnes Key 相同）',
            component: 'InputPassword',
            componentProps: {
                placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxx'
            }
        },
        {
            field: 'imageGen.Edit.BaseUrl',
            label: '接口基础地址',
            helpMessage: '不含 API 路径的基础地址。Agnes 国内：https://apihub.agnes-ai.cn/v1；Agnes 国际：https://apihub.agnes-ai.com/v1；SiliconFlow：https://api.siliconflow.cn/v1',
            component: 'Input',
            componentProps: {
                placeholder: 'https://apihub.agnes-ai.cn/v1'
            }
        },
        {
            field: 'imageGen.Edit.ApiPath',
            label: 'API 路径',
            helpMessage: '编辑接口路径，默认 /images/generations（编辑与文生图共用端点，通过 image 参数传图）',
            component: 'Input',
            componentProps: {
                placeholder: '/images/generations（默认）'
            }
        },
        {
            field: 'imageGen.Edit.Model',
            label: '模型',
            helpMessage: 'Agnes：agnes-image-2.1-flash（免费）/ agnes-image-2.0-flash；SiliconFlow：Qwen/Qwen-Image-Edit（约$0.04/张）',
            component: 'Select',
            componentProps: {
                options: [
                    { value: 'agnes-image-2.1-flash', label: 'agnes-image-2.1-flash（Agnes，免费，推荐）' },
                    { value: 'agnes-image-2.0-flash', label: 'agnes-image-2.0-flash（Agnes，免费）' },
                    { value: 'Qwen/Qwen-Image-Edit', label: 'Qwen/Qwen-Image-Edit（SiliconFlow，付费）' }
                ]
            }
        },
        {
            field: 'imageGen.Edit.MaxImages',
            label: '最大输入图数',
            helpMessage: '单次编辑允许传入的最大图片数（1~4），多图合成场景使用',
            component: 'InputNumber',
            componentProps: {
                min: 1,
                max: 4,
                step: 1,
                placeholder: '4（默认）'
            }
        },
        {
            field: 'imageGen.Edit.ResponseFormat',
            label: '返回格式',
            helpMessage: 'url 返回图片链接；b64_json 返回 base64 数据。部分平台仅支持其中一种',
            component: 'Select',
            componentProps: {
                options: [
                    { value: 'url', label: 'url（链接，推荐）' },
                    { value: 'b64_json', label: 'b64_json（base64）' }
                ]
            }
        },
        {
            field: 'imageGen.Edit.SizeSeparator',
            label: '尺寸分隔符',
            helpMessage: '输出尺寸参数的分隔符。OpenAI/Agnes/SiliconFlow 使用 x（如 1024x1024），部分国内平台使用 *',
            component: 'Select',
            componentProps: {
                options: [
                    { value: 'x', label: 'x（OpenAI 风格）' },
                    { value: '*', label: '*（国内平台风格）' }
                ]
            }
        },
        {
            field: 'imageGen.Edit.ExtraParams',
            label: '额外参数',
            helpMessage: 'JSON 字符串格式。部分平台需要额外参数时填写，无需时留空',
            component: 'InputTextArea',
            componentProps: {
                placeholder: '{"guidance_scale": 7.5}',
                rows: 2
            }
        }
    ];
}
