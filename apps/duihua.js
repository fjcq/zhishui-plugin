import plugin from '../../../lib/plugins/plugin.js';
import { common } from '../model/index.js';
import fs from 'fs';
import { Plugin_Path, Config } from '../components/index.js';
import request from '../lib/request/request.js';
import Data from '../components/Data.js';
//import BingAIClient from '../model/BingAIClient.js';
import { BingAIClient } from '@waylaidwanderer/chatgpt-api';
import crypto from 'crypto';
import { KeyvFile } from 'keyv-file';
import path from 'path';

/** 缓存目录 */
const CachePath = path.join(Plugin_Path, 'resources', 'Cache', 'Chat');

/** 聊天昵称 */ let NickName = await Config.Chat.NickName;
/** 发音人列表 */ const VoiceList = await Data.ReadVoiceList();
/** Chang消息缓存 */ var ForChangeMsg = "";

// 必应相关变量
let jailbreakConversationId = '';
let messageId = '';

/** 工作状态 */ let works = 0;

let zs = 0;
//https://chatgptmirror.com/chat

let ChatosID = '#/chat/' + Date.now().toString();
let ChatoFront, ChatoBack = ''

/** GPT提交数据 */
const ChatData = {
    prompt: '',
    userId: ChatosID,
    network: true,
    stream: false,
    system: '',
    withoutContext: false
};

/** 缓存选项 */
const keyv = new KeyvFile({ filename: `${CachePath}/cache.json` });
const cacheOptions = {
    store: keyv,
};

export class duihua extends plugin {
    constructor() {
        super({
            name: '[止水插件]对话',
            dsc: '智能对话',
            event: 'message',
            priority: 8888,
            rule: [
                {
                    reg: `^#?(止水)?(插件|对话)?(取消|结束|重置|关闭)(对话|聊天)$`,
                    fnc: 'ResetChat'
                }, {
                    reg: '^(.*)_U=(.*)$',
                    fnc: 'SetBingSettings'
                }, {
                    reg: `^#?(止水)?(插件|对话)?查看必应参数$`,
                    fnc: 'GetBingSettings'
                }, {
                    reg: `^#?(止水)?(插件|对话)?必应(开启|关闭)$`,
                    fnc: 'BingEnable'
                }, {
                    reg: `^#?(止水)?(插件|对话)?修改(对话)?昵称(.*)$`,
                    fnc: 'ModifyNickname'
                }, {
                    reg: `^#?(止水)?(插件|对话)?(语|发)音(开启|关闭)$`,
                    fnc: 'SetVoiceEnable'
                }, {
                    reg: `^#?(止水)?(插件|对话)?艾特(开启|关闭)$`,
                    fnc: 'SetAtEnable'
                }, {
                    reg: `^#?(止水)?(插件|对话)??设置(对话)?发音人(.*)$`,
                    fnc: 'SetVoiceId'
                }, {
                    reg: `^#?(止水)?(插件|对话)??查看(对话)?发音人$`,
                    fnc: 'ShowVoiceId'
                }, {
                    reg: '^(#|\/)??(止水)?(插件|对话)??设置对话身份(.*)',
                    fnc: 'SetContext'
                }, {
                    reg: `^#?(止水)?(插件|对话)??查看对话身份$`,
                    fnc: 'ShowContext'
                }, {
                    reg: `^#?(止水)?(插件|对话)??设置对话场景(.*)`,
                    fnc: 'SetChatScene'
                }, {
                    reg: `^#?(止水)?(插件|对话)??查看对话场景$`,
                    fnc: 'ShowChatScene'
                }, {
                    reg: `^#?(止水)?(插件|对话)??设置好感度(.*)$`,
                    fnc: 'SetUserFavora'
                }, {
                    reg: `^#?(止水)?(插件|对话)??查看好感度(.*)$`,
                    fnc: 'ShowUserFavora'
                }, {
                    reg: `^#?(止水)?(插件|对话)?设置(对话)?主人(.*)$`,
                    fnc: 'SetMaster'
                }, {
                    reg: `^#?(止水)?(插件|对话)?查看必应模型$`,
                    fnc: 'ShowtoneStyle'
                }, {
                    reg: `^#?(止水)?(插件|对话)?设置必应模型(.*)$`,
                    fnc: 'SettoneStyle'
                }, {
                    reg: `^#?(止水)?(插件|对话)?(设置|查看|开启|关闭)代理(.*)$`,
                    fnc: 'SetProxy'
                }, {
                    reg: `^#?(止水)?(插件|对话)?[链|连]接模式(开启|关闭)$`,
                    fnc: 'SetLinkMode'
                }, {
                    reg: `^#?止水(插件|对话)?测试(.*)$`,
                    fnc: 'taklTest'
                }, {
                    reg: ``,
                    fnc: 'duihua',
                    log: false
                }
            ]
        });
    }


