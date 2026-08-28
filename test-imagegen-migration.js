/**
 * 生图模块新架构迁移测试
 * 覆盖：五段旧配置转换、真实生产场景（仅Custom）、默认服务商映射、幂等哨兵、
 *       迁移IO（mock Config）、结构校验、模型解析（mock Config）
 * 运行：node test-imagegen-migration.js
 */

import {
    transformLegacyImageConfig,
    needsImageMigration,
    migrateImageGenConfig
} from './apps/chat/tools/imageGen/imageMigrate.js';
import {
    validateImageGenConfig,
    isImageProviderConfigured,
    IMAGE_PROVIDER_TYPES
} from './apps/chat/tools/imageGen/imageSchema.js';

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

/** 全量旧配置样例（五个段落全部配置） */
const FULL_LEGACY = {
    Enable: true,
    DefaultProvider: 'custom',
    Timeout: 120000,
    RateLimit: 10,
    DefaultSize: '1024*1024',
    SaveDir: '',
    Tongyi: { ApiKey: 'sk-tongyi', Model: 'wanx2.1-t2i-turbo', Style: '<auto>', PollInterval: 3000 },
    DallE: { ApiKey: 'sk-dalle', BaseUrl: 'https://api.openai.com/v1', Model: 'dall-e-3', Quality: 'hd', ResponseFormat: 'url' },
    Wenxin: { ApiKey: 'ak', SecretKey: 'sk', Model: 'wenxin-yige-2.0', TokenCacheTTL: 86400 },
    Custom: {
        ApiKey: 'sk-sf', BaseUrl: 'https://api.siliconflow.cn/v1', ApiPath: '/images/generations',
        Model: 'baidu/ERNIE-Image-Turbo', Quality: 'standard', ResponseFormat: 'b64_json',
        SizeSeparator: 'x', ExtraParams: '{"guidance_scale": 7.5}'
    },
    Edit: {
        Enable: true, ApiKey: 'sk-agnes', BaseUrl: 'https://apihub.agnes-ai.cn/v1',
        ApiPath: '/images/generations', Model: 'agnes-image-2.1-flash', MaxImages: 3,
        ResponseFormat: 'url', SizeSeparator: 'x', ExtraParams: ''
    }
};

console.log('=== 1. transformLegacyImageConfig 全量五段转换 ===');
{
    const result = transformLegacyImageConfig(FULL_LEGACY);

    assertEqual('provider数量=5（Tongyi/DallE/Wenxin/Custom/Edit）', result.providers.length, 5);
    assertEqual('model数量=5', result.models.length, 5);

    const tongyiP = result.providers[0];
    assertEqual('通义provider类型', tongyiP.type, 'tongyi');
    assertEqual('通义apiKey', tongyiP.apiKey, 'sk-tongyi');
    assertEqual('通义pollInterval', tongyiP.pollInterval, 3000);

    const tongyiM = result.models[0];
    assertEqual('通义model名称', tongyiM.model, 'wanx2.1-t2i-turbo');
    assertEqual('通义style保留', tongyiM.style, '<auto>');
    assertEqual('通义model引用provider', tongyiM.provider, tongyiP.name);

    const dalleM = result.models[1];
    assertEqual('DALL-E尺寸分隔符固定x', dalleM.sizeSeparator, 'x');
    assertEqual('DALL-E quality保留', dalleM.quality, 'hd');

    const wenxinP = result.providers[2];
    assertEqual('文心provider类型', wenxinP.type, 'wenxin');
    assertEqual('文心secretKey保留', wenxinP.secretKey, 'sk');

    const customM = result.models[3];
    assertEqual('Custom model引用openai类型', result.providers[3].type, 'openai');
    assertEqual('Custom responseFormat保留', customM.responseFormat, 'b64_json');
    assertEqual('Custom extraParams保留', customM.extraParams, '{"guidance_scale": 7.5}');

    const editM = result.models[4];
    assertEqual('Edit独立model条目', editM.model, 'agnes-image-2.1-flash');
    assertEqual('edit.model引用迁移条目', result.edit.model, editM.name);
    assertEqual('edit.maxImages保留', result.edit.maxImages, 3);
    assertEqual('edit.enable保留', result.edit.enable, true);

    assertEqual('DefaultProvider=custom → defaultText2Image指向Custom条目', result.defaultText2Image, customM.name);
}

console.log('=== 2. 真实生产场景（仅Custom配置） ===');
{
    const legacy = {
        Enable: true,
        DefaultProvider: 'custom',
        Tongyi: { ApiKey: '' },
        DallE: { ApiKey: '' },
        Wenxin: { ApiKey: '', SecretKey: '' },
        Custom: {
            ApiKey: 'sk-sf', BaseUrl: 'https://api.siliconflow.cn/v1',
            Model: 'baidu/ERNIE-Image-Turbo', ResponseFormat: 'b64_json', SizeSeparator: 'x'
        },
        Edit: { Enable: true, ApiKey: '', BaseUrl: 'https://apihub.agnes-ai.cn/v1', Model: 'agnes-image-2.1-flash' }
    };
    const result = transformLegacyImageConfig(legacy);

    assertEqual('未配置密钥的段落全部跳过（provider=1）', result.providers.length, 1);
    assertEqual('model=1', result.models.length, 1);
    assertEqual('唯一条目为Custom', result.models[0].model, 'baidu/ERNIE-Image-Turbo');
    assertEqual('defaultText2Image指向Custom', result.defaultText2Image, result.models[0].name);
    assertEqual('Edit无密钥不生成条目但保留开关', result.edit.enable, true);
    assertEqual('edit.model为空', result.edit.model, '');
}

