# zhishui-plugin  

[![访问量](https://visitor-badge.glitch.me/badge?page_id=fjcq.zhishui-plugin&right_color=red&left_text=访%20问%20量)](https://gitee.com/fjcq/zhishui-plugin)
<a href='https://gitee.com/fjcq/zhishui-plugin/stargazers'><img src='https://gitee.com/fjcq/zhishui-plugin/badge/star.svg?theme=dark' alt='star'></img></a>

[![访问量](https://profile-counter.glitch.me/fjcq-zhishui-plugin/count.svg)](https://gitee.com/fjcq/zhishui-plugin)

## 介绍  
`zhishui-plugin`是`Yunzai-Bot`的扩展插件，提供了搜剧、AI对话等娱乐功能。
具体功能可在安装插件后，通过发送`#止水帮助`来进行查看。

## 安装教程  
#### 第 1 步：下载插件

在云崽根目录下打开终端，运行 

```
git clone https://gitee.com/fjcq/zhishui-plugin.git ./plugins/zhishui-plugin  
```

#### 第 2 步：安装依赖 

要在云崽根目录下运行此命令： 

```
pnpm install --filter=zhishui-plugin
```
> 注：请务必直接复制提供的命令，否则可能会导致依赖丢失的情况，若发生需自行重新安装。<br>
> `--filter=zhishui-plugin`：只安装`zhishui-plugin`下的依赖，其他依赖不处理，防止丢失。 

## 更新插件  

一般会自动更新，如需手动更新，请发送`#止水更新`指令 

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

- `#我的搜剧`  
  查看用户的搜剧记录、播放记录    
 

- `#添加搜剧接口`
  未完成，敬请期待  

</details>

<details>
  <summary>对话</summary>  
  使用Bing或者chatGPT进行AI对话  

- `止水对话重置聊天`  
  结束当前的聊天话题。 

- `#止水对话修改昵称`+昵称
  修改对话触发昵称。 例如：`#止水对话修改昵称小七`，成功之后可以用`小七你好`，将会收到回复

- `#止水对话语音(开启|关闭)`
  开启后会以语音的形式回复对话内容。
  
- `#止水对话设置发音人`+发音人数字编号
  修改对话触发昵称。 例如：`#止水对话设置发音人44`，可以切换不同的发音人  

- `#止水对话查看发音人`
  查看可用的发音人列表。  

- `#止水对话必应开关`  
  切换[开启/关闭]必应对话，如果要启用必应，同时还需要设置好必应参数。  
  
- 设置必应参数    
  *必应参数需自行提供，否则无法使用必应对话。*  
  请在浏览器中打开必应对话，按F12打开`开发人员工具`，复制页面`Cookie`后发送给BOT，Cookie中必须包含`KievRPSSecAuth`和`_U`字段  

- `#止水对话查看必应参数`  
  可查看当前的必应参数 

- `#止水对话设置对话身份`+身份描述文本  
  例如：`#设置对话身份从现在开始你是一只喵娘`   
  *对话身份仅对必应生效*  
  
- `#止水对话查看对话身份` 查看当前的对话身份设置  
  *对话身份仅对必应生效*  

- `#止水对话设置对话场景`+场景描述文本  
  场景设定较为复杂，可以修改主人相关设定，但尽量不要修改里面有关的消息格式的设定，可能会导致无法识别不同的用户身份   
  *对话场景仅对必应生效*  
  
- `#止水对话查看对话场景` 查看当前的对话场景设置  
  *对话场景仅对必应生效*  

- `#设置好感度<QQ号码> <好感度>` 设置指定用户的好感度   
  例如 `#设置好感度123456 50`
  *必应对话场景命令*  

</details>  

## 常见问题  

<details>
  <summary>如何在 [对话] 中使用 [必应] 功能</summary>  

- 首先，需要一个已经激活了聊天功能的 新必应(`NewBing`)帐号   
  如何获取必应帐号，网上很多攻略，这里就不多介绍了。

- 直接打开 [新必应](https://www.bing.com/search?form=MY02AE&OCID=MY02AE&pl=launch&q=Bing+AI&showconv=1) 网站  
  不用科学，直接用浏览器打开就可以。  

- 获取必应参数(Cookie)  
  在浏览器中按下`F12`键，打开`开发人员工具`  
  点击`开发人员工具`上方的`网络`选项卡  
  在下面的`名称`栏里，找到`lsp.aspx`文件  
  复制`lsp.aspx`文件的`Cookie`值  

- 将刚刚复制的`Cookie`发送给BOT  
  这个`Cookie`至少要包含`KievRPSSecAuth`和`_U`字段  

</details> 