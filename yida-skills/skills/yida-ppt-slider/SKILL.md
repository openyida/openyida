---
name: yida-ppt-slider
description: "宜搭自定义页面 PPT 幻灯片开发指南。用于在宜搭平台上创建全屏演示文稿式的幻灯片页面，支持键盘翻页、移动端适配、演讲笔控制等功能。适用于技术分享、产品路演、培训课件等场景。不适用于：创建普通数据展示页面（应使用 yida-custom-page），或创建数据报表（应使用 yida-report 或 yida-chart）。"
---

# 宜搭 PPT 幻灯片开发指南

## 严格禁止 (NEVER DO)

- 不要使用 React Hooks（`useState`、`useEffect`），必须使用类组件模式
- 不要在 `renderJsx` 内部创建内联事件处理函数，必须在顶部定义后引用
- 不要使用 `import/require` 引入第三方库，必须通过 CDN 或内联代码
- 不要在 `componentWillUnmount` 中遗漏清理键盘/触摸事件监听，否则内存泄漏
- 不要使用 `objectFit: 'cover'` 裁剪图片，必须用 `contain` 确保完整显示
- 不要将幻灯片数据硬编码在 `renderJsx` 中，必须定义为顶层 `SLIDES` 数组

## 严格要求 (MUST DO)

- **发布前必须确认**：执行发布操作前，必须向用户展示幻灯片配置摘要（页数、标题列表），获得用户明确同意后再发布
- 必须在 `componentDidMount` 中注册键盘事件（含 `PageDown`/`PageUp` 演讲笔支持）
- 必须在 `componentWillUnmount` 中清理所有事件监听
- 必须使用 `this.utils.isMobile()` 判断设备类型并适配移动端样式
- 必须用 `position: fixed; top:0; left:0; right:0; bottom:0` 覆盖宜搭默认容器样式
- 状态变更必须通过 `_customState.xxx = value; this.forceUpdate()` 触发重渲染
- 本技能不读写 memory，所有状态仅在当前页面会话内有效，不跨会话持久化

## 适用场景

| 用户意图 | 触发条件 |
|---------|---------|
| 在宜搭内创建演示文稿 | "PPT"、"幻灯片"、"演示页面"、"产品路演" |
| 需要读取宜搭数据的演示 | 需要集成宜搭表单数据的展示页 |
| 纯演讲稿（无宜搭依赖） | → 改用 `report-slides` 技能（独立 HTML） |

## 触发条件

**正向触发**：
- "PPT"、"幻灯片"、"演示页面"、"产品路演"
- "技术分享"、"培训课件"、"全屏演示"
- 需要集成宜搭表单数据的演示页

**不适用场景（不要触发）**：
- 创建普通数据展示页面 → `yida-custom-page`
- 创建数据报表 → `yida-report` 或 `yida-chart`
- 纯演讲稿（无宜搭依赖）→ 改用 `report-slides` 技能（独立 HTML）

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| 键盘翻页无响应 | 确认在 `componentDidMount` 中注册了键盘事件，检查 `PageDown`/`PageUp` 支持 |
| 内存泄漏（切换页面后事件仍触发） | 在 `componentWillUnmount` 中清理所有键盘/触摸事件监听 |
| 图片显示不完整 | 使用 `objectFit: 'contain'` 而非 `cover`，确保完整显示 |
| 幻灯片数据难以维护 | 将幻灯片数据定义为顶层 `SLIDES` 数组，不得硬编码在 `renderJsx` 中 |
| 移动端布局异常 | 使用 `this.utils.isMobile()` 判断设备类型并适配移动端样式 |
| 数字键翻页跳到错误页 | 检查 300ms 延迟缓冲逻辑，确保 `numBuffer` 在跳转后清空 |
| 导航栏不显示 | 导航默认隐藏，鼠标移到底部 80px 区域才会显示；移动端通过触摸底部触发 |
| 全屏按钮无效 | 部分浏览器限制 Fullscreen API 必须由用户手势触发，确保在 `onClick` 中调用 |
| 中英文切换后内容未更新 | 确保 `forceUpdate()` 被调用，且 UI 文案从 `I18N[state.lang]` 动态读取 |

---


## 概述

本技能用于在宜搭平台上开发全屏演示文稿式的幻灯片页面，支持：
- 键盘翻页（方向键、PageDown/PageUp）
- **数字键快速跳页**（支持双位数延迟缓冲，如连按 `1` `2` 跳到第 12 页）
- **导航栏默认隐藏**（鼠标移到底部自动显示，移开自动隐藏）
- **全屏按钮**（一键进入/退出浏览器全屏模式）
- **中英文切换**（PPT 内置 UI 文案支持中/英双语切换）
- 移动端竖屏适配
- 演讲笔/遥控器控制
- 多主题配色
- 进度指示器

## 与 report-slides skill 的区别

