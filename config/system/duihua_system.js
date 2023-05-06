export const helpCfg = {
  themeSet: true,
  title: "止水对话帮助",
  subTitle: "人工智能对话系统",
  colWidth: 350,
  colCount: 3,
  bgBlur: true,
  theme: 'all',
  themeExclude: ['default'],
}
export const helpList = [
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
        "icon": 79,
        "title": "#设置对话主人<主人名字> <主人QQ>",
        "desc": "设置场景对话时，机器人的主人。例如：#设置对话主人止水 123456"
      },
      {
        "icon": 79,
        "title": "#设置好感度<QQ号码> <好感度>",
        "desc": "设置指定机器人对指定用户的好感度。例如：#设置好感度123456 10"
      }
    ]
  }
]

export const isSys = true
