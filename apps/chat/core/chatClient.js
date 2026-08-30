/**
 * 统一调用编排层（新架构版）
 * 替代旧api/index.js的openAi主函数：
 * 模型解析（manager）→ provider创建 → 参数裁剪 → 消息组装（messageBuilder）
 * → provider.chat → 工具循环（toolLoop）→ 错误归一与主人通知。
 *
 * 对外签名与旧openAi保持一致（msg, e, systemMessage, chatMsg, recursionDepth），
 * 便于业务层（chatHandler）在阶段4平滑切换。
 */

import { Config, logger } from '../../../components/index.js';
import { resolveModel } from '../configs/manager.js';
import { createProvider } from '../providers/index.js';
import { buildMessages } from './messageBuilder.js';
import { executeToolLoop, MAX_TOOL_DEPTH } from './toolLoop.js';
import { getEnabledTools } from '../tools/index.js';
import { buildUserMessageContent } from '../api/utils/requestUtils.js';
import { sanitizeModelOutput, extractPlainTextFromJson } from '../api/utils/requestUtils.js';
import { addMessage } from '../session.js';

/** 默认请求参数（与旧getDefaultParams语义一致） */
const DEFAULT_PARAMS = {
    temperature: 0.7,
    top_p: 0.95,
    max_tokens: 2048,
    presence_penalty: 0.2,
    frequency_penalty: 0.3
};

/** 主人通知冷却时间（秒），同类错误每冷却期最多通知一次 */
const NOTIFICATION_COOLDOWN_SECONDS = 12 * 60 * 60;

/** 内存级通知记录（Redis不可用时的降级方案） */
const memoryNotified = new Map();

/**
 * 判断模型是否支持思维链（基于模型名关键词）
 * @param {string} modelName - 模型名
 * @returns {boolean} 是否支持
 */
export function isThinkingModel(modelName) {
    const lower = (modelName || '').toLowerCase();
    if (lower.includes('deepseek')) return true;
    if (/\bo[134]-/.test(lower) || lower.includes('o1-mini') || lower.includes('o1-preview')) return true;
    if (lower.includes('qwq')) return true;
    if (lower.includes('qwen3') || lower.includes('qwen-3')) return true;
    if (lower.includes('claude') && (lower.includes('extended') || lower.includes('thinking'))) return true;
    if (lower.includes('glm-z1') || lower.includes('glmz1')) return true;
    return false;
}

/**
 * 当模型返回空 tool_calls 时，检测"用户明确要画图 + AI 嘴上说要开始画/在画了 +
 * AI没宣称画完"的场景，手动合成一条 generate_image 工具调用。
 *
 * 触发事故：2026-08-31 03:20:48，AI说"开始绘制"但tool_calls空数组，用户等待30秒
 * 以为画不出来，实际上模型根本没调工具。
 *
 * 提示词提取优先级：
 *   1) AI回复中「…」或 "..." 包裹的提示词段落（模型常写：「提示词」开始绘制）
 *   2) 用户消息：去掉"小七/帮我/给我/能不能/画一张/画图/生图/画一幅/来张"等前缀，保留核心描述
 *   3) 兜底使用AI回复中被承诺的整段文字作为prompt（可能不优，但总比"画不出来"强）
 *
 * @param {Object} opts
 * @param {string} opts.userText - 用户原始消息（可能是多模态对象，此处调用方已转字符串）
 * @param {string} opts.assistantText - 模型返回的纯文本回复
 * @param {Array}  opts.tools - 当前可用工具 schema（用于确认 generate_image 是否注册，以及必填参数名）
 * @returns {{prefix:string, cleanAssistantText:string, toolCall:Object}|null}
 */
