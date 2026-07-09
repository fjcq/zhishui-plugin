/**
 * 自建音乐API 端到端音频验证脚本
 * 完整流程：搜索 → 获取URL → 下载文件 → 验证音频头
 *
 * 使用方式：在 Yunzai 根目录执行
 *   node plugins/zhishui-plugin/test-music-audio.js
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

const { startMusicApiServer, stopMusicApiServer, getServerStatus } = await import('./apps/chat/tools/server/index.js');
const { checkMusicApiAvailable, musicApiSearch, musicApiSongUrl, musicApiDetail } = await import('./apps/chat/tools/handlers/musicApiClient.js');
const { validateAudioHeader } = await import('./apps/chat/tools/handlers/musicCore.js');

console.log('========================================');
console.log('  自建音乐API 音频验证测试');
console.log('========================================\n');

/**
 * 下载音频头部数据用于验证
 * @param {string} url - 音频URL
 * @returns {Promise<{buffer: Buffer, status: number, contentType: string}>} 下载结果
 */
async function downloadAudioHead(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://y.qq.com/'
            }
        });

        const arrayBuffer = await response.arrayBuffer();
        return {
            buffer: Buffer.from(arrayBuffer),
            status: response.status,
            contentType: response.headers.get('content-type') || ''
        };
    } finally {
        clearTimeout(timer);
    }
}

/**
 * 测试单个平台的端到端流程
 * @param {string} platform - 平台代码
 * @param {string} keyword - 搜索关键词
 * @param {string} desc - 平台中文名
 */
async function testPlatform(platform, keyword, desc) {
    console.log(`【${desc}】关键词: ${keyword}`);
    try {
        const results = await musicApiSearch(platform, keyword, 3);
        if (!results || results.length === 0) {
            console.log(`  ❌ 无搜索结果`);
            return;
        }
        console.log(`  ✓ 搜索到 ${results.length} 首`);

        await new Promise(r => setTimeout(r, 1000));

        const first = results[0];
        console.log(`  歌曲: ${first.name} - ${first.artist} (id: ${first.id})`);

        // QQ音乐需要 mediaMid 才能构造正确的 vkey filename
        // 模拟 musicService.getSongDetailByMusicApi 的两阶段调用流程
        let mediaMid = first.mediaMid || '';
        if ((platform === 'qq' || platform === 'tencent') && !mediaMid) {
            console.log(`  ⚠️ 搜索结果未带 mediaMid，尝试 detail 获取...`);
            const detail = await musicApiDetail(platform, first.id);
            mediaMid = detail?.mediaMid || '';
        }
        if (platform === 'qq' || platform === 'tencent') {
            console.log(`  mediaMid: ${mediaMid || '(空)'}`);
        }

        const urlInfo = await musicApiSongUrl(platform, first.id, mediaMid);
        if (!urlInfo) {
            console.log(`  ❌ 获取播放链接失败`);
            return;
        }

        if (!urlInfo.url || urlInfo.canPlay === false) {
            console.log(`  ⚠️ 不可播放（VIP/版权保护）| canPlay: ${urlInfo.canPlay} | quality: ${urlInfo.quality}`);
            return;
        }

        console.log(`  URL: ${urlInfo.url.substring(0, 80)}...`);
        console.log(`  canPlay: ${urlInfo.canPlay} | quality: ${urlInfo.quality}`);

        // 下载并验证音频头
        try {
            const { buffer, status, contentType } = await downloadAudioHead(urlInfo.url);
            const header = validateAudioHeader(buffer);
            const sizeKb = Math.round(buffer.length / 1024);

            console.log(`  HTTP状态: ${status} | Content-Type: ${contentType} | 大小: ${sizeKb}KB`);
            if (header.valid) {
                console.log(`  ✅ 音频头验证通过 | 格式: ${header.format}`);
            } else {
                console.log(`  ❌ 音频头验证失败 | 原因: ${header.reason || header.format}`);
                console.log(`     前16字节(hex): ${buffer.subarray(0, 16).toString('hex')}`);
            }
        } catch (dlErr) {
            console.log(`  ❌ 下载失败: ${dlErr.message}`);
        }
    } catch (err) {
        console.log(`  ❌ 异常: ${err.message}`);
    }
    console.log('');
}

/**
 * 主测试函数
 */
async function main() {
    console.log('【1】启动服务...');
    const started = await startMusicApiServer();
    if (!started) {
        console.error('❌ 服务启动失败');
        process.exit(1);
    }
    console.log('✓ 服务已启动 |', getServerStatus(), '\n');

    console.log('【2】健康检查...');
    const healthy = await checkMusicApiAvailable();
    console.log(healthy ? '✓ 健康检查通过\n' : '❌ 健康检查失败\n');

    console.log('【3】端到端测试\n');
    await testPlatform('kugou', '李健 晚安', '酷狗');
    await new Promise(r => setTimeout(r, 1000));
    // 稻香是周杰伦的VIP歌曲，用于验证VIP识别
    await testPlatform('tencent', '稻香', 'QQ音乐(VIP歌曲)');
    await new Promise(r => setTimeout(r, 1000));
    // 童年-纵贯线 是免费的，用于验证QQ音乐真实音频播放
    await testPlatform('tencent', '童年 纵贯线', 'QQ音乐(免费歌曲)');
    await new Promise(r => setTimeout(r, 1000));
    await testPlatform('kuwo', '周杰伦', '酷我');

    console.log('【4】停止服务...');
    await stopMusicApiServer();
    console.log('✓ 服务已停止');

    console.log('\n========================================');
    console.log('  测试完成');
    console.log('========================================');
    process.exit(0);
}

main().catch(err => {
    console.error('测试异常:', err);
    process.exit(1);
});
