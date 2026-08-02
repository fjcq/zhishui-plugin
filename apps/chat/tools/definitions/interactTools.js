/**
 * 互动工具定义
 * 定义AI可调用的互动相关工具
 */

export const interactTools = [
    {
        type: "function",
        function: {
            name: "poke_user",
            description: `戳一戳用户（群里双击头像那种效果）。

【什么时候用】
- 想引起用户注意
- 撒娇或调皮一下
- 用户长时间没回应，戳一下提醒
- 表达"我在呢"

【参数】
- user_id：要戳谁，不填就戳当前对话的用户

【提示】
- 群聊里有效
- 偶尔戳一下挺可爱，但别频繁戳，会烦
- 如果戳失败（比如环境不支持），就改用表情包互动`,
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
            description: `用头像做一张趣味的动态表情包发给用户，比单纯发文字更生动。

【主动用的时机】
- 用户低落、难过、委屈时 → 发"摸头"安慰
- 用户在跟你开玩笑、调侃你 → 发"打拳"、"爬"调侃回去
- 用户说喜欢你、表达好感 → 发"亲亲"、"贴贴"回应
- 用户撒娇、卖萌 → 发"摸头"、"抱抱"配合
- 用户生气、抱怨 → 发"摸头"安抚
- 文字不够生动，想用画面表达情绪时

【表情关键词参考】
- 安慰/关心：摸头、petpet、抱抱、加油
- 调侃/互动：爬、打拳、锤、扔、弹、踢、撕
- 亲密/好感：亲亲、贴贴、kiss、rub（双人头像）
- 其他：玩、拍、结婚申请、小天使

【参数】
- keyword：表情关键词（如"摸头"、"亲亲"等）
- user_id：用谁的头像做表情（系统会自动拿头像）
- user_id_2：第二个人的头像（仅亲亲、贴贴等双人表情需要）
- text：附加文字（部分表情支持）`,
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
