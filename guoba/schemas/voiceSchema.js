/**
 * 语音设置Schema
 * 合并到系统设置中
 */

import fs from 'fs';
import path from 'path';

const Path = process.cwd();
const PluginPath = path.join(Path, 'plugins', 'zhishui-plugin');

/**
 * 加载语音列表
 * @returns {Array} 语音列表
 */
function loadVoiceList() {
    try {
        const voicePath = path.join(PluginPath, 'resources', 'data', 'voice', 'original_voice_list.json');
        if (fs.existsSync(voicePath)) {
            const voiceContent = fs.readFileSync(voicePath, 'utf8');
            const voiceData = JSON.parse(voiceContent);
            return Array.isArray(voiceData) ? voiceData : [];
        }
    } catch (err) {
        console.error('止水插件-语音列表加载失败:', err);
    }
    return [];
}

/**
 * 加载腾讯云语音列表
 * @returns {Array} 腾讯云语音列表
 */
function loadTencentVoiceList() {
    try {
        const tencentVoicePath = path.join(PluginPath, 'resources', 'data', 'voice', 'tencent_voice_list.json');
        if (fs.existsSync(tencentVoicePath)) {
            const tencentVoiceContent = fs.readFileSync(tencentVoicePath, 'utf8');
            const tencentVoiceData = JSON.parse(tencentVoiceContent);
            return [
                ...(tencentVoiceData.super_natural_models || []),
                ...(tencentVoiceData.large_models || []),
                ...(tencentVoiceData.premium_voices || [])
            ];
        }
    } catch (err) {
        console.error('止水插件-腾讯云语音列表加载失败:', err);
    }
    return [];
}

const VoiceList = loadVoiceList();
const TencentVoiceList = loadTencentVoiceList();

/**
 * 获取语音设置Schema（已合并到系统设置，返回空数组）
 * @returns {Array} Schema配置
 */
export function getVoiceSchemas() {
    return [];
}

/**
 * 获取完整的语音设置Schema（用于系统设置）
 * @returns {Array} Schema配置
 */
export function getVoiceSettingSchemas() {
    return [
        {
            label: '🔊 语音设置',
            component: 'SOFT_GROUP_BEGIN'
        },
        {
            field: 'voice.VoiceSystem',
            label: '语音系统',
            helpMessage: '选择TTS语音合成系统，关闭则不使用语音功能',
            bottomHelpMessage: '选择使用的语音系统',
            component: 'RadioGroup',
            componentProps: {
                options: [
                    { label: '关闭', value: 0 },
                    { label: 'DUI平台语音', value: 1 },
                    { label: '腾讯云TTS', value: 2 }
                ]
            }
        },
        {
            field: 'voice.VoiceIndex',
            label: 'DUI发音人',
            helpMessage: '选择DUI平台的语音发音人（仅DUI平台生效）',
            bottomHelpMessage: '选择DUI平台的语音发音人',
            component: 'Select',
            componentProps: {
                options: VoiceList.length > 0 ? VoiceList.map((element, index) => ({
                    label: element.name,
                    value: index
                })) : [],
                placeholder: '请选择发音人'
            }
        },
        {
            component: 'Divider',
            label: '腾讯云TTS配置'
        },
        {
            field: 'voice.TencentCloudTTS.Region',
            label: '服务地域',
            helpMessage: '腾讯云TTS服务的地域，选择就近地域可降低延迟',
            bottomHelpMessage: '腾讯云服务地域',
            component: 'Select',
            componentProps: {
                options: [
                    { label: '广州', value: 'ap-guangzhou' },
                    { label: '北京', value: 'ap-beijing' },
                    { label: '上海', value: 'ap-shanghai' },
                    { label: '成都', value: 'ap-chengdu' },
                    { label: '中国香港', value: 'ap-hongkong' }
                ],
                placeholder: '请选择地域'
            }
        },
        {
            field: 'voice.TencentCloudTTS.SecretId',
            label: 'SecretId',
            helpMessage: '腾讯云API密钥的SecretId，在腾讯云控制台获取',
            bottomHelpMessage: '腾讯云API密钥SecretId',
            component: 'Input',
            componentProps: {
                placeholder: '请输入SecretId'
            }
        },
        {
            field: 'voice.TencentCloudTTS.SecretKey',
            label: 'SecretKey',
            helpMessage: '腾讯云API密钥的SecretKey，在腾讯云控制台获取',
            bottomHelpMessage: '腾讯云API密钥SecretKey',
            component: 'Input',
            componentProps: {
                type: 'password',
                placeholder: '请输入SecretKey'
            }
        },
        {
            field: 'voice.TencentCloudTTS.VoiceType',
            label: '语音类型',
            helpMessage: '选择语音音色，不同音色有不同的声音特点',
            bottomHelpMessage: '选择语音音色',
            component: 'Select',
            componentProps: {
                options: TencentVoiceList.length > 0 ? TencentVoiceList.map(voice => ({
                    label: `${voice.name} - ${voice.type}`,
                    value: voice.id
                })) : [],
                placeholder: '请选择语音类型'
            }
        },
        {
            field: 'voice.TencentCloudTTS.Speed',
            label: '语速',
            helpMessage: '语速调节：-2为0.6倍速，0为正常速度，6为2倍速',
            bottomHelpMessage: '语速范围：-2(0.6倍) ~ 6(2.0倍)',
            component: 'InputNumber',
            componentProps: {
                min: -2,
                max: 6,
                placeholder: '0'
            }
        },
        {
            field: 'voice.TencentCloudTTS.Volume',
            label: '音量',
            helpMessage: '音量大小调节，0为正常音量',
            bottomHelpMessage: '音量范围：-10 ~ 10',
            component: 'InputNumber',
            componentProps: {
                min: -10,
                max: 10,
                placeholder: '0'
            }
        },
        {
            field: 'voice.TencentCloudTTS.SampleRate',
            label: '采样率',
            helpMessage: '音频采样率，采样率越高音质越好但文件越大',
            bottomHelpMessage: '音频采样率',
            component: 'RadioGroup',
            componentProps: {
                options: [
                    { label: '8000Hz (低)', value: 8000 },
                    { label: '16000Hz (中)', value: 16000 },
                    { label: '24000Hz (推荐)', value: 24000 }
                ]
            }
        },
        {
            field: 'voice.TencentCloudTTS.Codec',
            label: '音频格式',
            helpMessage: '输出音频的编码格式，mp3兼容性最好',
            bottomHelpMessage: '输出音频格式',
            component: 'RadioGroup',
            componentProps: {
                options: [
                    { label: 'mp3 (推荐)', value: 'mp3' },
                    { label: 'wav', value: 'wav' },
                    { label: 'pcm', value: 'pcm' }
                ]
            }
        }
    ];
}

export default {
    getVoiceSchemas,
    getVoiceSettingSchemas
};
