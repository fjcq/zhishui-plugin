/**
 * 互动工具定义
 * 定义AI可调用的互动相关工具
 */

export const interactTools = [
    {
        type: "function",
        function: {
            name: "poke_user",
            description: "戳一戳用户（群聊双击头像效果）。用于友好互动或引起注意。",
            parameters: {
                type: "object",
                properties: {
                    user_id: {
                        type: "string",
                        description: "要戳一戳的用户ID，可省略则戳当前对话用户"
                    }
                },
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "generate_meme",
            description: `生成并发送表情包。这是一个可选的互动工具，用于在合适的时机增加对话趣味性。

【重要原则】
- 表情包是可选的，不是每次对话都需要使用
- 大多数情况下，用文字回复就足够了
- 只在真正合适的时机使用，不要强行使用
- 如果用户只是普通聊天、提问、讨论问题，不需要发表情

【合适的时机】
- 用户情绪低落、需要安慰时（发送petpet摸头、support加油）
- 用户在开玩笑、调侃时，可以配合回应（发送slap拍打、kick踢）
- 用户明确要求或期待互动时
- 想要表达某种强烈情绪时

【不合适的时机】
- 用户在认真提问或讨论问题
- 用户需要信息或帮助
- 对话内容严肃或正式
- 用户只是简单打招呼

【表情类型】
安慰类: petpet(摸头), support(加油), rub(蹭蹭)
调侃类: slap(拍打), kick(踢), throw(扔), punch(拳击), crawl(爬行)
互动类: kiss(亲亲), play(玩弄), pat(拍)
情绪类: cry(哭), jump(跳), wall(墙), eat(吃), always(一直), any(任意门)
文字类: my_friend(需填名字), spin(选填圈数), looklook(选填"翻转")`,
            parameters: {
                type: "object",
                properties: {
                    meme_type: {
                        type: "string",
                        description: "表情包类型",
                        "enum": ["petpet", "crawl", "slap", "kiss", "rub", "play", "pat", "tear", "punch", "kick", "cry", "support", "always", "any", "spin", "jump", "throw", "wall", "eat", "my_friend", "looklook"]
                    },
                    user_id: {
                        type: "string",
                        description: "目标用户ID，使用当前对话用户的ID"
                    },
                    text: {
                        type: "string",
                        description: "文字。my_friend必填；spin选填圈数；looklook选填'翻转'"
                    }
                },
                required: ["meme_type", "user_id"]
            }
        }
    }
];
