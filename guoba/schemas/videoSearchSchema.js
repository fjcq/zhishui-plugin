/**
 * 搜剧设置Schema
 * 合并所有搜剧相关设置到一个分组
 */

import { getResourceOptions } from '../utils/schemaUtils.js';

/**
 * 获取完整的搜剧设置Schema（合并所有设置）
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
            bottomHelpMessage: '用于解析视频播放地址的接口',
            component: 'Input',
            componentProps: {
                placeholder: '请输入解析接口地址'
            }
        },
        {
            field: 'videoSearch.player',
            label: '播放器链接',
            helpMessage: '在线播放器的页面地址，视频链接会拼接在此地址后',
            bottomHelpMessage: '用于在线播放的播放器页面地址',
            component: 'Input',
            componentProps: {
                placeholder: '请输入播放器链接'
            }
        },
        {
            field: 'videoSearch.cfTLSVersion',
            label: 'Cloudflare TLS版本',
            helpMessage: '绕过Cloudflare验证所需的TLS版本，Node.js 18+建议使用TLSv1.2',
            bottomHelpMessage: '绕过 Cloudflare Challenge 所使用的 TLS 版本',
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
            label: '资源站点'
        },
        {
            field: 'videoSearch.resources',
            label: '资源站点列表',
            helpMessage: '配置多个视频资源站点，支持不同来源的视频搜索',
            bottomHelpMessage: '配置视频资源站点列表',
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
                            placeholder: '请输入站点标题'
                        }
                    },
                    {
                        field: 'url',
                        label: '站点链接',
                        helpMessage: '资源站点的API地址',
                        component: 'Input',
                        required: true,
                        componentProps: {
                            placeholder: '请输入站点链接'
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
            helpMessage: '设置全局默认使用的资源站点',
            bottomHelpMessage: '设置全局默认使用的资源站',
            component: 'Select',
            componentProps: {
                options: getResourceOptions(),
                placeholder: '请选择资源站'
            }
        },
        {
            component: 'Divider',
            label: '群专属配置'
        },
        {
            field: 'videoSearch.GroupResourceIndex',
            label: '群专属资源站',
            helpMessage: '为特定群设置专属资源站，优先级高于全局默认',
            bottomHelpMessage: '为不同群设置专属资源站',
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
            bottomHelpMessage: '查看/删除用户的个人资源站设置',
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

export default {
    getVideoSearchSchemas
};
