/**
 * Schema模块索引
 * 8个标签页：对话/模型接口/角色/工具/搜剧/生图/入群验证/系统设置
 */

// 对话模块
export { getChatBasicSchemas } from './chatSchema.js';
export { getApiSchemas } from './apiSchema.js';
export { getRoleSchemas } from './roleSchema.js';

// 搜剧模块
export { getVideoSearchSchemas } from './videoSearchSchema.js';

// 入群验证模块
export { getGroupVerifySchemas } from './groupVerifySchema.js';

// 系统设置模块（聚合网络/语音/音乐API/权限）
export { getSystemSchemas } from './systemSchema.js';

// 工具开关
export { getToolSwitchSchemas } from './toolSwitchSchema.js';

// AI 生图设置
export { getImageGenSchemas } from './imageGenSchema.js';