console.log('=== 3. DefaultProvider映射与回退 ===');
{
    const base = { Tongyi: { ApiKey: 'k' }, Custom: { ApiKey: '', BaseUrl: '', Model: '' } };
    assertEqual(
        'DefaultProvider=tongyi可解析',
        transformLegacyImageConfig({ ...base, DefaultProvider: 'tongyi' }).defaultText2Image,
        '通义万相'
    );
    assertEqual(
        'DefaultProvider指向未配置段落 → 留空（运行时自动回退第一个可用）',
        transformLegacyImageConfig({ ...base, DefaultProvider: 'custom' }).defaultText2Image,
        ''
    );
    assertEqual(
        'DefaultProvider为空 → 留空',
        transformLegacyImageConfig({ ...base, DefaultProvider: '' }).defaultText2Image,
        ''
    );
}

console.log('=== 4. needsImageMigration 幂等哨兵 ===');
assertTrue('存在旧段落且无哨兵 → 需迁移', needsImageMigration(FULL_LEGACY));
assertTrue('哨兵存在 → 跳过', !needsImageMigration({ ...FULL_LEGACY, imageMigrated: true }));
assertTrue('无任何旧段落 → 跳过', !needsImageMigration({ Enable: true, providers: [], models: [] }));
assertTrue('仅Edit段存在也触发（保证edit结构归一）', needsImageMigration({ Edit: { Enable: true } }));

console.log('=== 5. migrateImageGenConfig 迁移IO（mock Config） ===');
{
    /** 构造mock Config（记录写入键） */
    const mockConfig = (imageGen) => {
        const store = { ...imageGen };
        return {
            getDefOrConfig: () => store,
            modify: async (name, key, value) => {
                store[key] = value;
                return true;
            },
            store
        };
    };

    const dryRun = await migrateImageGenConfig(mockConfig(FULL_LEGACY), { dryRun: true });
    assertTrue('dryRun不写入', dryRun.migrated === false && dryRun.reason === 'dry-run');

    const cfg = mockConfig(FULL_LEGACY);
    const done = await migrateImageGenConfig(cfg);
    assertTrue('正常迁移成功', done.migrated === true);
    assertTrue('哨兵已落盘', cfg.store.imageMigrated === true);
    assertTrue('providers已写入', Array.isArray(cfg.store.providers) && cfg.store.providers.length === 5);
    assertTrue('旧段落保留不动', cfg.store.Tongyi?.ApiKey === 'sk-tongyi');

    const again = await migrateImageGenConfig(cfg);
    assertEqual('重复迁移跳过（already-migrated）', again.reason, 'already-migrated');

    const noLegacy = await migrateImageGenConfig(mockConfig({ Enable: true, providers: [] }));
    assertEqual('无旧配置跳过（no-legacy-config）', noLegacy.reason, 'no-legacy-config');
}

console.log('=== 6. validateImageGenConfig 结构校验 ===');
{
    const valid = {
        providers: [{ name: '硅基流动', type: 'openai', baseUrl: 'https://api.siliconflow.cn/v1', apiKey: 'k' }],
        models: [{ name: 'ERNIE', provider: '硅基流动', model: 'baidu/ERNIE-Image-Turbo' }],
        defaultText2Image: 'ERNIE',
        edit: { enable: true, model: 'ERNIE', maxImages: 4 }
    };
    assertEqual('合法配置通过', validateImageGenConfig(valid).valid, true);

    const badType = { ...valid, providers: [{ name: 'x', type: 'foo', baseUrl: '', apiKey: '' }] };
    assertTrue('非法type被拒绝', validateImageGenConfig(badType).valid === false);

    const badRef = { ...valid, models: [...valid.models, { name: '孤儿', provider: '不存在', model: 'm' }] };
    assertTrue('model引用不存在的provider被拒绝', validateImageGenConfig(badRef).valid === false);

    const badDefault = { ...valid, defaultText2Image: '不存在' };
    assertTrue('defaultText2Image引用不存在被拒绝', validateImageGenConfig(badDefault).valid === false);

    const badEdit = { ...valid, edit: { enable: true, model: '不存在', maxImages: 4 } };
    assertTrue('edit.model引用不存在被拒绝', validateImageGenConfig(badEdit).valid === false);
}

console.log('=== 7. isImageProviderConfigured 按类型判定 ===');
{
    assertTrue('openai齐备可用', isImageProviderConfigured({ type: 'openai', baseUrl: 'u', apiKey: 'k' }));
    assertTrue('openai缺baseUrl不可用', !isImageProviderConfigured({ type: 'openai', baseUrl: '', apiKey: 'k' }));
    assertTrue('wenxin缺secretKey不可用', !isImageProviderConfigured({ type: 'wenxin', apiKey: 'k', secretKey: '' }));
    assertTrue('wenxin齐备可用', isImageProviderConfigured({ type: 'wenxin', apiKey: 'k', secretKey: 's' }));
    assertTrue('tongyi仅需apiKey', isImageProviderConfigured({ type: 'tongyi', apiKey: 'k' }));
    assertTrue('空apiKey一律不可用', !isImageProviderConfigured({ type: 'tongyi', apiKey: '' }));
}

console.log('=== 8. 类型枚举完整性 ===');
assertEqual('三种协议类型', IMAGE_PROVIDER_TYPES, { OPENAI: 'openai', TONGYI: 'tongyi', WENXIN: 'wenxin' });

console.log(`\n===== 测试结果: ${passed} 通过, ${failed} 失败 =====`);
process.exit(failed > 0 ? 1 : 0);
