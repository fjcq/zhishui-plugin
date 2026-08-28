/**
 * 视觉代理模块（新架构版）
 * 主对话模型无视觉能力时，图片识别委托给独立配置的视觉模型：
 * 由configs/manager.resolveVisionModel解析（visionModel指定 > 自动扫描），
 * 调用统一走providers层（openai格式走SDK、gemini走原生格式），不再手写fetch分支。
 */

import { logger } from '../../../components/index.js';
import { resolveVisionModel } from '../configs/manager.js';
import { createProvider } from '../providers/index.js';

/** 视觉识别请求超时时间（毫秒） */
const VISION_TIMEOUT_MS = 60000;

/**
 * 调用视觉模型识别图片
 * @param {Object} options - 参数对象
 * @param {string} options.base64 - 图片 base64 数据
 * @param {string} options.mime - 图片 MIME 类型（如 image/jpeg）
 * @param {string} [options.prompt] - 识别指令（默认通用描述）
 * @returns {Promise<{success: boolean, description?: string, error?: string}>} 识别结果
 */
export async function analyzeImage({ base64, mime, prompt }) {
    try {
        const vision = await resolveVisionModel();
        if (!vision) {
            return { success: false, error: '没有配置带视觉能力的模型，请在models中配置视觉模型或设置visionModel' };
        }

        const provider = createProvider(vision.provider);
        const question = prompt || '请详细描述这张图片的内容，包括主体、场景、文字信息等。';

        const result = await provider.chat({
            model: vision.model.model,
            messages: [{
                role: 'user',
                content: [
                    { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
                    { type: 'text', text: question }
                ]
            }],
            params: { max_tokens: 1024 },
            timeoutMs: VISION_TIMEOUT_MS
        });

        if (!result.content || !result.content.trim()) {
            return { success: false, error: '视觉模型未返回有效内容' };
        }
        return { success: true, description: result.content.trim() };
    } catch (err) {
        logger.error(`[视觉代理] 识别请求异常: ${err.message}`);
        return { success: false, error: `视觉模型请求异常: ${err.message}` };
    }
}