| 维度 | **yida-ppt-slider**（本技能） | **report-slides**（skills-market） |
|------|-------------------------------|-------------------------------------|
| **平台** | 宜搭平台内的自定义页面 | 独立 HTML 文件，零依赖 |
| **输出** | 发布到宜搭，通过宜搭 URL 访问 | 生成独立 HTML 文件，可直接在浏览器打开 |
| **适用场景** | 需要集成宜搭数据/权限的演示页面 | 纯展示型演讲稿，无需宜搭环境 |
| **数据能力** | 可调用宜搭表单数据 | 纯静态内容 |

> **选择建议**：需要在宜搭平台内展示、或需要读取宜搭数据 → 本技能；纯演讲稿、不依赖宜搭 → 。

---

## 环境准备

### 1. 安装 openyida CLI 工具

```bash
# 全局安装 openyida（首次使用前执行）
npm install -g openyida

# 更新到最新版本
npm install -g openyida@latest
```

### 2. 系统学习 openyida 技能体系

**必读**：`yida-skills/SKILL.md` —— 宜搭 AI 应用开发总入口技能

**完整技能列表**（按开发流程排序）：

| 技能 | 路径 | 用途 |
|------|------|------|
| `yida` | `yida-skills/SKILL.md` | **总入口**，必须先读 |
| `yida-login` | `skills/yida-login/SKILL.md` | 登录态管理 |
| `yida-create-app` | `skills/yida-create-app/SKILL.md` | 创建应用 |
| `yida-create-page` | `skills/yida-create-page/SKILL.md` | 创建自定义页面 |
| `yida-create-form-page` | `skills/yida-create-form-page/SKILL.md` | 创建表单页面 |
| `yida-get-schema` | `skills/yida-get-schema/SKILL.md` | 获取表单 Schema |
| `yida-custom-page` | `skills/yida-custom-page/SKILL.md` | 自定义页面开发规范 |
| `yida-publish-page` | `skills/yida-publish-page/SKILL.md` | 发布页面 |
| `yida-page-config` | `skills/yida-page-config/SKILL.md` | 页面公开访问配置 |
| `yida-form-permission` | `skills/yida-form-permission/SKILL.md` | 表单权限配置 |
| `yida-data-management` | `skills/yida-data-management/SKILL.md` | 数据管理 |
| `yida-connector` | `skills/yida-connector/SKILL.md` | HTTP 连接器 |
| `yida-process-rule` | `skills/yida-process-rule/SKILL.md` | 流程配置 |

> **重要**：执行任何子技能前，必须先完整读取对应的 SKILL.md，不要凭记忆猜测参数格式。

---

## 开发流程

```
[Step 1] 环境检测 → openyida env
              ↓
[Step 2] 创建应用 → openyida create-app → 获得 appType
              ↓
[Step 3] 创建自定义页面 → openyida create-page → 获得 formUuid
              ↓
[Step 4] 编写幻灯片代码 → 参考本技能规范 → pages/src/<文件名>.js
              ↓
[Step 5] 发布页面 → openyida publish <文件> <appType> <formUuid>
              ↓
[Step 6] 配置公开访问（可选）→ openyida save-share-config
```

---

## 技术栈

- **框架**：React 16（类组件模式，禁止使用 Hooks）
- **样式**：内联 style（宜搭自定义页面限制）
- **状态管理**：全局变量 `_customState` + `this.setState({ timestamp: Date.now() })`
- **导出格式**：`export function`（非 `export default`）

---

## 幻灯片类型

| 类型 | 用途 | 关键字段 |
|------|------|---------|
| `cover` | 封面页 | `eyebrow`, `title`, `subtitle`, `meta`, `tags` |
| `toc` | 目录页 | `title`, `items` |
| `chapter` | 章节过渡页 | `partNum`, `title`, `subtitle`, `desc` |
| `key-points` | 要点列表页 | `chapter`, `title`, `subtitle`, `points` |
| `image-text` | 图文混排页 | `chapter`, `title`, `subtitle`, `body`, `imageUrl` |
| `scene-image` | 场景展示页 | `chapter`, `sceneNum`, `title`, `subtitle`, `body`, `imageUrl`, `tag` |
| `scene-image-top` | 顶部大图场景页 | `chapter`, `sceneNum`, `title`, `subtitle`, `body`, `imageUrl`, `tag` |
| `two-images` | 双图对比页 | `chapter`, `title`, `subtitle`, `leftImage`, `rightImage` |
| `ending` | 结束页 | `title`, `subtitle`, `quote`, `cta`, `tags`, `contacts` |

---

## 核心代码结构

