/**
 * Provider层单元测试
 * 覆盖：思维链解析、Anthropic/Gemini/腾讯消息转换与响应解析、工厂注册表
 * 运行：node test-providers.js（不发真实网络请求）
 */

import { parseThinkingMessage } from './apps/chat/core/thinkingParser.js';
import {
    convertMessages as anthropicConvert,
    convertTools,
    parseAnthropicResponse,
    createAnthropicProvider
} from './apps/chat/providers/anthropicProvider.js';
import {
    convertMessages as geminiConvert,
    parseGeminiResponse,
    createGeminiProvider
} from './apps/chat/providers/geminiProvider.js';
import {
    convertMessages as tencentConvert,
    createTencentProvider
} from './apps/chat/providers/tencentProvider.js';
import { createProvider, getRegisteredTypes, clearProviderCache } from './apps/chat/providers/index.js';
import { createOpenAIProvider } from './apps/chat/providers/openaiProvider.js';
import { resolveVisionCapability } from './apps/chat/configs/schema.js';

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

console.log('=== 1. thinkingParser 三种思维链格式 ===');
const r1 = parseThinkingMessage({ content: '答案', reasoning_content: '推理过程' });
assertEqual('reasoning_content字段', r1, { textContent: '答案', reasoningContent: '推理过程' });

const r2 = parseThinkingMessage({
    content: [
        { type: 'thinking', thinking: '思考中' },
        { type: 'text', text: '结论' }
    ]
});
assertEqual('content数组thinking块', r2, { textContent: '结论', reasoningContent: '思考中' });

const r3 = parseThinkingMessage({ content: '<think>先想想</think>正式回答' });
assertEqual('完整think标签', r3, { textContent: '正式回答', reasoningContent: '先想想' });

const r4 = parseThinkingMessage({ content: '思考部分</think>正式回复' });
assertEqual('仅闭合标签', r4, { textContent: '正式回复', reasoningContent: '思考部分' });

const r5 = parseThinkingMessage({ content: '开头<think>残留思考' });
assertEqual('残留开启标签', r5, { textContent: '开头', reasoningContent: '残留思考' });

const r6 = parseThinkingMessage({ content: '普通回复' });
assertEqual('无思维链', r6, { textContent: '普通回复', reasoningContent: null });

console.log('\n=== 2. anthropicProvider 消息/工具转换 ===');
const msgs = [
    { role: 'system', content: '你是助手' },
    { role: 'user', content: '你好' },
    { role: 'assistant', content: null, tool_calls: [{ id: 'tc1', type: 'function', function: { name: 'search', arguments: '{"q":"天气"}' } }] },
    { role: 'tool', tool_call_id: 'tc1', content: '结果A' },
    { role: 'tool', tool_call_id: 'tc2', content: '结果B' },
    { role: 'user', content: [
        { type: 'text', text: '看这张图' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } }
    ] }
];
const ac = anthropicConvert(msgs);
assertEqual('system提取为顶层参数', ac.system, '你是助手');
assertEqual('assistant tool_calls转tool_use', ac.messages[1], {
    role: 'assistant',
    content: [{ type: 'tool_use', id: 'tc1', name: 'search', input: { q: '天气' } }]
});
assertTrue('连续tool消息合并为单条user', ac.messages[2].role === 'user'
    && ac.messages[2].content.length === 2
    && ac.messages[2].content[0].type === 'tool_result'
    && ac.messages[2].content[1].tool_use_id === 'tc2');
assertEqual('data URI转base64 source', ac.messages[3].content[1], {
    type: 'image',
    source: { type: 'base64', media_type: 'image/png', data: 'QUJD' }
});

const tools = convertTools([{ type: 'function', function: { name: 'search', description: '搜索', parameters: { type: 'object' } } }]);
assertEqual('工具定义转换', tools, [{ name: 'search', description: '搜索', input_schema: { type: 'object' } }]);

console.log('\n=== 3. anthropicProvider 响应解析 ===');
const aResp = parseAnthropicResponse({
    content: [
        { type: 'thinking', thinking: '内部推理' },
        { type: 'text', text: '回复文本' },
        { type: 'tool_use', id: 'tu1', name: 'search', input: { q: 'x' } }
    ],
    usage: { input_tokens: 10, output_tokens: 20 }
});
assertEqual('文本+工具+thinking混合', aResp, {
    content: '回复文本',
    toolCalls: [{ id: 'tu1', type: 'function', function: { name: 'search', arguments: '{"q":"x"}' } }],
    thinking: '内部推理',
    usage: { prompt_tokens: 10, completion_tokens: 20 }
});

const aProvider = createAnthropicProvider({ name: 'claude', type: 'anthropic', baseUrl: 'https://api.anthropic.com', apiKey: 'k' });
assertTrue('claude模型支持视觉', aProvider.supportsVision('claude-sonnet-4'));
assertTrue('支持工具调用', aProvider.supportsTools());
assertEqual('参数白名单裁剪', aProvider.sanitizeParams({ temperature: 1, response_format: {}, junk: 1 }), { temperature: 1 });
assertEqual('错误解析auth', aProvider.parseError({ errorData: { error: { type: 'authentication_error', message: 'bad key' } } }).code, 'auth');
assertEqual('错误解析rate_limit', aProvider.parseError({ errorData: { error: { type: 'rate_limit_error' } } }).code, 'rate_limit');

console.log('\n=== 4. geminiProvider 转换与解析 ===');
const gc = geminiConvert([
    { role: 'system', content: '系统提示' },
    { role: 'user', content: '问题' },
    { role: 'assistant', content: '回答' },
    { role: 'tool', tool_call_id: 't', content: '工具结果' },
    { role: 'user', content: [
        { type: 'text', text: '图' },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,WFhY' } }
    ] }
]);
assertEqual('systemInstruction提取', gc.systemInstruction, '系统提示');
assertEqual('assistant转model角色', gc.contents[1].role, 'model');
assertEqual('tool消息跳过', gc.contents.length, 3);
assertEqual('多模态转inline_data', gc.contents[2].parts[1], { inline_data: { mime_type: 'image/jpeg', data: 'WFhY' } });

