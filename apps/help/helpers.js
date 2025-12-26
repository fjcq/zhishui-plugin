/**
 * 帮助模块辅助函数
 */
import fs from 'fs';
import _ from 'lodash';
import { Data } from '../../components/index.js';
import { puppeteer } from '../../model/index.js';
import { helpType } from './config.js';

/**
 * 生成随机背景图片
 * @returns {string} 背景图片文件名
 */
export async function rodom() {
  let image = fs.readdirSync('./plugins/zhishui-plugin/resources/help/imgs/');
  let list_img = [];
  for (let val of image) {
    list_img.push(val);
  }
  let imgs = list_img.length == 1 ? list_img[0] : list_img[_.random(0, list_img.length - 1)];
  return imgs;
}

/**
 * 生成帮助消息
 * @param {Object} e - 事件对象
 * @returns {Promise<Object>} - 帮助消息对象
 */
export async function help(e) {
  let custom = {};
  const special = e.msg.match(/^#?止水(插件)?(搜剧|对话)?(帮助|菜单|功能)$/)[2];

  let diyCfg, sysCfg;
  if (special) {
    let gpAdminHelp = await Data.importCfg(helpType[special]);
    diyCfg = gpAdminHelp.diyCfg;
    sysCfg = gpAdminHelp.sysCfg;
  } else {
    let indexHelp = await Data.importCfg('help');
    diyCfg = indexHelp.diyCfg;
    sysCfg = indexHelp.sysCfg;
  }

  let helpConfig = _.defaults(diyCfg.helpCfg || {}, custom.helpCfg, sysCfg.helpCfg);
  let helpList = diyCfg.helpList || custom.helpList || sysCfg.helpList;
  let helpGroup = [];

  _.chain(helpList)
    .filter(group => !(group.auth === 'master' && !e.isMaster))
    .forEach(group => {
      _.forEach(group.list, help => {
        if (!help.icon * 1) {
          help.css = 'display:none';
        } else {
          const x = (help.icon - 1) % 10;
          const y = (help.icon - x - 1) / 10;
          help.css = `background-position:-${x * 50}px -${y * 50}px`;
        }
      })
      helpGroup.push(group);
    })
    .value();
  return await puppeteer.render('help/index', {
    helpCfg: helpConfig,
    helpGroup,
    bg: await rodom(),
    colCount: 3,
    element: 'default'
  }, {
    e,
    scale: 1.6
  });
}
