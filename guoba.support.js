import { Config } from './components/index.js'
import Data from './components/Data.js'
import fs from 'fs'
import path from 'path'
import { getApiTypeOptions } from './apps/chat/api-types.js'

const Path = process.cwd()
const PluginPath = `${Path}/plugins/zhishui-plugin`

// 获取角色配置
let roleContent, RoleList, VoiceList = [];

export function supportGuoba() {
    // 动态获取最新的角色配置
    const getLatestRoles = () => {
        try {
            const latestRoleContent = Config.getJsonConfig('RoleProfile');
            return latestRoleContent ? JSON.parse(latestRoleContent) : [];
        } catch (err) {
            console.error('获取最新角色配置失败:', err);
            return [];
        }
    };

    // 确保VoiceList已加载
    const ensureVoiceList = async () => {
        if (VoiceList.length === 0) {
            try {
                VoiceList = await Data.readVoiceList();
            } catch (err) {
                console.error('止水插件-语音列表加载失败:', err);
                VoiceList = [];
            }
        }
    };

    return {
        pluginInfo: {
            name: "zhishui-plugin",
            title: "止水插件",
            author: "@止水",
            authorLink: "http://zj.qxyys.com",
            link: "https://gitee.com/fjcq/zhishui-plugin",
            isV3: true,
            isV2: false,
            description: "提供了搜剧、AI对话、乐器演奏等娱乐功能。",
            icon: 'mdi:water-wave',
            iconColor: '#4fc3f7',
            iconPath: path.join(PluginPath, 'resources/img/zhishui.png'),
        },
        configInfo: {
            get schemas() {
                // 动态获取最新角色配置用于options
                const currentRoles = getLatestRoles();

                const schemas = [
                    {
                        label: '对话基础设置',
                        component: 'SOFT_GROUP_BEGIN'
                    },
                    {
                        field: 'chat.NickName',
                        label: '对话昵称',
                        bottomHelpMessage: '对话触发昵称，如"小止水"',
                        component: 'Input',
                        componentProps: {
                            placeholder: '请输入对话昵称'
                        }
                    },
                    {
                        field: 'chat.EnableAt',
                        label: '艾特触发',
                        bottomHelpMessage: '机器人被艾特时也能触发对话',
                        component: 'Switch'
                    },
                    {
                        field: 'chat.EnablePrivateChat',
                        label: '私聊AI回复',
                        bottomHelpMessage: '开启后，私聊消息将由AI自动回复',
                        component: 'Switch'
                    },
                    {
                        field: 'duihua.OnlyMaster',
                        label: '仅限主人使用',
                        bottomHelpMessage: '限制对话功能，仅限主人可用',
                        component: 'Switch'
                    },
                    {
                        field: 'chat.Master',
                        label: '主人名字',
                        bottomHelpMessage: '场景对话中机器人的主人名字',
                        component: 'Input',
                        componentProps: {
                            placeholder: '请输入主人名字'
                        }
                    },
                    {
                        field: 'chat.MasterQQ',
                        label: '主人QQ',
                        bottomHelpMessage: '场景对话中机器人的主人QQ号码',
                        component: 'Input',
                        componentProps: {
                            placeholder: '请输入主人QQ号'
                        }
                    },
                    {
                        label: '语音设置',
                        component: 'SOFT_GROUP_BEGIN'
                    },
                    {
                        field: 'chat.EnableVoice',
                        label: '启用语音回复',
                        bottomHelpMessage: '是否开启对话语音回复功能',
                        component: 'Switch'
                    },
                    {
                        field: 'chat.VoiceIndex',
                        label: '语音发音人',
                        bottomHelpMessage: '选择语音回复的发音人',
                        component: 'Select',
                        componentProps: {
                            options: VoiceList.map((element, index) => ({
                                label: element.name,
                                value: index
                            })),
                            placeholder: '请选择发音人'
                        }
                    },
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
                                        options: getApiTypeOptions().map(option => ({
                                            label: option.features && option.features.length > 0
                                                ? `${option.label} (${option.features.join('、')})`
                                                : option.label,
                                            value: option.value
                                        })),
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
                            options: (Config.Chat?.ApiList || []).map((api, idx) => ({
                                label: `${api.ApiType || '未知'} - ${api.ApiUrl || '未配置'}`,
                                value: idx
                            }))
                        }
                    },
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
                            options: currentRoles.map((role, idx) => ({
                                label: role.角色标题 || `角色${idx + 1}`,
                                value: idx
                            }))
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
                                        options: currentRoles.map((role, idx) => ({
                                            label: role.角色标题 || `角色${idx + 1}`,
                                            value: idx
                                        }))
                                    }
                                },
                                {
                                    field: 'apiIndex',
                                    label: 'API',
                                    component: 'Select',
                                    required: true,
                                    componentProps: {
                                        options: (Config.Chat?.ApiList || []).map((api, idx) => ({
                                            label: `${api.ApiType || '未知'} - ${api.ApiUrl || '未配置'}`,
                                            value: idx
                                        }))
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
                    },
                    {
                        label: '对话高级设置',
                        component: 'SOFT_GROUP_BEGIN'
                    },
                    {
                        field: 'chat.MaxHistory',
                        label: '最大历史记录',
                        bottomHelpMessage: '最多保存几条对话记录（不含system设定）',
                        component: 'InputNumber',
                        componentProps: {
                            min: 1,
                            max: 50
                        }
                    },
                    {
                        field: 'chat.ShowReasoning',
                        label: '显示推理过程',
                        bottomHelpMessage: '是否在回复中显示AI的推理过程',
                        component: 'Switch'
                    },
                    {
                        field: 'chat.LinkMode',
                        label: '链接模式',
                        bottomHelpMessage: '是否开启对话链接模式',
                        component: 'Switch'
                    },
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
                        label: '代理设置',
                        component: 'SOFT_GROUP_BEGIN'
                    },
                    {
                        field: 'proxy.switchProxy',
                        label: '启用代理',
                        bottomHelpMessage: '是否在搜剧和对话中使用代理',
                        component: 'Switch'
                    },
                    {
                        field: 'proxy.proxyAddress',
                        label: '代理地址',
                        bottomHelpMessage: '代理服务器地址，如 http://127.0.0.1:7890',
                        component: 'Input'
                    }
                ];

                // 查找角色管理分组的索引，用于后续插入角色相关配置
                const roleManageIndex = schemas.findIndex(item => item.label === '角色管理' && item.component === 'SOFT_GROUP_BEGIN');

                // 添加角色列表的GSubForm配置
                const roleListSchema = {
                    field: 'roleList',
                    label: '角色列表',
                    bottomHelpMessage: '管理所有角色配置。预设角色只能复制，不能编辑或删除；复制后生成新角色，可编辑修改。',
                    component: 'GSubForm',
                    componentProps: {
                        multiple: true,
                        addButtonText: '添加新角色',
                        modalTitle: '编辑角色配置',
                        // 禁用预设角色的删除按钮
                        itemProps: (formData) => {
                            try {
                                const parsedData = JSON.parse(formData.jsonEditor);
                                const isDefault = parsedData._isDefault === true;
                                return {
                                    deletable: !isDefault // 预设角色不可删除
                                };
                            } catch (e) {
                                return {
                                    deletable: true
                                };
                            }
                        },
                        // 简化schemas配置，添加角色类型显示
                        schemas: [
                            {
                                field: 'roleType',
                                label: '角色类型',
                                component: 'Input',
                                componentProps: {
                                    disabled: true
                                },
                                dynamicProps: (formData) => {
                                    // 根据_isDefault标记判断是否为预设角色
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
                                        // 根据_isDefault标记判断是否为预设角色
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
                                        // 根据_isDefault标记判断是否为预设角色
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

                // 添加角色复制功能配置
                const copyRoleSchema = {
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

                // 将角色列表配置插入到角色管理分组中
                if (roleManageIndex !== -1) {
                    // 查找角色应用设置索引
                    const roleAppSettingsIndex = schemas.findIndex(item =>
                        item.label === '角色应用设置' &&
                        item.component === 'SOFT_GROUP_BEGIN'
                    );

                    // 插入角色列表配置
                    schemas.splice(roleAppSettingsIndex, 0, roleListSchema);

                    // 插入角色复制配置
                    schemas.splice(roleAppSettingsIndex + 1, 0, copyRoleSchema);
                }

                return schemas;
            },

            async getConfigData() {
                try {
                    const latestRoleContent = Config.getJsonConfig('RoleProfile');
                    let roleList = [];
                    if (latestRoleContent) {
                        try {
                            const rawRoles = JSON.parse(latestRoleContent);
                            roleList = rawRoles.map(role => {
                                // 分离_isDefault标记和角色配置
                                const { _isDefault, ...roleWithoutInternalMarks } = role;
                                const isDefault = _isDefault || false;
                                return {
                                    title: role['角色标题'] || '',
                                    jsonEditor: JSON.stringify(roleWithoutInternalMarks, null, 2),
                                    _isDefault: isDefault,
                                    roleType: isDefault ? '预设角色' : '自定义角色'
                                };
                            });
                        } catch (parseErr) {
                            console.error('解析角色配置JSON失败:', parseErr);
                            roleList = [];
                        }
                    }

                    // 获取用户个人角色列表
                    let userRoleList = [];
                    try {
                        const userRoleConfigs = await Config.GetAllUserRoleConfigs();
                        userRoleList = userRoleConfigs.map(config => {
                            const role = roleList[config.roleIndex];
                            return {
                                qq: config.qq,
                                roleName: role ? role.title : `角色${config.roleIndex + 1}`
                            };
                        });
                    } catch (err) {
                        console.error('获取用户个人角色列表失败:', err);
                        userRoleList = [];
                    }

                    return {
                        videoSearch: Config.getDefOrConfig('videoSearch') || {},
                        chat: Config.getDefOrConfig('chat') || {},
                        proxy: Config.getDefOrConfig('proxy') || {},
                        roleList: roleList || [],
                        userRoleList: userRoleList || []
                    };
                } catch (err) {
                    console.error('止水插件-获取配置数据失败:', err);
                    return {
                        videoSearch: {},
                        chat: {},
                        proxy: {},
                        roleList: []
                    };
                }
            },

            async setConfigData(data, { Result, action }) {
                try {
                    const configInfo = this;
                    const getLatestConfigData = () => {
                        try {
                            const latestRoleContent = Config.getJsonConfig('RoleProfile');
                            let roleList = [];
                            if (latestRoleContent) {
                                try {
                                    const rawRoles = JSON.parse(latestRoleContent);
                                    roleList = rawRoles.map(role => {
                                        const { _isDefault, ...roleWithoutInternalMarks } = role;
                                        const isDefault = _isDefault || false;
                                        return {
                                            title: role['角色标题'] || '',
                                            jsonEditor: JSON.stringify(roleWithoutInternalMarks, null, 2),
                                            _isDefault: isDefault,
                                            roleType: isDefault ? '预设角色' : '自定义角色'
                                        };
                                    });
                                } catch (parseErr) {
                                    console.error('解析角色配置JSON失败:', parseErr);
                                    roleList = [];
                                }
                            }

                            return {
                                videoSearch: Config.getDefOrConfig('videoSearch') || {},
                                chat: Config.getDefOrConfig('chat') || {},
                                proxy: Config.getDefOrConfig('proxy') || {},
                                roleList: roleList || []
                            };
                        } catch (err) {
                            console.error('止水插件-获取配置数据失败:', err);
                            return {
                                videoSearch: {},
                                chat: {},
                                proxy: {},
                                roleList: []
                            };
                        }
                    };

                    if (action?.key === 'copy' && action?.formData) {
                        try {
                            const copyRole = action.formData;
                            const latestRoleContent = Config.getJsonConfig('RoleProfile');
                            let roles = latestRoleContent ? JSON.parse(latestRoleContent) : [];

                            const parsedRole = JSON.parse(copyRole.jsonEditor);

                            const newRole = {
                                ...parsedRole,
                                '角色标题': `${parsedRole['角色标题']} (副本)`,
                                _isDefault: false
                            };

                            roles.push(newRole);

                            const roleListJson = JSON.stringify(roles, null, 2);
                            Config.setJsonConfig('RoleProfile', roleListJson);

                            return Result.ok({
                                refreshData: { ...data, roleList: getLatestConfigData().roleList }
                            });
                        } catch (err) {
                            console.error('复制角色失败:', err);
                            return Result.error('复制角色失败: ' + err.message);
                        }
                    }

                    for (let key in data) {
                        if (key === 'roleList') {
                            try {
                                const roleData = data[key] || [];

                                // 获取原始角色列表，用于恢复被删除的预设角色
                                const latestRoleContent = Config.getJsonConfig('RoleProfile');
                                const originalRoles = latestRoleContent ? JSON.parse(latestRoleContent) : [];

                                const processedRoles = roleData.map(role => {
                                    if (role.jsonEditor && role.jsonEditor.trim()) {
                                        try {
                                            const parsedData = JSON.parse(role.jsonEditor);
                                            // 移除可能包含的_isDefault标记，避免保存到JSON配置中
                                            const { _isDefault, ...roleWithoutInternalMarks } = parsedData;
                                            roleWithoutInternalMarks['角色标题'] = role.title || roleWithoutInternalMarks['角色标题'] || '新角色';
                                            // 保留原始角色的_isDefault标记
                                            if (role._isDefault) {
                                                roleWithoutInternalMarks._isDefault = true;
                                            }
                                            return roleWithoutInternalMarks;
                                        } catch (e) {
                                            console.error('JSON编辑器数据解析失败:', e);
                                            return null;
                                        }
                                    }
                                    return null;
                                }).filter(role => role !== null);

                                // 检查并恢复被删除的预设角色
                                const processedDefaultRoles = processedRoles.filter(role => role._isDefault);
                                const originalDefaultRoles = originalRoles.filter(role => role._isDefault);

                                // 如果有预设角色被删除，恢复它们
                                if (processedDefaultRoles.length < originalDefaultRoles.length) {
                                    const deletedDefaultRoles = originalDefaultRoles.filter(originalRole => {
                                        return !processedDefaultRoles.some(processedRole =>
                                            processedRole['角色标题'] === originalRole['角色标题']
                                        );
                                    });

                                    if (deletedDefaultRoles.length > 0) {
                                        console.log(`[角色配置] 检测到 ${deletedDefaultRoles.length} 个预设角色被删除，已自动恢复`);
                                        // 将被删除的预设角色添加到处理后的列表中
                                        processedRoles.push(...deletedDefaultRoles);
                                    }
                                }

                                const roleListJson = JSON.stringify(processedRoles, null, 2);
                                Config.setJsonConfig('RoleProfile', roleListJson);
                            } catch (err) {
                                console.error('保存角色配置失败:', err);
                                return Result.error('角色配置保存失败: ' + err.message);
                            }
                        } else if (key === 'copyRole') {
                            // 处理角色复制功能
                            try {
                                const copyRoleData = data[key] || {};
                                const { sourceRole, newRoleTitle } = copyRoleData;

                                if (sourceRole !== undefined) {
                                    // 动态获取最新角色配置
                                    const latestRoleContent = Config.getJsonConfig('RoleProfile');
                                    let roles = latestRoleContent ? JSON.parse(latestRoleContent) : [];

                                    // 检查源角色是否存在
                                    if (sourceRole >= 0 && sourceRole < roles.length) {
                                        const sourceRoleData = roles[sourceRole];

                                        // 生成新角色标题
                                        const title = newRoleTitle || `${sourceRoleData['角色标题']} (副本)`;

                                        // 创建新角色，修改标题并移除预设标记
                                        const newRole = {
                                            ...sourceRoleData,
                                            '角色标题': title,
                                            _isDefault: false // 复制的角色不是预设角色
                                        };

                                        // 添加到角色列表
                                        roles.push(newRole);

                                        // 保存更新后的角色列表
                                        const roleListJson = JSON.stringify(roles, null, 2);
                                        Config.setJsonConfig('RoleProfile', roleListJson);
                                    }
                                }
                            } catch (err) {
                                console.error('复制角色失败:', err);
                                return Result.error('复制角色失败: ' + err.message);
                            }
                        } else if (key === 'userRoleList') {
                            // 处理用户个人角色列表的删除操作
                            try {
                                const userRoleData = data[key] || [];

                                // 获取当前所有用户的角色配置
                                const currentUserRoleConfigs = await Config.GetAllUserRoleConfigs();

                                // 找出被删除的用户配置（在原列表中但不在新列表中的）
                                const deletedUserConfigs = currentUserRoleConfigs.filter(config => {
                                    return !userRoleData.some(user => user.qq === config.qq);
                                });

                                // 删除这些用户的角色配置
                                for (const deletedConfig of deletedUserConfigs) {
                                    await Config.DeleteUserChatConfig(deletedConfig.qq, 'RoleIndex');
                                    console.log(`[用户角色] 已删除用户 ${deletedConfig.qq} 的个人角色配置`);
                                }
                            } catch (err) {
                                console.error('处理用户个人角色列表失败:', err);
                                return Result.error('用户个人角色列表处理失败: ' + err.message);
                            }
                        } else if (key === 'videoSearch') {
                            let videoSearch = { ...data.videoSearch };
                            if (Array.isArray(videoSearch.resources)) {
                                videoSearch.resources = videoSearch.resources.map(site => ({ site }));
                            }
                            Config.modify('videoSearch', '', videoSearch, 'config');
                        } else {
                            const pathArr = key.split('.');
                            const fileName = pathArr[0];
                            const configKey = pathArr.slice(1).join('.');

                            if (configKey) {
                                Config.modify(fileName, configKey, data[key], 'config');
                            } else {
                                Config.modify(fileName, '', data[key], 'config');
                            }
                        }
                    }
                    return Result.ok({
                        refreshData: getLatestConfigData()
                    });
                } catch (err) {
                    console.error('止水插件-保存配置失败:', err);
                    return Result.error('保存失败: ' + err.message);
                }
            }
        }
    };
}