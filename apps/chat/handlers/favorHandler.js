/**
 * 好感度管理处理模块
 * 处理好感度相关的命令
 */

import { getUserFavor, setUserFavor, getFavorRank, getFavorTotalCount, getFavorHistory, clearAllFavor } from '../user/index.js';
import { puppeteer } from '../../../model/index.js';

/**
 * 查看用户好感度
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleShowFavor(e) {
    let isAdmin = e.isMaster || e.isAdmin;
    let atUser = null;

    if (e.at && e.at.length > 0) {
        atUser = e.at[0];
    }
    let targetId = atUser || e.user_id;

    if (atUser && !isAdmin) {
        e.reply('只有主人或管理员可以查看他人好感度。');
        return;
    }

    const favor = await getUserFavor(targetId);
    if (atUser) {
        e.reply(`用户 [${atUser}] 的好感度为：${favor}`);
    } else {
        e.reply(`你的好感度为：${favor}`);
    }
}

/**
 * 设置好感度
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleSetUserFavor(e) {
    let isAdmin = e.isMaster || e.isAdmin;
    if (!isAdmin) {
        e.reply('只有主人或管理员可以设置好感度。');
        return;
    }

    let targetId = null;
    let favor = null;

    if (e.at && e.at.length > 0) {
        targetId = String(e.at[0]);
        const numbers = e.msg.match(/(-?\d+)/g);
        if (!numbers || numbers.length === 0) {
            e.reply('请指定好感度数值，例如：#设置好感度 @某人 50');
            return;
        }
        favor = parseInt(numbers[numbers.length - 1]);
    } else {
        const numbers = e.msg.match(/(-?\d+)/g);
        if (!numbers || numbers.length === 0) {
            e.reply('请指定好感度数值，例如：\n#设置好感度 50（设置自己）\n#设置好感度 12345678 50（设置指定用户）\n#设置好感度 @某人 50（艾特设置）');
            return;
        }

        if (numbers.length >= 2) {
            const firstNum = numbers[0];
            const secondNum = numbers[1];

            const isFirstQQ = firstNum.length >= 5 && firstNum.length <= 11 &&
                parseInt(firstNum) > 100;

            if (isFirstQQ) {
                targetId = firstNum;
                favor = parseInt(secondNum);
            } else {
                e.reply(`参数格式错误。QQ号应为5-11位数字。\n正确格式：\n#设置好感度 50（设置自己）\n#设置好感度 12345678 50（设置指定用户）`);
                return;
            }
        } else {
            targetId = e.user_id;
            favor = parseInt(numbers[0]);
        }
    }

    if (isNaN(favor)) {
        e.reply('好感度数值无效。');
        return;
    }

    favor = Math.max(-100, Math.min(100, favor));

    const operator = e.isMaster ? '主人' : '管理员';

    let reason = '';
    const reasonMatch = e.msg.match(/设置好感度\s+(?:\d{5,11}\s+)?-?\d{1,3}\s*(.*)/);
    if (reasonMatch && reasonMatch[1] && reasonMatch[1].trim()) {
        reason = reasonMatch[1].trim();
    }

    if (!reason) {
        reason = `${operator}手动设置`;
    }

    await setUserFavor(targetId, favor, reason, operator);

    if (targetId !== e.user_id) {
        e.reply(`已将 [${targetId}] 的好感度设置为：${favor} (原因: ${reason})`);
    } else {
        e.reply(`已将你的好感度设置为：${favor} (原因: ${reason})`);
    }
}

/**
 * 查看好感度排名
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleShowFavorRank(e) {
    if (!e.group_id && !e.isMaster) {
        e.reply('私聊查看好感度排名仅限主人使用。');
        return;
    }

    let userFilter = null;
    let title = '好感度排名';
    let subtitle = '止水插件';

    if (e.group_id) {
        title = `本群${title}`;
        try {
            const groupInfo = await e.bot?.pickGroup?.(e.group_id)?.getInfo?.() ||
                await e.group?.getInfo?.();
            if (groupInfo) {
                subtitle = `${groupInfo.group_name || groupInfo.name || '未知群'} (${e.group_id})`;
            } else {
                subtitle = `群号: ${e.group_id}`;
            }

            const memberList = await e.bot?.pickGroup?.(e.group_id)?.getMemberList?.() ||
                await e.group?.getMemberList?.();
            if (memberList && memberList.length > 0) {
                userFilter = new Set();
                memberList.forEach(m => {
                    const uid = String(m.user_id || m.userId || m.info?.user_id || m.info?.userId || m.id || m);
                    userFilter.add(uid);
                });
                logger.info(`[好感度排名] 获取群成员列表成功，共 ${userFilter.size} 人`);
            } else {
                logger.warn(`[好感度排名] 获取群成员列表为空`);
            }
        } catch (err) {
            logger.error(`获取群成员列表失败: ${err.message}`);
            e.reply('获取群成员列表失败，请稍后重试。');
            return;
        }
    }

    const rankList = await getFavorRank(userFilter, 10);

    for (const item of rankList) {
        if (e.group_id) {
            try {
                const memberInfo = await e.bot?.pickMember?.(e.group_id, item.userId)?.getInfo?.() ||
                    await e.group?.pickMember?.(item.userId)?.getInfo?.();
                if (memberInfo) {
                    item.nickname = memberInfo.card || memberInfo.nickname || memberInfo.nick || null;
                }
            } catch (err) {
            }
        }
    }

    const totalCount = userFilter ? rankList.length : await getFavorTotalCount();

    await puppeteer.render('chat/favor_rank', {
        title,
        subtitle,
        rankList,
        totalCount
    }, {
        e,
        scale: 1.4
    });
}

/**
 * 查看好感度变化历史
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleShowFavorHistory(e) {
    let targetUserId = String(e.user_id);

    if (e.isMaster) {
        if (e.at) {
            targetUserId = Array.isArray(e.at) ? String(e.at[0]) : String(e.at);
        } else {
            const idMatch = e.msg.match(/查看(?:好感|亲密)度历史\s*(\d+)/);
            if (idMatch && idMatch[1]) {
                targetUserId = idMatch[1];
            }
        }
    }

    let nickname = null;
    try {
        if (e.group_id) {
            const memberInfo = await e.bot?.pickMember?.(e.group_id, targetUserId)?.getInfo?.() ||
                await e.group?.pickMember?.(targetUserId)?.getInfo?.();
            if (memberInfo) {
                nickname = memberInfo.card || memberInfo.nickname || memberInfo.nick || null;
            }
        }
        if (!nickname) {
            const userInfo = await e.bot?.pickUser?.(targetUserId)?.getInfo?.() ||
                await e.bot?.getStrangerInfo?.(targetUserId);
            if (userInfo) {
                nickname = userInfo.nickname || userInfo.nick || null;
            }
        }
    } catch (err) {
    }

    const avatarUrl = `https://q1.qlogo.cn/g?b=qq&nk=${targetUserId}&s=100`;

    const history = await getFavorHistory(targetUserId, 20);

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        return `${month}-${day} ${hour}:${minute}`;
    };

    const historyList = [];
    if (history && history.length > 0) {
        for (const record of history) {
            historyList.push({
                time: formatTime(record.time),
                change: record.change,
                favorBefore: record.favorBefore,
                favorAfter: record.favorAfter,
                operator: record.operator || 'AI',
                reason: record.reason || '未说明'
            });
        }
    }

    const isSelf = String(targetUserId) === String(e.user_id);

    await puppeteer.render('chat/favor_history', {
        userId: targetUserId,
        nickname: nickname || '未知用户',
        avatarUrl: avatarUrl,
        isSelf: isSelf,
        historyList: historyList
    }, {
        e,
        scale: 1.4
    });
}

/**
 * 清空好感度
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function handleClearAllFavor(e) {
    if (!e.isMaster) {
        e.reply('只有主人可以清空好感度。');
        return;
    }

    let userFilter = null;
    let targetDesc = '所有';

    if (e.group_id) {
        targetDesc = '本群成员';
        try {
            const memberList = await e.bot?.pickGroup?.(e.group_id)?.getMemberList?.() ||
                await e.group?.getMemberList?.();
            if (memberList && memberList.length > 0) {
                userFilter = new Set();
                memberList.forEach(m => {
                    const uid = String(m.user_id || m.userId || m.info?.user_id || m.info?.userId || m.id || m);
                    userFilter.add(uid);
                });
            }
        } catch (err) {
            logger.error(`获取群成员列表失败: ${err.message}`);
            e.reply('获取群成员列表失败，请稍后重试。');
            return;
        }
    }

    const result = await clearAllFavor(userFilter);
    e.reply(`已清空${targetDesc}的好感度数据，共删除 ${result.count} 条记录。`);
}
