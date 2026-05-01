import { puppeteer } from '../../model/index.js';
import { Config } from '../../components/index.js';

// 确保 logger 可用
const logger = global.logger || console;

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
  if (!command || typeof command !== 'string') {
    return false;
  }

  const imageCommands = [
    '#生成图片',
    '#创建图像',
    '#画',
    '#绘图',
    '#生成图像',
    '#创建图片'
  ];

  return imageCommands.some(cmd => command.startsWith(cmd));
}

/**
 * 发送语音消息
 * @param {Object} e - 事件对象
 * @param {Buffer} audioBuffer - 音频数据缓冲区
 * @returns {Promise<boolean>} - 返回是否发送成功
 */
export async function sendVoiceMessage(e, audioBuffer) {
  try {
    if (!audioBuffer || !Buffer.isBuffer(audioBuffer)) {
      logger.error('[发送语音] 无效的音频数据');
      return false;
    }

    // 使用segment发送语音
    const voiceSegment = segment.record(audioBuffer);
    await e.reply(voiceSegment);
    return true;
  } catch (error) {
    logger.error('[发送语音] 发送失败:', error);
    return false;
  }
}