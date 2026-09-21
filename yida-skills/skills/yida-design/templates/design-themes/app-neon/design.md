---
name: "{{PROJECT_NAME}}"
description: "横向监控总览与双列任务区；深海蓝层次、局部青色微光。适合明确要求暗色的技术值守。"
themeId: "app-neon"
tokens:
  application-global:
    appearance:
      surfaces:
        "--pod-app-root-bg-color": "#080f21"
        "--pod-app-root-bg-image": "radial-gradient(ellipse at 10% 0%, rgba(80,205,210,.14), transparent 55%), radial-gradient(ellipse at 90% 100%, rgba(139,93,228,.12), transparent 55%)"
        "--pod-page-bg-color": "#080f21"
        "--pod-card-bg-color": "#111b31"
        "--pod-table-cell-color": "var(--pod-card-bg-color)"
      navigation:
        "--pod-shell-theme-bg-color": "#0B142B"
        "--pod-nav-item-text-color": "#98CDCF"
        "--pod-nav-item-text-hover-color": "#B4F5F1"
        "--pod-nav-item-text-selected-color": "#08121E"
        "--pod-nav-menu-bg-hover-color": "#183149"
        "--pod-nav-menu-bg-selected-color": "#B4F5F1"
        "--pod-nav-menu-item-selected-shadow": "none"
        "--pod-page-header-bg-color": "var(--pod-shell-theme-bg-color)"
        "--pod-nav-l-sub-main-bg-color": "var(--pod-shell-theme-bg-color)"
        "--pod-nav-top-main-border-width": "1px"
        "--pod-nav-top-main-border-color": "#356274"
        "--pod-nav-top-tab-indicator-width": "0px"
        "--pod-nav-logo-text": "var(--pod-nav-item-text-hover-color)"
        "--pod-nav-logo-bg": "var(--pod-nav-menu-bg-selected-color)"
        "--pod-nav-logo-icon": "var(--pod-nav-item-text-selected-color)"
        "--pod-nav-logo-border": "1px solid #356274"
        "--pod-nav-logo-border-radius": "10px"
        "--pod-nav-sub-divider-color": "#356274"
        "--pod-nav-item-text-disabled-color": "rgba(255,255,255,.30)"
        "--pod-nav-l-container-bg": "var(--pod-shell-theme-bg-color)"
        "--pod-nav-l-group-label-color": "var(--pod-nav-item-text-color)"
        "--pod-nav-l-search-border-color": "#356274"
        "--pod-nav-popup-bg-color": "var(--pod-shell-theme-bg-color)"
        "--pod-nav-popup-border-radius": "10px"
        "--pod-nav-popup-shadow": "0 8px 24px rgba(4,12,28,.40)"
        "--pod-nav-tab-line-hover-color": "var(--pod-nav-item-text-hover-color)"
        "--pod-nav-tab-line-selected-color": "var(--pod-nav-item-text-hover-color)"
        "--pod-nav-search-bg-color": "var(--pod-nav-menu-bg-hover-color)"
        "--pod-nav-search-bg-hover-color": "var(--pod-nav-menu-bg-hover-color)"
        "--pod-nav-search-bg-active-color": "var(--pod-nav-menu-bg-hover-color)"
        "--pod-nav-search-placeholder-color": "var(--pod-nav-item-text-color)"
        "--pod-nav-search-text-color": "var(--pod-nav-item-text-hover-color)"
        "--pod-nav-search-icon-color": "var(--pod-nav-item-text-color)"
        "--pod-nav-search-border-color": "#356274"
        "--pod-nav-search-border-hover-color": "var(--pod-nav-item-text-hover-color)"
        "--pod-nav-search-border-active-color": "var(--pod-nav-item-text-hover-color)"
        "--pod-nav-action-icon-color": "var(--pod-nav-item-text-color)"
        "--pod-nav-action-border-color": "#356274"
        "--pod-nav-action-border": "1px solid #356274"
        "--pod-nav-action-bg-hover-color": "var(--pod-nav-menu-bg-hover-color)"
        "--pod-nav-action-bg-active-color": "var(--pod-nav-menu-bg-hover-color)"
        "--pod-nav-menu-item-height": "42px"
        "--pod-nav-menu-item-radius": "10px"
        "--pod-nav-menu-item-border": "1px solid #356274"
        "--pod-nav-menu-item-hover-border": "1px solid #98CDCF"
        "--pod-nav-menu-item-selected-border": "1px solid #B4F5F1"
        "--pod-nav-menu-font-size": "14px"
        "--pod-nav-menu-item-selected-font-weight": "600"
        "--pod-nav-menu-line-height": "20px"
        "--pod-nav-menu-gap": "6px"
        "--pod-shell-lshape-border-radius": "10px"
      native-form:
        "--form-element-medium-corner": "10px"
        "--form-element-medium-height": "44px"
        "--form-element-medium-font-size": "14px"
        "--input-bg-color": "#111b31"
        "--input-border-width": "1px"
        "--input-border-color": "#356274"
        "--input-hover-border-color": "var(--color-brand1-6)"
        "--input-focus-border-color": "var(--color-brand1-6)"
        "--input-hover-bg-color": "#111b31"
        "--input-focus-bg-color": "#111b31"
        "--pod-form-label-color": "#b4f5f1"
        "--form-top-label-margin-b": "8px"
        "--yida-form-content-bgcolor": "#111b31"
        "--pod-page-content-max-width": "1040px"
        "--pod-page-border-radius": "10px"
        "--pod-page-footer-bg-color": "#111b31"
        "--pod-page-footer-border-radius": "10px"
        "--pod-sticky-footer-box-shadow": "none"
        "--pod-formView-stickyFooter-bg-color": "#080f21"
        "--pod-formView-stickyFooter-box-shadow": "none"
        "--pod-formView-stickyFooter-border": "none"
        "--pod-formView-stickyFooter-border-top": "1px solid #356274"
        "--pod-formView-stickyFooter-height": "56px"
        "--pod-formView-stickyFooter-bottom": "8px"
        "--pod-field-preview-min-height": "32px"
        "--pod-field-preview-padding": "8px 12px"
        "--pod-field-preview-gap": "4px"
        "--pod-field-preview-bg-color": "#111b31"
        "--pod-field-preview-border-radius": "10px"
        "--pod-field-preview-indicator-color": "var(--color-fill1-3)"
        "--pod-field-preview-shadow": "none"
        "--pod-field-preview-text-color": "#b4f5f1"
        "--pod-field-preview-line-height": "20px"
    colors:
      "--color-white": "var(--pod-card-bg-color)"
      "--color-brand1-1": "<生成实际色值：--color-brand1-6 88% + #FFFFFF 12%，sRGB 逐通道混合>"
      "--color-brand1-2": "<生成实际色值：--color-brand1-6 12% + #FFFFFF 88%，sRGB 逐通道混合>"
      "--color-brand1-3": "<生成实际色值：--color-brand1-6 4% + #FFFFFF 96%，sRGB 逐通道混合>"
      "--color-brand1-5": "<生成实际色值：--color-brand1-6 38% + #171717 62%，sRGB 逐通道混合>"
      "--color-brand1-6": "{{PRIMARY_COLOR}}"
      "--color-brand1-9": "<生成实际色值：--color-brand1-6 76% + #000000 24%，sRGB 逐通道混合>"
      "--color-brand1-10": "<生成实际色值：--color-brand1-6 26% + #202020 74%，sRGB 逐通道混合>"
      "--color-line1-1": "#356274"
      "--color-line1-2": "#356274"
      "--color-fill1-1": "#080f21"
      "--color-fill1-2": "#080f21"
      "--color-fill1-3": "#356274"
      "--color-fill1-5": "#111b31"
      "--color-fill1-10": "#262626"
      "--color-text1-5": "#FFFFFF"
      "--color-text1-4": "#b4f5f1"
      "--color-text1-10": "#b4f5f1"
      "--color-text1-3": "#b4f5f1"
      "--color-text1-2": "#7f8986"
      "--color-text1-1": "#356274"
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
      "--corner-1": "10px"
      "--corner-2": "10px"
      "--corner-3": "10px"
      "--corner-4": "10px"
      "--corner-5": "10px"
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
    "--oyd-radius": "10px"
    "--oyd-content-width": "1040px"
    "--oyd-content-padding": "32px"
    "--oyd-field-gap": "22px"
    "--oyd-section-gap": "44px"
    "--oyd-heading-font": "var(--font-family-base)"
    "--oyd-heading-size": "32px"
    "--oyd-rule-style": "solid"
    "--oyd-layout-columns": "minmax(0, 6fr) minmax(0, 6fr)"
    "--oyd-surface-shadow": "none"
