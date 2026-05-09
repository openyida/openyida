// ══════════════════════════════════════════════════════════════
// OpenYida PPT 演示 — 包含数字键翻页、导航隐藏、全屏、中英文切换
// ══════════════════════════════════════════════════════════════

// ── 国际化文案 ──────────────────────────────────────────────
var I18N = {
  zh: {
    prev: '← 上一页',
    next: '下一页 →',
    pageOf: function(c, t) { return c + ' / ' + t; },
    fullscreen: '全屏',
    exitFullscreen: '退出全屏',
    darkMode: '深色',
    lightMode: '浅色',
    langSwitch: 'EN',
  },
  en: {
    prev: '← Prev',
    next: 'Next →',
    pageOf: function(c, t) { return c + ' / ' + t; },
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit Fullscreen',
    darkMode: 'Dark',
    lightMode: 'Light',
    langSwitch: '中',
  },
};

// ── 幻灯片数据 ──────────────────────────────────────────────
var SLIDES = [
  {
    type: 'cover',
    bg: '#1a1a2e', bgLight: '#ffffff',
    accent: '#0089ff',
    eyebrow: '2026 技术分享',
    title: 'OpenYida 2.0',
    subtitle: 'AI 驱动的低代码开发平台',
    tags: ['AI 原生', '低代码', '企业级'],
  },
  {
    type: 'toc',
    bg: '#1a1a2e', bgLight: '#ffffff',
    accent: '#0089ff',
    title: '目录 / Agenda',
    items: [
      '核心能力 Core Features',
      '应用场景 Use Cases',
      '技术架构 Architecture',
      '快速上手 Quick Start',
    ],
  },
  {
    type: 'chapter',
    bg: '#16213e', bgLight: '#f0f7ff',
    accent: '#0089ff',
    partNum: '01',
    title: '核心能力',
    subtitle: 'Core Features',
    desc: 'AI 对话驱动，一句话生成完整应用',
  },
  {
    type: 'key-points',
    bg: '#1a1a2e', bgLight: '#ffffff',
    accent: '#0089ff',
    chapter: '01 核心能力',
    title: 'AI 对话驱动开发',
    subtitle: '从需求到上线，最快 5 分钟',
    points: [
      { icon: '🤖', title: 'AI 表单设计', desc: '描述需求，自动生成字段结构' },
      { icon: '⚡', title: '秒级发布', desc: '编译 + 发布一键完成' },
      { icon: '🔗', title: '全流程覆盖', desc: '创建 → 配置 → 发布 → 数据管理' },
      { icon: '🌐', title: '多语言支持', desc: '中英日韩等 12 种语言' },
    ],
  },
  {
    type: 'chapter',
    bg: '#16213e', bgLight: '#f0f7ff',
    accent: '#0089ff',
    partNum: '02',
    title: '应用场景',
    subtitle: 'Use Cases',
    desc: '覆盖企业数字化的各类场景',
  },
  {
    type: 'key-points',
    bg: '#1a1a2e', bgLight: '#ffffff',
    accent: '#0089ff',
    chapter: '02 应用场景',
    title: '典型应用',
    subtitle: '从 CRM 到项目管理，一站式搞定',
    points: [
      { icon: '📊', title: 'CRM 客户管理', desc: '客户跟进、商机管理、数据看板' },
      { icon: '📋', title: '项目管理', desc: '任务分配、进度追踪、甘特图' },
      { icon: '💰', title: '财务报销', desc: '费用申请、审批流程、报表分析' },
      { icon: '🏭', title: '生产管理', desc: '工单管理、质量检测、产能分析' },
    ],
  },
  {
    type: 'chapter',
    bg: '#16213e', bgLight: '#f0f7ff',
    accent: '#0089ff',
    partNum: '03',
    title: '技术架构',
    subtitle: 'Architecture',
    desc: 'CLI + 宜搭 API + AI 的三层架构',
  },
  {
    type: 'key-points',
    bg: '#1a1a2e', bgLight: '#ffffff',
    accent: '#0089ff',
    chapter: '03 技术架构',
    title: '三层架构',
    subtitle: 'CLI → API → Platform',
    points: [
      { icon: '🖥️', title: 'CLI 层', desc: 'openyida 命令行工具，Node.js 实现' },
      { icon: '🔌', title: 'API 层', desc: '宜搭 OpenAPI，RESTful 接口' },
      { icon: '☁️', title: '平台层', desc: '宜搭低代码平台，阿里云基础设施' },
    ],
  },
  {
    type: 'chapter',
    bg: '#16213e', bgLight: '#f0f7ff',
    accent: '#0089ff',
    partNum: '04',
    title: '快速上手',
    subtitle: 'Quick Start',
    desc: '三步开始你的低代码之旅',
  },
  {
    type: 'key-points',
    bg: '#1a1a2e', bgLight: '#ffffff',
    accent: '#0089ff',
    chapter: '04 快速上手',
    title: '三步上手',
    subtitle: '安装 → 登录 → 创建',
    points: [
      { icon: '1️⃣', title: '安装', desc: 'npm install -g openyida' },
      { icon: '2️⃣', title: '登录', desc: 'openyida login（扫码登录）' },
      { icon: '3️⃣', title: '创建', desc: 'openyida create-app "我的应用"' },
    ],
  },
  {
    type: 'echarts-race',
    bg: '#1a1a2e', bgLight: '#ffffff',
    accent: '#0089ff',
    chapter: '附录',
    title: '中国历代经济全球排名',
    subtitle: 'GDP 占全球比重变迁（公元前 2000 年 — 2025 年）',
  },
  {
    type: 'ending',
    bg: '#0089ff', bgLight: '#0089ff',
    accent: '#ffffff',
    title: '立即体验 OpenYida',
    subtitle: 'npm install -g openyida',
    quote: '让 AI 成为你的低代码开发伙伴',
  },
];

