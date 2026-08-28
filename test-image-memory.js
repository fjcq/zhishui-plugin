/**
 * 会话级图片记忆模块测试
 * 覆盖：last 引用解析、本地路径判定、Redis 环形缓存（写入/读取/容量裁剪/去重）、
 *       resolveImageTarget 四形态解析、Redis 异常降级、downloadImageSmart 本地路径直读
 * 运行：node test-image-memory.js
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// mock 宿主全局（logger/redis/Bot 均由宿主注入；redis 用内存 Map 模拟）
// 注意：必须先 mock 再动态导入被测模块（ESM 静态 import 会提升，先于 mock 执行）
globalThis.logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, mark: () => {}, log: () => {} };
globalThis.Bot = { makeLog: () => globalThis.logger, uin: 'test' };
const redisStore = new Map();
globalThis.redis = {
    get: async (key) => (redisStore.has(key) ? redisStore.get(key) : null),
    set: async (key, value) => { redisStore.set(key, value); return 'OK'; },
    expire: async () => 1
};

const {
    parseImageRef,
    isLocalImagePath,
    getSessionImages,
    rememberSessionImage,
    resolveImageTarget,
    IMAGE_SOURCES
} = await import('./apps/chat/tools/imageGen/imageMemory.js');
const { downloadImageSmart } = await import('./apps/chat/api/utils/requestUtils.js');
const { getContextMode } = await import('./apps/chat/config.js');

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

/** 测试用 mock 事件对象（私聊场景） */
const mockE = { user_id: 900001, group_id: null, isGroup: false };

/** 会话隔离对照用的另一 mock 事件（不同用户） */
const otherE = { user_id: 900002, group_id: null, isGroup: false };

console.log('=== 1. parseImageRef 引用解析 ===');
assertEqual('last → index 1', parseImageRef('last'), { index: 1 });
assertEqual('LAST 大小写不敏感', parseImageRef('LAST'), { index: 1 });
assertEqual('last-2 → index 2', parseImageRef('last-2'), { index: 2 });
assertEqual('last-10 → index 10', parseImageRef('last-10'), { index: 10 });
assertEqual('last-0 无效', parseImageRef('last-0'), null);
assertEqual('last-abc 无效', parseImageRef('last-abc'), null);
assertEqual('URL 非引用', parseImageRef('https://a.com/x.png'), null);
assertEqual('空串非引用', parseImageRef(''), null);
assertEqual('空白串非引用', parseImageRef('  '), null);

console.log('=== 2. isLocalImagePath 本地路径判定 ===');
assertTrue('Windows反斜杠路径', isLocalImagePath('E:\\output\\img_1.png'));
assertTrue('Windows正斜杠路径', isLocalImagePath('D:/imgs/a.png'));
assertTrue('POSIX绝对路径', isLocalImagePath('/home/user/img.png'));
assertTrue('http非本地路径', !isLocalImagePath('https://a.com/x.png'));
assertTrue('相对文件名非本地路径', !isLocalImagePath('img_123.png'));
assertTrue('fileId非本地路径', !isLocalImagePath('ABC123.file'));

console.log('=== 3. rememberSessionImage 写入与读取 ===');
{
    assertTrue('写入用户图（url+fileId）', await rememberSessionImage(mockE, {
        source: IMAGE_SOURCES.USER, url: 'https://gchat.qpic.cn/u1.png', fileId: 'F001'
    }));
    assertTrue('写入生成图（localPath+prompt）', await rememberSessionImage(mockE, {
        source: IMAGE_SOURCES.GENERATE, localPath: 'E:\\out\\img_1.png', prompt: '一只橘猫趴在窗台上晒太阳，写实风格'
    }));
    assertTrue('写入编辑图', await rememberSessionImage(mockE, {
        source: IMAGE_SOURCES.EDIT, localPath: 'E:\\out\\img_2.png', prompt: '背景换成海边'
    }));

    const list = await getSessionImages(mockE);
    assertEqual('记忆条数=3', list.length, 3);
    assertEqual('来源标记正确', list.map(i => i.source), ['user', 'generate', 'edit']);
    assertTrue('prompt截断至60字符', list[1].prompt.length <= 60);
    assertTrue('含时间戳', typeof list[0].time === 'number');

    // 会话隔离性按 ContextMode 模式断言：V1（isolated）按用户隔离；V2（role）全局共享属设计语义
    const contextMode = await getContextMode();
    if (contextMode === 'isolated' || contextMode === 'v1') {
        assertEqual('V1模式会话隔离（他人记忆为空）', (await getSessionImages(otherE)).length, 0);
    } else {
        assertEqual('V2模式全局共享（同一会话可见）', (await getSessionImages(otherE)).length, 3);
    }

    // 去重：与最新条目完全一致时跳过
    await rememberSessionImage(mockE, { source: IMAGE_SOURCES.EDIT, localPath: 'E:\\out\\img_2.png' });
    assertEqual('重复条目去重跳过', (await getSessionImages(mockE)).length, 3);

    // 空条目拒绝
    assertTrue('三种引用全空拒绝写入', !(await rememberSessionImage(mockE, { source: IMAGE_SOURCES.USER })));

    // 容量裁剪：写入至超限，仅保留最新8张
    for (let i = 0; i < 12; i++) {
        await rememberSessionImage(mockE, { source: IMAGE_SOURCES.GENERATE, localPath: `E:\\out\\loop_${i}.png` });
    }
    const trimmed = await getSessionImages(mockE);
    assertEqual('环形裁剪保留8张', trimmed.length, 8);
    assertEqual('最旧被裁（首条为loop_4）', trimmed[0].localPath, 'E:\\out\\loop_4.png');
    assertEqual('最新保留（末条为loop_11）', trimmed[trimmed.length - 1].localPath, 'E:\\out\\loop_11.png');

    // 读取限制
    assertEqual('limit参数取最近2张', (await getSessionImages(mockE, 2)).length, 2);
}