applicationStyle:
  recipe: "application-style-v1"
  mode: "template"
themeProfile:
  contentTone: "dark"
  navTheme: "dark"
---
# {{PROJECT_NAME}} design.md

## 1. 风格摘要

**午夜霓虹**

横向监控总览与双列任务区；深海蓝层次、局部青色微光。适合明确要求暗色的技术值守。

导航、应用框架、自定义页面、表单、编辑与详情共用这一套视觉语言。业务内容来自 PRD，按实际行业、页面标题和数据设计。色彩来源：{{COLOR_SOURCE}}；主色由 {{PRIMARY_COLOR}} 实例化，品牌悬停色按同源占位说明生成；模板不固定项目品牌色。

## 2. 页面视觉系统

### 2.1 表面、区块与层次

横向监控总览与双列任务区。深海蓝层次、局部青色微光。画布消费 --oyd-page-bg，内容消费 --oyd-surface，文字消费 --oyd-ink，边界消费 --oyd-border。内容最大宽度 --oyd-content-width，内距 --oyd-content-padding；宽屏不放大成空白 KPI 卡。

### 2.2 应用导航

深海蓝导航配青色文字，当前菜单以浅青底深字形成局部微光；搜索和弹层延续技术工作区的蓝色层次。

菜单轮廓使用 --pod-nav-menu-item-radius、--pod-nav-menu-item-border、--pod-nav-menu-item-hover-border、--pod-nav-menu-item-selected-border。侧栏和顶部菜单共用轮廓，各状态保持相同边框宽度，文字位置稳定；具体数值以本项目 Token 为准。

