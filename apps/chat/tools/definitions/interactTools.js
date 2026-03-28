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
                        enum: ["qq", "netease"],
                        description: "音乐平台：qq(QQ音乐) 或 netease(网易云音乐)，默认qq"
                    }
                },
                required: ["keyword"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "generate_meme",
            description: "生成表情包。使用用户头像或指定图片生成各种有趣的表情包，如摸头、拍打、爬行等。",
            parameters: {
                type: "object",
                properties: {
                    meme_type: {
                        type: "string",
                        description: "表情包类型：petpet(摸头)、crawl(爬行)、slap(拍打)、kiss(亲亲)、rub(蹭蹭)、play(玩弄)、pat(拍)、tear(撕)、punch(拳击)、kick(踢)、cry(哭)、support(加油)、always(一直)、any(任意门)、spin(旋转)、jump(跳)等",
                        "enum": ["petpet", "crawl", "slap", "kiss", "rub", "play", "pat", "tear", "punch", "kick", "cry", "support", "always", "any", "spin", "jump", "throw", "wall", "eat", "my_friend", "looklook"]
                    },
                    user_id: {
                        type: "string",
                        description: "目标用户ID，用于获取头像，可省略则使用当前对话用户"
                    },
                    text: {
                        type: "string",
                        description: "表情包上的文字（可选，部分表情包支持）"
                    }
                },
                required: ["meme_type"]
            }
        }
    }
];
