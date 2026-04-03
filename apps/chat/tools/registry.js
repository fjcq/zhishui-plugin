/**
 * 工具注册中心 - 单一数据源
 * 所有工具的元数据统一定义在此处
 * 其他模块（锅巴配置、工具定义）从此处自动生成
 */

/**
 * 工具分类定义
 */
export const CATEGORIES = [
    { id: 'favor', label: '好感度工具', field: 'favor_tools' },
    { id: 'friend', label: '好友工具', field: 'friend_tools' },
    { id: 'group', label: '群管理工具', field: 'group_tools' },
    { id: 'music', label: '音乐工具', field: 'music_tools' },
    { id: 'message', label: '消息工具', field: 'message_tools' },
    { id: 'interact', label: '互动工具', field: 'interact_tools' },
    { id: 'memory', label: '记忆工具', field: 'memory_tools' }
];

/**
 * 工具注册表
 * 每个工具包含：
 * - name: 工具名称（英文标识）
 * - label: 显示名称（中文）
 * - desc: 描述说明
 * - category: 所属分类ID
 * - definition: AI调用时的工具定义
 * - defaultEnabled: 是否默认启用
 * - deprecated: 是否已废弃
 * - migrateTo: 废弃后迁移到哪个工具
 */
export const TOOLS = {
    // ==================== 好感度工具 ====================
    change_user_favor: {
        name: 'change_user_favor',
        label: '调整好感度',
        desc: '允许AI增减用户好感度',
        category: 'favor',
        defaultEnabled: true,
        definition: {
            description: "调整用户好感度（推荐使用）。直接增加或减少好感度，无需先查询当前值。change为变化量，正数增加，负数减少。user_id可省略。",
            parameters: {
                type: "object",
                properties: {
                    user_id: { type: "string", description: "用户ID，可省略，默认使用当前对话用户" },
                    change: { type: "integer", description: "好感度变化量。正数表示增加（如3表示+3），负数表示减少（如-2表示-2）。范围-10到+10。" },
                    reason: { type: "string", description: "调整原因，简要说明" }
                },
                required: ["change", "reason"]
            }
        }
    },
    get_user_favor: {
        name: 'get_user_favor',
        label: '获取好感度',
        desc: '允许AI查询用户好感度数值',
        category: 'favor',
        defaultEnabled: true,
        definition: {
            description: "获取用户的好感度数值。仅在需要查看好感度时调用。",
            parameters: {
                type: "object",
                properties: {
                    user_id: { type: "string", description: "用户ID，可省略，默认使用当前对话用户" }
                },
                required: []
            }
        }
    },
    set_user_favor: {
        name: 'set_user_favor',
        label: '设置好感度',
        desc: '允许AI精确设置好感度值',
        category: 'favor',
        defaultEnabled: true,
        definition: {
            description: "设置用户好感度为指定值（绝对值）。仅在需要精确设置时使用。favor是目标值（-100到100）。",
            parameters: {
                type: "object",
                properties: {
                    user_id: { type: "string", description: "用户ID，可省略，默认使用当前对话用户" },
                    favor: { type: "integer", description: "好感度目标值，范围-100到100" },
                    reason: { type: "string", description: "调整原因" }
                },
                required: ["favor", "reason"]
            }
        }
    },
    get_user_info: {
        name: 'get_user_info',
        label: '获取用户信息',
        desc: '允许AI获取用户详细数据',
        category: 'favor',
        defaultEnabled: true,
        definition: {
            description: "获取用户的详细数据，包括好感度、互动次数等统计信息。",
            parameters: {
                type: "object",
                properties: {
                    user_id: { type: "string", description: "用户ID，可省略，默认使用当前对话用户" }
                },
                required: []
            }
        }
    },
    get_group_info: {
        name: 'get_group_info',
        label: '获取群信息',
        desc: '允许AI获取群组基本信息',
        category: 'favor',
        defaultEnabled: true,
        definition: {
            description: "获取群组信息（群名、群号、成员数量等）。",
            parameters: {
                type: "object",
                properties: {
                    group_id: { type: "string", description: "群组ID，可省略，默认使用当前群组" }
                },
                required: []
            }
        }
    },
    get_user_profile: {
        name: 'get_user_profile',
        label: '获取QQ资料',
        desc: '允许AI获取用户QQ资料',
        category: 'favor',
        defaultEnabled: true,
        definition: {
            description: "获取用户的QQ资料（昵称、头像、等级等）。",
            parameters: {
                type: "object",
                properties: {
                    user_id: { type: "string", description: "用户ID，可省略，默认使用当前对话用户" },
                    group_id: { type: "string", description: "群组ID，可省略，用于获取群内昵称" }
                },
                required: []
            }
        }
    },
    get_group_members: {
        name: 'get_group_members',
        label: '获取群成员',
        desc: '允许AI获取群成员列表',
        category: 'favor',
        defaultEnabled: true,
        definition: {
            description: "获取群成员列表。",
            parameters: {
                type: "object",
                properties: {
                    group_id: { type: "string", description: "群组ID，可省略，默认使用当前群组" }
                },
                required: []
            }
        }
    },

    // ==================== 好友工具 ====================
    get_friend_list: {
        name: 'get_friend_list',
        label: '获取好友列表',
        desc: '允许AI获取Bot的全部好友列表',
        category: 'friend',
        defaultEnabled: true,
        definition: {
            description: "获取Bot的全部好友列表。",
            parameters: {
                type: "object",
                properties: {},
                required: []
            }
        }
    },
    get_friend_info: {
        name: 'get_friend_info',
        label: '查询好友信息',
        desc: '允许AI查询指定好友的详细信息',
        category: 'friend',
        defaultEnabled: true,
        definition: {
            description: "查询指定好友的详细信息。",
            parameters: {
                type: "object",
                properties: {
                    user_id: { type: "string", description: "好友的用户ID" }
                },
                required: ["user_id"]
            }
        }
    },

    // ==================== 群管理工具 ====================
    mute_group_member: {
        name: 'mute_group_member',
        label: '禁言成员',
        desc: '允许AI禁言/解禁群成员（需Bot是管理员）',
        category: 'group',
        defaultEnabled: false,
        definition: {
            description: "禁言群成员（需要Bot是管理员）。duration为禁言时长（秒），0表示解除禁言。最长30天。",
            parameters: {
                type: "object",
                properties: {
                    user_id: { type: "string", description: "要禁言的用户ID" },
                    duration: { type: "integer", description: "禁言时长（秒）。0表示解除禁言，默认60秒。最长2592000秒（30天）。" },
                    reason: { type: "string", description: "禁言原因" }
                },
                required: ["user_id"]
            }
        }
    },
    set_group_card: {
        name: 'set_group_card',
        label: '修改群名片',
        desc: '允许AI修改群成员名片（需Bot是管理员）',
        category: 'group',
        defaultEnabled: true,
        definition: {
            description: "修改群成员的群名片（需要Bot是管理员）。",
            parameters: {
                type: "object",
                properties: {
                    user_id: { type: "string", description: "要修改名片的用户ID" },
                    card: { type: "string", description: "新的群名片内容，空字符串表示清除名片" }
                },
                required: ["user_id", "card"]
            }
        }
    },
    set_group_title: {
        name: 'set_group_title',
        label: '设置专属头衔',
        desc: '允许AI设置群成员专属头衔（需Bot是群主）',
        category: 'group',
        defaultEnabled: true,
        definition: {
            description: "设置群成员专属头衔（需要Bot是群主）。",
            parameters: {
                type: "object",
                properties: {
                    user_id: { type: "string", description: "要设置头衔的用户ID" },
                    title: { type: "string", description: "头衔内容，空字符串表示清除头衔" }
                },
                required: ["user_id", "title"]
            }
        }
    },
    kick_group_member: {
        name: 'kick_group_member',
        label: '移出成员',
        desc: '允许AI将成员移出群组（需Bot是管理员）',
        category: 'group',
        defaultEnabled: false,
        definition: {
            description: "将成员移出群组（需要Bot是管理员）。慎用此功能。",
            parameters: {
                type: "object",
                properties: {
                    user_id: { type: "string", description: "要移出的用户ID" },
                    reason: { type: "string", description: "移出原因" },
                    reject_add_request: { type: "boolean", description: "是否拒绝此用户再次加群请求，默认false" }
                },
                required: ["user_id"]
            }
        }
    },
    delete_message: {
        name: 'delete_message',
        label: '撤回消息',
        desc: '允许AI撤回群消息（需Bot是管理员）',
        category: 'group',
        defaultEnabled: true,
        definition: {
            description: "撤回群消息（需要Bot是管理员）。只能撤回最近的消息。",
            parameters: {
                type: "object",
                properties: {
                    message_id: { type: "string", description: "要撤回的消息ID" }
                },
                required: ["message_id"]
            }
        }
    },
    set_group_name: {
        name: 'set_group_name',
        label: '修改群名称',
        desc: '允许AI修改群名称（需Bot是管理员）',
        category: 'group',
        defaultEnabled: true,
        definition: {
            description: "修改群名称（需要Bot是管理员）。",
            parameters: {
                type: "object",
                properties: {
                    group_name: { type: "string", description: "新的群名称" }
                },
                required: ["group_name"]
            }
        }
    },
    set_group_announcement: {
        name: 'set_group_announcement',
        label: '发布公告',
        desc: '允许AI发布群公告（需Bot是管理员）',
        category: 'group',
        defaultEnabled: true,
        definition: {
            description: "发布群公告（需要Bot是管理员）。",
            parameters: {
                type: "object",
                properties: {
                    content: { type: "string", description: "公告内容" },
                    image: { type: "string", description: "公告图片URL（可选）" }
                },
                required: ["content"]
            }
        }
    },

    // ==================== 音乐工具 ====================
    search_music: {
        name: 'search_music',
        label: '搜索音乐',
        desc: '允许AI搜索音乐并返回列表',
        category: 'music',
        defaultEnabled: true,
        definition: {
            description: `搜索音乐。根据歌曲名称或歌手搜索音乐，返回匹配的歌曲列表。

【使用场景】
- 用户想听歌时，搜索后根据结果选择最合适的歌曲调用play_music播放
- 用户只想看歌曲列表时，只搜索不播放，展示结果让用户选择

【返回内容】
返回歌曲列表，每首包含：id(歌曲ID)、name(歌名)、artist(歌手)、album(专辑)、duration(时长)、link(链接)`,
            parameters: {
                type: "object",
                properties: {
                    keyword: { type: "string", description: "搜索关键词，可以是歌曲名、歌手名或两者组合" },
                    platform: { type: "string", enum: ["netease", "tencent", "kugou", "kuwo"], description: "音乐平台：netease(网易云音乐)、tencent(QQ音乐)、kugou(酷狗音乐)、kuwo(酷我音乐)，默认kugou" },
                    limit: { type: "integer", description: "返回结果数量，默认5首，最多10首" }
                },
                required: ["keyword"]
            }
        }
    },
    play_music: {
        name: 'play_music',
        label: '播放音乐',
        desc: '允许AI播放指定音乐',
        category: 'music',
        defaultEnabled: true,
        definition: {
            description: `播放指定音乐。根据歌曲ID播放音乐，发送音乐卡片或语音。

【调用时机】
- 用户想听歌时，在search_music搜索后选择最合适的歌曲播放
- 用户指定了某首歌时，播放用户指定的那首

【参数来源】
song_id和platform来自search_music的返回结果`,
            parameters: {
                type: "object",
                properties: {
                    song_id: { type: "string", description: "要播放的歌曲ID，来自search_music的搜索结果" },
                    platform: { type: "string", enum: ["netease", "tencent", "kugou", "kuwo"], description: "音乐平台：netease(网易云音乐)、tencent(QQ音乐)、kugou(酷狗音乐)、kuwo(酷我音乐)，默认kugou" },
                    song_name: { type: "string", description: "歌曲名称（可选，用于日志显示）" },
                    artist: { type: "string", description: "歌手名称（可选，用于日志显示）" }
                },
                required: ["song_id", "platform"]
            }
        }
    },
    get_lyrics: {
        name: 'get_lyrics',
        label: '获取歌词',
        desc: '允许AI获取歌曲歌词',
        category: 'music',
        defaultEnabled: true,
        definition: {
            description: "获取歌曲歌词。根据歌曲名称或歌手搜索歌曲并返回歌词内容，支持显示翻译歌词。",
            parameters: {
                type: "object",
                properties: {
                    keyword: { type: "string", description: "搜索关键词，可以是歌曲名、歌手名或两者组合" },
                    platform: { type: "string", enum: ["netease", "tencent", "kugou", "kuwo"], description: "音乐平台：netease(网易云音乐)、tencent(QQ音乐)、kugou(酷狗音乐)、kuwo(酷我音乐)，默认kugou" },
                    show_translation: { type: "boolean", description: "是否显示翻译歌词（如果有），默认true" }
                },
                required: ["keyword"]
            }
        }
    },
    get_playlist: {
        name: 'get_playlist',
        label: '获取歌单',
        desc: '允许AI获取歌单内容',
        category: 'music',
        defaultEnabled: true,
        definition: {
            description: "获取歌单内容。根据歌单ID或分享链接获取歌单中的歌曲列表，返回歌单名称、描述和歌曲列表。",
            parameters: {
                type: "object",
                properties: {
                    playlist_id: { type: "string", description: "歌单ID，可以从歌单分享链接中获取" },
                    platform: { type: "string", enum: ["netease", "tencent", "kugou", "kuwo"], description: "音乐平台：netease(网易云音乐)、tencent(QQ音乐)、kugou(酷狗音乐)、kuwo(酷我音乐)，默认kugou" },
                    limit: { type: "integer", description: "返回歌曲数量限制，默认10首，最多30首" }
                },
                required: ["playlist_id"]
            }
        }
    },

    // ==================== 消息工具 ====================
    send_image: {
        name: 'send_image',
        label: '发送图片',
        desc: '允许AI发送图片消息',
        category: 'message',
        defaultEnabled: true,
        definition: {
            description: "发送图片消息。支持URL或本地路径。",
            parameters: {
                type: "object",
                properties: {
                    url: { type: "string", description: "图片URL或本地路径" },
                    caption: { type: "string", description: "图片说明文字（可选）" }
                },
                required: ["url"]
            }
        }
    },
    send_voice: {
        name: 'send_voice',
        label: '发送语音',
        desc: '允许AI发送语音消息',
        category: 'message',
        defaultEnabled: true,
        definition: {
            description: "发送语音消息。将文本转换为语音发送。",
            parameters: {
                type: "object",
                properties: {
                    text: { type: "string", description: "要转换为语音的文本内容" }
                },
                required: ["text"]
            }
        }
    },
    send_private_message: {
        name: 'send_private_message',
        label: '发送私聊',
        desc: '允许AI发送私聊消息',
        category: 'message',
        defaultEnabled: true,
        definition: {
            description: "发送私聊消息给指定用户。",
            parameters: {
                type: "object",
                properties: {
                    user_id: { type: "string", description: "接收消息的用户ID" },
                    message: { type: "string", description: "消息内容" }
                },
                required: ["user_id", "message"]
            }
        }
    },
    forward_message: {
        name: 'forward_message',
        label: '转发消息',
        desc: '允许AI转发消息到其他群',
        category: 'message',
        defaultEnabled: true,
        definition: {
            description: "转发消息到其他群组。",
            parameters: {
                type: "object",
                properties: {
                    target_group_id: { type: "string", description: "目标群组ID" },
                    message: { type: "string", description: "要转发的消息内容" }
                },
                required: ["target_group_id", "message"]
            }
        }
    },
    set_essence_message: {
        name: 'set_essence_message',
        label: '设为精华',
        desc: '允许AI设置精华消息（需Bot是管理员）',
        category: 'message',
        defaultEnabled: true,
        definition: {
            description: "设置群精华消息（需要Bot是管理员）。",
            parameters: {
                type: "object",
                properties: {
                    message_id: { type: "string", description: "要设为精华的消息ID" }
                },
                required: ["message_id"]
            }
        }
    },

    // ==================== 互动工具 ====================
    poke_user: {
        name: 'poke_user',
        label: '戳一戳',
        desc: '允许AI戳一戳用户',
        category: 'interact',
        defaultEnabled: true,
        definition: {
            description: "戳一戳用户（群聊双击头像效果）。用于友好互动或引起注意。",
            parameters: {
                type: "object",
                properties: {
                    user_id: { type: "string", description: "要戳一戳的用户ID，可省略则戳当前对话用户" }
                },
                required: []
            }
        }
    },
    generate_meme: {
        name: 'generate_meme',
        label: '表情包生成',
        desc: '允许AI使用用户头像生成表情包',
        category: 'interact',
        defaultEnabled: true,
        definition: {
            description: `生成并发送表情包。这是一个可选的互动工具，用于在合适的时机增加对话趣味性。

【重要原则】
- 表情包是可选的，不是每次对话都需要使用
- 大多数情况下，用文字回复就足够了
- 只在真正合适的时机使用，不要强行使用
- 如果用户只是普通聊天、提问、讨论问题，不需要发表情

【合适的时机】
- 用户情绪低落、需要安慰时（发送petpet摸头、support加油）
- 用户在开玩笑、调侃时，可以配合回应（发送slap拍打、kick踢）
- 用户明确要求或期待互动时
- 想要表达某种强烈情绪时

【不合适的时机】
- 用户在认真提问或讨论问题
- 用户需要信息或帮助
- 对话内容严肃或正式
- 用户只是简单打招呼

【表情类型】
安慰类: petpet(摸头), always(一直)
调侃类: punch(打拳), crawl(爬), throw(扔)
互动类: kiss(亲亲), rub(贴贴), play(玩), pat(拍)
情绪类: jump(跳), eat(吃), bite(啃)
文字类: my_friend(需填名字)`,
            parameters: {
                type: "object",
                properties: {
                    meme_type: { type: "string", description: "表情包类型", enum: ["petpet", "crawl", "kiss", "rub", "play", "pat", "punch", "always", "jump", "eat", "my_friend", "bite", "support", "throw"] },
                    user_id: { type: "string", description: "目标用户ID，使用当前对话用户的ID" },
                    text: { type: "string", description: "文字。my_friend必填名字；petpet可选'圆'；always可选'循环'或'套娃'；crawl可选数字" }
                },
                required: ["meme_type", "user_id"]
            }
        }
    },

    // ==================== 记忆工具 ====================
    remember_user_info: {
        name: 'remember_user_info',
        label: '记录用户信息',
        desc: '允许AI记录用户信息到记忆库',
        category: 'memory',
        defaultEnabled: true,
        definition: {
            description: "记录用户信息到记忆库。用于记住用户的偏好、习惯、重要信息等，以便后续对话中使用。",
            parameters: {
                type: "object",
                properties: {
                    user_id: { type: "string", description: "用户ID，可省略则记录当前对话用户" },
                    key: { type: "string", description: "信息键名，如'喜欢的食物'、'生日'、'职业'等" },
                    value: { type: "string", description: "信息内容" },
                    expire_days: { type: "integer", description: "过期天数，0表示永不过期，默认30天" }
                },
                required: ["key", "value"]
            }
        }
    },
    recall_user_info: {
        name: 'recall_user_info',
        label: '获取记忆',
        desc: '允许AI从记忆库获取用户信息',
        category: 'memory',
        defaultEnabled: true,
        definition: {
            description: "从记忆库获取用户信息。用于回忆之前记录的用户偏好、习惯等。",
            parameters: {
                type: "object",
                properties: {
                    user_id: { type: "string", description: "用户ID，可省略则查询当前对话用户" },
                    key: { type: "string", description: "信息键名，不填则返回该用户所有记忆" }
                },
                required: []
            }
        }
    },
    forget_user_info: {
        name: 'forget_user_info',
        label: '删除记忆',
        desc: '允许AI删除记忆库中的用户信息',
        category: 'memory',
        defaultEnabled: true,
        definition: {
            description: "删除记忆库中的用户信息。",
            parameters: {
                type: "object",
                properties: {
                    user_id: { type: "string", description: "用户ID，可省略则操作当前对话用户" },
                    key: { type: "string", description: "要删除的信息键名，不填则清空该用户所有记忆" }
                },
                required: []
            }
        }
    },
    set_reminder: {
        name: 'set_reminder',
        label: '设置提醒',
        desc: '允许AI为用户设置提醒',
        category: 'memory',
        defaultEnabled: true,
        definition: {
            description: "设置提醒。在指定时间提醒用户某事。",
            parameters: {
                type: "object",
                properties: {
                    user_id: { type: "string", description: "要提醒的用户ID，可省略则提醒当前对话用户" },
                    content: { type: "string", description: "提醒内容" },
                    remind_time: { type: "string", description: "提醒时间，格式：YYYY-MM-DD HH:MM 或相对时间如'1小时后'、'明天上午9点'" }
                },
                required: ["content", "remind_time"]
            }
        }
    },
    get_reminders: {
        name: 'get_reminders',
        label: '获取提醒',
        desc: '允许AI获取用户的提醒列表',
        category: 'memory',
        defaultEnabled: true,
        definition: {
            description: "获取用户的提醒列表。",
            parameters: {
                type: "object",
                properties: {
                    user_id: { type: "string", description: "用户ID，可省略则查询当前对话用户" }
                },
                required: []
            }
        }
    },
    cancel_reminder: {
        name: 'cancel_reminder',
        label: '取消提醒',
        desc: '允许AI取消用户的提醒',
        category: 'memory',
        defaultEnabled: true,
        definition: {
            description: "取消提醒。",
            parameters: {
                type: "object",
                properties: {
                    reminder_id: { type: "string", description: "要取消的提醒ID" }
                },
                required: ["reminder_id"]
            }
        }
    },
    record_interaction: {
        name: 'record_interaction',
        label: '记录互动',
        desc: '允许AI记录与用户的重要互动',
        category: 'memory',
        defaultEnabled: true,
        definition: {
            description: "记录与用户的重要互动事件，用于长期记忆。",
            parameters: {
                type: "object",
                properties: {
                    user_id: { type: "string", description: "用户ID，可省略则记录当前对话用户" },
                    event_type: { type: "string", description: "事件类型，如'生日祝福'、'帮助解决问题'、'聊天话题'等" },
                    content: { type: "string", description: "事件详细内容" }
                },
                required: ["event_type", "content"]
            }
        }
    },
    get_interaction_history: {
        name: 'get_interaction_history',
        label: '获取互动历史',
        desc: '允许AI获取与用户的历史互动记录',
        category: 'memory',
        defaultEnabled: true,
        definition: {
            description: "获取与用户的历史互动记录。",
            parameters: {
                type: "object",
                properties: {
                    user_id: { type: "string", description: "用户ID，可省略则查询当前对话用户" },
                    event_type: { type: "string", description: "事件类型筛选，不填则返回所有类型" },
                    limit: { type: "integer", description: "返回记录数量限制，默认10条" }
                },
                required: []
            }
        }
    }
};

