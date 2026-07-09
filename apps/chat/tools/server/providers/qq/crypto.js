/**
 * QQ音乐签名算法
 *
 * 来源：参考 qq-music-api 开源项目及逆向资料
 *
 * 算法说明：
 * - sign 参数：用于加密接口（musics.fcg），格式为 "zzb" + 32位MD5
 *   sign = "zzb" + MD5("QKzUOJjXGkVqBxYy" + req_body_json)
 * - 大部分接口（musicu.fcg）可无需 sign 直接调用
 */

import crypto from 'crypto';

/** QQ音乐固定密钥 */
const QQ_SIGN_KEY = 'QKzUOJjXGkVqBxYy';

/**
 * 计算 MD5
 * @param {string} input - 输入字符串
 * @returns {string} 32位小写十六进制
 */
export function md5(input) {
    return crypto.createHash('md5').update(input, 'utf8').digest('hex');
}

/**
 * 计算 QQ音乐 sign 参数
 * @param {object|string} data - 请求体对象或 JSON 字符串
 * @returns {string} sign 字符串
 */
export function generateQQSign(data) {
    const bodyStr = typeof data === 'string' ? data : JSON.stringify(data);
    return 'zzb' + md5(QQ_SIGN_KEY + bodyStr);
}

/**
 * 生成 QQ音乐 guid
 * 一般为10位随机数字
 * @returns {string} guid
 */
export function generateGuid() {
    let guid = '';
    for (let i = 0; i < 10; i++) {
        guid += Math.floor(Math.random() * 10);
    }
    return guid || '1008611';
}

export { QQ_SIGN_KEY };
export default {
    md5,
    generateQQSign,
    generateGuid
};
