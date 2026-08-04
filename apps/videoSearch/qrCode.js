/**
 * 搜剧播放链接二维码工具
 * 当开启 qrCodeLink 开关后，将播放链接以二维码图片形式发送，规避链接风控
 * 同时服务于用户指令（#看剧、#我的搜剧）与 AI 工具（get_video_play_url）
 * 采用卡片式布局：圆角卡片背景 + 白色二维码区 + 圆点数据 + 圆角矩形定位角 + 底部"扫码观看"文字
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Config, logger } from '../../components/index.js';

/** qrcode 模块缓存，避免重复动态加载 */
let qrCodeModule = null;

/** qrcode 模块加载状态：null=未检测，true=可用，false=不可用 */
let qrCodeAvailable = null;

/** 二维码纠错级别：H=最高，配合圆点美化保证可识别性 */
const QR_ERROR_CORRECTION = 'H';

/** 二维码边缘留白模块数 */
const QR_MARGIN = 4;

/** 单个模块像素尺寸（SVG 坐标系） */
const MODULE_SIZE = 10;

/** 圆点半径占模块的比例，0.44 让圆点之间留出明显间隙，视觉更精致 */
const DOT_RADIUS_RATIO = 0.44;

/** 定位角圆角占模块尺寸的比例，外圈最大，内圈最小 */
const FINDER_OUTER_RADIUS_RATIO = 0.8;
const FINDER_MIDDLE_RADIUS_RATIO = 0.6;
const FINDER_CORE_RADIUS_RATIO = 0.4;

/** 前景色：深蓝灰，比纯黑柔和 */
const QR_FOREGROUND_COLOR = '#2c3e50';

/** 二维码底色：纯白，保证扫描识别率 */
const QR_BACKGROUND_COLOR = '#ffffff';

/** 卡片背景色：极浅米黄，与纯白二维码形成柔和层次 */
const QR_CARD_BG_COLOR = '#fdfcf8';

/** 副标题文字色：中灰，与主标题形成层级 */
const QR_SUBTITLE_COLOR = '#7f8c8d';

/** 卡片内边距（像素），给二维码留呼吸空间 */
const CARD_PADDING = 28;

/** 卡片圆角半径（像素） */
const CARD_RADIUS = 18;

/** 二维码区域圆角半径（像素） */
const QR_AREA_RADIUS = 12;

/** 底部文字区域高度（像素） */
const FOOTER_HEIGHT = 76;

/** 主标题字号（像素） */
const TITLE_FONT_SIZE = 22;

/** 副标题字号（像素） */
const SUBTITLE_FONT_SIZE = 13;

/** 字体栈，优先使用系统中文字体 */
const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";

/** puppeteer 渲染设备缩放因子，2x 提升清晰度 */
const RENDER_SCALE_FACTOR = 2;

/**
 * 动态加载 qrcode 模块
 * 加载失败时缓存失败状态，避免后续重复尝试影响性能
 * @returns {Promise<object|null>} qrcode 模块或 null
 */
async function loadQrCodeModule() {
    if (qrCodeAvailable === false) {
        return null;
    }
    if (qrCodeModule) {
        return qrCodeModule;
    }
    try {
        qrCodeModule = await import('qrcode');
        qrCodeAvailable = true;
        return qrCodeModule;
    } catch (error) {
        logger.warn(`[搜剧二维码] qrcode 模块未安装，二维码功能不可用：${error.message}`);
        qrCodeAvailable = false;
        return null;
    }
}

/**
 * 检查二维码功能是否可用
 * 用于外部判断是否需要回退到文本链接模式
 * @returns {Promise<boolean>}
 */
export async function isQrCodeAvailable() {
    return (await loadQrCodeModule()) !== null;
}

/**
 * 判断是否开启了二维码链接模式
 * 读取 videoSearch.yaml 中的 qrCodeLink 配置项
 * @returns {boolean}
 */