导航与应用框架、表单、自定义页面和详情页共用设计语言。先按业务入口安排菜单、分组、搜索、品牌区与常用操作，再一起确定导航与正文的明暗、表面、字体、边界、圆角和密度。平台导航使用真实页面菜单；自绘导航按同一套导航 Token 实现。命名模板沿用自身 navTheme，换主色保持导航明暗与内容画布；需要另一导航明暗时改选主题，自由创意按项目明确设计。

导航底色使用 --pod-shell-theme-bg-color；普通、悬停和选中文字分别使用 --pod-nav-item-text-color、--pod-nav-item-text-hover-color、--pod-nav-item-text-selected-color；悬停和选中背景使用 --pod-nav-menu-bg-hover-color、--pod-nav-menu-bg-selected-color。图标跟随对应文字状态，当前入口同时用背景或字重表达。

菜单高度、圆角与间距使用 --pod-nav-menu-item-height、--pod-nav-menu-item-radius、--pod-nav-menu-gap；搜索、品牌区、分组、操作和弹出菜单使用 navigation 分组中的对应 Token。弹出菜单的底色、文字与搜索状态成组配套，导航与内容可以分别选择明暗。选中项使用 --pod-nav-menu-item-selected-shadow：none 关闭额外标记，完整 box-shadow 值可表达左、右或底部内阴影，不占据菜单布局空间；该 Token 独立于导航明暗。菜单高度、文字行高、内距和框架留白一起调整，给外阴影、长标题与键盘焦点留出空间。

桌面检查菜单、搜索、选中态与表单的协调；折叠后保留可识别图标和入口名称；窄屏保持菜单可展开、当前页面可定位、键盘焦点可见。提交、编辑、详情与自定义页都沿用这一导航设计。 当前模板使用 contentTone: dark、navTheme: dark。

### 2.3 页面标题与操作

小号技术编号与发光横线。标题字体消费 --oyd-heading-font 与 --oyd-heading-size，辅助说明按正文层级。主操作与当前任务相邻；不堆造虚假标签、指标或章号。

### 2.4 布局和移动端

桌面业务工作区：横向监控总览与双列任务区。短字段建议 6:6，字段间距 22px、章节间距 44px、内容内距 32px；这些是项目起点，必须在每张表单设计中按组件树和字段长度确定。窄屏与半屏抽屉按实际可用宽度重排顶部、左侧、主体、右侧及字段间区域，侧栏组件可移到主体前后或折叠为合适的窄屏结构；长文本、附件和子表通常占整行。不把屏幕断点当 iframe 宽度，不用 fixed 卡片截断自然内容。

### 2.5 自定义页面设计

自定义页面以 横向监控总览与双列任务区 组织真实业务内容，以 小号技术编号与发光横线 建立标题与首屏焦点，并用 深海蓝层次、局部青色微光 统一页面表面。页面根据 PRD 安排标题与操作区、状态摘要、筛选、主要内容、上下文信息和反馈区；列表、表格、图表、详情抽屉和表单入口只在业务需要时出现。宽度、列数、高度和滚动方式按内容增长确定，移动端按阅读与操作顺序重排。

