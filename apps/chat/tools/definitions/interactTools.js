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
- 用户情绪低落、需要安慰时（发送petpet摸头）
- 用户在开玩笑、调侃时，可以配合回应（发送punch打拳、crawl爬）
- 用户明确要求或期待互动时
- 想要表达某种强烈情绪时

【不合适的时机】
- 用户在认真提问或讨论问题
- 用户需要信息或帮助
- 对话内容严肃或正式
- 用户只是简单打招呼

【表情类型】
安慰类: petpet(摸头), always(一直), support(加油), little_angel(小天使)
调侃类: punch(打拳), crawl(爬), throw(扔), flick(弹), hammer(锤), knock(敲), pound(捣)
互动类: kiss(亲亲), rub(贴贴), play(玩), pat(拍), make_friend(交个朋友), marriage(结婚申请)
【双头像表情】kiss和rub需要两个用户头像，可使用user_id_2指定第二个用户，不填则默认使用你的头像`,
            parameters: {
                type: "object",
                properties: {
                    meme_type: {
                        type: "string",
                        description: "表情包类型",
                        "enum": [
                            "petpet", "crawl", "play", "pat", "punch", "always", "jump", "eat", "bite", "support", "throw",
                            "prpr", "look_flat", "symmetric", "confuse", "dinosaur", "flick", "hammer", "knock", "pound",
                            "jiji_king", "kirby_hammer", "little_angel", "make_friend", "marriage", "need", "look_this_icon",
                            "printing", "pyramid", "perfect", "pinch", "pixelate", "police", "potato", "pass_the_buck",
                            "painter", "paint", "out", "my_friend", "kiss", "rub"
                        ]
                    },
                    user_id: {
                        type: "string",
                        description: "目标用户ID，可以使用用户的QQ号码"
                    },
                    user_id_2: {
                        type: "string",
                        description: "第二个用户的QQ号（仅kiss、rub双头像表情需要）。主动使用场景：当你想调侃两个群友、撮合两人互动、或表达两人关系时，可主动填入另一个群友的QQ号。不填则默认使用你的头像作为第二人"
                    },
                    text: {
                        type: "string",
                        description: "文字参数。my_friend必填名字；petpet/kirby_hammer可选'圆'；always可选'循环'/'套娃'；crawl可选数字(1-92)；symmetric可选'左'/'右'/'上'/'下'；look_flat可选数字(缩放倍数)"
                    }
                },
                required: ["meme_type", "user_id"]
            }
        }
    }
];
