import { Config } from './components/index.js'
import Data from './components/Data.js'
import fs from 'fs'
const Path = process.cwd()
const PluginPath = `${Path}/plugins/zhishui-plugin`
const RoleList = JSON.parse(fs.readFileSync(`${PluginPath}/config/default_config/RoleProfile.json`, 'utf8'))
const VoiceList = await Data.ReadVoiceList()

export function supportGuoba() {
    return {
        pluginInfo: {
            name: "zhishui-plugin",
            title: "止水插件",
            author: "@止水",
            authorLink: "http://zj.qxyys.com",
            link: "https://gitee.com/fjcq/zhishui-plugin",
            isV3: true,
            isV2: false,
            description: "提供了搜剧、AI对话等娱乐功能。",
            iconPath: `${PluginPath}/resources/img/zhishui.png`,
        },
        configInfo: {
            schemas: [
                // 搜剧设置分组
                { component: "SOFT_GROUP_BEGIN", label: "搜剧设置" },
                {
                    field: 'souju.analysis',
                    label: '解析接口',
                    bottomHelpMessage: '用于解析视频播放地址的接口',
                    component: 'Input'
                },
                {
                    field: 'souju.player',
                    label: '播放器链接',
                    bottomHelpMessage: '用于在线播放的播放器页面地址',
                    component: 'Input'
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
                    label: '资源站点数组',
                    bottomHelpMessage: '配置多个资源站点，每个站点包含标题、链接等信息',
                    component: 'GSubForm',
                    componentProps: {
                        multiple: true,
                        addButtonText: '添加资源站点',
                        schemas: [
                            {
                                field: 'showpic',
                                label: '显示海报',
                                component: 'Switch'
                            },
                            {
                                field: 'title',
                                label: '站点标题',
                                component: 'Input',
                                required: true,
                                placeholder: '请输入站点标题'
                            },
                            {
                                field: 'url',
                                label: '站点链接',
                                component: 'Input',
                                required: true,
                                placeholder: '请输入站点链接'
                            }
                        ]
                    }
                },

                // 基础设置分组
                { component: "SOFT_GROUP_BEGIN", label: "基础设置" },
                {
                    field: 'duihua.NickName',
                    label: '对话昵称',
                    bottomHelpMessage: '对话触发昵称',
                    component: 'Input'
                },
                {
                    field: 'duihua.Master',
                    label: '主人名字',
                    bottomHelpMessage: '场景对话中机器人的主人名字',
                    component: 'Input'
                },
                {
                    field: 'duihua.MasterQQ',
                    label: '主人QQ',
                    bottomHelpMessage: '场景对话中机器人的主人QQ',
                    component: 'Input'
                },
                {
                    field: 'duihua.OnlyMaster',
                    label: '仅限主人',
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
                    field: 'duihua.EnableVoice',
                    label: '对话语音',
                    bottomHelpMessage: '是否开启对话语音',
                    component: 'Switch'
                },
                {
                    field: 'duihua.VoiceIndex',
                    label: '语音发音人',
                    bottomHelpMessage: '输入发音人序号，对应序号可以通过 #查看发音人 获取',
                    component: 'Select',
                    componentProps: {
                        options: VoiceList.map((element, index) => ({ label: element.name, value: index })),
                        placeholder: '请选择发音人',
                    },
                },

                // 高级设置分组
                { component: "SOFT_GROUP_BEGIN", label: "高级设置" },
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

                // AI接口设置分组
                { component: "SOFT_GROUP_BEGIN", label: "AI接口设置" },
                {
                    field: 'duihua.ApiUrl',
                    label: 'API地址',
                    bottomHelpMessage: '设置对话使用的API',
                    component: 'Input'
                },
                {
                    field: 'duihua.ApiKey',
                    label: 'API密钥',
                    bottomHelpMessage: '设置对话使用的KEY',
                    component: 'Input'
                },
                {
                    field: 'duihua.ApiModel',
                    label: '模型',
                    bottomHelpMessage: '设置对话使用的模型',
                    component: 'Input'
                },

                // 角色与历史分组
                { component: "SOFT_GROUP_BEGIN", label: "角色与历史" },
                {
                    field: 'duihua.CurrentRoleIndex',
                    label: '全局默认角色',
                    bottomHelpMessage: '设置全局默认角色，优先级低于群专属角色',
                    component: 'Select',
                    componentProps: {
                        options: RoleList.map((role, idx) => ({
                            label: role.角色标题,
                            value: idx
                        })),
                        placeholder: '请选择全局默认角色',
                    },
                },
                {
                    field: 'duihua.MaxHistory',
                    label: '最大历史记录',
                    bottomHelpMessage: '最多保存几条对话记录（不含system设定）',
                    component: 'Input'
                },
                {
                    field: 'duihua.GroupRoleIndex',
                    label: '群专属角色设置',
                    bottomHelpMessage: '为不同群设置专属角色，每行一个群号和角色。',
                    component: 'GSubForm',
                    componentProps: {
                        multiple: true,
                        addButtonText: '添加群专属角色',
                        schemas: [
                            {
                                field: 'group',
                                label: '群号',
                                component: 'Input',
                                required: true,
                                placeholder: '请输入群号'
                            },
                            {
                                field: 'index',
                                label: '角色',
                                component: 'Select',
                                required: true,
                                componentProps: {
                                    options: RoleList.map((role, idx) => ({
                                        label: role.角色标题,
                                        value: idx
                                    })),
                                    placeholder: '请选择角色'
                                }
                            }
                        ]
                    }
                },

                // 角色配置文件分组
                {
                    component: "SOFT_GROUP_BEGIN",
                    label: "角色配置编辑"
                },
                {
                    field: 'selectedRoleIndex',
                    label: '选择角色',
                    component: 'Select',
                    componentProps: {
                        options: RoleList.map((role, idx) => ({
                            label: role.角色标题,
                            value: idx
                        })),
                        placeholder: '请选择要编辑的角色',
                        // 新增：下拉框变化时自动更新 selectedRoleContent
                        onChange: (value, formModel) => {
                            formModel.selectedRoleContent = JSON.stringify(RoleList[value], null, 2)
                        }
                    }
                },
                {
                    field: 'selectedRoleContent',
                    label: '角色内容',
                    bottomHelpMessage: '编辑当前角色的JSON内容，建议格式为JSON。',
                    component: 'InputTextArea',
                    componentProps: {
                        autoSize: { minRows: 10, maxRows: 30 },
                        placeholder: '请粘贴或编辑当前角色的全部内容'
                    }
                },

                // 代理设置分组
                { component: "SOFT_GROUP_BEGIN", label: "代理设置" },
                {
                    field: 'proxy.proxyAddress',
                    label: '代理地址',
                    bottomHelpMessage: '设置搜剧和对话中使用的代理地址',
                    component: 'Input'
                },
                {
                    field: 'proxy.switchProxy',
                    label: '开启代理',
                    bottomHelpMessage: '是否允许在搜剧和对话中使用代理',
                    component: 'Switch'
                }
            ],

            getConfigData() {
                const currentRoleIndex = Config.Chat.CurrentRoleIndex ?? 0
                // 处理资源站点数组结构
                let souju = { ...Config.SearchVideos }
                if (Array.isArray(souju.resources)) {
                    souju.resources = souju.resources.map(item => item.site ? item.site : item)
                }
                return {
                    souju,
                    duihua: Config.Chat,
                    proxy: Config.proxy,
                    roleProfileContent: fs.readFileSync(`${PluginPath}/config/default_config/RoleProfile.json`, 'utf8'),
                    selectedRoleIndex: currentRoleIndex,
                    selectedRoleContent: JSON.stringify(RoleList[currentRoleIndex], null, 2)
                }
            },

            setConfigData(data, { Result }) {
                for (let key in data) {
                    if (key === 'roleProfileContent') {
                        fs.writeFileSync(`${PluginPath}/config/default_config/RoleProfile.json`, data[key], 'utf8')
                    } else if (key === 'selectedRoleIndex') {
                        data.selectedRoleContent = JSON.stringify(RoleList[data.selectedRoleIndex], null, 2)
                    } else if (key === 'souju') {
                        // 还原资源站点结构
                        let souju = { ...data.souju }
                        if (Array.isArray(souju.resources)) {
                            souju.resources = souju.resources.map(site => ({ site }))
                        }
                        Config.modify('SearchVideos', souju)
                    } else {
                        Config.modify(...key.split('.'), data[key])
                    }
                }
                return Result.ok({}, '保存成功!')
            }
        }
    }
}