export function isQrCodeLinkEnabled() {
    return !!Config.SearchVideos?.qrCodeLink;
}

/**
 * 获取二维码图片保存目录
 * 固定使用 resources/output/qrcode/，该目录被 .gitignore 忽略
 * @returns {string} 目录绝对路径
 */
function getQrCodeSaveDir() {
    const pluginPath = path.join(process.cwd(), 'plugins', 'zhishui-plugin');
    const saveDir = path.join(pluginPath, 'resources', 'output', 'qrcode');
    if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
    }
    return saveDir;
}

/**
 * 判断模块是否位于三个定位角区域内
 * 定位角是 7x7 模块的标准图案，位置固定：左上、右上、左下
 * @param {number} row - 行索引
 * @param {number} col - 列索引
 * @param {number} size - QR 矩阵尺寸
 * @returns {boolean}
 */
function isInFinderArea(row, col, size) {
    const inTopLeft = row < 7 && col < 7;
    const inTopRight = row < 7 && col >= size - 7;
    const inBottomLeft = row >= size - 7 && col < 7;
    return inTopLeft || inTopRight || inBottomLeft;
}

/**
 * 构造单个定位角的 SVG 元素
 * 采用圆角矩形三层嵌套（外圈、中间白、内核），呈现精致的"回"字结构
 * @param {number} originX - 定位角左上角 X 坐标
 * @param {number} originY - 定位角左上角 Y 坐标
 * @returns {string} SVG 片段
 */
function buildFinderPattern(originX, originY) {
    const outerSize = 7 * MODULE_SIZE;
    const middleSize = 5 * MODULE_SIZE;
    const coreSize = 3 * MODULE_SIZE;
    const middleOffset = (outerSize - middleSize) / 2;
    const coreOffset = (outerSize - coreSize) / 2;

    return [
        `<rect x="${originX}" y="${originY}" width="${outerSize}" height="${outerSize}" rx="${MODULE_SIZE * FINDER_OUTER_RADIUS_RATIO}" fill="${QR_FOREGROUND_COLOR}"/>`,
        `<rect x="${originX + middleOffset}" y="${originY + middleOffset}" width="${middleSize}" height="${middleSize}" rx="${MODULE_SIZE * FINDER_MIDDLE_RADIUS_RATIO}" fill="${QR_BACKGROUND_COLOR}"/>`,
        `<rect x="${originX + coreOffset}" y="${originY + coreOffset}" width="${coreSize}" height="${coreSize}" rx="${MODULE_SIZE * FINDER_CORE_RADIUS_RATIO}" fill="${QR_FOREGROUND_COLOR}"/>`
    ].join('');
}

/**
 * 构造底部文字区域的 SVG 元素
 * 包含主标题"扫码观看"和副标题"长按识别二维码 · 跳转播放"
 * @param {number} centerX - 文字水平中心点
 * @param {number} titleBaselineY - 主标题基线 Y 坐标
 * @param {number} subtitleBaselineY - 副标题基线 Y 坐标
 * @returns {string} SVG 片段
 */
function buildFooterText(centerX, titleBaselineY, subtitleBaselineY) {
    return [
        `<text x="${centerX}" y="${titleBaselineY}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="${TITLE_FONT_SIZE}" font-weight="600" fill="${QR_FOREGROUND_COLOR}">扫码观看</text>`,
        `<text x="${centerX}" y="${subtitleBaselineY}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="${SUBTITLE_FONT_SIZE}" fill="${QR_SUBTITLE_COLOR}">长按识别二维码 · 跳转播放</text>`
    ].join('');
}

/**
 * 根据播放链接生成卡片式圆点风格二维码的 SVG 字符串
 * 整体布局：圆角卡片背景 + 白色二维码区域 + 圆点数据 + 圆角矩形定位角 + 底部文字提示
 * @param {string} text - 要编码到二维码的文本
 * @returns {Promise<string|null>} SVG 字符串，失败返回 null
 */
