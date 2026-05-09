// ============================================================
// 状态管理
// ============================================================

const _customState = {
  // 游戏阶段: 'welcome' | 'playing' | 'wishing' | 'celebrating'
  gameStage: 'welcome',
  // 寿星姓名
  birthdayPersonName: '',
  // 送祝福人姓名
  senderName: '',
  // 祝福语
  blessingMessage: '',
  // 蜡烛数量 (5-10随机)
  totalCandles: 0,
  // 已熄灭的蜡烛索引数组
  extinguishedCandles: [],
  // 倒计时剩余秒数
  countdownSeconds: 15,
  // 游戏是否超时
  isTimeout: false,
  // 彩带动画触发器
  confettiTrigger: 0,
  // 麦克风权限状态
  micPermission: 'prompt', // 'prompt' | 'granted' | 'denied'
  // 音频分析器
  audioAnalyser: null,
  // 音频上下文
  audioContext: null,
  // 麦克风流
  micStream: null,
  // 检测吹气的定时器
  blowDetectionInterval: null,
};

/**
 * 获取状态
 */
export function getCustomState(key) {
  if (key) {
    return _customState[key];
  }
  return { ..._customState };
}

/**
 * 设置状态（合并更新，自动触发重新渲染）
 */
export function setCustomState(newState) {
  Object.keys(newState).forEach(function(key) {
    _customState[key] = newState[key];
  });
  this.forceUpdate();
}

/**
 * 强制重新渲染
 */
export function forceUpdate() {
  this.setState({ timestamp: new Date().getTime() });
}

// ============================================================
// 生命周期
// ============================================================

export function didMount() {
  // 初始化随机蜡烛数量
  var randomCandles = Math.floor(Math.random() * 6) + 5; // 5-10
  _customState.totalCandles = randomCandles;
  this.forceUpdate();
}

export function didUnmount() {
  // 清理定时器
  this.stopCountdown();
  this.stopBlowDetection();
  // 停止麦克风
  if (_customState.micStream) {
    _customState.micStream.getTracks().forEach(function(track) {
      track.stop();
    });
    _customState.micStream = null;
  }
  if (_customState.audioContext) {
    _customState.audioContext.close();
    _customState.audioContext = null;
  }
}

// ============================================================
// 游戏逻辑方法
// ============================================================

/**
 * 开始游戏
 */
export function startGame() {
  var nameInput = document.getElementById('birthday-person-input');
  var senderInput = document.getElementById('sender-name-input');
  
  var name = nameInput ? nameInput.value.trim() : '';
  var sender = senderInput ? senderInput.value.trim() : '';
  
  if (!name) {
    this.utils.toast({ title: '请输入寿星姓名', type: 'error' });
    return;
  }
  
  _customState.birthdayPersonName = name;
  _customState.senderName = sender || window.loginUser.userName || '神秘好友';
  _customState.gameStage = 'playing';
  _customState.extinguishedCandles = [];
  _customState.countdownSeconds = 15;
  _customState.isTimeout = false;
  
  this.setCustomState({
    gameStage: 'playing',
    birthdayPersonName: name,
    senderName: _customState.senderName,
    extinguishedCandles: [],
    countdownSeconds: 15,
    isTimeout: false
  });
  
  // 启动倒计时
  this.startCountdown();
  // 请求麦克风权限并开始检测吹气
  this.requestMicrophone();
}

/**
 * 启动倒计时
 */
export function startCountdown() {
  this.stopCountdown();
  _customState.countdownTimer = setInterval(function() {
    var current = _customState.countdownSeconds - 1;
    _customState.countdownSeconds = current;
    
    if (current <= 0) {
      this.handleTimeout();
    } else {
      this.forceUpdate();
    }
  }.bind(this), 1000);
}

/**
 * 停止倒计时
 */
export function stopCountdown() {
  if (_customState.countdownTimer) {
    clearInterval(_customState.countdownTimer);
    _customState.countdownTimer = null;
  }
}

