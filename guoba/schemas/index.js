/**
 * Schema模块索引
 * 精简分组，减少分页数量
 */

// 对话模块
export { getChatBasicSchemas, getChatAdvancedSchemas, getProxySchemas } from './chatSchema.js';
export { getRoleSchemas, getRoleListSchema, getCopyRoleSchema } from './roleSchema.js';
export { getApiSchemas } from './apiSchema.js';

// 搜剧模块
export { getVideoSearchSchemas } from './videoSearchSchema.js';

// 系统设置模块
export { getSystemSchemas, getNetworkSchemas, getPermissionSchemas } from './systemSchema.js';

// 工具开关
export { getToolSwitchSchemas } from './toolSwitchSchema.js';

// 兼容旧API
export { getVoiceSchemas } from './voiceSchema.js';
