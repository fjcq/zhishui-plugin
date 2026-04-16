/**
 * 消息工具定义（重新设计 v3）
 * 支持灵活的消息组合，包括多个@、图片、文本混合发送
 */

export const messageTools = [
    {
        type: "function",
        function: {
            name: "send_message",
            description: "发送消息到当前对话。支持两种方式：1) 使用消息段数组(segments)可以自由组合文本、@、图片等；2) 使用文本(text)可以在文本中用 @[用户ID] 格式插入@，用 [image:URL] 格式插入图片。",
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
                        description: "文本消息。支持特殊标记：@[用户ID] 表示@某人，[image:URL] 表示插入图片。示例：\"@[123456] 你好，请问你认识 @[789012] 吗？\" 或 \"看看这张图片 [image:http://example.com/img.jpg]\""
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
            description: "快速发送图片消息。如果需要发送复杂的消息（如同时发送文本和图片），建议使用 send_message 工具。",
            parameters: {
                type: "object",
                properties: {
                    url: {
                        type: "string",
                        description: "图片URL、本地路径或base64数据"
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
            description: "发送语音消息。将文本转换为语音发送，需要配置语音系统。",
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
            description: "发送私聊消息给指定用户。无论当前在私聊还是群聊，都向指定用户发送私聊消息。",
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
            name: "get_group_info",
            description: "获取群组信息（仅群聊）。",
            parameters: {
                type: "object",
                properties: {},
                required: []
            }
        }
    }
];

export default messageTools;
