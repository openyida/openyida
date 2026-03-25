# 宜搭自定义页面设计规范

> 宜搭自定义页面**只能使用内联 style 对象**，不能使用 CSS 文件、Tailwind、shadcn/ui 等外部样式方案。以下规范已针对此约束做了适配，直接用 JS 对象定义样式即可。

## 设计哲学

参考 `frontend-design`、`elegant-design`、`design-systems` 等业界主流设计 skill 的核心原则，结合宜搭约束，遵循以下优先级：

1. **清晰优于聪明**：用户永远不应该困惑下一步做什么
2. **一致优于新奇**：相同场景使用相同的视觉模式
3. **移动优先**：用 `this.utils.isMobile()` 判断设备，响应式适配
4. **有意图的留白**：充足的间距比堆砌元素更专业
5. **避免 AI 平庸美学**：不要千篇一律的灰白配色 + 无衬线字体 + 圆角卡片

---

## 色彩系统

在 `renderJsx` 顶部定义语义色彩对象，全页复用：

> **主色说明**：宜搭平台已内置品牌色 CSS 变量，主色相关 token 直接使用平台变量，无需硬编码色值，可随平台主题自动适配。

```javascript
export function renderJsx() {
  var colors = {
    primary:      'var(--color-brand1-6)',  // 主色（品牌蓝），用于主操作按钮、链接、选中态高亮
    primaryHover: 'var(--color-brand1-1)',  // 主色悬停态，鼠标 hover 时的按钮/链接颜色
    hover:        'var(--color-brand1-9)',  // 通用悬停背景色，用于列表行 hover、菜单项 hover
    active:       'var(--color-brand1-9)',  // 通用激活/按下态，点击时的视觉反馈
    disabled:     'var(--color-brand1-8)',  // 禁用态颜色，用于不可操作的按钮、控件
    primaryLight: 'var(--color-brand1-2)',  // 主色浅背景，用于选中行底色、标签高亮背景    

    // 语义色
    success:        '#52C41A',
    successLight:   '#F6FFED',
    warning:        '#FAAD14',
    warningLight:   '#FFFBE6',
    error:          '#FF4D4F',
    errorLight:     '#FFF2F0',
    info:           '#1677FF',
    infoLight:      '#E6F4FF',

    // 中性色（从深到浅）
    text:           '#1D2129',  // 主文字
    textSecondary:  '#4E5969',  // 次要文字
    textTertiary:   '#86909C',  // 辅助文字、placeholder
    textDisabled:   '#C9CDD4',  // 禁用状态
    border:         '#E5E6EB',  // 边框
    borderLight:    '#F2F3F5',  // 浅边框、分割线
    bg:             '#F7F8FA',  // 页面背景
    bgCard:         '#FFFFFF',  // 卡片背景
  };
  // ...
}
```

> 色彩选取参考阿里 Arco Design 色板，与宜搭平台视觉风格保持一致。

---

## 圆角系统

| 值 | 使用场景 |
|----|---------|
| `6px`  | 小型 Badge、标签 |
| `8px`  | 输入框、开关控件、小头像（< 32px） |
| `12px` | 下拉菜单背景、小型卡片、菜单项、中头像（32px–48px） |
| `16px` | 下拉菜单容器、Tooltip、大头像（> 48px） |
| `24px` | 主要卡片、对话框、按钮、容器区域（强制统一） |

---

## 字体规范

```javascript
var typography = {
  // 字号（遵循 4px 倍数）
  fontSize: {
    xs:   '12px',  // 辅助说明、标签
    sm:   '13px',  // 次要内容
    base: '14px',  // 正文（宜搭默认）
    md:   '15px',  // 略强调
    lg:   '16px',  // 小标题
    xl:   '18px',  // 标题
    xxl:  '20px',  // 大标题
    h1:   '24px',  // 页面主标题
  },
  // 字重
  fontWeight: {
    normal:   400,
    medium:   500,
    semibold: 600,
    bold:     700,
  },
  // 行高
  lineHeight: {
    tight:  1.4,
    normal: 1.6,
    loose:  1.8,
  },
};
```

---

## 间距系统

以 **8px** 为基准单位，所有间距取其倍数：

