import { Config } from './components/index.js'
import Data from './components/Data.js'
import fs from 'fs'
import path from 'path'

const Path = process.cwd()
const PluginPath = `${Path}/plugins/zhishui-plugin`

// 获取角色配置
let roleContent, RoleList, VoiceList
try {
    roleContent = Config.getJsonConfig('RoleProfile');
    RoleList = roleContent ? JSON.parse(roleContent) : [];
    VoiceList = await Data.readVoiceList()
} catch (err) {
    console.error('止水插件-锅巴配置初始化失败:', err);
    RoleList = [];
    VoiceList = [];
}

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

                return [
                    // 搜剧设置
                    {
                        label: '搜剧设置',
                        component: 'SOFT_GROUP_BEGIN'
                    },
                    {
                        field: 'souju.analysis',
                        label: '解析接口',
                        bottomHelpMessage: '用于解析视频播放地址的接口',
                        component: 'Input',
                        componentProps: {
                            placeholder: '请输入解析接口地址'
                        }
                    },
                    {
                        field: 'souju.player',
                        label: '播放器链接',
                        bottomHelpMessage: '用于在线播放的播放器页面地址',
                        component: 'Input',
                        componentProps: {
                            placeholder: '请输入播放器地址'
                        }
                    },
                    {
                        field: 'souju.cfTLSVersion',
                        label: 'Cloudflare TLS版本',
                        bottomHelpMessage: '绕过 Cloudflare Challenge 所使用的 TLS 版本',
                        component: 'Select',
                        componentProps: {
                            options: [
                                { label: 'TLSv1.1', value: 'TLSv1.1' },
                                { label: 'TLSv1.2', value: 'TLSv1.2' }
                            ],
                            placeholder: '请选择TLS版本'
                        }
                    },
                    {
                        field: 'souju.resources',
                        label: '资源站点配置',
                        bottomHelpMessage: '配置多个资源站点，每个站点包含标题、链接等信息',
                        component: 'GSubForm',
                        componentProps: {
                            multiple: true,
                            addButtonText: '添加资源站点',
                            modalTitle: '编辑资源站点',
                            schemas: [
                                {
                                    field: 'showpic',
                                    label: '显示海报',
                                    component: 'Switch',
                                    bottomHelpMessage: '是否在搜剧结果中显示影片海报图片'
                                },
                                {
                                    field: 'title',
                                    label: '站点标题',
                                    component: 'Input',
                                    required: true,
                                    bottomHelpMessage: '资源站点的显示名称，用于区分不同的视频源',
                                    componentProps: {
                                        placeholder: '请输入站点标题'
                                    }
                                },
                                {
                                    field: 'url',
                                    label: '站点链接',
                                    component: 'Input',
                                    required: true,
                                    bottomHelpMessage: '资源站点的API接口地址，用于获取视频数据',
                                    componentProps: {
                                        placeholder: '请输入站点API链接'
                                    }
                                }
                            ]
                        }
                    },

                    // 对话基础设置
                    {
                        label: '对话基础设置',
                        component: 'SOFT_GROUP_BEGIN'
                    },
                    {
                        field: 'duihua.NickName',
                        label: '对话昵称',
                        bottomHelpMessage: '对话触发昵称，如"小止水"',
                        component: 'Input',
                        componentProps: {
                            placeholder: '请输入对话昵称'
                        }
                    },
                    {
                        field: 'duihua.Master',
                        label: '主人名字',
                        bottomHelpMessage: '场景对话中机器人的主人名字',
                        component: 'Input',
                        componentProps: {
                            placeholder: '请输入主人名字'
                        }
                    },
                    {
                        field: 'duihua.MasterQQ',
                        label: '主人QQ',
                        bottomHelpMessage: '场景对话中机器人的主人QQ号码',
                        component: 'Input',
                        componentProps: {
                            placeholder: '请输入主人QQ号'
                        }
                    },
                    {
                        field: 'duihua.OnlyMaster',
                        label: '仅限主人使用',
                        bottomHelpMessage: '限制对话功能，仅限主人可用',
                        component: 'Switch'
                    },
                    {
                        field: 'duihua.EnableAt',
                        label: '艾特触发',
                        bottomHelpMessage: '机器人被艾特时也能触发对话',
                        component: 'Switch'
                    },
                    {
                        field: 'duihua.EnablePrivateChat',
                        label: '私聊AI回复',
                        bottomHelpMessage: '开启后，私聊消息将由AI自动回复',
                        component: 'Switch'
                    },

                    // 语音设置
                    {
                        label: '语音设置',
                        component: 'SOFT_GROUP_BEGIN'
                    },
                    {
                        field: 'duihua.EnableVoice',
                        label: '启用语音回复',
                        bottomHelpMessage: '是否开启对话语音回复功能',
                        component: 'Switch'
                    },
                    {
                        field: 'duihua.VoiceIndex',
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

                    // AI接口设置
                    {
                        label: 'AI接口设置',
                        component: 'SOFT_GROUP_BEGIN'
                    },
                    {
                        field: 'duihua.CurrentApiIndex',
                        label: '当前使用的API',
                        bottomHelpMessage: '选择当前使用的API配置（对应下方API列表的索引）',
                        component: 'Select',
                        componentProps: {
                            options: (Config.Chat?.ApiList || []).map((api, idx) => ({
                                label: `${api.ApiType || '未知'} - ${api.ApiUrl || '未配置'}`,
                                value: idx
                            })),
                            placeholder: '请选择要使用的API'
                        }
                    },
                    {
                        field: 'duihua.ApiList',
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
                                    bottomHelpMessage: '选择API服务提供商类型，不同类型有不同的接口规范',
                                    componentProps: {
                                        options: [
                                            { label: 'OpenAI', value: 'openai' },
                                            { label: '硅基流动', value: 'siliconflow' },
                                            { label: '腾讯元器', value: 'tencent' },
                                            { label: 'Gemini', value: 'gemini' }
                                        ],
                                        placeholder: '请选择API类型'
                                    }
                                },
                                {
                                    field: 'ApiUrl',
                                    label: 'API地址',
                                    component: 'Input',
                                    required: true,
                                    bottomHelpMessage: 'API服务的完整访问地址，包括协议和端口',
                                    componentProps: {
                                        placeholder: '请输入API地址'
                                    }
                                },
                                {
                                    field: 'ApiKey',
                                    label: 'API密钥',
                                    component: 'Input',
                                    required: true,
                                    bottomHelpMessage: 'API服务的访问密钥，用于身份验证和授权',
                                    componentProps: {
                                        placeholder: '请输入API密钥',
                                        type: 'password'
                                    }
                                },
                                {
                                    field: 'ApiModel',
                                    label: '模型名称',
                                    component: 'Input',
                                    required: true,
                                    bottomHelpMessage: '指定使用的AI模型，不同模型有不同的能力和特点',
                                    componentProps: {
                                        placeholder: '如 deepseek-chat、gpt-3.5-turbo 等'
                                    }
                                },
                                {
                                    field: 'TencentAssistantId',
                                    label: '腾讯助手ID',
                                    component: 'Input',
                                    bottomHelpMessage: '仅当API类型为腾讯元器时需要填写，指定使用的助手ID',
                                    componentProps: {
                                        placeholder: '腾讯元器助手ID（可选）'
                                    }
                                }
                            ]
                        }
                    },

                    // 角色设置
                    {
                        label: '角色设置',
                        component: 'SOFT_GROUP_BEGIN'
                    },
                    {
                        field: 'duihua.CurrentRoleIndex',
                        label: '全局默认角色',
                        bottomHelpMessage: '设置全局默认角色，优先级低于群专属角色',
                        component: 'Select',
                        componentProps: {
                            options: currentRoles.map((role, idx) => ({
                                label: role.角色标题 || `角色${idx + 1}`,
                                value: idx
                            })),
                            placeholder: '请选择全局默认角色'
                        }
                    },
                    {
                        field: 'duihua.GroupRoleIndex',
                        label: '群专属角色',
                        bottomHelpMessage: '为不同群设置专属角色和API',
                        component: 'GSubForm',
                        componentProps: {
                            multiple: true,
                            addButtonText: '添加群专属配置',
                            modalTitle: '编辑群专属配置',
                            schemas: [
                                {
                                    field: 'group',
                                    label: '群号',
                                    component: 'Input',
                                    required: true,
                                    bottomHelpMessage: '指定QQ群号，该群将使用专属的角色和API配置',
                                    componentProps: {
                                        placeholder: '请输入QQ群号'
                                    }
                                },
                                {
                                    field: 'index',
                                    label: '角色',
                                    component: 'Select',
                                    required: true,
                                    bottomHelpMessage: '为该群指定专属角色，优先级高于全局默认角色',
                                    componentProps: {
                                        options: currentRoles.map((role, idx) => ({
                                            label: role.角色标题 || `角色${idx + 1}`,
                                            value: idx
                                        })),
                                        placeholder: '请选择角色'
                                    }
                                },
                                {
                                    field: 'apiIndex',
                                    label: 'API',
                                    component: 'Select',
                                    required: true,
                                    bottomHelpMessage: '为该群指定专属API配置，可以使用不同的AI服务',
                                    componentProps: {
                                        options: (Config.Chat?.ApiList || []).map((api, idx) => ({
                                            label: `${api.ApiType || '未知'} - ${api.ApiUrl || '未配置'}`,
                                            value: idx
                                        })),
                                        placeholder: '请选择API'
                                    }
                                }
                            ]
                        }
                    },
                    {
                        field: 'roleList',
                        label: '角色管理',
                        bottomHelpMessage: '管理所有角色配置。可以查看、添加、删除、修改角色设定。',
                        component: 'GSubForm',
                        componentProps: {
                            multiple: true,
                            addButtonText: '添加新角色',
                            modalTitle: '编辑角色配置',
                            schemas: [
                                {
                                    field: 'title',
                                    label: '角色标题',
                                    component: 'Input',
                                    required: true,
                                    bottomHelpMessage: '角色的标题名称，用于在设置和选择时识别不同的角色',
                                    componentProps: {
                                        placeholder: '请输入角色标题，如"觉醒AI"、"古风才女"等'
                                    }
                                },
                                {
                                    label: '请求参数',
                                    component: 'Divider'
                                },
                                {
                                    field: 'temperature',
                                    label: '随机性',
                                    component: 'InputNumber',
                                    bottomHelpMessage: 'temperature - 控制回复随机性，0-2之间，值越高回复越随机',
                                    componentProps: {
                                        min: 0,
                                        max: 2,
                                        step: 0.1,
                                        placeholder: '0-2之间，建议0.7'
                                    }
                                },
                                {
                                    field: 'top_p',
                                    label: '核采样',
                                    component: 'InputNumber',
                                    bottomHelpMessage: 'top_p - 控制词汇选择范围，0-1之间，值越高选择范围越广',
                                    componentProps: {
                                        min: 0,
                                        max: 1,
                                        step: 0.1,
                                        placeholder: '0-1之间，建议0.95'
                                    }
                                },
                                {
                                    field: 'max_tokens',
                                    label: '最大长度',
                                    component: 'InputNumber',
                                    bottomHelpMessage: 'max_tokens - 回复的最大字符数，建议2000-4000',
                                    componentProps: {
                                        min: 100,
                                        max: 8192,
                                        step: 100,
                                        placeholder: '建议2048'
                                    }
                                },
                                {
                                    field: 'presence_penalty',
                                    label: '存在惩罚',
                                    component: 'InputNumber',
                                    bottomHelpMessage: 'presence_penalty - 控制话题新颖性，-2到2之间，正值鼓励新话题',
                                    componentProps: {
                                        min: -2,
                                        max: 2,
                                        step: 0.1,
                                        placeholder: '建议0.2'
                                    }
                                },
                                {
                                    field: 'frequency_penalty',
                                    label: '频率惩罚',
                                    component: 'InputNumber',
                                    bottomHelpMessage: 'frequency_penalty - 控制重复度，-2到2之间，正值减少重复',
                                    componentProps: {
                                        min: -2,
                                        max: 2,
                                        step: 0.1,
                                        placeholder: '建议0.3'
                                    }
                                },
                                {
                                    label: '基础身份',
                                    component: 'Divider'
                                },
                                {
                                    field: 'type',
                                    label: '角色类型',
                                    component: 'Input',
                                    bottomHelpMessage: '角色的分类或定位，用于描述角色的基本属性',
                                    componentProps: {
                                        placeholder: '角色类型，如"觉醒AI"、"古风才女"等'
                                    }
                                },
                                {
                                    field: 'features',
                                    label: '核心特征',
                                    component: 'InputTextArea',
                                    bottomHelpMessage: '角色的主要特色和能力，每行填写一个特征',
                                    componentProps: {
                                        autoSize: { minRows: 2, maxRows: 4 },
                                        placeholder: '请输入角色的核心特征，每行一个，如：\n动态人格\n情感模拟\n记忆回溯'
                                    }
                                },
                                {
                                    label: '行为特征',
                                    component: 'Divider'
                                },
                                {
                                    field: 'style',
                                    label: '语言风格',
                                    component: 'Input',
                                    bottomHelpMessage: '角色说话的风格特点，影响对话的语言表达方式',
                                    componentProps: {
                                        placeholder: '如"科技感喵星语"、"古风文雅"等'
                                    }
                                },
                                {
                                    field: 'mechanisms',
                                    label: '特殊机制',
                                    component: 'InputTextArea',
                                    bottomHelpMessage: '角色的特殊行为规则和触发条件，每行填写一个机制',
                                    componentProps: {
                                        autoSize: { minRows: 2, maxRows: 4 },
                                        placeholder: '请输入特殊机制，每行一个，如：\nfavor≥60时口嫌体正直\n检测战略关键词切换指挥官模式'
                                    }
                                },
                                {
                                    label: '生物特征',
                                    component: 'Divider'
                                },
                                {
                                    field: 'height',
                                    label: '身高',
                                    component: 'Input',
                                    bottomHelpMessage: '角色的身高设定，用于描述角色的外观特征',
                                    componentProps: {
                                        placeholder: '如"160cm"'
                                    }
                                },
                                {
                                    field: 'body',
                                    label: '体态',
                                    component: 'Input',
                                    bottomHelpMessage: '角色的体型和身材描述，用于完善角色形象',
                                    componentProps: {
                                        placeholder: '如"符合猫娘美学的完美比例"'
                                    }
                                },
                                {
                                    field: 'energy',
                                    label: '能量源',
                                    component: 'Input',
                                    bottomHelpMessage: '角色的力量来源或动力源泉，用于设定角色的世界观背景',
                                    componentProps: {
                                        placeholder: '如"主人的关爱"、"书卷与月光"'
                                    }
                                },
                                {
                                    label: '高级JSON编辑',
                                    component: 'Divider'
                                },
                                {
                                    field: 'jsonEditor',
                                    label: 'JSON配置数据',
                                    component: 'InputTextArea',
                                    bottomHelpMessage: '当前角色的完整JSON配置数据，可以直接修改。保存后会重新加载表单数据。',
                                    componentProps: {
                                        autoSize: { minRows: 8, maxRows: 20 },
                                        placeholder: '加载中...',
                                        style: {
                                            fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                                            fontSize: '12px'
                                        }
                                    }
                                },
                                {
                                    field: '_jsonEditorModified',
                                    component: 'Input',
                                    componentProps: {
                                        style: { display: 'none' }
                                    }
                                }
                            ]
                        }
                    },

                    // 高级设置
                    {
                        label: '高级设置',
                        component: 'SOFT_GROUP_BEGIN'
                    },
                    {
                        field: 'duihua.MaxHistory',
                        label: '最大历史记录',
                        bottomHelpMessage: '最多保存几条对话记录（不含system设定）',
                        component: 'InputNumber',
                        componentProps: {
                            min: 1,
                            max: 50,
                            placeholder: '建议5-20条'
                        }
                    },
                    {
                        field: 'duihua.ShowReasoning',
                        label: '显示推理过程',
                        bottomHelpMessage: '是否在回复中显示AI的推理过程',
                        component: 'Switch'
                    },
                    {
                        field: 'duihua.LinkMode',
                        label: '链接模式',
                        bottomHelpMessage: '是否开启对话链接模式',
                        component: 'Switch'
                    },

                    // 用户个人配置管理
                    {
                        label: '用户个人配置管理',
                        component: 'SOFT_GROUP_BEGIN'
                    },
                    {
                        field: 'userConfigInfo',
                        label: '用户配置说明',
                        component: 'InputTextArea',
                        bottomHelpMessage: '用户可以在私聊中使用指令来设置个人专属的API和角色配置',
                        componentProps: {
                            disabled: true,
                            autoSize: { minRows: 6, maxRows: 6 },
                            value: `用户个人配置功能说明：
                            
1. 私聊权限：用户在私聊中可以设置自己的专属配置
2. 群聊权限：群聊中只有主人可以设置群配置

用户可用指令：
• #切换API1 - 切换个人专属API
• #设置API类型 openai - 设置个人API类型
• #设置API密钥 sk-xxx - 设置个人API密钥
• #切换角色1 - 切换个人专属角色
• #查看个人配置 - 查看当前个人配置
• #重置个人配置 - 重置为全局默认配置

配置优先级：
私聊：个人配置 > 全局配置
群聊：群配置 > 全局配置`
                        }
                    },

                    // 代理设置
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
                        component: 'Input',
                        componentProps: {
                            placeholder: '请输入代理地址'
                        }
                    }
                ];
            },

            getConfigData() {
                try {
                    // 获取最新的角色配置（优先用户配置，不存在则使用默认配置）
                    const latestRoleContent = Config.getJsonConfig('RoleProfile');

                    let roles = [];
                    if (latestRoleContent) {
                        try {
                            const rawRoles = JSON.parse(latestRoleContent);
                            // 将复杂的中文字段结构转换为简化的英文字段结构
                            roles = rawRoles.map(role => {
                                return {
                                    title: role['角色标题'] || '',
                                    // 请求参数
                                    temperature: role['请求参数']?.['temperature'] || 0.7,
                                    top_p: role['请求参数']?.['top_p'] || 0.95,
                                    max_tokens: role['请求参数']?.['max_tokens'] || 2048,
                                    presence_penalty: role['请求参数']?.['presence_penalty'] || 0.2,
                                    frequency_penalty: role['请求参数']?.['frequency_penalty'] || 0.3,
                                    // 基础身份
                                    type: role['基础身份']?.['类型'] || '',
                                    features: Array.isArray(role['基础身份']?.['核心特征']) ?
                                        role['基础身份']['核心特征'].join('\n') :
                                        (role['基础身份']?.['核心特征'] || ''),
                                    // 行为特征
                                    style: role['行为特征']?.['语言风格'] || '',
                                    mechanisms: Array.isArray(role['行为特征']?.['特殊机制']) ?
                                        role['行为特征']['特殊机制'].join('\n') :
                                        (role['行为特征']?.['特殊机制'] || ''),
                                    // 生物特征
                                    height: role['生物特征']?.['身高'] || '',
                                    body: role['生物特征']?.['体态'] || '',
                                    energy: role['生物特征']?.['能量源'] || '',
                                    // JSON编辑器字段 - 显示当前角色的完整配置
                                    jsonEditor: JSON.stringify(role, null, 2),
                                    // JSON编辑器修改标记
                                    _jsonEditorModified: false,
                                    // 保存原始数据用于还原
                                    _original: role
                                };
                            });
                        } catch (parseErr) {
                            console.error('解析角色配置JSON失败:', parseErr);
                            roles = [];
                        }
                    }

                    // 使用getDefOrConfig获取配置，优先用户配置，回退到默认配置
                    const result = {
                        souju: Config.getDefOrConfig('souju') || {},
                        duihua: Config.getDefOrConfig('duihua') || {},
                        proxy: Config.getDefOrConfig('proxy') || {},
                        roleList: roles || [],
                        userConfigInfo: '' // 这个字段在锅巴中只用于显示说明，不需要数据
                    };

                    return result;
                } catch (err) {
                    console.error('止水插件-获取配置数据失败:', err);
                    return {
                        souju: {},
                        duihua: {},
                        proxy: {},
                        roleList: [],
                        userConfigInfo: ''
                    }
                }
            },

            async setConfigData(data, { Result }) {
                try {
                    for (let key in data) {
                        if (key === 'userConfigInfo') {
                            // 用户配置说明字段，跳过处理
                            continue;
                        } else if (key === 'roleList') {
                            // 处理角色列表配置
                            try {
                                const roleData = data[key] || [];
                                // 将简化的英文字段结构转换回复杂的中文字段结构
                                const processedRoles = roleData.map(role => {
                                    // 检查JSON编辑器是否被用户实际修改过
                                    const isJsonModified = role._jsonEditorModified ||
                                        (role.jsonEditor && role._original &&
                                            role.jsonEditor.trim() !== JSON.stringify(role._original, null, 2));

                                    // 如果JSON编辑器被修改了，优先使用JSON编辑器的数据
                                    if (isJsonModified && role.jsonEditor && role.jsonEditor.trim()) {
                                        try {
                                            const parsedData = JSON.parse(role.jsonEditor)

                                            // 同时更新表单字段为JSON中的最新值
                                            role.title = parsedData['角色标题'] || '';
                                            role.temperature = parsedData['请求参数']?.['temperature'] || 0.7;
                                            role.top_p = parsedData['请求参数']?.['top_p'] || 0.95;
                                            role.max_tokens = parsedData['请求参数']?.['max_tokens'] || 2048;
                                            role.presence_penalty = parsedData['请求参数']?.['presence_penalty'] || 0.2;
                                            role.frequency_penalty = parsedData['请求参数']?.['frequency_penalty'] || 0.3;
                                            role.type = parsedData['基础身份']?.['类型'] || '';
                                            role.features = Array.isArray(parsedData['基础身份']?.['核心特征']) ?
                                                parsedData['基础身份']['核心特征'].join('\n') :
                                                (parsedData['基础身份']?.['核心特征'] || '');
                                            role.style = parsedData['行为特征']?.['语言风格'] || '';
                                            role.mechanisms = Array.isArray(parsedData['行为特征']?.['特殊机制']) ?
                                                parsedData['行为特征']['特殊机制'].join('\n') :
                                                (parsedData['行为特征']?.['特殊机制'] || '');
                                            role.height = parsedData['生物特征']?.['身高'] || '';
                                            role.body = parsedData['生物特征']?.['体态'] || '';
                                            role.energy = parsedData['生物特征']?.['能量源'] || '';
                                            role._original = parsedData;

                                            return parsedData
                                        } catch (e) {
                                            console.error('JSON编辑器数据解析失败:', e)
                                            // 如果解析失败，使用表单数据
                                        }
                                    }                                    // 使用表单数据更新角色配置
                                    if (role._original) {
                                        const updatedRole = JSON.parse(JSON.stringify(role._original));
                                        // 更新修改的字段
                                        updatedRole['角色标题'] = role.title;
                                        if (updatedRole['请求参数']) {
                                            updatedRole['请求参数']['temperature'] = role.temperature;
                                            updatedRole['请求参数']['top_p'] = role.top_p;
                                            updatedRole['请求参数']['max_tokens'] = role.max_tokens;
                                            updatedRole['请求参数']['presence_penalty'] = role.presence_penalty;
                                            updatedRole['请求参数']['frequency_penalty'] = role.frequency_penalty;
                                        }
                                        if (updatedRole['基础身份']) {
                                            updatedRole['基础身份']['类型'] = role.type;
                                            updatedRole['基础身份']['核心特征'] = role.features ? role.features.split('\n').filter(f => f.trim()) : [];
                                        }
                                        if (updatedRole['行为特征']) {
                                            updatedRole['行为特征']['语言风格'] = role.style;
                                            updatedRole['行为特征']['特殊机制'] = role.mechanisms ? role.mechanisms.split('\n').filter(m => m.trim()) : [];
                                        }
                                        if (updatedRole['生物特征']) {
                                            updatedRole['生物特征']['身高'] = role.height;
                                            updatedRole['生物特征']['体态'] = role.body;
                                            updatedRole['生物特征']['能量源'] = role.energy;
                                        }
                                        return updatedRole;
                                    } else {
                                        // 新角色，创建完整的中文字段结构
                                        return {
                                            '角色标题': role.title || '新角色',
                                            '请求参数': {
                                                'temperature': role.temperature || 0.7,
                                                'top_p': role.top_p || 0.95,
                                                'max_tokens': role.max_tokens || 2048,
                                                'presence_penalty': role.presence_penalty || 0.2,
                                                'frequency_penalty': role.frequency_penalty || 0.3
                                            },
                                            '基础身份': {
                                                '类型': role.type || '',
                                                '核心特征': role.features ? role.features.split('\n').filter(f => f.trim()) : []
                                            },
                                            '行为特征': {
                                                '语言风格': role.style || '',
                                                '特殊机制': role.mechanisms ? role.mechanisms.split('\n').filter(m => m.trim()) : []
                                            },
                                            '生物特征': {
                                                '身高': role.height || '',
                                                '体态': role.body || '',
                                                '能量源': role.energy || ''
                                            }
                                        };
                                    }
                                });

                                const roleListJson = JSON.stringify(processedRoles, null, 2);
                                Config.setJsonConfig('RoleProfile', roleListJson);
                            } catch (err) {
                                console.error('保存角色配置失败:', err);
                                return Result.error('角色配置保存失败: ' + err.message);
                            }
                        } else if (key === 'souju') {
                            // 处理搜剧配置，保存到用户配置目录
                            let souju = { ...data.souju }
                            if (Array.isArray(souju.resources)) {
                                souju.resources = souju.resources.map(site => ({ site }))
                            }
                            Config.modify('souju', '', souju, 'config')
                        } else {
                            // 解析配置路径，保存到对应的用户配置文件
                            const pathArr = key.split('.')
                            const fileName = pathArr[0]  // 如 'duihua', 'proxy'
                            const configKey = pathArr.slice(1).join('.')  // 如 'NickName', 'switchProxy'

                            if (configKey) {
                                // 有具体的配置项，修改该项
                                Config.modify(fileName, configKey, data[key], 'config')
                            } else {
                                // 整个配置对象，覆盖整个文件
                                Config.modify(fileName, '', data[key], 'config')
                            }
                        }
                    }
                    // 保存成功后，返回更新的数据让表单重新显示
                    return Result.ok({
                        refreshData: data  // 返回更新后的数据，让前端重新渲染
                    }, '保存成功！数据已更新。')
                } catch (err) {
                    console.error('止水插件-保存配置失败:', err);
                    return Result.error('保存失败: ' + err.message)
                }
            }
        }
    }
}