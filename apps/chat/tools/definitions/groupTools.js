/**
 * 群管理工具定义
 * 定义AI可调用的群管理相关工具
 */

export const groupTools = [
    {
        type: "function",
        function: {
            name: "mute_group_member",
            description: "禁言群成员（需要Bot是管理员）。duration为禁言时长（秒），0表示解除禁言。最长30天。",
            parameters: {
                type: "object",
                properties: {
                    user_id: {
                        type: "string",
                        description: "要禁言的用户ID"
                    },
                    duration: {
                        type: "integer",
                        description: "禁言时长（秒）。0表示解除禁言，默认60秒。最长2592000秒（30天）。"
                    },
                    reason: {
                        type: "string",
                        description: "禁言原因"
                    }
                },
                required: ["user_id"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "set_group_card",
            description: "修改群成员的群名片（需要Bot是管理员）。",
            parameters: {
                type: "object",
                properties: {
                    user_id: {
                        type: "string",
                        description: "要修改名片的用户ID"
                    },
                    card: {
                        type: "string",
                        description: "新的群名片内容，空字符串表示清除名片"
                    }
                },
                required: ["user_id", "card"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "set_group_title",
            description: "设置群成员专属头衔（需要Bot是群主）。",
            parameters: {
                type: "object",
                properties: {
                    user_id: {
                        type: "string",
                        description: "要设置头衔的用户ID"
                    },
                    title: {
                        type: "string",
                        description: "头衔内容，空字符串表示清除头衔"
                    }
                },
                required: ["user_id", "title"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "kick_group_member",
            description: "将成员移出群组（需要Bot是管理员）。慎用此功能。",
            parameters: {
                type: "object",
                properties: {
                    user_id: {
                        type: "string",
                        description: "要移出的用户ID"
                    },
                    reason: {
                        type: "string",
                        description: "移出原因"
                    },
                    reject_add_request: {
                        type: "boolean",
                        description: "是否拒绝此用户再次加群请求，默认false"
                    }
                },
                required: ["user_id"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "delete_message",
            description: "撤回群消息（需要Bot是管理员）。只能撤回最近的消息。",
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
            name: "set_group_name",
            description: "修改群名称（需要Bot是管理员）。",
            parameters: {
                type: "object",
                properties: {
                    group_name: {
                        type: "string",
                        description: "新的群名称"
                    }
                },
                required: ["group_name"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "set_group_announcement",
            description: "发布群公告（需要Bot是管理员）。",
            parameters: {
                type: "object",
                properties: {
                    content: {
                        type: "string",
                        description: "公告内容"
                    },
                    image: {
                        type: "string",
                        description: "公告图片URL（可选）"
                    }
                },
                required: ["content"]
            }
        }
    }
];
