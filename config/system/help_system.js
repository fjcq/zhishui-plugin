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
            {
                "icon": 83,
                "title": "#搜剧***  #重新搜剧",
                "desc": "搜索影视剧，返回[#搜剧]结果"
            },
            {
                "icon": 89,
                "title": "#上一页 #下一页 #到X页",
                "desc": "[#搜剧]结果的页面选择"
            },
            {
                "icon": 92,
                "title": "#取消搜剧",
                "desc": "取消当前的搜索"
            },
            {
                "icon": 86,
                "title": "#选剧X",
                "desc": "根据[#搜剧]结果，选择影视剧"
            },
            {
                "icon": 84,
                "title": "#看剧X  #看剧上一集  #看剧下一集",
                "desc": "根据[#选剧]结果，选择要看的影视剧"
            },
            {
                "icon": 90,
                "title": "#线路X",
                "desc": "[#选剧]结果有多条线路时，切换线路"
            },
            {
                "icon": 80,
                "title": "#我的搜剧",
                "desc": "查看自己的搜剧信息"
            }
        ]
    },
    {
        "group": "搜剧设置",
        "auth": "master",
        "list": [
            {
                "icon": 75,
                "title": "#(设置|增加|删除|查看)搜剧接口",
                "desc": "查看与管理搜剧接口"
            },
            {
                "icon": 93,
                "title": "#(查看|设置)搜剧播放器",
                "desc": "设置与查看当前播放器接口"
            }
        ]
    },
    {
        "group": "对话",
        "list": [
            {
                "icon": 94,
                "title": "<对话昵称>对话内容",
                "desc": "机器人会根据对话内容进行回复"
            },
            {
                "icon": 78,
                "title": "#修改昵称<自订昵称>",
                "desc": "修改对话昵称，比如：#修改昵称小七"
            },
            {
                "icon": 82,
                "title": "#语音(开启|关闭)",
                "desc": "开启或者关闭语音对话功能"
            },
            {
                "icon": 77,
                "title": "#查看发音人",
                "desc": "查看可选择的发音人列表"
            },
            {
                "icon": 71,
                "title": "#设置发音人<编号>",
                "desc": "设置语音对话中的发音人"
            },
            {
                "icon": 90,
                "title": "#艾特(开启|关闭)",
                "desc": "开启或者关闭艾特对话功能"
            },
            {
                "icon": 29,
                "title": "#设置API",
                "desc": "设置OpenAI的API"
            },
            {
                "icon": 85,
                "title": "查看API",
                "desc": "查看当前的OpenAI API"
            },
            {
                "icon": 29,
                "title": "#设置KEY",
                "desc": "设置OpenAI的KEY"
            },
            {
                "icon": 85,
                "title": "#查看KEY",
                "desc": "查看当前的OpenAI KEY"
            },
            {
                "icon": 43,
                "title": "#设置对话身份<身份描述>",
                "desc": "#设置对话身份从现在开始你是一只喵娘"
            },
            {
                "icon": 49,
                "title": "#查看对话身份",
                "desc": "查看当前的对话身份设置"
            },
            {
                "icon": 43,
                "title": "#设置对话场景<场景描述>",
                "desc": "尽量不要修改里面有关的消息格式的设定，可能会导致无法识别不同的用户身份"
            },
            {
                "icon": 79,
                "title": "#查看对话场景",
                "desc": "查看当前的对话场景设置"
            },
            {
                "icon": 29,
                "title": "#设置对话主人<名字> <QQ>",
                "desc": "设置场景对话时，机器人的主人。例如：#设置对话主人止水 123456"
            },
            {
                "icon": 49,
                "title": "#查看好感度",
                "desc": "查看自己的好感度。主人可以【@群友#查看好感度】查看他人好感度"
            },
            {
                "icon": 61,
                "title": "@群友#设置好感度<好感度>",
                "desc": "设置指定群友的好感度。"
            },
            {
                "icon": 64,
                "title": "#止水插件查看代理",
                "desc": "查看插件所使用的代理"
            },
            {
                "icon": 65,
                "title": "#止水插件设置代理",
                "desc": "设置插件所使用的代理，例如：#止水插件设置代理http://127.0.0.1:7890"
            }
        ]
    }
]

export const isSys = true
