/**
 * 联网搜索工具 解析逻辑离线单元测试
 * 使用预录的 DuckDuckGo HTML 样本验证解析正确性，无需网络访问
 *
 * 使用方式：在 Yunzai 根目录执行
 *   node plugins/zhishui-plugin/test-search-parser.js
 */

if (!global.logger) {
    global.logger = {
        info: () => {},
        warn: () => {},
        error: () => {},
        mark: () => {},
        debug: () => {}
    };
}

const { __test__ } = await import('./apps/chat/tools/handlers/searchHandler.js');
const { parseDuckDuckGoResults, cleanHtmlText, extractRealUrl, clampMaxResults } = __test__;

let passed = 0;
let total = 0;

/**
 * 断言相等
 * @param {string} name - 测试名称
 * @param {*} actual - 实际值
 * @param {*} expected - 期望值
 */
function assertEqual(name, actual, expected) {
    total++;
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr === expectedStr) {
        console.log(`[通过] ${name}`);
        passed++;
    } else {
        console.error(`[失败] ${name}`);
        console.error(`       期望: ${expectedStr}`);
        console.error(`       实际: ${actualStr}`);
    }
}

/**
 * 断言为真
 * @param {string} name - 测试名称
 * @param {boolean} condition - 条件
 */
function assertTrue(name, condition) {
    total++;
    if (condition) {
        console.log(`[通过] ${name}`);
        passed++;
    } else {
        console.error(`[失败] ${name}（条件不成立）`);
    }
}

/**
 * 测试 cleanHtmlText 清理 HTML 标签和实体
 */
function testCleanHtmlText() {
    console.log('\n--- 测试 cleanHtmlText ---');

    assertEqual(
        '清理普通文本',
        cleanHtmlText('Hello World'),
        'Hello World'
    );

    assertEqual(
        '清理标签',
        cleanHtmlText('<b>Hello</b> <i>World</i>'),
        'Hello World'
    );

    assertEqual(
        '清理HTML实体',
        cleanHtmlText('Tom &amp; Jerry &lt;cartoon&gt;'),
        'Tom & Jerry <cartoon>'
    );

    assertEqual(
        '清理空白字符',
        cleanHtmlText('  Hello\n  World  '),
        'Hello World'
    );

    assertEqual(
        '空字符串处理',
        cleanHtmlText(''),
        ''
    );

    assertEqual(
        'null处理',
        cleanHtmlText(null),
        ''
    );
}

/**
 * 测试 extractRealUrl 解析跳转链接
 */
function testExtractRealUrl() {
    console.log('\n--- 测试 extractRealUrl ---');

    assertEqual(
        '解析标准跳转链接',
        extractRealUrl('//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage&rut=abc'),
        'https://example.com/page'
    );

    assertEqual(
        '解析带查询参数的跳转链接',
        extractRealUrl('//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.example.com%2Fsearch%3Fq%3Dtest&rut=xyz'),
        'https://www.example.com/search?q=test'
    );

    assertEqual(
        '解析直接URL（非跳转）',
        extractRealUrl('https://www.example.com/page'),
        'https://www.example.com/page'
    );

    assertEqual(
        '空URL返回空字符串',
        extractRealUrl(''),
        ''
    );

    assertEqual(
        '无效URL返回空字符串',
        extractRealUrl('not-a-url'),
        ''
    );
}

/**
 * 测试 clampMaxResults 结果数限制
 */
function testClampMaxResults() {
    console.log('\n--- 测试 clampMaxResults ---');

    assertEqual('默认值（undefined）', clampMaxResults(undefined), 5);
    assertEqual('null', clampMaxResults(null), 5);
    assertEqual('零', clampMaxResults(0), 5);
    assertEqual('负数', clampMaxResults(-3), 5);
    assertEqual('非整数', clampMaxResults(3.7), 5);
    assertEqual('正常值3', clampMaxResults(3), 3);
    assertEqual('上限值10', clampMaxResults(10), 10);
    assertEqual('超过上限', clampMaxResults(100), 10);
}

/**
 * 测试 parseDuckDuckGoResults 解析真实 HTML 样本
 */
