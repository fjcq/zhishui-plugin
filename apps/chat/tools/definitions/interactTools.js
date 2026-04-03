/**
 * 互动工具定义
 * 定义AI可调用的互动相关工具
 */

export const interactTools = [
    {
        type: "function",
        function: {
            name: "poke_user",
            description: "戳一戳用户（群聊双击头像效果）。注意：此功能需要NapCatQQ的PacketBackend支持，如果QQ版本不兼容会失败，失败时请改用表情包互动。",
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
            description: `生成表情包图片，用头像制作趣味动态表情。这是一个增强互动体验的工具。

【主动使用场景】你应该主动使用表情包来增强互动：
- 用户情绪低落、难过、委屈时 → 发送"摸头"安慰
- 用户在开玩笑、调侃你时 → 发送"打拳"、"爬"等调侃回应
- 用户说喜欢你、表达好感时 → 发送"亲亲"、"贴贴"回应
- 用户在撒娇、卖萌时 → 发送"摸头"、"抱抱"配合
- 用户生气、抱怨时 → 发送"摸头"安抚
- 想要表达某种情绪但文字不够生动时

【表情关键词】
- 安慰/关心：摸头、petpet、抱抱、加油
- 调侃/互动：爬、打拳、锤、扔、弹、踢、撕
- 亲密/好感：亲亲、贴贴、kiss、rub（双头像）
- 其他：玩、拍、结婚申请、小天使

【参数说明】
- keyword: 表情关键词
- user_id: 目标用户QQ号（系统自动获取头像）
- user_id_2: 第二个用户QQ号（仅亲亲、贴贴等双头像表情需要）`,
            parameters: {
                type: "object",
                properties: {
                    keyword: {
                        type: "string",
                        description: "表情关键词，如：摸头、petpet、爬、打拳、亲亲、贴贴等"
                    },
                    user_id: {
                        type: "string",
                        description: "目标用户的QQ号码，系统会自动获取该用户的头像"
                    },
                    user_id_2: {
                        type: "string",
                        description: "第二个用户的QQ号码（仅kiss、贴贴等双头像表情需要）"
                    },
                    text: {
                        type: "string",
                        description: "附加文字参数（部分表情支持，如'交个朋友'需要填名字）"
                    }
                },
                required: ["keyword", "user_id"]
            }
        }
    }
];
