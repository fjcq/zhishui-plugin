/**
 * 好友管理工具定义
 * 定义AI可调用的好友相关工具
 */

export const friendTools = [
    {
        type: "function",
        function: {
            name: "get_friend_list",
            description: "获取Bot的全部好友列表。返回好友数量和每个好友的基本信息（用户ID、昵称、备注）。",
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
            name: "get_friend_info",
            description: "查询指定好友的详细信息。包括用户ID、昵称、备注、签名、头像等信息。",
            parameters: {
                type: "object",
                properties: {
                    user_id: {
                        type: "string",
                        description: "要查询的好友用户ID"
                    }
                },
                required: ["user_id"]
            }
        }
    }
];
