# 🌊 止水插件 | ZhiShui Plugin

> *一个为 Yunzai-Bot 打造的现代化多功能插件*

![license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)
![node](https://img.shields.io/badge/node-%3E%3D16-brightgreen.svg?style=flat-square)
![bot](https://img.shields.io/badge/bot-Yunzai--Bot-orange.svg?style=flat-square)

[![Gitee Star](https://gitee.com/fjcq/zhishui-plugin/badge/star.svg?theme=gvp)](https://gitee.com/fjcq/zhishui-plugin/stargazers)
[![GitHub Star](https://img.shields.io/github/stars/fjcq/zhishui-plugin?style=flat-square&logo=github&color=gold)](https://github.com/fjcq/zhishui-plugin/stargazers)
[![访问量](https://visitor-badge.glitch.me/badge?page_id=fjcq.zhishui-plugin&right_color=blueviolet&left_text=访问量)](https://gitee.com/fjcq/zhishui-plugin)

---

## 目录

- [插件特色](#插件特色)
- [快速开始](#快速开始)
- [功能指南](#功能指南)
- [环境要求](#环境要求)
- [常见问题](#常见问题)
- [版本信息](#版本信息)
- [参与贡献](#参与贡献)

---

## 插件特色

**止水插件** 是为 [Yunzai-Bot](https://gitee.com/yoimiya-kokomi/Miao-Yunzai) 设计的现代化多功能扩展插件，采用 ES Module 开发，代码规范，易于维护和扩展。

### 三大核心功能

#### 智能搜剧

- 多资源站点一键切换
- 海量影视资源搜索
- 智能推荐与记录
- 流畅播放体验
- 现代化深色主题界面

#### AI智能对话

- 多模型接口支持（OpenAI、DeepSeek、硅基流动等）
- 角色定制与场景设定
- 语音回复与情感系统
- 群聊独立上下文
- 好感度系统

#### 乐器演奏

- 8种精美乐器音源
- 简谱智能解析
- 高品质音频合成
- 实时演奏体验
- 支持 FFmpeg 音频处理

---

## 快速开始

### 一键安装

在 Yunzai-Bot 根目录执行以下命令：

```bash
# 国内网络推荐
git clone https://gitee.com/fjcq/zhishui-plugin.git ./plugins/zhishui-plugin

# 国外网络推荐
git clone https://github.com/fjcq/zhishui-plugin.git ./plugins/zhishui-plugin

# 安装依赖
pnpm install --filter=zhishui-plugin
```

### 插件更新

```bash
# 发送指令更新
#止水更新

# 强制更新（覆盖本地修改）
#止水强制更新
```

### 配置方式

#### 推荐：可视化配置

配合 [锅巴插件](https://gitee.com/guoba-yunzai/guoba-plugin) 使用，享受前端可视化配置体验！

#### 手动配置

配置文件位于 `plugins/zhishui-plugin/config/` 目录：

- `videoSearch.yaml` - 搜剧功能配置
- `chat.yaml` - AI对话功能配置
- `voice.yaml` - 语音功能配置
- `instrumentPlay.yaml` - 演奏功能配置
- `whole.yaml` - 全局设置
- `proxy.yaml` - 代理设置

默认配置位于 `plugins/zhishui-plugin/config/default_config/` 目录，可参考其格式进行自定义配置。

---

## 功能指南

### 搜剧功能

#### 基础操作

| 指令 | 功能说明 | 示例 |
| ------ | ---------- | ------ |
| `#搜剧+剧名` | 搜索影视剧集 | `#搜剧庆余年` |
| `#选剧+数字` | 选择观看剧集 | `#选剧1` |
| `#看剧+集数` | 播放指定集数 | `#看剧5` |
| `#下一页` | 搜索结果翻页 | `#下一页` |
| `#取消搜剧` | 退出搜剧模式 | `#取消搜剧` |

#### 线路切换

| 指令 | 功能说明 | 示例 |
| ------ | ---------- | ------ |
| `#线路+数字` | 切换播放线路 | `#线路2` |
| `#看剧上一集` | 播放上一集 | `#看剧上一集` |
| `#看剧下一集` | 播放下一集 | `#看剧下一集` |
| `#看剧最后一集` | 播放最新集 | `#看剧最后一集` |

#### 站点管理

| 指令 | 功能说明 | 示例 |
| ------ | ---------- | ------ |
| `#查看搜剧接口` | 查看所有资源站 | `#查看搜剧接口` |
| `#设置搜剧接口+数字` | 切换资源站 | `#设置搜剧接口2` |
| `#增加搜剧接口` | 添加自定义站点 | `#增加搜剧接口\|http://xxx\|站点名\|true` |
| `#删除搜剧接口+编号` | 删除指定站点 | `#删除搜剧接口3` |
| `#我的搜剧` | 查看观看记录 | `#我的搜剧` |

---

### AI对话功能

#### 基础对话

| 指令 | 功能说明 | 权限 |
| ------ | ---------- | ------ |
| `#止水帮助` | 查看帮助信息 | 所有人 |
| `#止水重置聊天` | 重置对话上下文 | 主人 |
| `#止水修改昵称+昵称` | 修改触发昵称 | 主人 |
| `#清除历史` | 清除对话历史记录 | 所有人 |

#### 语音设置

| 指令 | 功能说明 | 权限 |
| ------ | ---------- | ------ |
| `#止水语音开启/关闭` | 控制语音回复 | 主人 |
| `#止水查看发音人` | 查看语音选项 | 所有人 |
| `#止水设置发音人+编号` | 设置发音人 | 主人 |

#### 角色系统

| 指令 | 功能说明 | 权限 |
| ------ | ---------- | ------ |
| `#止水角色列表` | 查看所有角色 | 所有人 |
| `#止水查看角色` | 查看当前角色 | 所有人 |
| `#设置角色+编号` | 设置当前角色 | 所有人 |
| `#止水设置身份+JSON` | 自定义角色 | 主人 |
| `#止水设置场景+JSON` | 设置对话场景 | 主人(私聊) |

#### 好感度系统

| 指令 | 功能说明 | 权限 |
| ------ | ---------- | ------ |
| `#查看好感度` | 查看个人好感度 | 所有人 |
| `@某人 #查看好感度` | 查看他人好感度 | 主人/管理员 |
| `#设置好感度+数值` | 设置好感度 | 主人/管理员 |
| `#查看好感度历史` | 查看好感度变化历史 | 所有人 |

#### API管理

| 指令 | 功能说明 | 权限 |
| ------ | ---------- | ------ |
| `#止水查看API` | 查看API配置 | 主人(私聊) |
| `#止水切换API+序号` | 切换API | 主人(私聊) |
| `#止水设置API类型/地址/密钥/模型/助手ID 值` | 配置API参数 | 主人(私聊) |
| `#止水设置代理+地址` | 设置网络代理 | 主人 |
| `#止水开启/关闭代理` | 控制代理开关 | 主人 |
| `#止水查看原始数据` | 查看API原始返回数据 | 主人(私聊) |

#### 配置管理

| 指令 | 功能说明 | 权限 |
| ------ | ---------- | ------ |
| `#查看个人配置` | 查看个人配置 | 所有人 |
| `#重置个人配置` | 重置个人配置 | 所有人 |
| `#查看用户配置<QQ>` | 查看指定用户配置 | 主人/管理员 |
| `#重置用户配置<QQ>` | 重置指定用户配置 | 主人/管理员 |
| `#查看用户配置统计` | 查看用户统计信息 | 主人 |

#### 文本转图片功能

- 大部分对话回复现在默认以图片形式展示，提升视觉体验
- 部分命令（如配置查看类命令）保持文本形式，方便用户复制内容
- 支持错误信息的图片化展示，保持界面一致性

---

### 乐器演奏功能

#### 演奏指令

| 指令格式 | 功能说明 | 示例 |
| ---------- | ---------- | ------ |
| `#演奏+乐器+简谱\|节拍` | 演奏指定乐器 | `#演奏钢琴+6__+4+3+2_\|82` |
| `#调试演奏+简谱\|节拍` | 调试演奏功能 | `#调试演奏+6__+4+3+2_\|82` |
| `#取消演奏` | 停止当前演奏 | `#取消演奏` |
| `#演奏帮助` | 查看演奏说明 | `#演奏帮助` |

#### 支持乐器

- **钢琴** (gangqin) - 经典钢琴音色
- **八音盒** (ba) - 温柔八音盒音色
- **古筝** (gu) - 传统古筝音色
- **吉他** (jita) - 民谣吉他音色
- **萨克斯** (sa) - 爵士萨克斯音色
- **小提琴** (ti) - 优美小提琴音色
- **箫** (xiao) - 悠扬箫声音色
- **西域琴** (xiyu) - 异域风情音色

#### 简谱说明

- **音符**: 1-7 表示 do-si
- **高音**: `+6` 表示高音6
- **低音**: `-6` 表示低音6
- **延音**: `_` 表示延长半拍
- **节拍**: `|82` 表示每分钟82拍

#### 演奏设置

| 指令 | 功能说明 | 权限 |
| ------ | ---------- | ------ |
| `#高品质演奏开启/关闭` | 控制音质模式 | 主人 |

---

## 环境要求

### 系统要求

- **操作系统**: Windows / Linux / macOS
- **Node.js**: >= 16
- **Yunzai-Bot**: 最新版本
- **FFmpeg**: 用于音频处理功能

### 依赖项

插件启动时会自动检查以下依赖项：

- `fetch-undici` - HTTP 请求
- `fluent-ffmpeg` - 音频处理
- `keyv-file` - 数据存储
- `undici` - HTTP 客户端
- `chalk` - 终端彩色输出

### FFmpeg 音频支持

乐器演奏功能需要 FFmpeg 支持，请根据系统选择安装方式：

#### Windows 系统

1. 访问 [FFmpeg 官网](https://ffmpeg.org/download.html) 或 [Gyan 官网](https://www.gyan.dev/ffmpeg/builds/)
2. 下载 `ffmpeg-release-essentials.zip`
3. 解压后将 `bin` 目录添加到系统环境变量 `Path`
4. 重启终端，执行 `ffmpeg -version` 验证安装

#### Linux 系统

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# CentOS/RHEL
sudo yum install epel-release && sudo yum install ffmpeg

# 验证安装
ffmpeg -version
```

#### macOS 系统

```bash
# 使用 Homebrew
brew install ffmpeg

# 验证安装
ffmpeg -version
```

### AI接口配置

#### 支持的 AI 服务

| 服务商 | 官网地址 | 特点 |
| ------ | ---------- | ------ |
| **OpenAI** | [官方网站](https://platform.openai.com/) | 原版 ChatGPT |
| **DeepSeek** | [官方网站](https://deepseek.com/) | 国产优秀模型 |
| **硅基流动** | [官方网站](https://siliconflow.cn/) | 免费额度丰富 |
| **腾讯元器** | [官方网站](https://yuanqi.tencent.com/) | 腾讯混元模型 |

#### 配置步骤

1. **申请 API Key**: 前往对应官网注册并获取密钥
2. **填写配置**: 在 `config/config/chat.yaml` 中填写相关信息
3. **测试连接**: 发送 `#止水查看API` 验证配置

#### 安全建议

- 不要将 API Key 分享给他人
- 定期检查 API 使用量和余额
- 设置合理的速率限制避免滥用

### 腾讯云API配置

#### 申请腾讯云SecretId和SecretKey

1. **注册腾讯云账号**: 前往 [腾讯云官网](https://cloud.tencent.com/) 注册账号并完成实名认证

2. **创建API密钥**:
   - 登录腾讯云控制台
   - 进入 [访问管理](https://console.cloud.tencent.com/cam/overview) 页面
   - 左侧导航栏选择 **API密钥管理**
   - 点击 **新建密钥** 按钮
   - 记录生成的 **SecretId** 和 **SecretKey**（请妥善保管，不要分享给他人）

3. **配置语音服务**:
   - 在 `config/config/voice.yaml` 文件中填写腾讯云TTS配置
   - 主要配置项包括：
     - `Enable`: 是否启用腾讯云TTS
     - `Region`: 服务地域（如 ap-guangzhou）
     - `SecretId`: 腾讯云API密钥SecretId
     - `SecretKey`: 腾讯云API密钥SecretKey
     - `VoiceType`: 语音类型
     - `Speed`: 语速 (0.5-2.0)
     - `Volume`: 音量 (0-10)
     - `VoiceId`: 音色ID
     - `SampleRate`: 采样率
     - `Codec`: 音频格式
     - `Language`: 语言

4. **验证配置**:
   - 发送 `#止水语音开启` 命令开启语音功能
   - 发送 `#止水查看发音人` 查看语音选项
   - 发送对话内容测试语音回复效果

#### 注意事项

- 腾讯云API密钥具有较高权限，请妥善保管
- 腾讯云文字转语音服务可能产生费用，请参考 [腾讯云TTS pricing](https://cloud.tencent.com/product/tts/pricing)
- 建议为API密钥设置合理的权限范围，遵循最小权限原则

---

## 常见问题

### API 相关问题

| 问题 | 原因 | 解决方案 |
| ------ | ---------- | ------ |
| API密钥无效 | 密钥错误或过期 | 重新获取并填写正确的API Key |
| 请求频繁 | 超出速率限制 | 等待或升级API套餐 |
| 模型不存在 | 模型名称错误 | 检查并更正模型名称 |
| 网络超时 | 网络连接问题 | 检查网络或配置代理 |

### 演奏功能问题

| 问题 | 原因 | 解决方案 |
| ------ | ---------- | ------ |
| 提示未配置ffmpeg | FFmpeg未安装 | 按上方指引安装FFmpeg |
| 音频合成失败 | 音源文件损坏 | 重新下载插件或检查文件完整性 |
| 简谱格式错误 | 简谱语法不正确 | 参考 `#演奏帮助` 查看正确格式 |
| 无声音输出 | 音频设备问题 | 检查系统音频设置 |

### 搜剧功能问题

| 问题 | 原因 | 解决方案 |
| ------ | ---------- | ------ |
| 海报显示异常 | CSS样式问题 | 更新到最新版本 |
| 搜索无结果 | 资源站点失效 | 切换其他资源站点 |
| 播放链接失效 | 视频源过期 | 尝试其他线路或重新搜索 |

### 依赖安装问题

| 问题 | 原因 | 解决方案 |
| ------ | ---------- | ------ |
| 依赖安装失败 | Node.js版本过低 | 检查Node.js版本是否>=16 |
| 网络超时 | 网络连接问题 | 使用国内镜像源或配置代理 |
| 缓存问题 | pnpm缓存损坏 | 执行 `pnpm store prune` 清除缓存 |

---

## 版本信息

[![version](https://img.shields.io/badge/version-1.3.1-brightgreen.svg?style=flat-square)](CHANGELOG.md)
![last commit](https://img.shields.io/badge/last%20commit-2025.01-blue.svg?style=flat-square)

### 最新更新

#### v1.3.1 (2025-01-27)

- 🤖 **对话功能增强** - 增强API原始响应数据处理功能，优化数据展示
- 🏗️ **目录结构优化** - 统一功能模块命名，重命名资源目录（yanzou→instrumentPlay，souju→videoSearch）
- 📸 **文本转图片功能** - 实现对话回复的图片化展示，提升视觉体验
- 💝 **好感度系统扩展** - 新增好感度历史记录功能，支持查看变化历史
- ⚙️ **配置管理优化** - 新增个人配置查看和重置功能，提升用户体验
- 📋 **帮助菜单优化** - 修复帮助命令错误，优化命令分类和图标分配
- 🚀 **命令简化** - 简化好感度和角色设置等常用命令的使用方式

[查看完整更新日志](CHANGELOG.md)

---

## 参与贡献

### 问题反馈

遇到问题或有新功能建议？欢迎提交 Issue：

- [Gitee Issues](https://gitee.com/fjcq/zhishui-plugin/issues)
- [GitHub Issues](https://github.com/fjcq/zhishui-plugin/issues)

### 代码贡献

1. Fork 本项目
2. 创建功能分支：`git checkout -b feature/新功能`
3. 提交更改：`git commit -m '添加新功能'`
4. 推送分支：`git push origin feature/新功能`
5. 提交 Pull Request

### 交流群组

#### 止水插件官方交流群

QQ群：[556388103](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=nHBGClQFxzzlokib8TRqbdVoam6kPN3z&authKey=kxnCLF%2Boj%2FCHRulcjeIWJdX5aedRVP4sAQxwKZKe5wE36ox%2FYwsHWte2cvrAQRnf&noverify=0&group_code=556388103)

---

## 开源协议

本项目采用 [MIT License](LICENSE.txt) 开源协议

---

## 特别感谢

感谢以下项目和开发者的贡献：

- [Yunzai-Bot](https://gitee.com/yoimiya-kokomi/Miao-Yunzai) - 强大的QQ机器人框架
- [锅巴插件](https://gitee.com/guoba-yunzai/guoba-plugin) - 优秀的可视化配置工具
- 所有为本插件提供反馈和建议的用户们

---

## 技术栈

- **运行环境**: Node.js >= 16
- **模块系统**: ES Module (type: "module")
- **目标版本**: ES2020+
- **主要依赖**:
  - `fetch-undici` - HTTP 请求
  - `fluent-ffmpeg` - 音频处理
  - `keyv-file` - 数据存储
  - `undici` - HTTP 客户端
  - `chalk` - 终端彩色输出

**框架依赖** (由 Yunzai-Bot 提供):

- `puppeteer` - 图片渲染
- `art-template` - 模板引擎
- `oicq`/`icqq` - QQ协议支持

---

如果这个项目对你有帮助，请给个 Star 支持一下

> Made with ❤️ by [fjcq](https://gitee.com/fjcq)