/**
 * 处理超时
 */
export function handleTimeout() {
  this.stopCountdown();
  _customState.isTimeout = true;
  this.setCustomState({ isTimeout: true });
}

/**
 * 重试游戏
 */
export function retryGame() {
  _customState.extinguishedCandles = [];
  _customState.countdownSeconds = 15;
  _customState.isTimeout = false;
  _customState.totalCandles = Math.floor(Math.random() * 6) + 5;
  
  this.setCustomState({
    extinguishedCandles: [],
    countdownSeconds: 15,
    isTimeout: false,
    totalCandles: _customState.totalCandles
  });
  
  this.startCountdown();
}

/**
 * 熄灭蜡烛（通过点击或吹气）
 */
export function extinguishCandle(candleIndex) {
  var alreadyExtinguished = _customState.extinguishedCandles.indexOf(candleIndex) !== -1;
  
  if (alreadyExtinguished || _customState.isTimeout) {
    return;
  }
  
  var newExtinguished = _customState.extinguishedCandles.concat([candleIndex]);
  _customState.extinguishedCandles = newExtinguished;
  
  // 检查是否全部熄灭
  if (newExtinguished.length >= _customState.totalCandles) {
    this.stopCountdown();
    this.stopBlowDetection();
    setTimeout(function() {
      _customState.gameStage = 'wishing';
      this.setCustomState({ gameStage: 'wishing' });
    }.bind(this), 500);
  } else {
    this.forceUpdate();
  }
}

/**
 * 请求麦克风权限
 */
export function requestMicrophone() {
  var self = this;
  navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
    _customState.micStream = stream;
    _customState.micPermission = 'granted';
    
    // 创建音频上下文和分析器
    var audioContext = new (window.AudioContext || window.webkitAudioContext)();
    var analyser = audioContext.createAnalyser();
    var microphone = audioContext.createMediaStreamSource(stream);
    
    analyser.fftSize = 256;
    microphone.connect(analyser);
    
    _customState.audioContext = audioContext;
    _customState.audioAnalyser = analyser;
    
    // 开始检测吹气
    self.startBlowDetection();
  }).catch(function(err) {
    _customState.micPermission = 'denied';
    // 即使麦克风失败，用户仍可以点击蜡烛
  });
}

/**
 * 开始检测吹气
 */
