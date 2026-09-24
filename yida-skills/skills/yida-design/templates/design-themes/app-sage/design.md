---
name: "{{PROJECT_NAME}}"
description: "宽松双列、纵向状态清单与柔和分区；柔绿表面、轻内凹、圆润控件。适合健康服务、员工关怀与资源协作。"
themeId: "app-sage"
tokens:
  application-global:
    appearance:
      surfaces:
        "--pod-app-root-bg-color": "#dce7df"
        "--pod-app-root-bg-image": "none"
        "--pod-page-bg-color": "#dce7df"
        "--pod-card-bg-color": "#eaf1ea"
        "--pod-table-cell-color": "var(--pod-card-bg-color)"
      navigation:
        "--pod-nav-sub-divider-color": "#A6BCA9"
        "--pod-shell-theme-bg-color": "#DBE7DB"
        "--pod-nav-item-text-color": "#345B49"
        "--pod-nav-item-text-hover-color": "#244633"
        "--pod-nav-item-text-selected-color": "#213E2E"
        "--pod-nav-menu-bg-hover-color": "#CBDECE"
        "--pod-nav-menu-bg-selected-color": "#BDCFBF"
        "--pod-nav-menu-item-height": "40px"
        "--pod-nav-menu-item-radius": "8px"
        "--pod-nav-menu-item-selected-font-weight": "600"
        "--pod-nav-menu-gap": "8px"
        "--pod-nav-popup-bg-color": "var(--pod-shell-theme-bg-color)"
      native-form:
        "--form-element-medium-corner": "16px"
        "--form-element-medium-height": "46px"
        "--form-element-medium-font-size": "14px"
        "--input-bg-color": "#eaf1ea"
        "--input-border-width": "1px"
        "--input-border-color": "#bfcebf"
        "--input-hover-border-color": "var(--color-brand1-6)"
        "--input-focus-border-color": "var(--color-brand1-6)"
        "--input-hover-bg-color": "#eaf1ea"
        "--input-focus-bg-color": "#eaf1ea"
        "--pod-form-label-color": "var(--color-text1-4)"
        "--form-top-label-margin-b": "8px"
        "--yida-divider-secondary-color": "var(--color-brand1-2)"
        "--yida-form-content-bgcolor": "#eaf1ea"
        "--pod-page-content-max-width": "900px"
        "--pod-page-border-radius": "16px"
        "--pod-page-footer-bg-color": "#eaf1ea"
        "--pod-page-footer-border-radius": "16px"
        "--pod-sticky-footer-box-shadow": "inset 0 1px 2px rgba(52,91,73,.10)"
        "--pod-formView-stickyFooter-bg-color": "#dce7df"
        "--pod-formView-stickyFooter-box-shadow": "none"
        "--pod-formView-stickyFooter-border": "none"
        "--pod-formView-stickyFooter-border-top": "1px solid #bfcebf"
        "--pod-formView-stickyFooter-height": "56px"
        "--pod-formView-stickyFooter-bottom": "8px"
        "--pod-field-preview-min-height": "32px"
        "--pod-field-preview-padding": "8px 12px"
        "--pod-field-preview-gap": "4px"
        "--pod-field-preview-bg-color": "#eaf1ea"
        "--pod-field-preview-border-radius": "16px"
        "--pod-field-preview-indicator-color": "var(--color-fill1-3)"
        "--pod-field-preview-shadow": "none"
        "--pod-field-preview-text-color": "var(--color-text1-4)"
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
      "--color-line1-1": "#bfcebf"
      "--color-line1-2": "#bfcebf"
      "--color-fill1-1": "#dce7df"
      "--color-fill1-2": "#dce7df"
      "--color-fill1-3": "#bfcebf"
      "--color-fill1-5": "#eaf1ea"
      "--color-fill1-6": "var(--color-text1-3)" # 弱图标与辅助操作 glyph 前景色
      "--color-fill1-10": "#262626"
      "--color-text1-5": "#FFFFFF"
      "--color-text1-4": "#294438"
      "--color-text1-10": "var(--color-text1-3)"
      "--color-text1-3": "#486352"
      "--color-text1-2": "#858781"
      "--color-text1-1": "#bfcebf"
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
      "--corner-1": "16px"
      "--corner-2": "16px"
      "--corner-3": "16px"
      "--corner-4": "16px"
      "--corner-5": "16px"
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
    "--oyd-radius": "16px"
    "--oyd-content-width": "900px"
    "--oyd-content-padding": "40px"
    "--oyd-field-gap": "30px"
    "--oyd-section-gap": "60px"
    "--oyd-heading-font": "var(--font-family-base)"
    "--oyd-heading-size": "32px"
    "--oyd-rule-style": "solid"
    "--oyd-layout-columns": "minmax(0, 6fr) minmax(0, 6fr)"
    "--oyd-surface-shadow": "inset 0 1px 2px rgba(52,91,73,.10)"
applicationStyle:
  recipe: "application-style-v1"
  mode: "template"
themeProfile:
  contentTone: "light"
  navTheme: "light"
---
# {{PROJECT_NAME}} design.md

## 1. 风格摘要

**植物浮雕**

