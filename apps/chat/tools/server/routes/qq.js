/**
 * QQ音乐路由
 * 提供搜索、播放链接、歌词、详情、歌单接口
 */

import express from 'express';
import { asyncHandler, errorResponse, successResponse, validateRequired, clampNumber } from '../utils/routeHelper.js';
import { qqSearch } from '../providers/qq/search.js';
import { getQQPlayUrl } from '../providers/qq/songUrl.js';
import { getQQLyric } from '../providers/qq/lyric.js';
import { getQQDetail } from '../providers/qq/detail.js';
import { getQQPlaylist } from '../providers/qq/playlist.js';

const router = express.Router();

/**
 * 搜索QQ音乐
 * GET /api/qq/search?keyword=xxx&limit=5
 */
router.get('/search', asyncHandler(async (req, res) => {
    const { keyword } = req.query;
    const missing = validateRequired(req.query, ['keyword']);
    if (missing) return res.json(errorResponse(missing));

    const limit = clampNumber(req.query, 'limit', 5, 1, 30);
    const songs = await qqSearch(keyword, limit);

    if (!songs || songs.length === 0) {
        return res.json(successResponse({ songs: [] }, 'no results'));
    }

    res.json(successResponse({ songs }));
}));

/**
 * 获取播放链接
 * GET /api/qq/url?id=xxx&mediaMid=xxx
 * 参数：
 * - id: 歌曲 songmid
 * - mediaMid: 搜索结果中的 mediaMid 字段（用于构造 vkey filename）
 */
router.get('/url', asyncHandler(async (req, res) => {
    const { id, mediaMid } = req.query;
    const missing = validateRequired(req.query, ['id']);
    if (missing) return res.json(errorResponse(missing));

    const result = await getQQPlayUrl(id, mediaMid);
    if (!result) {
        return res.json(successResponse({ url: '', canPlay: false, quality: '0' }, 'no result'));
    }

    res.json(successResponse(result));
}));

/**
 * 获取歌词
 * GET /api/qq/lyric?id=xxx
 */
router.get('/lyric', asyncHandler(async (req, res) => {
    const { id } = req.query;
    const missing = validateRequired(req.query, ['id']);
    if (missing) return res.json(errorResponse(missing));

    const result = await getQQLyric(id);
    if (!result) {
        return res.json(successResponse({ lyric: '', translation: '' }, 'no lyric'));
    }

    res.json(successResponse(result));
}));

/**
 * 获取歌曲详情
 * GET /api/qq/detail?id=xxx
 */
router.get('/detail', asyncHandler(async (req, res) => {
    const { id } = req.query;
    const missing = validateRequired(req.query, ['id']);
    if (missing) return res.json(errorResponse(missing));

    const detail = await getQQDetail(id);
    if (!detail) {
        return res.json(successResponse(null, 'no detail'));
    }

    res.json(successResponse(detail));
}));

/**
 * 获取歌单
 * GET /api/qq/playlist?id=xxx&limit=10
 */
router.get('/playlist', asyncHandler(async (req, res) => {
    const { id } = req.query;
    const missing = validateRequired(req.query, ['id']);
    if (missing) return res.json(errorResponse(missing));

    const limit = clampNumber(req.query, 'limit', 10, 1, 30);
    const playlist = await getQQPlaylist(id, limit);

    if (!playlist) {
        return res.json(successResponse(null, 'no playlist'));
    }

    res.json(successResponse(playlist));
}));

export default router;
