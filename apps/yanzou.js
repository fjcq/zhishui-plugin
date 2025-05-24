import plugin from '../../../lib/plugins/plugin.js'
import { createRequire } from 'module'
import { Plugin_Path, Config } from '../components/index.js'
import path from 'path'

const require = createRequire(import.meta.url)
const { spawn } = require('child_process')
const fs = require('fs')

/** 乐器音频根目录 */
const INSTRUMENTS_ROOT = path.join(Plugin_Path, 'resources', 'yanzou')
/** 当前乐器目录 */
let currentInstrumentDir = ""
/** 输出目录 */
const OUTPUT_DIR = path.join(Plugin_Path, 'resources', 'output')
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR)
}
/** 输出格式 */
const OUTPUT_FORMAT = '.wav'
/** 输出文件名 */
let outputFilePath = ""

/** 乐器映射表 */
const INSTRUMENT_MAP = {
    "钢琴": "gangqin",
    "八音盒": "ba",
    "古筝": "gu",
    "吉他": "jita",
    "萨克斯": "sa",
    "小提琴": "ti",
    "吹箫": "xiao",
    "西域琴": "xiyu"
}

export class YanzouPlayer extends plugin {
    _isPlaying = false
    _isProcessing = false

    constructor() {
        super({
            name: '[止水插件]演奏',
            dsc: '乐器演奏',
            event: 'message',
            priority: 1000,
            rule: [
                { reg: "^(#|\/)?演奏(.*)", fnc: 'handlePlayCommand' },
                { reg: "^(#|\/)?取消演奏$", fnc: 'handleCancelCommand' },
                { reg: "^(#|\/)?高品质演奏(开启|关闭)$", fnc: 'toggleQualityMode' },
                { reg: "^(#|\/)?调试演奏(.*)$", fnc: 'handleDebugCommand' }
            ]
        })
    }