```javascript
// ── 状态管理 ─────────────────────────────────────────────────
// 使用 _customState 存储业务状态，避免与 React 内部 state 冲突
var _customState = {
  currentIndex: 0,
  total: 0,
};

// ── 幻灯片数据 ────────────────────────────────────────────────
var SLIDES = [
  {
    type: 'cover',
    bg: '#ffffff',
    accent: '#d97706',  // 主题色
    // ... 其他字段
  },
  // ... 更多幻灯片
];

// ── 幻灯片内容渲染 ───────────────────────────────────────────
export function renderSlideContent(slide, accent, isMobile) {
  var type = slide.type;
  
  // 根据 type 返回对应的 JSX
  // 使用 isMobile 参数进行多端适配
  // ...
}

// ── 主渲染函数 ────────────────────────────────────────────────
export function renderJsx() {
  var timestamp = this.state.timestamp;
  var state = _customState;
  var slide = SLIDES[state.currentIndex];
  var accent = slide.accent || '#d97706';
  var isMobile = this.utils.isMobile();  // ✅ 使用宜搭提供的工具方法
  var total = SLIDES.length;
  
  // 在顶部定义事件处理函数，避免每次渲染创建新的内联函数
  var handlePrev = function() {
    if (state.currentIndex > 0) {
      state.currentIndex--;
      this.forceUpdate();  // ✅ 使用 forceUpdate 触发重渲染
    }
  }.bind(this);
  
  var handleNext = function() {
    if (state.currentIndex < total - 1) {
      state.currentIndex++;
      this.forceUpdate();
    }
  }.bind(this);
  
  var handleGoTo = function(index) {
    state.currentIndex = index;
    this.forceUpdate();
  }.bind(this);
  
  // ... 渲染逻辑
}
```

---

## 关键实现细节

### 1. 生命周期方法

```javascript
// ✅ 使用 componentDidMount 初始化事件监听
componentDidMount: function() {
  // 初始化幻灯片总数
  _customState.total = SLIDES.length;
  
  // 键盘翻页事件（支持演讲笔的 PageDown/PageUp）
  this._handleKeyDown = function(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
      this.handleNext();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
      this.handlePrev();
    }
  }.bind(this);
  
  document.addEventListener('keydown', this._handleKeyDown);
  
  // 触摸滑动支持（移动端）
  this._touchStartX = 0;
  this._handleTouchStart = function(e) {
    this._touchStartX = e.changedTouches[0].screenX;
  }.bind(this);
  
  this._handleTouchEnd = function(e) {
    var touchEndX = e.changedTouches[0].screenX;
    if (this._touchStartX - touchEndX > 50) this.handleNext();
    if (touchEndX - this._touchStartX > 50) this.handlePrev();
  }.bind(this);
  
  document.addEventListener('touchstart', this._handleTouchStart);
  document.addEventListener('touchend', this._handleTouchEnd);
},

// ✅ 使用 componentWillUnmount 清理事件监听，防止内存泄漏
componentWillUnmount: function() {
  document.removeEventListener('keydown', this._handleKeyDown);
  document.removeEventListener('touchstart', this._handleTouchStart);
  document.removeEventListener('touchend', this._handleTouchEnd);
}
```

### 2. 状态管理规范

```javascript
// ✅ 正确：直接修改 _customState，然后调用 forceUpdate()
handleNext: function() {
  if (_customState.currentIndex < SLIDES.length - 1) {
    _customState.currentIndex++;
    this.forceUpdate();  // 触发重渲染
  }
},

handlePrev: function() {
  if (_customState.currentIndex > 0) {
    _customState.currentIndex--;
    this.forceUpdate();
  }
},

handleGoTo: function(index) {
  _customState.currentIndex = index;
  this.forceUpdate();
}

// ❌ 错误：不要通过 setState 来间接更新业务状态
// this.setState({ currentIndex: index });  // 不要这样做
```

### 3. 分页导航（精简版）

```javascript
// 在 renderJsx 顶部定义，避免每次渲染创建新函数
var handleDotClick = function(idx) {
  return function() { this.handleGoTo(idx); }.bind(this);
}.bind(this);

// 精简分页点（最多显示5个）
var dots = [];
var maxVisible = 5;
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
        background: isActive ? accent : 'rgba(26,26,46,0.2)',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
      }}
      onClick={handleDotClick(i)}
    />
  );
}
```

### 4. 多端适配

```javascript
// ✅ 使用 this.utils.isMobile() 判断设备类型
var isMobile = this.utils.isMobile();

// 条件样式
var styles = {
  container: { 
    padding: isMobile ? '20px 16px' : '48px 80px',
    minHeight: '100vh',
  },
  title: { 
    fontSize: isMobile ? '24px' : '38px',
    fontWeight: '800',
    color: '#1a1a2e',
  },
  image: {
    maxWidth: '100%',
    maxHeight: isMobile ? '200px' : '400px',
    objectFit: 'contain',  // 确保图片完整显示
  },
};
```

### 5. 清除默认样式

宜搭自定义页面容器有默认 padding 和圆角，需要强制覆盖：

```javascript
var styles = {
  wrapper: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: '0 !important',        // 清除默认 padding
    borderRadius: '0 !important',   // 清除默认圆角
    margin: '0 !important',
    overflow: 'hidden',
    background: slide.bg,
  },
};
```

### 6. 数字键快速跳页

支持按数字键跳转到指定页面。为了处理双位数页码（如连按 `1` `2` 跳到第 12 页），使用 **300ms 延迟缓冲**机制：

