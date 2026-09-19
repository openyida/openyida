---
name: "{{PROJECT_NAME}}"
description: "不对称二比一工作区与粗线信息带；方角、粗墨线、硬偏移阴影。适合活动执行、创意制作与品牌运营。"
themeId: "app-pop"
tokens:
  application-global:
    appearance:
      surfaces:
        "--pod-app-root-bg-color": "#ffde59"
        "--pod-app-root-bg-image": "none"
        "--pod-page-bg-color": "#ffde59"
        "--pod-card-bg-color": "#fffdf6"
        "--pod-table-cell-color": "var(--pod-card-bg-color)"
      navigation:
        "--pod-shell-theme-bg-color": "#fffdf6"
        "--pod-nav-item-text-color": "#211c21"
        "--pod-nav-item-text-hover-color": "#211c21"
        "--pod-nav-item-text-selected-color": "#211c21"
        "--pod-nav-menu-bg-hover-color": "#ffde59"
        "--pod-nav-menu-bg-selected-color": "#ffde59"
      native-form:
        "--form-element-medium-corner": "0px"
        "--form-element-medium-height": "46px"
        "--form-element-medium-font-size": "14px"
        "--input-bg-color": "#fffdf6"
        "--input-border-width": "3px"
        "--input-border-color": "#211c21"
        "--input-hover-border-color": "var(--color-brand1-6)"
        "--input-focus-border-color": "var(--color-brand1-6)"
        "--input-hover-bg-color": "#fffdf6"
        "--input-focus-bg-color": "#fffdf6"
        "--pod-form-label-color": "#211c21"
        "--form-top-label-margin-b": "8px"
        "--yida-form-content-bgcolor": "#fffdf6"
        "--pod-page-content-max-width": "1000px"
        "--pod-page-border-radius": "0px"
        "--pod-page-footer-bg-color": "#fffdf6"
        "--pod-page-footer-border-radius": "0px"
        "--pod-sticky-footer-box-shadow": "4px 4px 0 #211c21"
        "--pod-formView-stickyFooter-bg-color": "#ffde59"
        "--pod-formView-stickyFooter-box-shadow": "none"
        "--pod-formView-stickyFooter-border": "none"
        "--pod-formView-stickyFooter-border-top": "1px solid #211c21"
        "--pod-formView-stickyFooter-height": "56px"
        "--pod-formView-stickyFooter-bottom": "8px"
        "--pod-field-preview-text-color": "#211c21"
        "--pod-field-preview-bg-color": "#fffdf6"
        "--pod-field-preview-border-radius": "0px"
        "--pod-field-preview-padding": "8px 12px"
        "--pod-field-preview-shadow": "none"
    colors:
      "--color-white": "var(--pod-card-bg-color)"
      "--color-brand1-1": "<生成实际色值：--color-brand1-6 88% + #FFFFFF 12%，sRGB 逐通道混合>"
      "--color-brand1-2": "<生成实际色值：--color-brand1-6 12% + #FFFFFF 88%，sRGB 逐通道混合>"
      "--color-brand1-3": "<生成实际色值：--color-brand1-6 4% + #FFFFFF 96%，sRGB 逐通道混合>"
      "--color-brand1-5": "<生成实际色值：--color-brand1-6 38% + #171717 62%，sRGB 逐通道混合>"
      "--color-brand1-6": "{{PRIMARY_COLOR}}"
      "--color-brand1-9": "<生成实际色值：--color-brand1-6 76% + #000000 24%，sRGB 逐通道混合>"
      "--color-brand1-10": "<生成实际色值：--color-brand1-6 26% + #202020 74%，sRGB 逐通道混合>"
      "--color-line1-1": "#211c21"
      "--color-line1-2": "#211c21"
      "--color-fill1-1": "#ffde59"
      "--color-fill1-2": "#ffde59"
      "--color-fill1-3": "#211c21"
      "--color-fill1-5": "#fffdf6"
      "--color-fill1-10": "#262626"
      "--color-text1-5": "#FFFFFF"
      "--color-text1-4": "#211c21"
      "--color-text1-10": "#211c21"
      "--color-text1-3": "#211c21"
      "--color-text1-2": "#858781"
      "--color-text1-1": "#211c21"
    typography:
      "--font-family-base": "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      "--font-size-subhead": "18px"
      "--font-weight-subhead": "500"
      "--font-lineheight-subhead": "1.3"
      "--font-size-body-2": "16px"
      "--font-weight-body-2": "500"
      "--font-lineheight-body-2": "1.45"
      "--font-size-body-1": "14px"
      "--font-weight-body-1": "400"
      "--font-lineheight-body-1": "1.5"
      "--font-size-table": "13px"
      "--font-weight-table": "400"
      "--font-lineheight-table": "1.45"
      "--font-size-caption": "12px"
      "--font-weight-caption": "400"
      "--font-lineheight-caption": "1.4"
    spacing:
      "--s-1": "4px"
      "--s-2": "8px"
      "--s-3": "12px"
      "--s-4": "16px"
      "--s-5": "20px"
      "--s-6": "24px"
      "--s-7": "28px"
      "--s-8": "32px"
      "--s-9": "36px"
      "--s-10": "40px"
    rounded:
      "--corner-zero": "0px"
      "--corner-1": "4px"
      "--corner-2": "6px"
      "--corner-3": "8px"
      "--corner-4": "10px"
      "--corner-5": "12px"
      "--corner-circle": "50%"
      "--corner-semicircle": "500px"
    shadow:
      "--shadow-1": "0px 2px 4px 0px rgba(0, 0, 0, 0.12)"
      "--shadow-2": "0px 4px 20px -1px rgba(0, 0, 0, 0.16)"
      "--shadow-3": "0px 10px 28px -2px rgba(0, 0, 0, 0.24)"
  custom-page:
    "--oyd-page-bg": "var(--pod-page-bg-color)"
    "--oyd-surface": "var(--pod-card-bg-color)"
    "--oyd-canvas-image": "var(--pod-app-root-bg-image)"
    "--oyd-ink": "var(--color-text1-4)"
    "--oyd-border": "var(--color-line1-2)"
    "--oyd-accent": "var(--color-brand1-6)"
    "--oyd-radius": "0px"
    "--oyd-content-width": "1000px"
    "--oyd-content-padding": "32px"
    "--oyd-field-gap": "26px"
    "--oyd-section-gap": "52px"
    "--oyd-heading-font": "var(--font-family-base)"
    "--oyd-heading-size": "44px"
    "--oyd-rule-style": "solid"
    "--oyd-layout-columns": "minmax(0, 8fr) minmax(0, 4fr)"
    "--oyd-surface-shadow": "4px 4px 0 #211c21"