/**
 * 获取所有工具名称列表
 * @returns {string[]} 工具名称数组
 */
export function getAllToolNames() {
    return Object.keys(TOOLS);
}

/**
 * 获取工具信息
 * @param {string} name - 工具名称
 * @returns {object|null} 工具信息
 */
export function getTool(name) {
    return TOOLS[name] || null;
}

/**
 * 获取工具的显示标签
 * @param {string} name - 工具名称
 * @returns {string} 显示标签（如果工具不存在，返回名称本身）
 */
export function getToolLabel(name) {
    const tool = TOOLS[name];
    return tool ? tool.label : name;
}

/**
 * 按分类获取工具列表
 * @param {string} categoryId - 分类ID
 * @returns {object[]} 工具列表
 */
export function getToolsByCategory(categoryId) {
    return Object.values(TOOLS).filter(tool => tool.category === categoryId);
}

/**
 * 获取分类信息
 * @param {string} categoryId - 分类ID
 * @returns {object|null} 分类信息
 */
export function getCategory(categoryId) {
    return CATEGORIES.find(cat => cat.id === categoryId) || null;
}

/**
 * 获取默认启用的工具列表
 * @returns {object} 按分类的默认启用工具 { favor_tools: [...], ... }
 */
export function getDefaultEnabledToolsByCategory() {
    const result = {};
    for (const category of CATEGORIES) {
        result[category.field] = Object.values(TOOLS)
            .filter(tool => tool.category === category.id && tool.defaultEnabled)
            .map(tool => tool.name);
    }
    return result;
}

