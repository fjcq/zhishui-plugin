/**
 * 判断对象是否不为undefined且不为null、NaN
 * @param obj 对象
 * @returns obj==null/undefined,return false,other return true
 */
export function isNotNull(obj) {
    if (obj == undefined || obj == null || obj != obj) { return false; }
    return true;
}

/**
 * 将OpenAI错误消息转换为简洁易懂的中文描述。
 * @param {Object} errorData - 包含错误信息的对象。
 * @returns {string} 转换后的中文描述。
 */
export function parseErrorMessage(errorData) {
    // 兼容 code/message 格式（如 deepseek）
    if (errorData && typeof errorData === 'object') {
        if (typeof errorData.message === 'string' && errorData.message) {
            // Gemini 地区限制友好提示
            if (errorData.message.includes('User location is not supported for the API use')) {
                return '当前地区无法使用 Gemini API，请更换为支持的地区（如美国、日本等）或使用代理。';
            }
            return errorData.message;
        }
        if (typeof errorData.error === 'object' && errorData.error && typeof errorData.error.message === 'string') {
            // Gemini 地区限制友好提示
            if (errorData.error.message.includes('User location is not supported for the API use')) {
                return '当前地区无法使用 Gemini API，请更换为支持的地区（如美国、日本等）或使用代理。';
            }
            // OpenAI 风格
            const errorMessage = errorData.error.message;
            const errorCode = errorData.error.code;
            let response;
            switch (errorCode) {
                case "account_deactivated":
                    response = "您的OpenAI账户已被停用。";
                    break;
                case "invalid_request_error":
                    response = "请求无效：" + errorMessage + "，请检查您的请求参数。";
                    break;
                case "rate_limit_exceeded":
                    response = "请求频率过高，请稍后重试。";
                    break;
                case "quota_exceeded":
                    response = "您已超出当前配额，请检查您的计划和账单详情。";
                    break;
                case "invalid_api_key":
                    response = "API密钥无效，请检查您的API密钥是否正确。";
                    break;
                case "invalid_model":
                    response = "指定的模型无效，请检查模型名称是否正确。";
                    break;
                case "invalid_parameter":
                    response = "请求参数无效：" + errorMessage + "，请检查您的参数设置。";
                    break;
                case "missing_parameter":
                    response = "缺少必要参数：" + errorMessage + "，请补充缺失的参数。";
                    break;
                case "service_unavailable":
                    response = "服务暂时不可用，请稍后再试。";
                    break;
                case "internal_server_error":
                    response = "服务器内部错误：" + errorMessage + "，请稍后再试或联系支持人员。";
                    break;
                case "content_too_long":
                    response = "内容过长，请缩短输入内容。";
                    break;
                case "context_error":
                    response = "上下文错误：" + errorMessage + "，请检查您的上下文设置。";
                    break;
                default:
                    response = "出现了一个问题：" + errorMessage + "，请稍后再试或联系支持人员。";
            }
            if (response.length > 100) {
                response = "出现了一个问题：" + errorMessage.substring(0, 80) + "...，请稍后再试或联系支持人员。";
            }
            return response;
        }
    }
    // 兜底
    return '与 AI 通信时发生错误，请稍后重试。';
}

/**
 * 发送转发消息
 * @param data 输入一个数组,元素是字符串,每一个元素都是一条消息.
*/
export async function ForwardMsg(e, data) {
    // use map method to create msgList
    const msgList = data.map(i => ({
        message: i,
        NickName: Bot.NickName,
        user_id: Bot.uin
    }));
    // use ternary operator to simplify if...else statement
    await e.reply(msgList.length == 1 ? msgList[0].message : await Bot.makeForwardMsg(msgList));
}

/**
 * 发送转发图片消息
 * @param data 输入一个数组,元素是字符串,每一个元素都是一个图片链接.
*/
export async function ForwardImageMsg(e, data) {
    let msgList = [];
    for (let i = 0; i < data.length; i++) {
        let msg2 = await segment.image(data[i]);
        msgList.push({
            message: msg2,
            nickname: Bot.nickname,
            user_id: Bot.uin,
        });
    }
    console.log(msgList);
    if (msgList.length == 0) {
        await e.reply(msgList[0].message);
    }
    else {
        await e.reply(await Bot.makeForwardMsg(msgList));
    }
    return;
}

/**
 * 将msg中的号码转成@
 */
export async function msgToAt(msg) {
    let arr = msg.toString()
        .split(/(\[@\d+\])/)
        .filter(Boolean)
        .map((s) => s.startsWith('[@') ? segment.at(parseInt(s.match(/\d+/)[0])) : s);
    return arr;
}

/**
 * 发送代码作为转发消息
 * @param {Object} e - 事件对象
 * @param {string} codeText - 代码文本
 */
export async function sendCodeAsForwardMsg(e, codeText) {
    // 这里可以实现发送代码作为转发消息的逻辑
    // 例如：
    await ForwardMsg(e, [codeText]);
}
