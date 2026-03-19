/**
 * 用户数据管理模块
 * 处理Redis中的用户数据存储和读取
 */

const logger = global.logger || console;

/**
 * 获取用户搜剧配置
 * @param {String} qq 用户QQ号码
 * @param {String|Array} keys key值，支持数组
 * @returns {Promise<String|Object>} 配置值
 */
export async function GetUserSearchVideos(qq, keys) {
    if (typeof keys === 'string') {
        const path = `zhishui:SearchVideos:${qq.toString()}:${keys}`;
        const value = await redis.get(path);
        return value !== null && value !== undefined ? value : '';
    } else {
        try {
            let promises = keys.map(async (key) => {
                const path = `zhishui:SearchVideos:${qq.toString()}:${key}`;
                const value = await redis.get(path);
                return value !== null && value !== undefined ? value : '';
            });

            const results = await Promise.all(promises);

            return keys.reduce((acc, key, index) => {
                acc[key] = results[index];
                return acc;
            }, {});
        } catch (error) {
            logger.error(`获取 [${qq}] 搜剧记录 时发生错误：${error.message}`);
            throw error;
        }
    }
}

/**
 * 写入用户搜剧配置
 * @param {String} qq 用户QQ号码
 * @param {String} key key值
 * @param {String|Number} value value
 * @returns {Promise<String>} 操作结果
 */
export async function SetUserSearchVideos(qq, key, value) {
    try {
        const path = `zhishui:SearchVideos:${qq.toString()}:${key}`;
        const ret = await redis.set(path, value);
        return ret;
    } catch (error) {
        logger.error(`为 [${qq}] 设置 ${key} : ${value} 时，发生错误：${error.message}`);
        throw error;
    }
}

/**
 * 删除用户搜剧配置
 * @param {String} qq 用户QQ号码
 * @param {String} key 要删除的键名
 * @returns {Promise<Number>} 删除结果
 */
export async function DeleteUserSearchVideos(qq, key) {
    try {
        const path = `zhishui:SearchVideos:${qq.toString()}:${key}`;
        const ret = await redis.del(path);
        return ret;
    } catch (error) {
        logger.error(`删除 [${qq}] 搜剧配置 ${key} 时，发生错误：${error.message}`);
        throw error;
    }
}

/**
 * 获取用户对话配置
 * @param {String} qq 用户QQ号码
 * @param {String|Array} keys key值，支持数组
 * @returns {Promise<Object|null>} 配置值
 */
export async function GetUserChatConfig(qq, keys) {
    if (typeof keys === 'string') {
        const path = `zhishui:ChatConfig:${qq.toString()}:${keys}`;
        const value = await redis.get(path);
        return value !== null && value !== undefined ? JSON.parse(value) : null;
    } else {
        try {
            let promises = keys.map(async (key) => {
                const path = `zhishui:ChatConfig:${qq.toString()}:${key}`;
                const value = await redis.get(path);
                return value !== null && value !== undefined ? JSON.parse(value) : null;
            });

            const results = await Promise.all(promises);

            return keys.reduce((acc, key, index) => {
                acc[key] = results[index];
                return acc;
            }, {});
        } catch (error) {
            logger.error(`获取 [${qq}] 对话配置 时发生错误：${error.message}`);
            throw error;
        }
    }
}

/**
 * 写入用户对话配置
 * @param {String} qq 用户QQ号码
 * @param {String} key key值
 * @param {String|Number|Object} value value
 * @returns {Promise<String>} 操作结果
 */
export async function SetUserChatConfig(qq, key, value) {
    try {
        const path = `zhishui:ChatConfig:${qq.toString()}:${key}`;
        const ret = await redis.set(path, JSON.stringify(value));
        return ret;
    } catch (error) {
        logger.error(`为 [${qq}] 设置对话配置 ${key} : ${value} 时，发生错误：${error.message}`);
        throw error;
    }
}

/**
 * 删除用户对话配置
 * @param {String} qq 用户QQ号码
 * @param {String} key key值
 * @returns {Promise<Number>} 删除结果
 */
export async function DeleteUserChatConfig(qq, key) {
    try {
        const path = `zhishui:ChatConfig:${qq.toString()}:${key}`;
        const ret = await redis.del(path);
        return ret;
    } catch (error) {
        logger.error(`删除 [${qq}] 对话配置 ${key} 时，发生错误：${error.message}`);
        throw error;
    }
}

/**
 * 获取所有用户角色配置
 * @returns {Promise<Array>} 返回用户角色配置数组
 */
export async function GetAllUserRoleConfigs() {
    try {
        const pattern = `zhishui:ChatConfig:*:RoleIndex`;
        const keys = await redis.keys(pattern);
        
        if (!keys || keys.length === 0) {
            return [];
        }

        const results = [];
        for (const key of keys) {
            const match = key.match(/zhishui:ChatConfig:(\d+):RoleIndex/);
            if (match) {
                const qq = match[1];
                const roleIndex = await redis.get(key);
                if (roleIndex !== null && roleIndex !== undefined) {
                    const parsedIndex = JSON.parse(roleIndex);
                    results.push({
                        qq: qq,
                        roleIndex: parsedIndex
                    });
                }
            }
        }

        return results;
    } catch (error) {
        logger.error(`获取所有用户角色配置时发生错误：${error.message}`);
        throw error;
    }
}

/**
 * 获取所有用户个人资源站配置
 * @returns {Promise<Array>} 返回用户个人资源站配置数组
 */
export async function GetAllUserResourceConfigs() {
    try {
        const pattern = `zhishui:SearchVideos:*:idx`;
        const keys = await redis.keys(pattern);
        
        if (!keys || keys.length === 0) {
            return [];
        }

        const results = [];
        for (const key of keys) {
            const match = key.match(/zhishui:SearchVideos:(\d+):idx/);
            if (match) {
                const qq = match[1];
                const resourceIndex = await redis.get(key);
                if (resourceIndex !== null && resourceIndex !== undefined) {
                    results.push({
                        qq: qq,
                        resourceIndex: parseInt(resourceIndex)
                    });
                }
            }
        }

        return results;
    } catch (error) {
        logger.error(`获取所有用户个人资源站配置时发生错误：${error.message}`);
        throw error;
    }
}