console.log('=== 4. resolveImageTarget 四形态解析 ===');
{
    // 先重置记忆，构造确定序列
    redisStore.clear();
    await rememberSessionImage(mockE, { source: IMAGE_SOURCES.USER, url: 'https://img.a.com/u.png', fileId: 'FU' });
    await rememberSessionImage(mockE, { source: IMAGE_SOURCES.GENERATE, localPath: 'E:\\out\\gen.png', prompt: '画只猫' });
    await rememberSessionImage(mockE, { source: IMAGE_SOURCES.EDIT, localPath: 'E:\\out\\edit.png', prompt: '改背景' });

    const last1 = await resolveImageTarget('last', mockE);
    assertEqual('last → 最新条目（edit）', { url: last1.url, fileId: last1.fileId, localPath: last1.localPath },
        { url: '', fileId: '', localPath: 'E:\\out\\edit.png' });

    const last2 = await resolveImageTarget('last-2', mockE);
    assertEqual('last-2 → 生成图条目', last2.localPath, 'E:\\out\\gen.png');

    const last3 = await resolveImageTarget('LAST-3', mockE);
    assertEqual('last-3 → 用户图条目（url+fileId齐备）',
        { url: last3.url, fileId: last3.fileId }, { url: 'https://img.a.com/u.png', fileId: 'FU' });

    const miss = await resolveImageTarget('last-9', mockE);
    assertTrue('引用越界返回refMiss', miss?.refMiss === true);

    const local = await resolveImageTarget('E:\\out\\gen.png', mockE);
    assertEqual('本地路径直读', local.localPath, 'E:\\out\\gen.png');

    const url = await resolveImageTarget('![img](https://a.com/pic.webp)', mockE);
    assertEqual('markdown包裹URL自动清理', url.url, 'https://a.com/pic.webp');

    const fileId = await resolveImageTarget('ABC123xyz.file', mockE);
    assertEqual('未知字符串按fileId透传', fileId.fileId, 'ABC123xyz.file');

    assertEqual('空target返回null', await resolveImageTarget('', mockE), null);
    assertEqual('null target返回null', await resolveImageTarget(null, mockE), null);
}

console.log('=== 5. Redis 异常静默降级 ===');
{
    const originGet = globalThis.redis.get;
    const originSet = globalThis.redis.set;
    globalThis.redis.get = async () => { throw new Error('connection lost'); };
    globalThis.redis.set = async () => { throw new Error('connection lost'); };

    assertEqual('get异常返回空数组', await getSessionImages(mockE), []);
    assertTrue('set异常返回false不抛出', !(await rememberSessionImage(mockE, { source: IMAGE_SOURCES.USER, url: 'https://x/1.png' })));
    const miss2 = await resolveImageTarget('last', mockE);
    assertTrue('引用解析在redis异常时refMiss', miss2?.refMiss === true);

    globalThis.redis.get = originGet;
    globalThis.redis.set = originSet;
}

console.log('=== 6. downloadImageSmart 本地路径直读 ===');
{
    // 生成临时 png 文件（最小合法PNG头）
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'imgmem-'));
    const tmpFile = path.join(tmpDir, 't.png');
    const pngBytes = Buffer.from(
        '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
        '1f15c4890000000a49444154789c6300010000050001', 'hex'
    );
    fs.writeFileSync(tmpFile, pngBytes);

    const data = await downloadImageSmart({ url: tmpFile, source: '测试' });
    assertTrue('本地路径读出base64', Boolean(data?.base64));
    assertEqual('MIME按扩展名识别', data?.mime, 'image/png');
    assertEqual('内容与源文件一致', data?.base64, pngBytes.toString('base64'));

    // 不存在的本地路径返回 null（而非抛出）
    const notFound = await downloadImageSmart({ url: path.join(tmpDir, 'no_such.png'), source: '测试' });
    assertEqual('本地路径不存在返回null', notFound, null);

    // 正斜杠形式路径
    const fwd = await downloadImageSmart({ url: tmpFile.replace(/\\/g, '/'), source: '测试' });
    assertTrue('正斜杠路径同样可读', Boolean(fwd?.base64));

    fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log(`\n===== 测试结果: ${passed} 通过, ${failed} 失败 =====`);
process.exit(failed > 0 ? 1 : 0);
