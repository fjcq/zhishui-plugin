/**
 * 图像编辑工具（edit_image）校验逻辑测试
 * 覆盖：导出完整性、参数校验、target 归一化、数量上限、事件对象守卫、服务商配置守卫
 * 运行方式：在插件根目录执行 node test-image-edit.js
 * 说明：使用真实 Config（读 config/config/imageGen.yaml 的 Edit 段），不发起真实 API 请求
 */

// ===== 宿主环境桩（必须在动态 import 之前注入）=====
// 依赖链会拉入宿主 Yunzai 的 lib/config/config.js 与 lib/renderer/loader.js，
// 前者在模块加载期调用全局 Bot.makeLog，后者初始化时调用全局 logger.error
global.Bot = { makeLog: () => {} };
global.logger = console;

// 注入桩后再动态加载被测模块（静态 import 先于模块体执行，桩会来不及生效）
const { handleImageEditToolCall, EDIT_IMAGE_TOOLS } = await import('./apps/chat/tools/handlers/imageEditHandler.js');

let passCount = 0;
let failCount = 0;

/**
 * 断言两个值严格相等
 * @param {string} name - 测试名称
 * @param {any} actual - 实际值
 * @param {any} expected - 期望值
 */
function assertEqual(name, actual, expected) {
    if (actual === expected) {
        passCount++;
        console.log(`  ✓ ${name}`);
    } else {
        failCount++;
        console.log(`  ✗ ${name}`);
        console.log(`    期望: ${JSON.stringify(expected)}`);
        console.log(`    实际: ${JSON.stringify(actual)}`);
    }
}

/**
 * 构造 mock 事件对象
 * @returns {object} 带 user_id 与 reply 的事件对象
 */
function mockE() {
    return {
        user_id: 10001,
        reply: async () => { /* 仅需存在，不校验发送内容 */ }
    };
}

console.log('=== 图像编辑工具校验逻辑测试 ===\n');

const TEST_USER = 'test-edit-user';

// 测试1：导出完整性
console.log('测试1：模块导出');
assertEqual('EDIT_IMAGE_TOOLS 包含 edit_image', Array.isArray(EDIT_IMAGE_TOOLS) && EDIT_IMAGE_TOOLS.includes('edit_image'), true);
assertEqual('handleImageEditToolCall 为函数', typeof handleImageEditToolCall, 'function');

// 测试2：缺少 prompt
console.log('测试2：缺少 prompt 时返回参数提示');
const r1 = await handleImageEditToolCall('edit_image', { target: ['https://example.com/a.jpg'] }, mockE(), TEST_USER);
assertEqual('返回缺少 prompt 提示', r1.error_message, '想怎么改这张图呢？请告诉我具体的修改要求');

// 测试3：target 为空数组
console.log('测试3：target 为空数组时提示提供图片');
const r2 = await handleImageEditToolCall('edit_image', { prompt: '把背景换成海边', target: [] }, mockE(), TEST_USER);
assertEqual('返回请先提供图片提示', r2.error_message, '请先提供要修改的图片');

// 测试4：target 超过最大张数
console.log('测试4：target 超过 4 张时提示上限');
const r3 = await handleImageEditToolCall('edit_image', { prompt: '合成一张图', target: ['a', 'b', 'c', 'd', 'e'] }, mockE(), TEST_USER);
assertEqual('返回最多 4 张提示', r3.error_message, '一次最多只能处理 4 张图片');

// 测试5：缺少事件对象
console.log('测试5：缺少事件对象时提示在对话中使用');
const r4 = await handleImageEditToolCall('edit_image', { prompt: '把背景换成海边', target: ['https://example.com/a.jpg'] }, null, TEST_USER);
assertEqual('返回对话中使用提示', r4.error_message, '暂时改不了，请在对话中使用');

// 测试6：服务商未配置（真实配置 Edit.ApiKey 为空）
console.log('测试6：ApiKey 为空时提示未配置');
const r5 = await handleImageEditToolCall('edit_image', { prompt: '把背景换成海边', target: ['https://example.com/a.jpg'] }, mockE(), TEST_USER);
assertEqual('返回未配置提示', r5.error_message, '修图工具还没配置好，暂时用不了');

// 测试7：target 传单个字符串（非数组）时归一化不崩溃
console.log('测试7：target 为字符串时归一化处理');
const r6 = await handleImageEditToolCall('edit_image', { prompt: '把背景换成海边', target: 'https://example.com/a.jpg' }, mockE(), TEST_USER);
assertEqual('归一化后到达配置守卫', r6.error_message, '修图工具还没配置好，暂时用不了');

// 测试8：未知工具名
console.log('测试8：未知工具名返回未知操作');
const r7 = await handleImageEditToolCall('not_a_tool', {}, mockE(), TEST_USER);
assertEqual('返回未知操作', r7.error_message, '未知操作');

// 测试9：工具注册链路集成（开关注册 / 定义聚合 / 分发入口）
console.log('测试9：工具注册链路集成');
const { ALL_TOOL_NAMES, DEFAULT_DISABLED_TOOLS } = await import('./guoba/schemas/toolSwitchSchema.js');
assertEqual('ALL_TOOL_NAMES 含 edit_image', ALL_TOOL_NAMES.includes('edit_image'), true);
assertEqual('DEFAULT_DISABLED_TOOLS 含 edit_image（默认禁用）', DEFAULT_DISABLED_TOOLS.includes('edit_image'), true);
const { getToolDefinition } = await import('./apps/chat/tools/definitions/index.js');
const editDef = getToolDefinition('edit_image');
assertEqual('工具定义聚合可检索到 edit_image', Boolean(editDef && editDef.function && editDef.function.name === 'edit_image'), true);
assertEqual('target 参数定义为数组类型', editDef?.function?.parameters?.properties?.target?.type, 'array');
const handlersIndex = await import('./apps/chat/tools/handlers/index.js');
assertEqual('分发入口导出 handleImageEditToolCall', typeof handlersIndex.handleImageEditToolCall, 'function');

console.log(`\n结果: ${passCount} 通过, ${failCount} 失败`);
process.exit(failCount > 0 ? 1 : 0);
