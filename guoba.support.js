import { Config } from './components/index.js'
const Path = process.cwd()
const PluginPath = `${Path}/plugins/zhishui-plugin`

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
            description: "影视剧搜索与AI对话功能",
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
                }, {
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
                    field: 'duihua.OnlyMaster',
                    label: '仅限主人',
                    bottomHelpMessage: '限制对话功能，仅限主人可用',
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
                    field: 'duihua.EnableBing',
                    label: '必应开关',
                    bottomHelpMessage: '是否开启必应对话',
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
                    component: 'Input'
                }
            ],

            getConfigData() {
                return {
                    souju: Config.SearchVideos,
                    duihua: Config.Chat
                }
            },

            setConfigData(data, { Result }) {
                for (let key in data) Config.modify(...key.split('.'), data[key])

                return Result.ok({}, '保存成功!')
            }
        }
    }
}