async function buildRoundedQrSvg(text) {
    const qrcode = await loadQrCodeModule();
    if (!qrcode) {
        return null;
    }

    try {
        // 用 qrcode.create 获取 QR 矩阵，便于自定义渲染
        const qr = qrcode.create(text, { errorCorrectionLevel: QR_ERROR_CORRECTION });
        const size = qr.modules.size;

        // 二维码本体尺寸（含留白）
        const qrSize = (size + QR_MARGIN * 2) * MODULE_SIZE;

        // 卡片整体尺寸
        const cardWidth = qrSize + CARD_PADDING * 2;
        const cardHeight = qrSize + CARD_PADDING * 2 + FOOTER_HEIGHT;

        // 二维码在卡片中的起点
        const qrOriginX = CARD_PADDING;
        const qrOriginY = CARD_PADDING;

        const elements = [];

        // 1. 卡片背景（极浅米黄圆角矩形）
        elements.push(`<rect width="${cardWidth}" height="${cardHeight}" fill="${QR_CARD_BG_COLOR}" rx="${CARD_RADIUS}"/>`);

        // 2. 二维码白色圆角背景，与卡片形成柔和层次
        elements.push(`<rect x="${qrOriginX}" y="${qrOriginY}" width="${qrSize}" height="${qrSize}" fill="${QR_BACKGROUND_COLOR}" rx="${QR_AREA_RADIUS}"/>`);

        // 3. 三个定位角：左上、右上、左下，采用圆角矩形三层嵌套
        const finderPositions = [
            { row: 0, col: 0 },
            { row: 0, col: size - 7 },
            { row: size - 7, col: 0 }
        ];
        for (const pos of finderPositions) {
            const fx = qrOriginX + (pos.col + QR_MARGIN) * MODULE_SIZE;
            const fy = qrOriginY + (pos.row + QR_MARGIN) * MODULE_SIZE;
            elements.push(buildFinderPattern(fx, fy));
        }

        // 4. 数据点：圆点风格，跳过定位角区域（已单独绘制）
        const radius = (MODULE_SIZE / 2) * DOT_RADIUS_RATIO;
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                if (qr.modules.get(row, col) && !isInFinderArea(row, col, size)) {
                    const cx = qrOriginX + (col + QR_MARGIN) * MODULE_SIZE + MODULE_SIZE / 2;
                    const cy = qrOriginY + (row + QR_MARGIN) * MODULE_SIZE + MODULE_SIZE / 2;
                    elements.push(`<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${QR_FOREGROUND_COLOR}"/>`);
                }
            }
        }

        // 5. 底部文字提示
        const textCenterX = cardWidth / 2;
        const titleBaselineY = qrOriginY + qrSize + 38;
        const subtitleBaselineY = titleBaselineY + 24;
        elements.push(buildFooterText(textCenterX, titleBaselineY, subtitleBaselineY));

        return `<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}">${elements.join('')}</svg>`;
    } catch (error) {
        logger.error(`[搜剧二维码] 构造圆点 SVG 失败：${error.message}`);
        return null;
    }
}

/**
 * 用项目共享的 puppeteer 实例将 SVG 渲染为 PNG 文件
 * 利用 deviceScaleFactor 2x 输出高清图，避免锯齿
 * @param {string} svg - SVG 字符串
 * @param {string} filePath - 输出 PNG 文件路径
 * @param {number} svgWidth - SVG 宽度（像素）
 * @param {number} svgHeight - SVG 高度（像素）
 * @returns {Promise<boolean>} 是否渲染成功
 */
