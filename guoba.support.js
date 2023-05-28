import { Config } from './components/index.js'
import Data from './components/Data.js'
const Path = process.cwd()
const PluginPath = `${Path}/plugins/zhishui-plugin`
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
                {
                    component: 'Divider',
                    label: '搜剧设置'
                },
                {
                    field: 'souju.analysis',
                    label: '解析接口',
                    bottomHelpMessage: '部分需要额外解析的视频接口',
                    component: 'Input'
                },
                {
                    field: 'souju.player',
                    label: '播放器',
                    bottomHelpMessage: '设置[#看剧]使用的播放器',
                    component: 'Input'
                },
                {
                    component: 'Divider',
                    label: '对话设置'
                },
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
                    field: 'duihua.EnableBing',
                    label: '必应开关',
                    bottomHelpMessage: '是否开启必应对话',
                    component: 'Switch'
                },
                {
                    field: 'duihua.BingCookie',
                    label: '必应参数',
                    bottomHelpMessage: '必应Cookie',
                    component: 'Input'
                },
                {
                    field: 'duihua.EnableVoice',
                    label: '对话语音',
                    bottomHelpMessage: '是否开启对话语音',
                    component: 'Switch'
                },
                {
                    field: 'duihua.LinkMode',
                    label: '链接模式',
                    bottomHelpMessage: '开启后会在回复信息中包含引用链接。',
                    component: 'Switch'
                },
                {
                    field: 'duihua.VoiceIndex',
                    label: '语音发音人',
                    bottomHelpMessage: '输入发音人序号，对应序号可以通过 #查看发音人 获取',
                    component: 'Select',
                    componentProps: {
                        options: VoiceList.map(function (element, index) {
                            return { label: element.name, value: index }
                        }),
                        placeholder: '请选择发音人',
                    },
                },
                {
                    field: 'duihua.toneStyle',
                    label: '必应模型',
                    bottomHelpMessage: '必应对话的语言模型',
                    component: 'Select',
                    componentProps: {
                      options: [
                        { label: '默认', value: 'balanced' },
                        { label: '创意', value: 'creative' },
                        { label: '精确', value: 'precise' },
                        { label: '快速', value: 'fast' }
                      ],
                      placeholder: '请选择语言模型'
                    }
                  },
                {
                    component: 'Divider',
                    label: '代理设置'
                },
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
                },
            ],

            getConfigData() {
                return {
                    souju: Config.SearchVideos,
                    duihua: Config.Chat,
                    proxy: Config.proxy
                }
            },

            setConfigData(data, { Result }) {
                for (let key in data) Config.modify(...key.split('.'), data[key])

                return Result.ok({}, '保存成功!')
            }
        }
    }
}
