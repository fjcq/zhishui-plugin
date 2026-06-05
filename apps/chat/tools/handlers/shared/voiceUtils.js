/**
 * 语音工具共享函数
 * 提供语音相关的共享功能
 */

import Config from '../../../../components/Config.js';

/**
 * 检查语音系统是否已配置
 * @returns {object} { hasConfig: boolean, configType: number, message: string }
 */
export function checkVoiceConfig() {
    const voiceConfig = Config.Voice;
    const tencentConfig = voiceConfig?.TencentCloudTTS;

    const hasTencentConfig = tencentConfig?.SecretId &&
        tencentConfig?.SecretKey &&
        tencentConfig.SecretId !== '你的腾讯云SecretId' &&
        tencentConfig.SecretKey !== '你的腾讯云SecretKey';

    const hasDuiConfig = voiceConfig?.VoiceIndex !== undefined;

    if (hasTencentConfig) {
        return { hasConfig: true, configType: 2, message: '腾讯云语音已配置' };
    }

    if (hasDuiConfig) {
        return { hasConfig: true, configType: 1, message: 'DUI平台语音已配置' };
    }

    return {
        hasConfig: false,
        configType: 0,
        message: '语音系统未配置。请主人使用指令配置：\n"对话语音开启" - 开启DUI平台语音系统\n"对话语音开启腾讯" - 开启腾讯云语音系统（需先配置SecretId和SecretKey）'
    };
}