function synthesizeImageToolCallIfNeeded({ userText, assistantText, tools }) {
    const user = typeof userText === 'string' ? userText : '';
    const asst = typeof assistantText === 'string' ? assistantText : '';
    const combined = `${user}\n${asst}`;

    // (1) 必须存在 generate_image 工具，否则合成了也执行不了
    const imgTool = Array.isArray(tools) && tools.find(t =>
        t?.type === 'function' && t.function?.name === 'generate_image');
    if (!imgTool) return null;

    // (2) 用户或AI必须命中画图意图关键词（任意一个满足就够）
    // 说明：此兜底逻辑面向"模型嘴上说了要画但没调工具"的事故，
    //       正则覆盖口语表达（画XX/帮我画/画图/生图/绘XX/出图/来张图等），
    //       避免正则太窄导致有意图但不触发。
    const INTENT_RE = /(小[七7]|我|帮我|给我|能不能|可以|麻烦)[，,。.\s]*(画[一1张副幅份]?|画图|生图|出图|来张图|绘制|作[一1]?幅?画|画(?:个|点|点啥|什么)|整[一1]?张图)/;
    const INTENT_RE_2 = /(画|绘|出|来)[一1张副幅]?(?:这|那|什么|啥|个|张|点|下)?(?:图|画|照片|插画|画面|头像|壁纸|海报|插画)/;
    const INTENT_RE_3 = /(七|你|小[七7]).*(出图|产图|来(?:一?张)?图|生成(?:图片|图像|插画|画作)|帮.*画|画.*给我)/;
    const INTENT_RE_4 = /(生图|画图|出图|来张图|整[一1]?张图)[!！?？。.\s]*(我|我|大人)?/;
    const hasIntent = INTENT_RE.test(combined) || INTENT_RE_2.test(combined) || INTENT_RE_3.test(combined) || INTENT_RE_4.test(combined);
    if (!hasIntent) return null;

    // (3) AI 不能已经宣称"画好了/画完了/出图了"（这些场景说明工具已经执行过）
    const DONE_RE = /画(?:好(?:了|啦)|完(?:了|毕)|出(?:了|现)|做(?:好|完)了|生成(?:了|成功)|已(?:经)?(?:画|发)(?:好|完)?了?)/;
    if (DONE_RE.test(asst)) return null;

    // (4) AI 必须有"承诺/准备去做"的语气词（或用户消息虽然直接，但AI没拒绝它），
    //     若AI明确拒绝（"本小七不画画/画不出来/罢工了/拒绝"），不能强行走兜底（会反复）。
    const REFUSE_RE = /(不(?:会|能|行|要|给你).*画|(?:画|绘图|模块).*(?:罢工|画不出|画不出来|不工作|坏了|不行|失败|维护)|拒(?:绝|不画))/;
    const PROMISE_RE = /(开始|立刻|马上|这就|正在|努力|准备|给你|给大人|好嘞|收到|明白|了解|遵命|OK|一定|一定能)[，,。!\s~]*(?:画|绘制|生图|出图|开始|弄|生成)/;
    // 注意：LOOKS_LIKE_PROMPT_DESC_RE 必须是正则对象而不是立即 test() 的布尔结果，
    // 否则下面 looksPromising / 调用方引用时会报 "xxx.test is not a function"。
    const LOOKS_LIKE_PROMPT_DESC_RE = /[「"]([^"」]{10,})["」]|[:：][\s\S]{15,}/;
    if (REFUSE_RE.test(asst)) return null;

    // 先算一次"是否已有明确承诺"，供后面的 AI 纯附和短路判断使用
    let looksPromising = PROMISE_RE.test(asst) || LOOKS_LIKE_PROMPT_DESC_RE.test(asst);

    // (4) 防误触：用户消息可能是在讨论"画图这个功能"本身而非发出画图请求，
    //     或 AI 只是附和闲聊未给出任何行动信号。
    // 负向关键词清单：画图【功能/怎么/好用/如何/厉害/真不错/多少钱/啥原理/这个】—— 这些语境下用户没在要图。
    const DISCUSS_RE = /(生图|画图|出图|来张图|绘?图?|画[图]?(?:个|张)?)[的了是也都就还很真]*(?:功能|怎(?:么|样)|如何|好用|厉害|不错|对吗|呢|嘛|啊|哦|这个|那个|啥|原理|收费|多少(?:钱)?|是什么|算什么|感觉|真的)/;
    if (DISCUSS_RE.test(user)) return null;

    // AI 纯附和判断：只有在"用户没给出具体画什么内容" + "AI 只有简单附和"时才跳过兜底。
    // 如果用户已经明确给出"画机械少女/画一只猫"等实质内容（strippedForGate ≥ 5 字），
    // AI 即便只回"OK！""收到~""行！"也算积极回应，不能跳过兜底（否则 S8 事故）。
    const userPure = user.trim().replace(/^[@\s]+小[七7][，,。.\s]*/, '').trim();
    const strippedForGateAI = userPure
        .replace(/^(帮我|给我|麻烦|可以|能不能|请|快快|赶紧|现在|马上)[，,。.\s]*/, '')
        .replace(/(画[一1张副幅份]?|画图|生图|绘制|作[一1]?幅?画|出[一1]?张?图|来[一1]?张?图|生成(?:一?张)?(?:图片|图像|插画|画作)|画(?:个|点|啥|什么)|整[一1]?张图)/g, ' ')
        .replace(/[,，。.!！?？\s]+/g, ' ')
        .trim();
    const userGaveContent = strippedForGateAI.length >= 5;
    const DISCUSS_RE_AI_ONLY = /^(是的|嗯|没错|对哦|我也觉得|哈哈|哈哈哈|确实|对哒|对呀|好的|好哒|OK|ok|行)[!！~。,\s]*$/;
    if (!looksPromising && !userGaveContent && DISCUSS_RE_AI_ONLY.test(asst.trim())) return null;
    if (!looksPromising) {
        const userSoloIntent = INTENT_RE.test(user) || INTENT_RE_2.test(user) || INTENT_RE_3.test(user) || INTENT_RE_4.test(user);
        if (userSoloIntent && userPure.length > 3) {
            // 继续看 strippedUser 去掉"画图/生图/来张图"这类词后是否还有≥5字实质内容
            const strippedForGate = userPure
                .replace(/^(帮我|给我|麻烦|可以|能不能|请|快快|赶紧|现在|马上)[，,。.\s]*/, '')
                .replace(/(画[一1张副幅份]?|画图|生图|绘制|作[一1]?幅?画|出[一1]?张?图|来[一1]?张?图|生成(?:一?张)?(?:图片|图像|插画|画作)|画(?:个|点|啥|什么)|整[一1]?张图)/g, ' ')
                .replace(/[,，。.!！?？\s]+/g, ' ')
                .trim();
            if (strippedForGate.length >= 5) looksPromising = true;
        }
    }
    if (!looksPromising) return null;

    // ---- 开始提取提示词 ----
    /** @type {string[]} */
    const candidates = [];

    // ① 「」或引号包裹的长段落
    const bracketM = asst.match(/[「"'"]([^"」']{20,})["」'"]/g);
    if (bracketM) {
        for (const b of bracketM) {
            const inner = b.slice(1, -1).trim();
            if (inner.length >= 15) candidates.push(inner);
        }
    }

    // ② 中文冒号开头的"说明段落"（换行分隔直到空行或结尾）
    const colonMatch = asst.match(/[:：]\s*\n([\s\S]{20,})/);
    if (colonMatch) candidates.push(colonMatch[1].trim());

    // ③ 去掉用户消息里的"指令前缀+画图词"，保留主体描述
    const strippedUser = userPure
        .replace(/^(帮我|给我|麻烦|可以|能不能|请|快快|赶紧|现在|马上)[，,。.\s]*/, '')
        .replace(/(画[一1张副幅份]?|画图|生图|绘制|作[一1]?幅?画|出[一1]?张?图|生成(?:一?张)?(?:图片|图像|插画|画作)|画(?:个|点|啥|什么)|整[一1]?张图)/g, ' ')
        .replace(/^(风格|主题|内容|要求|样式)[，,。.:：\s]*/g, '')
        .replace(/[,，。.!！?？\s]+/g, ' ')
        .trim();
    if (strippedUser.length >= 8) candidates.push(strippedUser);

    // ④ 如果 AI 回复比较长（>40字），直接去掉"开始绘制！"这种指令语气收尾的部分
    const asstClauses = asst
        .replace(/[。\n]+(超|真|太|好的|好嘞|收到|好啦|开始|开始绘制|一定会|请|一定|让|开始)[^\n。]{0,25}$/m, '')
        .replace(/^(喵[~呜~！!。，,\s]*|收到[！!。，,\s]*|好嘞[！!。，,\s]*)/, '')
        .trim();
    if (asstClauses.length >= 20) candidates.push(asstClauses);

    if (candidates.length === 0) return null;

    // 选最长的候选（提示词信息量越大越可能出好图），上限 600 字。
    candidates.sort((a, b) => b.length - a.length);
    let prompt = candidates[0].slice(0, 600);

    // 用 JSON.stringify 保证 arguments 合法（避免 prompt 中含引号/斜杠导致 toolLoop JSON.parse 失败）
    const style = detectStyleFromContext(user + '\n' + asst);

    // 合成 tool_call（格式要匹配 provider 的 tool_calls 结构）
    const functionArgs = style ? JSON.stringify({ prompt, style }) : JSON.stringify({ prompt });
    const toolCall = {
        id: `synthetic_${Date.now()}_img`,
        type: 'function',
        function: {
            name: 'generate_image',
            arguments: functionArgs
        }
    };

    // 清理 assistant 文本：只保留"好的！开始绘制~"这类过渡句（不包含任何具体提示词语句），
    // 避免 executeToolLoop 把它立刻发送出去后，在最终回复里又重复一遍。
    let cleanAsst = asst;
    for (const cand of candidates) {
        // 把长的具体提示词段落移除，让 toolLoop 立即发送的文本只剩承诺语
        cleanAsst = cleanAsst.split(cand).map(p => p.trim()).filter(Boolean).join('\n');
    }
    // 移除空白行过度堆积
    cleanAsst = cleanAsst.replace(/\n{3,}/g, '\n\n').trim();
    if (!cleanAsst) cleanAsst = '好的喵~本小七这就开始绘制！稍等哦~';

    const prefix = prompt.slice(0, 30);
    return { prefix, cleanAssistantText: cleanAsst, toolCall };
}

/**
 * 根据用户与AI上下文中提到的风格词，匹配已注册的 style 选项。
 * 防止兜底合成调用时 style 参数不合法被工具层拒绝。
 * 未命中时返回 undefined（由工具层自动走 defaultText2Image 默认风格）。
 * @param {string} context - 用户消息+AI回复的拼接文本
 * @returns {string|undefined}
 */
function detectStyleFromContext(context) {
    if (typeof context !== 'string') return undefined;
    const lower = context.toLowerCase();
    const PAIRS = [
        [/二次元|动漫|anime|漫画|日系|アニメ/, '<anime>'],
        [/写实|真实|realistic|摄影|照片|真人/, '<realistic>'],
        [/赛博朋克|cyberpunk|霓虹|机械/, '<cyberpunk>'],
        [/油画|油彩|painting/, '<oil_painting>'],
        [/水彩|watercolor/, '<watercolor>'],
        [/像素|pixel|8.?bit|16.?bit/, '<pixel_art>'],
        [/3D|三维|c4d|blender|渲染/, '<3d_render>'],
        [/国潮|中国风|古风|水墨|国画|chinese/, '<chinese_style>'],
        [/扁平|flat|插画|illustration|矢量|vector/, '<flat_illustration>']
    ];
    for (const [re, tag] of PAIRS) {
        if (re.test(context) || re.test(lower)) return tag;
    }
    return undefined;
}

/**
 * 获取当前角色的请求参数（人设中的"请求参数"覆盖默认值）
 * @param {Object} e - 事件对象
 * @returns {Promise<Object>} 合并后的请求参数
 */
async function getRoleParams(e) {
    let roleRequestParams = {};
    try {
        const roleJson = Config.getJsonConfig('RoleProfile');
        const roles = JSON.parse(roleJson);
        const { getCurrentRoleIndex } = await import('../configs/roleManager.js');
        const currentRoleIndex = await getCurrentRoleIndex(e);
        roleRequestParams = roles[currentRoleIndex]?.['请求参数'] || {};
    } catch (error) {
        logger.warn(`[chatClient] 获取角色请求参数失败: ${error.message}`);
    }
    return { ...DEFAULT_PARAMS, ...roleRequestParams };
}

/**
 * 生成通知记录的Redis键名
 * @param {string} providerName - provider名称
 * @param {string} errorType - 错误类型标识
 * @returns {string} Redis键名
 */
function getNotificationKey(providerName, errorType) {
    const date = new Date().toISOString().slice(0, 10);
    return `zhishui:master_notification:${errorType}:${providerName}:${date}`;
}

/**
 * 向主人发送一次性私信通知（同类错误每冷却期最多一次）
 * @param {Object} errorInfo - 统一错误 { code, message }
 * @param {string} providerName - provider名称
 * @returns {Promise<void>}
 */
async function notifyMasterOnce(errorInfo, providerName) {
    try {
        const masterQQ = await Config.Chat.MasterQQ;
        if (!masterQQ || String(masterQQ) === '10000') {
            return;
        }

        const key = getNotificationKey(providerName, errorInfo.code);
        try {
            const redisClient = globalThis.redis;
            if (redisClient?.get && await redisClient.get(key)) {
                return;
            }
        } catch {
            // Redis不可用走内存降级
        }
        if (memoryNotified.has(key)) {
            return;
        }

        const message = `⚠️ 止水插件AI服务异常通知\n` +
            `类型：${errorInfo.code}\n` +
            `Provider：${providerName}\n` +
            `错误：${errorInfo.message || '未知错误'}\n` +
            `建议：检查API账户余额或执行命令切换到其他模型。`;

        const friend = globalThis.Bot?.pickFriend?.(String(masterQQ));
        if (friend?.sendMsg) {
            await friend.sendMsg(message);
            try {
                const redisClient = globalThis.redis;
                if (redisClient?.set) {
                    await redisClient.set(key, '1', { EX: NOTIFICATION_COOLDOWN_SECONDS });
                }
            } catch {
                // 标记失败不影响通知本身
            }
            memoryNotified.set(key, true);
            logger.info(`[错误通知] 已向主人 ${masterQQ} 发送 ${errorInfo.code} 通知`);
        }
    } catch (notifyError) {
        logger.error(`[错误通知] 发送主人通知失败: ${notifyError.message}`);
    }
}

/**
 * 统一错误码 → 用户可见文案
 * @param {Object} errorInfo - 统一错误 { code, status?, message }
 * @param {string} providerType - provider格式类型
 * @returns {string} 用户可见文案
 */
function errorToUserMessage(errorInfo, providerType) {
    const apiName = String(providerType || 'AI').toUpperCase();
    switch (errorInfo.code) {
        case 'auth':
            return `【${apiName} API密钥无效】请检查配置文件中的API密钥是否正确`;
        case 'forbidden':
            return `【地区限制】当前地区无法访问${apiName} API，建议：1.使用VPN/代理 2.切换到其他模型`;
        case 'rate_limit':
            return `【请求频繁】${apiName} API请求过于频繁，请稍后重试`;
        case 'balance':
            return `【余额不足】${apiName} API账户余额或配额已用完，请：1.充值续费 2.切换到其他模型`;
        case 'model_not_found':
            return `【模型错误】${apiName} API不支持当前模型，请检查模型名称是否正确`;
        case 'network':
            return `【网络错误】无法连接${apiName} API，请检查：1.网络连接 2.API地址是否正确`;
        case 'server_error':
            return `【服务器错误】${apiName} API暂时不可用 (${errorInfo.status || ''})，请稍后重试`;
        default:
            return `【AI服务异常】${errorInfo.message || '未知错误'}，请稍后重试`;
    }
}

/**
 * 处理provider调用错误：归一错误码、生成文案、余额类通知主人，抛详细错误
 * @param {Error} err - provider抛出的原始错误
 * @param {Object} providerInstance - Provider实例（parseError）
 * @param {Object} providerConfig - provider配置
 * @returns {Promise<never>} 抛出带分类信息的错误
 */
async function handleProviderError(err, providerInstance, providerConfig) {
    let errorInfo;
    try {
        errorInfo = await Promise.resolve(providerInstance.parseError(err));
    } catch {
        errorInfo = { code: 'unknown', message: err?.message || String(err) };
    }
    logger.error(`[chatClient] 与AI通信错误 [${errorInfo.code}] ${errorInfo.message}`);

    if (errorInfo.code === 'balance') {
        await notifyMasterOnce(errorInfo, providerConfig.name);
    }

    const detailedError = new Error(errorToUserMessage(errorInfo, providerConfig.type));
    detailedError.classified = true;
    detailedError.type = errorInfo.code;
    detailedError.providerName = providerConfig.name;
    throw detailedError;
}

/**
 * 统一对话入口
 * @param {string} msg - 用户消息（JSON字符串）
 * @param {Object} e - 事件对象
 * @param {string} systemMessage - 系统消息
 * @param {Array} chatMsg - 聊天历史
 * @param {number} [recursionDepth=0] - 递归深度
 * @returns {Promise<{content: string, rawResponse: string}>} 回复内容
 */
export async function chat(msg, e, systemMessage, chatMsg, recursionDepth = 0) {
    if (recursionDepth > MAX_TOOL_DEPTH) {
        logger.error(`[chatClient] 工具调用递归深度超过限制: ${recursionDepth} > ${MAX_TOOL_DEPTH}`);
        return {
            content: JSON.stringify({ message: '工具调用过于频繁，请稍后再试', favor_changes: [] }),
            rawResponse: '{}'
        };
    }

    const resolved = await resolveModel(e);
    if (!resolved) {
        return {
            content: JSON.stringify({ message: '未配置可用的AI模型，请先在配置文件中设置providers/models', favor_changes: [] }),
            rawResponse: '{}'
        };
    }

    const { model, provider: providerConfig } = resolved;
    const provider = createProvider(providerConfig);
    const { fullUserMsg } = buildUserMessageContent(msg);

    try {
        // 思维链模式判断
        const enableThinking = await Config.Chat.EnableThinking;
        const isThinkingMode = Boolean(enableThinking) && isThinkingModel(model.model);

        // 参数：角色参数覆盖默认，thinking模式不传采样参数
        const rawParams = await getRoleParams(e);
        let params = provider.sanitizeParams(rawParams);
        if (isThinkingMode) {
            const { temperature, top_p, presence_penalty, frequency_penalty, ...rest } = params;
            params = rest;
        }

        // 消息组装（多模态注入/视觉代理降级/工具跟进轮图片回收）
        const messages = await buildMessages({
            systemMessage, chatMsg, msg, e, provider, model: model.model, modelVision: model.vision, isThinkingMode
        });

        // 工具注入（provider支持且非thinking模式）
        const tools = provider.supportsTools() && !isThinkingMode ? getEnabledTools() : [];

        const response = await provider.chat({
            model: model.model,
            messages,
            tools: tools.length > 0 ? tools : undefined,
            params
        });

        // 工具调用循环
        if (response.toolCalls.length > 0) {
            // 工具调用前先清理 assistant 文本中的内部控制 token，
            // 再剥一层 message/content JSON 外壳（防止模型把文本包在JSON里原样返回）。
            // 后续 toolLoop 内会再次执行相同处理，此处双保险确保未经过 toolLoop 的代码
            // 路径也不会泄漏 JSON 外壳给用户。
            response.content = extractPlainTextFromJson(sanitizeModelOutput(response.content));
            const content = await executeToolLoop({
                response,
                chatContext: { msg, e, systemMessage, chatMsg, fullUserMsg },
                recursionDepth,
                chatFn: chat
            });
            return { content, rawResponse: JSON.stringify(response.raw || {}) };
        }

        // =============== 空 toolCalls 兜底：主动检测"用户要画图但模型忘了调工具" ===============
        // thinking/原生工具调用模型有时会"嘴上说要开始画了"，但 tool_calls 数组空的，
        // 导致用户以为画不出来（如 2026-08-31 03:20:48 事故：模型发开始绘制但实际没调用）。
        // 此处检测命中画图意图 + AI未宣称已完成 时，手动合成一条 generate_image 工具调用。
        const forced = synthesizeImageToolCallIfNeeded({
            userText: fullUserMsg,
            assistantText: response.content || '',
            tools
        });
        if (forced) {
            logger.info(`[止水对话] 模型空tool_calls，兜底注入画图工具调用 | 提示词前缀:"${forced.prefix}"`);
            response.toolCalls = [forced.toolCall];
            response.content = forced.cleanAssistantText;
            response.content = extractPlainTextFromJson(sanitizeModelOutput(response.content));
            const content = await executeToolLoop({
                response,
                chatContext: { msg, e, systemMessage, chatMsg, fullUserMsg },
                recursionDepth,
                chatFn: chat
            });
            return { content, rawResponse: JSON.stringify(response.raw || {}) };
        }

        // 思维链模式：拼接思维链前缀（保持旧版展示行为）
        // 先剥 JSON 外壳再清理控制符，防止思维链模式下把 {"message":"..."} 原样发给用户
        let content = extractPlainTextFromJson(sanitizeModelOutput(response.content));
        if (isThinkingMode && response.thinking) {
            const thinkingClean = sanitizeModelOutput(response.thinking);
            content = `【思维链】\n${thinkingClean}\n\n【回答】\n${content}`;
        }

        // 会话持久化：user与assistant消息写入历史（工具循环轮由toolLoop持久化，
        // 末轮在此保存，保证每条用户消息恰好落盘一次）
        await addMessage({ role: 'user', content: fullUserMsg }, e);
        const assistantMsgToSave = { role: 'assistant', content };
        if (response.thinking) {
            assistantMsgToSave.reasoning_content = sanitizeModelOutput(response.thinking);
        }
        await addMessage(assistantMsgToSave, e);

        return {
            content,
            rawResponse: JSON.stringify(response.raw || {})
        };
    } catch (error) {
        // 已分类的详细错误直接上抛
        if (error?.classified) {
            throw error;
        }
        await handleProviderError(error, provider, providerConfig);
    }
}