export function startBlowDetection() {
  this.stopBlowDetection();
  var dataArray = new Uint8Array(_customState.audioAnalyser.frequencyBinCount);
  var lastBlowTime = 0;
  var blowCooldown = 800; // 吹气冷却时间(ms)
  
  _customState.blowDetectionInterval = setInterval(function() {
    if (!_customState.audioAnalyser || _customState.gameStage !== 'playing') {
      return;
    }
    
    _customState.audioAnalyser.getByteFrequencyData(dataArray);
    
    // 计算平均音量
    var sum = 0;
    for (var i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    var average = sum / dataArray.length;
    
    // 检测吹气（音量阈值设为30）
    var now = Date.now();
    if (average > 30 && now - lastBlowTime > blowCooldown) {
      lastBlowTime = now;
      
      // 找到第一个未熄灭的蜡烛并熄灭它
      for (var j = 0; j < _customState.totalCandles; j++) {
        if (_customState.extinguishedCandles.indexOf(j) === -1) {
          this.extinguishCandle(j);
          break;
        }
      }
    }
  }.bind(this), 100);
}

/**
 * 停止检测吹气
 */
export function stopBlowDetection() {
  if (_customState.blowDetectionInterval) {
    clearInterval(_customState.blowDetectionInterval);
    _customState.blowDetectionInterval = null;
  }
}

/**
 * 提交祝福
 */
export function submitBlessing() {
  var blessingInput = document.getElementById('blessing-input');
  var message = blessingInput ? blessingInput.value.trim() : '';
  
  if (!message) {
    this.utils.toast({ title: '请输入祝福语', type: 'error' });
    return;
  }
  
  _customState.blessingMessage = message;
  _customState.gameStage = 'celebrating';
  _customState.confettiTrigger = Date.now();
  
  this.setCustomState({
    blessingMessage: message,
    gameStage: 'celebrating',
    confettiTrigger: Date.now()
  });
}

/**
 * 重新开始
 */
export function restartGame() {
  _customState.gameStage = 'welcome';
  _customState.birthdayPersonName = '';
  _customState.senderName = '';
  _customState.blessingMessage = '';
  _customState.extinguishedCandles = [];
  _customState.countdownSeconds = 15;
  _customState.isTimeout = false;
  _customState.totalCandles = Math.floor(Math.random() * 6) + 5;
  
  // 清空输入框
  var nameInput = document.getElementById('birthday-person-input');
  var senderInput = document.getElementById('sender-name-input');
  var blessingInput = document.getElementById('blessing-input');
  
  if (nameInput) nameInput.value = '';
  if (senderInput) senderInput.value = '';
  if (blessingInput) blessingInput.value = '';
  
  this.setCustomState({
    gameStage: 'welcome',
    birthdayPersonName: '',
    senderName: '',
    blessingMessage: '',
    extinguishedCandles: [],
    countdownSeconds: 15,
    isTimeout: false,
    totalCandles: _customState.totalCandles
  });
}

// ============================================================
// 样式（提取到模块顶层，供各渲染函数共享）
// ============================================================

var GAME_STYLES = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    position: 'relative',
    overflow: 'hidden'
  },
  card: {
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '24px',
    padding: '40px',
    maxWidth: '480px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    textAlign: 'center',
    position: 'relative',
    zIndex: 10
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#764ba2',
    marginBottom: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px'
  },
  subtitle: {
    fontSize: '16px',
    color: '#666',
    marginBottom: '30px'
  },
  input: {
    width: '100%',
    padding: '15px 20px',
    fontSize: '16px',
    border: '2px solid #e0e0e0',
    borderRadius: '12px',
    marginBottom: '20px',
    outline: 'none',
    transition: 'border-color 0.3s',
    boxSizing: 'border-box'
  },
  button: {
    width: '100%',
    padding: '16px 32px',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#fff',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    marginTop: '10px'
  },
  cakeContainer: {
    position: 'relative',
    margin: '30px 0'
  },
  cake: {
    fontSize: '120px',
    lineHeight: '1'
  },
  candlesRow: {
    position: 'absolute',
    top: '-20px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '8px',
    justifyContent: 'center'
  },
  candle: {
    fontSize: '28px',
    cursor: 'pointer',
    transition: 'transform 0.2s, opacity 0.3s',
    userSelect: 'none'
  },
  candleLit: {
    animation: 'flicker 0.5s infinite alternate'
  },
  candleExtinguished: {
    opacity: 0.5,
    transform: 'scale(0.9)'
  },
  countdown: {
    fontSize: '48px',
    fontWeight: 'bold',
    color: '#e74c3c',
    margin: '20px 0'
  },
  progressBar: {
    width: '100%',
    height: '8px',
    background: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '20px'
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #667eea, #764ba2)',
    transition: 'width 0.3s ease'
  },
  textarea: {
    width: '100%',
    padding: '15px 20px',
    fontSize: '16px',
    border: '2px solid #e0e0e0',
    borderRadius: '12px',
    minHeight: '100px',
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  },
  blessingCard: {
    background: 'linear-gradient(135deg, #ffeaa7 0%, #fab1a0 50%, #fd79a8 100%)',
    borderRadius: '20px',
    padding: '40px',
    color: '#fff',
    textShadow: '0 2px 4px rgba(0,0,0,0.2)'
  },
  blessingTitle: {
    fontSize: '36px',
    fontWeight: 'bold',
    marginBottom: '20px'
  },
  blessingText: {
    fontSize: '24px',
    lineHeight: '1.6',
    marginBottom: '30px',
    fontStyle: 'italic'
  },
  blessingFrom: {
    fontSize: '16px',
    opacity: 0.9
  },
  confetti: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 100
  },
  micHint: {
    fontSize: '14px',
    color: '#888',
    marginTop: '15px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px'
  },
  timeoutOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    borderRadius: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    zIndex: 20
  },
  star: {
    position: 'absolute',
    color: '#ffd700',
    fontSize: '20px',
    animation: 'twinkle 1s infinite'
  }
};

