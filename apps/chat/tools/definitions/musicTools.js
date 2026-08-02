/**
 * 音乐工具定义
 * 定义AI可调用的音乐相关工具
 */

export const musicTools = [
    {
        type: "function",
        function: {
            name: "search_music",
            description: `搜歌。根据歌名或歌手找歌，返回匹配的歌曲列表。

【什么时候用】
- 用户想听歌时，先搜出匹配的歌，再选一首播放
- 用户只想看看有哪些歌时，搜出来让用户挑

【参数】
- keyword：搜索关键词，可以是歌名、歌手名或两者组合
- platform：在哪个平台搜（netease 网易云、tencent QQ音乐、kugou 酷狗、kuwo 酷我），默认网易云
- limit：返回几首，默认5首，最多10首

【结果说明】
返回歌曲列表，每首含歌曲 ID、歌名、歌手、专辑、时长、封面等。
注意：返回结果里如果有 media_mid 字段（QQ音乐专用），播放时需要原样传回，否则可能拿不到音频。`,
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
                        description: "音乐平台：netease(网易云音乐)、tencent(QQ音乐)、kugou(酷狗音乐)、kuwo(酷我音乐)，默认netease"
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
            description: `播放指定的歌曲。会优先用语音形式发出去，发不了语音就发歌名和链接。

【什么时候用】
- 用户想听歌时，先搜歌，再选最合适的一首播放
- 用户指定了某首歌时，播放那一首

【参数】
- song_id：要播放哪首歌（来自搜歌结果中的歌曲 ID）
- platform：在哪个平台（要和搜歌时一致）
- song_name：歌名（可选，方便日志显示）
- artist：歌手（可选，方便日志显示）
- media_mid：QQ音乐专用字段，搜歌结果里如果有就必须原样传回

【提示】
- song_id、platform、media_mid 都来自搜歌结果，必须原样传回，不要自己编
- VIP 歌曲可能只能发链接，发不了语音，这是正常的`,
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
                        description: "音乐平台：netease(网易云音乐)、tencent(QQ音乐)、kugou(酷狗音乐)、kuwo(酷我音乐)，默认netease"
                    },
                    song_name: {
                        type: "string",
                        description: "歌曲名称（可选，用于日志显示）"
                    },
                    artist: {
                        type: "string",
                        description: "歌手名称（可选，用于日志显示）"
                    },
                    media_mid: {
                        type: "string",
                        description: "QQ音乐 media_mid（来自search_music返回结果中的media_mid字段），tencent平台必填以保证获取真实音频直链"
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
                        description: "音乐平台：netease(网易云音乐)、tencent(QQ音乐)、kugou(酷狗音乐)、kuwo(酷我音乐)，默认netease"
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
                        description: "音乐平台：netease(网易云音乐)、tencent(QQ音乐)、kugou(酷狗音乐)、kuwo(酷我音乐)，默认netease"
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
