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
            name: "send_image",
            description: "发送图片消息。支持URL或本地路径。",
            parameters: {
                type: "object",
                properties: {
                    url: {
                        type: "string",
                        description: "图片URL或本地路径"
                    },
                    caption: {
                        type: "string",
                        description: "图片说明文字（可选）"
                    }
                },
                required: ["url"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "send_voice",
            description: "发送语音消息。将文本转换为语音发送。",
            parameters: {
                type: "object",
                properties: {
                    text: {
                        type: "string",
                        description: "要转换为语音的文本内容"
                    }
                },
                required: ["text"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "send_private_message",
            description: "发送私聊消息给指定用户。",
            parameters: {
                type: "object",
                properties: {
                    user_id: {
                        type: "string",
                        description: "接收消息的用户ID"
                    },
                    message: {
                        type: "string",
                        description: "消息内容"
                    }
                },
                required: ["user_id", "message"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "forward_message",
            description: "转发消息到其他群组。",
            parameters: {
                type: "object",
                properties: {
                    target_group_id: {
                        type: "string",
                        description: "目标群组ID"
                    },
                    message: {
                        type: "string",
                        description: "要转发的消息内容"
                    }
                },
                required: ["target_group_id", "message"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "set_essence_message",
            description: "设置群精华消息（需要Bot是管理员）。",
            parameters: {
                type: "object",
                properties: {
                    message_id: {
                        type: "string",
                        description: "要设为精华的消息ID"
                    }
                },
                required: ["message_id"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "search_music",
            description: "搜索并发送音乐。根据歌曲名称或歌手搜索音乐，自动发送第一首匹配的歌曲卡片。",
            parameters: {
                type: "object",
                properties: {
                    keyword: {
                        type: "string",
                        description: "搜索关键词，可以是歌曲名、歌手名或两者组合"
                    },
                    platform: {
                        type: "string",
                        enum: ["netease", "tencent", "kugou", "kuwo"],
                        description: "音乐平台：netease(网易云音乐)、tencent(QQ音乐)、kugou(酷狗音乐)、kuwo(酷我音乐)，默认kugou"
                    }
                },
                required: ["keyword"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_lyrics",
            description: "获取歌曲歌词。根据歌曲名称或歌手搜索歌曲并返回歌词内容，支持显示翻译歌词。",
            parameters: {
                type: "object",
                properties: {
                    keyword: {
                        type: "string",
                        description: "搜索关键词，可以是歌曲名、歌手名或两者组合"
                    },
                    platform: {
                        type: "string",
                        enum: ["netease", "tencent", "kugou", "kuwo"],
                        description: "音乐平台：netease(网易云音乐)、tencent(QQ音乐)、kugou(酷狗音乐)、kuwo(酷我音乐)，默认kugou"
                    },
                    show_translation: {
                        type: "boolean",
                        description: "是否显示翻译歌词（如果有），默认true"
                    }
                },
                required: ["keyword"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_playlist",
            description: "获取歌单内容。根据歌单ID或分享链接获取歌单中的歌曲列表，返回歌单名称、描述和歌曲列表。",
            parameters: {
                type: "object",
                properties: {
                    playlist_id: {
                        type: "string",
                        description: "歌单ID，可以从歌单分享链接中获取"
                    },
                    platform: {
                        type: "string",
                        enum: ["netease", "tencent", "kugou", "kuwo"],
                        description: "音乐平台：netease(网易云音乐)、tencent(QQ音乐)、kugou(酷狗音乐)、kuwo(酷我音乐)，默认kugou"
                    },
                    limit: {
                        type: "integer",
                        description: "返回歌曲数量限制，默认10首，最多30首"
                    }
                },
                required: ["playlist_id"]
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
