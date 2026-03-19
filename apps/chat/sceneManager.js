/**
 * 场景管理模块
 * 处理场景配置的读写操作
 */

import fs from 'fs';
import path from 'path';
import { Plugin_Path } from '../../components/index.js';

const SCENE_FILE_PATH = path.join(Plugin_Path, 'data', 'Scene.json');

/**
 * 确保场景文件目录存在
 */
function ensureSceneDir() {
    const dir = path.dirname(SCENE_FILE_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * 读取场景配置
 * @returns {Promise<string|null>} 场景JSON字符串，不存在时返回null
 */
export async function ReadScene() {
    try {
        if (!fs.existsSync(SCENE_FILE_PATH)) {
            return null;
        }
        const content = fs.readFileSync(SCENE_FILE_PATH, 'utf-8');
        return content;
    } catch (error) {
        console.error('[ReadScene] 读取场景配置失败:', error);
        return null;
    }
}

/**
 * 写入场景配置
 * @param {string} jsonStr - 场景JSON字符串
 * @returns {Promise<boolean>} 是否写入成功
 */
export async function WriteScene(jsonStr) {
    try {
        ensureSceneDir();
        fs.writeFileSync(SCENE_FILE_PATH, jsonStr, 'utf-8');
        return true;
    } catch (error) {
        console.error('[WriteScene] 写入场景配置失败:', error);
        return false;
    }
}
