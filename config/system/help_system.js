export const helpCfg = {
  themeSet: true,
  title: "止水插件帮助",
  subTitle: "搜剧资源由 http://zj.qxyys.com 提供",
  colWidth: 350,
  colCount: 3,
  bgBlur: true,
  theme: 'all',
  themeExclude: ['default'],
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
      }
    ]
  },
  {
    "group": "搜剧设置",
    "auth": "master",
    "list": [
      {
        "icon": 75,
        "title": "#查看搜剧接口",
        "desc": "查看当前搜剧接口，以及接口列表"
      },
      {
        "icon": 87,
        "title": "#设置搜剧接口X",
        "desc": "设置搜剧时，使用的搜索接口"
      },
      {
        "icon": 80,
        "title": "#我的搜剧",
        "desc": "查看搜剧个人信息"
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
        "title": "#必应开关",
        "desc": "开启或者关闭必应对话功能"
      },
      {
        "icon": 29,
        "title": "设置必应参数",
        "desc": "将必应的Cookie直接发送给机器人"
      },
      {
        "icon": 85,
        "title": "#查看必应参数",
        "desc": "查看当前的必应参数"
      },
      {
        "icon": 43,
        "title": "#设置对话身份<身份描述>",
        "desc": "#设置对话身份从现在开始你是一只喵娘"
      },
      {
        "icon": 79,
        "title": "#查看对话身份",
        "desc": "查看当前的对话身份设置"
      }
    ]
  }
]

export const isSys = true