const gResp = parseGeminiResponse({
    candidates: [{ content: { parts: [{ text: '第一段' }, { text: '第二段' }] } }],
    usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 6 }
});
assertEqual('多part文本拼接', gResp, { content: '第一段\n第二段', toolCalls: [], thinking: null, usage: { prompt_tokens: 5, completion_tokens: 6 } });

let safetyThrown = '';
try { parseGeminiResponse({ candidates: [{ finishReason: 'SAFETY' }] }); }
catch (err) { safetyThrown = err.message; }
assertTrue('SAFETY抛错', safetyThrown.includes('安全过滤'));

let geminiErrThrown = '';
try { parseGeminiResponse({ error: { code: 429, message: '限流' } }); }
catch (err) { geminiErrThrown = err; }
assertTrue('错误响应抛错带status', geminiErrThrown.status === 429);

const gProvider = createGeminiProvider({ name: 'gm', type: 'gemini', baseUrl: 'https://x/v1beta', apiKey: 'k' });
assertTrue('gemini不支持工具', !gProvider.supportsTools());
assertTrue('gemini模型支持视觉', gProvider.supportsVision('gemini-2.5-flash'));

console.log('\n=== 5. tencentProvider 消息转换 ===');
const tc = tencentConvert([
    { role: 'system', content: '人设' },
    { role: 'user', content: '问1' },
    { role: 'assistant', content: '答1' },
    { role: 'assistant', content: '答2' },
    { role: 'user', content: '问2' },
    { role: 'tool', tool_call_id: 'x', content: '跳过' }
]);
assertEqual('严格交替合并+system并入首条', tc, [
    { role: 'user', content: '人设\n\n问1' },
    { role: 'assistant', content: '答1' },
    { role: 'user', content: '问2' }
]);

const tProvider = createTencentProvider({ name: 'tx', type: 'tencent', baseUrl: 'https://yuanqi.tencent.com/openapi/v1/agent/chat/completions', apiKey: 'k', tencentAssistantId: 'asst-1' });
assertTrue('元器不支持工具', !tProvider.supportsTools());
assertTrue('元器不支持视觉', !tProvider.supportsVision('hunyuan-lite'));

let assistantIdError = '';
try {
    await createTencentProvider({ name: 'tx2', type: 'tencent', baseUrl: 'https://x', apiKey: 'k' })
        .chat({ model: 'hunyuan', messages: [], params: {}, extra: {} });
} catch (err) { assistantIdError = err.message; }
assertTrue('缺assistant_id时抛配置错误', assistantIdError.includes('assistant_id'));

console.log('\n=== 6. providers/index.js 工厂 ===');
assertEqual('注册四种格式', getRegisteredTypes().sort(), ['anthropic', 'gemini', 'openai', 'tencent']);

clearProviderCache();
const p1 = createProvider({ name: 'p', type: 'gemini', baseUrl: 'https://g', apiKey: 'k' });
const p2 = createProvider({ name: 'p', type: 'gemini', baseUrl: 'https://g', apiKey: 'k' });
assertTrue('同配置复用实例', p1 === p2);
const p3 = createProvider({ name: 'p', type: 'gemini', baseUrl: 'https://g2', apiKey: 'k' });
assertTrue('配置变更重建实例', p1 !== p3);

let typeError = '';
try { createProvider({ name: 'x', type: 'unknown' }); }
catch (err) { typeError = err.message; }
assertTrue('未注册类型报错', typeError.includes('未注册'));

console.log('\n=== 7. openaiProvider 静态能力 ===');
const oProvider = createOpenAIProvider({ name: 'o', type: 'openai', baseUrl: 'https://api.deepseek.com/v1', apiKey: 'sk' });
assertTrue('qwen-vl视觉', oProvider.supportsVision('Qwen/Qwen2.5-VL-7B'));
assertTrue('deepseek-chat非视觉', !oProvider.supportsVision('deepseek-chat'));
assertTrue('支持工具', oProvider.supportsTools());
assertEqual('参数白名单裁剪', oProvider.sanitizeParams({ temperature: 0.5, top_p: 0.9, thinking: true, junk: 1 }), { temperature: 0.5, top_p: 0.9 });

console.log('\n=== 8. 视觉能力三态覆盖 ===');
assertTrue('auto走关键词推断（视觉模型）', oProvider.supportsVision('Qwen/Qwen2.5-VL-7B', undefined));
assertTrue('auto走关键词推断（非视觉模型）', !oProvider.supportsVision('deepseek-chat', undefined));
assertTrue('强制开启覆盖关键词', oProvider.supportsVision('deepseek-chat', true));
assertTrue('强制关闭覆盖关键词', !oProvider.supportsVision('gpt-4o', false));
assertTrue('gemini强制关闭生效', !gProvider.supportsVision('gemini-2.5-flash', false));
assertTrue('claude强制关闭生效', !aProvider.supportsVision('claude-sonnet-4', false));
assertTrue('元器强制开启生效', tProvider.supportsVision('hunyuan-lite', true));
assertEqual('resolveVisionCapability三态', [
    resolveVisionCapability('gpt-4o', undefined),
    resolveVisionCapability('deepseek-chat', true),
    resolveVisionCapability('gpt-4o', false)
], [true, true, false]);

console.log(`\n===== 结果：${passed} 通过，${failed} 失败 =====`);
process.exit(failed > 0 ? 1 : 0);
