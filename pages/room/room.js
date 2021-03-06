// pages/room.js
const constant = require('../../utils/constant.js')
const app = getApp()

Page({

  /**
   * 页面的初始数据
   */
  data: {
    // 是否连接上服务器
    connected: false,
    // 游戏是否开始
    gameStarted: false,
    // 是否展示对话框
    showDialog: false,
    // 聊天内容数组
    dialogContentList: [
      '哎，这牌太臭了',
      '打快点，磨磨矶矶的',
      '杠你，没商量',
      '我要胡牌啦',
      '哈哈，金将来一个',
      '累了，不打了',
      '有事，下次再玩',
      '三头金，运气不错',
      '我要抢金啦'
    ],
    // 四个玩家对话框位置数组
    dialogPosition: [
      { left: 0, top: 0, show: false, message: '' },
      { left: 0, top: 0, show: false, message: '' },
      { left: 0, top: 0, show: false, message: '' },
      { left: 0, top: 0, show: false, message: '' },
    ],
    // 是否正在录音
    isRecording: false,
    // 接收的消息类型
    messageType: -1,
    // 麻将里的金
    jin: {},
    // 现在是否处于点击吃的状态
    isChi: false,
    // 吃的状态下可以点的牌数组
    canChiArray: [],
    // 现在是否处于点击杠的状态
    isGang: false,
    // 当前用户是否可以抢金
    canQiangJin: false,
    // 当前轮到哪个用户出牌
    currentUserName: '',
    // 当前出牌时可能会碰或胡的下家列表
    nextUserNameList: [],
    // 按照出牌顺序下一个出牌的用户（如果没有碰杠胡时，就是当前用户，有碰杠胡时，记录按照顺序的下一个用户）
    physicalNextUserName: '',
    // 当前摸入的麻将id，用于在界面上和其它麻将分开（体现是刚摸入的）
    currentInMajiangId: -1,
    // 当前打出的麻将
    currentOutMajiang: {},
    // 剩余麻将数
    remainMajiangNum: 128,
    // 是否展示计分牌
    showScoreboard: false,
    // 计分牌信息
    scoreboard: {
      result: '',
      detail: []
    },
    // 当前房间内用户数量
    userNum: 0,
    // 当前串数
    bankerNo: 0,
    // 四个方向的用户
    topUser: '',
    leftUser: '',
    rightUser: '',
    bottomUser: '',
    // 四个方向的用户手牌数组
    mjTopArray: [],
    mjLeftArray: [],
    mjRightArray: [],
    mjBottomArray: [],
    // 四个方向的用户的花+打出的牌数组
    mjTopOutArray: [],
    mjLeftOutArray: [],
    mjRightOutArray: [],
    mjBottomOutArray: []
  },

  /**
   * 打开对话框操作
   */
  showDialog() {
    this.setData({ showDialog: true })
  },

  /**
    * 关闭对话框操作
    */
  closeDialog() {
    this.setData({ showDialog: false })
  },

  /**
   * 发送聊天信息
   */
  handleSendMessage: function (e) {
    const index = e.currentTarget.dataset.index
    wx.sendSocketMessage({
      data: JSON.stringify({
        type: constant.CHAT,
        message: this.data.dialogContentList[index],
        userName: app.globalData.userInfo.nickName
      })
    })
    this.setData({ showDialog: false })
  },

  handleAddRobot() {
    wx.sendSocketMessage({
      data: JSON.stringify({
        type: constant.ADD_ROBOT
      })
    })
  },

  /**
   * 提示长按录音
   */
  showAlert() {
    wx.showToast({
      title: '请长按录音！',
      icon: 'none'
    })
  },

  /**
   * 开始录音
   */
  startRecording() {
    const recorderManager = wx.getRecorderManager()
    recorderManager.onStart(() => {
      console.log('录音开始')
      this.setData({isRecording: true})
      wx.showLoading({
        title: '正在录音中...'
      })
    })
   
    recorderManager.onStop((res) => {
      wx.hideLoading()
      this.setData({ isRecording: false })
      const { tempFilePath } = res
      wx.showModal({
        title: '提示',
        content: '是否发送语音？',
        success(res) {
          if (res.confirm) {
            wx.uploadFile({
              url: 'https://mj.sjtudoit.com/upload',
              filePath: tempFilePath,
              name: 'file',
              success(res) {
                if (res.data == "上传成功") {
                  wx.showToast({
                    title: '发送成功！'
                  })
                  wx.sendSocketMessage({
                    data: JSON.stringify({
                      type: constant.AUDIO_CHAT,
                      message: tempFilePath.split("wxfile://")[1]
                    })
                  })
                }
              },
              fail(res) {
                console.log(res)
                wx.showToast({
                  title: '发送失败！',
                  icon: 'none'
                })
              }
            })
          }
        }
      })
    })

    recorderManager.start({format: 'mp3', numberOfChannels: 1})
  },

  stopRecording() {
    const recorderManager = wx.getRecorderManager()
    recorderManager.stop()
  },

  /**
   * 麻将子选中操作
   */
  handleChoose: function (e) {
    const mj = this.data.mjBottomArray[e.currentTarget.dataset.index]
    if (mj.show || mj.anGang || mj.jin) {
      // 已经吃、碰、杠的牌和金不能打
      return
    }

    if (this.data.isChi) {
      // 吃牌时的选牌操作
      if (this.data.canChiArray.filter(code => code === mj.code).length === 0) {
        return
      }
      const mjBottomArray = this.data.mjBottomArray.map((item, index) => {
        if (e.currentTarget.dataset.index == index) {
          item.top = item.top === '-10px' ? 0 : '-10px'
        }
        return item
      })
      const chiArray = mjBottomArray.filter(mj => mj.top !== 0)

      if (chiArray.length === 2) {
        // 如果有两张牌被选中，且符合吃的规则，则直接吃
        const chiArr = [chiArray[0], chiArray[1], this.data.currentOutMajiang]
        chiArr.sort((a, b) => a.code - b.code)
        if (chiArr[1].code === chiArr[0].code + 1 && chiArr[1].code === chiArr[2].code - 1) {
          wx.sendSocketMessage({
            data: JSON.stringify({
              type: constant.MJ_CHI,
              message: `${chiArr[0].id} ${chiArr[1].id} ${chiArr[2].id}`
            })
          })
          this.setData({
            isChi: false,
            chiArray: [],
            mjBottomArray
          })
        } else {
          this.setData({
            chiArray: [],
            mjBottomArray
          })
        }
      } else {
        // 有一张牌被选中，则显示，等待下一张牌
        this.setData({
          mjBottomArray
        })
      }
    } else if (this.data.isGang) {
      // 杠牌时的选中操作
      if (this.data.mjBottomArray.filter(item => item.show && item.code === mj.code).length === 3) {
        // 说明是加杠
        wx.sendSocketMessage({
          data: JSON.stringify({
            type: constant.MJ_JIA_GANG,
            message: mj.code
          })
        })
      } else if (this.data.mjBottomArray.filter(item => item.code === mj.code).length === 4) {
        // 说明是暗杠
        wx.sendSocketMessage({
          data: JSON.stringify({
            type: constant.MJ_AN_GANG,
            message: mj.code
          })
        })
      } else {
        wx.showToast({
          title: '选择的牌不能开杠，已取消杠操作',
          icon: 'none'
        })
      }
      this.setData({ isGang: false })
    } else {
      // 正常选牌出牌操作
      if (this.data.currentUserName === app.globalData.userInfo.nickName && mj.top !== 0) {
        // 说明是打掉这张牌的操作
        if (this.data.mjBottomArray.filter(mj => !mj.show && !mj.anGang).length % 3 !== 2) {
          wx.showToast({
            title: '请先摸牌后再出牌',
            icon: 'none'
          })
          return
        }
        wx.sendSocketMessage({
          data: JSON.stringify({
            type: constant.MJ_OUT,
            message: e.currentTarget.dataset.index
          })
        })
        return
      }
      // 说明是点击了别的牌的操作
      const mjBottomArray = this.data.mjBottomArray.map((item, index) => {
        if (e.currentTarget.dataset.index == index) {
          item.top = item.top === 0 ? '-10px' : 0
        } else {
          item.top = 0
        }
        return item
      })
      this.setData({
        mjBottomArray
      })
    }
  },

  /**
   * 摸牌操作
   */
  handleAdd() {
    if (this.data.currentUserName !== this.data.physicalNextUserName) {
      wx.showToast({
        title: '没轮到你摸牌',
        icon: 'none'
      })
      return false
    }
    if (this.data.currentUserName === app.globalData.userInfo.nickName) {
      if (this.data.mjBottomArray.filter(mj => !mj.show && !mj.anGang).length % 3 === 2) {
        wx.showToast({
          title: '牌数正好，不能摸牌',
          icon: 'none'
        })
      } else {
        wx.sendSocketMessage({
          data: JSON.stringify({
            type: constant.MJ_IN,
            message: '请求摸牌'
          })
        })
        this.setData({
          isChi: false,
          canChiArray: [],
          isGang: false
        })
      }
    } else {
      wx.showToast({
        title: '轮到你了才能摸牌哦！',
        icon: 'none'
      })
    }
  },

  /**
   * 吃牌操作
   */
  handleChi() {
    if (this.data.currentUserName !== this.data.bottomUser.userNickName) {
      wx.showToast({
        title: '没轮到你，不能吃哦',
        icon: 'none'
      })
      return
    }
    if (this.data.physicalNextUserName !== this.data.bottomUser.userNickName) {
      // 防止当前可碰可胡时轮到你你却点了吃（不合规则）
      wx.showToast({
        title: '根据规则，现在不能吃',
        icon: 'none'
      })
      return
    }
    if (this.data.nextUserNameList.length > 0 && this.data.nextUserNameList[0] != this.data.bottomUser.userNickName) {
      // 防止可以胡的牌先点了吃，但是下家有要碰的或者要胡的
      wx.sendSocketMessage({
        data: JSON.stringify({
          type: constant.PASS,
          message: '过'
        })
      })
      return
    }
    if (this.data.currentOutMajiang.jin) {
      wx.showToast({
        title: '根据规则，金不能吃',
        icon: 'none'
      })
      return
    }
    const currentOutMjCode = this.data.currentOutMajiang.code
    const mjBottomArray = this.data.mjBottomArray.map(mj => {return {...mj, top: 0}})
    const canEatMjCodeArray = mjBottomArray.filter(mj => !mj.show && !mj.anGang && !mj.jin).map(mj => mj.code).filter(code => code - currentOutMjCode <= 2 || code - currentOutMjCode >= -2)
    const canChiArray = []
    let mjId1, mjId2
    // 判断当前是否可吃，以及可能存在的吃法
    if (canEatMjCodeArray.includes(currentOutMjCode - 2) && canEatMjCodeArray.includes(currentOutMjCode - 1)) {
      mjId1 = mjBottomArray.filter(mj => mj.code === currentOutMjCode - 2)[0].id
      mjId2 = mjBottomArray.filter(mj => mj.code === currentOutMjCode - 1)[0].id
      canChiArray.push(currentOutMjCode - 2, currentOutMjCode - 1)
    }
    if (canEatMjCodeArray.includes(currentOutMjCode - 1) && canEatMjCodeArray.includes(currentOutMjCode + 1)) {
      mjId1 = mjBottomArray.filter(mj => mj.code === currentOutMjCode - 1)[0].id
      mjId2 = mjBottomArray.filter(mj => mj.code === currentOutMjCode + 1)[0].id
      canChiArray.push(currentOutMjCode - 1, currentOutMjCode + 1)
    }
    if (canEatMjCodeArray.includes(currentOutMjCode + 1) && canEatMjCodeArray.includes(currentOutMjCode + 2)) {
      mjId1 = mjBottomArray.filter(mj => mj.code === currentOutMjCode + 1)[0].id
      mjId2 = mjBottomArray.filter(mj => mj.code === currentOutMjCode + 2)[0].id
      canChiArray.push(currentOutMjCode + 1, currentOutMjCode + 2)
    }
    if (mjId1 && mjId2) {
      wx.showToast({
        title: '请选择吃的牌',
        icon: 'success'
      })
      this.setData({
        isChi: true,
        canChiArray,
        mjBottomArray: mjBottomArray
      })
    } else {
      wx.showToast({
        title: '没有牌可以吃',
        icon: 'none'
      })
    }
  },

  /**
   * 碰牌操作
   */
  handlePeng() {
    if (this.data.currentUserName !== this.data.bottomUser.userNickName) {
      wx.showToast({
        title: '没轮到你，不能碰哦',
        icon: 'none'
      })
      return
    }
    if (this.data.nextUserNameList.length > 0 && this.data.nextUserNameList[0] != this.data.bottomUser.userNickName) {
      // 防止可以胡的牌先点了碰，但是下家有要胡的
      wx.sendSocketMessage({
        data: JSON.stringify({
          type: constant.PASS,
          message: '过'
        })
      })
      return
    }
    if (this.data.currentOutMajiang.jin) {
      wx.showToast({
        title: '根据规则，金不能碰',
        icon: 'none'
      })
      return
    }
    const currentOutMjCode = this.data.currentOutMajiang.code
    const mjBottomArray = this.data.mjBottomArray
    if (mjBottomArray.filter(mj => mj.code === currentOutMjCode && !mj.show && !mj.anGang && !mj.jin).length >= 2) {
      wx.sendSocketMessage({
        data: JSON.stringify({
          type: constant.MJ_PENG,
          message: '碰'
        })
      })
    } else {
      wx.showToast({
        title: '没有牌可以碰',
        icon: 'none'
      })
    }
  },

  /**
   * 杠牌操作
   */
  handleGang() {
    if (this.data.currentUserName !== this.data.bottomUser.userNickName) {
      wx.showToast({
        title: '没轮到你，不能杠哦',
        icon: 'none'
      })
      return
    }
    if (this.data.nextUserNameList.length > 0 && this.data.nextUserNameList[0] != this.data.bottomUser.userNickName) {
      // 防止可以胡的牌先点了杠，但是下家有要胡的
      wx.sendSocketMessage({
        data: JSON.stringify({
          type: constant.PASS,
          message: '过'
        })
      })
      return
    }
    const currentOutMjCode = this.data.currentOutMajiang.code
    const mjBottomArray = this.data.mjBottomArray

    if (mjBottomArray.filter(mj => !mj.show && mj.code === currentOutMjCode).length === 3) {
      // 开杠，直接杠别人打出的麻将（不能杠已经碰的麻将）
      wx.sendSocketMessage({
        data: JSON.stringify({
          type: constant.MJ_GANG,
          message: '开杠'
        })
      })
    } else {
      if (this.data.mjBottomArray.filter(mj => !mj.show && !mj.anGang).length % 3 === 2) {
        // 牌数正好，只能是暗杠和加杠
        wx.showToast({
          title: '请选择杠的牌',
          icon: 'success'
        })
        this.setData({ isGang: true })
      } else {
        wx.showToast({
          title: '没有牌可以杠',
          icon: 'none'
        })
      }
    }
  },

  /**
   * 胡牌操作，如果能胡则直接胡，不能胡该按钮点了没有用（也没有提示），判断胡牌的逻辑在后端进行
   */
  handleHu() {
    if (this.data.currentOutMajiang.jin && !this.data.currentInMajiang) {
      wx.showToast({
        title: '根据规则，不能胡打出去的金',
        icon: 'none'
      })
      return
    }
    if (this.data.currentUserName !== this.data.bottomUser.userNickName) {
      wx.showToast({
        title: '没轮到你，不能胡哦',
        icon: 'none'
      })
      return
    }
    wx.sendSocketMessage({
      data: JSON.stringify({
        type: constant.MJ_HU,
        message: '胡'
      })
    })
  },

  /**
   * 抢金操作
   */
  handleQiangJin() {
    if (this.data.canQiangJin) {
      // 判断是否能抢金
      wx.sendSocketMessage({
        data: JSON.stringify({
          type: constant.MJ_HU,
          message: '抢金'
        })
      })
      this.setData({canQiangJin: false})
    }
  },

  /**
   * 过牌操作，即跳过碰、杠或胡时才有用，否则点了没用
   */
  handlePass() {
    if (this.data.currentUserName !== this.data.bottomUser.userNickName) {
      wx.showToast({
        title: '没轮到你，点击无效',
        icon: 'none'
      })
      return
    }
    wx.sendSocketMessage({
      data: JSON.stringify({
        type: constant.PASS,
        message: '过'
      })
    })
  },

  /**
   * 准备操作，即开启websocket连接
   */
  handleReady: function () {
    wx.sendSocketMessage({
      data: JSON.stringify({
        type: constant.CLIENT_READY,
        message: '准备'
      })
    })
  },

  /**
   * 取消计分板显示
   */
  hideScoreBoard: function () {
    this.setData({ showScoreboard: false })
  },

  /**
   * 退出游戏，玩家下线
   */
  handleQuitGame: function () {
    wx.showModal({
      title: '提示',
      content: (this.data.gameStarted ? '本局游戏尚未结束，' : '') + '您确定要退出游戏吗',
      success(res) {
        if (res.confirm) {
          wx.navigateBack()
        }
      }
    })

  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 请求加载游戏信息
    wx.sendSocketMessage({
      data: JSON.stringify({
        type: constant.GET_GAME
      })
    })
    // 响应接收到webSocket消息时的操作
    wx.onSocketMessage((res) => {
      // 游戏对象
      const game = JSON.parse(res.data)
      console.log(game)
      // 数组不响应
      if (game[0] != null) {
        return;
      }

      const innerAudioContext = wx.createInnerAudioContext()

      if (game.type === constant.AUDIO_CHAT) {
        innerAudioContext.src = `https://mj.sjtudoit.com/audio/${game.message}`;
        innerAudioContext.play()
        return;
      }

      // 处理聊天消息
      if (game.type === constant.CHAT) {
        // 定位聊天框出现的位置
        const query = wx.createSelectorQuery()
        query.select('#top-user').boundingClientRect()
        query.select('#left-user').boundingClientRect()
        query.select('#right-user').boundingClientRect()
        query.select('#bottom-user').boundingClientRect()
        const dialogPosition = this.data.dialogPosition
        query.exec((res) => {
          res.forEach((item, index) => {
            dialogPosition[index].left = item.left + item.width / 2 + 'px'
            dialogPosition[index].top = item.top - 35 + 'px'
          })
          let i
          if (game.userName === this.data.topUser.userNickName) {
            i = 0
          } else if (game.userName === this.data.leftUser.userNickName) {
            i = 1
          } else if (game.userName === this.data.rightUser.userNickName) {
            i = 2
          } else if (game.userName === this.data.bottomUser.userNickName) {
            i = 3
          }
          if (i !== undefined) {
            dialogPosition[i].show = true
            dialogPosition[i].message = game.message
            this.setData({ dialogPosition })
            setTimeout(() => {
              dialogPosition[i].show = false
              dialogPosition[i].message = ''
              this.setData({ dialogPosition })
            }, 2000)
          }
        })
        return;
      }

      // 判断用户下线提示
      if (game.messageType === constant.INFO && game.message === app.globalData.userInfo.nickName + '退出房间') {
        return;
      }

      const currentUserName = game.currentUserName
      const currentOutMajiang = game.currentOutMajiang
      const currentInMajiang = game.currentInMajiang

      let myIndex
      game.userList.forEach((user, index) => {
        if (user.userNickName === app.globalData.userInfo.nickName) {
          myIndex = index
        }
        // 判断当前打出的麻将是哪个
        if (user.outList.length > 0 && currentOutMajiang && user.outList[user.outList.length - 1].id === currentOutMajiang.id) {
          user.outList[user.outList.length - 1].isCurrent = true
        }
      })

      // 确定游戏的玩家显示顺序
      const bottomUser = game.userList[myIndex];
      const rightUser = game.userList[(myIndex + 1) % 4];
      const topUser = game.userList[(myIndex + 2) % 4];
      const leftUser = game.userList[(myIndex + 3) % 4];

      switch (game.messageType) {
        case constant.INFO: {
          // 有玩家进入房间时广播的信息
          wx.showToast({
            title: game.message,
            icon: 'none'
          })
          if (game.remainMajiangList.length > 0 && game.gameStarted) {
            // 说明进入时游戏已经开始，不需要再准备
            this.setData({ connected: true })
          } else {
            if (game.message.includes(app.globalData.userInfo.nickName)) {
              // 说明进入时游戏还没开始，需要再次准备
              this.setData({ connected: false })
            }
          }
          break;
        }
        case constant.CLIENT_READY: {
          // 玩家准备信息
          wx.showToast({
            title: game.message + '已准备！',
            icon: 'none'
          })
          if (game.message === bottomUser.userNickName) {
            this.setData({ connected: true })
          }
          break;
        }
        case constant.START_GAME: {
          wx.showToast({
            title: '游戏开始！'
          })
          this.setData({ canQiangJin: false })
          break;
        }
        case constant.RESET_FLOWER: {
          // 游戏开始时补花
          if (game.jin && game.jin.name) {
            wx.showToast({
              title: `开金！金是${game.jin.name}`
            })
            this.setData({ jin: game.jin })
            // 判断自己是否能抢金
            if (bottomUser.canQiangJin) {
              this.setData({ canQiangJin: true })
            }
          }
          innerAudioContext.src = '/assets/sound/buhua.ogg';
          innerAudioContext.play()
          break;
        }
        case constant.MJ_OUT: {
          innerAudioContext.src = `/assets/sound/${(game.currentOutMajiang.code + 10) % 30}.mp3`;  // 音频资源的文件和麻将的点数命名顺序不一致，故作调整
          innerAudioContext.play()
          break;
        }
        case constant.MJ_ADD_FLOWER: {
          innerAudioContext.src = '/assets/sound/buhua.ogg';
          innerAudioContext.play()
          break;
        }
        case constant.MJ_CHI: {
          innerAudioContext.src = '/assets/sound/chi.mp3';
          innerAudioContext.play()
          break;
        }
        case constant.MJ_PENG: {
          innerAudioContext.src = '/assets/sound/peng.mp3';
          innerAudioContext.play()
          break;
        }
        case constant.MJ_GANG: {
          innerAudioContext.src = '/assets/sound/gang.mp3';
          innerAudioContext.play()
          break;
        }
        case constant.MJ_AN_GANG: {
          innerAudioContext.src = '/assets/sound/gang.mp3';
          innerAudioContext.play()
          break;
        }
        case constant.MJ_JIA_GANG: {
          innerAudioContext.src = '/assets/sound/gang.mp3';
          innerAudioContext.play()
          break;
        }
        case constant.HU_PING_HU: {
          innerAudioContext.src = '/assets/sound/hu.mp3';
          innerAudioContext.play()
          wx.showToast({
            title: `${game.currentUserName} 平胡`,
            icon: 'none'
          })
          wx.sendSocketMessage({
            data: JSON.stringify({
              type: constant.GAME_OVER,
              message: '游戏结束'
            })
          })
          this.setData({ scoreboard: { result: '平胡' } })
          break;
        }
        case constant.HU_ZI_MO: {
          innerAudioContext.src = '/assets/sound/hu.mp3';
          innerAudioContext.play()
          wx.showToast({
            title: `${game.currentUserName} 自摸`,
            icon: 'none'
          })
          wx.sendSocketMessage({
            data: JSON.stringify({
              type: constant.GAME_OVER,
              message: '游戏结束'
            })
          })
          this.setData({ scoreboard: { result: '自摸' } })
          break;
        }
        case constant.HU_QIANG_JIN: {
          innerAudioContext.src = '/assets/sound/hu.mp3';
          innerAudioContext.play()
          wx.showToast({
            title: `${game.currentUserName} 抢金`,
            icon: 'none'
          })
          wx.sendSocketMessage({
            data: JSON.stringify({
              type: constant.GAME_OVER,
              message: '游戏结束'
            })
          })
          this.setData({ scoreboard: { result: '抢金' } })
          break;
        }
        case constant.HU_THREE_JIN: {
          innerAudioContext.src = '/assets/sound/hu.mp3';
          innerAudioContext.play()
          wx.showToast({
            title: `${game.currentUserName} 三金倒`,
            icon: 'none'
          })
          wx.sendSocketMessage({
            data: JSON.stringify({
              type: constant.GAME_OVER,
              message: '游戏结束'
            })
          })
          this.setData({ scoreboard: { result: '三金倒' } })
          break;
        }
        case constant.HU_JIN_QUE: {
          innerAudioContext.src = '/assets/sound/hu.mp3';
          innerAudioContext.play()
          wx.showToast({
            title: `${game.currentUserName} 金雀`,
            icon: 'none'
          })
          wx.sendSocketMessage({
            data: JSON.stringify({
              type: constant.GAME_OVER,
              message: '游戏结束'
            })
          })
          this.setData({ scoreboard: { result: '金雀' } })
          break;
        }
        case constant.MJ_TIE: {
          wx.showToast({
            title: '和局',
            icon: 'success'
          })
          wx.sendSocketMessage({
            data: JSON.stringify({
              type: constant.GAME_OVER,
              message: '游戏结束'
            })
          })
          this.setData({ scoreboard: { result: '和局' } })
          break;
        }
        case constant.GAME_OVER: {
          const scoreboard = this.data.scoreboard
          scoreboard.detail = game.userList.map(user => {
            return {
              userNickName: user.userNickName,
              score: user.score,
              scoreChange: user.scoreChange,
              previousScore: user.score - user.scoreChange,
              majiangList: user.userMajiangList
            }
          })
          this.setData({ connected: false, gameStarted: false, showScoreboard: true, scoreboard })
          break;
        }
        default: break;
      }

      const mjBottomArray = bottomUser.userMajiangList.map((item, index) => {
        item.top = 0
        return item
      })
      const mjRightArray = rightUser.userMajiangList.map((item, index) => {
        item.top = 0
        // item.show = true
        return item
      })
      const mjTopArray = topUser.userMajiangList.map((item, index) => {
        item.top = 0
        // item.show = true
        return item
      })
      const mjLeftArray = leftUser.userMajiangList.map((item, index) => {
        item.top = 0
        // item.show = true
        return item
      })

      const mjBottomOutArray = [...bottomUser.flowerList, ...bottomUser.outList]
      const mjRightOutArray = [...rightUser.outList.reverse(), ...rightUser.flowerList.reverse()]
      const mjTopOutArray = [...topUser.outList.reverse(), ...topUser.flowerList.reverse()]
      const mjLeftOutArray = [...leftUser.flowerList, ...leftUser.outList]

      this.setData({
        gameStarted: game.gameStarted,
        jin: game.jin ? game.jin : null,
        messageType: game.messageType,
        bankerNo: game.bankerNo,
        nextUserNameList: game.nextUserNameList,
        currentOutMajiang: currentOutMajiang ? currentOutMajiang : {},
        currentUserName: currentUserName ? currentUserName : '',
        physicalNextUserName: game.physicalNextUserName ? game.physicalNextUserName : 0,
        currentInMajiangId: currentInMajiang && currentInMajiang.id ? currentInMajiang.id : -1,
        remainMajiangNum: game.remainMajiangList.length,
        userNum: game.userList.filter(user => user.userNickName != '').length,
        topUser,
        leftUser,
        rightUser,
        bottomUser,
        mjLeftArray,
        mjRightArray,
        mjTopArray,
        mjBottomArray,
        mjLeftOutArray,
        mjTopOutArray,
        mjRightOutArray,
        mjBottomOutArray
      })

      // 轮到自己时
      if (currentUserName === app.globalData.userInfo.nickName) {
        // 如果有麻将摸进，说明已经摸牌
        if (currentInMajiang && currentInMajiang.id) {
          if (currentInMajiang.code > 30 && game.remainMajiangList.length >= 16) {
            // 摸到的是花且剩余牌数大于等于16张（尚未和局时）补花
            setTimeout(() => {
              wx.sendSocketMessage({
                data: JSON.stringify({
                  type: constant.MJ_ADD_FLOWER,
                  message: '补花'
                })
              })
            }, 600)
          } else {
            // 摸到的不是花，自己打牌
          }
          return
        }
        // 游戏开始时补花
        if (mjBottomArray.filter(mj => mj.code > 30).length > 0) {
          setTimeout(() => {
            wx.sendSocketMessage({
              data: JSON.stringify({
                type: constant.RESET_FLOWER,
                message: '游戏开始时补花'
              })
            })
          }, 1000)
        }
      }
    })

    wx.onSocketClose(res => {
      console.log(res)
      wx.showToast({
        title: '连接关闭',
        icon: 'none'
      })
      // 如果连接断开则跳转到首页，退出房间
      wx.navigateBack({
        delta: 2
      })
    })
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {
    
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    wx.sendSocketMessage({
      data: JSON.stringify({
        type: constant.QUIT
      })
    })
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  }
})