# 宜搭普通自定义页面样式实现适配

> **本文件是平台 JSX 组件页面的 token / 组件实现适配层（数值层）**：提供色彩、圆角、字体、间距的具体值与组件模板，不产出配色、视觉 DNA 或页面风格。设计事实唯一来自 `yida-design` 输出的 `prd.md` 与 `design.md`；本文件只负责把 `design.md` 的视觉方向落到平台 JSX 组件页面的内联样式、Tailwind className、组件和状态上。

> 宜搭自定义页面默认使用 Tailwind utility `className` 组织视觉层，并保留内联 `style` 兜底。不能使用 CSS 文件、CSS Modules、shadcn/ui 或构建期样式方案。

> 原因：宜搭自定义页面运行在单文件环境中，不能像普通 React 项目一样 `import` CSS。Tailwind 通过 `@tailwindcss/browser` 运行时脚本加载，默认使用已验证的 `g.alicdn.com` 地址，并开启 preflight 重置原生控件外观；关键控件仍要有 JavaScript `style` 兜底。

> **响应式适配**：所有样式应根据 `this.utils.isMobile()` 判断设备类型后分别应用 PC 端和移动端的样式值。下文组件样式模板中标注了 mobile/pc 差异。

## 设计执行清单

实现前先用这一组规则统一检查页面实现；视觉方向由 `yida-design` 决定，本文件只负责把方向落到平台 JSX 组件页面的 token、组件和状态上。

1. **任务路径清晰**：页面标题、主操作、次操作、空状态入口和错误恢复入口一眼可见。
2. **场景模式一致**：同类列表、详情、看板、工作台使用一致的信息层级、按钮位置和状态表达。
3. **响应式完整**：用 `this.utils.isMobile()` 区分 PC / 移动端布局、间距、表格呈现和操作入口。
4. **层次与留白明确**：主文字、次要文字、辅助文字有层级；卡片、表格和分组用 `border` / `boxShadow` / 背景区分；间距使用 4px 倍数。
5. **操作反馈完整**：按钮、链接、筛选项和行 hover / active / disabled 状态都有反馈；异步操作有 loading，空数据有可继续操作的提示。
6. **视觉性格明确**：主操作、链接、选中态使用平台品牌色变量或当前页面确认的品牌色；普通 light 页面保持轻量边框、低透明阴影和清晰对比。
7. **表达克制专业**：装饰性渐变、彩色光晕、模糊色块和渐变文字只在明确的品牌/活动场景使用；图标放在按钮、状态、导航等功能位置；界面文案和 JS 注释保持纯文本。

---

## 色彩系统

在 `renderJsx` 顶部定义语义色彩对象，全页复用：

> **主色说明**
>
> | 内容 | 使用方式 | 落地规则 |
> | --- | --- | --- |
> | 平台品牌色变量 | `--color-brand1-*` 是平台层品牌色变量；`--color-brand1-6` 是主色，`--color-brand1-1/2/3` 是浅底，`--color-brand1-7/9/10` 是深档或透明档 | 真实业务页的主操作、链接、选中态、信息提示和标签默认读取这些平台变量 |
> | 页面重构与局部美化 | 以当前应用主题为基准 | 优先调整布局、密度、间距、层级、素材、图标表达和局部辅助色 |
> | 语义色 | 成功、警告、错误使用固定色 | 保持状态含义稳定，不跟随品牌色随意变化 |
> | 大面积浅底 | 下拉选中项、提示块等使用页面级低透明度 token | 优先使用 `--oyd-control-selected-bg` / `--oyd-control-info-bg` |
>
> **light 模式用色**：业务协同表、数据管理页、录入表、工作台和门户在 light 模式下使用深色正文保证可读性，强调、选中、按钮、焦点和批量操作使用平台品牌色变量或当前页面确认的品牌色，边框使用浅色品牌混合。
>
> ⚠️ **常见错误**：把 `primaryHover` 设成 `brand1-1`（最浅档）会让填充主按钮 hover 时「泛白」；把 `hover` 设成 `brand1-9`（深档）当行 hover 底会让行「变暗」。填充按钮 hover 要比主色**亮一档**（`brand1-5`）、按下**深一档**（`brand1-7`）；通用浅色 hover 底用 `brand1-1`。

```javascript
export function renderJsx() {
  var colors = {
    primary:       'var(--color-brand1-6)',  // 主色，用于主操作按钮、链接、选中态高亮
    primaryHover:  'var(--color-brand1-5)',  // 主色 hover：填充按钮/链接 hover，比主色亮一档
    primaryActive: 'var(--color-brand1-7)',  // 主色按下：填充按钮 active，比主色深一档
    hover:         'var(--color-brand1-1)',  // 通用浅色 hover 底：列表行 hover、菜单项 hover
    active:        'var(--color-brand1-2)',  // 通用浅色激活/按下底
    disabled:      'var(--color-brand1-3)',  // 禁用态：浅、去饱和
    primaryLight:  'var(--color-brand1-2)',  // 主色浅背景：选中行底色、标签高亮背景
    controlSelectedBg: 'var(--oyd-control-selected-bg, rgba(47,111,237,.08))', // native 控件选中浅底
    controlInfoBg:     'var(--oyd-control-info-bg, rgba(47,111,237,.08))',     // native 提示块浅底

    // 语义色（固定，不随主题变）
    success:        '#52C41A',
    successLight:   '#F6FFED',
    warning:        '#FAAD14',
    warningLight:   '#FFFBE6',
    error:          '#FF4D4F',
    errorLight:     '#FFF2F0',
    // info = 平台品牌信息色
    info:           'var(--color-brand1-6)',
    infoLight:      'var(--color-brand1-1)',

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
  background: 'var(--color-brand1-6)',  // 主色来自平台层品牌色变量
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
  fontWeight: 400,
  color: '#1D2129',
  background: '#FFFFFF',
  outline: 'none',
  boxShadow: 'none',
  appearance: 'none',
  WebkitAppearance: 'none',
  boxSizing: 'border-box',
},
```

页面需要同时保留 native 控件 reset（例如 `openyida-native-control-reset`），统一 input/textarea/select/自定义下拉的 `:focus` 边框和 ring。不要依赖浏览器默认 focus 样式，也不要使用会显得突兀的黑色粗边。reset 的 id 与 CSS 作用域必须匹配：通用 `.oyd-page` reset 可以刷新同名 style；自定义页面作用域必须使用页面专属 style id，避免其它 native 页已注入同名 style 后导致本页下拉菜单、SVG 勾选标记和按钮 reset 失效。

### 标签/徽章

```javascript
// 状态标签
tag: function(type) {
  var colorMap = {
    success: { color: '#52C41A', bg: '#F6FFED', border: '#B7EB8F' },
    warning: { color: '#FAAD14', bg: '#FFFBE6', border: '#FFE58F' },
    error:   { color: '#FF4D4F', bg: '#FFF2F0', border: '#FFCCC7' },
    info:    { color: 'var(--color-brand1-6)', bg: 'var(--color-brand1-1)', border: 'var(--color-brand1-3)' },
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

> 注：上文「统一 `borderRadius: 8px`」是数值兜底，不代表全页只能一个圆角性格。圆角**性格**（直角/微圆 vs 标准圆 vs 圆润）由 `yida-design` 按气质选定后，再在本文件圆角系统里取分层数值。