```javascript
// ── 在 _customState 中新增数字键缓冲字段 ──
var _customState = {
  currentIndex: 0,
  total: 0,
  numBuffer: '',        // 数字键输入缓冲
  numTimer: null,       // 延迟定时器
};

// ── 在 didMount 的 _handleKeyDown 中新增数字键处理 ──
// 检测数字键（主键盘 0-9 和小键盘 Numpad0-Numpad9）
var digit = null;
if (e.key >= '0' && e.key <= '9') {
  digit = e.key;
} else if (e.code && e.code.indexOf('Numpad') === 0 && e.key >= '0' && e.key <= '9') {
  digit = e.key;
}

if (digit !== null) {
  // 清除上一次的定时器
  if (_customState.numTimer) {
    clearTimeout(_customState.numTimer);
  }
  // 追加数字到缓冲区
  _customState.numBuffer += digit;

  // 300ms 后执行跳转（等待可能的第二位数字输入）
  _customState.numTimer = setTimeout(function() {
    var targetPage = parseInt(_customState.numBuffer, 10);
    // 页码从 1 开始，索引从 0 开始
    var targetIndex = targetPage - 1;
    if (targetIndex >= 0 && targetIndex < SLIDES.length) {
      _customState.currentIndex = targetIndex;
      self.forceUpdate();
    }
    // 清空缓冲区
    _customState.numBuffer = '';
    _customState.numTimer = null;
  }, 300);
  return;  // 阻止后续翻页逻辑
}
```

> **注意**：300ms 延迟是为了区分单位数和双位数输入。如果用户在 300ms 内连续按下两个数字键，会拼接为双位数页码。

### 7. 隐藏宜搭平台导航

PPT 页面应默认隐藏宜搭平台的顶部导航栏，实现纯净的全屏演示效果。通过 `openyida update-form-config` 命令设置 `isRenderNav=false`：

```bash
# 在发布页面后，执行此命令隐藏宜搭顶部导航
openyida update-form-config <appType> <formUuid> false "<页面标题>"
```

**执行时机**：在 `openyida publish` 发布页面成功后立即执行。

**效果**：
- 隐藏宜搭平台顶部的应用导航栏（logo、菜单、用户头像等）
- 页面变为纯净的全屏展示模式，非常适合 PPT 演示场景
- 如需恢复导航，将 `false` 改为 `true` 重新执行即可

> **重要**：这是 PPT 技能的**必须步骤**。发布 PPT 页面后，务必执行 `update-form-config` 隐藏导航，否则顶部导航栏会遮挡演示内容。

此外，PPT 内部的**翻页导航栏**（底部的上一页/下一页按钮）也默认隐藏，鼠标移到页面底部区域时自动显示：

```javascript
// ── 在 _customState 中新增导航可见性字段 ──
var _customState = {
  currentIndex: 0,
  navVisible: false,    // 翻页导航栏默认隐藏
};

// ── 在 didMount 中注册鼠标移动事件 ──
this._handleMouseMove = function(e) {
  var isNearBottom = e.clientY > window.innerHeight - 80;
  if (isNearBottom !== _customState.navVisible) {
    _customState.navVisible = isNearBottom;
    self.forceUpdate();
  }
};
document.addEventListener('mousemove', this._handleMouseMove);

// ── 在 didUnmount 中清理 ──
document.removeEventListener('mousemove', this._handleMouseMove);

// ── 在 renderJsx 中根据 navVisible 控制翻页导航栏显隐 ──
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
  background: 'linear-gradient(transparent, rgba(0,0,0,0.05))',
  opacity: state.navVisible ? 1 : 0,
  transform: state.navVisible ? 'translateY(0)' : 'translateY(10px)',
  transition: 'opacity 0.3s ease, transform 0.3s ease',
  pointerEvents: state.navVisible ? 'auto' : 'none',
};
```

### 8. 全屏按钮

使用浏览器 Fullscreen API 实现一键进入/退出全屏：

```javascript
// ── 在 _customState 中新增全屏状态字段 ──
var _customState = {
  currentIndex: 0,
  isFullscreen: false,
};

// ── 在 didMount 中监听全屏状态变化 ──
this._handleFullscreenChange = function() {
  _customState.isFullscreen = !!document.fullscreenElement;
  self.forceUpdate();
};
document.addEventListener('fullscreenchange', this._handleFullscreenChange);

// ── 在 didUnmount 中清理 ──
document.removeEventListener('fullscreenchange', this._handleFullscreenChange);

// ── 在 renderJsx 中定义全屏切换函数 ──
var handleToggleFullscreen = function() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(function() {});
  } else {
    document.exitFullscreen().catch(function() {});
  }
};

// ── 全屏按钮 JSX（放在页面右上角）──
<div
  onClick={function() { handleToggleFullscreen(); }}
  style={{
    position: 'absolute',
    top: '16px',
    right: '16px',
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    background: 'rgba(26,26,46,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 100,
    transition: 'background 0.2s',
  }}
  title={state.isFullscreen ? '退出全屏' : '全屏'}
>
  <span style={{ fontSize: '16px' }}>
    {state.isFullscreen ? '⊡' : '⛶'}
  </span>
</div>
```

### 9. 中英文切换

