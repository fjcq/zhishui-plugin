# zhishui-plugin  

## 介绍  
zhishui-plugin是一个Yunzai-BotV3的扩展插件  
本插件开发纯属学习与爱好  

## 安装教程  
**Tip：zhishui-plugin仅适配Yunzai-BotV3!!!**  

请将zhishui-plugin放置在Yunzai-Bot的plugins目录下，重启Yunzai-Bot后即可使用。 

推荐使用git进行安装，以方便后续升级。在Yunzai目录打开终端，运行  

```
git clone https://gitee.com/fjcq/zhishui-plugin.git ./plugins/zhishui-plugin  
```


## 功能介绍  

<details>
  <summary>搜剧</summary>

- `#搜剧+剧名`  
  根据剧名进行搜索  

- `#取消搜剧`  
  取消当前的[#搜剧]  

- `#下一页`  
  `#搜剧`结果过多时，将会分页显示，使用此命令查看下一页  

- `#看剧+数字`  
  `#搜剧`之后，选择要看的影视剧  
  
- `#选剧+数字`  
  `#看剧`之后，选择要观看的资源  
  
- `#线路+数字`  
  `#看剧`之后，可以根据需要切换到不同的播放线路  

- `#设置搜剧接口`+数字  
  切换搜索接口  

- `#查看搜剧接口`  
  查看可用的搜剧接口  

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
  
- `#止水对话设置必应参数`    
  必应参数需自行提供，否则无法使用必应对话。  
  请在浏览器中打开必应对话，然后将Cookie中的`KievRPSSecAuth`字段内容，发送给BOT  

- `#止水对话查看必应参数`  
  可查看当前的必应参数   

</details>