// ── 状态管理 ────────────────────────────────────────────────
var _customState = {
  currentIndex: 0,
  navVisible: false,
  isFullscreen: false,
  darkMode: true,
  lang: 'zh',
  numBuffer: '',
  numTimer: null,
  echartsLoaded: false,
  echartsInstance: null,
  raceTimer: null,
  raceIndex: 0,
  raceFinished: false,
  echartsInitTimer: null,
};

// ── 中国历代经济全球排名数据（GDP 估算，单位：亿 1990 国际元）──
// 数据来源参考：Angus Maddison 历史统计、世界银行
// 统一 8 个实体：中国(朝代)、印度、欧洲、中东、美国、日本、俄国、其他
// chinaLabel 字段控制中国柱子显示的朝代名
var RACE_ENTITIES = ['china', 'india', 'europe', 'mideast', 'usa', 'japan', 'russia', 'other'];
var RACE_LABELS = {
  china: '华夏', india: '印度', europe: '欧洲', mideast: '中东',
  usa: '美国', japan: '日本', russia: '俄国', other: '其他',
};
var RACE_KEYFRAMES = [
  { year: -2000, chinaLabel: '华夏',   values: [450, 350, 100, 400, 0, 0, 0, 200] },
  { year: -500,  chinaLabel: '春秋列国', values: [800, 600, 300, 650, 0, 0, 0, 400] },
  { year: -200,  chinaLabel: '大秦',   values: [1200, 700, 500, 400, 0, 0, 0, 600] },
  { year: 100,   chinaLabel: '大汉',   values: [1500, 800, 1100, 350, 0, 0, 0, 700] },
  { year: 600,   chinaLabel: '大隋',   values: [1600, 1100, 500, 450, 0, 50, 0, 800] },
  { year: 800,   chinaLabel: '大唐',   values: [2200, 1400, 600, 900, 0, 80, 0, 1000] },
  { year: 1000,  chinaLabel: '北宋',   values: [2650, 1600, 800, 700, 0, 120, 0, 1100] },
  { year: 1200,  chinaLabel: '南宋',   values: [2800, 1500, 1000, 600, 0, 150, 0, 1200] },
  { year: 1400,  chinaLabel: '大明',   values: [2500, 1800, 1400, 400, 0, 200, 0, 1300] },
  { year: 1600,  chinaLabel: '大明',   values: [3600, 2800, 2800, 350, 0, 350, 0, 1500] },
  { year: 1700,  chinaLabel: '大清',   values: [4100, 3600, 3500, 280, 0, 500, 0, 1600] },
  { year: 1820,  chinaLabel: '大清',   values: [5500, 2800, 3400, 250, 500, 600, 700, 1800] },
  { year: 1870,  chinaLabel: '大清',   values: [3800, 2600, 5500, 200, 3100, 700, 1400, 2200] },
  { year: 1913,  chinaLabel: '中华民国', values: [3200, 2500, 6800, 180, 5300, 1100, 2300, 2800] },
  { year: 1950,  chinaLabel: '新中国',  values: [2400, 2200, 5800, 300, 9600, 1100, 3100, 3200] },
  { year: 1978,  chinaLabel: '中国',   values: [3500, 2800, 8200, 800, 12000, 5500, 4800, 4500] },
  { year: 2001,  chinaLabel: '中国',   values: [8200, 4200, 12000, 1500, 19000, 6800, 3200, 7000] },
  { year: 2010,  chinaLabel: '中国',   values: [14000, 6500, 14000, 2000, 21000, 5800, 4200, 9000] },
  { year: 2020,  chinaLabel: '中国',   values: [24000, 9500, 15000, 2500, 22000, 5200, 4500, 12000] },
  { year: 2025,  chinaLabel: '中国',   values: [28000, 11000, 15500, 2800, 23000, 4800, 4200, 13000] },
];

