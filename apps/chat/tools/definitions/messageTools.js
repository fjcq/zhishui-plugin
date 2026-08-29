/**
 * 消息工具定义（重新设计 v3）
 * 支持灵活的消息组合，包括多个@、图片、文本混合发送
 */

export const messageTools = [
    {
        type: "function",
        function: {
            name: "send_message",
            description: `给当前对话发消息，可以混合发文本、@、图片等。

【什么时候用】
- 需要发复杂消息（同时有文本和图片、@ 多人等）
- 需要回复某条消息
- 单纯发文本或单张图片可以用更简单的 send_image 等

【两种用法】
1. 用 segments 数组自由组合：按顺序放文本、@、图片、回复等
2. 用 text 文本：在文本里用 @[用户ID] 表示@，用 [image:URL] 表示图片

【参数】
- segments：消息段数组，每段含 type（text/at/image/reply）和对应内容
- text：纯文本消息，支持特殊标记插@和图片
- reply_to：要回复哪条消息（可选，填消息ID）`,
            parameters: {
                type: "object",
                properties: {
                    segments: {
                        type: "array",
                        description: "消息段数组，每个元素是一个消息段对象。按顺序发送。示例：[{\"type\":\"at\",\"user_id\":\"123\"},{\"type\":\"text\",\"text\":\" 你好\"}]",
                        items: {
                            type: "object",
                            properties: {
                                type: {
                                    type: "string",
                                    enum: ["text", "at", "image", "reply"],
                                    description: "消息段类型：text(文本)、at(@某人)、image(图片)、reply(回复)"
                                },
                                text: {
                                    type: "string",
                                    description: "文本内容（type为text时使用）"
                                },
                                user_id: {
                                    type: "string",
                                    description: "用户ID（type为at时使用）"
                                },
                                url: {
                                    type: "string",
                                    description: "图片URL（type为image时使用）"
                                },
                                message_id: {
                                    type: "string",
                                    description: "消息ID（type为reply时使用）"
                                }
                            },
                            required: ["type"]
                        }
                    },
                    text: {
                        type: "string",
                        description: "文本消息。用 @[用户ID] 表示@某人，用 [image:URL] 表示插入图片。示例：\"@[123456] 你好，请问你认识 @[789012] 吗？\" 或 \"看看这张图片 [image:http://example.com/img.jpg]\""
                    },
                    reply_to: {
                        type: "string",
                        description: "要回复的消息ID（可选，会自动添加到消息开头）"
                    }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "send_image",
            description: `发一张图片给用户。

【什么时候用】
- 只想发一张图，不带别的
- 想快速发图，不需要复杂组合

【参数】
- url：图片地址，可以是网址、本地路径或 base64 数据
- file_id：图片文件ID（可选，来自 get_recent_messages 结果中的 images[].file_id），重新发送历史图片时优先用它，链接过期也能通过协议端缓存换取
- caption：图片说明文字（可选）

【提示】
- 如果还要带文字、@ 等其他内容，用 send_message 更合适
- 重发 QQ 聊天中的历史图片时，最好同时带上 url 和 file_id
- 成功后返回 message_id，可用于 recall_message 撤回`,
            parameters: {
                type: "object",
                properties: {
                    url: {
                        type: "string",
                        description: "图片URL、本地路径或base64数据"
                    },
                    file_id: {
                        type: "string",
                        description: "图片文件ID（可选，来自 get_recent_messages 结果中的 images[].file_id），适合重新发送历史图片"
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
            description: `把一段文字用语音发出去，让用户能听到你的声音。

【什么时候用】
- 想让用户听到你说的话，而不只是看文字
- 表达情感时语音更生动
- 用户请求语音消息

【参数】
- text：要说的话（最多500字符）

【提示】
- 需要系统配置好语音才能用，没配置会失败
- 文字不要太长，否则转换慢`,
            parameters: {
                type: "object",
                properties: {
                    text: {
                        type: "string",
                        description: "要转换为语音的文本内容（最多500字符）"
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
            description: "发送私聊消息给指定用户。无论当前在私聊还是群聊，都向指定用户发送私聊消息。成功后返回 message_id，可用于 recall_message 撤回。",
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
            name: "send_group_message",
            description: "发送消息到指定群组。无论当前在私聊还是群聊，都向指定群组发送消息。",
            parameters: {
                type: "object",
                properties: {
                    group_id: {
                        type: "string",
                        description: "目标群组ID"
                    },
                    message: {
                        type: "string",
                        description: "消息内容"
                    }
                },
                required: ["group_id", "message"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "forward_message",
            description: "转发消息到其他群组。成功后返回 message_id，可用于 recall_message 撤回。",
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
            name: "recall_message",
            description: "撤回消息。撤回Bot发送的消息或Bot有权限撤回的消息。",
            parameters: {
                type: "object",
                properties: {
                    message_id: {
                        type: "string",
                        description: "要撤回的消息ID"
                    }
                },
                required: ["message_id"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "set_essence_message",
            description: "设置群精华消息（仅群聊，需要Bot是管理员）。",
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
            name: "get_scene_info",
            description: "获取当前场景信息。返回当前对话场景的详细信息，包括场景类型、用户ID、群组ID、Bot权限等。",
            parameters: {
                type: "object",
                properties: {},
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_group_member_info",
            description: "获取群成员信息（仅群聊）。",
            parameters: {
                type: "object",
                properties: {
                    user_id: {
                        type: "string",
                        description: "用户ID（可选，不传则返回当前用户信息）"
                    }
                },
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_recent_messages",
            description: `获取当前会话最近的聊天记录，看看在你加入对话前大家聊了什么。

【什么时候用】
- 用户提到"刚才说的""之前聊的"内容，而你不知道时
- 想了解当前话题的来龙去脉再回复
- 群里话题接不上、需要上下文时

【什么时候不用】
- 当前消息本身已经说清楚了
- 用户在私聊里只是简单打招呼

【参数】
- count：获取最近多少条，默认10条，最多30条

【结果说明】
按时间从早到晚返回每条消息的 message_id、发送者、时间和内容，非文本消息会标注类型（如[图片]、[语音]）。
message_id 是消息的唯一标识，可用于：send_message 的 reply_to 回复指定消息、recall_message 撤回消息、set_essence_message 设置精华。`,
            parameters: {
                type: "object",
                properties: {
                    count: {
                        type: "integer",
                        description: "获取最近多少条消息，默认10条，最多30条"
                    }
                },
                required: []
            }
        }
    }
];

export default messageTools;