    /**
     * 处理演奏指令
     */
    async handlePlayCommand(e) {
        let stdoutLog = ''
        let stderrLog = ''
        const userInput = e.msg.replace(/#演奏/g, "").trim()
        let replyMsg = ""

        if (userInput === "帮助") {
            replyMsg = getPlayHelpText()
            e.reply(replyMsg)
            return
        }

        if (this._isProcessing) {
            e.reply("正在准备演奏呢，你先别急~~")
            return
        }

        this._isPlaying = true
        const ffmpegArgs = await buildFfmpegArgs(e.msg)

        if (!ffmpegArgs || ffmpegArgs.length <= 3) {
            replyMsg = getPlayHelpText()
            e.reply(replyMsg)
            this._isPlaying = false
            return
        }

        // 预估准备时间
        const noteCount = ffmpegArgs.filter(arg => arg === '-i').length
        const estimatedTime = Math.max(5, Math.round(noteCount * 0.8)) // 每音符约0.8秒，最少5秒
        let hasStarted = false
        let startTime = 0

        const ffmpegProc = spawn(
            "ffmpeg",
            ffmpegArgs,
            { cwd: currentInstrumentDir }
        )

        ffmpegProc.on('spawn', () => {
            startTime = Date.now()
            e.reply(`正在为你准备演奏，预计需要${estimatedTime}秒左右，请耐心等待~（音符越多等待时间越长）`)
            hasStarted = true
        })

        ffmpegProc.on('error', (err) => {
            console.error(`Failed to start ffmpeg: ${err}`)
            if (!hasStarted) {
                replyMsg = '你还没有配置ffmpeg的环境变量，请到这里下载https://ffmpeg.org/download.html，并配置环境变量'
                e.reply(replyMsg)
            }
            this._isPlaying = false
        })

        ffmpegProc.stdout.on('data', (data) => {
            stdoutLog += data.toString()
        })
        ffmpegProc.stderr.on('data', (data) => {
            stderrLog += data.toString()
        })

        ffmpegProc.on('exit', async (code) => {
            const usedTime = Math.round((Date.now() - startTime) / 1000)
            if (code === 0) {
                await sleep(1000)
                outputFilePath = path.join(OUTPUT_DIR, `output${OUTPUT_FORMAT}`)
                console.debug('[DEBUG] 合成音频成功 =>', outputFilePath)
                try {
                    const audioMsg = await uploadAudio(outputFilePath)
                    e.reply(audioMsg)
                } catch {
                    e.reply(await segment.record(outputFilePath))
                }
                e.reply(`演奏准备完成，实际用时${usedTime}秒。`)
                this._isProcessing = false
            } else {
                const errorMsg = getFfmpegErrorMsg(code)
                console.log("FFmpeg 错误流：", stderrLog)
                e.reply(`合成音频失败，${errorMsg}！`)
                this._isProcessing = false
            }
        })
    }

    /**
     * 取消演奏
     */
    async handleCancelCommand(e) {
        if (this._isProcessing) {
            e.reply('已经取消演奏！')
            this._isProcessing = false
            return true
        }
    }

    /**
     * 切换高品质演奏模式
     */
    async toggleQualityMode(e) {
        if (!e.isMaster) return false
        const enable = e.msg.includes('开启')
        Config.modify('yanzou', 'Quality', enable)
        e.reply(`[高品质演奏] 已${enable ? '开启' : '关闭'}！`)
        return true
    }

    /**
     * 调试演奏功能
     */
    async handleDebugCommand(e) {
        const notation = e.msg.replace(/#调试演奏/g, "").trim()
        await mergeAudioFiles(notation, currentInstrumentDir, OUTPUT_DIR)
        const debugFile = path.join(OUTPUT_DIR, `output${OUTPUT_FORMAT}`)
        e.reply([segment.record(debugFile)])
    }
}

/**
 * 生成 ffmpeg 参数
 */
async function buildFfmpegArgs(msg) {
    // 解析乐器
    let instrumentKey = "gangqin"
    for (let key in INSTRUMENT_MAP) {
        if (msg.includes(key)) {
            instrumentKey = INSTRUMENT_MAP[key]
            break
        }
    }
    currentInstrumentDir = path.join(INSTRUMENTS_ROOT, instrumentKey)

    // 解析简谱和节拍
    const notationRaw = msg.replace(/#演奏[^\s\d+-]*/g, "").trim()
    const [scoreStr, bpmStr] = notationRaw.split('|')
    let beatDuration = 60000 / 90 // 默认90BPM
    if (bpmStr && !isNaN(parseInt(bpmStr))) {
        beatDuration = 60000 / parseInt(bpmStr)
    }
    const notes = scoreStr.match(/[-|+]*\d_*/g)
    if (!isNotNull(notes) || notes.length < 1) return

    // 生成 ffmpeg 输入和 filter_complex
    let inputs = []
    let filters = []
    let concatInputs = []
    let idx = 0
    for (let i = 0; i < notes.length; i++) {
        const noteRaw = notes[i]
        const note = noteRaw.replace(/_*/g, "").trim()
        if (note === '' || note === '0') continue
        const filePath = path.join(currentInstrumentDir, `${note}${OUTPUT_FORMAT}`)
        if (!fs.existsSync(filePath)) continue

        // 计算音符时长
        const underlineCount = (noteRaw.match(/_/g) || []).length
        let duration = beatDuration
        if (underlineCount === 1) duration *= 0.5
        if (underlineCount === 2) duration *= 0.25
        if (underlineCount === 3) duration *= 0.125

        inputs.push('-i', filePath)
        filters.push(`[${idx}:a]atrim=0:${(duration / 1000).toFixed(3)},asetpts=PTS-STARTPTS[a${idx}]`)
        concatInputs.push(`[a${idx}]`)
        idx++
    }
    if (idx === 0) return

    const filterStr = filters.join(';') + ';' + concatInputs.join('') + `concat=n=${idx}:v=0:a=1[outa]`
    return [
        '-y',
        ...inputs,
        '-filter_complex', filterStr,
        '-map', '[outa]',
        '-ar', '16000',
        '-ac', '1',
        '-sample_fmt', 's16',
        path.join(OUTPUT_DIR, `output${OUTPUT_FORMAT}`)
    ]
}

/**
 * 合成音频（调试用，fluent-ffmpeg 方式）
 */
async function mergeAudioFiles(notation, instrumentDir, outputDir) {
    const ffmpeg = require('fluent-ffmpeg')
    const notes = notation.split('+').map(f => f.trim()).filter(f => f && f !== '0')
    const files = notes.map(f => path.join(instrumentDir, `${f}.wav`)).filter(f => fs.existsSync(f))
    return new Promise((resolve, reject) => {
        if (files.length === 0) return reject('无可用音符')
        let command = ffmpeg()
        files.forEach(file => command.input(file))
        command
            .on('end', resolve)
            .on('error', reject)
            .mergeToFile(path.join(outputDir, `output.wav`), outputDir)
    })
}

/**
 * 上传音频文件
 */
async function uploadAudio(filePath, isPtt = false) {
    return segment.record(filePath, isPtt)
}

/**
 * ffmpeg 错误码转中文
 */
function getFfmpegErrorMsg(code) {
    const errorMap = {
        1: '输入文件不存在',
        2: '输出文件已存在',
        3: '无法打开输入文件',
        4: '无法打开输出文件',
        5: '无法读取输入文件',
        6: '无法写入输出文件',
        7: '编码失败',
        8: '解码失败',
        9: '格式不支持',
        10: '无效的参数',
        11: '内部错误'
    }
    return errorMap[code] || `错误代码：${code}`
}

/**
 * 延时函数
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 判断对象是否有效
 */
function isNotNull(obj) {
    return !(obj == undefined || obj == null || obj != obj)
}

/**
 * 演奏帮助文本
 */
function getPlayHelpText() {
    let msg = ""
    msg += "【止水插件·乐器演奏功能说明】\n"
    msg += "本功能支持多种乐器自动演奏简谱，格式灵活，操作简单。\n\n"
    msg += "【基础用法】\n"
    msg += "发送：#演奏乐器名+简谱|节奏\n"
    msg += "示例：#演奏钢琴+6__+4+3+2_|82\n\n"
    msg += "【参数说明】\n"
    msg += "1. 乐器名：支持以下乐器（任选其一）：\n"
    msg += "   钢琴、八音盒、古筝、吉他、萨克斯、小提琴、吹箫、西域琴\n"
    msg += "2. 简谱：用数字表示音符，+为高音，-为低音，0为休止符。\n"
    msg += "   下划线 _ 表示延长音符时长：\n"
    msg += "     - 1个_ ：半拍\n"
    msg += "     - 2个__：四分之一拍\n"
    msg += "     - 3个___：八分之一拍\n"
    msg += "   多个音符用+号连接，如：+6__+4+3+2\n"
    msg += "3. 节奏（可选）：用 |数字 表示每分钟节拍数（BPM），如 |82\n"
    msg += "   不写则默认90BPM。\n\n"
    msg += "【简单音乐片段示例】\n"
    msg += "#演奏钢琴+1+2+3+6_+5+6_+5+6_+5+2__|95\n"
    msg += "（上面例子是《起风了》副歌“我曾难自拔于世界之大”旋律片段）\n\n"
    msg += "【更多示例】\n"
    msg += "#演奏八音盒+1+2+3+4+5+6+7_|100\n"
    msg += "#演奏古筝-6_+5_+4_+3_+2_+1_|60\n"
    msg += "#演奏吉他+3+3+2+2+1+1+0+0_|120\n\n"
    msg += "【特别说明】\n"
    msg += "· 休止符用0表示，会自动插入空拍。\n"
    msg += "· 支持高低音（+/-），支持多种乐器切换。\n"
    msg += "· 如需帮助，发送“#演奏帮助”。\n"
    return msg
}

// segment 兼容处理（如全局未定义则引入）
if (typeof segment === 'undefined' && global.segment) {
    var segment = global.segment
}


