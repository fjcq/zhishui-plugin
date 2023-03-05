import plugin from '../../../lib/plugins/plugin.js'
import { createRequire } from 'module'
import uploadRecord from '../../zhishui-plugin/model/uploadRecord.js'
import { segment } from "oicq"

const require = createRequire(import.meta.url)
const { exec, spawn } = require("child_process");
const _path = process.cwd();
const FFMPEG_PATH = "ffmpeg"

let ResPath = `${_path}/plugins/zhishui-plugin/resources/yanzou/`;
let YueqiPath = `${ResPath}/gangqin/`;
let OutputFile = `${_path}/resources/output`;
let Format = ".mp3"//文件格式
let kg = 0;

export class yanzou extends plugin {
    constructor() {
        super({
            name: '[止水插件]演奏',
            dsc: '乐器演奏',
            event: 'message',
            priority: 2000,
            rule: [
                {
                    reg: "^#演奏(.*)",
                    fnc: 'played'
                }, {
                    reg: "^#取消演奏$",
                    fnc: 'PlayeStop'
                }, {
                    reg: "^#调试演奏(.*)$",
                    fnc: 'TestPlaye'
                }
            ]
        })
    }

    async played(e) {
        let zhiling = e.msg.replace(/#演奏/g, "").trim()
        let msg = []
        msg.push(segment.at(e.user_id))
        if (zhiling == "帮助") {
            msg.push(GetPlayHelp())
            e.reply(msg)
            return;
        }

        if (kg == 1) {
            msg.push(`正在准备演奏呢，你先别急~~`);
            e.reply(msg);
            return;
        }

        // if (await FluentFFmpeg(e)) {
        //     return true;
        // } else {
        //     return false;
        // };

        kg = 1
        let FFmpegCommand = await GetFFmpegCommand(e.msg);

        console.log(FFmpegCommand);
        if (FFmpegCommand != undefined && FFmpegCommand.length > 3) {
            msg.push(`我要准备演奏了，请稍等一哈！`)
            e.reply(msg);
        } else {
            msg.push(GetPlayHelp());
            e.reply(msg);
            kg = 0;
            return;
        }


        const ffmpeg = spawn(
            FFMPEG_PATH,
            FFmpegCommand,
            { cwd: YueqiPath }
        );
        //console.log(ffmpeg);
        let stdoutData = "";
        let stderrData = "";
        ffmpeg.on('error', (err) => {
            console.error(`Failed to start ffmpeg: ${err}`);
            msg.push('你还没有配置ffmpeg的环境变量，请到这里下载https://ffmpeg.org/download.html，并配置环境变量');
            e.reply(msg);
            kg = 0;
            return;
        });
        ffmpeg.stdout.on('data', (data) => {
            stdoutData += data.toString();
            //console.log(`stdout ${data}`);
        });
        ffmpeg.stderr.on('data', (data) => {
            stderrData += data.toString();
            //console.log(`stderr ${data}`);
        });

        ffmpeg.on('exit', async (code) => {
            if (code === 0) {
                await sleep(1000)
                let msg2 = await uploadRecord(`${OutputFile}${Format}`, 0, false)
                e.reply(msg2);
                kg = 0
                return true;
            } else {
                let msg2
                switch (code) {
                    case 1:
                        msg2 = '输入文件不存在';
                        break;
                    case 2:
                        msg2 = '输出文件已存在';
                        break;
                    case 3:
                        msg2 = '无法打开输入文件';
                        break;
                    case 4:
                        msg2 = '无法打开输出文件';
                        break;
                    case 5:
                        msg2 = '无法读取输入文件';
                        break;
                    case 6:
                        msg2 = '无法写入输出文件';
                        break;
                    case 7:
                        msg2 = '编码失败';
                        break;
                    case 8:
                        msg2 = '解码失败';
                        break;
                    case 9:
                        msg2 = '格式不支持';
                        break;
                    case 10:
                        msg2 = '无效的参数';
                        break;
                    case 11:
                        msg2 = '内部错误';
                        break;
                    default:
                        msg2 = '未知错误';
                        break;
                }

                console.log("FFmpeg 退出代码：", code);
                console.log("FFmpeg 标准输出流：", stdoutData);
                console.log("FFmpeg 标准错误流：", stderrData);
                msg.push(`合成音频失败，${msg2}！`);
                e.reply(msg);
                kg = 0
                return
            }
        });


    }

    //取消演奏
    async PlayeStop(e) {
        if (kg == 1) {
            e.reply('已经取消演奏！')
            kg = 0
            return true;
        }
    }

    //演奏测试
    async TestPlaye(e) {
        let zhiling = e.msg.replace(/#调试演奏/g, "").trim()
        if (zhiling == "帮助") {
            e.reply([segment.at(e.user_id), GetPlayHelp()])
            return;
        }

        let FfmpegMsg = "";
        if (kg == 1) {
            e.reply(`正在准备演奏呢，你先别急~~`, true);
            return;
        }

        if (await FluentFFmpeg(e)) {
            return true;
        } else {
            return false;
        };
    }
}

/**
* 使用 fluent-ffmpeg 演奏
*/
export async function FluentFFmpeg(e) {
    const ffmpeg = require('fluent-ffmpeg');
    let Music = "";  // 音符（含时间 +4__）
    let Beats = 0;  // 下划线数量
    let File = ""; // 文件名
    let settime = []; // 时间组合
    let setorder = ""; // 序列组合
    let MusicTime = 0;  // 每个音符时间
    let i = 0
    let reg = /[-|+]*\d_*/g;
    let xiaoxi = e.msg.replace(/#演奏[^\s\d+-]*/g, "").trim()
    let notation = xiaoxi.split('|')
    let beattime = notation.length > 1 ? 60000 / parseInt(notation[1]) : 60000 / 90; //算出每分钟节拍数
    let currenttime = 0;  // 音符全局时间
    let quantity = 0 // 音符数量

    let usr_qq = e.user_id;
    let msg = [segment.at(Number(usr_qq))]

    // 音频资源目录处理
    let Yueqi = e.msg.match(/#调试演奏[^\s\d+-]*/g)?.toString()?.replace(`#调试演奏`, "") || "钢琴";
    let YueqiPath = "";
    let Format = "";

    switch (Yueqi) {
        case "八音盒":
            YueqiPath = ResPath + 'ba/';
            break;
        case "钢琴":
            YueqiPath = ResPath + 'gangqin/';
            Format = ".wav";
            break;
        case "古筝":
            YueqiPath = ResPath + 'gu/';
            Format = ".mp3";
            break;
        case "吉他":
            YueqiPath = ResPath + 'jita/';
            Format = ".mp3";
            break;
        case "萨克斯":
            YueqiPath = ResPath + 'sa/';
            Format = ".mp3";
            break;
        case "小提琴":
            YueqiPath = ResPath + 'ti/';
            Format = ".mp3";
            break;
        case "箫":
            YueqiPath = ResPath + 'xiao/';
            Format = ".mp3";
            break;
        case "西域琴":
            YueqiPath = ResPath + 'xiyu/';
            Format = ".mp3";
            break;
        default:
            YueqiPath = ResPath + 'gangqin/';
            Format = ".wav";
            break;
    }

    let MusicScore = notation[0].match(reg);
    if (!isNotNull(MusicScore)) {
        msg.push(GetPlayHelp())
        e.reply(msg)
        kg = 0
        return false;
    }
    else if (MusicScore.length == 0) {
        // 音符小于1，直接返回
        msg.push(GetPlayHelp())
        e.reply(msg)
        kg = 0
        return false;
    }

    let command = ffmpeg();

    for (i in MusicScore) {

        Music = MusicScore[i];
        Beats = Music.match(/_/g);
        File = Music.replace(/_*/g, "").trim()
        //统计文件列表
        if (Number(File) != 0 && Music != undefined) {
            command.input(`${YueqiPath}${File}${Format}`)  //写入音频

            settime.push(`[${quantity}]adelay=${Math.round(currenttime)}:all=1[${quantity}a]`);
            quantity += 1
        }


        //计算每个音符时长
        if (!isNotNull(MusicTime)) { MusicTime = beattime }
        if (Music == '·') { MusicTime = MusicTime * 0.5 }  // 1拍
        else {
            if (Beats == null) { MusicTime = beattime }  // 1拍
            else if (Beats.length == 1) { MusicTime = beattime * 0.5 }  // 半拍
            else if (Beats.length == 2) { MusicTime = beattime * 0.25 }  // 1/4拍
            else if (Beats.length == 3) { MusicTime = beattime * 0.125 }  // 1/8拍
            else if (Beats.length == 4) { MusicTime = beattime * 0.0625 }  // 1/16拍
            else { MusicTime = beattime }  // 防止出错，其他时间都算拍
        }
        currenttime = currenttime + MusicTime;
    }

    for (i = 0; i < quantity; i++) {
        setorder += `[${i}a]`;
    }

    if (quantity > 0) {
        //result = `${setfile}-filter_complex ${settime}${setorder}amix=inputs=${quantity}:dropout_transition=0:normalize=0,dynaudnorm[a] -map [a] ${output}`
        settime.push(`${setorder}amix=inputs=${quantity}:dropout_transition=0:normalize=0[a]`);

        command.complexFilter(settime);  //写入 filter_complex
        command.inputOptions("-y", "-threads", "4")  //覆写文件，4线程
        command.map("[a]")
        command.save(`${OutputFile}${Format}`);  //输出音频
        command.on('end', async function (stdout, stderr) {
            if (kg == 1) {
                kg = 0;
                sleep(1000)
                let msg2 = await uploadRecord(`${OutputFile}${Format}`, 0, false);
                await e.reply(msg2);

            }
            return true;
        })
        command.on('error', function (err, stdout, stderr) {
            msg.push(`合成音频失败！\n` + err.message);
            e.reply(msg);
            kg = 0;
            return false;
        })

        kg = 1
        msg.push(`我要准备演奏了，请稍等一哈！`);
        e.reply(msg);
        command.run();

    } else {
        msg.push(GetPlayHelp());
        e.reply(msg);
        kg = 0;
        return false;
    }

}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
* 异步执行命令
* @param {string} cmd命令
* @returns
*/
async function SyncExec(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd,
            {
                cwd: YueqiPath,
                maxBuffer: 1024 * 1024
            },
            (error, stdout, stderr) => {
                resolve({ error, stdout, stderr });
            });
    });
}


/**
* 获取Ffmpeg的执行代码，返回参数数组
* @param msg 土块编码消息
*/
export async function GetFFmpegCommand(msg) {
    let Music = ""
    let Beats = 0;
    let File = ""; //文件名
    let settime = ""; //时间组合
    let setorder = ""; //序列组合
    let MusicTime = 0;
    let i = 0
    let reg = /[-|+]*\d_*/g;
    let xiaoxi = msg.replace(/#演奏[^\s\d+-]*/g, "").trim()
    let notation = xiaoxi.split('|')
    let currenttime = 0
    let quantity = 0
    let beattime = 0//每拍时间（毫秒）


    //音频资源目录处理
    let Yueqi = msg.match(/#演奏[^\s\d+-]*/g);
    Yueqi = Yueqi.toString().replace(`#演奏`, "")

    if (isNotNull(Yueqi)) {
        Yueqi = Yueqi.toString()
    } else {
        Yueqi = "钢琴"
    }

    if (Yueqi == "八音盒") {
        YueqiPath = ResPath + 'ba/';
    } else if (Yueqi == "钢琴") {
        YueqiPath = ResPath + 'gangqin/';
        Format = ".wav";
    } else if (Yueqi == "古筝") {
        YueqiPath = ResPath + 'gu/';
        Format = ".mp3";
    } else if (Yueqi == "吉他") {
        YueqiPath = ResPath + 'jita/';
        Format = ".mp3";
    } else if (Yueqi == "萨克斯") {
        YueqiPath = ResPath + 'sa/';
        Format = ".mp3";
    } else if (Yueqi == "小提琴") {
        YueqiPath = ResPath + 'ti/';
        Format = ".mp3";
    } else if (Yueqi == "箫") {
        YueqiPath = ResPath + 'xiao/';
        Format = ".mp3";
    } else if (Yueqi == "西域琴") {
        YueqiPath = ResPath + 'xiyu/';
        Format = ".mp3";
    } else {
        YueqiPath = ResPath + 'gangqin/';
        Format = ".wav"
    }

    //算出每分钟节拍数
    if (notation.length > 1) {
        beattime = 60000 / parseInt(notation[1])
    } else { beattime = 60000 / 90 }

    let MusicScore = notation[0].match(reg);
    if (!isNotNull(MusicScore)) { return }
    else if (MusicScore.length > 1) { } else {
        return;
    }

    let result = []
    result.push(`-y`);
    result.push(`-threads`);
    result.push(`4`);

    for (i in MusicScore) {

        Music = MusicScore[i];
        //console.log(Music)

        Beats = Music.match(/_/g);
        File = Music.replace(/_*/g, "").trim()
        //console.log(Beats)

        //拼接ffmpeg参数
        if (Number(File) != 0 && Music != undefined) {
            result.push(`-i`)
            result.push(`${File}${Format}`)
            settime += `[${quantity}]adelay=${Math.round(currenttime)}:all=1[${quantity}a];`;
            setorder += `[${quantity}a]`;
            quantity += 1

            //计算时间
            if (!isNotNull(MusicTime)) {
                MusicTime = beattime
            }

            if (Music == '·') {
                MusicTime = MusicTime * 0.5
            } else {

                if (Beats == null) {
                    MusicTime = beattime
                }
                else if (Beats.length == 1) {
                    MusicTime = beattime * 0.5
                }
                else if (Beats.length == 2) {
                    MusicTime = beattime * 0.25
                }
                else if (Beats.length == 3) {
                    MusicTime = beattime * 0.125
                }
                else {
                    MusicTime = beattime
                }
            }
        }

        currenttime = currenttime + MusicTime;
    }


    if (quantity > 0) {

        result.push(`-filter_complex`)
        result.push(`${settime}${setorder}amix=inputs=${quantity}:dropout_transition=0:normalize=0[a]`)
        result.push(`-map`)
        result.push(`[a]`)

        // result.push(`-ar`)
        // result.push(`8000`)
        // result.push(`-ab`)
        // result.push(`12.2k`)
        // result.push(`-ac`)
        // result.push(`1`)

        result.push(`${OutputFile}${Format}`)
        //result = `${ setfile } -filter_complex ${ settime }${ setorder } amix = inputs = ${ quantity }: dropout_transition = 0: normalize = 0, dynaudnorm[a] - map[a] ${ output } `

    } else {
        result
    }

    return result;

}

/**
 * 演奏帮助
 */
export function GetPlayHelp() {

    let msg = ""
    msg += "演奏指令分为3部分，1、乐器；2、简谱；3、节拍。\n\n"

    msg += "举例说明：\n"
    msg += "#演奏钢琴+6__+4+3+2_|82\n\n"

    msg += "“#演奏钢琴” \n"
    msg += "指定乐器为钢琴，可选乐器有\n"
    msg += "1.钢琴2.八音盒3.古筝4.吉他5.萨克斯6.小提琴7.吹箫8.西域琴\n\n"

    msg += "“+6__+4+3+2”\n"
    msg += "这部分为简谱，其中的数字为音符\n"
    msg += "音符前面的+表示高音，低音则是-\n"
    msg += "音符后的_是半拍，__是四分之一拍，___是八分之一拍\n"
    msg += "需要注意的是，正常简谱中的延音符-和休止符0，我们这里都用0来表示\n\n"

    msg += "“|82”\n"
    msg += "这里则是指定整首歌曲的节奏速度，82就是每分钟有82个节拍\n"
    return msg
}

/**
 * 判断对象是否不为undefined且不为null、NaN
 * @param obj 对象
 * @returns obj==null/undefined,return false,other return true
 */
export function isNotNull(obj) {
    if (obj == undefined || obj == null || obj != obj) { return false }
    return true
}

