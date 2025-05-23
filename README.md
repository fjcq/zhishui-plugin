# zhishui-plugin

[![Gitee访问量](https://visitor-badge.glitch.me/badge?page_id=fjcq.zhishui-plugin&right_color=red&left_text=Gitee访问量)](https://gitee.com/fjcq/zhishui-plugin)
[![GitHub访问量](https://visitor-badge.glitch.me/badge?page_id=github.fjcq.zhishui-plugin&right_color=blue&left_text=GitHub访问量)](https://github.com/fjcq/zhishui-plugin)
[![Gitee Star](https://gitee.com/fjcq/zhishui-plugin/badge/star.svg?theme=dark)](https://gitee.com/fjcq/zhishui-plugin/stargazers)
[![GitHub Star](https://img.shields.io/github/stars/fjcq/zhishui-plugin?style=flat-square&logo=github)](https://github.com/fjcq/zhishui-plugin/stargazers)

---

## ✨ 插件简介

**zhishui-plugin** 是一款为 [Yunzai-Bot](https://gitee.com/yoimiya-kokomi/Miao-Yunzai) 打造的多功能娱乐扩展插件，集成了**搜剧**、**AI对话**和**乐器演奏**三大核心功能。  
插件支持多资源站点切换、AI角色自定义、语音互动、乐器简谱演奏等丰富玩法，满足群聊娱乐、智能对话和音乐创作等多样需求。配置灵活，易于上手，是提升群聊活跃度与趣味性的理想选择。

---

## 🚀 安装与更新

### 1. 下载插件

在云崽根目录下打开终端，选择合适的命令：

- **国内网络**  

  ```bash
  git clone https://gitee.com/fjcq/zhishui-plugin.git ./plugins/zhishui-plugin
  ```

- **国外网络**  

  ```bash
  git clone https://github.com/fjcq/zhishui-plugin.git ./plugins/zhishui-plugin
  ```

### 2. 安装依赖

在云崽根目录下执行：

```bash
pnpm install --filter=zhishui-plugin
```

> **注意**：请务必直接复制命令，避免依赖丢失。  
> `--filter=zhishui-plugin` 只安装本插件依赖。

### 3. 更新插件

发送 `#止水更新` 或 `#止水强制更新` 指令即可。

---

## 🧩 功能总览

---

### 🎬 一、搜剧功能

- 支持多资源站点切换，接口自定义管理
- 剧集搜索、分页、选集、切换播放线路
- 支持查看和管理个人搜剧记录

**常用指令：**

| 指令                | 说明                           |
|---------------------|--------------------------------|
| `#搜剧+剧名`        | 搜索指定剧名                   |
| `#取消搜剧`         | 取消当前搜剧                   |
| `#下一页`           | 搜索结果分页                   |
| `#选剧+数字`        | 选择要观看的剧集               |
| `#看剧+数字/上一集/下一集/最后一集` | 观看指定集数或切换集数 |
| `#线路+数字/名称`   | 切换播放线路                   |
| `#设置搜剧接口+数字`| 切换当前使用的资源站点         |
| `#查看搜剧接口`     | 查看所有可用资源站点           |
| `#增加搜剧接口\|接口地址\|站点名称\|显示海报` | 增加自定义资源站点（如：`#增加搜剧接口<http://xxx/api.php/provide/vod/>\|我的站点\|true`）|
| `#删除搜剧接口+编号`| 删除指定资源站点               |
| `#我的搜剧`         | 查看个人搜剧与播放记录         |

---

### 🤖 二、AI对话功能

- 支持多种主流 AI 接口（如 ChatGPT、DeepSeek 等）
- 角色、场景、主人信息均可自定义
- 内置语音回复与好感度系统
- 群聊专属角色与上下文，互不干扰

**常用指令：**

| 指令                              | 说明                                         |
|-----------------------------------|----------------------------------------------|
| `#止水帮助`                       | 查看插件帮助                                 |
| `#止水重置聊天`                   | 重置当前聊天上下文（仅限主人）               |
| `#止水修改昵称+昵称`               | 修改对话触发昵称                             |
| `#止水语音开启/关闭`               | 开启/关闭语音回复（仅限主人）                |
| `#止水设置发音人+编号`             | 设置语音发音人（仅限主人）                   |
| `#止水查看发音人`                  | 查看所有可用发音人                           |
| `#止水设置身份+JSON`               | 设置当前对话身份（仅限主人）                 |
| `#止水查看角色`                    | 查看当前角色设定                             |
| `#止水角色列表`                    | 查看所有可用角色                             |
| `#止水私聊回复开启/关闭`           | 开启或关闭私聊AI回复（仅限主人）             |
| `#止水设置场景+JSON`               | 设置对话场景（仅限主人，私聊使用）           |
| `#止水查看场景`                    | 查看当前场景设定（仅限主人，私聊使用）       |
| `#止水查看好感度`                  | 查看好感度（主人/管理员可@他人）             |
| `@某人 #止水查看好感度`            | 查看他人好感度（仅限主人/管理员）            |
| `#止水设置好感度+数值`             | 设置好感度（仅限主人/管理员）                |
| `@某人 #止水设置好感度 50`         | 设置他人好感度（仅限主人/管理员）            |
| `#止水查看API`                     | 查看当前API参数、API列表及指令引导（私聊用） |
| `#止水切换API+序号`                | 切换API（仅限主人，私聊用）                  |
| `#止水设置API类型/地址/密钥/模型/助手ID 值` | 设置当前API参数（仅限主人，敏感参数仅私聊） |
| `#止水设置代理+地址`                | 设置代理（仅限主人）                         |
| `#止水开启代理`/`#止水关闭代理`     | 开启/关闭代理（仅限主人）                    |

---

### 🎵 三、乐器演奏功能

- 支持钢琴、八音盒、古筝、吉他、萨克斯、小提琴、箫、西域琴等多种乐器
- 支持简谱输入，节拍自定义，自动合成乐曲
- 支持高品质演奏模式

**常用指令：**

| 指令                    | 说明                                               |
|-------------------------|----------------------------------------------------|
| `#演奏乐器简谱\|节拍`      | 按指定乐器、简谱和节拍演奏（如：`#演奏钢琴+6__+4+3+2_\|82`）|
| `#取消演奏`             | 取消当前演奏                                       |
| `#高品质演奏开启/关闭`   | 开启或关闭高品质演奏（仅限主人）                   |
| `#调试演奏简谱\|节拍`      | 调试演奏功能，输出合成音频                        |
| `#演奏帮助`             | 查看演奏功能详细说明                               |

**演奏指令说明：**

- `#演奏乐器`：指定乐器（如钢琴、八音盒等），如不指定默认钢琴
- 简谱部分：如 `+6__+4+3+2`，数字为音符，`+`为高音，`-`为低音，`_`为延音
- `|节拍`：如 `|82`，表示每分钟82拍

---

## ⚙️ 配置说明

> **推荐：**  
> 建议配合 [锅巴插件](https://gitee.com/guoba-yunzai/guoba-plugin) 使用，可通过前端页面对本插件进行可视化配置，无需手动编辑配置文件，操作更便捷！

- 插件支持前端可视化配置，支持自定义资源站点、AI接口、角色、代理等。
- 角色配置支持全局与群专属，支持 JSON 格式编辑。
- 资源站点数组需符合插件要求的数据结构，详见 `config/default_config/souju.yaml` 示例。

---

### 🔑 AI接口Key申请与使用说明

默认配置文件 `config/default_config/duihua.yaml` 中包含了三种主流AI接口（OpenAI、硅基流动、腾讯元器）的示例配置。**你需要根据实际需求申请各自的API Key，并填写到配置文件中：**

- **OpenAI（如 ChatGPT、DeepSeek）**
  - 访问 [OpenAI官网](https://platform.openai.com/) 或 [DeepSeek官网](https://deepseek.com/) 注册账号并获取API Key。
  - 将申请到的API Key填入 `ApiKey` 字段，API地址和模型名称请参考官方文档或示例配置。

- **硅基流动（SiliconFlow）**
  - 访问 [硅基流动官网](https://siliconflow.cn/) 注册账号，进入控制台获取API Key。
  - 将API Key填入 `ApiKey` 字段，API地址和模型名称请参考官方文档或示例配置。

- **腾讯元器（腾讯混元）**
  - 访问 [腾讯元器官网](https://yuanqi.tencent.com/) 注册账号，创建助手并获取 `ApiKey` 和 `TencentAssistantId`。
  - 将 `ApiKey` 和 `TencentAssistantId` 分别填入对应字段，API地址和模型名称请参考官方文档或示例配置。

> **注意：**  
>
> - 不同接口的API Key不可通用，请务必填写你实际申请到的Key。  
> - 建议不要将API Key泄露给他人，避免账号被滥用。  
> - 若遇到接口不可用、额度不足、模型不支持等问题，请优先检查API Key和接口参数是否正确。

---

## ❓ 常见问题

### AI接口常见问题

> - **API密钥无效/请求频繁/模型错误等**  
>   请检查 API 地址、KEY、模型名称是否正确，或更换代理节点。
>
> - **国内无法访问OpenAI**  
>   请配置代理或使用反代服务。
>
> - **角色设定触发安全机制**  
>   请适当修改角色设定，避免敏感内容。

### 演奏功能常见问题

> - **提示未配置ffmpeg**  
>   请确保已安装 [ffmpeg](https://ffmpeg.org/download.html) 并配置环境变量。
>
> - **音频合成失败/无声音**  
>   检查乐器音源文件是否完整，简谱格式是否正确。
>
> - **不支持的乐器或音符**  
>   请参考帮助指令获取支持的乐器和简谱格式。

---

## 💬 交流群

- 止水插件交流群：[556388103](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=nHBGClQFxzzlokib8TRqbdVoam6kPN3z&authKey=kxnCLF%2Boj%2FCHRulcjeIWJdX5aedRVP4sAQxwKZKe5wE36ox%2FYwsHWte2cvrAQRnf&noverify=0&group_code=556388103)

---

## 🙏 致谢

感谢所有参与和支持本插件开发的朋友，欢迎反馈建议与贡献代码！
