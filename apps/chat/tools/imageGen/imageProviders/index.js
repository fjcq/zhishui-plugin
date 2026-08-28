/**
 * 生图 Provider 注册表
 * type → provider 实现的映射，新增协议格式只需新增实现文件并在本文件注册
 */

import { IMAGE_PROVIDER_TYPES } from '../imageSchema.js';
import openaiCompatible from './openaiCompatible.js';
import tongyi from './tongyi.js';
import wenxin from './wenxin.js';

/** type → 实现映射 */
const PROVIDER_REGISTRY = {
    [IMAGE_PROVIDER_TYPES.OPENAI]: openaiCompatible,
    [IMAGE_PROVIDER_TYPES.TONGYI]: tongyi,
    [IMAGE_PROVIDER_TYPES.WENXIN]: wenxin
};

/**
 * 按类型获取 provider 实现
 * @param {string} type - provider 类型（IMAGE_PROVIDER_TYPES 之一）
 * @returns {Object} 含 generate（及可选 edit）方法的实现对象
 * @throws {Error} 类型未注册时抛出
 */
export function getImageProvider(type) {
    const impl = PROVIDER_REGISTRY[type];
    if (!impl) {
        throw new Error(`未注册的生图服务商类型: ${type}`);
    }
    return impl;
}

/**
 * 列出全部已注册的 provider 类型
 * @returns {string[]} 类型数组
 */
export function listImageProviderTypes() {
    return Object.keys(PROVIDER_REGISTRY);
}

export default { getImageProvider, listImageProviderTypes };
