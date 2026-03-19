/**
 * 错误处理器
 */

/**
 * 处理通信错误
 * @param {Error} error - 错误对象
 * @param {string} apiType - API类型
 * @returns {Promise<never>} 抛出详细错误
 */
export async function handleCommunicationError(error, apiType) {
    console.error('[openAi] 与 AI 通信时发生错误:', error.message);

    let errorType = '未知错误';
    let errorMessage = '与 AI 通信时发生错误，请稍后重试。';

    if (error.message.includes('API密钥无效') || error.message.includes('invalid_api_key') || error.message.includes('Unauthorized')) {
        errorType = 'API密钥错误';
        errorMessage = `【${apiType.toUpperCase()} API密钥无效】请检查配置文件中的API密钥是否正确`;
    } else if (error.message.includes('地区无法使用') || error.message.includes('User location is not supported')) {
        errorType = '地区限制';
        errorMessage = `【地区限制】当前地区无法访问${apiType.toUpperCase()} API，建议：1.使用VPN/代理 2.切换到其他API`;
    } else if (error.message.includes('请求过于频繁') || error.message.includes('rate_limit_exceeded')) {
        errorType = '频率限制';
        errorMessage = `【请求频繁】${apiType.toUpperCase()} API请求过于频繁，请稍后重试`;
    } else if (error.code === 'ENOTFOUND') {
        errorType = 'DNS解析失败';
        errorMessage = `【网络错误】无法解析${apiType.toUpperCase()} API域名，请检查：1.网络连接 2.DNS设置 3.API地址是否正确`;
    } else if (error.code === 'ECONNREFUSED') {
        errorType = '连接被拒绝';
        errorMessage = `【网络错误】连接${apiType.toUpperCase()} API被拒绝，请检查：1.网络连接 2.防火墙设置 3.代理配置`;
    } else if (error.code === 'ETIMEDOUT') {
        errorType = '连接超时';
        errorMessage = `【网络超时】连接${apiType.toUpperCase()} API超时，可能原因：1.网络较慢 2.服务器繁忙 3.需要代理`;
    } else if (error.code === 'ECONNRESET') {
        errorType = '连接重置';
        errorMessage = `【网络错误】与${apiType.toUpperCase()} API连接被重置，建议：1.检查网络稳定性 2.尝试使用代理`;
    } else if (error.message.includes('quota_exceeded') || error.message.includes('配额')) {
        errorType = 'API配额不足';
        errorMessage = `【配额用完】${apiType.toUpperCase()} API配额已用完，请：1.充值续费 2.等待配额重置 3.切换其他API`;
    } else if (error.message.includes('model') && error.message.includes('invalid')) {
        errorType = '模型无效';
        errorMessage = `【模型错误】${apiType.toUpperCase()} API不支持当前模型，请检查模型名称是否正确`;
    }

    console.error(`[错误分析] 类型: ${errorType}, API: ${apiType}, 错误: ${error.message}`);

    const detailedError = new Error(errorMessage);
    detailedError.type = errorType;
    detailedError.apiType = apiType;
    throw detailedError;
}
