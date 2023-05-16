import child_process from 'child_process'
import common from '../../../../lib/common/common.js'
import Config from '../../components/Config.js'
import moment from 'moment'
import _ from 'lodash'
export default new class newCommon {
  /**
     * @description: 延时函数
     * @param {*} ms 时间(毫秒)
     */
  sleep (ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * 判断用户权限
   * @param {*} e - 接收到的事件对象
   * @param {'master'|'admin'|'owner'|'all'} [permission='all'] - 命令所需的权限
   * @param {'admin'|'owner'|'all'} [role='all'] - 用户的权限
   * @return {boolean} - 是否具有权限
   */
  Authentication (e, permission = 'all', role = 'all') {
    if (role == 'owner' && !e.group.is_owner) {
      e.reply('我连群主都木有，这种事怎么可能做到的辣！！！', true)
      return false
    } else if (role == 'admin' && !e.group.is_admin && !e.group.is_owner) {
      e.reply('我连管理员都木有，这种事怎么可能做到的辣！！！', true)
      return false
    }
    // 判断权限
    if (e.isMaster) return true
    if (permission == 'master' && !e.isMaster) {
      e.reply('❎ 该命令仅限主人可用', true)
      return false
    } else if (permission == 'owner' && !e.member.is_owner) {
      e.reply('❎ 该命令仅限群主可用', true)
      return false
    } else if (permission == 'admin' && !e.member.is_admin && !e.member.is_owner) {
      e.reply('❎ 该命令仅限管理可用')
      return false
    }
    return true
  }

  /** 发消息 */
  async sendMasterMsg (msg) {
    if (Config.Notice.notificationsAll) {
      // 发送全部管理
      for (let index of Config.masterQQ) {
        await common.relpyPrivate(index, msg)
        await this.sleep(5000)
      }
    } else {
      // 发给第一个管理
      await common.relpyPrivate(Config.masterQQ[0], msg)
    }
  }

  /**
   * 将给定的秒数转换为日，时，分和秒，并返回一个对象。
   *
   * @param {number} time - 要转换的秒数
   * @param {boolean} repair - 是否修复不足 10 的时，分，秒数
   * @returns {{day: number, hour: (string|number), minute: (string|number), second: (string|number)}} - 包含转换结果的对象
   */
  getSecond (time, repair) {
    const second = parseInt(time % 60)
    const minute = parseInt((time / 60) % 60)
    const hour = parseInt((time / (60 * 60)) % 24)
    const day = parseInt(time / (24 * 60 * 60))
    return {
      day,
      hour: repair && hour < 10 ? `0${hour}` : hour,
      minute: repair && minute < 10 ? `0${minute}` : minute,
      second: repair && second < 10 ? `0${second}` : second
    }
  }

  /**
   * 发送转发消息
   * @async
   * @param {*} e - 发送消息的目标对象
   * @param {Array<string>} message - 发送的消息数组
   * @param {Object} options - 发送消息的配置项
   * @param {Number} options.recallMsg - 撤回时间，单位秒，默认为0表示不撤回
   * @param {Object} options.info - 转发发送人信息
   * @param {String} options.info.nickname - 转发发送人昵称，默认为机器人的昵称
   * @param {Number} options.info.user_id - 转发发送人QQ，默认为机器人的QQ号
   * @param {String} options.fkmsg - 风控消息，不传则默认消息
   * @param {Boolean} options.isxml - 是否处理卡片，若为true则处理卡片
   * @param {Boolean} options.isxmlMsg - 是否处理卡片显示消息
   * @param {Boolean} options.oneMsg - 是否只有一条消息
   * @param {Boolean | import('icqq').Anonymous} options.anony - 匿名消息，若为true则发送匿名消息
   * @returns {Promise<import('icqq').MessageRet>} - 消息发送结果的Promise对象
   */
  async getforwardMsg (e, message, {
    recallMsg = 0,
    info = {
      nickname: (e.bot ?? Bot).nickname,
      user_id: (e.bot ?? Bot).uin
    },
    fkmsg = '',
    isxml = false,
    isxmlMsg = '涩批(//// ^ ////)',
    oneMsg = false,
    anony
  } = {}) {
    let forwardMsg = []
    if (_.isEmpty(message)) throw Error('[止水sendforwardMsg][Error]发送的转发消息不能为空')
    let add = (msg) => forwardMsg.push(
      {
        message: msg,
        nickname: info?.nickname ?? (e.bot ?? Bot).nickname,
        user_id: info?.user_id ?? (e.bot ?? Bot).uin
      }
    )
    oneMsg ? add(message) : message.forEach(item => add(item))
    // 发送
    if (e.isGroup) {
      forwardMsg = await e.group.makeForwardMsg(forwardMsg)
    } else {
      forwardMsg = await e.friend.makeForwardMsg(forwardMsg)
    }
    if (isxml) {
      // 处理转发卡片
      forwardMsg.data = forwardMsg.data.replace('<?xml version="1.0" encoding="utf-8"?>', '<?xml version="1.0" encoding="utf-8" ?>')
      if (isxmlMsg) {
        forwardMsg.data = forwardMsg.data.replace(/\n/g, '')
          .replace(/<title color="#777777" size="26">(.+?)<\/title>/g, '___')
          .replace(/___+/, `<title color="#777777" size="26">${isxmlMsg}</title>`)
      }
    }
    let msgRes = await this.reply(e, forwardMsg, false, {
      anony,
      fkmsg,
      recallMsg
    })
    return msgRes
  }

  /**
    * 发送消息
    *
    * @async
    * @param {*} e oicq 事件对象
    * @param {Array|String} msg 消息内容
    * @param {Boolean} quote 是否引用回复
    * @param {Object} data 其他参数
    * @param {Number} data.recallMsg 撤回时间
    * @param {Boolean} data.fkmsg 风控消息
    * @param {Boolean | import('icqq').Anonymous} data.anony 匿名消息
    * @param {Boolean | Number} data.at 是否艾特该成员
    * @returns {Promise<import('icqq').MessageRet>} 返回发送消息后的结果对象
    */
  async reply (e, msg, quote, {
    recallMsg = 0,
    fkmsg = '',
    at = false,
    anony
  } = {}) {
    if (at && e.isGroup) {
      let text = ''
      if (e?.sender?.card) {
        text = _.truncate(e.sender.card, { length: 10 })
      }
      if (at === true) {
        at = Number(e.user_id)
      } else if (!isNaN(at)) {
        let info = e.group.pickMember(at).info
        text = info?.card ?? info?.nickname
        text = _.truncate(text, { length: 10 })
      }

      if (Array.isArray(msg)) {
        msg = [segment.at(at, text), ...msg]
      } else {
        msg = [segment.at(at, text), msg]
      }
    }

    let msgRes = null
    // 发送消息
    if (e.isGroup) {
      // 判断是否开启匿名
      if (anony) {
        let getAnonyInfo = await e.group.getAnonyInfo()
        if (!getAnonyInfo.enable) {
          e.reply('[警告]该群未开启匿名，请启用匿名再使用匿名功能')
          anony = false
        }
      }
      msgRes = await e.group.sendMsg(msg, quote ? e : undefined, anony)
    } else {
      msgRes = await e.reply(msg, quote)
      if (!msgRes) await e.reply(fkmsg || '消息发送失败，可能被风控')
    }
    if (recallMsg > 0 && msgRes?.message_id) {
      if (e.isGroup) {
        setTimeout(() => e.group.recallMsg(msgRes.message_id), recallMsg * 1000)
      } else if (e.friend) {
        setTimeout(() => e.friend.recallMsg(msgRes.message_id), recallMsg * 1000)
      }
    }
    return msgRes
  }

  /**
   * @description: 设置每日次数限制
   * @param {Number} userId QQ
   * @param {String} key
   * @param {Number} maxlimit 最大限制
   * @return {Prmoise<Boolean>}
   */
  async limit (userId, key, maxlimit) {
    if (maxlimit <= 0) return true
    let redisKey = `zhishui:${key}:limit:${userId}`
    let nowNum = await redis.get(redisKey)
    if (nowNum > maxlimit) return false
    if (!nowNum) {
      await redis.set(redisKey, 1, { EX: moment().add(1, 'days').startOf('day').diff(undefined, 'second') })
    } else {
      await redis.incr(redisKey)
    }
    return true
  }

  /**
     * @description: 取cookie
     * @param {String} data 如：qun.qq.com
     * @return {Object}
     */
  getck (data, transformation) {
    let cookie = Bot.cookies[data]
    let ck = cookie.replace(/=/g, '":"').replace(/;/g, '","').replace(/ /g, '').trim()
    ck = ck.substring(0, ck.length - 2)
    ck = JSON.parse('{"'.concat(ck).concat('}'))
    if (transformation) {
      let arr = []
      for (let i in ck) {
        arr.push({
          name: i,
          value: ck[i],
          domain: data,
          path: '/',
          expires: Date.now() + 3600 * 1000
        })
      }
      return arr
    } else return ck
  }

  /** 默认秒转换格式 */
  getsecondformat (value) {
    let time = this.getSecond(value)

    let { second, minute, hour, day } = time
    // 处理返回消息
    let result = ''
    if (second != 0) {
      result = parseInt(second) + '秒'
    }
    if (minute > 0) {
      result = parseInt(minute) + '分' + result
    }
    if (hour > 0) {
      result = parseInt(hour) + '小时' + result
    }
    if (day > 0) {
      result = parseInt(day) + '天' + result
    }
    return result
  }

  /**
     * @description: 使用JS将数字从汉字形式转化为阿拉伯形式
     * @param {string} s_123
     * @return {number}
     */
  translateChinaNum (s_123) {
    if (!s_123 && s_123 != 0) return s_123
    // 如果是纯数字直接返回
    if (/^\d+$/.test(s_123)) return Number(s_123)
    // 字典
    let map = new Map()
    map.set('一', 1)
    map.set('壹', 1) // 特殊
    map.set('二', 2)
    map.set('两', 2) // 特殊
    map.set('三', 3)
    map.set('四', 4)
    map.set('五', 5)
    map.set('六', 6)
    map.set('七', 7)
    map.set('八', 8)
    map.set('九', 9)
    // 按照亿、万为分割将字符串划分为三部分
    let split = ''
    split = s_123.split('亿')
    let s_1_23 = split.length > 1 ? split : ['', s_123]
    let s_23 = s_1_23[1]
    let s_1 = s_1_23[0]
    split = s_23.split('万')
    let s_2_3 = split.length > 1 ? split : ['', s_23]
    let s_2 = s_2_3[0]
    let s_3 = s_2_3[1]
    let arr = [s_1, s_2, s_3]

    // -------------------------------------------------- 对各个部分处理 --------------------------------------------------
    arr = arr.map(item => {
      let result = ''
      result = item.replace('零', '')
      // [ '一百三十二', '四千五百', '三千二百一十三' ] ==>
      let reg = new RegExp(`[${Array.from(map.keys()).join('')}]`, 'g')
      result = result.replace(reg, substring => {
        return map.get(substring)
      })
      // [ '1百3十2', '4千5百', '3千2百1十3' ] ==> ['0132', '4500', '3213']
      let temp
      temp = /\d(?=千)/.exec(result)
      let num1 = temp ? temp[0] : '0'
      temp = /\d(?=百)/.exec(result)
      let num2 = temp ? temp[0] : '0'
      temp = /\d?(?=十)/.exec(result)
      let num3
      if (temp === null) { // 说明没十：一百零二
        num3 = '0'
      } else if (temp[0] === '') { // 说明十被简写了：十一
        num3 = '1'
      } else { // 正常情况：一百一十一
        num3 = temp[0]
      }
      temp = /\d$/.exec(result)
      let num4 = temp ? temp[0] : '0'
      return num1 + num2 + num3 + num4
    })
    // 借助parseInt自动去零
    return parseInt(arr.join(''))
  }

  /**
     * @description: Promise执行exec
     * @param {String} cmd
     * @return {*}
     */
  async execSync (cmd) {
    return new Promise((resolve, reject) => {
      child_process.exec(cmd, (error, stdout, stderr) => {
        resolve({ error, stdout, stderr })
      })
    })
  }
}()
