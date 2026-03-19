/**
 * 语音设置Schema
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
 * 获取语音设置Schema
 * @returns {Array} Schema配置
 */
export function getVoiceSchemas() {
    return [
        {
            label: '语音设置',
            component: 'SOFT_GROUP_BEGIN'
        },
        {
            field: 'voice.VoiceSystem',
            label: '语音系统设置',
            bottomHelpMessage: '选择使用哪种语音系统：0（关闭）、1（DUI平台语音系统）、2（腾讯语音）',
            component: 'Select',
            componentProps: {
                options: [
                    { label: '关闭', value: 0 },
                    { label: 'DUI平台语音系统', value: 1 },
                    { label: '腾讯语音', value: 2 }
                ]
            }
        },
        {
            field: 'voice.VoiceIndex',
            label: '语音发音人',
            bottomHelpMessage: '选择语音回复的发音人（仅DUI平台语音系统有效）',
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
            field: 'voice.TencentCloudTTS.Region',
            label: '腾讯云TTS地域',
            bottomHelpMessage: '腾讯云服务地域，如 ap-guangzhou',
            component: 'Select',
            componentProps: {
                options: [
                    { label: '广州 (ap-guangzhou)', value: 'ap-guangzhou' },
                    { label: '北京 (ap-beijing)', value: 'ap-beijing' },
                    { label: '上海 (ap-shanghai)', value: 'ap-shanghai' },
                    { label: '成都 (ap-chengdu)', value: 'ap-chengdu' },
                    { label: '中国香港 (ap-hongkong)', value: 'ap-hongkong' }
                ],
                placeholder: '请选择地域'
            }
        },
        {
            field: 'voice.TencentCloudTTS.SecretId',
            label: '腾讯云SecretId',
            bottomHelpMessage: '腾讯云API密钥SecretId',
            component: 'Input',
            componentProps: {
                placeholder: '请输入SecretId'
            }
        },
        {
            field: 'voice.TencentCloudTTS.SecretKey',
            label: '腾讯云SecretKey',
            bottomHelpMessage: '腾讯云API密钥SecretKey',
            component: 'Input',
            componentProps: {
                placeholder: '请输入SecretKey'
            }
        },
        {
            field: 'voice.TencentCloudTTS.VoiceType',
            label: '腾讯云语音类型',
            bottomHelpMessage: '语音类型（音色 ID），包括精品音色、大模型音色与基础版复刻音色',
            component: 'Select',
            componentProps: {
                options: TencentVoiceList.length > 0 ? TencentVoiceList.map(voice => ({
                    label: `${voice.name} (${voice.id}) - ${voice.type} | ${voice.scene} | ${voice.languages}`,
                    value: voice.id
                })) : [],
                placeholder: '请选择语音类型'
            }
        },
        {
            field: 'voice.TencentCloudTTS.Speed',
            label: '腾讯云语速',
            bottomHelpMessage: '语速，范围：[-2，6]，分别对应不同语速：-2代表0.6倍，-1代表0.8倍，0代表1.0倍（默认）',
            component: 'Input',
            componentProps: {
                type: 'number',
                placeholder: '请输入语速'
            }
        },
        {
            field: 'voice.TencentCloudTTS.Volume',
            label: '腾讯云音量',
            bottomHelpMessage: '音量大小，范围[-10，10]，对应音量大小。默认为2，代表稍高音量',
            component: 'Input',
            componentProps: {
                type: 'number',
                placeholder: '请输入音量'
            }
        },
        {
            field: 'voice.TencentCloudTTS.SampleRate',
            label: '腾讯云采样率',
            bottomHelpMessage: '采样率：24000：24k（推荐），16000：16k，8000：8k',
            component: 'Select',
            componentProps: {
                options: [
                    { label: '24000（推荐）', value: 24000 },
                    { label: '16000', value: 16000 },
                    { label: '8000', value: 8000 }
                ],
                placeholder: '请选择采样率'
            }
        },
        {
            field: 'voice.TencentCloudTTS.Codec',
            label: '腾讯云音频格式',
            bottomHelpMessage: '返回音频格式，可取值：wav，mp3（推荐），pcm',
            component: 'Select',
            componentProps: {
                options: [
                    { label: 'mp3（推荐）', value: 'mp3' },
                    { label: 'wav', value: 'wav' },
                    { label: 'pcm', value: 'pcm' }
                ],
                placeholder: '请选择音频格式'
            }
        }
    ];
}
