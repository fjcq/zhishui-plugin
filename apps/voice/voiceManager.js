import Config from '../../components/Config.js';
import Data from '../../components/Data.js';

/**
 * 语音管理器
 * 负责处理不同语音系统的语音合成请求
 */
class VoiceManager {
    constructor() {
        this.voiceSystems = {
            original: this.synthesizeWithOriginal.bind(this),
            tencent: this.synthesizeWithTencent.bind(this),
        };
    }

    /**
     * 过滤文本中的代码块和图片内容
     * @param {string} text - 原始文本
     * @returns {string} - 过滤后的纯文本
     */
    filterText(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }

        // 过滤代码块
        text = text.replace(/```[\s\S]*?```/g, '[代码内容]');
        text = text.replace(/`[^`]+`/g, '[代码]');

        // 过滤图片内容
        text = text.replace(/\[图片\]/g, '');
        text = text.replace(/!\[.*?\]\(.*?\)/g, '');

        // 过滤其他非文本内容
        text = text.replace(/\[CQ:image,.*?\]/g, '');

        return text.trim();
    }

    /**
     * 根据配置选择语音系统并合成语音
     * @param {Object} e - 事件对象
     * @param {string} text - 要转换的文本内容
     * @param {Object} options - 可选配置
     * @returns {Promise<Buffer|null>} - 返回语音数据缓冲区或null
     */
    async synthesize(e, text, options = {}) {
        try {
            const voiceSystem = Config.Voice.VoiceSystem;

            // 过滤文本中的代码块和图片内容
            const filteredText = this.filterText(text);

            // 如果过滤后文本为空，不进行语音合成
            if (!filteredText) {
                logger.debug('[语音合成] 过滤后文本为空，跳过合成');
                return null;
            }

            switch (voiceSystem) {
                case 1:
                    return await this.synthesizeWithOriginal(e, filteredText, options);
                case 2:
                    return await this.synthesizeWithTencent(e, filteredText, options);
                default:
                    logger.debug('[语音合成] 语音系统未启用');
                    return null;
            }
        } catch (error) {
            logger.error('[语音合成] 合成失败:', error);
            return null;
        }
    }

    /**
     * 使用DUI平台语音系统合成语音
     * @param {Object} e - 事件对象
     * @param {string} text - 要转换的文本内容
     * @param {Object} options - 可选配置
     * @returns {Promise<string|null>} - 返回语音URL或null
     */
    async synthesizeWithOriginal(e, text, options = {}) {
        try {
            // 确保文本不为空
            if (!text || typeof text !== 'string') {
                logger.error('[语音合成] 无效的文本内容');
                return null;
            }

            // 获取语音列表
            const voiceList = await Data.readVoiceList();

            // 获取当前发音人
            const voiceIndex = Config.Voice.VoiceIndex;
            if (!voiceList || !voiceList[voiceIndex]) {
                logger.error('[语音合成] 无效的发音人索引');
                return null;
            }

            const voiceId = voiceList[voiceIndex].voiceId;
            const voiceUrl = `https://dds.dui.ai/runtime/v1/synthesize?voiceId=${voiceId}&text=${encodeURIComponent(text)}&speed=0.8&volume=150&audioType=wav`;

            return voiceUrl;
        } catch (error) {
            logger.error('[语音合成] DUI平台语音系统合成失败:', error);
            return null;
        }
    }

    /**
     * 使用腾讯语音合成语音
     * @param {Object} e - 事件对象
     * @param {string} text - 要转换的文本内容
     * @param {Object} options - 可选配置
     * @returns {Promise<Buffer|null>} - 返回语音数据缓冲区或null
     */
    async synthesizeWithTencent(e, text, options = {}) {
        try {
            // 获取腾讯云文字转语音配置
            const ttsConfig = Config.Voice.TencentCloudTTS;

            // 确保配置完整
            if (!ttsConfig || !ttsConfig.SecretId || !ttsConfig.SecretKey ||
                ttsConfig.SecretId === '你的腾讯云SecretId' ||
                ttsConfig.SecretKey === '你的腾讯云SecretKey') {
                logger.error('[语音合成] 腾讯云配置不完整，请在配置文件中填写正确的SecretId和SecretKey');
                return null;
            }

            // 确保文本不为空
            if (!text || typeof text !== 'string') {
                logger.error('[语音合成] 无效的文本内容');
                return null;
            }

            // 动态导入腾讯云SDK
            const tencentcloud = await import('tencentcloud-sdk-nodejs');
            const tts = tencentcloud.tts.v20190823;

            // 创建客户端
            const client = new tts.Client({
                credential: {
                    secretId: ttsConfig.SecretId,
                    secretKey: ttsConfig.SecretKey,
                },
                region: ttsConfig.Region || 'ap-guangzhou',
                profile: {
                    httpProfile: {
                        endpoint: 'tts.tencentcloudapi.com',
                    },
                },
            });

            // 构建请求参数
            const params = {
                Text: text,
                SessionId: `zhishui-${Date.now()}`,
                ModelType: 1,
                VoiceType: Number(options.VoiceType || ttsConfig.VoiceType || 502001),
                Speed: Number(options.Speed || ttsConfig.Speed || 0),
                Volume: Number(options.Volume || ttsConfig.Volume || 2),
                SampleRate: Number(ttsConfig.SampleRate || 24000),
                Codec: ttsConfig.Codec || 'mp3',
                PrimaryLanguage: 1,
                ProjectId: 0,
                EnableSubtitle: false,
                SegmentRate: 0,
            };

            // 调用API
            const result = await client.TextToVoice(params);

            // 处理返回结果
            if (result && result.Audio) {
                // 将base64编码的音频转换为Buffer
                const audioBuffer = Buffer.from(result.Audio, 'base64');
                return audioBuffer;
            } else {
                logger.error('[语音合成] 腾讯云API返回结果不完整');
                return null;
            }
        } catch (error) {
            logger.error('[语音合成] 腾讯语音合成失败:', error);
            // 友好的错误提示
            if (error.code === 'AuthFailure.SignatureFailure') {
                logger.error('[语音合成] 腾讯云API签名失败，请检查SecretId和SecretKey是否正确');
            } else if (error.code === 'RequestLimitExceeded') {
                logger.error('[语音合成] 请求频率超过限制，请稍后再试');
            } else if (error.code === 'InvalidParameterValue.TextLength') {
                logger.error('[语音合成] 文本长度超过限制');
            }
            return null;
        }
    }

    /**
     * 添加新的语音系统
     * @param {string} name - 语音系统名称
     * @param {Function} handler - 语音合成处理函数
     */
    addVoiceSystem(name, handler) {
        this.voiceSystems[name] = handler;
    }

    /**
     * 获取支持的语音系统列表
     * @returns {Array} - 语音系统列表
     */
    getSupportedSystems() {
        return Object.keys(this.voiceSystems);
    }
}

// 导出单例实例
export default new VoiceManager();
