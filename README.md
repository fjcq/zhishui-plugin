# 🌊 止水插件 | ZhiShui Plugin

> *一个为 Yunzai-Bot 打造的现代化多功能插件*

![license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)
![node](https://img.shields.io/badge/node-%3E%3D16-brightgreen.svg?style=flat-square)
![bot](https://img.shields.io/badge/bot-Yunzai--Bot-orange.svg?style=flat-square)

[![Gitee Star](https://gitee.com/fjcq/zhishui-plugin/badge/star.svg?theme=gvp)](https://gitee.com/fjcq/zhishui-plugin/stargazers)
[![GitHub Star](https://img.shields.io/github/stars/fjcq/zhishui-plugin?style=flat-square&logo=github&color=gold)](https://github.com/fjcq/zhishui-plugin/stargazers)
[![访问量](https://visitor-badge.glitch.me/badge?page_id=fjcq.zhishui-plugin&right_color=blueviolet&left_text=访问量)](https://gitee.com/fjcq/zhishui-plugin)

---

## 🎯 插件特色

**止水插件** 是为 [Yunzai-Bot](https://gitee.com/yoimiya-kokomi/Miao-Yunzai) 设计的现代化多功能扩展插件

### 🌟 三大核心功能

#### 🎬 智能搜剧

- 多资源站点一键切换
- 海量影视资源搜索  
- 智能推荐与记录
- 流畅播放体验

#### 🤖 AI智能对话

- 多模型接口支持
- 角色定制与场景设定
- 语音回复与情感系统
- 群聊独立上下文

#### 🎵 乐器演奏

- 8种精美乐器音源
- 简谱智能解析
- 高品质音频合成
- 实时演奏体验

---

## 🚀 快速开始

### 📦 一键安装

在 Yunzai-Bot 根目录执行以下命令：

```bash
# 国内网络推荐
git clone https://gitee.com/fjcq/zhishui-plugin.git ./plugins/zhishui-plugin

# 国外网络推荐  
git clone https://github.com/fjcq/zhishui-plugin.git ./plugins/zhishui-plugin

# 安装依赖
pnpm install --filter=zhishui-plugin
```

### 🔄 插件更新

```bash
# 发送指令更新
#止水更新

# 强制更新（覆盖本地修改）
#止水强制更新
```

### 🎛️ 配置方式

#### 🌟 推荐：可视化配置

配合 [锅巴插件](https://gitee.com/guoba-yunzai/guoba-plugin) 使用，享受前端可视化配置体验！

#### ⚙️ 手动配置

配置文件位于 `plugins/zhishui-plugin/config/config/` 目录：

- `souju.yaml` - 搜剧功能配置
- `duihua.yaml` - AI对话功能配置  
- `yanzou.yaml` - 演奏功能配置
- `whole.yaml` - 全局设置

---

## 📖 功能指南

### 🎬 搜剧功能

#### 🔍 基础操作

| 指令 | 功能说明 | 示例 |
|------|----------|------|
| `#搜剧+剧名` | 搜索影视剧集 | `#搜剧庆余年` |
| `#选剧+数字` | 选择观看剧集 | `#选剧1` |
| `#看剧+集数` | 播放指定集数 | `#看剧5` |
| `#下一页` | 搜索结果翻页 | `#下一页` |
| `#取消搜剧` | 退出搜剧模式 | `#取消搜剧` |

#### 🔄 线路切换

| 指令 | 功能说明 | 示例 |
|------|----------|------|
| `#线路+数字` | 切换播放线路 | `#线路2` |
| `#看剧上一集` | 播放上一集 | `#看剧上一集` |
| `#看剧下一集` | 播放下一集 | `#看剧下一集` |
| `#看剧最后一集` | 播放最新集 | `#看剧最后一集` |

#### ⚙️ 站点管理

| 指令 | 功能说明 | 示例 |
|------|----------|------|
| `#查看搜剧接口` | 查看所有资源站 | `#查看搜剧接口` |
| `#设置搜剧接口+数字` | 切换资源站 | `#设置搜剧接口2` |
| `#增加搜剧接口` | 添加自定义站点 | `#增加搜剧接口\|http://xxx\|站点名\|true` |
| `#删除搜剧接口+编号` | 删除指定站点 | `#删除搜剧接口3` |
| `#我的搜剧` | 查看观看记录 | `#我的搜剧` |

---

### 🤖 AI对话功能

#### 💬 基础对话

| 指令 | 功能说明 | 权限 |
|------|----------|------|
| `#止水帮助` | 查看帮助信息 | 所有人 |
| `#止水重置聊天` | 重置对话上下文 | 主人 |
| `#止水修改昵称+昵称` | 修改触发昵称 | 主人 |

#### 🔊 语音设置

| 指令 | 功能说明 | 权限 |
|------|----------|------|
| `#止水语音开启/关闭` | 控制语音回复 | 主人 |
| `#止水查看发音人` | 查看语音选项 | 所有人 |
| `#止水设置发音人+编号` | 设置发音人 | 主人 |

#### 🎭 角色系统

| 指令 | 功能说明 | 权限 |
|------|----------|------|
| `#止水角色列表` | 查看所有角色 | 所有人 |
| `#止水查看角色` | 查看当前角色 | 所有人 |
| `#止水设置身份+JSON` | 自定义角色 | 主人 |
| `#止水设置场景+JSON` | 设置对话场景 | 主人(私聊) |

#### 💖 好感度系统

| 指令 | 功能说明 | 权限 |
|------|----------|------|
| `#止水查看好感度` | 查看个人好感度 | 所有人 |
| `@某人 #止水查看好感度` | 查看他人好感度 | 主人/管理员 |
| `#止水设置好感度+数值` | 设置好感度 | 主人/管理员 |

#### 🔧 API管理

| 指令 | 功能说明 | 权限 |
|------|----------|------|
| `#止水查看API` | 查看API配置 | 主人(私聊) |
| `#止水切换API+序号` | 切换API | 主人(私聊) |
| `#止水设置API类型/地址/密钥/模型 值` | 配置API参数 | 主人(私聊) |
| `#止水设置代理+地址` | 设置网络代理 | 主人 |
| `#止水开启/关闭代理` | 控制代理开关 | 主人 |

---

### 🎵 乐器演奏功能

#### 🎼 演奏指令

| 指令格式 | 功能说明 | 示例 |
|----------|----------|------|
| `#演奏+乐器+简谱\|节拍` | 演奏指定乐器 | `#演奏钢琴+6__+4+3+2_\|82` |
| `#调试演奏+简谱\|节拍` | 调试演奏功能 | `#调试演奏+6__+4+3+2_\|82` |
| `#取消演奏` | 停止当前演奏 | `#取消演奏` |
| `#演奏帮助` | 查看演奏说明 | `#演奏帮助` |

#### 🎹 支持乐器

- **钢琴** (gangqin) - 经典钢琴音色
- **八音盒** (ba) - 温柔八音盒音色  
- **古筝** (gu) - 传统古筝音色
- **吉他** (jita) - 民谣吉他音色
- **萨克斯** (sa) - 爵士萨克斯音色
- **小提琴** (ti) - 优美小提琴音色
- **箫** (xiao) - 悠扬箫声音色
- **西域琴** (xiyu) - 异域风情音色

#### 🎵 简谱说明

- **音符**: 1-7 表示 do-si
- **高音**: `+6` 表示高音6  
- **低音**: `-6` 表示低音6
- **延音**: `_` 表示延长半拍
- **节拍**: `|82` 表示每分钟82拍

#### ⚙️ 演奏设置

| 指令 | 功能说明 | 权限 |
|------|----------|------|
| `#高品质演奏开启/关闭` | 控制音质模式 | 主人 |

---

## ⚠️ 环境要求与故障排除

### 🔧 FFmpeg 音频支持

乐器演奏功能需要 FFmpeg 支持，请根据系统选择安装方式：

#### Windows 系统

1. 访问 [FFmpeg 官网](https://ffmpeg.org/download.html) 或 [Gyan.dev](https://www.gyan.dev/ffmpeg/builds/)
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

### 🤖 AI接口配置

#### 支持的 AI 服务

| 服务商 | 官网地址 | 特点 |
|--------|----------|------|
| **OpenAI** | [platform.openai.com](https://platform.openai.com/) | 原版 ChatGPT |
| **DeepSeek** | [deepseek.com](https://deepseek.com/) | 国产优秀模型 |
| **硅基流动** | [siliconflow.cn](https://siliconflow.cn/) | 免费额度丰富 |
| **腾讯元器** | [yuanqi.tencent.com](https://yuanqi.tencent.com/) | 腾讯混元模型 |

#### ⚙️ 配置步骤

1. **申请 API Key**: 前往对应官网注册并获取密钥
2. **填写配置**: 在 `config/config/duihua.yaml` 中填写相关信息
3. **测试连接**: 发送 `#止水查看API` 验证配置

#### 🔒 安全建议

- ❌ 不要将 API Key 分享给他人
- ✅ 定期检查 API 使用量和余额
- ✅ 设置合理的速率限制避免滥用

### 🐛 常见问题解决

#### API 相关问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| API密钥无效 | 密钥错误或过期 | 重新获取并填写正确的API Key |
| 请求频繁 | 超出速率限制 | 等待或升级API套餐 |
| 模型不存在 | 模型名称错误 | 检查并更正模型名称 |
| 网络超时 | 网络连接问题 | 检查网络或配置代理 |

#### 演奏功能问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 提示未配置ffmpeg | FFmpeg未安装 | 按上方指引安装FFmpeg |
| 音频合成失败 | 音源文件损坏 | 重新下载插件或检查文件完整性 |
| 简谱格式错误 | 简谱语法不正确 | 参考 `#演奏帮助` 查看正确格式 |
| 无声音输出 | 音频设备问题 | 检查系统音频设置 |

#### 搜剧功能问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 海报显示异常 | CSS样式问题 | 更新到最新版本 |
| 搜索无结果 | 资源站点失效 | 切换其他资源站点 |
| 播放链接失效 | 视频源过期 | 尝试其他线路或重新搜索 |

---

## 🏷️ 版本信息

[![version](https://img.shields.io/badge/version-1.2.9-brightgreen.svg?style=flat-square)](CHANGELOG.md)
![last commit](https://img.shields.io/badge/last%20commit-2025.01-blue.svg?style=flat-square)

### 📋 更新日志

#### v1.2.9 (2025-01-20)

- 🎨 **搜剧功能界面重设计** - 采用现代化深色主题，彩虹渐变配色
- 🖼️ **修复选剧海报显示问题** - 优化HTML结构和CSS样式  
- ✨ **新增动画效果** - 炫彩标题动画、卡片悬停缩放效果
- 💎 **毛玻璃质感设计** - 深色半透明背景，提升视觉层次
- 🤖 **对话功能增强** - 修复配置兼容性问题，优化错误处理
- 🔧 **代码优化** - 重构CSS，兼容新旧配置格式，提升稳定性

[查看完整更新日志](CHANGELOG.md)

---

## 🤝 参与贡献

### 💡 问题反馈

遇到问题或有新功能建议？欢迎提交 Issue：

- [Gitee Issues](https://gitee.com/fjcq/zhishui-plugin/issues)
- [GitHub Issues](https://github.com/fjcq/zhishui-plugin/issues)

### 🔧 代码贡献

1. Fork 本项目
2. 创建功能分支：`git checkout -b feature/新功能`
3. 提交更改：`git commit -m '添加新功能'`
4. 推送分支：`git push origin feature/新功能`
5. 提交 Pull Request

### 📢 交流群组

#### 止水插件官方交流群

🔗 QQ群：[556388103](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=nHBGClQFxzzlokib8TRqbdVoam6kPN3z&authKey=kxnCLF%2Boj%2FCHRulcjeIWJdX5aedRVP4sAQxwKZKe5wE36ox%2FYwsHWte2cvrAQRnf&noverify=0&group_code=556388103)

---

## 📄 开源协议

本项目采用 [MIT License](LICENSE.txt) 开源协议

---

## 🙏 特别感谢

感谢以下项目和开发者的贡献：

- [Yunzai-Bot](https://gitee.com/yoimiya-kokomi/Miao-Yunzai) - 强大的QQ机器人框架
- [锅巴插件](https://gitee.com/guoba-yunzai/guoba-plugin) - 优秀的可视化配置工具
- 所有为本插件提供反馈和建议的用户们

---

### ⭐ 如果这个项目对你有帮助，请给个 Star 支持一下

> Made with ❤️ by [fjcq](https://gitee.com/fjcq)
