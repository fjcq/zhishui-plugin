/**
 * 输出工具定义
 * 定义AI可调用的输出相关工具
 */

export const outputTools = [
    {
        type: "function",
        function: {
            name: "output_code",
            description: `输出代码示例。当你需要向用户展示代码时，使用此工具而不是直接在消息中输出代码块。

【使用场景】
- 用户请求代码示例或解决方案
- 需要展示代码片段来说明某个概念
- 提供可复制粘贴的完整代码

【优势】
- 代码格式清晰，便于用户阅读和复制
- 支持语法高亮显示
- 不会与对话内容混淆
- 更好的对话节奏控制

【注意事项】
- 一次只输出一个代码块
- 代码应当完整、可运行
- 添加必要的注释说明
- 在 message 中简要描述代码功能，代码详情通过此工具输出`,
            parameters: {
                type: "object",
                properties: {
                    code: {
                        type: "string",
                        description: "代码内容"
                    },
                    language: {
                        type: "string",
                        description: "编程语言，如 javascript、python、java、csharp、cpp、go、rust、typescript、html、css、sql、bash、易语言 等"
                    },
                    description: {
                        type: "string",
                        description: "代码功能描述，简要说明这段代码的作用"
                    },
                    filename: {
                        type: "string",
                        description: "建议的文件名（可选），如 main.js、utils.py"
                    }
                },
                required: ["code", "language"]
            }
        }
    }
];
