/**
 * 搜剧工具 网络层调试脚本
 * 用于排查 request.get 调用与直接 fetch 调用的差异
 */

global.logger = {
    debug: (...a) => console.log('[DEBUG]', ...a),
    error: (...a) => console.error('[ERROR]', ...a),
    info: (...a) => console.log('[INFO]', ...a),
    warn: (...a) => console.warn('[WARN]', ...a),
    mark: () => {}
};
global.Bot = { makeLog: () => {} };
global.redis = { get: async () => null, set: async () => null, del: async () => null };

const KEYWORD = '斗罗大陆';
const URL = 'https://cj.lziapi.com/api.php/provide/vod/?ac=detail&wd=' + encodeURIComponent(KEYWORD) + '&t=0&h=0&pg=1';

console.log('\n=== 测试1：直接 fetch ===');
try {
    const r = await fetch(URL);
    const j = await r.json();
    console.log('status:', r.status, 'list:', j.list?.length, 'first:', j.list?.[0]?.vod_name);
} catch (e) {
    console.error('ERR:', e.message);
}

console.log('\n=== 测试2：request.get with responseType=json ===');
const req = (await import('./plugins/zhishui-plugin/lib/request/request.js')).default;
try {
    const j = await req.get(URL, { responseType: 'json', closeCheckStatus: false, outErrorLog: false });
    console.log('list:', j?.list?.length, 'first:', j?.list?.[0]?.vod_name);
} catch (e) {
    console.error('ERR:', e.message);
}

console.log('\n=== 测试3：request.get with closeCheckStatus=true ===');
try {
    const j = await req.get(URL, { responseType: 'json', closeCheckStatus: true, outErrorLog: false });
    console.log('list:', j?.list?.length, 'first:', j?.list?.[0]?.vod_name);
} catch (e) {
    console.error('ERR:', e.message);
}

console.log('\n=== 测试4：handleVideoToolCall 完整调用 ===');
const m = (await import('./plugins/zhishui-plugin/apps/chat/tools/handlers/videoHandler.js'));
const r = await m.handleVideoToolCall('search_videos', { keyword: KEYWORD, site_index: 2 }, { user_id: 'test' }, 'test');
console.log('result:', JSON.stringify(r).substring(0, 500));

process.exit(0);
