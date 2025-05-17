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
        "group": "搜剧",
        "list": [
            { "icon": 83, "title": "#搜剧***  #重新搜剧", "desc": "搜索影视剧，返回[#搜剧]结果" },
            { "icon": 89, "title": "#上一页 #下一页 #到X页", "desc": "[#搜剧]结果的页面选择" },
            { "icon": 92, "title": "#取消搜剧", "desc": "取消当前的搜索" },
            { "icon": 86, "title": "#选剧X", "desc": "根据[#搜剧]结果，选择影视剧" },
            { "icon": 84, "title": "#看剧X  #看剧上一集  #看剧下一集", "desc": "根据[#选剧]结果，选择要看的影视剧" },
            { "icon": 90, "title": "#线路X", "desc": "[#选剧]结果有多条线路时，切换线路" },
            { "icon": 80, "title": "#我的搜剧", "desc": "查看自己的搜剧信息" }
        ]
    },
    {
        "group": "搜剧设置",
        "auth": "master",
        "list": [
            { "icon": 75, "title": "#(设置|增加|删除|查看)搜剧接口", "desc": "查看与管理搜剧接口" },
            { "icon": 93, "title": "#(查看|设置)搜剧播放器", "desc": "设置与查看当前播放器接口" }
        ]
    },
    {
        "group": "基础对话",
        "list": [
            { "icon": 94, "title": "<对话昵称>对话内容", "desc": "机器人会根据对话内容进行回复" },
            { "icon": 84, "title": "#修改昵称<自订昵称>", "desc": "修改对话昵称，比如：#修改昵称小七" }
        ]
    },
    {
        "group": "语音与艾特",
        "list": [
            { "icon": 82, "title": "#语音(开启|关闭)", "desc": "开启或者关闭语音对话功能" },
            { "icon": 77, "title": "#查看发音人", "desc": "查看可选择的发音人列表" },
            { "icon": 77, "title": "#设置发音人<编号>", "desc": "设置语音对话中的发音人" },
            { "icon": 90, "title": "#艾特(开启|关闭)", "desc": "开启或者关闭艾特对话功能" }
        ]
    },
    {
        "group": "API与密钥",
        "list": [
            { "icon": 86, "title": "#设置API <接口地址>", "desc": "设置OpenAI的API接口地址" },
            { "icon": 86, "title": "#查看API", "desc": "查看当前的OpenAI API接口地址" },
            { "icon": 88, "title": "#设置KEY <密钥>", "desc": "设置OpenAI的KEY" },
            { "icon": 88, "title": "#查看KEY", "desc": "查看当前的OpenAI KEY" }
        ]
    },
    {
        "group": "身份与场景",
        "list": [
            { "icon": 62, "title": "#查看对话身份", "desc": "返回当前角色完整JSON" },
            { "icon": 62, "title": "#设置对话身份<JSON>", "desc": "仅修改当前角色，需提交完整JSON" },
            { "icon": 74, "title": "#添加对话角色<JSON>", "desc": "追加新角色，需提交完整JSON" },
            { "icon": 62, "title": "#角色列表", "desc": "枚举可用角色列表，当前角色有特殊标记" },
            { "icon": 74, "title": "#切换角色<序号或标题>", "desc": "切换要扮演的角色，支持序号或标题" },
            { "icon": 87, "title": "#查看对话场景", "desc": "返回当前场景内容" },
            { "icon": 87, "title": "#设置对话场景<场景描述>", "desc": "设置对话场景（写入Scene.json）" }
        ]
    },
    {
        "group": "主人与好感度",
        "list": [
            { "icon": 84, "title": "#设置对话主人<名字> <QQ>", "desc": "设置机器人的主人。例如：#设置对话主人止水 123456" },
            { "icon": 84, "title": "#查看好感度", "desc": "查看自己的好感度。主人可@他人查看" },
            { "icon": 61, "title": "@群友#设置好感度<好感度>", "desc": "设置指定群友的好感度" }
        ]
    },
    {
        "group": "代理与网络",
        "list": [
            { "icon": 83, "title": "#止水插件查看代理", "desc": "查看插件所使用的代理" },
            { "icon": 83, "title": "#止水插件设置代理", "desc": "设置插件所使用的代理，例如：#止水插件设置代理http://127.0.0.1:7890" }
        ]
    }
]

export const isSys = true
