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
            label: 'AI接口设置',
            component: 'SOFT_GROUP_BEGIN'
        },
        {
            field: 'chat.ApiList',
            label: 'API配置列表',
            bottomHelpMessage: '可配置多个API，每个API包含类型、地址、密钥、模型等信息',
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
                        required: true
                    },
                    {
                        field: 'ApiKey',
                        label: 'API密钥',
                        component: 'Input',
                        required: true,
                        componentProps: {
                            type: 'password'
                        }
                    },
                    {
                        field: 'ApiModel',
                        label: '模型名称',
                        component: 'Input',
                        required: true
                    },
                    {
                        field: 'TencentAssistantId',
                        label: '腾讯助手ID',
                        component: 'Input'
                    }
                ]
            }
        },
        {
            field: 'chat.CurrentApiIndex',
            label: '当前使用的API',
            bottomHelpMessage: '选择当前使用的API配置（对应上方API列表的索引）',
            component: 'Select',
            componentProps: {
                options: getApiOptions()
            }
        }
    ];
}
