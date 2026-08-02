/**
 * 搜剧工具定义
 * 定义AI可调用的影视搜索相关工具
 * 复用插件自身的资源站接口与解析配置
 */

export const videoTools = [
    {
        type: "function",
        function: {
            name: "search_videos",
            description: `找电影、电视剧、动漫、综艺等影视作品。

【什么时候用】
- 用户问"有什么好看的电影/电视剧"
- 用户想找某部影视作品
- 用户想知道某部剧的简介、年代、分类等信息
- 用户想找儿童/动画/纪录片等特定类型

【参数】
- keyword：影视作品名字，用全名效果最好。留空则看最近有什么新片
- page：第几页，默认第1页
- site_index：用哪个资源站（一般不填，用默认的）

【结果说明】
返回作品列表，含名字、分类、年份、简介、封面等。每条结果带一个 vod_id，后续查剧集和播放链接会用到。

【提示】
- 找音乐 MV 或短视频用搜歌能力，不是这里
- 用户想看某部剧时，先用这里搜索，再问有哪些剧集，最后拿播放链接`,
            parameters: {
                type: "object",
                properties: {
                    keyword: {
                        type: "string",
                        description: "搜索关键词，影视作品名称最佳。留空则返回资源站最新视频列表"
                    },
                    page: {
                        type: "integer",
                        description: "页码，默认第1页，每页约20条结果"
                    },
                    site_index: {
                        type: "integer",
                        description: "资源站索引（对应videoSearch.yaml中resources数组下标）。不填则使用用户配置的默认资源站"
                    }
                },
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_video_episodes",
            description: `查某部影视作品有哪些线路和集数。

【什么时候用】
- 用户想看某部剧，需要知道有哪些线路和集数
- 用户问某部剧更新到第几集、总共多少集
- 已经搜到作品后，进一步了解播放信息

【参数】
- vod_id：作品 ID（搜剧时返回的那个），优先用这个
- vod_name：作品名（没有 vod_id 时按名字再找一下）
- site_index：资源站（一般不填）

【结果说明】
返回这部作品的所有播放线路，每条线路下列出所有集数。不同线路画质和可用性可能不同。`,
            parameters: {
                type: "object",
                properties: {
                    vod_id: {
                        type: "string",
                        description: "影视作品ID（由 search_videos 返回的 vod_id 字段，资源站可能返回数字或数字字符串）。与 vod_name 二选一，优先使用 vod_id"
                    },
                    vod_name: {
                        type: "string",
                        description: "影视作品名称（当 vod_id 未提供时，按名称在当前资源站重新搜索定位）"
                    },
                    site_index: {
                        type: "integer",
                        description: "资源站索引。不填则使用用户配置的默认资源站"
                    }
                },
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_video_play_url",
            description: `拿到某部影视作品某一集的播放链接，可以发给用户去看。

【什么时候用】
- 用户明确说"我想看第X集"
- 已经搜到作品并了解剧集后，用户想要播放链接

【参数】
- vod_id：作品 ID（优先用），或 vod_name 作品名
- episode：第几集，从1开始，不填默认第1集
- route_index：第几条线路，从1开始，不填默认第1条
- site_index：资源站（一般不填）

【结果说明】
返回该集的播放链接，用户可以复制到浏览器打开观看。

【提示】
- 没指定集数就默认给第1集
- 线路或集数不存在时会失败，换一条线路试试`,
            parameters: {
                type: "object",
                properties: {
                    vod_id: {
                        type: "string",
                        description: "影视作品ID（资源站可能返回数字或数字字符串）。与 vod_name 二选一，优先使用 vod_id"
                    },
                    vod_name: {
                        type: "string",
                        description: "影视作品名称（当 vod_id 未提供时使用）"
                    },
                    episode: {
                        type: "integer",
                        description: "集数编号（从1开始）。不填默认为1（第1集）"
                    },
                    route_index: {
                        type: "integer",
                        description: "线路编号（从1开始，对应 get_video_episodes 返回的 routes 数组下标+1）。不填默认为1"
                    },
                    site_index: {
                        type: "integer",
                        description: "资源站索引。不填则使用用户配置的默认资源站"
                    }
                },
                required: []
            }
        }
    }
];
