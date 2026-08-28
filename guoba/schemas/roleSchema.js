/**
 * 角色管理Schema
 * 默认角色 + 角色列表（预设锁定）+ 复制 + 用户个人角色
 */

import { getLatestRoles, getRoleOptions } from '../utils/schemaUtils.js';

/**
 * 获取角色管理Schema
 * @returns {Array} Schema配置
 */
export function getRoleSchemas() {
    const currentRoles = getLatestRoles();

    return [
        {
            label: '🎭 角色管理',
            component: 'SOFT_GROUP_BEGIN'
        },
        {
            field: 'chat.CurrentRoleIndex',
            label: '全局默认角色',
            helpMessage: '全局默认使用的角色，群专属配置和用户个人配置优先级更高',
            component: 'Select',
            componentProps: {
                options: getRoleOptions(currentRoles),
                placeholder: '请选择角色'
            }
        },
        {
            field: 'roleList',
            label: '角色列表',
            helpMessage: '管理所有角色配置。预设角色(🔒)只能复制不能编辑，自定义角色(✏️)可以自由编辑删除',
            bottomHelpMessage: '点卡片编辑角色JSON配置',
            component: 'GSubForm',
            componentProps: {
                multiple: true,
                addButtonText: '添加新角色',
                modalTitle: '编辑角色',
                itemProps: (formData) => {
                    try {
                        const parsedData = JSON.parse(formData.jsonEditor);
                        return { deletable: !parsedData._isDefault };
                    } catch (e) {
                        return { deletable: true };
                    }
                },
                schemas: [
                    {
                        field: 'roleType',
                        label: '类型',
                        component: 'Input',
                        componentProps: { disabled: true },
                        dynamicProps: (formData) => {
                            try {
                                const parsedData = JSON.parse(formData.jsonEditor);
                                return { value: parsedData._isDefault ? '🔒 预设角色' : '✏️ 自定义角色' };
                            } catch (e) {
                                return { value: '✏️ 自定义角色' };
                            }
                        }
                    },
                    {
                        field: 'title',
                        label: '角色标题',
                        helpMessage: '角色的显示名称，用于在列表中识别',
                        component: 'Input',
                        required: true,
                        componentProps: {
                            placeholder: '请输入角色标题',
                            disabled: (formData) => {
                                try {
                                    return JSON.parse(formData.jsonEditor)._isDefault === true;
                                } catch (e) {
                                    return false;
                                }
                            }
                        }
                    },
                    {
                        field: 'jsonEditor',
                        label: '角色配置(JSON)',
                        helpMessage: 'JSON格式的角色配置，包含角色设定、对话风格、开场白等信息',
                        component: 'InputTextArea',
                        required: true,
                        componentProps: {
                            autoSize: { minRows: 10, maxRows: 20 },
                            style: { fontFamily: 'Consolas, monospace', fontSize: '12px' },
                            placeholder: 'JSON格式角色配置',
                            disabled: (formData) => {
                                try {
                                    return JSON.parse(formData.jsonEditor)._isDefault === true;
                                } catch (e) {
                                    return false;
                                }
                            }
                        }
                    }
                ]
            }
        },
        {
            field: 'copyRole',
            label: '复制角色',
            helpMessage: '从现有角色创建副本，预设角色复制后可自由编辑',
            component: 'GSubForm',
            componentProps: {
                multiple: false,
                modalTitle: '复制角色',
                schemas: [
                    {
                        field: 'sourceRole',
                        label: '选择角色',
                        component: 'Select',
                        required: true,
                        componentProps: {
                            options: currentRoles.map((role, idx) => ({
                                label: role['角色标题'] || `角色${idx + 1}`,
                                value: idx
                            })),
                            placeholder: '请选择要复制的角色'
                        }
                    },
                    {
                        field: 'newRoleTitle',
                        label: '新角色标题',
                        helpMessage: '留空则自动使用原标题加"(副本)"后缀',
                        component: 'Input',
                        componentProps: { placeholder: '留空自动加(副本)后缀' }
                    }
                ]
            }
        },
        {
            field: 'userRoleList',
            label: '用户个人角色',
            helpMessage: '查看已设置个人角色的用户列表，可删除用户配置使其恢复使用全局默认角色',
            bottomHelpMessage: '点列表项可删除该用户的个人角色',
            component: 'GSubForm',
            componentProps: {
                multiple: true,
                addButtonText: '刷新列表',
                modalTitle: '用户个人角色',
                schemas: [
                    {
                        field: 'qq',
                        label: '用户QQ',
                        component: 'Input',
                        componentProps: { disabled: true, placeholder: 'QQ号' }
                    },
                    {
                        field: 'roleName',
                        label: '当前角色',
                        component: 'Input',
                        componentProps: { disabled: true, placeholder: '角色名' }
                    }
                ]
            }
        }
    ];
}
