# zhishui-plugin  

[![访问量](https://visitor-badge.glitch.me/badge?page_id=fjcq.zhishui-plugin&right_color=red&left_text=访%20问%20量)](https://gitee.com/fjcq/zhishui-plugin)
<a href='https://gitee.com/fjcq/zhishui-plugin/stargazers'><img src='https://gitee.com/fjcq/zhishui-plugin/badge/star.svg?theme=dark' alt='star'></img></a>

[![访问量](https://profile-counter.glitch.me/fjcq-zhishui-plugin/count.svg)](https://gitee.com/fjcq/zhishui-plugin)

## 介绍  

**zhishui-plugin** 是 **[Yunzai-Bot](https://gitee.com/yoimiya-kokomi/Miao-Yunzai)** 的扩展插件，提供了搜剧、AI对话等娱乐功能。
具体功能可在安装插件后，通过发送`#止水帮助`来进行查看。

## 安装教程  

### 第 1 步：下载插件

在云崽根目录下打开终端，运行

```bash
git clone https://gitee.com/fjcq/zhishui-plugin.git ./plugins/zhishui-plugin  
```

### 第 2 步：安装依赖

要在云崽根目录下运行此命令：

```bash
pnpm install --filter=zhishui-plugin
```

> 注：请务必直接复制提供的命令，否则可能会导致依赖丢失的情况，若发生需自行重新安装。<br>
> `--filter=zhishui-plugin`：只安装`zhishui-plugin`下的依赖，其他依赖不处理，防止丢失。

## 更新插件  

发送`#止水更新`或者`#止水强制更新`指令

## 功能介绍  

<details>  
  <summary>搜剧</summary>  

- `#搜剧+剧名`  
  根据剧名进行搜索  

- `#取消搜剧`  
  取消当前的[#搜剧]  

- `#下一页`  
  `#搜剧`结果过多时，将会分页显示，使用此命令查看下一页  

- `#选剧+数字`  
  `#搜剧`之后，选择要看的影视剧  
  比如：`#选剧1`
  
- `#选剧+数字`  
  `#看剧`之后，选择要观看的资源  
  比如：`#看剧1` `#看剧上一集` `#看剧下一集`
  
- `#线路+数字`  
  `#选剧`之后，可以根据需要切换到不同的播放线路  

- `#设置搜剧接口`+数字  
  切换搜索接口  

- `#查看搜剧接口`  
  查看可用的搜剧接口  

- `#增加搜剧接口`接口地址|站点名称
  增加自定义搜索接口，例如：`#增加搜剧接口http://127.0.0.1/api.php/provide/vod/|我的网站`  

- `#删除搜剧接口`+编号  
  删除指定的搜剧接口，例如：#删除搜剧接口1  

- `#我的搜剧`  
  查看用户的搜剧记录、播放记录

- `#添加搜剧接口`
  未完成，敬请期待  

</details>

<details>
  <summary>对话</summary>  
  使用Bing或者chatGPT进行AI对话  

- `止水重置聊天`  
  结束当前的聊天话题。 （仅限主人可用）

- `#止水修改昵称`+昵称
  修改对话触发昵称。 例如：`#止水对话修改昵称小七`，成功之后可以用`小七你好`，将会收到回复

- `#止水语音(开启|关闭)`
  开启后会以语音的形式回复对话内容。（仅限主人可用）  
  
- `#止水<设置|查看>发音人`+发音人数字编号
  修改对话触发昵称。 例如：`#止水对话设置发音人44`，可以切换不同的发音人  
  *仅限主人可用*

- `#止水<设置|查看>对话身份`+身份描述文本  
  例如：`#设置对话身份从现在开始你是一只喵娘`，可以设置对话的身份，用于区分不同场景的对话。
  *仅限主人可用*

- `#止水<设置|查看>对话场景`+场景描述文本
  场景设定较为复杂，可以修改主人相关设定，但尽量不要修改里面有关的消息格式的设定，可能会导致无法识别不同的用户身份
  *仅限主人可用*

- `#止水查看好感度` 查看指定用户的好感度
  群员使用`#查看好感度`可查看自己的好感度，主人可以@群员，查看他人好感度。  
  *仅限主人可用*

- `#止水设置好感度<好感度>` 设置指定用户的好感度
  例如 @群员`#设置好感度50` （仅限主人可用）
  *仅限主人可用*

- `#止水<设置|查看>API` 设置或者查看当前OpenAI API链接地址
  *仅限主人可用*

- `#止水<设置|查看>KEY` 设置或者查看当前OpenAI KEY
  *仅限主人可用*

- `#止水<设置|开启|关闭>代理` 设置对话所使用的代理
  由于必应会根据使用者地区限制访问，`关闭代理`后，插件会访问 @地球生物 提供的服务器。`开启代理`后，使用的是你设置好的代理。（仅限主人可用）  
  例如 `#止水对话设置代理`<http://127.0.0.1:7890>  `#止水开启代理`  `#止水关闭代理`
  *仅限主人可用*

</details>  

## 交流群  

点击加入：[止水插件群 556388103](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=nHBGClQFxzzlokib8TRqbdVoam6kPN3z&authKey=kxnCLF%2Boj%2FCHRulcjeIWJdX5aedRVP4sAQxwKZKe5wE36ox%2FYwsHWte2cvrAQRnf&noverify=0&group_code=556388103)  

## 常见问题  

<details>

</details>
