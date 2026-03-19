/**
 * 处理器模块索引
 * 统一导出所有处理器
 */

export { handleChat, handleResetChat } from './chatHandler.js';
export { handleSetVoiceEnable, handleSetVoiceId, handleShowVoiceId, handleSetAtEnable } from './voiceHandler.js';
export { handleShowFavor, handleSetUserFavor, handleShowFavorRank, handleShowFavorHistory, handleClearAllFavor } from './favorHandler.js';
export { handleSetApi, handleSwitchApi, handleShowApi } from './apiHandler.js';
export { handleShowContext, handleShowRoleList, handleSwitchRole, handleAddRole } from './roleHandler.js';
export { handleShowChatHistory, handleResetUserConfig, handleShowUserConfig, handleShowOtherUserConfig, handleResetOtherUserConfig, handleShowUserConfigStats, handleSetPrivateChatEnable } from './userConfigHandler.js';
export { handleSetContext, handleSetChatScene, handleShowChatScene, handleSetMaster, handleSetProxy, handleSetLinkMode, handleTalkTest, handleShowRawResponse } from './settingsHandler.js';
