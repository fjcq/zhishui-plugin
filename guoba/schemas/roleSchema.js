/**
 * 角色管理Schema
 */

import { getLatestRoles, getRoleOptions, getApiOptions } from '../utils/schemaUtils.js';

/**
 * 获取角色管理Schema
 * @returns {Array} Schema配置
 */
export function getRoleSchemas() {
    const currentRoles = getLatestRoles();
    
    return [
        {
            label: '角色管理',
            component: 'SOFT_GROUP_BEGIN'
        },
        {
            label: '角色应用设置',
            component: 'SOFT_GROUP_BEGIN'
        },
        {
            field: 'chat.CurrentRoleIndex',
            label: '全局预设角色',
            bottomHelpMessage: '设置全局预设角色，优先级低于群专属角色',
            component: 'Select',
            componentProps: {
                options: getRoleOptions(currentRoles)
            }
        },
        {
            field: 'chat.GroupRoleIndex',
            label: '群专属角色与API',
            bottomHelpMessage: '为不同群设置专属角色和API，优先级高于全局预设',
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
                        label: '角色',
                        component: 'Select',
                        required: true,
                        componentProps: {
                            options: getRoleOptions(currentRoles)
                        }
                    },
                    {
                        field: 'apiIndex',
                        label: 'API',
                        component: 'Select',
                        required: true,
                        componentProps: {
                            options: getApiOptions()
                        }
                    }
                ]
            }
        },
        {
            field: 'userRoleList',
            label: '用户个人角色',
            bottomHelpMessage: '显示所有设置了个人角色的用户，可删除用户个人角色配置使其使用全局默认角色',
            component: 'GSubForm',
            componentProps: {
                multiple: true,
                addButtonText: '刷新列表',
                modalTitle: '用户个人角色列表',
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
                        field: 'roleName',
                        label: '当前角色',
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

/**
 * 获取角色列表Schema
 * @returns {Object} Schema配置
 */
export function getRoleListSchema() {
    const currentRoles = getLatestRoles();
    
    return {
        field: 'roleList',
        label: '角色列表',
        bottomHelpMessage: '管理所有角色配置。预设角色只能复制，不能编辑或删除；复制后生成新角色，可编辑修改。',
        component: 'GSubForm',
        componentProps: {
            multiple: true,
            addButtonText: '添加新角色',
            modalTitle: '编辑角色配置',
            itemProps: (formData) => {
                try {
                    const parsedData = JSON.parse(formData.jsonEditor);
                    const isDefault = parsedData._isDefault === true;
                    return {
                        deletable: !isDefault
                    };
                } catch (e) {
                    return {
                        deletable: true
                    };
                }
            },
            schemas: [
                {
                    field: 'roleType',
                    label: '角色类型',
                    component: 'Input',
                    componentProps: {
                        disabled: true
                    },
                    dynamicProps: (formData) => {
                        try {
                            const parsedData = JSON.parse(formData.jsonEditor);
                            const isDefault = parsedData._isDefault === true;
                            return {
                                value: isDefault ? '预设角色' : '自定义角色'
                            };
                        } catch (e) {
                            return {
                                value: '自定义角色'
                            };
                        }
                    },
                    bottomHelpMessage: '预设角色只能复制，不能编辑；自定义角色可以自由修改'
                },
                {
                    field: 'title',
                    label: '角色标题',
                    component: 'Input',
                    required: true,
                    componentProps: {
                        disabled: (formData) => {
                            try {
                                const parsedData = JSON.parse(formData.jsonEditor);
                                return parsedData._isDefault === true;
                            } catch (e) {
                                return false;
                            }
                        }
                    }
                },
                {
                    field: 'jsonEditor',
                    label: '角色JSON配置',
                    component: 'InputTextArea',
                    required: true,
                    componentProps: {
                        autoSize: { minRows: 12, maxRows: 25 },
                        style: {
                            fontFamily: 'Consolas, "Courier New", monospace',
                            fontSize: '12px'
                        },
                        disabled: (formData) => {
                            try {
                                const parsedData = JSON.parse(formData.jsonEditor);
                                return parsedData._isDefault === true;
                            } catch (e) {
                                return false;
                            }
                        }
                    }
                }
            ]
        }
    };
}

/**
 * 获取角色复制Schema
 * @returns {Object} Schema配置
 */
export function getCopyRoleSchema() {
    const currentRoles = getLatestRoles();
    
    return {
        field: 'copyRole',
        label: '复制角色',
        bottomHelpMessage: '选择要复制的角色，点击复制按钮创建角色副本',
        component: 'GSubForm',
        componentProps: {
            multiple: false,
            modalTitle: '复制角色',
            schemas: [
                {
                    field: 'sourceRole',
                    label: '选择要复制的角色',
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
                    component: 'Input',
                    required: true,
                    componentProps: {
                        placeholder: '请输入新角色标题'
                    },
                    bottomHelpMessage: '留空则使用原角色标题加"(副本)"后缀'
                }
            ]
        }
    };
}