// ============================================================
// 子渲染函数（export function，this 正确绑定）
// ============================================================

/**
 * 渲染蜡烛列表
 */
export function renderCandles() {
  var state = this.getCustomState();
  var candles = [];
  for (var i = 0; i < state.totalCandles; i++) {
    // 用立即执行函数捕获循环变量 i，避免闭包陷阱
    candles.push((function(candleIndex) {
      var isExtinguished = state.extinguishedCandles.indexOf(candleIndex) !== -1;
      return (
        <span
          key={candleIndex}
          style={Object.assign({}, GAME_STYLES.candle, isExtinguished ? GAME_STYLES.candleExtinguished : GAME_STYLES.candleLit)}
          onClick={(e) => { this.extinguishCandle(candleIndex); }}
        >
          {isExtinguished ? '💨' : '🕯️'}
        </span>
      );
    }).call(this, i));
  }
  return candles;
}

/**
 * 渲染星星装饰（庆祝阶段）
 */
export function renderStars() {
  var state = this.getCustomState();
  if (state.gameStage !== 'celebrating') return null;
  var stars = [];
  for (var i = 0; i < 20; i++) {
    var starLeft = Math.random() * 100;
    var starTop = Math.random() * 100;
    var starDelay = Math.random() * 2;
    stars.push(
      <span
        key={i}
        style={Object.assign({}, GAME_STYLES.star, {
          left: starLeft + '%',
          top: starTop + '%',
          animationDelay: starDelay + 's'
        })}
      >
        ✨
      </span>
    );
  }
  return stars;
}

/**
 * 渲染欢迎界面
 */
export function renderWelcome() {
  return (
    <div style={GAME_STYLES.card}>
      <div style={GAME_STYLES.title}>
        🎂 生日祝福
      </div>
      <div style={GAME_STYLES.subtitle}>
        为TA点燃蜡烛，送上最真挚的祝福
      </div>

      <input
        id="birthday-person-input"
        type="text"
        placeholder="请输入寿星姓名"
        style={GAME_STYLES.input}
        defaultValue=""
      />

      <input
        id="sender-name-input"
        type="text"
        placeholder="请输入您的姓名（选填）"
        style={GAME_STYLES.input}
        defaultValue=""
      />

      <button
        style={GAME_STYLES.button}
        onMouseEnter={function(e) {
          e.target.style.transform = 'translateY(-2px)';
          e.target.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.4)';
        }}
        onMouseLeave={function(e) {
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = 'none';
        }}
        onClick={(e) => { this.startGame(); }}
      >
        🎉 开始游戏
      </button>

      <div style={GAME_STYLES.micHint}>
        🎤 支持吹灭蜡烛哦~
      </div>
    </div>
  );
}

/**
 * 渲染游戏界面
 */