applicationStyle:
  recipe: "application-style-v1"
  mode: "template"
---
# {{PROJECT_NAME}} design.md

## 1. 风格摘要

**波普印刷**

不对称二比一工作区与粗线信息带；方角、粗墨线、硬偏移阴影。适合活动执行、创意制作与品牌运营。

应用、自定义页面、原生表单、编辑与详情共用这一套视觉语言。业务内容来自 PRD，不复制示例行业、编号、标题或数据。色彩来源：{{COLOR_SOURCE}}；主色由 {{PRIMARY_COLOR}} 实例化，示范配色只是参考。

## 2. 页面视觉系统

### 2.1 表面、区块与层次

不对称二比一工作区与粗线信息带。方角、粗墨线、硬偏移阴影。画布消费 --oyd-page-bg，内容消费 --oyd-surface，文字消费 --oyd-ink，边界消费 --oyd-border。内容最大宽度 --oyd-content-width，内距 --oyd-content-padding；宽屏不放大成空白 KPI 卡。

### 2.2 应用导航

平台侧导航与内容表面保持连续；选中项用品牌色和明确文字，不靠图标猜测。 默认保留平台导航，菜单来自真实业务范围。只有需求确定自绘导航时才在 Canvas 实现结构。导航深浅与正文深浅分别决定。

### 2.3 页面标题与操作

大字印刷标题与偏置章号。标题字体消费 --oyd-heading-font 与 --oyd-heading-size，辅助说明按正文层级。主操作与当前任务相邻；不堆造虚假标签、指标或章号。

