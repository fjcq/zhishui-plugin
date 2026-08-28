/**
 * 新配置结构迁移测试
 * 覆盖：类型归一化、baseUrl规范化、完整转换、迁移IO（mock Config）
 * 运行：node test-config-migration.js
 */

import {
    normalizeLegacyType,
    normalizeBaseUrl,
    transformLegacyConfig,
    needsMigration,
    migrateChatConfig
} from './apps/chat/configs/migrate.js';
import { validateChatConfig, isVisionModel, inferProviderName } from './apps/chat/configs/schema.js';

let passed = 0;
let failed = 0;

/**
 * 断言辅助：实际值深度等于期望值
 * @param {string} name - 用例名
 * @param {*} actual - 实际值
 * @param {*} expected - 期望值
 */
function assertEqual(name, actual, expected) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
        passed += 1;
        console.log(`  ✓ ${name}`);
    } else {
        failed += 1;
        console.error(`  ✗ ${name}\n      期望: ${e}\n      实际: ${a}`);
    }
}

/**
 * 断言辅助：条件为真
 * @param {string} name - 用例名
 * @param {boolean} condition - 条件
 */
function assertTrue(name, condition) {
    if (condition) {
        passed += 1;
        console.log(`  ✓ ${name}`);
    } else {
        failed += 1;
        console.error(`  ✗ ${name}`);
    }
}

console.log('=== 1. normalizeLegacyType 类型归一化 ===');
assertEqual('tencent保留', normalizeLegacyType('tencent'), 'tencent');
assertEqual('gemini保留', normalizeLegacyType('gemini'), 'gemini');
assertEqual('openai保留', normalizeLegacyType('openai'), 'openai');
assertEqual('deepseek→openai', normalizeLegacyType('deepseek'), 'openai');
assertEqual('旧anthropic别名→openai（保持旧行为）', normalizeLegacyType('anthropic'), 'openai');
assertEqual('大小写不敏感', normalizeLegacyType('DeepSeek'), 'openai');
assertEqual('未知类型→openai兜底', normalizeLegacyType('some-unknown'), 'openai');
assertEqual('空值→openai兜底', normalizeLegacyType(''), 'openai');

console.log('\n=== 2. normalizeBaseUrl 地址规范化 ===');
assertEqual(
    'openai裁掉/chat/completions',
    normalizeBaseUrl('https://api.deepseek.com/v1/chat/completions', 'openai'),
    'https://api.deepseek.com/v1'
);
assertEqual(
    'openai无后缀保持原样',
    normalizeBaseUrl('https://api.deepseek.com/v1', 'openai'),
    'https://api.deepseek.com/v1'
);
assertEqual(
    'gemini裁掉/models/xxx:generateContent',
    normalizeBaseUrl('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', 'gemini'),
    'https://generativelanguage.googleapis.com/v1beta'
);
assertEqual(
    'tencent保持完整URL',
    normalizeBaseUrl('https://yuanqi.tencent.com/openapi/v1/agent/chat/completions', 'tencent'),
    'https://yuanqi.tencent.com/openapi/v1/agent/chat/completions'
);

console.log('\n=== 3. inferProviderName 名称推断 ===');
assertEqual('ApiTitle优先', inferProviderName({ ApiTitle: '我的模型', ApiUrl: 'https://api.deepseek.com/v1' }), '我的模型');
assertEqual('域名映射推断', inferProviderName({ ApiUrl: 'https://api.deepseek.com/v1' }), 'DeepSeek');
assertEqual('本地地址推断', inferProviderName({ ApiUrl: 'http://127.0.0.1:11434/v1' }), '本地模型11434');
assertEqual('未知域名取主机名', inferProviderName({ ApiUrl: 'https://foo.example.com/v1' }), 'foo.example.com');

