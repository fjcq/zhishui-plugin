/**
 * 好感度工具定义
 * 定义AI可调用的好感度相关工具
 */

export const favorTools = [
    {
        type: "function",
        function: {
            name: "change_user_favor",
            description: "调整用户好感度（推荐使用）。直接增加或减少好感度，无需先查询当前值。change为变化量，正数增加，负数减少。user_id可省略。",
            parameters: {
                type: "object",
                properties: {
                    user_id: {
                        type: "string",
                        description: "用户ID，可省略，默认使用当前对话用户"
                    },
                    change: {
                        type: "integer",
                        description: "好感度变化量。正数表示增加（如3表示+3），负数表示减少（如-2表示-2）。范围-10到+10。"
                    },
                    reason: {
                        type: "string",
                        description: "调整原因，简要说明"
                    }
                },
                required: ["change", "reason"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_user_favor",
            description: "获取用户的好感度数值。仅在需要查看好感度时调用。",
            parameters: {
                type: "object",
                properties: {
                    user_id: {
                        type: "string",
                        description: "用户ID，可省略，默认使用当前对话用户"
                    }
                },
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "set_user_favor",
            description: "设置用户好感度为指定值（绝对值）。仅在需要精确设置时使用。favor是目标值（-100到100）。",
            parameters: {
                type: "object",
                properties: {
                    user_id: {
                        type: "string",
                        description: "用户ID，可省略，默认使用当前对话用户"
                    },
                    favor: {
                        type: "integer",
                        description: "好感度目标值，范围-100到100"
                    },
                    reason: {
                        type: "string",
                        description: "调整原因"
                    }
                },
                required: ["favor", "reason"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_user_info",
            description: "获取用户的详细数据，包括好感度、互动次数等统计信息。",
            parameters: {
                type: "object",
                properties: {
                    user_id: {
                        type: "string",
                        description: "用户ID，可省略，默认使用当前对话用户"
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
            description: "获取群组信息（群名、群号、成员数量等）。",
            parameters: {
                type: "object",
                properties: {
                    group_id: {
                        type: "string",
                        description: "群组ID，可省略，默认使用当前群组"
                    }
                },
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_user_profile",
            description: "获取用户的QQ资料（昵称、头像、等级等）。",
            parameters: {
                type: "object",
                properties: {
                    user_id: {
                        type: "string",
                        description: "用户ID，可省略，默认使用当前对话用户"
                    },
                    group_id: {
                        type: "string",
                        description: "群组ID，可省略，用于获取群内昵称"
                    }
                },
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_group_members",
            description: "获取群成员列表。",
            parameters: {
                type: "object",
                properties: {
                    group_id: {
                        type: "string",
                        description: "群组ID，可省略，默认使用当前群组"
                    }
                },
                required: []
            }
        }
    }
];
