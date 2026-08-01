/**
 * 生图工具定义
 * 定义 AI 可调用的 AI 图片生成相关工具
 * 支持通义万相（阿里云）、DALL-E（OpenAI）、文心一格（百度）三种服务商
 */

export const imageTools = [
    {
        type: "function",
        function: {
            name: "generate_image",
            description: `AI 图片生成工具。根据文字提示词（prompt）调用生图模型生成图片，并将图片直接发送到当前对话中。

【使用场景】
- 用户明确要求"画一张"、"生成一张"、"帮我画"等生图请求
- 用户希望将某个场景、概念、形象具象化为图片
- 用户需要配图来辅助说明某个内容
- 当前对话模型本身不支持生图，但用户有生图需求

【不要使用的场景】
- 用户只是询问信息、闲聊
- 用户要求发送已有图片（使用 send_image 工具）
- 用户要求生成表情包（使用 generate_meme 工具）

【参数说明】
- prompt：图片描述，越详细效果越好。建议包含主体、风格、构图、光线等要素
- provider：生图服务商，不填则使用配置的默认服务商
  - tongyi：通义万相（阿里云），国内访问稳定，中文理解好
  - dall_e：DALL-E（OpenAI），需要代理，国际通用
  - wenxin：文心一格（百度），国内服务，中文场景友好
- size：图片尺寸，不填则使用默认尺寸 1024*1024
- style：图片风格（仅通义万相 wanx-v1 模型有效）

【返回内容】
返回生成结果，包含图片本地路径、服务商、耗时等信息。图片会自动发送到对话中，无需再调用 send_image。

【注意事项】
- 生图通常需要 5-30 秒，请耐心等待
- 单用户有调用频率限制（默认 10 秒一次）
- 提示词应使用中文或英文，避免歧义
- 若生图失败会返回错误信息，可调整提示词后重试`,
            parameters: {
                type: "object",
                properties: {
                    prompt: {
                        type: "string",
                        description: "图片描述提示词。建议详细描述：主体对象、艺术风格、构图视角、光线氛围等。例如：'一只橘色的猫坐在窗台上，阳光透过玻璃洒下，写实风格，柔和光线'"
                    },
                    provider: {
                        type: "string",
                        enum: ["tongyi", "dall_e", "wenxin"],
                        description: "生图服务商。不填则使用配置的默认服务商。tongyi=通义万相，dall_e=DALL-E，wenxin=文心一格"
                    },
                    size: {
                        type: "string",
                        description: "图片尺寸。通义万相支持 1024*1024、720*1280、1280*720；DALL-E 支持 1024x1024、1792x1024、1024x1792；文心一格支持 1024*1024、1024*1536、1536*1024。不填则使用默认尺寸"
                    },
                    style: {
                        type: "string",
                        description: "图片风格，仅通义万相 wanx-v1 模型有效。可选：<auto>、<photography>、<portrait>、<3d cartoon>、<anime>、<oil painting>、<watercolor>、<sketch>、<chinese painting>、<flat illustration>"
                    }
                },
                required: ["prompt"]
            }
        }
    }
];

export default imageTools;
