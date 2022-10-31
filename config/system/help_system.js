/*
* 此配置文件为系统使用，请勿修改，否则可能无法正常使用
*
* 如需自定义配置请复制修改上一级help_default.js
*
* */

export const helpCfg = {
  title: '止水帮助',
  subTitle: 'Yunzai-Bot & zhishui-Plugin',
  columnCount: 3,
  colWidth: 265,
  theme: 'all',
  themeExclude: ['default'],
  style: {
    fontColor: '#ceb78b',
    descColor: '#eee',
    contBgColor: 'rgba(6, 21, 31, .5)',
    contBgBlur: 3,
    headerBgColor: 'rgba(6, 21, 31, .4)',
    rowBgColor1: 'rgba(6, 21, 31, .2)',
    rowBgColor2: 'rgba(6, 21, 31, .35)'
  }
}

export const helpList = [{
  group: '止水小游戏',
  list: [{
    icon: 80,
    title: '#练习记忆力',
    desc: '记忆力小游戏 我猜+数字回答 #重置分数'
  }, {
    icon: 46,
    title: '猜语音 我猜+<角色>',
    desc: '猜原神语音 命令：猜语音 原神猜语 #我猜'
  }, {
    icon: 47,
    title: '#打我 @群友#打他',
    desc: '打我猜拳，赢了奖励，输了寄，'
  }, {
    icon: 48,
    title: '#猜原神',
    desc: '#猜+<内容> 猜角色 武器 圣遗物'
  }, {
    icon: 96,
    title: '#卜卦',
    desc: '#周易占卜 谨记心存敬畏 切忌玩笑'
  }]
}, {
  group: '止水ai画图(仅爱发电用户可用)',
  list: [{
    icon: 80,
    title: '#绘个图',
    desc: '#绘个图+关键词(可中英文)'
  }, {
    icon: 40,
    title: '#取消画图',
    desc: '取消当前画图操作'
  }, {
    icon: 40,
    title: '画图(开启|关闭)|涩涩开关',
    desc: '#仅我可画|#所有人可画|#止水画图涩涩(开启|关闭)'
  }, {
    icon: 48,
    title: '#止水画图撤回+数字',
    desc: '#止水画图撤回(开启|关闭）'
  }, {
    icon: 40,
    title: '#止水画图冷却+数字',
    desc: '#止水画图冷却(开启|关闭）'
  }, {
    icon: 40,
    title: '#新增屏蔽词+屏蔽词',
    desc: '#查看屏蔽词 #删除屏蔽词 #开启默认屏蔽词'
  }, {
    icon: 40,
    title: '#以图生草+关键词',
    desc: '#以图生草相似度+<数字>，#以图生草降噪+<数字>'
  }, {
    icon: 40,
    title: '#止水画图预设',
    desc: '#新增预设+<名称> #查看预设 #删除预设+<数字>'
  }, {
    icon: 40,
    title: '#止水画图规模+<数字>',
    desc: '数字范围在3-12，默认5.5'
  }, {
    icon: 40,
    title: '#止水画图模型+<数字>',
    desc: '模型范围在1-5，默认2'
  }, {
    icon: 40,
    title: '#止水画图步数+<数字>',
    desc: '步数范围在1-28，默认28'
  }, {
    icon: 40,
    title: '查看画图设置',
    desc: '#查看当前画图所有设置'
  }]
}, {
  group: '止水功能',
  list: [{
    icon: 33,
    title: '点歌xx',
    desc: '返回图片列表,点歌酷狗xx,点歌qqxx'
  }, {
    icon: 31,
    title: '#点视频+<视频名称>',
    desc: '查找视频返回图片列表 #取消搜索'
  }, {
    icon: 22,
    title: '#点小说+<小说名称>',
    desc: '查找小说返回图片列表 #取消小说搜索'
  }, {
    icon: 52,
    title: '#点漫画+<漫画名称>',
    desc: '查找漫画返回图片列表 #取消漫画搜索'
  }]
}, {
  group: '止水原史功能',
  list: [{
    icon: 57,
    title: '#<角色>语音+数字',
    desc: '#<角色>语音列表 #角色语音汇总'
  }, {
    icon: 58,
    title: '#了解+<角色>',
    desc: '#了解刻晴 #了解宵宫'
  }, {
    icon: 59,
    title: '#原史+角色',
    desc: '原史(角色|武器|圣遗物|装备|书籍|任务|NPC)'
  }, {
    icon: 79,
    title: '#原史id+数字',
    desc: 'id范围0~3794'
  }]
}, {
  group: '止水原史目录列表',
  list: [{
    icon: 60,
    title: '#原史目录',
    desc: '原史(角色|武器|圣遗物|怪物)目录'
  }, {
    icon: 74,
    title: '#原史目录',
    desc: '原史(任务|食物|物品|活动)目录'
  }, {
    icon: 11,
    title: '#原史目录',
    desc: '原史(书籍|npc|动物)目录'
  }]
}, {
  group: '管理命令，仅管理员可用',
  auth: 'master',
  list: [{
    icon: 95,
    title: '#止水(强制)更新',
    desc: '更新止水插件'
  }]
}]

export const isSys = true