```javascript
var spacing = {
  xs:   '4px',   // 紧凑元素内间距
  sm:   '8px',   // 小间距
  md:   '12px',  // 中间距
  lg:   '16px',  // 常规间距（卡片 padding）
  xl:   '20px',
  xxl:  '24px',  // 区块间距
  xxxl: '32px',  // 大区块间距
  page: '16px',  // 页面左右 padding（移动端）
};
```

---

## 常用组件样式模板

### 页面容器

```javascript
var styles = {
  page: {
    minHeight: '100vh',
    background: '#F7F8FA',
    padding: isMobile ? '12px' : '16px 24px',
    borderRadius: '0 !important',  // 清除宜搭默认圆角
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif',
    fontSize: '14px',
    color: '#1D2129',
    boxSizing: 'border-box',
  },
};
```

### 卡片

```javascript
card: {
  background: '#FFFFFF',
  borderRadius: '8px',
  border: '1px solid #E5E6EB',
  padding: isMobile ? '12px' : '16px',
  marginBottom: '12px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
},
cardTitle: {
  fontSize: '15px',
  fontWeight: 600,
  color: '#1D2129',
  marginBottom: '12px',
  paddingBottom: '10px',
  borderBottom: '1px solid #F2F3F5',
},
```

### 按钮

```javascript
// 主按钮
btnPrimary: {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 16px',
  height: '32px',
  background: '#1677FF',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  outline: 'none',
},
// 次要按钮
btnDefault: {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 16px',
  height: '32px',
  background: '#FFFFFF',
  color: '#1D2129',
  border: '1px solid #E5E6EB',
  borderRadius: '6px',
  fontSize: '14px',
  cursor: 'pointer',
  outline: 'none',
},
// 危险按钮
btnDanger: {
  background: '#FF4D4F',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: '6px',
  padding: '0 16px',
  height: '32px',
  cursor: 'pointer',
},
```

### 输入框

```javascript
input: {
  width: '100%',
  height: '32px',
  padding: '0 12px',
  border: '1px solid #E5E6EB',
  borderRadius: '6px',
  fontSize: '14px',
  color: '#1D2129',
  background: '#FFFFFF',
  outline: 'none',
  boxSizing: 'border-box',
},
```

### 标签/徽章

```javascript
// 状态标签
tag: function(type) {
  var colorMap = {
    success: { color: '#52C41A', bg: '#F6FFED', border: '#B7EB8F' },
    warning: { color: '#FAAD14', bg: '#FFFBE6', border: '#FFE58F' },
    error:   { color: '#FF4D4F', bg: '#FFF2F0', border: '#FFCCC7' },
    info:    { color: '#1677FF', bg: '#E6F4FF', border: '#91CAFF' },
    default: { color: '#4E5969', bg: '#F2F3F5', border: '#E5E6EB' },
  };
  var c = colorMap[type] || colorMap.default;
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
    color: c.color,
    background: c.bg,
    border: '1px solid ' + c.border,
  };
},
```

### 数据列表行

```javascript
listItem: {
  display: 'flex',
  alignItems: 'center',
  padding: '12px 0',
  borderBottom: '1px solid #F2F3F5',
},
listLabel: {
  width: '100px',
  flexShrink: 0,
  fontSize: '13px',
  color: '#86909C',
},
listValue: {
  flex: 1,
  fontSize: '14px',
  color: '#1D2129',
},
```

### 空状态

```javascript
empty: {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 16px',
  color: '#C9CDD4',
  fontSize: '14px',
},
```

---

## 设计反模式（禁止）

> 参考 `frontend-design` skill 的 anti-patterns 清单，结合宜搭场景整理：

❌ **禁止使用纯灰白 + 无边框的平淡布局**，至少加 `boxShadow` 或 `border` 区分层次  
❌ **禁止所有文字都用同一颜色**，主文字/次要文字/辅助文字应有明显区分  
❌ **禁止按钮没有视觉反馈**，hover/active 状态要有颜色变化  
❌ **禁止间距随意**，所有 margin/padding 必须是 4px 的倍数  
❌ **禁止卡片没有圆角**，统一使用 `borderRadius: '8px'`  
❌ **禁止忽略空状态**，列表/数据为空时必须有友好提示  
❌ **禁止忽略加载状态**，异步操作必须有 loading 反馈  
❌ **禁止移动端不适配**，所有页面必须用 `isMobile` 做响应式处理  
