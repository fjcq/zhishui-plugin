/**
 * 帮助模块配置
 */

export const helpType = {
  搜剧: 'videoSearch',
  对话: 'chat'
};

export const helpReg = new RegExp(
  `^#?止水(插件)?(${Object.keys(helpType).join('|')})?(帮助|菜单|功能)$`
);
