import plugin from '../../../lib/plugins/plugin.js'
import { createRequire } from 'module'
import { Plugin_Path, Config } from '../components/index.js'
import path from 'path';

const require = createRequire(import.meta.url)
const { spawn } = require("child_process");
const fs = require('fs');

/** 演奏目录 */
const YANZOU_PATH = path.join(Plugin_Path, 'resources', 'yanzou');
/** 乐器目录 */
let YUEQI_PATH = "";

/** 输出目录 */
const OUTPUT_PATH = path.join(Plugin_Path, 'resources', 'output');
// 检查并创建目录
if (!fs.existsSync(OUTPUT_PATH)) {
    fs.mkdirSync(OUTPUT_PATH);
}
/** 输出格式 */
let OutFormat = ".wav";
/** 输出文件名 */
let OutFile = ""

export class YanzouPlayer extends plugin {

    _playing = 0;
    isProcessing = false;

    constructor() {
        super({
            name: '[止水插件]演奏',
            dsc: '乐器演奏',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: "^(#|\/)?演奏(.*)",
                    fnc: 'handlePlayCommand'
                }, {
                    reg: "^(#|\/)?取消演奏$",
                    fnc: 'stopPlayback'
                }, {
                    reg: "^(#|\/)?高品质演奏(开启|关闭)$",
                    fnc: 'togglePlayQuality'
                }, {
                    reg: "^(#|\/)?调试演奏(.*)$",
                    fnc: 'testPlayback'
                }
            ]
        })
        this._playing = 0;
    }

    /**
 * 处理演奏指令
 * @param {Object} e 事件对象
 * @returns {Promise<boolean>} 返回执行结果
 */
    async handlePlayCommand(e) {
        const commandContent = e.msg.replace(/#演奏/g, "").trim()
        let msg = ""
        if (commandContent == "帮助") {
            msg = GetPlayHelp();
            e.reply(msg);
            return;
        }

        if (this.isProcessing) {
            msg = `正在准备演奏呢，你先别急~~`;
            e.reply(msg);
            return;
        }

        this._playing = 1
        let ffmpegArguments = await GetffmpegArguments(e.msg);

        console.log(ffmpegArguments);
        if (ffmpegArguments != undefined && ffmpegArguments.length > 3) {
            msg = `我要准备演奏了，请稍等一哈！`;
            e.reply(msg);
        } else {
            msg = GetPlayHelp();
            e.reply(msg);
            this._playing = 0;
            return;
        }


        const ffmpeg = spawn(
            "ffmpeg",
            ffmpegArguments,
            { cwd: YUEQI_PATH }
        );
        //console.log(ffmpeg);
        let stdoutData = "";
        let stderrData = "";
        ffmpeg.on('error', (err) => {
            console.error(`Failed to start ffmpeg: ${err}`);
            msg = '你还没有配置ffmpeg的环境变量，请到这里下载https://ffmpeg.org/download.html，并配置环境变量';
            e.reply(msg);
            this._playing = 0;
            return;
        });
        ffmpeg.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });
        ffmpeg.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        console.log("FFmpeg 标准输出流：" + stdoutData);

        ffmpeg.on('exit', async (code) => {
            if (code === 0) {
                await sleep(1000)

                OutFile = path.join(OUTPUT_PATH, `output${OutFormat}`)
                console.debug('[DEBUG] 合成音频成功 =>', OutFile);
                try {
                    fs.unlinkSync(OutFile);
                } catch (e) {
                    console.debug('清理临时文件失败:', e.message);
                }
                let played
                try {
                    played = await uploadRecord(OutFile, 0, false)
                    e.reply(played)
                } catch {
                    played = await segment.record(OutFile)
                    e.reply(played)
                }

                this.isProcessing = false
                return true;
            } else {
                switch (code) {
                    case 1:
                        msg = '输入文件不存在';
                        break;
                    case 2:
                        msg = '输出文件已存在';
                        break;
                    case 3:
                        msg = '无法打开输入文件';
                        break;
                    case 4:
                        msg = '无法打开输出文件';
                        break;
                    case 5:
                        msg = '无法读取输入文件';
                        break;
                    case 6:
                        msg = '无法写入输出文件';
                        break;
                    case 7:
                        msg = '编码失败';
                        break;
                    case 8:
                        msg = '解码失败';
                        break;
                    case 9:
                        msg = '格式不支持';
                        break;
                    case 10:
                        msg = '无效的参数';
                        break;
                    case 11:
                        msg = '内部错误';
                        break;
                    default:
                        msg = `错误代码：${code}`;
                        break;
                }
                console.log("FFmpeg 标准错误流：", stderrData);
                e.reply(`合成音频失败，${msg}！`);
                this.isProcessing = false
                return
            }
        });


    }

    /** 取消演奏 */
    /**
 * 取消演奏指令
 * @param {Object} e 事件对象
 * @returns {Promise<boolean>} 返回执行结果
 */
    async stopPlayback(e) {
        if (this.isProcessing) {
            e.reply('已经取消演奏！')
            this.isProcessing = false
            return true;
        }
    }

    /** 高品质演奏 */
    /**
 * 切换演奏品质模式
 * @param {Object} e 事件对象
 * @returns {Promise<boolean>} 返回执行结果
 */
    async togglePlayQuality(e) {
        if (e.isMaster == false) {
            return false; //不是主人
        };

        let Enable = e.msg.search('开启') != -1;

        Config.modify('yanzou', 'Quality', Enable);

        if (Enable) {
            e.reply("[高品质演奏] 已开启！");
        } else {
            e.reply("[高品质演奏] 已关闭！");
        }

        return true;
    }
    //演奏测试
    /**
 * 演奏功能调试方法
 * @param {Object} e 事件对象
 * @returns {Promise<boolean>} 返回调试结果
 */
    async testPlayback(e) {
        let zhiling = e.msg.replace(/#调试演奏/g, "").trim()
        await mergeAudio(zhiling, YUEQI_PATH, OUTPUT_PATH);
        let OutFile = path.join(OUTPUT_PATH, `output${OutFormat}`)
        e.reply([segment.record(OutFile)]);
    }
}

