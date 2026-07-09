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

【数据源策略】
- 网易云：使用官方API（ncmService）
- QQ/酷狗/酷我：使用自建API（musicApi，可获取真实音频直链）
- 失败时自动降级到 @meting/core

【返回内容】
返回歌曲列表，每首包含：
- id(歌曲ID，用于play_music的song_id参数)
- name(歌名)
- artist(歌手)
- album(专辑)
- duration(时长，秒)
- pic(封面URL)
- link(链接)
- media_mid(QQ音乐专用，用于play_music的media_mid参数，必须原样传回)
- platform(平台代码)`,
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
            description: `播放指定音乐。根据歌曲ID播放音乐，优先发送语音消息，失败时降级为文本+链接。

【发送策略】
1. 有音频直链且时长≤5分钟：发送语音消息
2. 无法发送语音：发送歌名+链接文本

【数据源策略】
- 网易云：使用官方API获取真实音频直链
- QQ音乐：使用自建API获取真实音频直链（免费歌曲可播放，VIP歌曲返回链接）
- 酷狗/酷我：使用自建API获取真实音频直链

【调用时机】
- 用户想听歌时，在search_music搜索后选择最合适的歌曲播放
- 用户指定了某首歌时，播放用户指定的那首

【参数来源】
song_id、platform、media_mid 均来自 search_music 的返回结果，必须原样传回`,
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