// ── 幻灯片内容渲染 ──────────────────────────────────────────
function renderSlideContent(slide, accent, isMobile) {
  var type = slide.type;
  var isDark = slide.bg !== '#ffffff' && slide.bg !== '#f0f7ff';
  var textColor = isDark ? '#ffffff' : '#1a1a2e';
  var subColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(26,26,46,0.6)';

  if (type === 'cover') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: 'center', height: '100%', textAlign: 'center',
        padding: isMobile ? '40px 20px' : '60px 80px',
      }}>
        {slide.eyebrow && (
          <div style={{
            fontSize: isMobile ? '13px' : '15px', fontWeight: 600,
            color: accent, letterSpacing: '2px', textTransform: 'uppercase',
            marginBottom: '20px',
          }}>
            {slide.eyebrow}
          </div>
        )}
        <h1 style={{
          fontSize: isMobile ? '36px' : '64px', fontWeight: 900,
          color: textColor, lineHeight: 1.1, margin: '0 0 16px 0',
        }}>
          {slide.title}
        </h1>
        {slide.subtitle && (
          <p style={{
            fontSize: isMobile ? '18px' : '28px', color: subColor,
            margin: '0 0 32px 0', fontWeight: 300,
          }}>
            {slide.subtitle}
          </p>
        )}
        {slide.tags && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {slide.tags.map(function(tag, idx) {
              return (
                <span key={idx} style={{
                  padding: '6px 16px', borderRadius: '20px', fontSize: '13px',
                  fontWeight: 600, background: accent + '15', color: accent,
                }}>
                  {tag}
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (type === 'toc') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        height: '100%', padding: isMobile ? '40px 24px' : '60px 120px',
      }}>
        <h2 style={{
          fontSize: isMobile ? '28px' : '42px', fontWeight: 800,
          color: textColor, marginBottom: '40px',
        }}>
          {slide.title}
        </h2>
        {slide.items && slide.items.map(function(item, idx) {
          return (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: '16px',
              padding: '16px 0',
              borderBottom: idx < slide.items.length - 1 ? '1px solid rgba(26,26,46,0.08)' : 'none',
            }}>
              <span style={{
                fontSize: isMobile ? '20px' : '28px', fontWeight: 800,
                color: accent, minWidth: '40px',
              }}>
                {'0' + (idx + 1)}
              </span>
              <span style={{
                fontSize: isMobile ? '16px' : '22px', color: textColor, fontWeight: 500,
              }}>
                {item}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  if (type === 'chapter') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: 'center', height: '100%', textAlign: 'center',
        padding: isMobile ? '40px 24px' : '60px 80px',
      }}>
        <div style={{
          fontSize: isMobile ? '48px' : '80px', fontWeight: 900,
          color: accent, opacity: 0.15, marginBottom: '-20px',
        }}>
          {slide.partNum}
        </div>
        <h2 style={{
          fontSize: isMobile ? '32px' : '52px', fontWeight: 800,
          color: textColor, margin: '0 0 8px 0',
        }}>
          {slide.title}
        </h2>
        {slide.subtitle && (
          <p style={{
            fontSize: isMobile ? '16px' : '22px', color: subColor,
            margin: '0 0 16px 0', fontWeight: 300,
          }}>
            {slide.subtitle}
          </p>
        )}
        {slide.desc && (
          <p style={{
            fontSize: isMobile ? '14px' : '18px', color: subColor,
            margin: 0, maxWidth: '600px',
          }}>
            {slide.desc}
          </p>
        )}
      </div>
    );
  }

  if (type === 'key-points') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        height: '100%', padding: isMobile ? '40px 20px' : '48px 80px',
      }}>
        {slide.chapter && (
          <div style={{
            fontSize: '13px', fontWeight: 600, color: accent,
            letterSpacing: '1px', marginBottom: '8px',
          }}>
            {slide.chapter}
          </div>
        )}
        <h2 style={{
          fontSize: isMobile ? '24px' : '38px', fontWeight: 800,
          color: textColor, margin: '0 0 6px 0',
        }}>
          {slide.title}
        </h2>
        {slide.subtitle && (
          <p style={{
            fontSize: isMobile ? '14px' : '18px', color: subColor,
            margin: '0 0 32px 0',
          }}>
            {slide.subtitle}
          </p>
        )}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(' + Math.min(slide.points.length, 4) + ', 1fr)',
          gap: isMobile ? '16px' : '24px',
        }}>
          {slide.points.map(function(point, idx) {
            return (
              <div key={idx} style={{
                padding: isMobile ? '16px' : '24px',
                borderRadius: '12px',
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(26,26,46,0.02)',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(26,26,46,0.06)',
              }}>
                <div style={{ fontSize: '28px', marginBottom: '12px' }}>{point.icon}</div>
                <div style={{
                  fontSize: isMobile ? '15px' : '17px', fontWeight: 700,
                  color: textColor, marginBottom: '6px',
                }}>
                  {point.title}
                </div>
                <div style={{
                  fontSize: isMobile ? '13px' : '14px', color: subColor, lineHeight: 1.5,
                }}>
                  {point.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (type === 'echarts-race') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: '100%', padding: isMobile ? '20px 12px' : '32px 60px',
      }}>
        {slide.chapter && (
          <div style={{
            fontSize: '13px', fontWeight: 600, color: accent,
            letterSpacing: '1px', marginBottom: '6px',
          }}>
            {slide.chapter}
          </div>
        )}
        <h2 style={{
          fontSize: isMobile ? '20px' : '32px', fontWeight: 800,
          color: textColor, margin: '0 0 4px 0',
        }}>
          {slide.title}
        </h2>
        {slide.subtitle && (
          <p style={{
            fontSize: isMobile ? '13px' : '16px', color: subColor,
            margin: '0 0 12px 0',
          }}>
            {slide.subtitle}
          </p>
        )}
        <div
          id="ppt-echarts-race"
          style={{
            flex: 1, width: '100%', minHeight: '300px',
            borderRadius: '12px',
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(26,26,46,0.02)',
          }}
        />
      </div>
    );
  }

  if (type === 'ending') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: 'center', height: '100%', textAlign: 'center',
        padding: isMobile ? '40px 24px' : '60px 80px',
      }}>
        <h1 style={{
          fontSize: isMobile ? '32px' : '56px', fontWeight: 900,
          color: textColor, margin: '0 0 16px 0',
        }}>
          {slide.title}
        </h1>
        {slide.subtitle && (
          <div style={{
            fontSize: isMobile ? '16px' : '22px', color: subColor,
            margin: '0 0 32px 0', fontFamily: 'monospace',
            padding: '12px 24px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.15)',
          }}>
            {slide.subtitle}
          </div>
        )}
        {slide.quote && (
          <p style={{
            fontSize: isMobile ? '14px' : '18px', color: subColor,
            fontStyle: 'italic', margin: 0,
          }}>
            "{slide.quote}"
          </p>
        )}
      </div>
    );
  }

  // 默认：简单标题 + 副标题
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      height: '100%', padding: isMobile ? '40px 20px' : '48px 80px',
    }}>
      <h2 style={{ fontSize: isMobile ? '24px' : '38px', fontWeight: 800, color: textColor }}>
        {slide.title}
      </h2>
      {slide.subtitle && (
        <p style={{ fontSize: isMobile ? '16px' : '22px', color: subColor }}>
          {slide.subtitle}
        </p>
      )}
    </div>
  );
}

