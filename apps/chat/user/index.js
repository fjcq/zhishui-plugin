/**
 * 用户模块入口
 * 导出所有用户相关功能
 */

export {
    getUserFavor,
    setUserFavor,
    addFavorHistory,
    getFavorHistory,
    clearAllFavor,
    getFavorRank,
    getFavorTotalCount
} from './favorManager.js';

export { checkRateLimit, clearRateLimit } from './rateLimiter.js';

export {
    getUserData,
    setUserNickname,
    updateLastChatTime,
    incrementChatCount,
    addAchievement,
    getUserAchievements
} from './userData.js';