PPT 内置 UI 文案（导航按钮、页码提示、全屏按钮等）支持中英文双语切换：

```javascript
// ── 国际化文案定义 ──
var I18N = {
  zh: {
    prev: '← 上一页',
    next: '下一页 →',
    pageOf: function(current, total) { return current + ' / ' + total; },
    fullscreen: '全屏',
    exitFullscreen: '退出全屏',
    langSwitch: 'EN',
  },
  en: {
    prev: '← Prev',
    next: 'Next →',
    pageOf: function(current, total) { return current + ' / ' + total; },
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit Fullscreen',
    langSwitch: '中',
  },
};

// ── 在 _customState 中新增语言字段 ──
var _customState = {
  currentIndex: 0,
  lang: 'zh',  // 默认中文，可选 'en'
};

// ── 在 renderJsx 中使用 ──
var lang = I18N[state.lang] || I18N.zh;

// 语言切换按钮
var handleLangSwitch = function() {
  state.lang = state.lang === 'zh' ? 'en' : 'zh';
  self.forceUpdate();
};

// 语言切换按钮 JSX（放在全屏按钮左侧）
<div
  onClick={function() { handleLangSwitch(); }}
  style={{
    position: 'absolute',
    top: '16px',
    right: '60px',
    height: '36px',
    padding: '0 12px',
    borderRadius: '8px',
    background: 'rgba(26,26,46,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    color: '#1a1a2e',
    zIndex: 100,
  }}
>
  {lang.langSwitch}
</div>

// 导航按钮使用 lang 对象
<button ...>{lang.prev}</button>
<span ...>{lang.pageOf(state.currentIndex + 1, SLIDES.length)}</span>
<button ...>{lang.next}</button>
```

> **提示**：如果幻灯片内容本身也需要中英文，可以在 `SLIDES` 数组中为每个 slide 提供 `title_en`、`subtitle_en` 等字段，在 `renderSlideContent` 中根据 `state.lang` 选择对应文案。

### 10. 深色/浅色模式切换

PPT 支持深色和浅色两种主题模式切换，右上角工具栏提供 ☀️/🌙 图标按钮：

```javascript
// ── 在 _customState 中新增主题模式字段 ──
var _customState = {
  currentIndex: 0,
  lang: 'zh',
  themeMode: 'light',  // 'light' 或 'dark'
};

// ── 主题配置（深色/浅色配色方案）──
var THEME_CONFIG = {
  light: {
    bg: '#ffffff',
    text: '#1a1a2e',
    textSecondary: 'rgba(26,26,46,0.7)',
    border: 'rgba(26,26,46,0.08)',
    toolbarBg: 'rgba(26,26,46,0.06)',
    navBg: 'linear-gradient(transparent, rgba(0,0,0,0.05))',
  },
  dark: {
    bg: '#1a1a2e',
    text: '#ffffff',
    textSecondary: 'rgba(255,255,255,0.7)',
    border: 'rgba(255,255,255,0.1)',
    toolbarBg: 'rgba(255,255,255,0.1)',
    navBg: 'linear-gradient(transparent, rgba(255,255,255,0.05))',
  },
};

// ── 在 renderJsx 中定义主题切换函数 ──
var handleThemeToggle = function() {
  state.themeMode = state.themeMode === 'light' ? 'dark' : 'light';
  self.forceUpdate();
};

// ── 获取当前主题配置 ──
var theme = THEME_CONFIG[state.themeMode] || THEME_CONFIG.light;

// ── 主题切换按钮 JSX（放在语言切换按钮左侧）──
<div
  onClick={function() { handleThemeToggle(); }}
  style={{
    position: 'absolute',
    top: '16px',
    right: '104px',  // 语言切换按钮(60px) + 全屏按钮(44px) = 104px
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    background: theme.toolbarBg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '18px',
    zIndex: 100,
    transition: 'background 0.2s',
  }}
  title={state.themeMode === 'light' ? '切换深色模式' : '切换浅色模式'}
>
  {state.themeMode === 'light' ? '🌙' : '☀️'}
</div>

// ── 使用主题配置设置样式 ──
<div style={{
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: theme.bg,
  color: theme.text,
  padding: '0 !important',
  borderRadius: '0 !important',
}}>
  <h1 style={{ color: theme.text }}>{slide.title}</h1>
  <p style={{ color: theme.textSecondary }}>{slide.subtitle}</p>
</div>
```

**实现要点**：
- 使用 `themeMode` 字段存储当前主题状态（'light' 或 'dark'）
- `THEME_CONFIG` 对象定义深色和浅色的完整配色方案
- 所有颜色值从 `theme` 对象动态获取，而非硬编码
- 主题切换后调用 `forceUpdate()` 触发重渲染
- 右上角工具栏从左到右依次：主题切换、语言切换、全屏按钮

### 11. URL hash 定位

PPT 支持 URL hash 定位功能，实现页面加载时自动跳转到指定页码、翻页时同步更新 URL、支持浏览器前进后退：