// ── 生命周期 ────────────────────────────────────────────────
export function didMount() {
  var self = this;
  _customState.total = SLIDES.length;

  // ── 从 URL hash 读取初始页码（如 #3 跳到第 3 页）──
  var hash = window.location.hash;
  if (hash) {
    var pageNum = parseInt(hash.replace('#', ''), 10);
    if (pageNum >= 1 && pageNum <= SLIDES.length) {
      _customState.currentIndex = pageNum - 1;
    }
  }

  // ── 监听 hash 变化（浏览器前进/后退）──
  this._handleHashChange = function() {
    var h = window.location.hash;
    if (h) {
      var p = parseInt(h.replace('#', ''), 10);
      if (p >= 1 && p <= SLIDES.length && p - 1 !== _customState.currentIndex) {
        _customState.currentIndex = p - 1;
        self.forceUpdate();
      }
    }
  };
  window.addEventListener('hashchange', this._handleHashChange);

  // 键盘翻页（方向键 + 演讲笔 + 数字键快速跳页）
  this._handleKeyDown = function(e) {
    // ── 数字键快速跳页（300ms 延迟缓冲，支持双位数）──
    var digit = null;
    if (e.key >= '0' && e.key <= '9') {
      digit = e.key;
    }
    if (digit !== null) {
      if (_customState.numTimer) {
        clearTimeout(_customState.numTimer);
      }
      _customState.numBuffer += digit;
      _customState.numTimer = setTimeout(function() {
        var targetIndex = parseInt(_customState.numBuffer, 10) - 1;
        if (targetIndex >= 0 && targetIndex < SLIDES.length) {
          _customState.currentIndex = targetIndex;
          self.forceUpdate();
        }
        _customState.numBuffer = '';
        _customState.numTimer = null;
      }, 300);
      return;
    }

    // ── 方向键 / 演讲笔翻页 ──
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
      if (_customState.currentIndex < SLIDES.length - 1) {
        _customState.currentIndex++;
        self.forceUpdate();
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
      if (_customState.currentIndex > 0) {
        _customState.currentIndex--;
        self.forceUpdate();
      }
    }
  };
  document.addEventListener('keydown', this._handleKeyDown);

  // 触摸滑动（移动端）
  this._touchStartX = 0;
  this._handleTouchStart = function(e) {
    this._touchStartX = e.changedTouches[0].screenX;
  }.bind(this);
  this._handleTouchEnd = function(e) {
    var touchEndX = e.changedTouches[0].screenX;
    if (this._touchStartX - touchEndX > 50) {
      if (_customState.currentIndex < SLIDES.length - 1) {
        _customState.currentIndex++;
        self.forceUpdate();
      }
    }
    if (touchEndX - this._touchStartX > 50) {
      if (_customState.currentIndex > 0) {
        _customState.currentIndex--;
        self.forceUpdate();
      }
    }
  }.bind(this);
  document.addEventListener('touchstart', this._handleTouchStart);
  document.addEventListener('touchend', this._handleTouchEnd);

  // 鼠标移到底部显示导航栏
  this._handleMouseMove = function(e) {
    var isNearBottom = e.clientY > window.innerHeight - 80;
    if (isNearBottom !== _customState.navVisible) {
      _customState.navVisible = isNearBottom;
      self.forceUpdate();
    }
  };
  document.addEventListener('mousemove', this._handleMouseMove);

  // 全屏状态变化监听
  this._handleFullscreenChange = function() {
    _customState.isFullscreen = !!document.fullscreenElement;
    self.forceUpdate();
  };
  document.addEventListener('fullscreenchange', this._handleFullscreenChange);

  // ── 加载 ECharts CDN ──
  if (!window.echarts) {
    var script = document.createElement('script');
    script.src = 'https://g.alicdn.com/code/lib/echarts/5.6.0/echarts.min.js';
    script.onload = function() {
      _customState.echartsLoaded = true;
      _tryInitEchartsRace();
    };
    document.head.appendChild(script);
  } else {
    _customState.echartsLoaded = true;
  }
}

