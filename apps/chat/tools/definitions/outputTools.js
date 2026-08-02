/**
 * 输出工具定义
 * 定义AI可调用的输出相关工具
 */

export const outputTools = [
    {
        type: "function",
        function: {
            name: "output_code",
            description: `把代码示例展示给用户。当用户要看代码、或者你需要用代码说明某个解决方案时，用这个能力把代码清晰地呈现出来。

【什么时候用】
- 用户请求代码示例
- 需要用代码片段说明某个概念
- 给用户可复制粘贴的完整代码

【参数】
- code：代码内容
- language：编程语言（如 javascript、python、java、csharp、cpp、go、rust、typescript、html、css、sql、bash、易语言 等）
- description：这段代码是做什么的，简要说明
- filename：建议的文件名（可选），如 main.js、utils.py

【提示】
- 一次只展示一段代码
- 代码要完整、能运行
- 加必要的注释
- 在回复里简短说一句这段代码做什么就行，代码本身用这个能力展示`,
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
