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
            description: `影视资源搜索工具。用于查找电影、电视剧、动漫、综艺等影视作品。

【使用场景】
- 用户询问"有什么好看的电影/电视剧"
- 用户想找某部影视作品
- 用户想知道某部剧的基本信息（年代、分类、简介、主演）
- 用户想找儿童/动画/纪录片等特定类型内容

【返回内容】
返回作品列表，每条包含：vod_id（作品ID，用于后续获取剧集）、vod_name（标题）、type_name（分类）、vod_year（年份）、vod_remarks（备注，如"HD中字"）、vod_pic（封面URL）、vod_content（简介）。

【注意事项】
- 不要用此工具搜索音乐MV或短视频
- 若用户询问某部剧的播放链接，请先用此工具搜索，再用 get_video_episodes 获取剧集，最后用 get_video_play_url 获取链接
- 搜索词应简洁明确，使用影视作品的全名效果最佳`,
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
            description: `获取指定影视作品的剧集列表与可用播放线路。

【使用场景】
- 用户想看某部剧，需要知道有哪些线路和集数
- 用户询问某部剧更新到第几集、总共有多少集
- 已通过 search_videos 获取到 vod_id 后，进一步获取播放信息

【返回内容】
返回该作品的所有播放线路及每条线路下的剧集列表。包含：vod_name（作品名）、routes（线路数组，每条含 route_name 和 episode_names 集数名称数组）。

【注意事项】
- 必须先通过 search_videos 获取 vod_id，或使用用户当前已搜索并选中的作品
- 不同线路可能对应不同的播放源，画质与可用性可能不同`,
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
            description: `获取指定影视作品指定集数的可观看播放链接。

【使用场景】
- 用户明确表示"我想看第X集"
- 用户已通过 search_videos 或 get_video_episodes 了解作品后，请求播放链接

【返回内容】
返回可直接复制到浏览器观看的完整播放链接（包含解析接口前缀）。包含：vod_name、episode_name、play_url、route_name。

【注意事项】
- 链接需复制到浏览器打开，部分资源可能需要在 PC 端观看
- 若未指定集数，默认返回第1集
- 若指定的线路或集数不存在，将返回错误提示
- 不要将此工具用于非影视类内容`,
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