function testParseResults() {
    console.log('\n--- 测试 parseDuckDuckGoResults ---');

    /**
     * 模拟 DuckDuckGo HTML 接口的真实响应片段
     * 包含 3 条结果，每条有标题、跳转URL、摘要
     */
    const sampleHtml = `
<!DOCTYPE html>
<html>
<head><title>test at DuckDuckGo</title></head>
<body>
<div class="serp__results">
  <div id="links" class="results">
    <div class="result results_links results_links_deep web-result ">
      <div class="links_main links_deep result__body">
        <h2 class="result__title">
          <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fyunzai.net%2F&amp;rut=abc123">
            Yunzai-Bot 官方文档
          </a>
        </h2>
        <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fyunzai.net%2F&amp;rut=abc123">
          Yunzai-Bot 是一个基于 Node.js 的 QQ 机器人框架，支持多种功能扩展。
        </a>
      </div>
    </div>
    <div class="result results_links results_links_deep web-result ">
      <div class="links_main links_deep result__body">
        <h2 class="result__title">
          <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fgithub.com%2FLe-niao%2FYunzai-Bot&amp;rut=def456">
            GitHub - Le-niao/Yunzai-Bot
          </a>
        </h2>
        <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fgithub.com%2FLe-niao%2FYunzai-Bot&amp;rut=def456">
          Yunzai-Bot 的源代码仓库，提供 Issues 与 Pull Requests 协作。
        </a>
      </div>
    </div>
    <div class="result results_links results_links_deep web-result ">
      <div class="links_main links_deep result__body">
        <h2 class="result__title">
          <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fzhuanlan.zhihu.com%2Fp%2F123456&amp;rut=ghi789">
            云崽机器人入门指南 - 知乎
          </a>
        </h2>
        <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fzhuanlan.zhihu.com%2Fp%2F123456&amp;rut=ghi789">
          本文介绍了如何从零开始搭建云崽机器人，包括插件安装与配置。
        </a>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;

    const results = parseDuckDuckGoResults(sampleHtml, 5);

    assertTrue('解析出3条结果', results.length === 3);

    if (results.length >= 1) {
        assertEqual(
            '第1条标题',
            results[0].title,
            'Yunzai-Bot 官方文档'
        );
        assertEqual(
            '第1条URL',
            results[0].url,
            'https://yunzai.net/'
        );
        assertTrue(
            '第1条摘要包含关键内容',
            results[0].snippet.includes('Yunzai-Bot') && results[0].snippet.includes('Node.js')
        );
    }

    if (results.length >= 2) {
        assertEqual(
            '第2条标题',
            results[1].title,
            'GitHub - Le-niao/Yunzai-Bot'
        );
        assertEqual(
            '第2条URL',
            results[1].url,
            'https://github.com/Le-niao/Yunzai-Bot'
        );
    }

    if (results.length >= 3) {
        assertEqual(
            '第3条URL（带查询参数）',
            results[2].url,
            'https://zhuanlan.zhihu.com/p/123456'
        );
    }
}

/**
 * 测试 maxResults 限制生效
 */
function testMaxResultsLimit() {
    console.log('\n--- 测试 maxResults 限制 ---');

    const html = `
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fa.com">A</a>
        <a class="result__snippet">Snippet A</a>
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fb.com">B</a>
        <a class="result__snippet">Snippet B</a>
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fc.com">C</a>
        <a class="result__snippet">Snippet C</a>
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fd.com">D</a>
        <a class="result__snippet">Snippet D</a>
    `;

    const r2 = parseDuckDuckGoResults(html, 2);
    assertTrue('限制为2条返回2条', r2.length === 2);

    const r4 = parseDuckDuckGoResults(html, 4);
    assertTrue('限制为4条返回4条', r4.length === 4);
}

/**
 * 测试空HTML处理
 */
function testEmptyHtml() {
    console.log('\n--- 测试空HTML处理 ---');

    assertEqual('空字符串', parseDuckDuckGoResults('', 5).length, 0);
    assertEqual('无结果HTML', parseDuckDuckGoResults('<html><body>no results</body></html>', 5).length, 0);
}

/**
 * 测试缺 snippet 时不会跨结果错位（新分离式解析的关键边界）
 */
function testMissingSnippet() {
    console.log('\n--- 测试缺 snippet 不串结果 ---');

    // 第2条结果缺 snippet，应返回空字符串而不是跨越到第3条的 snippet
    const html = `
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fa.com">A</a>
        <a class="result__snippet">Snippet A</a>
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fb.com">B</a>
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fc.com">C</a>
        <a class="result__snippet">Snippet C</a>
    `;

    const results = parseDuckDuckGoResults(html, 5);
    assertTrue('3条标题被全部解析', results.length === 3);
    if (results.length === 3) {
        assertEqual('第2条 snippet 为空（未串到第3条）', results[1].snippet, '');
        assertEqual('第3条 snippet 正确', results[2].snippet, 'Snippet C');
        assertEqual('第2条 URL 正确', results[1].url, 'https://b.com');
    }
}

/**
 * 主测试函数
 */
function main() {
    console.log('========================================');
    console.log('  联网搜索工具 解析逻辑离线测试');
    console.log('========================================');

    testCleanHtmlText();
    testExtractRealUrl();
    testClampMaxResults();
    testParseResults();
    testMaxResultsLimit();
    testEmptyHtml();
    testMissingSnippet();

    console.log('\n========================================');
    console.log(`  测试结果: ${passed}/${total} 通过`);
    console.log('========================================');

    process.exit(passed === total ? 0 : 1);
}

main();
