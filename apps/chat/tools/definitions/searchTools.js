/**
 * 联网搜索工具定义
 * 定义AI可调用的网络搜索相关工具
 */

export const searchTools = [
    {
        type: "function",
        function: {
            name: "web_search",
            description: `联网查一下你不知道的信息。当用户问的事你不太确定、或者需要最新资讯时，可以查一下再回答。

【什么时候查】
- 用户问最近发生的事、新闻、热点
- 你不太确定或不知道的事实
- 需要实时数据（天气、股价、赛事结果等）
- 用户明确让你"查一下"某件事
- 你训练数据之后发生的事

【什么时候不查】
- 音乐相关的内容（用搜歌能力）
- 你已经知道的事
- 闲聊或表达情感

【参数】
- query：要查的关键词，简洁明确效果最好
- max_results：返回几条结果，默认5条

【结果说明】
返回的结果含标题、链接、摘要，你看完后用自己的话告诉用户即可，不要直接念链接或复读摘要。`,
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "搜索查询关键词，建议使用简洁的中文或英文短语"
                    },
                    max_results: {
                        type: "integer",
                        description: "返回的最大结果数量，默认5条，最多10条"
                    }
                },
                required: ["query"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "read_web_page",
            description: `读取一个网页的正文内容，看看链接里到底写了什么。

【什么时候用】
- web_search 搜到的结果摘要不够、需要看原文细节时
- 用户发来链接让你看看里面的内容
- 需要网页中的具体数据、步骤、列表等正文信息

【什么时候不用】
- 音乐、影视相关内容（用对应工具）
- 只是确认某个链接能不能打开

【参数】
- url：网页链接，必须以 http:// 或 https:// 开头

【结果说明】
返回网页标题和正文文本，内容过长会自动截断。看完后用自己的话告诉用户重点，不要大段照搬原文。`,
            parameters: {
                type: "object",
                properties: {
                    url: {
                        type: "string",
                        description: "要读取的网页链接，必须以 http:// 或 https:// 开头"
                    }
                },
                required: ["url"]
            }
        }
    }
];