// ── ECharts 动态柱状图初始化 ────────────────────────────────
var _entityColors = {
  china: '#ff4444',
  india: '#4d96ff',
  europe: '#9b59b6',
  mideast: '#6bcb77',
  usa: '#4d96ff',
  japan: '#ffd93d',
  russia: '#6bcb77',
  other: '#95a5a6',
};

function _tryInitEchartsRace() {
  if (!_customState.echartsLoaded || !window.echarts) return;
  var currentSlide = SLIDES[_customState.currentIndex];
  if (!currentSlide || currentSlide.type !== 'echarts-race') {
    _destroyEchartsRace();
    return;
  }
  var dom = document.getElementById('ppt-echarts-race');
  if (!dom) return;
  if (_customState.echartsInstance) return;

  var isDark = _customState.darkMode;
  var chart = window.echarts.init(dom, isDark ? 'dark' : null);
  _customState.echartsInstance = chart;
  _customState.raceIndex = 0;
  _customState.raceYearTimer = null;

  // 渲染首帧并立即开始动画
  _renderRaceFrame(chart, 0, RACE_KEYFRAMES[0].values, RACE_KEYFRAMES[0].chinaLabel, RACE_KEYFRAMES[0].year, isDark);
  _advanceRaceSegment(chart);
}

// 推进到下一段（两个关键帧之间逐帧插值）
function _advanceRaceSegment(chart) {
  var fromIdx = _customState.raceIndex;
  var toIdx = fromIdx + 1;
  if (toIdx >= RACE_KEYFRAMES.length) {
    // 播放完毕，在图表中央显示重播按钮
    _customState.raceFinished = true;
    _showReplayButton(chart);
    return;
  }

  var fromKf = RACE_KEYFRAMES[fromIdx];
  var toKf = RACE_KEYFRAMES[toIdx];
  var fromYear = fromKf.year;
  var toYear = toKf.year;
  var totalFrames = 30;
  var frame = 0;

  _customState.raceYearTimer = setInterval(function() {
    // 防御：chart 已被销毁时立即停止
    if (!_customState.echartsInstance || _customState.echartsInstance !== chart) {
      clearInterval(_customState.raceYearTimer);
      _customState.raceYearTimer = null;
      return;
    }
    frame++;
    var progress = frame / totalFrames;
    // 线性插值每个实体的数值
    var interpolated = [];
    for (var i = 0; i < RACE_ENTITIES.length; i++) {
      interpolated.push(Math.round(fromKf.values[i] + (toKf.values[i] - fromKf.values[i]) * progress));
    }
    // 插值年份
    var currentYear = Math.round(fromYear + (toYear - fromYear) * progress);
    // 朝代名：后半段切换到目标朝代
    var chinaLabel = progress < 0.5 ? fromKf.chinaLabel : toKf.chinaLabel;

    _renderRaceFrame(chart, toIdx, interpolated, chinaLabel, currentYear, _customState.darkMode);

    if (frame >= totalFrames) {
      clearInterval(_customState.raceYearTimer);
      _customState.raceYearTimer = null;
      _customState.raceIndex = toIdx;
      // 立即开始下一段，无停顿
      _advanceRaceSegment(chart);
    }
  }, 80);
}

// 格式化数值显示（如 28000 → 2.8万）
function _formatGdpValue(value) {
  if (value >= 10000) return (value / 10000).toFixed(1) + '万';
  if (value >= 1000) return (value / 1000).toFixed(1) + '千';
  return '' + value;
}

