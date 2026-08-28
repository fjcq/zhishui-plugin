/**
 * API处理器入口（新架构版）
 * openAi转发至core/chatClient统一编排层；
 * 图片/请求工具转发至旧requestUtils（新messageBuilder仍复用，阶段6统一收编）
 */

export { chat as openAi, chat } from './core/chatClient.js';
export { getValidUserId, buildUserMessageContent, downloadImageAsBase64 } from './api/utils/requestUtils.js';
