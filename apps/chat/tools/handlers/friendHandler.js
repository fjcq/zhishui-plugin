/**
 * 好友管理工具处理函数
 * 处理AI调用的好友相关工具
 */

/**
 * 处理好友工具调用
 * @param {string} toolName - 工具名称
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象（用于访问Bot API）
 * @returns {Promise<object>} 工具执行结果
 */
export async function handleFriendToolCall(toolName, params, e) {
    try {
        switch (toolName) {
            case 'get_friend_list':
                return await handleGetFriendList(params, e);
            case 'get_friend_info':
                return await handleGetFriendInfo(params, e);
            default:
                return { error: true, message: `未知的好友工具: ${toolName}` };
        }
    } catch (error) {
        logger.error(`[好友工具] ${toolName} 执行失败: ${error.message}`);
        return { error: true, message: `操作失败: ${error.message}` };
    }
}

/**
 * 处理获取好友列表
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象
 * @returns {Promise<object>} 执行结果
 */
async function handleGetFriendList(params, e) {
    if (!e || !e.bot) {
        return { error: true, message: '无法访问好友列表：缺少Bot实例' };
    }

    try {
        let friendList = [];

        // 方式1: 使用 bot.fl Map 获取完整好友信息（推荐）
        if (e.bot.fl instanceof Map && e.bot.fl.size > 0) {
            for (const [userId, friendInfo] of e.bot.fl) {
                friendList.push({
                    user_id: String(userId),
                    nickname: friendInfo.nickname || friendInfo.nick || '未知',
                    remark: friendInfo.remark || friendInfo.remarkName || null
                });
            }
        }
        // 方式2: 使用 getFriendArray 获取好友数组
        else if (typeof e.bot.getFriendArray === 'function') {
            const friendArray = await e.bot.getFriendArray();
            if (Array.isArray(friendArray)) {
                friendList = friendArray.map(friend => ({
                    user_id: String(friend.user_id || friend.userId),
                    nickname: friend.nickname || friend.nick || '未知',
                    remark: friend.remark || friend.remarkName || null
                }));
            }
        }
        // 方式3: getFriendList 返回 user_id 数组，需要逐个获取信息
        else if (typeof e.bot.getFriendList === 'function') {
            const userIds = await e.bot.getFriendList();
            if (Array.isArray(userIds)) {
                for (const userId of userIds) {
                    // 尝试从 fl Map 获取详细信息
                    const friendInfo = e.bot.fl?.get?.(userId);
                    friendList.push({
                        user_id: String(userId),
                        nickname: friendInfo?.nickname || friendInfo?.nick || '未知',
                        remark: friendInfo?.remark || friendInfo?.remarkName || null
                    });
                }
            }
        }

        if (friendList.length === 0) {
            return {
                success: true,
                friend_count: 0,
                friends: [],
                message: '好友列表为空或无法获取'
            };
        }

        logger.info(`[好友工具] 获取好友列表 | 数量:${friendList.length}`);

        return {
            success: true,
            friend_count: friendList.length,
            friends: friendList,
            message: `共有 ${friendList.length} 位好友`
        };
    } catch (error) {
        logger.error(`[好友工具] 获取好友列表失败: ${error.message}`);
        return { error: true, message: `获取好友列表失败: ${error.message}` };
    }
}

/**
 * 处理获取好友详细信息
 * @param {object} params - 工具参数
 * @param {object} e - 事件对象
 * @returns {Promise<object>} 执行结果
 */
async function handleGetFriendInfo(params, e) {
    const { user_id } = params;

    if (!user_id) {
        return { error: true, message: '缺少用户ID参数' };
    }

    if (!e || !e.bot) {
        return { error: true, message: '无法访问好友信息：缺少Bot实例' };
    }

    try {
        const friend = e.bot.pickFriend?.(user_id);

        if (!friend) {
            return { error: true, message: `用户 ${user_id} 不是好友` };
        }

        const friendInfo = await friend.getInfo?.();

        const result = {
            success: true,
            user_id: String(user_id),
            nickname: friendInfo?.nickname || friendInfo?.nick || friend.nickname || '未知',
            remark: friendInfo?.remark || friend.remark || null,
            sign: friendInfo?.sign || friendInfo?.signature || null,
            age: friendInfo?.age || null,
            sex: friendInfo?.sex || friendInfo?.gender || null,
            level: friendInfo?.level || null,
            avatar_url: `https://q1.qlogo.cn/g?b=qq&nk=${user_id}&s=640`,
            message: `好友 ${user_id} 的信息获取成功`
        };

        logger.info(`[好友工具] 获取好友信息 | 用户:${user_id} | 昵称:${result.nickname}`);

        return result;
    } catch (error) {
        logger.error(`[好友工具] 获取好友信息失败: ${error.message}`);
        return { error: true, message: `获取好友信息失败: ${error.message}` };
    }
}
