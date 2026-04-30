/**
 * API类型映射测试
 */

// 模拟normalizeApiType函数
function normalizeApiType(apiType) {
    const validTypes = ['openai', 'tencent', 'gemini'];
    
    if (validTypes.includes(apiType)) {
        return apiType;
    }

    const openaiCompatibleTypes = [
        'siliconflow', 'deepseek', 'zhipu', 'moonshot', 'kimi', 
        'qwen', 'doubao', 'baichuan', 'yi', 'minimax', 'stepfun', '01ai',
        'openrouter', 'together', 'fireworks', 'groq', 'perplexity', 
        'replicate', 'anthropic', 'cohere', 'mistral', 'deepinfra', 
        'novita', 'lingyi', 'xai'
    ];
    
    if (openaiCompatibleTypes.includes(apiType?.toLowerCase())) {
        return 'openai';
    }

    return 'openai';
}

console.log('=== API类型映射测试 ===\n');

// 测试标准API类型
const standardTypes = ['openai', 'tencent', 'gemini'];
console.log('测试标准API类型:');
for (const type of standardTypes) {
    const result = normalizeApiType(type);
    console.log(`  ${type} -> ${result} ${result === type ? '✓' : '✗'}`);
}
console.log();

// 测试OpenAI兼容API类型
const compatibleTypes = [
    'deepseek', 'zhipu', 'siliconflow', 'stepfun', '01ai', 
    'moonshot', 'qwen', 'minimax', 'openrouter', 'groq'
];
console.log('测试OpenAI兼容API类型:');
for (const type of compatibleTypes) {
    const result = normalizeApiType(type);
    console.log(`  ${type} -> ${result} ${result === 'openai' ? '✓' : '✗'}`);
}
console.log();

// 测试大小写不敏感
const caseTests = ['DeepSeek', 'ZHIPU', 'StepFun'];
console.log('测试大小写不敏感:');
for (const type of caseTests) {
    const result = normalizeApiType(type);
    console.log(`  ${type} -> ${result} ${result === 'openai' ? '✓' : '✗'}`);
}
console.log();

// 测试未知类型
const unknownTypes = ['unknown', 'custom', 'test'];
console.log('测试未知类型（默认映射到openai）:');
for (const type of unknownTypes) {
    const result = normalizeApiType(type);
    console.log(`  ${type} -> ${result} ${result === 'openai' ? '✓' : '✗'}`);
}
console.log();

console.log('=== 所有测试完成 ✓ ===');
