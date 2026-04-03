/**
 * 场景过滤与隐私保护模块
 * 在V2角色整合模式下，控制跨场景数据的可见性
 */

const logger = global.logger || console;

/**
 * 默认敏感关键词列表
 * 用于自动检测消息中的敏感内容
 */
const DEFAULT_SENSITIVE_KEYWORDS = [
    '密码', '银行卡', '身份证', '手机号',
    '地址', '生日', '真实姓名', '支付',
    '账号', '验证码'
];

/**
 * 隐私等级常量
 */
export const PRIVACY_LEVEL = {
    PUBLIC: 0,
    SCENE_RESTRICTED: 1,
    PRIVATE: 2,
    CONFIDENTIAL: 3
};

/**
 * 默认隐私配置
 */
export const DEFAULT_PRIVACY_CONFIG = {
    crossSceneRecall: {
        enabled: true,
        allowedCombinations: [
            { from: 'private', to: 'group', level: PRIVACY_LEVEL.SCENE_RESTRICTED },
            { from: 'group', to: 'private', level: PRIVACY_LEVEL.PUBLIC },
            { from: 'group', to: 'group', level: PRIVACY_LEVEL.PUBLIC },
            { from: 'private', to: 'private', level: PRIVACY_LEVEL.CONFIDENTIAL }
        ]
    },
    sensitiveKeywords: DEFAULT_SENSITIVE_KEYWORDS,
    autoDetectSensitive: true
};

/**
 * 检测消息内容的隐私等级
 * 根据关键词匹配和模式识别判断隐私级别
 * @param {string} content - 消息文本内容
 * @param {Array<string>} keywords - 敏感关键词列表
 * @returns {number} 隐私等级 (0-3)
 */
export function detectPrivacyLevel(content, keywords) {
    if (!content) {
        return PRIVACY_LEVEL.PUBLIC;
    }

    const effectiveKeywords = keywords || DEFAULT_SENSITIVE_KEYWORDS;

    for (const keyword of effectiveKeywords) {
        if (content.includes(keyword)) {
            return PRIVACY_LEVEL.CONFIDENTIAL;
        }
    }

    const sensitivePatterns = [
        /\d{11}/,
        /\d{17}[\dXx]/,
        /\d{16,19}/,
        /@.*\.(com|cn|net|org)/
    ];

    for (const pattern of sensitivePatterns) {
        if (pattern.test(content)) {
            return PRIVACY_LEVEL.PRIVATE;
        }
    }

    return PRIVACY_LEVEL.PUBLIC;
}

/**
 * 过滤消息列表，根据当前场景和隐私设置决定可见性
 * 使用 additional_info 格式（与 SystemConfig.json 约定一致)
 * @param {Array} messages - 完整的消息数组（V2增强格式）
 * @param {Object} currentScene - 当前场景 { type: 'group'|'private', source_id: string }
 * @param {Object} privacyConfig - 隐私配置对象
 * @returns {Array} 过滤后的消息数组（仅包含role/content等API必需字段）
 */
export function filterMessagesByPrivacy(messages, currentScene, privacyConfig) {
    if (!messages || !Array.isArray(messages)) {
        return [];
    }

    const config = privacyConfig || DEFAULT_PRIVACY_CONFIG;

    if (!config.crossSceneRecall.enabled) {
        return messages.filter(msg => {
            const info = msg.additional_info;
            if (!info) return false;
            const isGroup = info.group_id && info.group_id !== 0;
            const isSameScene = isGroup
                ? String(info.group_id) === currentScene.source_id
                : String(info.user_id) === currentScene.source_id;
            return isSameScene;
        }).map(msg => ({
            role: msg.role,
            content: msg.content,
            tool_calls: msg.tool_calls,
            tool_call_id: msg.tool_call_id,
            reasoning_content: msg.reasoning_content
        }));
    }

    return messages.filter(msg => {
        const info = msg.additional_info || {};
        if (!info) return false;

        let msgLevel = PRIVACY_LEVEL.PUBLIC;
        if (info.privacy_level !== undefined && typeof info.privacy_level === 'number') {
            msgLevel = info.privacy_level;
        } else if (config.autoDetectSensitive) {
            msgLevel = detectPrivacyLevel(msg.content, config.sensitiveKeywords);
        }

        const isPrivate = !info.group_id || info.group_id === 0;
        if (isPrivate && msgLevel === PRIVACY_LEVEL.PUBLIC) {
            msgLevel = PRIVACY_LEVEL.SCENE_RESTRICTED;
        }

        const msgSceneType = isPrivate ? 'private' : 'group';
        const rule = config.crossSceneRecall.allowedCombinations.find(
            r => r.from === msgSceneType && r.to === currentScene.type
        );

        if (!rule) {
            return false;
        }

        return msgLevel <= rule.level;
    }).map(msg => ({
        role: msg.role,
        content: msg.content,
        tool_calls: msg.tool_calls,
        tool_call_id: msg.tool_call_id,
        reasoning_content: msg.reasoning_content
    }));
}

/**
 * 为消息添加 additional_info 信息
 * 在V2模式写入时调用
 * @param {Object} msg - 原始消息对象
 * @param {Object} e - 事件对象
 * @param {Object} options - 选项 { autoDetect?: boolean, keywords?: string[] }
 * @returns {Object} 增强后的消息对象
 */
export function enrichMessageWithPrivacy(msg, e, options) {
    const enriched = {
        role: msg.role,
        content: msg.content,
        additional_info: {
            user_id: e.user_id,
            group_id: e.group_id || 0,
            name: e.sender?.nickname || '',
            timestamp: Date.now()
        }
    };

    if (msg.tool_calls) {
        enriched.tool_calls = msg.tool_calls;
    }
    if (msg.tool_call_id) {
        enriched.tool_call_id = msg.tool_call_id;
    }
    if (msg.reasoning_content) {
        enriched.reasoning_content = msg.reasoning_content;
    }

    const opts = options || {};
    if (opts.autoDetect !== false) {
        enriched.additional_info.privacy_level = detectPrivacyLevel(msg.content, opts.keywords);
    }

    return enriched;
}