```javascript
// ── 在 didMount 中初始化 hash 定位 ──
// 读取 URL hash，格式为 #页码（如 #3 表示第 3 页）
export function didMount() {
  var self = this;
  _customState.total = SLIDES.length;

  // ... 其他事件监听

  // ── URL hash 定位初始化 ──
  this._handleHashChange = function() {
    var hash = window.location.hash;
    if (hash && hash.startsWith('#')) {
      var pageNum = parseInt(hash.substring(1), 10);
      var targetIndex = pageNum - 1;  // 页码从 1 开始，索引从 0 开始
      if (targetIndex >= 0 && targetIndex < SLIDES.length) {
        _customState.currentIndex = targetIndex;
        self.forceUpdate();
      }
    }
  };

  // 初始加载时检查 hash
  this._handleHashChange();

  // 监听 hash 变化（浏览器前进后退）
  window.addEventListener('hashchange', this._handleHashChange);
}

// ── 在 didUnmount 中清理 ──
export function didUnmount() {
  // ... 其他清理
  window.removeEventListener('hashchange', this._handleHashChange);
}

// ── 在翻页函数中同步更新 URL hash ──
var handlePrev = function() {
  if (state.currentIndex > 0) {
    state.currentIndex--;
    window.location.hash = state.currentIndex + 1;  // 更新 URL hash
    self.forceUpdate();
  }
};

var handleNext = function() {
  if (state.currentIndex < SLIDES.length - 1) {
    state.currentIndex++;
    window.location.hash = state.currentIndex + 1;
    self.forceUpdate();
  }
};

var handleGoTo = function(index) {
  state.currentIndex = index;
  window.location.hash = index + 1;
  self.forceUpdate();
};
```

**实现要点**：
- URL hash 格式：`#页码`（如 `#3` 表示第 3 页）
- 页码从 1 开始（用户友好），索引从 0 开始（数组索引）
- `hashchange` 事件监听浏览器前进后退操作
- 翻页时同步更新 `window.location.hash`
- 页面加载时自动读取 hash 并跳转到对应页码
- 无效 hash（超出范围）会被忽略

**使用场景**：
- 分享特定页面链接：`https://example.com/ppt#5` 直接跳到第 5 页
- 演讲者提前准备跳转链接
- 浏览器前进后退按钮正常工作

### 12. ECharts Bar Chart Race 动态柱状图

PPT 支持集成 ECharts 动态柱状图（Bar Chart Race），展示中国历代经济排名变化：

