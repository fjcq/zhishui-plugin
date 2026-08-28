/**
 * 入群验证随机问题生成器
 * 混合随机算术题与常识题，答案归一化匹配，防止脚本机器人预先枚举题库
 */

/**
 * 常识题库（question 为题面，answers 为可接受的答案列表）
 */
const COMMON_QUESTIONS = [
    { question: '一年有几个月？', answers: ['12', '十二'] },
    { question: '一周有几天？', answers: ['7', '七'] },
    { question: '一天有几个小时？', answers: ['24', '二十四'] },
    { question: '中国的首都是哪座城市？', answers: ['北京'] },
    { question: '太阳从哪个方向升起？', answers: ['东', '东边', '东方'] },
    { question: '猫是"喵喵"叫还是"汪汪"叫？', answers: ['喵喵', '喵'] },
    { question: '西瓜是长在哪里的？', answers: ['地上', '地里', '藤上', '蔓上'] },
    { question: '鱼用什么呼吸？', answers: ['鳃', '腮', '鳃呼吸'] }
];

/**
 * 生成 [min, max] 区间随机整数
 * @param {number} min - 最小值（含）
 * @param {number} max - 最大值（含）
 * @returns {number} 随机整数
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 生成随机算术题（加/减/乘）
 * @returns {{question: string, answers: string[]}} 问题对象
 */
function generateMathQuestion() {
    const type = randomInt(1, 3);
    let a;
    let b;
    let symbol;
    let result;

    if (type === 1) {
        a = randomInt(3, 30);
        b = randomInt(3, 30);
        symbol = '+';
        result = a + b;
    } else if (type === 2) {
        a = randomInt(10, 50);
        b = randomInt(1, a - 1);
        symbol = '-';
        result = a - b;
    } else {
        a = randomInt(2, 9);
        b = randomInt(2, 9);
        symbol = '×';
        result = a * b;
    }

    return {
        question: `请计算：${a} ${symbol} ${b} = ?`,
        answers: [String(result)]
    };
}

/**
 * 生成随机验证问题
 * 算术题与常识题随机混合，算术题参数每次随机生成
 * @returns {{question: string, answers: string[]}} 问题对象
 */
export function generateQuestion() {
    if (Math.random() < 0.6) {
        return generateMathQuestion();
    }
    const item = COMMON_QUESTIONS[randomInt(0, COMMON_QUESTIONS.length - 1)];
    return { question: item.question, answers: item.answers };
}

/**
 * 归一化答案文本：全角转半角、去空白与标点、统一小写
 * @param {string} text - 原始文本
 * @returns {string} 归一化后的文本
 */
export function normalizeAnswer(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    let normalized = text.trim();

    // 全角字符转半角（空格、数字、字母与常用符号区间）
    normalized = normalized.replace(/[\uFF01-\uFF5E]/g, ch =>
        String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
    );
    normalized = normalized.replace(/\u3000/g, ' ');

    // 去空白与标点
    normalized = normalized.replace(/[\s\p{P}\p{S}]+/gu, '');

    return normalized.toLowerCase();
}

/**
 * 校验用户回答是否匹配答案
 * 数字答案提取回复中的数字精确比较，文本答案做包含匹配
 * @param {string} replyText - 用户回复文本
 * @param {string[]} answers - 可接受的答案列表
 * @returns {boolean} 是否通过
 */
export function checkAnswer(replyText, answers) {
    const normalized = normalizeAnswer(replyText);
    if (!normalized || !Array.isArray(answers) || answers.length === 0) {
        return false;
    }

    return answers.some(answer => {
        const normAnswer = normalizeAnswer(answer);
        if (!normAnswer) {
            return false;
        }

        // 数字答案：提取回复中的所有数字，精确匹配
        if (/^\d+$/.test(normAnswer)) {
            const nums = normalized.match(/\d+/g) || [];
            return nums.includes(normAnswer);
        }

        // 文本答案：完全匹配或包含匹配
        return normalized === normAnswer || normalized.includes(normAnswer);
    });
}
