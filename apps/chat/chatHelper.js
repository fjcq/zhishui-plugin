import { puppeteer } from '../../model/index.js';

/**
 * 将文本转换为图片
 * @param {Object} e - 事件对象
 * @param {string} text - 要转换的文本内容
 * @param {Object} options - 可选配置
 * @param {string} [options.title] - 图片标题
 * @param {boolean} [options.showFooter] - 是否显示页脚
 * @param {number} [options.scale] - 缩放比例
 * @returns {Promise<boolean>} - 返回是否成功
 */
export async function textToImage(e, text, options = {}) {
  try {
    // 确保文本不为空
    if (!text || typeof text !== 'string') {
      logger.error('[文本转图片] 无效的文本内容');
      return false;
    }

    // 准备渲染参数
    const params = {
      title: options.title || '',
      content: text,
      showFooter: options.showFooter !== false,
    };

    // 准备配置
    const cfg = {
      e,
      scale: options.scale || 1,
      retMsgId: false
    };

    // 调用puppeteer渲染
    const result = await puppeteer.render('chat/text_to_image', params, cfg);
    return result;
  } catch (error) {
    logger.error('[文本转图片] 渲染失败:', error);
    return false;
  }
}

/**
 * 判断是否应该将响应转换为图片
 * @param {string} command - 命令名称
 * @returns {boolean} - 返回是否应该转换为图片
 */
export function shouldResponseAsImage(command) {
  // 需要保持文字形式的命令列表
  const textOnlyCommands = [
    '#查看个人配置',
    '#查看用户配置',
    '#重置个人配置',
    '#重置用户配置',
    '#查看用户配置统计',
    '#设置角色',
    '#清除历史',
    '#查看好感度历史',
    '#止水更新',
    '#止水版本'
  ];

  // 检查命令是否在文字命令列表中
  return !textOnlyCommands.some(cmd => command.startsWith(cmd));
}