// 渲染一帧
function _renderRaceFrame(chart, keyframeIdx, values, chinaLabel, displayYear, isDark) {
  // 构建 {name, value, color, entity} 数组
  var pairs = [];
  for (var i = 0; i < RACE_ENTITIES.length; i++) {
    var entity = RACE_ENTITIES[i];
    var label = entity === 'china' ? chinaLabel : RACE_LABELS[entity];
    pairs.push({
      name: label,
      value: values[i],
      color: _entityColors[entity],
      entity: entity,
    });
  }
  // 按值排序（小的在下，大的在上）
  pairs = _.sortBy(pairs, 'value');

  var categories = [];
  var barData = [];
  for (var j = 0; j < pairs.length; j++) {
    categories.push(pairs[j].name);
    barData.push({
      value: pairs[j].value,
      itemStyle: { color: pairs[j].color, borderRadius: [0, 6, 6, 0] },
    });
  }

  // 年份显示
  var yearText = displayYear < 0 ? ('BC ' + Math.abs(displayYear)) : ('' + displayYear);
  var titleText = displayYear < 0
    ? ('公元前 ' + Math.abs(displayYear) + ' 年 · ' + chinaLabel)
    : ('公元 ' + displayYear + ' 年 · ' + chinaLabel);

  // 底部时间轴
  var timelineElements = _buildTimelineGraphic(chart, keyframeIdx, isDark);

  // 动态计算 xAxis max（取当前最大值的 1.3 倍，至少 500）
  var maxVal = 500;
  for (var m = 0; m < values.length; m++) {
    if (values[m] > maxVal) maxVal = values[m];
  }
  maxVal = Math.ceil(maxVal * 1.3 / 1000) * 1000;

  var option = {
    backgroundColor: 'transparent',
    title: {
      text: titleText,
      left: 'center',
      top: 6,
      textStyle: { fontSize: 18, fontWeight: 800, color: isDark ? '#ffffff' : '#1a1a2e' },
    },
    graphic: {
      elements: [{
        type: 'text',
        right: 30,
        bottom: 55,
        style: {
          text: yearText,
          fontSize: 90,
          fontWeight: 900,
          fill: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.04)',
          textAlign: 'right',
        },
        z: 1,
      }].concat(timelineElements),
    },
    grid: { left: '12%', right: '15%', top: 45, bottom: '16%' },
    xAxis: {
      type: 'value',
      max: maxVal,
      axisLabel: {
        formatter: function(v) { return _formatGdpValue(v); },
        color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,26,46,0.5)',
        fontSize: 11,
      },
      splitLine: {
        lineStyle: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.06)' },
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'category',
      data: categories,
      inverse: false,
      axisLabel: { fontSize: 13, fontWeight: 600, color: isDark ? '#ffffff' : '#1a1a2e' },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [{
      type: 'bar',
      data: barData,
      barWidth: '55%',
      label: {
        show: true,
        position: 'right',
        formatter: function(params) { return _formatGdpValue(params.value); },
        fontSize: 12,
        fontWeight: 700,
        color: isDark ? '#ffffff' : '#1a1a2e',
      },
    }],
    animationDuration: 0,
    animationDurationUpdate: 80,
    animationEasing: 'linear',
    animationEasingUpdate: 'linear',
  };

  chart.setOption(option, true);
}

// 构建底部时间轴 graphic 元素
function _buildTimelineGraphic(chart, activeIdx, isDark) {
  var nodes = [];
  var totalNodes = RACE_KEYFRAMES.length;
  var chartWidth = chart.getWidth() || 800;

  // 底线
  nodes.push({
    type: 'line',
    position: ['10%', '93%'],
    shape: { x1: 0, y1: 0, x2: chartWidth * 0.8, y2: 0 },
    style: { stroke: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.08)', lineWidth: 2 },
    z: 5,
  });
  // 进度线
  var progressX = totalNodes > 1 ? (activeIdx / (totalNodes - 1)) * chartWidth * 0.8 : 0;
  nodes.push({
    type: 'line',
    position: ['10%', '93%'],
    shape: { x1: 0, y1: 0, x2: progressX, y2: 0 },
    style: { stroke: '#0089ff', lineWidth: 2 },
    z: 6,
  });

  for (var t = 0; t < totalNodes; t++) {
    var isActive = t === activeIdx;
    var isPast = t < activeIdx;
    var nodeX = (t / (totalNodes - 1)) * 80 + 10;
    var yr = RACE_KEYFRAMES[t].year;
    var yrLabel = yr < 0 ? ('BC' + Math.abs(yr)) : ('' + yr);

    nodes.push({
      type: 'circle',
      shape: { cx: 0, cy: 0, r: isActive ? 5 : 2.5 },
      position: [nodeX + '%', '93%'],
      style: {
        fill: isActive ? '#0089ff' : (isPast ? (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,26,46,0.4)') : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(26,26,46,0.12)')),
      },
      z: 10,
    });

    if (isActive || t === 0 || t === totalNodes - 1 || t % 5 === 0) {
      nodes.push({
        type: 'text',
        position: [nodeX + '%', '97%'],
        style: {
          text: yrLabel,
          fontSize: isActive ? 10 : 8,
          fontWeight: isActive ? 700 : 400,
          fill: isActive ? '#0089ff' : (isDark ? 'rgba(255,255,255,0.35)' : 'rgba(26,26,46,0.3)'),
          textAlign: 'center',
        },
        z: 10,
      });
    }
  }
  return nodes;
}

