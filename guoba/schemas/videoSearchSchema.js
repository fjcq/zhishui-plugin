/**
 * 搜剧设置Schema
 * 防风控设置 + 资源站点 + 群专属配置
 */

import { getResourceOptions } from '../utils/schemaUtils.js';

/**
 * 获取完整的搜剧设置Schema
 * @returns {Array} Schema配置
 */
export function getVideoSearchSchemas() {
    return [
        {
            label: '🎬 搜剧设置',
            component: 'SOFT_GROUP_BEGIN'
        },
        {
            field: 'videoSearch.analysis',
            label: '解析接口',
            helpMessage: '视频解析接口地址，用于解析视频播放链接',
            component: 'Input',
            componentProps: {
                placeholder: '请输入解析接口地址'
            }
        },
        {
            field: 'videoSearch.player',
            label: '播放器链接',
            helpMessage: '在线播放器的页面地址，视频链接会拼接在此地址后',
            component: 'Input',
            componentProps: {
                placeholder: '请输入播放器链接'
            }
        },
        {
            field: 'videoSearch.cfTLSVersion',
            label: 'Cloudflare TLS版本',
            helpMessage: '绕过Cloudflare验证所需的TLS版本，Node.js 18+建议使用TLSv1.2',
            component: 'RadioGroup',
            componentProps: {
                options: [
                    { label: 'TLSv1.1 (Node < 18)', value: 'TLSv1.1' },
                    { label: 'TLSv1.2 (推荐)', value: 'TLSv1.2' }
                ]
            }
        },
        {
            component: 'Divider',
            label: '播放链接防风控'
        },
        {
            field: 'videoSearch.redirectWorker',
            label: '中转跳转服务（推荐）',
            helpMessage: 'Cloudflare Workers 跳转服务地址，播放链接经 Workers 302 跳转规避 QQ 风险提示，比二维码模式更可靠',
            component: 'Input',
            componentProps: {
                placeholder: 'https://your-worker.workers.dev（留空不启用）'
            }
        },
        {
            field: 'videoSearch.qrCodeLink',
            label: '二维码模式',
            helpMessage: '开启后播放链接以二维码图片形式发送，规避链接风控。依赖 qrcode 模块（未安装自动回退文本链接）',
            component: 'Switch'
        },
        {
            component: 'Divider',
            label: '资源站点'
        },
        {
            field: 'videoSearch.resources',
            label: '资源站点列表',
            helpMessage: '配置多个视频资源站点，支持不同来源的视频搜索',
            component: 'GSubForm',
            componentProps: {
                multiple: true,
                addButtonText: '添加资源站点',
                modalTitle: '编辑资源站点',
                schemas: [
                    {
                        field: 'title',
                        label: '站点标题',
                        helpMessage: '资源站点的显示名称',
                        component: 'Input',
                        required: true,
                        componentProps: {
                            placeholder: '如: 卧龙资源'
                        }
                    },
                    {
                        field: 'url',
                        label: '站点链接',
                        helpMessage: '资源站点的API地址',
                        component: 'Input',
                        required: true,
                        componentProps: {
                            placeholder: '如: https://example.com/api.php/provide/vod'
                        }
                    },
                    {
                        field: 'from',
                        label: '指定线路代码',
                        helpMessage: '通过 CMS_V10 的 from 参数过滤线路，仅返回该线路（如 lzm3u8），留空返回全部线路。可过滤掉云播/直链等非流媒体线路',
                        component: 'Input',
                        componentProps: {
                            placeholder: '如 lzm3u8，留空返回全部'
                        }
                    },
                    {
                        field: 'showpic',
                        label: '显示海报',
                        helpMessage: '在搜索结果中显示视频海报图片',
                        component: 'Switch'
                    }
                ]
            }
        },
        {
            field: 'videoSearch.CurrentResourceIndex',
            label: '默认资源站',
            helpMessage: '全局默认使用的资源站点',
            component: 'Select',
            componentProps: {
                options: getResourceOptions(),
                placeholder: '请选择资源站'
            }
        },
        {
            field: 'videoSearch.GroupResourceIndex',
            label: '群专属资源站',
            helpMessage: '为特定群设置专属资源站，优先级高于全局默认',
            component: 'GSubForm',
            componentProps: {
                multiple: true,
                addButtonText: '添加群专属配置',
                modalTitle: '编辑群专属资源站',
                schemas: [
                    {
                        field: 'group',
                        label: '选择群聊',
                        component: 'GSelectGroup',
                        required: true
                    },
                    {
                        field: 'index',
                        label: '资源站',
                        component: 'Select',
                        required: true,
                        componentProps: {
                            options: getResourceOptions(),
                            placeholder: '请选择资源站'
                        }
                    }
                ]
            }
        },
        {
            field: 'userResourceList',
            label: '用户个人资源站',
            helpMessage: '查看已设置个人专属资源站的用户，删除后用户将使用群专属或全局默认',
            bottomHelpMessage: '点列表项可删除该用户的个人设置',
            component: 'GSubForm',
            componentProps: {
                multiple: true,
                addButtonText: '刷新列表',
                modalTitle: '用户个人资源站列表',
                schemas: [
                    {
                        field: 'qq',
                        label: '用户QQ',
                        component: 'Input',
                        componentProps: {
                            disabled: true,
                            placeholder: '用户QQ号'
                        }
                    },
                    {
                        field: 'resourceName',
                        label: '当前资源站',
                        component: 'Input',
                        componentProps: {
                            disabled: true,
                            placeholder: '当前使用的资源站'
                        }
                    }
                ]
            }
        }
    ];
}