export function renderPlaying() {
  var state = this.getCustomState();
  var progressPercent = (state.extinguishedCandles.length / state.totalCandles) * 100;

  return (
    <div style={GAME_STYLES.card}>
      <div style={GAME_STYLES.title}>
        🎂 点蜡烛
      </div>

      <div style={GAME_STYLES.progressBar}>
        <div style={Object.assign({}, GAME_STYLES.progressFill, { width: progressPercent + '%' })}></div>
      </div>

      <div style={GAME_STYLES.countdown}>
        {state.countdownSeconds}s
      </div>

      <div style={GAME_STYLES.cakeContainer}>
        <div style={GAME_STYLES.candlesRow}>
          {this.renderCandles()}
        </div>
        <div style={GAME_STYLES.cake}>🎂</div>
      </div>

      <div style={GAME_STYLES.subtitle}>
        {state.micPermission === 'denied'
          ? '👆 点击蜡烛将其熄灭'
          : '吹气或点击蜡烛'}
      </div>

      <div style={GAME_STYLES.subtitle}>
        已熄灭 {state.extinguishedCandles.length} / {state.totalCandles} 根蜡烛
      </div>

      {state.isTimeout && (
        <div style={GAME_STYLES.timeoutOverlay}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏰</div>
          <div style={{ fontSize: '24px', marginBottom: '20px' }}>时间到！</div>
          <button
            style={Object.assign({}, GAME_STYLES.button, { width: 'auto', padding: '12px 30px' })}
            onClick={(e) => { this.retryGame(); }}
          >
            🔄 再试一次
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 渲染许愿界面
 */
export function renderWishing() {
  var state = this.getCustomState();

  return (
    <div style={GAME_STYLES.card}>
      <div style={GAME_STYLES.title}>
        ⭐ 许愿时刻
      </div>

      <div style={{ fontSize: '64px', marginBottom: '20px' }}>✨</div>

      <div style={GAME_STYLES.subtitle}>
        所有蜡烛已熄灭！请为 {state.birthdayPersonName} 送上祝福
      </div>

      <textarea
        id="blessing-input"
        placeholder="写下你的生日祝福..."
        style={GAME_STYLES.textarea}
        defaultValue=""
      ></textarea>

      <button
        style={GAME_STYLES.button}
        onClick={(e) => { this.submitBlessing(); }}
      >
        💝 送出祝福
      </button>
    </div>
  );
}

/**
 * 渲染庆祝界面
 */
export function renderCelebrating() {
  var state = this.getCustomState();

  return (
    <div style={Object.assign({}, GAME_STYLES.card, GAME_STYLES.blessingCard)}>
      {this.renderStars()}

      <div style={GAME_STYLES.blessingTitle}>
        🎉 生日快乐
      </div>

      <div style={{ fontSize: '72px', marginBottom: '20px' }}>
        🎂
      </div>

      <div style={{ fontSize: '28px', marginBottom: '10px' }}>
        亲爱的 {state.birthdayPersonName}
      </div>

      <div style={GAME_STYLES.blessingText}>
        "{state.blessingMessage}"
      </div>

      <div style={GAME_STYLES.blessingFrom}>
        —— {state.senderName} 敬上
      </div>

      <button
        style={Object.assign({}, GAME_STYLES.button, {
          marginTop: '30px',
          background: 'rgba(255,255,255,0.3)',
          backdropFilter: 'blur(10px)'
        })}
        onClick={(e) => { this.restartGame(); }}
      >
        🎮 再玩一次
      </button>
    </div>
  );
}

// ============================================================
// 渲染
// ============================================================

export function renderJsx() {
  var state = this.getCustomState();
  var timestamp = this.state.timestamp;

  var currentStage;
  switch (state.gameStage) {
    case 'playing':
      currentStage = this.renderPlaying();
      break;
    case 'wishing':
      currentStage = this.renderWishing();
      break;
    case 'celebrating':
      currentStage = this.renderCelebrating();
      break;
    default:
      currentStage = this.renderWelcome();
  }

  return (
    <div style={GAME_STYLES.container}>
      {/* 用于触发重新渲染 */}
      <div style={{ display: 'none' }}>{timestamp}</div>

      {/* CSS 动画 */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes flicker {
          0% { transform: scale(1) rotate(-2deg); }
          100% { transform: scale(1.1) rotate(2deg); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        @keyframes fall {
          0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}} />

      {/* 彩带效果 */}
      {state.gameStage === 'celebrating' && (
        <canvas
          id="confetti-canvas"
          style={GAME_STYLES.confetti}
        />
      )}

      {currentStage}
    </div>
  );
}