console.log('\n=== 4. transformLegacyConfig 完整转换 ===');
const legacy = {
    ApiList: [
        { ApiTitle: 'DeepSeek', ApiType: 'deepseek', TencentAssistantId: '', ApiUrl: 'https://api.deepseek.com/v1/chat/completions', ApiKey: 'sk-ds', ApiModel: 'deepseek-chat' },
        { ApiTitle: 'DeepSeek', ApiType: 'openai', TencentAssistantId: '', ApiUrl: 'https://api.deepseek.com/v1/chat/completions', ApiKey: 'sk-ds2', ApiModel: 'deepseek-reasoner' },
        { ApiTitle: '', ApiType: 'gemini', TencentAssistantId: '', ApiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', ApiKey: 'sk-gm', ApiModel: 'gemini-2.5-flash' },
        { ApiTitle: '腾讯元器', ApiType: 'tencent', TencentAssistantId: 'asst-123', ApiUrl: 'https://yuanqi.tencent.com/openapi/v1/agent/chat/completions', ApiKey: 'sk-tx', ApiModel: 'hunyuan-lite' }
    ],
    CurrentApiIndex: 1,
    VisionApiIndex: 2,
    GroupRoleIndex: [
        { group: 123456789, index: 1, apiIndex: 0 },
        { group: 987654321, index: 2 },
        { group: 555, apiIndex: 99 }
    ]
};
const next = transformLegacyConfig(legacy);

assertEqual('providers数量', next.providers.length, 4);
assertEqual('重名去重（DeepSeek/DeepSeek-2）', next.providers.map(p => p.name), ['DeepSeek', 'DeepSeek-2', 'Google Gemini', '腾讯元器']);
assertEqual('deepseek类型归一openai', next.providers[0].type, 'openai');
assertEqual('baseUrl已裁剪', next.providers[0].baseUrl, 'https://api.deepseek.com/v1');
assertEqual('gemini类型保留', next.providers[2].type, 'gemini');
assertEqual('gemini baseUrl已裁剪', next.providers[2].baseUrl, 'https://generativelanguage.googleapis.com/v1beta');
assertEqual('tencent类型保留', next.providers[3].type, 'tencent');
assertEqual('tencent助手ID随provider', next.providers[3].tencentAssistantId, 'asst-123');
assertTrue('openai provider无助手ID字段', !('tencentAssistantId' in next.providers[0]));

assertEqual('models数量', next.models.length, 4);
assertEqual('model引用provider名', next.models[1].provider, 'DeepSeek-2');
assertEqual('model携带模型名', next.models[2].model, 'gemini-2.5-flash');

assertEqual('CurrentApiIndex→defaultModel', next.defaultModel, 'DeepSeek-2');
assertEqual('VisionApiIndex→visionModel', next.visionModel, 'Google Gemini');

assertEqual('groupOverrides数量', next.groupOverrides.length, 3);
assertEqual('群覆盖apiIndex→model别名', next.groupOverrides[0], { group: 123456789, model: 'DeepSeek', roleIndex: 1 });
assertEqual('群覆盖无apiIndex时省略model', next.groupOverrides[1], { group: 987654321, roleIndex: 2 });
assertEqual('群覆盖apiIndex越界时省略model', next.groupOverrides[2], { group: 555 });

console.log('\n=== 5. 边界情况 ===');
const empty = transformLegacyConfig({});
assertEqual('空配置→空结构', empty, { providers: [], models: [], defaultModel: '', visionModel: '', groupOverrides: [] });
const badIndex = transformLegacyConfig({ ApiList: [{ ApiTitle: 'A', ApiType: 'openai', ApiUrl: 'https://a.com/v1/chat/completions', ApiKey: 'k', ApiModel: 'm' }], CurrentApiIndex: 99, VisionApiIndex: -1 });
assertEqual('CurrentApiIndex越界→defaultModel空', badIndex.defaultModel, '');
assertEqual('VisionApiIndex=-1→visionModel空（自动）', badIndex.visionModel, '');

console.log('\n=== 6. validateChatConfig 校验 ===');
const vr = validateChatConfig(next);
assertTrue('转换结果通过校验', vr.valid);
const bad = validateChatConfig({ providers: [], models: [{ name: 'm', provider: '不存在', model: '' }] });
assertTrue('空providers校验失败', !bad.valid);
assertTrue('错误信息含provider引用', bad.errors.some(e => e.includes('不存在')));
assertTrue('错误信息含model缺失', bad.errors.some(e => e.includes('model不能为空')));

console.log('\n=== 7. needsMigration / migrateChatConfig（mock Config） ===');
assertTrue('旧配置需迁移', needsMigration(legacy));
assertTrue('已迁移跳过', !needsMigration({ ...legacy, migrated: true }));
assertTrue('空ApiList跳过', !needsMigration({ ApiList: [] }));

/**
 * 构造mock Config模块
 * @param {Object} initial - 初始chat配置
 * @returns {Object} 模拟的Config模块
 */
function mockConfig(initial) {
    const store = { ...initial };
    return {
        get Chat() { return store; },
        async modify(name, key, value) {
            if (name !== 'chat') return false;
            store[key] = value;
            return true;
        }
    };
}

const cfg = mockConfig({ ApiList: legacy.ApiList, CurrentApiIndex: 0, VisionApiIndex: -1 });

const dryRun = await migrateChatConfig(cfg, { dryRun: true });
assertTrue('dryRun不写入', dryRun.migrated === false && dryRun.reason === 'dry-run');
assertTrue('dryRun未写入providers', cfg.Chat.providers === undefined);

const done = await migrateChatConfig(cfg);
assertTrue('正式迁移成功', done.migrated === true);
assertEqual('providers已写入', cfg.Chat.providers.length, 4);
assertTrue('哨兵migrated已写入', cfg.Chat.migrated === true);
assertTrue('旧字段ApiList保留（绞杀期共存）', Array.isArray(cfg.Chat.ApiList));

const again = await migrateChatConfig(cfg);
assertTrue('二次迁移幂等跳过', again.migrated === false && again.reason === 'already-migrated');

const noLegacy = await migrateChatConfig(mockConfig({ providers: [] }));
assertTrue('无旧配置跳过', noLegacy.migrated === false && noLegacy.reason === 'no-legacy-config');

console.log('\n=== 8. isVisionModel 视觉模型识别 ===');
assertTrue('qwen-vl识别为视觉', isVisionModel('Qwen/Qwen2.5-VL-7B'));
assertTrue('gemini识别为视觉', isVisionModel('gemini-2.5-flash'));
assertTrue('gpt-4o识别为视觉', isVisionModel('gpt-4o-mini'));
assertTrue('deepseek-chat非视觉', !isVisionModel('deepseek-chat'));

console.log(`\n===== 结果：${passed} 通过，${failed} 失败 =====`);
process.exit(failed > 0 ? 1 : 0);