### 2.4 布局和移动端

桌面业务工作区：不对称二比一工作区与粗线信息带。短字段建议 8:4，字段间距 26px、章节间距 52px、内容内距 32px；这些是项目起点，必须在每张表单设计中按字段长度确定。窄屏与半屏抽屉优先单列，介绍区在字段前面；长文本、附件和子表占整行。不把屏幕断点当 iframe 宽度，不用 fixed 卡片截断自然内容。

## 3. 基础组件表达

### 表单、表格与记录集合

单行控件 46px、圆角 0px，边框 3px；字段 labelAlign=top（标签在字段上方）。多行文本、附件、日期范围、子表按自身布局。详情使用相同章节顺序与表面，保留只读语义。表格为有真实数据的紧凑记录集合，不能给每个单元格加独立大卡。按钮、输入、浮层和导航消费同源色彩与形状。

### 原生结构与介绍区

大字印刷标题与偏置章号。原生表单用 ColumnContainer 的 8:4 栏比例承载业务字段；columnGap=26px、rowGap=26px、display=VERTICAL。介绍标题、说明由 Divider 的 title/description 承载，章节同样用 Divider；有语义的文案不能放到 CSS content。模板附有 form-layout.json，只示范结构，不创建虚假业务字段。若当前平台 Divider 不支持所需长说明或标题排版，降级成顶部标题说明并记录限制，不注入 HTML/JS。自定义页面可用语义 HTML 丰富同一版式。

### 组件状态

默认/hover/focus 同时配置边界和表面；键盘焦点保持可见。错误、警告、禁用沿用平台独立语义，不能被通用强调色覆盖；不得以全局 input 或 .next-* 强制改所有控件。表单样式由应用 CSS 发布，原生布局由 Schema 发布，禁止 didMount、style 标签或 iframe 跨文档注入。

### 底栏与对齐

普通提交按钮区使用 --pod-page-footer-bg-color 与 --pod-sticky-footer-box-shadow；数据管理、抽屉详情外层使用 --pod-formView-stickyFooter-bg-color 与 --pod-formView-stickyFooter-box-shadow。本风格按钮区跟随内容面，外层跟随画布，不叠加双阴影。底栏与正文共同消费 --pod-page-content-max-width。导航、无导航、管理内嵌、抽屉、移动端分别检查，不能全局覆盖 stickyFooter 的宽度与定位。

## 4. 特色表达配方

### R1 介绍与正文的关系

大字印刷标题与偏置章号。应用首页、内容详情与表单使用同一标题语法；只有任务确需上下文时展示介绍区。原生场景使用 form-layout.json，自定义页面可用 .oyd-style-intro 与 .oyd-style-section；外层 .oyd-style-workspace 中用 .oyd-style-layout 消费列比例，全宽区使用 .oyd-style-wide。介绍栏方案将介绍和正文作为网格的两个子项。伪元素只画空的装饰线，不承载可读内容。窄容器回到纵向阅读。

### R2 材质与信息密度

方角、粗墨线、硬偏移阴影。不对称二比一工作区与粗线信息带。图表、图片、时间线只为真实内容出现；没有媒体时以排版与章节构图成立，不为“丰富”捏造指标或入口。

## 5. 项目应用与调整规则

YAML Token 是唯一数值源。保留构图与材质语言，按业务调整主色、字段分组及信息密度；模板不是行业限制。

按每页写清页面任务、首屏焦点、布局、表面与组件、主操作、空/载/错态、响应式与验收。表单额外写列比例、标签位置、内距、字段与章节间距、介绍区位置和详情延续方式。原生 Schema 不会由 design.md 自动生成：实施时消费附带布局起点并填入真实字段；设计验收须比较 Schema 与设计。

{{PAGE_APPLICATIONS}}

### 验收

- [ ] 应用壳、Canvas、原生表单与详情的字体、线条、材质和状态一致。
- [ ] 正文与底栏对齐；四类容器与移动端无横向溢出。
- [ ] 文字/焦点/禁用/错误在实际背景上可辨，长说明与表格未裁切。
- [ ] 原生布局与逐页设计一致；没有加载代码、伪元素文案或 iframe 注入。
