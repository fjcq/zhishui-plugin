import path from "path";
const _path = process.cwd() + "/plugins/zhishui-plugin";
import { Config } from './components/index.js'

/**
 *  支持锅巴配置
 */
export function supportGuoba() {
    return {
        // 配置项信息
        pluginInfo: {
            name: "zhishui-plugin",
            title: "止水插件",
            author: "止水",
            authorLink: "http://zj.qxyys.com",
            link: "https://gitee.com/fjcq/zhishui-plugin",
            isV3: true,
            isV2: false,
            description: "七星搜剧",
            // 显示图标，此为个性化配置
            // 图标可在 https://icon-sets.iconify.design 这里进行搜索
            icon: "emojione:non-potable-water",
            // 图标颜色，例：#FF0000 或 rgb(255, 0, 0)
            iconColor: "#d19f56",
            // 如果想要显示成图片，也可以填写图标路径（绝对路径）
            iconPath: path.join(_path, "resources/img/zhishui.png"),
        },
        // 配置项信息
        configInfo: {
            // 配置项 schemas
            schemas: [],
            // 获取配置数据方法（用于前端填充显示数据）
            getConfigData() {
                return {
                    whole: Config.Notice,
                    souju: Config.SearchVideos,
                    Chat: Config.Chat
                }
            },

            // 设置配置的方法（前端点确定后调用的方法）
            setConfigData(data, { Result }) {
                for (let key in data) Config.modify(...key.split('.'), data[key])

                return Result.ok({}, '保存成功辣ε(*´･ω･)з')
            }
        }
    }
}
