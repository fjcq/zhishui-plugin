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
    group: "基础对话",
    list: [
      { icon: 94, title: "<对话昵称>对话内容", desc: "机器人会根据对话内容进行回复" },
      { icon: 84, title: "#修改昵称<自订昵称>", desc: "修改对话昵称，比如：#修改昵称小七" }
    ]
  },
  {
    group: "语音与艾特",
    list: [
      { icon: 82, title: "#语音(开启|关闭)", desc: "开启或者关闭语音对话功能" },
      { icon: 77, title: "#查看发音人", desc: "查看可选择的发音人列表" },
      { icon: 77, title: "#设置发音人<编号>", desc: "设置语音对话中的发音人" },
      { icon: 90, title: "#艾特(开启|关闭)", desc: "开启或者关闭艾特对话功能" }
    ]
  },
  {
    group: "身份与场景",
    list: [
      { icon: 62, title: "#查看对话身份", desc: "返回当前角色完整JSON" },
      { icon: 62, title: "#设置对话身份<JSON>", desc: "仅修改当前角色，需提交完整JSON" },
      { icon: 74, title: "#添加对话角色<JSON>", desc: "追加新角色，需提交完整JSON" },
      { icon: 62, title: "#角色列表", desc: "枚举可用角色列表，当前角色有特殊标记" },
      { icon: 74, title: "#切换角色<序号或标题>", desc: "切换要扮演的角色，支持序号或标题" },
      { icon: 87, title: "#查看对话场景", desc: "返回当前场景内容" },
      { icon: 87, title: "#设置对话场景<场景描述>", desc: "设置对话场景（写入Scene.json）" }
    ]
  },
  {
    group: "主人与好感度",
    list: [
      { icon: 84, title: "#设置对话主人<主人名字> <主人QQ>", desc: "设置场景对话时，机器人的主人。例如：#设置对话主人止水 123456" },
      { icon: 84, title: "#设置好感度<QQ号码> <好感度>", desc: "设置指定机器人对指定用户的好感度。例如：#设置好感度123456 10" },
      { icon: 84, title: "#查看好感度 [@用户]", desc: "查看自己的好感度，主人可@他人查看" }
    ]
  },
  {
    group: "模型与API",
    list: [
      { icon: 76, title: "#设置模型 <模型名>", desc: "设置当前对话使用的AI模型" },
      { icon: 76, title: "#查看模型", desc: "查看当前对话使用的AI模型" },
      { icon: 86, title: "#设置API <接口地址>", desc: "设置对话API接口地址" },
      { icon: 86, title: "#查看API", desc: "查看当前API接口地址" },
      { icon: 88, title: "#设置KEY <密钥>", desc: "设置对话API密钥" },
      { icon: 88, title: "#查看KEY", desc: "查看当前API密钥" }
    ]
  },
  {
    group: "代理与网络",
    list: [
      { icon: 83, title: "#代理(开启|关闭)", desc: "开启或关闭代理" },
      { icon: 83, title: "#设置代理 <代理地址>", desc: "设置http代理，例如：#设置代理http://127.0.0.1:7890" },
      { icon: 83, title: "#查看代理", desc: "查看当前代理设置" },
      { icon: 87, title: "#链接模式(开启|关闭)", desc: "开启或关闭链接模式" }
    ]
  },
  {
    group: "角色管理",
    list: [
      { icon: 74, title: "#角色列表", desc: "枚举出当前的可用角色列表，返回一个角色名字的列表给用户，当前角色有特殊标记" },
      { icon: 74, title: "#切换角色<序号或标题>", desc: "切换要扮演的角色，支持序号或标题，如 #切换角色1 或 #切换角色小七-觉醒AI" }
    ]
  }
]

export const isSys = true