```javascript
// ── 在 SLIDES 数组中新增 echarts-race 类型幻灯片 ──
{
  type: 'echarts-race',
  bg: '#ffffff',
  accent: '#d97706',
  title: '中国历代经济排名变化',
  subtitle: '公元前 2000 年 - 公元 2025 年',
}

// ── ECharts 数据（中国朝代名动态切换 + 8 个实体）──
var RACE_DATA = {
  // 8 个实体的名称和颜色
  entities: [
    { name: '中国', color: '#ff4444' },      // 固定红色
    { name: '印度', color: '#3b82f6' },
    { name: '欧洲', color: '#10b981' },
    { name: '中东', color: '#f59e0b' },
    { name: '美国', color: '#8b5cf6' },
    { name: '日本', color: '#ec4899' },
    { name: '俄罗斯', color: '#6366f1' },
    { name: '其他', color: '#9ca3af' },
  ],
  // 中国朝代名称映射（随时间动态切换）
  chinaNames: {
    '-2000': '华夏',
    '-770': '春秋列国',
    '-221': '大秦',
    '-206': '大汉',
    '581': '大隋',
    '618': '大唐',
    '960': '北宋',
    '1127': '南宋',
    '1368': '大明',
    '1644': '大清',
    '1912': '中华民国',
    '1949': '新中国',
    '2025': '中国',
  },
  // 历史数据（年份 + 8 个实体的 GDP 数值）
  timeline: [
    { year: -2000, values: [120, 80, 40, 30, 10, 5, 5, 20] },
    { year: -770, values: [150, 90, 50, 40, 10, 8, 8, 25] },
    { year: -221, values: [200, 100, 60, 50, 15, 10, 10, 30] },
    { year: -206, values: [300, 120, 80, 60, 20, 15, 15, 40] },
    { year: 581, values: [400, 150, 100, 80, 30, 20, 20, 50] },
    { year: 618, values: [500, 180, 120, 100, 40, 25, 25, 60] },
    { year: 960, values: [600, 200, 150, 120, 50, 30, 30, 70] },
    { year: 1127, values: [550, 220, 180, 140, 60, 35, 35, 80] },
    { year: 1368, values: [700, 250, 200, 160, 80, 40, 40, 90] },
    { year: 1644, values: [800, 280, 250, 180, 100, 50, 50, 100] },
    { year: 1912, values: [600, 300, 300, 200, 150, 60, 60, 120] },
    { year: 1949, values: [500, 320, 350, 220, 200, 80, 80, 150] },
    { year: 2025, values: [18000, 3500, 20000, 3000, 25000, 4000, 1800, 5000] },
  ],
};

// ── 在 renderSlideContent 中处理 echarts-race 类型 ──
export function renderSlideContent(slide, accent, isMobile) {
  if (slide.type === 'echarts-race') {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* 标题区 */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: isMobile ? '20px' : '28px', color: '#1a1a2e', margin: 0 }}>
            {slide.title}
          </h2>
          {slide.subtitle && (
            <p style={{ fontSize: isMobile ? '14px' : '18px', color: 'rgba(26,26,46,0.7)', marginTop: '8px' }}>
              {slide.subtitle}
            </p>
          )}
        </div>
        
        {/* ECharts 容器 */}
        <div 
          id="echarts-race-container"
          style={{
            flex: 1,
            width: '100%',
            minHeight: '400px',
            position: 'relative',
          }}
        />
        
        {/* 加载 ECharts 脚本 */}
        <script 
          src="https://g.alicdn.com/code/lib/echarts/5.6.0/echarts.min.js"
          onLoad={function() {
            self.initBarChartRace();
          }}
        />
      </div>
    );
  }
  // ... 其他类型处理
}

// ── 初始化 Bar Chart Race（在组件方法中）──
export function initBarChartRace() {
  var self = this;
  var container = document.getElementById('echarts-race-container');
  if (!container) return;

  var chart = echarts.init(container);
  var entities = RACE_DATA.entities;
  var timeline = RACE_DATA.timeline;
  var chinaNames = RACE_DATA.chinaNames;

  var currentIndex = 0;
  var isPlaying = true;
  var timer = null;

  // 线性插值函数（在两个时间点之间生成中间帧）
  var lerp = function(start, end, t) {
    return start + (end - start) * t;
  };

  // 生成插值帧（每 50ms 一帧，实现平滑动画）
  var framesPerYear = 20;  // 每年 20 帧
  var allFrames = [];

  for (var i = 0; i < timeline.length - 1; i++) {
    var currentYear = timeline[i];
    var nextYear = timeline[i + 1];
    var yearDiff = nextYear.year - currentYear.year;
    var totalFrames = yearDiff * framesPerYear;

    for (var f = 0; f < totalFrames; f++) {
      var t = f / totalFrames;
      var frameYear = currentYear.year + yearDiff * t;
      var frameValues = [];

      for (var j = 0; j < 8; j++) {
        frameValues.push(lerp(currentYear.values[j], nextYear.values[j], t));
      }

      allFrames.push({
        year: Math.round(frameYear),
        values: frameValues,
      });
    }
  }
  // 添加最后一个时间点
  allFrames.push({
    year: timeline[timeline.length - 1].year,
    values: timeline[timeline.length - 1].values,
  });

  // 获取中国朝代名
  var getChinaName = function(year) {
    var names = [];
    for (var key in chinaNames) {
      var keyYear = parseInt(key, 10);
      if (year >= keyYear) {
        names.push({ year: keyYear, name: chinaNames[key] });
      }
    }
    return names.length > 0 ? names[names.length - 1].name : '中国';
  };

  // 更新图表
  var updateChart = function() {
    var frame = allFrames[currentIndex];
    var year = frame.year;
    var values = frame.values;

    // 构造数据（按值排序）
    var data = entities.map(function(entity, index) {
      return {
        name: entity.name === '中国' ? getChinaName(year) : entity.name,
        value: values[index],
        itemStyle: { color: entity.color },
      };
    }).sort(function(a, b) { return b.value - a.value; });

    var option = {
      grid: { top: '10%', right: '15%', bottom: '15%', left: '15%' },
      xAxis: { show: false },
      yAxis: {
        type: 'category',
        data: data.map(function(d) { return d.name; }),
        axisLabel: { fontSize: 14 },
      },
      series: [{
        type: 'bar',
        data: data.map(function(d) { return d.value; }),
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
        },
        label: {
          show: true,
          position: 'right',
          formatter: function(params) {
            return params.value.toLocaleString();
          },
        },
        barWidth: '60%',
      }],
      // 底部时间轴进度条
      graphic: [
        // 时间轴背景
        {
          type: 'rect',
          left: '5%',
          right: '5%',
          top: '85%',
          height: 4,
          shape: { fill: '#e5e7eb' },
        },
        // 时间轴进度
        {
          type: 'rect',
          left: '5%',
          top: '85%',
          height: 4,
          shape: { fill: '#d97706' },
          style: {
            width: ((currentIndex / (allFrames.length - 1)) * 90) + '%',
          },
        },
        // 右下角大字年份水印
        {
          type: 'text',
          right: '5%',
          bottom: '10%',
          style: {
            text: year < 0 ? Math.abs(year) + ' BC' : year + ' AD',
            fontSize: 48,
            fontWeight: 'bold',
            fill: 'rgba(26,26,46,0.1)',
          },
        },
        // 播放完毕显示重播按钮
        currentIndex === allFrames.length - 1 ? {
          type: 'text',
          left: 'center',
          top: 'center',
          style: {
            text: '🔄 重播',
            fontSize: 24,
            fill: '#d97706',
            cursor: 'pointer',
          },
          onclick: function() {
            currentIndex = 0;
            isPlaying = true;
            play();
          },
        } : null,
      ].filter(Boolean),
    };

    chart.setOption(option);
  };

  // 播放动画
  var play = function() {
    if (timer) clearInterval(timer);
    timer = setInterval(function() {
      if (currentIndex < allFrames.length - 1) {
        currentIndex++;
        updateChart();
      } else {
        isPlaying = false;
        clearInterval(timer);
      }
    }, 50);  // 每 50ms 一帧
  };

  // 初始化并开始播放
  updateChart();
  play();

  // 组件卸载时清理
  this._chartRaceCleanup = function() {
    if (timer) clearInterval(timer);
    if (chart) chart.dispose();
  };
}

// ── 在 didUnmount 中清理 ECharts 实例 ──
export function didUnmount() {
  // ... 其他清理
  if (this._chartRaceCleanup) {
    this._chartRaceCleanup();
  }
}
```