// 播放完毕后在图表中央显示重播按钮
function _showReplayButton(chart) {
  var isDark = _customState.darkMode;
  chart.setOption({
    graphic: {
      elements: [
        {
          type: 'circle',
          shape: { cx: 0, cy: 0, r: 36 },
          left: 'center',
          top: 'middle',
          style: {
            fill: isDark ? 'rgba(0,137,255,0.9)' : 'rgba(0,137,255,0.85)',
            shadowBlur: 20,
            shadowColor: 'rgba(0,137,255,0.3)',
          },
          cursor: 'pointer',
          onclick: function() { _replayRace(chart); },
          z: 100,
        },
        {
          type: 'text',
          left: 'center',
          top: 'middle',
          style: {
            text: '▶',
            fontSize: 28,
            fill: '#ffffff',
            textAlign: 'center',
            textVerticalAlign: 'middle',
          },
          cursor: 'pointer',
          onclick: function() { _replayRace(chart); },
          z: 101,
        },
      ],
    },
  });
}

// 重新播放
function _replayRace(chart) {
  // 先清理旧的播放定时器，防止多个 interval 并行
  if (_customState.raceYearTimer) {
    clearInterval(_customState.raceYearTimer);
    _customState.raceYearTimer = null;
  }
  _customState.raceIndex = 0;
  _customState.raceFinished = false;
  var isDark = _customState.darkMode;
  _renderRaceFrame(chart, 0, RACE_KEYFRAMES[0].values, RACE_KEYFRAMES[0].chinaLabel, RACE_KEYFRAMES[0].year, isDark);
  _advanceRaceSegment(chart);
}

function _destroyEchartsRace() {
  if (_customState.echartsInitTimer) {
    clearTimeout(_customState.echartsInitTimer);
    _customState.echartsInitTimer = null;
  }
  if (_customState.raceYearTimer) {
    clearInterval(_customState.raceYearTimer);
    _customState.raceYearTimer = null;
  }
  if (_customState.raceTimer) {
    clearTimeout(_customState.raceTimer);
    _customState.raceTimer = null;
  }
  if (_customState.echartsInstance) {
    _customState.echartsInstance.dispose();
    _customState.echartsInstance = null;
  }
  _customState.raceIndex = 0;
  _customState.raceFinished = false;
}

export function didUnmount() {
  window.removeEventListener('hashchange', this._handleHashChange);
  document.removeEventListener('keydown', this._handleKeyDown);
  document.removeEventListener('touchstart', this._handleTouchStart);
  document.removeEventListener('touchend', this._handleTouchEnd);
  document.removeEventListener('mousemove', this._handleMouseMove);
  document.removeEventListener('fullscreenchange', this._handleFullscreenChange);
  if (_customState.numTimer) {
    clearTimeout(_customState.numTimer);
  }
  _destroyEchartsRace();
}

export function getCustomState(key) {
  if (key) return _customState[key];
  return _.clone(_customState);
}

export function setCustomState(newState) {
  _.assign(_customState, newState);
  this.forceUpdate();
}

export function forceUpdate() {
  this.setState({ timestamp: new Date().getTime() });
}

