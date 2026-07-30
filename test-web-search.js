/**
 * 联网搜索工具 端到端验证脚本
 * 完整流程：调用 web_search 工具 → 解析 DuckDuckGo HTML → 输出结构化结果
 *
 * 使用方式：在 Yunzai 根目录执行
 *   node plugins/zhishui-plugin/test-web-search.js
 */

// 必须在 import 之前 mock 全局对象，避免 components/index.js 触发 Yunzai 配置加载时报错
if (!global.logger) {
    global.logger = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        mark: (...args) => console.log('[MARK]', ...args),
        debug: (...args) => console.log('[DEBUG]', ...args)
    };
}

if (!global.Bot) {
    global.Bot = {
        makeLog: (level, args, name) => {
            if (level === 'error') console.error(`[${name}]`, ...args);
        }
    };
}

const { handleSearchToolCall } = await import('./apps/chat/tools/handlers/searchHandler.js');

console.log('========================================');
console.log('  联网搜索工具 端到端测试');
console.log('========================================\n');

/**
 * 执行单次搜索测试
 * @param {string} query - 搜索词
 * @param {number} maxResults - 最大结果数
 */
async function runTestCase(query, maxResults) {
    console.log(`\n[测试] 搜索: "${query}" | 限制: ${maxResults}条`);

    const result = await handleSearchToolCall('web_search', {
        query,
        max_results: maxResults
    });

    if (result.error) {
        console.error(`[失败] ${result.error_message}`);
        return false;
    }

    console.log(`[成功] 共 ${result.total_results} 条结果`);
    for (let i = 0; i < result.results.length; i++) {
        const r = result.results[i];
        console.log(`\n  ${i + 1}. ${r.title}`);
        console.log(`     URL: ${r.url}`);
        console.log(`     摘要: ${r.snippet.substring(0, 120)}${r.snippet.length > 120 ? '...' : ''}`);
    }

    return true;
}

/**
 * 测试异常输入：空字符串
 */
async function testEmptyQuery() {
    console.log('\n[测试] 空查询参数处理');

    const result = await handleSearchToolCall('web_search', { query: '' });
    if (result.error && result.error_message.includes('不能为空')) {
        console.log('[通过] 空查询被正确拒绝');
        return true;
    }
    console.error('[失败] 空查询未被正确处理:', result);
    return false;
}

/**
 * 测试异常输入：未知工具名
 */
async function testUnknownTool() {
    console.log('\n[测试] 未知工具处理');

    const result = await handleSearchToolCall('unknown_tool', { query: 'test' });
    if (result.error && result.error_message.includes('未知')) {
        console.log('[通过] 未知工具被正确拒绝');
        return true;
    }
    console.error('[失败] 未知工具未被正确处理:', result);
    return false;
}

/**
 * 测试 max_results 超界自动校正
 */
async function testMaxResultsClamp() {
    console.log('\n[测试] max_results 超界自动校正');

    const result = await handleSearchToolCall('web_search', {
        query: 'Yunzai Bot',
        max_results: 999
    });

    if (result.error) {
        console.error('[失败] 搜索失败:', result.error_message);
        return false;
    }

    if (result.results.length <= 10) {
        console.log(`[通过] 结果数限制为 ${result.results.length} 条（≤10）`);
        return true;
    }

    console.error(`[失败] 结果数 ${result.results.length} 超过上限 10`);
    return false;
}

/**
 * 主测试函数
 */
async function main() {
    const testCases = [
        { query: '云崽 Yunzai-Bot 是什么', max: 3 },
        { query: 'GLM-5 智谱AI 最新发布', max: 5 }
    ];

    let passed = 0;
    let total = 0;

    for (const tc of testCases) {
        total++;
        if (await runTestCase(tc.query, tc.max)) {
            passed++;
        }
    }

    total++;
    if (await testEmptyQuery()) passed++;

    total++;
    if (await testUnknownTool()) passed++;

    total++;
    if (await testMaxResultsClamp()) passed++;

    console.log('\n========================================');
    console.log(`  测试结果: ${passed}/${total} 通过`);
    console.log('========================================');

    process.exit(passed === total ? 0 : 1);
}

main().catch(error => {
    console.error('[FATAL]', error);
    process.exit(1);
});
