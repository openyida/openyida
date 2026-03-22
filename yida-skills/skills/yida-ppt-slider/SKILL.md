---
name: yida-ppt-slider
description: >
  宜搭自定义页面 PPT 幻灯片开发指南。用于在宜搭平台上创建全屏演示文稿式的幻灯片页面，
  支持键盘翻页、移动端适配、演讲笔控制等功能。
  适用于技术分享、产品路演、培训课件等场景。
license: MIT
compatibility:
  - opencode
  - claude-code
  - qoder
  - wukong
metadata:
  audience: developers
  workflow: yida-custom-page
  version: 1.0.0
  tags:
    - yida
    - custom-page
    - slider
    - ppt
    - presentation
---

# 宜搭 PPT 幻灯片开发指南

## 概述

本技能用于在宜搭平台上开发全屏演示文稿式的幻灯片页面，支持：
- 键盘翻页（方向键、PageDown/PageUp）
- 移动端竖屏适配
- 演讲笔/遥控器控制
- 多主题配色
- 进度指示器

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