// ── 主渲染函数 ──────────────────────────────────────────────
export function renderJsx() {
  var state = _customState;
  var slideData = SLIDES[state.currentIndex];
  var slideBg = state.darkMode ? slideData.bg : (slideData.bgLight || slideData.bg);
  var accent = slideData.accent || '#0089ff';
  var isMobile = this.utils.isMobile();
  var total = SLIDES.length;
  var self = this;
  var lang = I18N[state.lang] || I18N.zh;

  // 构造当前 slide 对象（用动态 bg 替换原始 bg）
  var slide = {};
  for (var k in slideData) { slide[k] = slideData[k]; }
  slide.bg = slideBg;

  var isDarkSlide = slideBg !== '#ffffff' && slideBg !== '#f0f7ff';

  // ── 事件处理函数（顶部定义，避免内联创建）──
  var handlePrev = function() {
    if (state.currentIndex > 0) {
      state.currentIndex--;
      self.forceUpdate();
    }
  };
  var handleNext = function() {
    if (state.currentIndex < total - 1) {
      state.currentIndex++;
      self.forceUpdate();
    }
  };
  var handleToggleFullscreen = function() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(function() {});
    } else {
      document.exitFullscreen().catch(function() {});
    }
  };
  var handleLangSwitch = function() {
    state.lang = state.lang === 'zh' ? 'en' : 'zh';
    self.forceUpdate();
  };
  var handleToggleDarkMode = function() {
    state.darkMode = !state.darkMode;
    _destroyEchartsRace();
    self.forceUpdate();
  };

  // ── 同步 URL hash（翻页时更新，方便分享定位）──
  var expectedHash = '#' + (state.currentIndex + 1);
  if (window.location.hash !== expectedHash) {
    history.replaceState(null, '', expectedHash);
  }

  // ── 每次渲染后检测是否需要初始化/销毁 ECharts ──
  if (_customState.echartsInitTimer) {
    clearTimeout(_customState.echartsInitTimer);
  }
  _customState.echartsInitTimer = setTimeout(function() {
    _customState.echartsInitTimer = null;
    _tryInitEchartsRace();
  }, 100);

  // ── 导航栏样式（默认隐藏，鼠标移到底部显示）──
  var navStyle = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '16px 0',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    background: isDarkSlide ? 'linear-gradient(transparent, rgba(0,0,0,0.3))' : 'linear-gradient(transparent, rgba(0,0,0,0.05))',
    opacity: state.navVisible ? 1 : 0,
    transform: state.navVisible ? 'translateY(0)' : 'translateY(10px)',
    transition: 'opacity 0.3s ease, transform 0.3s ease',
    pointerEvents: state.navVisible ? 'auto' : 'none',
  };

  // ── 分页点 ──
  var handleDotClick = function(idx) {
    return function() {
      state.currentIndex = idx;
      self.forceUpdate();
    };
  };
  var dots = [];
  var maxVisible = 7;
  var dotStart = Math.max(0, Math.min(state.currentIndex - Math.floor(maxVisible / 2), total - maxVisible));
  var dotEnd = Math.min(total, dotStart + maxVisible);
  for (var i = dotStart; i < dotEnd; i++) {
    var isActive = i === state.currentIndex;
    dots.push(
      <div
        key={i}
        style={{
          width: isActive ? '24px' : '7px',
          height: '7px',
          borderRadius: '4px',
          background: isActive ? accent : (isDarkSlide ? 'rgba(255,255,255,0.25)' : 'rgba(26,26,46,0.2)'),
          transition: 'all 0.3s ease',
          cursor: 'pointer',
        }}
        onClick={handleDotClick(i)}
      />
    );
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: slide.bg, overflow: 'hidden',
      padding: '0 !important', borderRadius: '0 !important', margin: '0 !important',
    }}>
      {/* 隐藏时间戳（触发重渲染）*/}
      <div style={{ display: 'none' }}>{this.state.timestamp}</div>

      {/* 隐藏宜搭低代码开发工具开关 */}
      <style>{'\
        #__lowcode_devtool_switch__,\
        [id="__lowcode_devtool_switch__"] {\
          display: none !important;\
          visibility: hidden !important;\
          opacity: 0 !important;\
          pointer-events: none !important;\
        }\
      '}</style>

      {/* ── 右上角工具栏：深浅切换 + 语言切换 + 全屏按钮 ── */}
      <div style={{
        position: 'absolute', top: '16px', right: '16px',
        display: 'flex', gap: '8px', zIndex: 100,
      }}>
        <div
          onClick={(e) => { handleToggleDarkMode(); }}
          style={{
            width: '36px', height: '36px', borderRadius: '8px',
            background: isDarkSlide ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: '16px',
            color: isDarkSlide ? '#ffffff' : '#1a1a2e',
          }}
          title={state.darkMode ? lang.lightMode : lang.darkMode}
        >
          {state.darkMode ? '☀️' : '🌙'}
        </div>
        <div
          onClick={(e) => { handleLangSwitch(); }}
          style={{
            height: '36px', padding: '0 12px', borderRadius: '8px',
            background: isDarkSlide ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: '13px', fontWeight: 600,
            color: isDarkSlide ? '#ffffff' : '#1a1a2e',
          }}
        >
          {lang.langSwitch}
        </div>
        <div
          onClick={(e) => { handleToggleFullscreen(); }}
          style={{
            width: '36px', height: '36px', borderRadius: '8px',
            background: isDarkSlide ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: '16px',
            color: isDarkSlide ? '#ffffff' : '#1a1a2e',
          }}
          title={state.isFullscreen ? lang.exitFullscreen : lang.fullscreen}
        >
          {state.isFullscreen ? '⊡' : '⛶'}
        </div>
      </div>

      {/* ── 幻灯片内容区 ── */}
      {renderSlideContent(slide, accent, isMobile)}

      {/* ── 导航栏（默认隐藏，鼠标移到底部显示）── */}
      <div style={navStyle}>
        <button
          onClick={(e) => { handlePrev(); }}
          style={{
            padding: '8px 20px', borderRadius: '20px',
            border: isDarkSlide ? '1px solid rgba(255,255,255,0.2)' : '1px solid #d9d9d9',
            cursor: 'pointer',
            background: isDarkSlide ? 'rgba(255,255,255,0.1)' : '#fff',
            color: isDarkSlide ? '#fff' : '#333',
            fontSize: '14px',
          }}
        >
          {lang.prev}
        </button>

        {/* 分页点 */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {dots}
        </div>

        <span style={{ lineHeight: '36px', color: isDarkSlide ? 'rgba(255,255,255,0.6)' : '#666', fontSize: '14px', minWidth: '60px', textAlign: 'center' }}>
          {lang.pageOf(state.currentIndex + 1, total)}
        </span>

        <button
          onClick={(e) => { handleNext(); }}
          style={{
            padding: '8px 20px', borderRadius: '20px',
            border: 'none', cursor: 'pointer',
            background: accent, color: '#fff', fontSize: '14px',
          }}
        >
          {lang.next}
        </button>
      </div>
    </div>
  );
}