async function renderSvgToPng(svg, filePath, svgWidth, svgHeight) {
    let puppeteerInstance;
    try {
        const mod = await import('../../lib/puppeteer/puppeteer.js');
        puppeteerInstance = mod.default;
    } catch (error) {
        logger.error(`[搜剧二维码] 加载 puppeteer 模块失败：${error.message}`);
        return false;
    }

    if (!(await puppeteerInstance.launch())) {
        logger.error('[搜剧二维码] puppeteer 启动失败');
        return false;
    }

    const page = await puppeteerInstance.browser.newPage();
    try {
        const renderWidth = svgWidth * RENDER_SCALE_FACTOR;
        const renderHeight = svgHeight * RENDER_SCALE_FACTOR;
        await page.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;}body{width:${renderWidth}px;height:${renderHeight}px;background:transparent;}svg{width:100%;height:100%;display:block;}</style></head><body>${svg}</body></html>`, { waitUntil: 'load' });
        await page.setViewport({ width: renderWidth, height: renderHeight, deviceScaleFactor: 1 });
        await page.screenshot({ path: filePath, type: 'png', omitBackground: false, clip: { x: 0, y: 0, width: renderWidth, height: renderHeight } });
        return true;
    } catch (error) {
        logger.error(`[搜剧二维码] puppeteer 渲染失败：${error.message}`);
        return false;
    } finally {
        await page.close().catch(() => { });
    }
}

/**
 * 生成播放链接的二维码图片
 * 相同链接复用同一文件（基于 md5 哈希命名），避免文件无限增长
 * 采用圆点风格 SVG，用 puppeteer 渲染为 PNG
 * @param {string} text - 要编码到二维码的文本（通常是播放链接）
 * @returns {Promise<string|null>} 二维码图片的 file:/// URI，失败返回 null
 */
export async function generateQrCodeImage(text) {
    if (!text || typeof text !== 'string') {
        return null;
    }

    const qrcode = await loadQrCodeModule();
    if (!qrcode) {
        return null;
    }

    try {
        const saveDir = getQrCodeSaveDir();
        const hash = crypto.createHash('md5').update(text).digest('hex');
        const filePath = path.join(saveDir, `${hash}.png`);

        // 已存在则直接复用，避免重复生成
        if (!fs.existsSync(filePath)) {
            const svg = await buildRoundedQrSvg(text);
            if (!svg) {
                return null;
            }

            // 从 SVG 中分别提取宽度和高度用于渲染（卡片非正方形）
            const widthMatch = svg.match(/width="(\d+)"/);
            const heightMatch = svg.match(/height="(\d+)"/);
            const svgWidth = widthMatch ? parseInt(widthMatch[1], 10) : 320;
            const svgHeight = heightMatch ? parseInt(heightMatch[1], 10) : 320;

            const ok = await renderSvgToPng(svg, filePath, svgWidth, svgHeight);
            if (!ok) {
                return null;
            }
        }

        // 转换为 file:/// 协议路径，确保跨平台兼容
        const fileUri = `file:///${filePath.replace(/\\/g, '/')}`;
        return fileUri;
    } catch (error) {
        logger.error(`[搜剧二维码] 生成二维码失败：${error.message}`);
        return null;
    }
}

/**
 * 获取全局 segment 对象
 * index.js 启动时已确保 global.segment 可用
 * @returns {object|null}
 */
export function getSegment() {
    if (typeof global !== 'undefined' && global.segment) {
        return global.segment;
    }
    return null;
}

/**
 * 发送播放链接二维码图片到对话
 * 生成失败时返回 false，调用方可据此回退到文本链接
 * @param {object} e - 事件对象
 * @param {string} text - 要编码到二维码的文本
 * @returns {Promise<boolean>} 是否发送成功
 */
export async function sendQrCodeImage(e, text) {
    const fileUri = await generateQrCodeImage(text);
    if (!fileUri) {
        return false;
    }

    const segment = getSegment();
    if (!segment) {
        logger.error('[搜剧二维码] segment 模块不可用，无法发送图片');
        return false;
    }

    try {
        await e.reply(segment.image(fileUri));
        return true;
    } catch (error) {
        logger.error(`[搜剧二维码] 发送二维码图片失败：${error.message}`);
        return false;
    }
}