/**
 * 异步延时函数
 * @param {number} ms 毫秒数
 * @returns {Promise} 返回延时Promise
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
* 获取Ffmpeg的执行代码，返回参数数组
* @param msg 土块编码消息
*/
// 解析乐谱符号
function parseNotation(notation) {
    const noteReg = /([+-]?)(\d)(_*)/g;
    const notes = [];
    let match;

    while ((match = noteReg.exec(notation)) !== null) {
        const [full, sign, note, beats] = match;
        const duration = Math.pow(0.5, beats.length);
        const fileName = `${sign}${note}.wav`;

        notes.push({
            file: fileName,
            duration: duration,
            sign: sign || '+'
        });
    }
    return notes;
}

// 构建音频拼接过滤器
function buildConcatFilter(notes, bpm) {
    let filterStr = '';
    const inputs = [];
    let totalDelay = 0;
    const beatDuration = 60000 / bpm; // 每拍毫秒数

    notes.forEach((note, index) => {
        const delay = totalDelay;
        const duration = beatDuration * note.duration;

        filterStr += `[${index}]adelay=${delay}|${delay}[a${index}];`;
        inputs.push(`[a${index}]`);

        totalDelay += duration;
    });

    filterStr += `${inputs.join('')}amix=inputs=${notes.length}:duration=longest[aout]`;
    return filterStr;
}

/**
 * 构建FFmpeg音频合成命令
 * @param {string} msg 原始消息内容
 * @returns {Array} FFmpeg命令行参数数组
 */
