import fs from 'fs';
import path from 'path';
import { Plugin_Path, Config } from '../../components/index.js';

/** 缓存目录 */
export const CACHE_PATH = path.join(Plugin_Path, 'resources', 'Cache', 'Chat');
/** 聊天上下文文件夹 */
export const CHAT_CONTEXT_PATH = path.join(Plugin_Path, 'resources', 'Cache', 'ChatContext');
if (!fs.existsSync(CHAT_CONTEXT_PATH)) fs.mkdirSync(CHAT_CONTEXT_PATH, { recursive: true });

/** 工作状态（每群/私聊独立） */
export let chatActiveMap = {};

/** 最后请求时间记录（防止429错误） */
export let lastRequestTime = {};

/** 消息计数器 */
export let chatMessageCounter = 0;

/** 最小请求间隔（毫秒），防止429错误 */
export const MIN_REQUEST_INTERVAL = 2000; // 2秒间隔

/** 不同API类型的请求间隔配置 */
export const API_INTERVALS = {
    'openai': 1000,    // OpenAI系列 1秒
    'gemini': 2000,    // Gemini 2秒
    'siliconflow': 1500, // 硅基流动 1.5秒
    'tencent': 1000,   // 腾讯元器 1秒
    'default': 2000    // 默认 2秒
};

/** 对话昵称 */
export let chatNickname;

/** 初始化对话昵称 */
export async function initChatNickname() {
    chatNickname = await Config.Chat.NickName;
}

// 初始化对话昵称
initChatNickname();
