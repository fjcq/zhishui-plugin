/**
 * 好感度管理模块
 * 处理用户好感度的存储和读取
 */

const logger = global.logger || console;

/**
 * 获取用户好感度
 * @param {string} userId - 用户ID
 * @returns {Promise<number>} 好感度值，默认0
 */
export async function getUserFavor(userId) {
    try {
        const normalizedUserId = String(userId);
        const key = `zhishui:chat:favor:${normalizedUserId}`;
        const value = await redis.get(key);
        return value ? parseInt(value) : 0;
    } catch (error) {
        logger.error(`获取用户好感度失败: ${error.message}`);
        return 0;
    }
}

/**
 * 设置用户好感度
 * @param {string} userId - 用户ID
 * @param {number} favor - 好感度值
 * @param {string} reason - 变化原因（可选）
 * @param {string} operator - 操作人（可选，默认AI）
 * @returns {Promise<boolean>} 是否设置成功
 */
export async function setUserFavor(userId, favor, reason = '', operator = 'AI') {
    try {
        const normalizedUserId = String(userId);
        const key = `zhishui:chat:favor:${normalizedUserId}`;
        const clampedFavor = Math.max(-100, Math.min(100, favor));

        const favorBefore = await getUserFavor(normalizedUserId);

        await redis.set(key, String(clampedFavor));

        logger.info(`[好感度] 设置用户 ${normalizedUserId} 好感度为 ${clampedFavor}`);

        if (favorBefore !== clampedFavor) {
            const finalReason = reason || '未说明';
            await addFavorHistory(normalizedUserId, clampedFavor - favorBefore, finalReason, favorBefore, clampedFavor, operator);
        }

        return true;
    } catch (error) {
        logger.error(`设置用户好感度失败: ${error.message}`);
        return false;
    }
}

/**
 * 添加好感度变化历史
 * @param {string} userId - 用户ID
 * @param {number} change - 变化值
 * @param {string} reason - 变化原因
 * @param {number} favorBefore - 变化前好感度
 * @param {number} favorAfter - 变化后好感度
 * @param {string} operator - 操作人（AI/管理员/主人）
 * @returns {Promise<boolean>} 是否添加成功
 */
export async function addFavorHistory(userId, change, reason, favorBefore, favorAfter, operator = 'AI') {
    try {
        const normalizedUserId = String(userId);
        if (typeof redis.lpush !== 'function') {
            const key = `zhishui:chat:history:${normalizedUserId}`;
            let history = [];

            const existing = await redis.get(key);
            if (existing) {
                try {
                    history = JSON.parse(existing);
                    if (!Array.isArray(history)) {
                        history = [];
                    }
                } catch (e) {
                    history = [];
                }
            }

            const record = {
                time: Date.now(),
                change,
                reason,
                favorBefore,
                favorAfter,
                operator
            };
            history.unshift(record);

            if (history.length > 100) {
                history = history.slice(0, 100);
            }

            await redis.set(key, JSON.stringify(history), { EX: 86400 * 180 });
            return true;
        }

        const key = `zhishui:chat:history:${normalizedUserId}`;
        const record = {
            time: Date.now(),
            change,
            reason,
            favorBefore,
            favorAfter,
            operator
        };

        await redis.lpush(key, JSON.stringify(record));
        await redis.ltrim(key, 0, 99);
        await redis.expire(key, 86400 * 180);

        return true;
    } catch (error) {
        logger.error(`添加好感度历史失败: ${error.message}`);
        return false;
    }
}

/**
 * 获取好感度历史记录
 * @param {string} userId - 用户ID
 * @param {number} limit - 返回记录数量，默认10条
 * @returns {Promise<Array>} 历史记录数组
 */
export async function getFavorHistory(userId, limit = 10) {
    try {
        const normalizedUserId = String(userId);
        const key = `zhishui:chat:history:${normalizedUserId}`;

        if (typeof redis.lrange !== 'function') {
            const existing = await redis.get(key);
            if (!existing) {
                return [];
            }

            try {
                const history = JSON.parse(existing);
                if (!Array.isArray(history)) {
                    return [];
                }
                return history.slice(0, limit);
            } catch (e) {
                return [];
            }
        }

        const records = await redis.lrange(key, 0, limit - 1);
        return records.map(record => JSON.parse(record));
    } catch (error) {
        logger.error(`获取好感度历史失败: ${error.message}`);
        return [];
    }
}

