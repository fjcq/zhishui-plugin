/**
 * 酷狗音乐签名算法
 *
 * 来源：参考 KuGouMusicApi 开源项目及逆向资料
 *
 * 算法说明：
 * - key 参数：MD5(hash + 固定盐 + appid + MD5(dfid) + userid)，用于播放链接接口
 * - signature 参数：MD5(动态密钥 + 按key升序排列的参数字符串 + 动态密钥)，用于需要签名的接口
 */

import crypto from 'crypto';
import { logger } from '../../../../../../components/index.js';

/** 酷狗固定盐值1（用于 key 计算） */
const KUGOU_KEY_SALT = '185672dd44712f60bb1736df5a377e82';

/** 酷狗动态密钥（用于 signature 计算，Web/Android 平台） */
const KUGOU_SECRET_KEY = 'OIlwieks28dk2k092lksi2UIkp';

/**
 * 计算 MD5 哈希
 * @param {string} input - 输入字符串
 * @returns {string} 32位小写十六进制 MD5
 */
export function cryptoMd5(input) {
    return crypto.createHash('md5').update(input, 'utf8').digest('hex');
}

/**
 * 计算酷狗 key 参数
 * key = MD5(hash + 盐 + appid + MD5(dfid) + userid)
 * @param {string} hash - 歌曲 hash（32位小写）
 * @param {string} dfid - 设备指纹 ID，可为 "-"
 * @param {string|number} userid - 用户 ID，未登录为 0
 * @param {string|number} appid - 应用 ID，默认 1005
 * @returns {string} 32位 MD5
 */
export function generateKugouKey(hash, dfid = '-', userid = 0, appid = 1005) {
    const mid = cryptoMd5(dfid);
    const source = `${hash}${KUGOU_KEY_SALT}${appid}${mid}${userid}`;
    return cryptoMd5(source);
}

/**
 * 计算酷狗 signature 参数
 * signature = MD5(密钥 + 排序后参数 + 密钥)
 * @param {object} params - 参与签名的参数对象
 * @param {string} data - 额外的 data 字段（可选）
 * @returns {string} 32位 MD5
 */
export function generateKugouSignature(params, data = '') {
    const sortedParams = Object.keys(params)
        .sort()
        .map(key => {
            const value = typeof params[key] === 'object' ? JSON.stringify(params[key]) : params[key];
            return `${key}=${value}`;
        })
        .join('');

    return cryptoMd5(`${KUGOU_SECRET_KEY}${sortedParams}${data || ''}${KUGOU_SECRET_KEY}`);
}

/**
 * 生成随机的 dfid（22位 Base62）
 * 当本地没有 dfid 时使用，部分接口接受 "-" 但搜索接口建议使用真实 dfid
 * @returns {string} 22位随机 dfid
 */
export function generateRandomDfid() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 22; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

/**
 * 获取或生成 mid（设备标识）
 * mid = MD5(dfid)，未持久化时使用固定 dfid
 * @param {string} dfid - 设备指纹
 * @returns {string} 32位 MD5
 */
export function generateMid(dfid = '-') {
    return cryptoMd5(dfid);
}

export { KUGOU_KEY_SALT, KUGOU_SECRET_KEY };
export default {
    cryptoMd5,
    generateKugouKey,
    generateKugouSignature,
    generateRandomDfid,
    generateMid
};