**实现要点**：
- **ECharts 加载**：通过阿里 CDN 加载 ECharts 5.6.0（`https://g.alicdn.com/code/lib/echarts/5.6.0/echarts.min.js`）
- **新增 slide 类型**：`echarts-race`，包含 `title` 和 `subtitle` 字段
- **8 个实体**：中国、印度、欧洲、中东、美国、日本、俄罗斯、其他，中国固定红色 `#ff4444`
- **中国朝代名动态切换**：根据年份自动切换朝代名称（华夏→春秋列国→大秦→大汉→大隋→大唐→北宋→南宋→大明→大清→中华民国→新中国→中国）
- **逐帧线性插值**：在两个时间点之间生成中间帧，实现平滑动画过渡
- **底部时间轴进度条**：显示播放进度，使用 ECharts `graphic` 组件绘制
- **右下角大字年份水印**：显示当前年份，负数年份显示 "BC"（公元前）
- **播放完毕重播按钮**：使用 ECharts `graphic onclick` 事件，点击后重置并重新播放
- **连续播放无停顿**：使用 `setInterval` 每 50ms 更新一帧，确保动画流畅
- **内存清理**：在 `didUnmount` 中清理定时器和 ECharts 实例，防止内存泄漏

**数据结构说明**：
- `RACE_DATA.entities`：8 个实体的名称和颜色配置
- `RACE_DATA.chinaNames`：中国朝代名称映射表（年份 → 朝代名）
- `RACE_DATA.timeline`：历史时间线数据，每个时间点包含年份和 8 个实体的 GDP 数值

---

## 样式规范

### 白色主题配色

```javascript
// 主背景
bg: '#ffffff'

// 主文字
color: '#1a1a2e'

// 次要文字
color: 'rgba(26,26,46,0.7)'

// 边框/分割线
border: '1px solid rgba(26,26,46,0.08)'

// 推荐主题色
accent: '#d97706'  // 琥珀色（醒目）
accent: '#0089ff'  // 蓝色（科技）
accent: '#c084fc'  // 紫色（创新）
```

### 图片展示

```javascript
// 使用 objectFit: 'contain' 确保图片完整显示，不裁剪
<img src={slide.imageUrl} style={{ 
  maxWidth: '100%', 
  maxHeight: '100%', 
  width: 'auto', 
  height: 'auto', 
  objectFit: 'contain',
  display: 'block' 
}} />
```

### 移动端适配

```javascript
// ✅ 使用 this.utils.isMobile() 获取设备类型
var isMobile = this.utils.isMobile();

// 条件样式
var padding = isMobile ? '20px 16px' : '48px 80px';
var fontSize = isMobile ? '18px' : '32px';
```

---

## 隐藏调试工具

宜搭平台会自动注入 `__lowcode_devtool_switch__` 调试工具，如需隐藏：

```javascript
return (
  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: slide.bg }}>
    {/* 隐藏宜搭低代码开发工具开关 */}
    <style>{`
      #__lowcode_devtool_switch__,
      [id="__lowcode_devtool_switch__"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `}</style>
    {/* ... 其他内容 */}
  </div>
);
```

---

## 发布命令

```bash
openyida publish project/pages/src/<文件名>.js <appType> <formUuid>
```

---

## 最佳实践

1. **每页一个主题**：保持内容简洁，避免文字过多
2. **图片使用 CDN**：宜搭自定义页面不支持本地图片
3. **测试移动端**：在真机上测试竖屏显示效果
4. **演讲笔兼容**：确保 PageDown/PageUp 翻页正常工作
5. **版本管理**：每次修改后及时发布，记录版本号

---

## 常见问题

**Q：图片显示不全？**  
A：使用 `objectFit: 'contain'` 而不是 `cover`，确保图片完整显示。

**Q：移动端文字太小？**  
A：为移动端单独设置更大的字体大小，使用 `isPortraitMobile` 条件判断。

**Q：演讲笔无法翻页？**  
A：确保监听了 `PageDown` 和 `PageUp` 键盘事件。

**Q：分页点太多？**  
A：使用动态计算只显示部分分页点，当前页居中。
