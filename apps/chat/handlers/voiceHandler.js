/**
 * 语音设置处理模块
 * 处理语音相关的命令
 */

import { Config } from '../../../components/index.js';
import Data from '../../../components/Data.js';

/**
 * 设置语音开关
 * @param {Object} e - 事件对象
 * @returns {Promise<boolean>} 处理结果
 */
export async function handleSetVoiceEnable(e) {
    if (e.isMaster == false) {
        return false;
    }

    let msg = e.msg;
    let Enable = msg.search('开启') != -1;

    if (Enable) {
        if (msg.search('腾讯') != -1) {
            Config.modify('voice', 'VoiceSystem', 2);
            e.reply("[对话语音]已开启，使用腾讯云语音系统！");
        } else {
            Config.modify('voice', 'VoiceSystem', 1);
            e.reply("[对话语音]已开启，使用DUI平台语音系统！");
        }
    } else {
        Config.modify('voice', 'VoiceSystem', 0);
        e.reply("[对话语音]已关闭！");
    }

    return true;
}

/**
 * 设置对话发音人
 * @param {Object} e - 事件对象
 * @returns {Promise<boolean>} 处理结果
 */
export async function handleSetVoiceId(e) {
    if (e.isMaster == false) {
        return false;
    }

    const voiceSystem = Config.Voice.VoiceSystem;
    if (!voiceSystem) {
        e.reply("[对话语音]请先开启语音系统，可使用以下指令：\n对话语音开启 - 开启DUI平台语音系统\n对话语音开启腾讯 - 开启腾讯云语音系统");
        return true;
    }

    const voiceList = await Data.readVoiceList();
    let VoiceIndex = parseInt(e.msg.replace(/\D+/, '').trim());

    if (voiceSystem === 1) {
        if (VoiceIndex < voiceList.length && VoiceIndex > 0) {
            VoiceIndex = VoiceIndex - 1;
            Config.modify('voice', 'VoiceIndex', VoiceIndex);
            let name = voiceList[VoiceIndex].name;
            e.reply("[对话发音人]:" + name);

            let voiceId = voiceList[VoiceIndex].voiceId;
            let url = `https://dds.dui.ai/runtime/v1/synthesize?voiceId=${voiceId}&text=你喜欢我这个声音吗？&speed=0.8&volume=150&audioType=wav`;
            e.reply([segment.record(url)]);
        } else {
            e.reply("[对话发音人]错误！");
        }
    } else if (voiceSystem === 2) {
        if (VoiceIndex > 0) {
            Config.modify('voice', 'TencentCloudTTS.VoiceType', VoiceIndex);
            e.reply(`[对话发音人]:腾讯云语音系统发音人ID：${VoiceIndex}`);
        } else {
            e.reply("[对话发音人]错误！");
        }
    }

    return true;
}

/**
 * 查看对话发音人
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleShowVoiceId(e) {
    const voiceSystem = Config.Voice.VoiceSystem;
    if (!voiceSystem) {
        e.reply("[对话语音]请先开启语音系统，可使用以下指令：\n对话语音开启 - 开启DUI平台语音系统\n对话语音开启腾讯 - 开启腾讯云语音系统");
        return;
    }

    const voiceList = await Data.readVoiceList();
    const { common } = await import('../../../model/index.js');

    if (voiceSystem === 1) {
        let msg = [];
        let nowindex = Config.Voice.VoiceIndex;
        msg.push(`当前DUI平台语音系统发音人：${(nowindex + 1)} 、${voiceList[nowindex].name}`);
        msg.push(`#止水对话设置发音人${(nowindex + 1)}`);
        let list = `*** DUI平台发音人列表 ***\n`;
        for (let i = 0; i < voiceList.length; i++) {
            let obj = voiceList[i];
            let name = obj.name;
            let type = obj.type;
            let sexy = obj.sexy;
            if (nowindex == i) {
                list += `>>>${(i + 1)} 、${name}，分类：${type}，性别：${sexy}<<<\n`;
            } else {
                list += `${(i + 1)} 、${name}，分类：${type}，性别：${sexy}\n`;
            }

        }
        msg.push(list);
        common.getforwardMsg(e, msg, {
            isxml: true,
            xmlTitle: 'DUI平台发音人列表',
        });
    } else if (voiceSystem === 2) {
        const currentVoiceType = Config.Voice.TencentCloudTTS.VoiceType;
        e.reply(`[对话语音]当前腾讯云语音系统发音人ID：${currentVoiceType}\n请参考腾讯云官方文档获取完整的发音人列表`);
    }
}

/**
 * 设置艾特开关
 * @param {Object} e - 事件对象
 * @returns {Promise<boolean>} 处理结果
 */
export async function handleSetAtEnable(e) {
    if (e.isMaster == false) {
        return false;
    }

    let Enable = e.msg.search('开启') != -1;

    Config.modify('chat', 'EnableAt', Enable);

    if (Enable) {
        e.reply("[对话艾特]已开启！");
    } else {
        e.reply("[对话艾特]已关闭！");
    }
    return true;
}
