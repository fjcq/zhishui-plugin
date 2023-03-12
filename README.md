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

- `#必应开关`  
  切换[开启/关闭]必应对话，如果要启用必应，同时还需要设置好必应cookie。  

- `#设置必应ck`  
  必应cookie需自行提供，否则无法使用必应对话。  
  cookie必须包含 `_U`字段，例如： `#设置必应ck _U=*********`  

- `#查看必应ck`  
  可查看当前的必应cookie 

</details>