宽松双列、纵向状态清单与柔和分区；柔绿表面、轻内凹、圆润控件。适合健康服务、员工关怀与资源协作。

导航、应用框架、自定义页面、表单、编辑与详情共用这一套视觉语言。业务内容来自 PRD，按实际行业、页面标题和数据设计。色彩来源：{{COLOR_SOURCE}}；主色由 {{PRIMARY_COLOR}} 实例化，品牌悬停色按同源占位说明生成；模板不固定项目品牌色。

## 2. 页面视觉系统

### 2.1 表面、区块与层次

正文、字段标签和详情值使用内容文字色，说明与占位文字使用辅助文字色；品牌色用于局部操作和数据强调，不把整页文字染成主色。

宽松双列、纵向状态清单与柔和分区。柔绿表面、轻内凹、圆润控件。画布消费 --oyd-page-bg，内容消费 --oyd-surface，文字消费 --oyd-ink，边界消费 --oyd-border。内容最大宽度 --oyd-content-width，内距 --oyd-content-padding；宽屏不放大成空白 KPI 卡。

### 2.2 应用导航

柔绿导航与植物表面连贯，浅绿选中底和深绿文字保持清晰；菜单采用小圆角和平整表面，圆润大控件留给表单与内容区。

常驻导航优先沿用平台原始样式，通过主题文字、背景与字重区分状态。菜单 border、box-shadow 是可选覆盖，没有明确用途就不声明；不为了统一风格给每项加框或投影。普通入口融入同一侧栏，按连续目录组织；分组靠留白与文字层级，不把导航复制成输入框、独立按钮或卡片堆叠。内容卡片、主按钮和表单可以使用更强的形状与材质，同一主题不意味着所有组件装饰强度相同。业务确有触控或特殊展示需求时，在本 design.md 调整并验收，不在运行时限制项目自定义值。

菜单圆角可通过 --pod-nav-menu-item-radius 与内容层级配套。只有明确需要自定义边界时才声明 --pod-nav-menu-item-border、--pod-nav-menu-item-hover-border、--pod-nav-menu-item-selected-border，并检查状态切换不引起文字跳动；省略时保留平台原始表现。

导航与应用框架、表单、自定义页面和详情页共用设计语言。先按业务入口安排菜单、分组、搜索、品牌区与常用操作，再一起确定导航与正文的明暗、表面、字体、边界、圆角和密度。平台导航使用真实页面菜单；自绘导航按同一套导航 Token 实现。导航外观属于这份完整应用主题，颜色、三态边框、圆角、阴影与表单、详情和自定义页面一起设计。业务决定入口组织、操作频率与交互需求；主题决定这些需求的视觉表达。主色只是颜色角色之一，辅助色和材质色可以独立存在；仅显式 var 引用建立联动，不按主色批量染色。项目更换配色时，回到同一份 design.md 成组调整实际受影响的 Token，并核对五类界面的整体搭配。

导航底色使用 --pod-shell-theme-bg-color；普通、悬停和选中文字分别使用 --pod-nav-item-text-color、--pod-nav-item-text-hover-color、--pod-nav-item-text-selected-color；悬停和选中背景使用 --pod-nav-menu-bg-hover-color、--pod-nav-menu-bg-selected-color。图标跟随对应文字状态，当前入口同时用背景或字重表达。

菜单高度、圆角与间距使用 --pod-nav-menu-item-height、--pod-nav-menu-item-radius、--pod-nav-menu-gap；搜索、品牌区、分组和操作优先沿用平台已有的变量绑定，navigation 分组只声明本主题需要覆盖的差异。弹出菜单的底色、文字与搜索状态成组配套，导航与内容可以分别选择明暗。选中项通常沿用平台样式；仅需额外位置标记时才声明 --pod-nav-menu-item-selected-shadow，显式 none 用于有意关闭阴影。省略时不生成额外 box-shadow 规则；该 Token 独立于导航明暗。菜单高度、文字行高、内距和框架留白一起调整，给外阴影、长标题与键盘焦点留出空间。

桌面检查菜单、搜索、选中态与表单的协调；折叠后保留可识别图标和入口名称；窄屏保持菜单可展开、当前页面可定位、键盘焦点可见。提交、编辑、详情与自定义页都沿用这一导航设计。 当前模板使用 contentTone: light、navTheme: light。

### 2.3 页面标题与操作

低对比色块介绍与圆弧分组。标题字体消费 --oyd-heading-font 与 --oyd-heading-size，辅助说明按正文层级。主操作与当前任务相邻；不堆造虚假标签、指标或章号。

### 2.4 布局和移动端

桌面业务工作区：宽松双列、纵向状态清单与柔和分区。短字段建议 6:6，字段间距 30px、章节间距 60px、内容内距 40px；这些是项目起点，必须在每张表单设计中按组件树和字段长度确定。窄屏与半屏抽屉按实际可用宽度重排顶部、左侧、主体、右侧及字段间区域，侧栏组件可移到主体前后或折叠为合适的窄屏结构；长文本、附件和子表通常占整行。不把屏幕断点当 iframe 宽度，不用 fixed 卡片截断自然内容。