async function GetffmpegArguments(msg) {
    console.debug('[DEBUG] 开始解析乐谱');
    const progressInterval = setInterval(() => {
        console.debug('[PROGRESS] 音频合成中...');
    }, 5000);
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
    OutFormat = ".wav"

    if (Yueqi == "八音盒") {
        YUEQI_PATH = path.join(YANZOU_PATH, 'ba');
    } else if (Yueqi == "钢琴") {
        YUEQI_PATH = path.join(YANZOU_PATH, 'gangqin');
    } else if (Yueqi == "古筝") {
        YUEQI_PATH = path.join(YANZOU_PATH,'gu');
    } else if (Yueqi == "吉他") {
        YUEQI_PATH = path.join(YANZOU_PATH,  'jita');
    } else if (Yueqi == "萨克斯") {
        YUEQI_PATH = path.join(YANZOU_PATH,  'sa');
    } else if (Yueqi == "小提琴") {
        YUEQI_PATH = path.join(YANZOU_PATH,  'ti');
    } else if (Yueqi == "箫") {
        YUEQI_PATH = path.join(YANZOU_PATH,  'xiao');
    } else if (Yueqi == "西域琴") {
        YUEQI_PATH = path.join(YANZOU_PATH,  'xiyu');
    } else {
        YUEQI_PATH = path.join(YANZOU_PATH, 'gangqin');
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
            result.push(`${File}${OutFormat}`)
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
        let fileName = path.join(OUTPUT_PATH, `output${OutFormat}`)
        result.push(`${fileName}`)
        //result = `${ setfile } -filter_complex ${ settime }${ setorder } amix = inputs = ${ quantity }: dropout_transition = 0: normalize = 0, dynaudnorm[a] - map[a] ${ output } `

    } else {
        result
    }

    clearInterval(progressInterval);
    console.debug('[DEBUG] FFmpeg命令构建完成');
    return result;

}

/**
 * 演奏帮助
 */
function GetPlayHelp() {

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
/**
 * 检查对象有效性
 * @param {any} obj 待检查对象
 * @returns {boolean} 是否有效
 */
function isNotNull(obj) {
    if (obj == undefined || obj == null || obj != obj) { return false }
    return true
}

/**
 * 合并音频文件
 * @param {string} inputString 输入字符串，包含文件名和节拍信息
 * @param {string} inputDirectory 输入目录，包含音频文件
 * @param {string} OUTPUT_PATH 输出目录，用于保存合成后的音频文件
 * @returns {Promise} 返回一个 Promise，在音频文件合并并保存到指定的输出目录时解析
 */
async function mergeAudio(inputString, inputDirectory, OUTPUT_PATH) {
    const ffmpeg = require('fluent-ffmpeg');
    return new Promise((resolve, reject) => {
        // 分割输入字符串，获取文件名和节拍信息
        const parts = inputString.split('|');
        // 获取每个音频文件的节奏速度，默认为 90
        const standardDelay = parts.length > 1 ? parseInt(parts[1]) : 90;
        console.log(standardDelay)
        // 获取文件名和节拍信息
        const files = parts[0].match(/([+\-]?)(\d)(_*)/g);
        // 初始化 ffmpeg 命令
        const command = ffmpeg();
        // 初始化过滤器字符串
        let filterStr = '';
        // 初始化输入索引
        let inputIndex = 0;
        // 初始化总延迟时间
        let totalDelay = 0;

        // 遍历文件名和节拍信息
        const regex = /([+\-]?)(\d)(_*)$/;
        for (const str of files) {
            const match = str.match(regex);
            if (match) {
                const result1 = match[3] + (match[2] >= 1 && match[2] <= 7 ? '' : match[2]);
                const result2 = (match[2] >= 1 && match[2] <= 7 ? match[1] + match[2] : '');

                if (result2) {
                    // 添加输入文件
                    const inputFile = path.join(inputDirectory, result2 + '.wav');
                    console.log(inputFile)
                    command.input(inputFile);
                    // 构建 adelay 过滤器字符串
                    filterStr += `[${inputIndex}]adelay=${totalDelay}:all=1[${inputIndex}a];`;
                    inputIndex++;
                }

                let Delay
                const underscoreCount = result1.split('_').length - 1;
                Delay = 60000 / standardDelay / Math.pow(2, underscoreCount);
                if (result1.match(/\d/)) {
                    Delay += 60000 / standardDelay;
                }
                totalDelay += Delay
                console.log(result1, Delay, totalDelay)
            }


        }


        // 构建 amix 过滤器字符串
        filterStr += `[0a]`;
        for (let i = 1; i < inputIndex; i++) {
            filterStr += `[${i}a]`;
        }
        filterStr += `amix=inputs=${inputIndex}:dropout_transition=0:normalize=0[a]`;
        // 设置音频过滤器图并保存输出文件
        command
            .complexFilter(filterStr, 'a')
            //.on('stderr', console.log)
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .save(path.join(OUTPUT_PATH, 'output.mp3'));
    });
}
