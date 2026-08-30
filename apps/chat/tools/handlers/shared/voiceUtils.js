/**
 * 语音工具共享函数
 * 提供语音相关的共享功能
 */

import Config from '../../../../../components/Config.js';

/**
 * 检查语音系统是否已配置
 * 与 VoiceManager.detectVoiceSystem 逻辑保持一致，尊重 VoiceProvider 配置
 * @returns {object} { hasConfig: boolean, configType: number, message: string }
 */
export function checkVoiceConfig() {
    const voiceConfig = Config.Voice;
    const provider = voiceConfig?.VoiceProvider || 'auto';
    const tencentConfig = voiceConfig?.TencentCloudTTS;

    const hasTencentConfig = !!(tencentConfig?.SecretId &&
        tencentConfig?.SecretKey &&
        tencentConfig.SecretId !== '你的腾讯云SecretId' &&
        tencentConfig.SecretKey !== '你的腾讯云SecretKey');

    const hasDuiConfig = voiceConfig?.VoiceIndex !== undefined;

    // 强制腾讯云：密钥无效时视为未配置
    if (provider === 'tencent') {
        if (hasTencentConfig) {
            return { hasConfig: true, configType: 2, message: '腾讯云语音已配置' };
        }
        return {
            hasConfig: false,
            configType: 0,
            message: '已选择腾讯云TTS但密钥未配置或无效，请主人在锅巴设置面板填写正确的SecretId和SecretKey'
        };
    }

    // 强制DUI平台
    if (provider === 'dui') {
        return { hasConfig: true, configType: 1, message: 'DUI平台语音已配置' };
    }

    // auto：腾讯云密钥有效时优先，否则DUI平台
    if (hasTencentConfig) {
        return { hasConfig: true, configType: 2, message: '腾讯云语音已配置' };
    }

    if (hasDuiConfig) {
        return { hasConfig: true, configType: 1, message: 'DUI平台语音已配置' };
    }

    return {
        hasConfig: false,
        configType: 0,
        message: '语音系统未配置。请主人在锅巴设置面板或配置文件中配置语音相关参数（腾讯云TTS需填写SecretId和SecretKey）'
    };
}