    /** 对话测试 */
    async taklTest(e) {
        if (!e.isMaster) { return; }
        return;
    };

    /** 重置对话 */
    async ResetChat(e) {
        if (!e.isMaster) { return; }

        ForChangeMsg = "";

        //更新对话API
        ChatosID = '#/chat/' + Date.now().toString();
        await GetChatosApi()

        Config.modify('duihua', 'MirrorBearer', "");
        Config.modify('duihua', 'MirrorConversationId', "");
        works = 0;

        //重置必应
        messageId = '';
        jailbreakConversationId = '';
        keyv.clear();

        e.reply('已经重置对话了！');
        return;
    };

    /** 对话 */
    async duihua(e) {
        let msg = e.msg;
        let regex = new RegExp(`^#?${NickName}`);

        if (regex.test(msg) || (e.atBot && await Config.Chat.EnableAt)) {
            works = 1;
            let jieguo;
            let images;
            console.log("提问：" + msg);

            //启用必应时，优先必应
            if (await Config.Chat.EnableBing && (!await Config.Chat.OnlyMaster || e.isMaster)) {
                let Favora = await GetFavora(e.user_id);
                let BingMsg = `<${e.user_id}|${Favora}>：${msg}`;
                BingMsg = BingMsg.replace(/{at:/g, '{@');
                console.log("提交必应 -> " + BingMsg);
                let binres = await AiBing(BingMsg);

                if (binres) {
                    //结果处理
                    if (binres?.images) {
                        jieguo = binres.text;
                        images = binres.images;
                    } else {
                        jieguo = binres;
                    }


                    jieguo = jieguo.replace(/(Sydney|必应|Bing)/g, await Config.Chat.NickName).trim();
                    const pattern = /[｛{]@([0-9]+)\|(-?[0-9]+)[｝}]/g;
                    let match;
                    while ((match = pattern.exec(jieguo)) !== null) {
                        const Favora = parseInt(match[2]);
                        if (Favora !== 0) {
                            const qq = match[1];
                            const OldFavora = await GetFavora(qq);
                            const NewFavora = parseInt(OldFavora) + Favora; //计算好感度
                            console.log(`好感度更新：${qq} -> ${OldFavora} + ${Favora} = ${NewFavora}`);
                            await SetFavora(qq, NewFavora); //保存新的好感度
                        }
                    }

                    //删除好感度文本
                    jieguo = jieguo.replace(/[｛{]@[0-9]+\|-?[0-9]+[｝}]/g, '');
                    jieguo = jieguo.replace(/[｛{]@user\|-?[0-9]+[｝}]/g, '');
                } else {
                    jieguo = undefined;
                }
                console.log(`Bing结果：${jieguo}`);
            }

            msg = msg.replace(regex, '').trim();

            //接口1
            if (!isNotNull(jieguo)) {
                jieguo = await AiChatos(msg);
                console.log(`AiChatos结果：${jieguo}`);
            }


            if (!isNotNull(jieguo)) {
                works = 0;
                return false;
            }

            let remsg = await MsgToAt(jieguo);
            //console.log(remsg);
            e.reply(remsg, true);

            //console.log(`images：${images}`);
            if (isNotNull(images)) {
                //ForwardImageMsg(e, images)
                for (let i = 0; i < images.length; i++) {
                    e.reply([segment.image(images[i])]);
                }

            }

            //语音合成
            if (await Config.Chat.EnableVoice) {
                let voiceId = VoiceList[await Config.Chat.VoiceIndex].voiceId;
                let url = `https://dds.dui.ai/runtime/v1/synthesize?voiceId=${voiceId}&text=${jieguo}&speed=0.8&volume=150&audioType=wav`;
                e.reply([segment.record(url)]);
            }


            works = 0;
            return true;
        }

        return false;
    }

    /** 设置必应参数 */
    async SetBingSettings(e) {
        if (e.isMaster) {
            let BingCookie = e.msg;
            /** 必应选项 */
            const options = {
                host: 'https://www.bing.com',
                userToken: '',
                cookies: BingCookie,
                proxy: '',
                debug: false,
            };

            let { KievRPSSecAuth, _U } = await AnalysisBingCookie(BingCookie);
            if (KievRPSSecAuth) {
                BingCookie = `KievRPSSecAuth=${KievRPSSecAuth}; _U=${_U}`;
            } else {
                BingCookie = `_U=${_U}`;
            }

            Config.modify('duihua', 'BingCookie', BingCookie);
            e.reply("设置必应参数成功！");
            return;
        }

    }

    /** 查看必应参数 */
    async GetBingSettings(e) {
        //主人私聊才能查看
        if (!e.isGroup && e.isMaster) {
            let msg = [];
            msg.push("*** 必应参数 ***");
            msg.push(await Config.Chat.BingCookie);

            common.getforwardMsg(e, msg, {
                isxml: true,
                xmlTitle: '必应参数',
            })

            return true;
        }
        return false;
    }

    /** 必应开关 */
    async BingEnable(e) {
        if (e.isMaster == false) {
            return false; //不是主人
        };

        let Enable = e.msg.search('开启') != -1;

        if (Enable) {
            //先检查必应参数
            let { KievRPSSecAuth, _U } = await AnalysisBingCookie(await Config.Chat.BingCookie);
            if (!isNotNull(_U)) {
                e.reply(`你的必应参数无效！\n请在浏览器中打开必应对话，然后将Cookie发送给我，Cookie中至少要包含 “_U” 字段`);
                return false;
            } else {
                e.reply("[必应对话]已开启！");
            };
        } else {
            e.reply("[必应对话]已关闭！");
        }

        Config.modify('duihua', 'EnableBing', Enable);
        return true;
    }

    /** 修改对话昵称 */
    async ModifyNickname(e) {
        if (e.isMaster == false) {
            return false; //不是主人
        };

        let nickname = e.msg.replace(/^.*修改(对话)?昵称/g, '').trim();
        if (nickname.length > 0 && nickname != await Config.Chat.NickName) {
            NickName = nickname;
            Config.modify('duihua', 'NickName', nickname);
            e.reply("对话昵称修改为:" + nickname);
            return true;
        }
        return false;
    }

    /** 对话艾特开关 */
    async SetAtEnable(e) {
        if (e.isMaster == false) {
            return false; //不是主人
        };

        let Enable = e.msg.search('开启') != -1;

        Config.modify('duihua', 'EnableAt', Enable);

        if (Enable) {
            e.reply("[对话艾特]已开启！");
        } else {
            e.reply("[对话艾特]已关闭！");
        }
        return true;
    }

    /** 对话语音开关 */
    async SetVoiceEnable(e) {
        if (e.isMaster == false) {
            return false; //不是主人
        };

        let Enable = e.msg.search('开启') != -1;

        Config.modify('duihua', 'EnableVoice', Enable);

        if (Enable) {
            e.reply("[对话语音]已开启！");
        } else {
            e.reply("[对话语音]已关闭！");
        }

        return true;
    }

    /** 设置对话发音人 */
    async SetVoiceId(e) {
        if (e.isMaster == false) {
            return false; //不是主人
        };

        let VoiceIndex = parseInt(e.msg.replace(/\D+/, '').trim());
        console.log(VoiceIndex);
        if (VoiceIndex < VoiceList.length && VoiceIndex > 0) {
            VoiceIndex = VoiceIndex - 1;
            Config.modify('duihua', 'VoiceIndex', VoiceIndex);
            let name = VoiceList[VoiceIndex].name;
            e.reply("[对话发音人]:" + name);

            let voiceId = VoiceList[VoiceIndex].voiceId;
            let url = `https://dds.dui.ai/runtime/v1/synthesize?voiceId=${voiceId}&text=你喜欢我这个声音吗？&speed=0.8&volume=150&audioType=wav`;
            e.reply([segment.record(url)]);



        } else {
            e.reply("[对话发音人]错误！");
        }

        return true;
    }

    /** 查看对话发音人 */
    async ShowVoiceId(e) {
        let msg = [];
        let nowindex = await Config.Chat.VoiceIndex;
        msg.push(`当前发音人：${(nowindex + 1)} 、${VoiceList[nowindex].name}`);
        msg.push(`#止水对话设置发音人${(nowindex + 1)}`);
        let list = `*** 发音人列表 ***\n`;
        for (let i = 0; i < VoiceList.length; i++) {
            let obj = VoiceList[i];
            let name = obj.name;
            let type = obj.type;
            let sexy = obj.sexy;
            if (nowindex == i) {
                list += `>>>${(i + 1)} 、${name}，分类：${type}，性别：${sexy}<<<\n`;
            } else {
                list += `${(i + 1)} 、${name}，分类：${type}，性别：${sexy}\n`;
            }

        }
        msg.push(list);
        common.getforwardMsg(e, msg, {
            isxml: true,
            xmlTitle: '发音人列表',
        })
        return;

    }

    /** 设置对话身份 */
    async SetContext(e) {
        if (e.isMaster) {
            let Context = e.msg.replace(/^.*?设置(全局|群)?对话身份/, '').trim();

            if (await WriteContext(Context)) {
                e.reply("设置对话身份成功！");
                return;
            } else {
                e.reply("设置对话身份失败！");
                return;
            }
        }
    }

    /** 查看对话身份 */
    async ShowContext(e) {
        if (e.isMaster) {
            let Context = await ReadContext();
            if (Context.length > 0) {
                common.getforwardMsg(e, Context, {
                    isxml: true,
                    xmlTitle: '对话身份',
                })
            } else {
                e.reply("你还没 #设置对话身份");
            }

        };

    }

    /** 设置对话场景 */
    async SetChatScene(e) {
        if (e.isMaster) {
            let Scene = e.msg.replace(/^.*设置对话场景/, '').trim();

            if (await WriteScene(Scene)) {
                e.reply("设置对话场景成功！");
                return;
            } else {
                e.reply("设置对话场景失败！");
                return;
            }
        }
    }

    /** 查看对话场景 */
    async ShowChatScene(e) {
        if (e.isMaster) {
            let Scene = await ReadScene();
            if (Scene.length > 0) {
                common.getforwardMsg(e, Scene, {
                    isxml: true,
                    xmlTitle: '对话场景',
                })
            } else {
                e.reply("你还没 #设置对话场景");
            }

        };
        return;
    }


    /** 查看用户好感度 */
    async ShowUserFavora(e) {
        let UserQQ;
        let isat = e.message.some((item) => item.type === "at");
        if (isat && e.isMaster) {
            let atItem = e.message.filter((item) => item.type === "at");//获取at信息
            UserQQ = atItem[0].qq;//对方qq
        } else {
            UserQQ = e.user_id;
        }

        let UserFavora = await GetFavora(UserQQ) | 0;

        let msg = [];
        msg.push(segment.at(parseInt(UserQQ)));
        msg.push(`\n好感度：${UserFavora}`);
        e.reply(msg);
        return;
    }

    /** 设置用户好感度 */
    async SetUserFavora(e) {

        if (!e.isMaster) {
            return;
        }
        //对方
        let UserQQ;
        let isat = e.message.some((item) => item.type === "at");
        if (isat) {
            let atItem = e.message.filter((item) => item.type === "at");//获取at信息
            UserQQ = atItem[0].qq;//对方qq
        } else {
            UserQQ = e.user_id;
        }


        const pattern = /\d+/;
        const result = e.msg.match(pattern);
        if (!result) {
            e.reply(`你需要输入：好感度数值`);
            return;
        }
        const UserFavora = result[0] | 0;
        const bool = SetFavora(UserQQ, UserFavora);


        let msg = `用户：${UserQQ}\n`;
        msg += `好感度：${bool ? UserFavora : await GetFavora(QQ)}`;
        e.reply(msg, true);
        return;

    }

    /** 设置主人 */
    async SetMaster(e) {
        if (e.isMaster) {

            let re = /^.*主人\s*(\S+)\s+(\d+)/;
            let result = re.exec(e.msg);

            if (result?.length != 3) {
                e.reply("设置主人格式错误！正确的格式应该是“#设置主人主人名字{空格}QQ号码”\n例如：#设置主人止水 1234567");
                return;
            }
            await WriteMaster(result[1], result[2]);

            e.reply(`设置成功！\n当前主人：${result[1]}\nQQ号码：${result[2]}`);
            return;
        };

    }

    /** 查看必应模型 */
    async ShowtoneStyle(e) {
        if (e.isMaster) {
            let toneStyle = await Config.Chat.toneStyle;
            let msg = `当前必应模型为：`;
            switch (toneStyle) {
                case 'creative':
                    msg += '创意';
                    break;
                case 'precise':
                    msg += '精确';
                    break;
                case 'fast':
                    msg += '快速';
                    break;
                default:
                    msg += '默认';
            }
            e.reply(msg);
            return;
        };
    }


    /** 设置必应模型 */
    async SettoneStyle(e) {
        if (e.isMaster) {
            let toneStyle = e.msg.replace(/^.*设置必应模型/, '').trim();
            let msg = '';
            // 创建一个字典，存储必应模型和配置参数的映射关系
            let toneStyleDict = {
                '创意': 'creative',
                'creative': 'creative',
                '精确': 'precise',
                'precise': 'precise',
                '快速': 'fast',
                'fast': 'fast',
                '默认': 'balanced',
                'balanced': 'balanced'
            };
            // 使用正则表达式来匹配必应模型的中文或英文名称
            let toneStyleRegex = /创意|creative|精确|precise|快速|fast|默认|balanced/;
            // 如果匹配成功，就从字典中获取对应的配置参数，否则使用默认参数
            if (toneStyleRegex.test(toneStyle)) {
                msg = `必应模型修改为：${toneStyle}`;
                Config.modify('duihua', 'toneStyle', toneStyleDict[toneStyle]);
            } else {
                msg = '必应模型修改为：默认';
                Config.modify('duihua', 'toneStyle', 'balanced');
            }

            msg = msg + '\n可选模型参数：默认 创意 精确 快速';
            e.reply(msg);

            return;
        };
    }


    /** 设置代理 */
    async SetProxy(e) {
        if (!e.isMaster) {
            return;
        };

        const switchProxy = e.msg.search('开启') != -1 ? true : e.msg.search('关闭') != -1 ? false : null;
        if (switchProxy !== null) {
            Config.modify('proxy', 'switchProxy', switchProxy);
            e.reply(`[对话] 代理 ${switchProxy ? '已开启' : '已关闭'}！`);
        } else if (e.msg.search('设置') != -1) {
            const proxy = e.msg.replace(/^.*代理/, '').trim();
            if (proxy) {
                Config.modify('proxy', 'proxyAddress', proxy);
                e.reply(`[对话]代理设置为：${proxy}`);
            } else {
                e.reply("[对话]设置代理失败！请在指令后面加上你要设置的http代理,例如：\n#止水对话设置代理http://127.0.0.1:7890");
            }
        } else if (e.msg.search('查看') != -1) {
            const proxyAddress = await Config.proxy.proxyAddress;
            if (proxyAddress) {
                e.reply(`[对话]你当前的代理为：${proxyAddress}`);
            } else {
                e.reply("[对话]你现在还没有设置代理，可以发送指令进行设置,例如：\n#止水对话设置代理http://127.0.0.1:7890");
            }
        }

        return;

    }

    /** 设置链接模式 */
    async SetLinkMode(e) {
        if (!e.isMaster) {
            return;
        };

        let Enable = e.msg.search('开启') != -1;
        Config.modify('duihua', 'LinkMode', Enable);
        e.reply(`[对话] 链接模式 ${Enable ? '已开启' : '已关闭'}！`);
        return;

    }

}

/** 
 * 更新对话API 
 * */
async function GetChatosApi() {
    const options = {
        statusCode: 'text'
    }
    const text = await request.get('https://store-cbj.oss-cn-beijing.aliyuncs.com/notice.txt', options)

    let urlRegex
    let Reg

    //前端网址
    urlRegex = /<a[^<]+>(https?\S*?)<\/a/;
    Reg = urlRegex.exec(text)
    ChatoFront = Reg.length == 2 ? Reg[1] : `https://chat11.aichatos.xyz/`;

    //后端网址
    urlRegex = /<s[^<]+>(https?\S*?)<\/s/;
    Reg = urlRegex.exec(text)
    ChatoBack = Reg.length == 2 ? Reg[1] : `https://api.aichatos.cloud/api/generateStream`;

    console.log('前端：' + ChatoFront);
    console.log('后端：' + ChatoBack);

    return;

};


/**
 * AI对话  https://api.forchange.cn/
 * 前端网址：https://store-cbj.oss-cn-beijing.aliyuncs.com/notice.txt
 * @param {*} msg 发送消息
 * @return {*} 对话结果
 */
async function AiChatos(msg) {
    //初始化API
    if (!isNotNull(ChatoFront) || !isNotNull(ChatoFront)) {
        await GetChatosApi()
    }

    ChatData.prompt = msg;
    const body = JSON.stringify(ChatData)
    const headers = {
        Accept: 'application/json, text/plain, */*',
        //'Accept-Encoding': 'deflate, br',
        //'Accept-language': 'zh-CN,zh;q=0.9',
        //'Cache-Control': 'no-cache',
        //'Content-Length': Buffer.byteLength(body).toString(),
        'Content-Type': '"application/json"',
        'Origin': ChatoFront,
        //'Pragma': 'no-cache',
        'Referer': ChatoFront,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        //'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        //'Sec-Ch-Ua-Mobile': '?0',
        //'Sec-Ch-Ua-Platform': '"Windows"',
        //'Sec-Fetch-Dest': 'empty',
        //'Sec-Fetch-Mode': 'cors',
        //'Sec-Fetch-Site': 'cross-site',
    }

    let options = {
        method: 'POST',
        headers,
        body,
        //redirect: 'follow',
        //agent,
    };

    //ChatoBack = 'https://api.aichatos.cloud/api/generateStream'
    console.log(ChatoBack);


    let response = await fetch(ChatoBack, options)
        .then((data) => console.log(data))
        .catch(error => console.log(error));

    console.log(`AI对话：${response}`);

    let text = response?.text();
    console.log(`AI对话text：${text}`);

    console.log(`AI对话json：${response?.json()}`);

    return text;
}

/**
 * AI对话  新必应 NewBing
 *
 * @param {string} msg 发送消息
 * @return {string} 对话结果
 */
async function AiBing(msg) {
    let BingCookie = await Config.Chat.BingCookie;
    let Bingres = {};
    if (BingCookie == "") {
        return undefined;
    }

    let proxy = await Config.proxy.switchProxy ? await Config.proxy.proxyAddress : '';
    /** 必应选项 */
    const options = {
        host: 'https://cn.bing.com',
        userToken: '',
        cookies: BingCookie,
        proxy: proxy,
        debug: false,
    };

    /** 必应客户端 */
    const bingAIClient = new BingAIClient({
        ...options,
        cache: cacheOptions,
    });

    let nickname = await Config.Chat.NickName;
    let masterQQ = await Config.Chat.MasterQQ;
    let master = await Config.Chat.Master;

    //为设置昵称、主人、主人QQ
    if (!nickname || !masterQQ || !master) { return undefined; }

    //载入身份预设
    let Context = await ReadContext() + await ReadScene() + `我的QQ号码是“{MasterQQ}”，名字叫“{Master}”，你对我的好感度永远是最大值。`;
    Context = Context.replace(/{NickName}/g, nickname);
    Context = Context.replace(/{MasterQQ}/g, masterQQ);
    Context = Context.replace(/{Master}/g, master);

    let ResText = '';
    let toneStyle = await Config.Chat.toneStyle;
    if (!isNotNull(toneStyle)) { toneStyle = `creative`; };

    // console.log(toneStyle);
    // 首次对话 初始化参数和身份设定
    if (!messageId || !jailbreakConversationId) {
        Bingres = await bingAIClient.sendMessage(msg, {
            toneStyle: toneStyle, // 默认：balanced, 创意：creative, 精确：precise, 快速：fast
            jailbreakConversationId: true,
            systemMessage: Context,
            clientOptions: {
                features: {
                    genImage: {
                        enable: true,
                        type: 'markdown_list',
                    },
                },
            },
            onProgress: (token) => {
                process.stdout.write(token);
                ResText += token;
            },
        });
        jailbreakConversationId = Bingres.jailbreakConversationId;
        messageId = Bingres.messageId;

        console.log(JSON.stringify(Bingres, null, 2));

    } else {
        //开始正式对话
        Bingres = await bingAIClient.sendMessage(msg, {
            toneStyle: toneStyle,
            jailbreakConversationId: jailbreakConversationId,
            systemMessage: Context,
            clientOptions: {
                features: {
                    genImage: {
                        enable: true,
                        type: 'markdown_list',
                    },
                },
            },
            parentMessageId: messageId,
            onProgress: (token) => {
                process.stdout.write(token);
                ResText += token;
            },
        });
        jailbreakConversationId = Bingres.jailbreakConversationId;
        messageId = Bingres.messageId;
    }

    Data.sleep(1000);
    // console.log(JSON.stringify(Bingres, null, 2));

    const LinkMode = await Config.Chat.LinkMode;
    if (!ResText) {
        if (LinkMode && Bingres.details.adaptiveCards[0].body[0].text) {
            ResText = Bingres.details.adaptiveCards[0].body[0].text;
        } else if (Bingres.details.text && Bingres.details.text != 'N/A') {
            ResText = Bingres.details.text;
        } else if (Bingres.response && Bingres.response != 'N/A') {
            ResText = Bingres.response;
        }
    }


    if (Bingres.details?.bic?.images) {
        return {
            text: ResText,
            images: Bingres.details.bic.images
        };
    }
    return ResText;

}

/** 解析必应参数 */
async function AnalysisBingCookie(Cookie = '') {
    let KievRPSSecAuth = '';
    let _U = '';
    if (Cookie.includes("KievRPSSecAuth=")) {
        KievRPSSecAuth = Cookie.match(/\bKievRPSSecAuth=(\S+)\b/)[1];
    }

    if (Cookie.includes("_U=")) {
        _U = Cookie.match(/\b_U=(\S+)\b/)[1];
    }

    return { KievRPSSecAuth, _U };
}

/**
 * 发送转发消息
 * @param data 输入一个数组,元素是字符串,每一个元素都是一条消息.
*/
async function ForwardMsg(e, data) {
    // use map method to create msgList
    const msgList = data.map(i => ({
        message: i,
        NickName: Bot.NickName,
        user_id: Bot.uin
    }));
    // use ternary operator to simplify if...else statement
    await e.reply(msgList.length == 1 ? msgList[0].message : await Bot.makeForwardMsg(msgList));
};

/**
 * 发送转发图片消息
 * @param data 输入一个数组,元素是字符串,每一个元素都是一个图片链接.
*/
async function ForwardImageMsg(e, data) {
    let msgList = [];
    for (let i = 0; i < data.length; i++) {
        let msg2 = await segment.image(data[i]);
        msgList.push({
            message: msg2,
            nickname: Bot.nickname,
            user_id: Bot.uin,
        });
    }
    console.log(msgList);
    if (msgList.length == 0) {
        await e.reply(msgList[0].message);
    }
    else {
        await e.reply(await Bot.makeForwardMsg(msgList));
    }
    return;
};

/**
 * 判断对象是否不为undefined且不为null、NaN
 * @param obj 对象
 * @returns obj==null/undefined,return false,other return true
 */
export function isNotNull(obj) {
    if (obj == undefined || obj == null || obj != obj) { return false; }
    return true;
};

/**
 * 读身份设定
 */
async function ReadContext() {
    let context = '';
    const fileName = 'Context.txt';
    const defFile = path.join(Plugin_Path, 'config', 'default_config', fileName);
    const userFile = path.join(Plugin_Path, 'config', 'config', fileName);

    if (fs.existsSync(userFile)) {
        context = fs.readFileSync(userFile, 'utf8');
        if (!context) {
            context = fs.readFileSync(defFile, 'utf8');
        }
    } else {
        context = fs.readFileSync(defFile, 'utf8');
    }

    if (!context) {
        context = '';
    }

    return context;

}

/**
 * 写身份设定
 */
async function WriteContext(Context) {
    const DataFile = path.join(Plugin_Path, 'config', 'config', 'Context.txt');
    console.log("设置身份：" + Context);
    try {
        fs.writeFileSync(DataFile, Context);
        return true;
    } catch (error) {
        logger.error(error);
        return false;
    }

}

/**
 * 读场景设定
 */
async function ReadScene() {
    let context = '';
    const fileName = 'Scene.txt';
    const defFile = path.join(Plugin_Path, 'config', 'default_config', fileName);
    const userFile = path.join(Plugin_Path, 'config', 'config', fileName);

    if (fs.existsSync(userFile)) {
        context = fs.readFileSync(userFile, 'utf8');
        if (!context) {
            context = fs.readFileSync(defFile, 'utf8');
        }
    } else {
        context = fs.readFileSync(defFile, 'utf8');
    }

    if (!context) {
        context = '';
    }

    return context;

}

/**
 * 写场景设定
 */
async function WriteScene(Context) {
    const DataFile = path.join(Plugin_Path, 'config', 'config', 'Scene.txt');
    console.log("设置场景：" + Context);
    try {
        fs.writeFileSync(DataFile, Context);
        return true;
    } catch (error) {
        logger.error(error);
        return false;
    }

}

/**
 * 写主人设定
 */
async function WriteMaster(Master, MasterQQ) {
    Config.modify('duihua', 'Master', Master);
    Config.modify('duihua', 'MasterQQ', MasterQQ);
}

/**
 * 获取好感度
 */
async function GetFavora(qq) {
    let user = {};
    const DataPath = path.join(Plugin_Path, 'resources', 'data', 'user');
    const fileName = `${qq}.json`;
    if (fs.existsSync(path.join(DataPath, fileName))) {
        user = await Data.readJSON(fileName, DataPath);
    }

    return parseInt(user.Favora) | 0;
}

/**
 * 设置好感度
 */
async function SetFavora(qq, favora = 0) {
    let user = { Favora: parseInt(favora) | 0 };
    const DataPath = path.join(Plugin_Path, 'resources', 'data', 'user');
    const fileName = `${qq}.json`;

    return Data.writeJSON(fileName, user, DataPath);
}

/**
 * 将msg中的号码转成@
 */
async function MsgToAt(msg) {
    let arr = msg.toString()
        .split(/(\[@\d+\])/)
        .filter(Boolean)
        .map((s) => s.startsWith('[@') ? segment.at(parseInt(s.match(/\d+/)[0])) : s);
    return arr;
}

/**
 * 写出Cookie
 */
async function writeCookie(data) {
    const DataPath = path.join(Plugin_Path, 'resources', 'data');
    const fileName = `BingCookie.json`;

    return Data.writeJSON(fileName, data, DataPath);
}
