export const helpCfg = {
    themeSet: true,
    title: "止水插件帮助",
    subTitle: "搜剧资源由 http://zj.qxyys.com 提供",
    colWidth: 350,
    colCount: 3,
    bgBlur: true,
    theme: 'all',
    themeExclude: ['default'],
    style: {
        fontColor: "#ceb78b",
        descColor: "#eee",
        contBgColor: "rgba(6, 21, 31, .5)",
        contBgBlur: 3,
        headerBgColor: "rgba(6, 21, 31, .4)",
        rowBgColor1: "rgba(6, 21, 31, .2)",
        rowBgColor2: "rgba(6, 21, 31, .35)"
    }
}

export const helpList = [
    {
        "group": "对话功能",
        "list": [
            { "icon": 94, "title": "<昵称>消息内容", "desc": "与AI进行对话" },
            { "icon": 92, "title": "#重置对话", "desc": "清空当前对话上下文" },
            { "icon": 92, "title": "#重置全部对话", "desc": "清空所有对话上下文" },
            { "icon": 50, "title": "#查看对话历史", "desc": "查看当前会话记录" }
        ]
    },
    {
        "group": "角色扮演",
        "list": [
            { "icon": 22, "title": "#角色列表", "desc": "查看可用角色" },
            { "icon": 29, "title": "#切换角色<序号/名称>", "desc": "切换当前角色" },
            { "icon": 65, "title": "#添加角色<JSON>", "desc": "添加新角色" },
            { "icon": 78, "title": "#查看角色", "desc": "查看当前角色详情" },
            { "icon": 56, "title": "#查看场景", "desc": "查看当前场景" },
            { "icon": 65, "title": "#设置场景<描述>", "desc": "设置对话场景" }
        ]
    },
    {
        "group": "语音与艾特",
        "list": [
            { "icon": 82, "title": "#语音开启/关闭", "desc": "开关语音回复" },
            { "icon": 38, "title": "#查看发音人", "desc": "查看可用发音人" },
            { "icon": 85, "title": "#设置发音人<编号>", "desc": "选择发音人" },
            { "icon": 78, "title": "#艾特开启/关闭", "desc": "开关艾特触发" },
            { "icon": 94, "title": "#私聊回复开启/关闭", "desc": "开关私聊回复" }
        ]
    },
    {
        "group": "好感度系统",
        "list": [
            { "icon": 32, "title": "#查看好感度", "desc": "查看当前好感度" },
            { "icon": 29, "title": "#设置好感度<数值>", "desc": "修改好感度" },
            { "icon": 29, "title": "@他人#设置好感度<数值>", "desc": "修改他人好感度" },
            { "icon": 50, "title": "#查看好感度历史", "desc": "查看变化记录" }
        ]
    },
    {
        "group": "API配置",
        "list": [
            { "icon": 85, "title": "#设置API<地址>", "desc": "配置API地址" },
            { "icon": 83, "title": "#查看API", "desc": "查看当前API" },
            { "icon": 29, "title": "#切换API<编号>", "desc": "切换API接口" },
            { "icon": 86, "title": "#测试<内容>", "desc": "测试API连接" },
            { "icon": 83, "title": "#连接模式开启/关闭", "desc": "开关连接模式" }
        ]
    },
    {
        "group": "网络代理",
        "list": [
            { "icon": 83, "title": "#查看代理", "desc": "查看当前代理" },
            { "icon": 85, "title": "#设置代理<地址>", "desc": "配置代理服务器" }
        ]
    },
    {
        "group": "用户管理",
        "list": [
            { "icon": 78, "title": "#查看个人配置", "desc": "查看我的配置" },
            { "icon": 92, "title": "#重置个人配置", "desc": "重置我的配置" },
            { "icon": 78, "title": "#查看用户配置<QQ>", "desc": "查看指定用户配置" },
            { "icon": 92, "title": "#重置用户配置<QQ>", "desc": "重置指定用户配置" },
            { "icon": 93, "title": "#查看用户配置统计", "desc": "查看用户统计信息" }
        ]
    },
    {
        "group": "调试工具",
        "list": [
            { "icon": 87, "title": "#查看原始返回", "desc": "查看API原始数据" }
        ]
    },
    {
        "group": "搜剧功能",
        "list": [
            { "icon": 97, "title": "#搜剧<剧名>", "desc": "搜索影视剧" },
            { "icon": 95, "title": "#上一页", "desc": "查看上一页结果" },
            { "icon": 96, "title": "#下一页", "desc": "查看下一页结果" },
            { "icon": 81, "title": "#取消搜剧", "desc": "取消当前搜索" },
            { "icon": 84, "title": "#选剧<编号>", "desc": "选择影视剧" },
            { "icon": 84, "title": "#看剧<集数>", "desc": "播放指定集数" },
            { "icon": 29, "title": "#线路<编号>", "desc": "切换播放线路" },
            { "icon": 50, "title": "#我的搜剧", "desc": "查看搜剧记录" }
        ]
    },
    {
        "group": "搜剧设置",
        "auth": "master",
        "list": [
            { "icon": 22, "title": "#查看搜剧接口", "desc": "查看接口列表" },
            { "icon": 85, "title": "#设置搜剧接口<地址>", "desc": "添加接口" },
            { "icon": 81, "title": "#删除搜剧接口<编号>", "desc": "删除接口" },
            { "icon": 84, "title": "#查看播放器", "desc": "查看播放器配置" },
            { "icon": 85, "title": "#设置播放器<地址>", "desc": "配置播放器" }
        ]
    }
]

export const isSys = true