### 2.5 自定义页面设计

自定义页面以 宽松双列、纵向状态清单与柔和分区 组织真实业务内容，以 低对比色块介绍与圆弧分组 建立标题与首屏焦点，并用 柔绿表面、轻内凹、圆润控件 统一页面表面。页面根据 PRD 安排标题与操作区、状态摘要、筛选、主要内容、上下文信息和反馈区；列表、表格、图表、详情抽屉和表单入口只在业务需要时出现。宽度、列数、高度和滚动方式按内容增长确定，移动端按阅读与操作顺序重排。

每个自定义页面逐页写清页面任务、首屏焦点、布局、表面与组件、主操作、状态、响应式和验收。状态覆盖加载、空、错误和无权限反馈及恢复动作；页面使用全局主题 token 落实当前风格，并为键盘焦点、纯图标按钮、非颜色状态表达和 reduced motion 提供可执行规则。

## 3. 基础组件表达

### 自定义页面组件与交互

页面标题、筛选、主操作、状态摘要、列表、表格、图表、详情抽屉和表单入口按真实任务组合。标题与操作保持清楚的主次和对齐；列表、表格与图表使用稳定容器高度或自然增长规则；详情抽屉保留上下文并提供明确返回路径。默认、hover、active、focus、loading、empty、error、disabled 和 selected 状态使用同一套表面、边界、文字与状态语义。

`YidaCodeCanvas` 页面在 `YidaComp` 内消费 --oyd-page-bg、--oyd-surface、--oyd-ink、--oyd-border、--oyd-accent、--oyd-radius、--oyd-content-width、--oyd-content-padding、--oyd-section-gap 和其他已声明 token。页面局部 CSS 只负责当前组件的布局和特色表达；应用全局样式统一作用于应用框架、表单、详情页和自定义页面等。

### 表单、表格与记录集合

单行控件 46px、圆角 16px，边框 1px；字段 labelAlign=top（标签在字段上方）。多行文本、附件、日期范围、子表按自身布局。详情页沿用相同章节顺序与表面；只读字段的数据框使用 --pod-field-preview-bg-color、--pod-field-preview-border-radius、--pod-field-preview-shadow、--pod-field-preview-indicator-color、--pod-field-preview-text-color、--form-element-medium-font-size、--pod-field-preview-gap、--pod-field-preview-line-height、--pod-field-preview-min-height 和 --pod-field-preview-padding，延续应用的色彩、形状、字体与密度。表格保持紧凑，按钮、输入、浮层和导航消费同源色彩与形状。

### 表单组件与版式结构

表单支持在顶部、左侧、主体、右侧和字段之间放置分栏、Divider、图片/图形、Tab/切换、按钮组/操作入口、状态区和字段。各组件分别承担导航、操作、视觉焦点、反馈、层级、节奏、装饰或采集作用。普通业务分组和章节分隔使用 Divider，横向字段组合使用 ColumnContainer。form-layout.json 提供 6:6 空字段列，columnGap=30px、rowGap=30px、display=VERTICAL；按任务与容器宽度补充组件并调整布局。不因主题名称自动套 3:9，不重复已有标题，不用空泛文案凑版式。

### 组件状态

默认/hover/focus 同时配置边界和表面；键盘焦点保持可见。错误、警告、禁用沿用平台独立语义，不能被通用强调色覆盖；不得以全局 input 或 .next-* 强制改所有控件。应用 CSS 配置表单、编辑和详情的视觉样式。

### 底栏与对齐

普通提交按钮区使用 --pod-page-footer-bg-color 与 --pod-sticky-footer-box-shadow；数据管理、抽屉详情外层使用 --pod-formView-stickyFooter-bg-color 与 --pod-formView-stickyFooter-box-shadow。本风格按钮区跟随内容面，外层跟随画布，不叠加双阴影。底栏与正文共同消费 --pod-page-content-max-width。导航、无导航、管理内嵌、抽屉、移动端分别检查，不能全局覆盖 stickyFooter 的宽度与定位。

## 4. 特色表达配方

### 材质与信息密度

柔绿表面、轻内凹、圆润控件。宽松双列、纵向状态清单与柔和分区。图表、图片、时间线只为真实内容出现；没有媒体时以排版与章节构图成立，不为“丰富”捏造指标或入口。

## 5. 项目应用与调整规则

YAML Token 是唯一数值源。沿用当前主题的构图与材质语言，按业务调整主色、字段分组及信息密度。

逐页记录页面任务、首屏焦点、布局、组件、主操作、状态、响应式与验收。表单按第 3 节补充组件作用、列比例、标签、间距、窄屏重排和详情延续方式；在 form-layout.json 中填入真实字段与所需组件，并对照 design.md 验收。

{{PAGE_APPLICATIONS}}

### 验收

- [ ] 导航、应用框架、Canvas、表单与详情的字体、线条、材质和状态一致。
- [ ] 正文与底栏对齐；四类容器与移动端无横向溢出。
- [ ] 文字/焦点/禁用/错误在实际背景上可辨，长说明与表格未裁切。
- [ ] 表单布局与逐页设计一致；组件、字段、主题和响应式规则均已核对。
