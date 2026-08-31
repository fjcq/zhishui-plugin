/**
 * guoba面板与chat新配置结构的表单适配模块
 *
 * 背景：guoba面板已直编providers/models两级结构（对齐运行时与生图面板），
 * 本模块仅处理面板表单与YAML结构之间的少量形态差异：
 * - toPanelModels：models回显时 vision 布尔 → 三态字符串（configReader调用）
 * - mergePanelModels：面板提交的models → 落盘结构（configWriter写前钩子），
 *   三态字符串 → 布尔，并按name/provider+model匹配保留面板不编辑的params
 * - cleanupChatReferences：落盘后清理失效引用（planChatReferenceCleanup纯函数
 *   计划 + IO封装执行：defaultModel/visionModel/groupOverrides指向已删除模型时
 *   置空/摘除，provider悬空仅告警）
 *
 * 旧版renderLegacyView/applyLegacyView全量ApiList双向转换已随面板切换删除。
 */

import { Config, logger } from '../../../components/index.js';

/**
 * models回显转换：vision布尔 → 面板三态字符串（纯函数）
 * @param {Array<Object>} models - 落盘结构的model列表
 * @returns {Array<Object>} 面板表单形态的model列表
 */
export function toPanelModels(models) {
    if (!Array.isArray(models)) {
        return [];
    }
    return models.map(m => ({
        ...m,
        vision: m.vision === true ? 'true' : m.vision === false ? 'false' : 'auto'
    }));
}

/**
 * 按name与provider+model串构建既有model索引（params保留匹配用）
 * @param {Array<Object>} currentModels - 落盘的model列表
 * @returns {{byName: Map, byKey: Map}} 双索引
 */
function buildModelIndex(currentModels) {
    const byName = new Map();
    const byKey = new Map();
    for (const m of Array.isArray(currentModels) ? currentModels : []) {
        if (!m || typeof m !== 'object') {
            continue;
        }
        byName.set(m.name, m);
        byKey.set(`${m.provider}|${m.model}`, m);
    }
    return { byName, byKey };
}

/**
 * 面板提交的models → 落盘结构（纯函数）
 * vision三态字符串转布尔（auto不写键保持YAML整洁）；
 * params面板不编辑，按name优先、provider+model串兜底匹配既有条目回填，
 * 避免GSubForm只提交schema定义字段导致高级参数丢失
 * @param {Array<Object>} submitted - 面板提交的model列表
 * @param {Array<Object>} currentModels - 当前落盘的model列表
 * @returns {Array<Object>} 可直接落盘的model列表
 */
export function mergePanelModels(submitted, currentModels) {
    const { byName, byKey } = buildModelIndex(currentModels);

    return (Array.isArray(submitted) ? submitted : [])
        .filter(m => m && typeof m === 'object')
        .map(m => {
            const matched = byName.get(m.name) || byKey.get(`${m.provider}|${m.model}`);
            const vision = m.vision === 'true' ? true : m.vision === 'false' ? false : undefined;
            return {
                name: String(m.name || ''),
                provider: String(m.provider || ''),
                model: String(m.model || ''),
                params: matched?.params || {},
                ...(vision !== undefined ? { vision } : {})
            };
        });
}

/**
 * 计划chat配置中的失效引用清理（纯函数）
 * - defaultModel/visionModel悬空 → 置空（运行时自动回退第一个模型/自动扫描）
 * - groupOverrides悬空model → 摘除该字段，仅剩group时整条移除
 * - model.provider悬空（服务商改名/删除）→ 仅告警不自动改，运行时兜底第一个可用模型
 * @param {Object} chat - 完整chat配置
 * @returns {{updates: Array<[string, *]>, warnings: Array<string>}} 待写回的键值对与告警信息
 */
export function planChatReferenceCleanup(chat) {
    const models = Array.isArray(chat?.models) ? chat.models : [];
    const modelNames = new Set(models.map(m => m?.name).filter(Boolean));
    const updates = [];
    const warnings = [];

    if (chat?.defaultModel && !modelNames.has(chat.defaultModel)) {
        updates.push(['defaultModel', '']);
    }
    if (chat?.visionModel && !modelNames.has(chat.visionModel)) {
        updates.push(['visionModel', '']);
    }

    const overrides = Array.isArray(chat?.groupOverrides) ? chat.groupOverrides : [];
    let overridesChanged = false;
    const cleanedOverrides = overrides.map(o => {
        if (o && o.model && !modelNames.has(o.model)) {
            overridesChanged = true;
            const entry = { ...o };
            delete entry.model;
            return Object.keys(entry).length <= 1 ? null : entry;
        }
        return o;
    }).filter(Boolean);
    if (overridesChanged) {
        updates.push(['groupOverrides', cleanedOverrides]);
    }

    const providerNames = new Set(
        (Array.isArray(chat?.providers) ? chat.providers : []).map(p => p?.name).filter(Boolean)
    );
    for (const m of models) {
        if (m?.provider && !providerNames.has(m.provider)) {
            warnings.push(`模型"${m.name}"引用的服务商"${m.provider}"不存在，请检查服务商名称是否一致`);
        }
    }

    return { updates, warnings };
}

/**
 * 执行chat配置失效引用清理（IO封装，configWriter落盘后调用）
 * @returns {Promise<{cleaned: boolean}>} 是否发生了清理写回
 */
export async function cleanupChatReferences() {
    const chat = await Config.Chat;
    const { updates, warnings } = planChatReferenceCleanup(chat);

    for (const message of warnings) {
        logger.warn(`[面板适配] ${message}`);
    }

    for (const [key, value] of updates) {
        const ok = await Config.modify('chat', key, value);
        if (!ok) {
            logger.error(`[面板适配] 清理失效引用失败: ${key}`);
            return { cleaned: false };
        }
    }
    return { cleaned: updates.length > 0 };
}
