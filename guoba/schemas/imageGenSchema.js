/**
 * AI 生图功能设置 Schema
 * 配置生图服务商、API Key、默认参数等
 * 合并到系统设置中显示
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
            bottomHelpMessage: '生图功能全局开关',
            component: 'Switch'
        },
        {
            field: 'imageGen.DefaultProvider',
            label: '默认服务商',
            helpMessage: 'AI 未指定服务商时使用此默认值',
            bottomHelpMessage: '默认调用的生图服务商',
            component: 'Select',
            componentProps: {
                options: [
                    { value: 'tongyi', label: '通义万相（阿里云 DashScope）' },
                    { value: 'dall_e', label: 'DALL-E（OpenAI）' },
                    { value: 'wenxin', label: '文心一格（百度千帆）' }
                ]
            }
        },
        {
            field: 'imageGen.Timeout',
            label: '请求超时(ms)',
            helpMessage: '生图接口调用超时时间，生图通常较慢，建议 60000 以上',
            bottomHelpMessage: '生图请求超时时间（毫秒）',
            component: 'InputNumber',
            componentProps: {
                min: 30000,
                max: 300000,
                step: 10000,
                placeholder: '120000'
            }
        },
        {
            field: 'imageGen.RateLimit',
            label: '频率限制(秒)',
            helpMessage: '同一用户两次生图调用的最小间隔，0 表示不限制',
            bottomHelpMessage: '单用户调用间隔（秒）',
            component: 'InputNumber',
            componentProps: {
                min: 0,
                max: 3600,
                placeholder: '10'
            }
        },
        {
            field: 'imageGen.DefaultSize',
            label: '默认尺寸',
            helpMessage: 'AI 未指定尺寸时使用此默认值。通义万相：1024*1024、720*1280、1280*720；DALL-E：1024x1024、1792x1024、1024x1792；文心一格：1024*1024、1024*1536、1536*1024',
            bottomHelpMessage: '默认图片尺寸',
            component: 'Input',
            componentProps: {
                placeholder: '1024*1024'
            }
        },
        {
            field: 'imageGen.SaveDir',
            label: '保存目录',
            helpMessage: '生成图片的本地保存目录，留空则保存到 resources/output/imagegen。可填绝对路径或相对插件根目录的路径',
            bottomHelpMessage: '生成图片保存目录（留空使用默认）',
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
            helpMessage: '阿里云 DashScope API Key，可在阿里云控制台开通百炼服务后获取',
            bottomHelpMessage: '通义万相 API Key',
            component: 'Input',
            componentProps: {
                placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxx',
                type: 'password'
            }
        },
        {
            field: 'imageGen.Tongyi.Model',
            label: '模型',
            helpMessage: 'wanx2.1-t2i-turbo 极速版（推荐）；wanx2.1-t2i-plus 高质量版；wanx-v1 旧版通用模型',
            bottomHelpMessage: '通义万相模型名称',
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
            bottomHelpMessage: '通义万相默认风格（仅 wanx-v1）',
            component: 'Input',
            componentProps: {
                placeholder: '<auto>'
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
            bottomHelpMessage: 'DALL-E API Key',
            component: 'Input',
            componentProps: {
                placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxx',
                type: 'password'
            }
        },
        {
            field: 'imageGen.DallE.BaseUrl',
            label: '接口地址',
            helpMessage: 'OpenAI 接口基础地址，可替换为代理地址',
            bottomHelpMessage: 'DALL-E 接口基础地址',
            component: 'Input',
            componentProps: {
                placeholder: 'https://api.openai.com/v1'
            }
        },
        {
            field: 'imageGen.DallE.Model',
            label: '模型',
            helpMessage: 'dall-e-3 推荐，质量更好；dall-e-2 更便宜',
            bottomHelpMessage: 'DALL-E 模型名称',
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
            helpMessage: '仅 dall-e-3 有效。standard 标准质量；hd 高清质量（消耗更多额度）',
            bottomHelpMessage: 'DALL-E 图片质量（仅 dall-e-3）',
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
            bottomHelpMessage: 'DALL-E 返回格式',
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
            bottomHelpMessage: '文心一格 API Key（AK）',
            component: 'Input',
            componentProps: {
                placeholder: '百度智能云 AK',
                type: 'password'
            }
        },
        {
            field: 'imageGen.Wenxin.SecretKey',
            label: 'SecretKey',
            helpMessage: '百度智能云 Secret Key（SK）',
            bottomHelpMessage: '文心一格 Secret Key（SK）',
            component: 'Input',
            componentProps: {
                placeholder: '百度智能云 SK',
                type: 'password'
            }
        },
        {
            field: 'imageGen.Wenxin.Model',
            label: '模型',
            helpMessage: 'wenxin-yige-2.0 文心一格 2.0',
            bottomHelpMessage: '文心一格模型名称',
            component: 'Input',
            componentProps: {
                placeholder: 'wenxin-yige-2.0',
                disabled: true
            }
        }
    ];
}

export default {
    getImageGenSchemas
};