/**
 * 获取默认启用的所有工具名称
 * @returns {string[]} 工具名称数组
 */
export function getDefaultEnabledTools() {
    return Object.values(TOOLS)
        .filter(tool => tool.defaultEnabled)
        .map(tool => tool.name);
}

/**
 * 生成AI工具定义（OpenAI Function Calling格式）
 * @param {string} name - 工具名称
 * @returns {object|null} 工具定义
 */
export function generateToolDefinition(name) {
    const tool = TOOLS[name];
    if (!tool) return null;

    return {
        type: "function",
        function: {
            name: tool.name,
            description: tool.definition.description,
            parameters: tool.definition.parameters
        }
    };
}

/**
 * 批量生成AI工具定义
 * @param {string[]} names - 工具名称数组，不传则生成所有
 * @returns {object[]} 工具定义数组
 */
export function generateToolDefinitions(names) {
    const toolNames = names || Object.keys(TOOLS);
    return toolNames
        .map(name => generateToolDefinition(name))
        .filter(def => def !== null);
}

/**
 * 按分类生成AI工具定义
 * @returns {object} 按分类的工具定义 { favor: [...], ... }
 */
export function generateToolDefinitionsByCategory() {
    const result = {};
    for (const category of CATEGORIES) {
        result[category.id] = Object.values(TOOLS)
            .filter(tool => tool.category === category.id)
            .map(tool => generateToolDefinition(tool.name));
    }
    return result;
}

/**
 * 迁移旧配置中的工具名称
 * 处理废弃工具、分组变更等情况
 * @param {object} oldConfig - 旧配置 { favor_tools: [...], ... }
 * @returns {object} 迁移后的配置
 */
export function migrateToolConfig(oldConfig) {
    if (!oldConfig || typeof oldConfig !== 'object') {
        return getDefaultEnabledToolsByCategory();
    }

    const newConfig = {};
    const validToolNames = new Set(Object.keys(TOOLS));

    for (const category of CATEGORIES) {
        const field = category.field;
        const oldTools = oldConfig[field];

        if (Array.isArray(oldTools)) {
            const validTools = oldTools.filter(toolName => validToolNames.has(toolName));
            newConfig[field] = validTools;
        } else {
            newConfig[field] = [];
        }
    }

    return newConfig;
}

export default {
    TOOLS,
    CATEGORIES,
    getAllToolNames,
    getTool,
    getToolLabel,
    getToolsByCategory,
    getCategory,
    getDefaultEnabledToolsByCategory,
    getDefaultEnabledTools,
    generateToolDefinition,
    generateToolDefinitions,
    generateToolDefinitionsByCategory,
    migrateToolConfig
};