每个自定义页面逐页写清页面任务、首屏焦点、布局、表面与组件、主操作、状态、响应式和验收。状态覆盖加载、空、错误和无权限反馈及恢复动作；页面使用全局主题 token 落实当前风格，并为键盘焦点、纯图标按钮、非颜色状态表达和 reduced motion 提供可执行规则。

## 3. 基础组件表达

### 自定义页面组件与交互

页面标题、筛选、主操作、状态摘要、列表、表格、图表、详情抽屉和表单入口按真实任务组合。标题与操作保持清楚的主次和对齐；列表、表格与图表使用稳定容器高度或自然增长规则；详情抽屉保留上下文并提供明确返回路径。默认、hover、active、focus、loading、empty、error、disabled 和 selected 状态使用同一套表面、边界、文字与状态语义。

`YidaCodeCanvas` 页面在 `YidaComp` 内消费 --oyd-page-bg、--oyd-surface、--oyd-ink、--oyd-border、--oyd-accent、--oyd-radius、--oyd-content-width、--oyd-content-padding、--oyd-section-gap 和其他已声明 token。页面局部 CSS 只负责当前组件的布局和特色表达；应用全局样式统一作用于应用框架、表单、详情页和自定义页面等。

### 表单、表格与记录集合

单行控件 44px、圆角 10px，边框 1px；字段 labelAlign=top（标签在字段上方）。多行文本、附件、日期范围、子表按自身布局。详情页沿用相同章节顺序与表面；只读字段的数据框使用 --pod-field-preview-bg-color、--pod-field-preview-border-radius、--pod-field-preview-shadow、--pod-field-preview-indicator-color、--pod-field-preview-text-color、--form-element-medium-font-size、--pod-field-preview-gap、--pod-field-preview-line-height、--pod-field-preview-min-height 和 --pod-field-preview-padding，延续应用的色彩、形状、字体与密度。表格保持紧凑，按钮、输入、浮层和导航消费同源色彩与形状。

### 表单组件与版式结构

表单支持在顶部、左侧、主体、右侧和字段之间放置分栏、Divider、图片/图形、Tab/切换、按钮组/操作入口、状态区和字段。各组件分别承担导航、操作、视觉焦点、反馈、层级、节奏、装饰或采集作用。普通业务分组和章节分隔使用 Divider，横向字段组合使用 ColumnContainer。form-layout.json 提供 6:6 空字段列，columnGap=22px、rowGap=22px、display=VERTICAL；按任务与容器宽度补充组件并调整布局。不因主题名称自动套 3:9，不重复已有标题，不用空泛文案凑版式。

### 组件状态

默认/hover/focus 同时配置边界和表面；键盘焦点保持可见。错误、警告、禁用沿用平台独立语义，不能被通用强调色覆盖；不得以全局 input 或 .next-* 强制改所有控件。应用 CSS 配置表单、编辑和详情的视觉样式。

### 底栏与对齐

普通提交按钮区使用 --pod-page-footer-bg-color 与 --pod-sticky-footer-box-shadow；数据管理、抽屉详情外层使用 --pod-formView-stickyFooter-bg-color 与 --pod-formView-stickyFooter-box-shadow。本风格按钮区跟随内容面，外层跟随画布，不叠加双阴影。底栏与正文共同消费 --pod-page-content-max-width。导航、无导航、管理内嵌、抽屉、移动端分别检查，不能全局覆盖 stickyFooter 的宽度与定位。

## 4. 特色表达配方

### 材质与信息密度

深海蓝层次、局部青色微光。横向监控总览与双列任务区。图表、图片、时间线只为真实内容出现；没有媒体时以排版与章节构图成立，不为“丰富”捏造指标或入口。

## 5. 项目应用与调整规则

YAML Token 是唯一数值源。沿用当前主题的构图与材质语言，按业务调整主色、字段分组及信息密度。

逐页记录页面任务、首屏焦点、布局、组件、主操作、状态、响应式与验收。表单按第 3 节补充组件作用、列比例、标签、间距、窄屏重排和详情延续方式；在 form-layout.json 中填入真实字段与所需组件，并对照 design.md 验收。

{{PAGE_APPLICATIONS}}

### 验收

- [ ] 导航、应用框架、Canvas、表单与详情的字体、线条、材质和状态一致。
- [ ] 正文与底栏对齐；四类容器与移动端无横向溢出。
- [ ] 文字/焦点/禁用/错误在实际背景上可辨，长说明与表格未裁切。
- [ ] 表单布局与逐页设计一致；组件、字段、主题和响应式规则均已核对。
