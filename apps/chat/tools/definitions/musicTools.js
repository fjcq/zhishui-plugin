/**
 * 音乐工具定义
 * 定义AI可调用的音乐相关工具
 */

export const musicTools = [
    {
        type: "function",
        function: {
            name: "search_music",
            description: `搜索音乐。根据歌曲名称或歌手搜索音乐，返回匹配的歌曲列表。

【使用场景】
- 用户想听歌时，搜索后根据结果选择最合适的歌曲调用play_music播放
- 用户只想看歌曲列表时，只搜索不播放，展示结果让用户选择

【返回内容】
返回歌曲列表，每首包含：id(歌曲ID)、name(歌名)、artist(歌手)、album(专辑)、duration(时长)、link(链接)`,
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
                    limit: {
                        type: "integer",
                        description: "返回结果数量，默认5首，最多10首"
                    }
                },
                required: ["keyword"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "play_music",
            description: `播放指定音乐。根据歌曲ID播放音乐，发送音乐卡片或语音。

【调用时机】
- 用户想听歌时，在search_music搜索后选择最合适的歌曲播放
- 用户指定了某首歌时，播放用户指定的那首

【参数来源】
song_id和platform来自search_music的返回结果`,
            parameters: {
                type: "object",
                properties: {
                    song_id: {
                        type: "string",
                        description: "要播放的歌曲ID，来自search_music的搜索结果"
                    },
                    platform: {
                        type: "string",
                        enum: ["netease", "tencent", "kugou", "kuwo"],
                        description: "音乐平台：netease(网易云音乐)、tencent(QQ音乐)、kugou(酷狗音乐)、kuwo(酷我音乐)，默认kugou"
                    },
                    song_name: {
                        type: "string",
                        description: "歌曲名称（可选，用于日志显示）"
                    },
                    artist: {
                        type: "string",
                        description: "歌手名称（可选，用于日志显示）"
                    }
                },
                required: ["song_id", "platform"]
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
    }
];
