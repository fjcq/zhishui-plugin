/**
 * 记忆工具定义
 * 定义AI可调用的记忆相关工具
 */

export const memoryTools = [
    {
        type: "function",
        function: {
            name: "remember_user_info",
            description: "记录用户信息到记忆库。用于记住用户的偏好、习惯、重要信息等，以便后续对话中使用。",
            parameters: {
                type: "object",
                properties: {
                    user_id: {
                        type: "string",
                        description: "用户ID，可省略则记录当前对话用户"
                    },
                    key: {
                        type: "string",
                        description: "信息键名，如'喜欢的食物'、'生日'、'职业'等"
                    },
                    value: {
                        type: "string",
                        description: "信息内容"
                    },
                    expire_days: {
                        type: "integer",
                        description: "过期天数，0表示永不过期，默认30天"
                    }
                },
                required: ["key", "value"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "recall_user_info",
            description: "从记忆库获取用户信息。用于回忆之前记录的用户偏好、习惯等。",
            parameters: {
                type: "object",
                properties: {
                    user_id: {
                        type: "string",
                        description: "用户ID，可省略则查询当前对话用户"
                    },
                    key: {
                        type: "string",
                        description: "信息键名，不填则返回该用户所有记忆"
                    }
                },
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "forget_user_info",
            description: "删除记忆库中的用户信息。",
            parameters: {
                type: "object",
                properties: {
                    user_id: {
                        type: "string",
                        description: "用户ID，可省略则操作当前对话用户"
                    },
                    key: {
                        type: "string",
                        description: "要删除的信息键名，不填则清空该用户所有记忆"
                    }
                },
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "set_reminder",
            description: "设置提醒。在指定时间提醒用户某事。",
            parameters: {
                type: "object",
                properties: {
                    user_id: {
                        type: "string",
                        description: "要提醒的用户ID，可省略则提醒当前对话用户"
                    },
                    content: {
                        type: "string",
                        description: "提醒内容"
                    },
                    remind_time: {
                        type: "string",
                        description: "提醒时间，格式：YYYY-MM-DD HH:MM 或相对时间如'1小时后'、'明天上午9点'"
                    }
                },
                required: ["content", "remind_time"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_reminders",
            description: "获取用户的提醒列表。",
            parameters: {
                type: "object",
                properties: {
                    user_id: {
                        type: "string",
                        description: "用户ID，可省略则查询当前对话用户"
                    }
                },
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "cancel_reminder",
            description: "取消提醒。",
            parameters: {
                type: "object",
                properties: {
                    reminder_id: {
                        type: "string",
                        description: "要取消的提醒ID"
                    }
                },
                required: ["reminder_id"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "record_interaction",
            description: "记录与用户的重要互动事件，用于长期记忆。",
            parameters: {
                type: "object",
                properties: {
                    user_id: {
                        type: "string",
                        description: "用户ID，可省略则记录当前对话用户"
                    },
                    event_type: {
                        type: "string",
                        description: "事件类型，如'生日祝福'、'帮助解决问题'、'聊天话题'等"
                    },
                    content: {
                        type: "string",
                        description: "事件详细内容"
                    }
                },
                required: ["event_type", "content"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_interaction_history",
            description: "获取与用户的历史互动记录。",
            parameters: {
                type: "object",
                properties: {
                    user_id: {
                        type: "string",
                        description: "用户ID，可省略则查询当前对话用户"
                    },
                    event_type: {
                        type: "string",
                        description: "事件类型筛选，不填则返回所有类型"
                    },
                    limit: {
                        type: "integer",
                        description: "返回记录数量限制，默认10条"
                    }
                },
                required: []
            }
        }
    }
];
