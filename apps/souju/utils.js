/**
 * 判断对象是否不为undefined且不为null、NaN
 * @param {any} obj - 待检查的对象。
 * @returns {boolean} - 如果 obj 既不是 undefined，也不是 null，也不是 NaN，则返回 true；否则返回 false。
 */
export function isNotNull(obj) {
    // 检查 obj 是否为 undefined 或 null
    if (obj === undefined || obj === null) { return false; }

    // 使用 Number.isNaN() 来检查 obj 是否为 NaN
    if (Number.isNaN(obj)) { return false; }

    return true;
}

/**
 * 将中文数字字符串转换为等效的阿拉伯数字。
 *
 * @param {string} str - 待转换的中文数字字符串，默认为空字符串。
 * @returns {number} 转换后的阿拉伯数字。
 *
 * @throws {Error} 当输入的中文数字字符串不符合书写规则时，抛出错误。
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
 * 查找线路名称或线路代码在RouteList中的索引
 * @param {string} searchValue - 要查找的线路名称或线路代码
 * @param {Array<Object>} RouteList - 包含线路信息的对象数组
 * @returns {number} - 如果找到匹配的线路名称或线路代码，返回其在RouteList中的索引；否则返回0
 */
export function findRouteIndex(searchValue, RouteList) {
    for (let i = 0; i < RouteList.length; i++) {
        const item = RouteList[i];

        const isNameMatch = (typeof item.RouteName === 'string' && item.RouteName.trim() !== '') &&
            item.RouteName.trim() === searchValue.trim();
        const isCodeMatch = (typeof item.RouteCode === 'string' && item.RouteCode.trim() !== '') &&
            item.RouteCode.trim() === searchValue.trim();

        if (isNameMatch || isCodeMatch) {
            return i;
        }
    }

    // 查找失败，返回0
    return 0;
}

/**
 * 提取搜索关键词
 * @param {string} message 用户输入的消息
 * @returns {string} 搜索关键词
 */
export function extractSearchKeyword(message) {
    const match = message.match(/搜剧(.*)/);
    return match ? match[1].trim() : '';
}
