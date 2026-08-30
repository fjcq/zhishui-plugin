/**
 * 锅巴面板按钮动作处理器
 * 供 GButtons 组件通过 /plugin/do/zhishui-plugin/action 调用
 */

import { exec } from 'child_process';

/** 腾讯云API密钥管理页面地址 */
export const TENCENT_KEY_URL = 'https://console.cloud.tencent.com/cam/capi';

/**
 * 打开腾讯云API密钥获取页面
 * Windows下调用系统默认浏览器打开；其他平台返回地址供手动访问
 * @param {Array} args 按钮参数（未使用）
 * @param {Object} Result 结果对象
 * @returns {Object} 操作结果
 */
function openTencentKeyPage(args, { Result }) {
    try {
        if (process.platform === 'win32') {
            // windowsHide 必须加，否则会闪现conhost控制台窗口
            exec(`start "" "${TENCENT_KEY_URL}"`, { windowsHide: true });
            return Result.ok('已在默认浏览器打开密钥管理页面');
        }
        return Result.ok(`请手动访问获取密钥：${TENCENT_KEY_URL}`);
    } catch (err) {
        return Result.error('打开页面失败: ' + err.message);
    }
}

/** 导出给guoba.support.js注册的动作集合 */
export const guobaActions = {
    openTencentKeyPage
};
