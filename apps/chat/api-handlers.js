/**
 * API处理器入口
 * 导出openAi主函数及相关工具
 */

export { openAi, default } from './api/index.js';
export { getValidUserId, buildHeaders, getDefaultParams, buildUserMessageContent, addToolCallingConfig, addJsonFormatConfig, downloadImageAsBase64 } from './api/utils/requestUtils.js';
export { buildTencentRequest } from './api/builders/tencentBuilder.js';
export { buildGeminiRequest } from './api/builders/geminiBuilder.js';
export { buildQwenVLRequest } from './api/builders/qwenVLBuilder.js';
export { buildStandardRequest } from './api/builders/standardBuilder.js';
export { handleApiResponse } from './api/handlers/responseHandler.js';
export { handleCommunicationError } from './api/handlers/errorHandler.js';
