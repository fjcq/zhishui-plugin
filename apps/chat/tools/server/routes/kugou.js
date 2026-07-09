/**
 * 酷狗音乐路由
 * 提供搜索、播放链接、歌词、详情、歌单接口
 */

import express from 'express';
import { asyncHandler, errorResponse, successResponse, validateRequired, clampNumber } from '../utils/routeHelper.js';
import { kugouSearch } from '../providers/kugou/search.js';
import { getKugouPlayUrl } from '../providers/kugou/songUrl.js';
import { getKugouLyric } from '../providers/kugou/lyric.js';
import { getKugouDetail } from '../providers/kugou/detail.js';
import { getKugouPlaylist } from '../providers/kugou/playlist.js';

const router = express.Router();

/**
 * 搜索酷狗音乐
 * GET /api/kugou/search?keyword=xxx&limit=5
 */
router.get('/search', asyncHandler(async (req, res) => {
    const { keyword } = req.query;
    const missing = validateRequired(req.query, ['keyword']);
    if (missing) return res.json(errorResponse(missing));

    const limit = clampNumber(req.query, 'limit', 5, 1, 30);
    const songs = await kugouSearch(keyword, limit);

    if (!songs || songs.length === 0) {
        return res.json(successResponse({ songs: [] }, 'no results'));
    }

    res.json(successResponse({ songs }));
}));

/**
 * 获取播放链接
 * GET /api/kugou/url?id=xxx
 */
router.get('/url', asyncHandler(async (req, res) => {
    const { id } = req.query;
    const missing = validateRequired(req.query, ['id']);
    if (missing) return res.json(errorResponse(missing));

    const result = await getKugouPlayUrl(id);
    if (!result) {
        return res.json(successResponse({ url: '', canPlay: false, quality: '0' }, 'no result'));
    }

    res.json(successResponse(result));
}));

/**
 * 获取歌词
 * GET /api/kugou/lyric?id=xxx
 */
router.get('/lyric', asyncHandler(async (req, res) => {
    const { id } = req.query;
    const missing = validateRequired(req.query, ['id']);
    if (missing) return res.json(errorResponse(missing));

    const result = await getKugouLyric(id);
    if (!result) {
        return res.json(successResponse({ lyric: '', translation: '' }, 'no lyric'));
    }

    res.json(successResponse(result));
}));

/**
 * 获取歌曲详情
 * GET /api/kugou/detail?id=xxx
 */
router.get('/detail', asyncHandler(async (req, res) => {
    const { id } = req.query;
    const missing = validateRequired(req.query, ['id']);
    if (missing) return res.json(errorResponse(missing));

    const detail = await getKugouDetail(id);
    if (!detail) {
        return res.json(successResponse(null, 'no detail'));
    }

    res.json(successResponse(detail));
}));

/**
 * 获取歌单
 * GET /api/kugou/playlist?id=xxx&limit=10
 */
router.get('/playlist', asyncHandler(async (req, res) => {
    const { id } = req.query;
    const missing = validateRequired(req.query, ['id']);
    if (missing) return res.json(errorResponse(missing));

    const limit = clampNumber(req.query, 'limit', 10, 1, 30);
    const playlist = await getKugouPlaylist(id, limit);

    if (!playlist) {
        return res.json(successResponse(null, 'no playlist'));
    }

    res.json(successResponse(playlist));
}));

export default router;
