/**
 * 搜剧设置Schema
 */

import { getResourceOptions } from '../utils/schemaUtils.js';

/**
 * 获取搜剧设置Schema
 * @returns {Array} Schema配置
 */
export function getVideoSearchSchemas() {
    return [
        {
            label: '搜剧设置',
            component: 'SOFT_GROUP_BEGIN'
        },
        {
            field: 'videoSearch.analysis',
            label: '解析接口',
            bottomHelpMessage: '用于解析视频播放地址的接口',
            component: 'Input'
        },
        {
            field: 'videoSearch.player',
            label: '播放器链接',
            bottomHelpMessage: '用于在线播放的播放器页面地址',
            component: 'Input'
        },
        {
            field: 'videoSearch.cfTLSVersion',
            label: 'Cloudflare TLS版本',
            bottomHelpMessage: '绕过 Cloudflare Challenge 所使用的 TLS 版本',
            component: 'Select',
            componentProps: {
                options: [
                    { label: 'TLSv1.1', value: 'TLSv1.1' },
                    { label: 'TLSv1.2', value: 'TLSv1.2' }
                ]
            }
        },
        {
            field: 'videoSearch.resources',
            label: '资源站点配置',
            bottomHelpMessage: '配置多个资源站点，每个站点包含标题、链接等信息',
            component: 'GSubForm',
            componentProps: {
                multiple: true,
                addButtonText: '添加资源站点',
                modalTitle: '编辑资源站点',
                schemas: [
                    {
                        field: 'title',
                        label: '站点标题',
                        component: 'Input',
                        required: true
                    },
                    {
                        field: 'url',
                        label: '站点链接',
                        component: 'Input',
                        required: true
                    },
                    {
                        field: 'showpic',
                        label: '显示海报',
                        component: 'Switch',
                        bottomHelpMessage: '是否在搜剧结果中显示影片海报图片'
                    }
                ]
            }
        },
        {
            field: 'videoSearch.CurrentResourceIndex',
            label: '全局默认资源站',
            bottomHelpMessage: '设置全局默认使用的资源站，优先级低于群专属设置',
            component: 'Select',
            componentProps: {
                options: getResourceOptions(),
                placeholder: '请选择全局默认资源站'
            }
        },
        {
            field: 'videoSearch.GroupResourceIndex',
            label: '群专属资源站',
            bottomHelpMessage: '为不同群设置专属资源站，优先级高于全局默认',
            component: 'GSubForm',
            componentProps: {
                multiple: true,
                addButtonText: '添加群专属配置',
                schemas: [
                    {
                        field: 'group',
                        label: '群号',
                        component: 'Input',
                        required: true
                    },
                    {
                        field: 'index',
                        label: '资源站索引',
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
            label: '个人专属资源站',
            component: 'GSubForm',
            bottomHelpMessage: '显示所有设置了个人专属资源站的用户，可删除用户个人配置使其使用群专属或全局默认设置',
            componentProps: {
                multiple: true,
                addButtonText: '刷新列表',
                modalTitle: '用户个人专属资源站列表',
                schemas: [
                    {
                        field: 'qq',
                        label: '用户QQ',
                        component: 'Input',
                        componentProps: {
                            disabled: true
                        }
                    },
                    {
                        field: 'resourceIndex',
                        label: '资源站索引',
                        component: 'Input',
                        componentProps: {
                            disabled: true
                        }
                    },
                    {
                        field: 'resourceName',
                        label: '当前资源站',
                        component: 'Input',
                        componentProps: {
                            disabled: true
                        }
                    }
                ]
            }
        }
    ];
}
