/**
 * 公共工具函数集合
 */

/**
 * 判断对象是否不为undefined且不为null、NaN
 * @param {any} obj - 待检查的对象
 * @returns {boolean} - obj!=null/undefined/NaN时返回true,否则返回false
 */
export function isNotNull(obj) {
    if (obj === undefined || obj === null) { return false; }
    if (Number.isNaN(obj)) { return false; }
    return true;
}

/**
 * 将中文数字字符串转换为等效的阿拉伯数字
 * @param {string} str - 待转换的中文数字字符串
 * @returns {number} 转换后的阿拉伯数字
 * @throws {Error} 当输入的中文数字字符串不符合书写规则时，抛出错误
 */
export function chineseToNumber(str) {
    // 九十二
    const numChar = {
        '零': 0,
        '一': 1,
        '二': 2,
        '三': 3,
        '四': 4,
        '五': 5,
        '六': 6,
        '七': 7,
        '八': 8,
        '九': 9,
    };
    const levelChar = {
        '十': 10,
        '百': 100,
        '千': 1000,
        '万': 10000,
        '亿': 100000000
    };
    let arr = Array.from(str);
    let sum = 0, temp = 0;
    for (let i = 0; i < arr.length; i++) {
        const char = arr[i];
        const num = numChar[char];
        const level = levelChar[char];

        if (num !== undefined) {
            temp = temp * 10 + num;
        } else if (level !== undefined) {
            if (temp === 0) temp = 1;
            temp *= level;
            sum += temp;
            temp = 0;
        } else {
            throw new Error(`无效的中文数字字符: ${char}`);
        }
    }

    sum += temp;
    return sum;
}

/**
 * 发送转发消息
 * @param {Object} e - 事件对象
 * @param {Array} data - 消息数组，元素是字符串，每一个元素都是一条消息
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
 * 将msg中的号码转成@
 * @param {string} msg - 消息内容
 * @returns {Array} - 转换后的消息数组
 */
export async function msgToAt(msg) {
    let arr = msg.toString()
        .split(/(\[@\d+\])/)
        .filter(Boolean)
        .map((s) => s.startsWith('[@') ? segment.at(parseInt(s.match(/\d+/)[0])) : s);
    return arr;
}