/**
 * 清空好感度数据
 * @param {Set<string>} [userFilter] - 可选，用户ID集合用于筛选。不传则清空所有
 * @returns {Promise<Object>} 清空结果 {success: boolean, count: number, message: string}
 */
export async function clearAllFavor(userFilter = null) {
    try {
        let totalDeleted = 0;

        const pattern = 'zhishui:chat:favor:*';
        const keys = await redis.keys(pattern);

        logger.info(`[好感度] 清空操作 - 筛选条件: ${userFilter ? `Set(${userFilter.size}人)` : '无'}, 找到键: ${keys ? keys.length : 0}个`);

        if (keys && keys.length > 0) {
            const keysToDelete = [];

            for (const key of keys) {
                const userId = key.split(':').pop();

                if (userFilter && !userFilter.has(userId)) {
                    continue;
                }

                keysToDelete.push(key);
            }

            logger.info(`[好感度] 待删除键数量: ${keysToDelete.length}`);

            if (keysToDelete.length > 0) {
                const BATCH_SIZE = 100;

                for (let i = 0; i < keysToDelete.length; i += BATCH_SIZE) {
                    const batch = keysToDelete.slice(i, i + BATCH_SIZE);

                    try {
                        if (typeof redis.unlink === 'function') {
                            const deleted = await redis.unlink(...batch);
                            totalDeleted += deleted || batch.length;
                        } else if (typeof redis.del === 'function') {
                            const deleted = await redis.del(...batch);
                            totalDeleted += deleted || batch.length;
                        } else {
                            for (const key of batch) {
                                const result = await redis.del(key);
                                if (result) totalDeleted++;
                            }
                        }
                    } catch (batchError) {
                        logger.warn(`[好感度] 批量删除失败，降级为逐个删除: ${batchError.message}`);
                        for (const key of batch) {
                            try {
                                const result = await redis.del(key);
                                if (result) totalDeleted++;
                            } catch (e) {
                                logger.warn(`[好感度] 删除键失败: ${key}`);
                            }
                        }
                    }
                }
            }
        }

        logger.info(`[好感度] 已清空好感度数据，共删除 ${totalDeleted} 条记录`);

        return {
            success: true,
            count: totalDeleted,
            message: `已成功清空好感度数据，共删除 ${totalDeleted} 条记录`
        };
    } catch (error) {
        logger.error(`清空好感度失败: ${error.message}`);
        return {
            success: false,
            count: 0,
            message: `清空好感度失败: ${error.message}`
        };
    }
}

/**
 * 获取好感度排名
 * @param {Set<string>} [userFilter] - 可选，用户ID集合用于筛选。不传则返回所有用户
 * @param {number} [limit=10] - 返回排名数量，默认10
 * @returns {Promise<Array>} 排名数组 [{userId, favor, rank}]
 */
export async function getFavorRank(userFilter = null, limit = 10) {
    try {
        const favorMap = new Map();

        const pattern = 'zhishui:chat:favor:*';
        const keys = await redis.keys(pattern);

        logger.info(`[好感度排名] 查询键模式: ${pattern}, 找到 ${keys ? keys.length : 0} 个键, 筛选条件: ${userFilter ? `Set(${userFilter.size}人)` : '无'}`);

        if (keys && keys.length > 0) {
            let filteredCount = 0;
            for (const key of keys) {
                const userId = key.split(':').pop();

                if (userFilter && !userFilter.has(userId)) {
                    filteredCount++;
                    continue;
                }

                const value = await redis.get(key);
                if (value !== null && value !== undefined) {
                    favorMap.set(userId, parseInt(value));
                }
            }
            if (userFilter && filteredCount > 0) {
                logger.info(`[好感度排名] 被筛选排除的用户数: ${filteredCount}`);
            }
        }

        logger.info(`[好感度排名] 符合条件的用户数: ${favorMap.size}`);

        const sorted = [...favorMap.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([userId, favor], index) => ({
                userId,
                favor,
                rank: index + 1
            }));

        return sorted;
    } catch (error) {
        logger.error(`获取好感度排名失败: ${error.message}`);
        return [];
    }
}

/**
 * 获取好感度总记录数
 * @returns {Promise<number>} 总记录数
 */
export async function getFavorTotalCount() {
    try {
        const pattern = 'zhishui:chat:favor:*';
        const keys = await redis.keys(pattern);
        return keys ? keys.length : 0;
    } catch (error) {
        logger.error(`获取好感度总数失败: ${error.message}`);
        return 0;
    }
}
