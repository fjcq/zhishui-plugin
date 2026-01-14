import fs from 'fs';
import path from 'path';
import { Plugin_Path } from '../../components/index.js';
import Data from '../../components/Data.js';

/**
 * 获取好感度
 * @param {string} userId - 用户ID
 * @returns {Promise<number>} 好感度值
 */
export async function getUserFavor(userId) {
    let user = {};
    const dataPath = path.join(Plugin_Path, 'resources', 'data', 'user');
    const fileName = `${userId}.json`;
    const filePath = path.join(dataPath, fileName);
    if (fs.existsSync(filePath)) {
        user = await Data.readJSON(fileName, dataPath);
    }
    return parseInt(user.favor) || 0;
}

/**
 * 设置好感度
 * @param {string} userId - 用户ID
 * @param {number} favor - 好感度值，默认为0
 * @returns {Promise<void>}
 */
export async function setUserFavor(userId, favor = 0) {
    const dataPath = path.join(Plugin_Path, 'resources', 'data', 'user');
    const fileName = `${userId}.json`;
    const filePath = path.join(dataPath, fileName);
    let user = {};
    if (fs.existsSync(filePath)) {
        user = await Data.readJSON(fileName, dataPath);
    }
    user.favor = parseInt(favor) || 0;
    return Data.writeJSON(fileName, user, dataPath);
}
