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
    }
];
