/**
 * 搜剧工具 端到端验证脚本
 * 流程：search_videos → get_video_episodes → get_video_play_url
 *
 * 使用方式：在 Yunzai 根目录执行
 *   node plugins/zhishui-plugin/test-video-tools.js
 */

if (!global.logger) {
    global.logger = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        mark: () => {},
        debug: () => {}
    };
}

if (!global.Bot) {
    global.Bot = {
        makeLog: (level, args, name) => {
            if (level === 'error') console.error(`[${name}]`, ...args);
        }
    };
}

// mock redis，UserDataManager 依赖全局 redis
if (!global.redis) {
    const store = new Map();
    global.redis = {
        get: async (k) => store.has(k) ? store.get(k) : null,
        set: async (k, v) => { store.set(k, v); return 'OK'; },
        del: async (k) => { store.delete(k); return 1; }
    };
}

const { handleVideoToolCall } = await import('./apps/chat/tools/handlers/videoHandler.js');

let passed = 0;
let total = 0;

/**
 * 记录测试结果
 * @param {string} name - 测试名
 * @param {boolean} ok - 是否通过
 * @param {string} detail - 详情
 */
function record(name, ok, detail = '') {
    total++;
    if (ok) {
        console.log(`[通过] ${name}`);
        passed++;
    } else {
        console.error(`[失败] ${name} ${detail}`);
    }
}

/**
 * 主测试函数
 */
async function main() {
    console.log('========================================');
    console.log('  搜剧工具 端到端测试');
    console.log('========================================\n');

    // 测试1：未配置资源站时的错误处理（mock Config.SearchVideos）
    console.log('--- 测试未配置资源站错误 ---');
    const origSearchVideos = global.Config?.SearchVideos;
    // mock Config 模块
    const { Config } = await import('./components/index.js');
    const origCfg = Config.SearchVideos;
    Object.defineProperty(Config, 'SearchVideos', {
        get: () => ({ resources: [], player: '', CurrentResourceIndex: 0 }),
        configurable: true
    });

    let r = await handleVideoToolCall('search_videos', { keyword: 'test' }, { user_id: '1', group_id: '1' }, '1');
    record('未配置资源站时返回错误', r.error && r.error_message.includes('未配置'), r.error_message);

    r = await handleVideoToolCall('get_video_episodes', { vod_name: 'test' }, { user_id: '1' }, '1');
    record('未配置资源站时获取剧集返回错误', r.error, r.error_message);

    r = await handleVideoToolCall('get_video_play_url', { vod_name: 'test' }, { user_id: '1' }, '1');
    record('未配置资源站时获取链接返回错误', r.error, r.error_message);

    // 恢复 Config
    Object.defineProperty(Config, 'SearchVideos', {
        get: () => origCfg,
        configurable: true
    });

    // 测试2：未知工具
    console.log('\n--- 测试未知工具 ---');
    r = await handleVideoToolCall('unknown', {}, null, null);
    record('未知工具被拒绝', r.error && r.error_message.includes('未知'));

    // 测试3：参数缺失
    console.log('\n--- 测试参数缺失 ---');
    r = await handleVideoToolCall('get_video_episodes', {}, { user_id: '1' }, '1');
    record('获取剧集无参数返回错误', r.error && (r.error_message.includes('vod_id') || r.error_message.includes('vod_name')));

    r = await handleVideoToolCall('get_video_play_url', {}, { user_id: '1' }, '1');
    record('获取链接无参数返回错误', r.error);

    // 测试4：实际网络请求（依赖资源站可达，使用索引2：量子资源）
    console.log('\n--- 测试实际搜索（依赖资源站可达） ---');
    r = await handleVideoToolCall('search_videos', { keyword: '斗罗大陆', site_index: 2 }, { user_id: 'test' }, 'test');
    if (r.success) {
        record('搜索返回成功', true);
        console.log(`  找到 ${r.total_results} 条结果，资源站索引: ${r.site_index}`);
        if (r.results.length > 0) {
            const first = r.results[0];
            console.log(`  首条: ${first.vod_name} (${first.vod_year}) - ${first.type_name}`);

            // 测试5：获取剧集列表
            console.log('\n--- 测试获取剧集列表 ---');
            r = await handleVideoToolCall('get_video_episodes', { vod_id: first.vod_id, site_index: 2 }, { user_id: 'test' }, 'test');
            if (r.success) {
                record('获取剧集成功', r.routes && r.routes.length > 0);
                // 验证 episode_links 不再泄露给 AI
                const leakCheck = (r.routes || []).every(route => !('episode_links' in route));
                record('episode_links 不泄露给 AI', leakCheck);
                console.log(`  作品: ${r.vod_name} | 线路数: ${r.total_routes}`);
                if (r.routes.length > 0) {
                    const route = r.routes[0];
                    console.log(`  线路1: ${route.route_name} | 集数: ${route.total_episodes}`);

                    // 测试6：获取播放链接
                    console.log('\n--- 测试获取播放链接 ---');
                    r = await handleVideoToolCall('get_video_play_url', {
                        vod_id: first.vod_id,
                        episode: 1,
                        route_index: 1,
                        site_index: 2
                    }, { user_id: 'test' }, 'test');
                    if (r.success) {
                        record('获取播放链接成功', !!r.play_url);
                        console.log(`  作品: ${r.vod_name} | 集: ${r.episode_name} | 链接长度: ${r.play_url.length}`);
                    } else {
                        record('获取播放链接成功', false, r.error_message);
                    }
                }
            } else {
                record('获取剧集成功', false, r.error_message);
            }
        }
    } else {
        console.log(`  [跳过] 搜索失败：${r.error_message}`);
        record('搜索返回成功', false, r.error_message);
    }

    console.log('\n========================================');
    console.log(`  测试结果: ${passed}/${total} 通过`);
    console.log('========================================');

    process.exit(passed === total ? 0 : 1);
}

main().catch(error => {
    console.error('[FATAL]', error);
    process.exit(1);
});
