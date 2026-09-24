---
name: "{{PROJECT_NAME}}"
description: "主题浅灰画布与白色柔圆面板构成浅色主体，少量近黑强调表面承托底缘光晕和半透明内层；细线图标、轻字重、胶囊筛选与有条件的色阶和条纹图形形成节奏。"
themeId: ink-glow-soft-panels
navTheme: light
tokens:
  application-global:
    appearance:
      surfaces:
        "--pod-app-root-bg-color": "var(--color-brand1-3)" # 主题派生浅灰；应用内部底色随主色变化
        "--pod-app-root-bg-image": "none" # 仅作用于应用根节点
        "--pod-page-bg-color": "var(--color-brand1-3)" # 主题派生浅灰；与近白面板形成低对比色差
        "--pod-card-bg-color": "#FCFCFC" # neutral-gray；浅色主容器
        "--pod-table-cell-color": "var(--pod-card-bg-color)"
      navigation:
        "--pod-nav-sub-divider-color": "#DEDEDE"
        "--pod-shell-theme-bg-color": "#FFFFFF"
        "--pod-nav-item-text-color": "#666666"
        "--pod-nav-item-text-hover-color": "#181818"
        "--pod-nav-item-text-selected-color": "#FFFFFF"
        "--pod-nav-menu-bg-hover-color": "var(--color-brand1-3)"
        "--pod-nav-menu-bg-selected-color": "var(--color-brand1-5)"
        "--pod-nav-menu-item-height": "40px"
        "--pod-nav-menu-item-radius": "8px"
        "--pod-nav-menu-item-selected-font-weight": "500"
        "--pod-nav-popup-bg-color": "var(--pod-shell-theme-bg-color)"
      native-form:
        "--form-element-medium-corner": "var(--corner-2)"
        "--form-element-medium-height": "var(--s-8)"
        "--form-element-medium-font-size": "var(--font-size-body-1)"
        "--input-bg-color": "var(--color-fill1-1)"
        "--input-border-width": "1px"
        "--input-border-color": "var(--color-line1-2)"
        "--input-hover-border-color": "var(--color-brand1-6)"
        "--input-focus-border-color": "var(--color-brand1-6)"
        "--input-hover-bg-color": "var(--input-bg-color)"
        "--input-focus-bg-color": "var(--input-bg-color)"
        "--pod-form-label-color": "var(--color-text1-4)"
        "--form-top-label-margin-b": "var(--s-2)"
        "--yida-divider-secondary-color": "var(--color-brand1-2)"
        "--yida-form-content-bgcolor": "var(--pod-page-bg-color)"
        "--pod-page-footer-bg-color": "var(--pod-card-bg-color)"
        "--pod-page-footer-border-radius": "var(--corner-5)"
        "--pod-sticky-footer-box-shadow": "none"
        "--pod-field-preview-min-height": "var(--form-element-medium-height)"
        "--pod-field-preview-padding": "0 8px"
        "--pod-field-preview-gap": "var(--s-1)"
        "--pod-field-preview-bg-color": "var(--color-fill1-1)"
        "--pod-field-preview-border-radius": "var(--corner-2)"
        "--pod-field-preview-indicator-color": "var(--color-fill1-3)"
        "--pod-field-preview-shadow": "none"
        "--pod-field-preview-text-color": "var(--color-text1-4)"
        "--pod-field-preview-line-height": "20px"
    colors:
      "--color-white": "var(--pod-card-bg-color)" # 全应用基础表面；跟随当前浅色卡片面，不承担固定白字
      "--color-brand1-1": "<生成实际色值：--color-brand1-6 88% + #FFFFFF 12%，sRGB 逐通道混合>" # 品牌交互悬停
      "--color-brand1-2": "<生成实际色值：--color-brand1-6 12% + #FFFFFF 88%，sRGB 逐通道混合>" # 平台预留品牌浅色
      "--color-brand1-3": "<生成实际色值：--color-brand1-6 4% + #F4F4F4 96%，sRGB 逐通道混合>" # 品牌派生浅灰；低比例染色保留与近白面板的层次
      "--color-brand1-5": "<生成实际色值：--color-brand1-6 6% + #080808 94%，sRGB 逐通道混合>" # 品牌派生深色；供需要主题暗色的角色引用，非导航专属色
      "--color-brand1-6": "{{PRIMARY_COLOR}}" # 唯一主题主色种子；按项目输入实例化，不保留固定色相兜底
      "--color-brand1-9": "<生成实际色值：--color-brand1-6 76% + #000000 24%，sRGB 逐通道混合>" # 品牌交互按下
      "--color-brand1-10": "<生成实际色值：--color-brand1-6 26% + #FFFFFF 74%，sRGB 逐通道混合>" # 品牌交互禁用
      "--color-line1-1": "#E9E9E9" # neutral-gray；弱分隔线与必要的图表辅助线
      "--color-line1-2": "#DADADA" # neutral-gray；常规控件边界与导航分隔
      "--color-fill1-1": "#F7F7F7" # neutral-gray；输入基础表面、中性悬停
      "--color-fill1-2": "#EEEEEE" # neutral-gray；中性按下或选中
      "--color-fill1-3": "#DEDEDE" # neutral-gray；较重中性填充、进度轨道
      "--color-fill1-5": "#FFFFFF" # neutral-gray；独立覆盖层
      "--color-fill1-6": "var(--color-text1-3)" # 弱图标与辅助操作 glyph 前景色
      "--color-fill1-10": "#262626" # neutral-gray；固定短 Tooltip 背景
      "--color-text1-5": "#FFFFFF" # neutral-gray；固定短 Tooltip 前景
      "--color-text1-4": "#161616" # neutral-gray；标题、主要正文与数值
      "--color-text1-10": "#626262" # neutral-gray；表头与 placeholder
      "--color-text1-3": "#666666" # neutral-gray；设计稿既定的说明、坐标轴与元信息前景
      "--color-text1-2": "#ADADAD" # neutral-gray；仅用于禁用文字
      "--color-text1-1": "#D6D6D6" # neutral-gray；仅用于水印文字
    typography:
      "--font-family-base": "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      "--font-size-subhead": "18px"
      "--font-weight-subhead": 500
      "--font-lineheight-subhead": 1.3
      "--font-size-body-2": "16px"
      "--font-weight-body-2": 500
      "--font-lineheight-body-2": 1.45
      "--font-size-body-1": "14px"
      "--font-weight-body-1": 400
      "--font-lineheight-body-1": 1.5
      "--font-size-table": "13px"
      "--font-weight-table": 400
      "--font-lineheight-table": 1.45
      "--font-size-caption": "12px"
      "--font-weight-caption": 400
      "--font-lineheight-caption": 1.4
    spacing:
      "--s-1": 4px
      "--s-2": 8px
      "--s-3": 12px
      "--s-4": 16px
      "--s-5": 20px
      "--s-6": 24px
      "--s-7": 28px
      "--s-8": 32px
      "--s-9": 36px
      "--s-10": 40px
    rounded:
      "--corner-zero": 0px # 贴边壳层、拼接区域
      "--corner-1": 4px # 热力单元、小图标底盒、紧凑标签
      "--corner-2": 12px # 常规输入、菜单项、矩形按钮
      "--corner-3": 16px # 浮层、气泡、弹窗外轮廓
      "--corner-4": 18px # 强调表面内层面板、独立柱形轮廓
      "--corner-5": 22px # 一级卡片、表单容器、强调区、抽屉
      "--corner-circle": 50% # 正圆头像、圆点与独立圆形图标操作
      "--corner-semicircle": 500px # 胶囊操作、搜索框、分段控件
    shadow:
      "--shadow-1": "0px 2px 4px 0px rgba(0, 0, 0, 0.12)"
      "--shadow-2": "0px 4px 20px -1px rgba(0, 0, 0, 0.16)"
      "--shadow-3": "0px 10px 28px -2px rgba(0, 0, 0, 0.24)"
  custom-page:
    colors:
      "--oyd-page-bg": "var(--pod-page-bg-color)"
      "--oyd-emphasis-bg": "var(--color-brand1-5)" # 主题派生近黑强调底，随主色换色
      "--oyd-emphasis-glow": "<生成实际色值：--color-brand1-6 76% + #080808 24%，sRGB 逐通道混合>" # 主题派生底缘光晕，不是状态色
      "--oyd-emphasis-text": "<生成实际色值：--color-brand1-6 3% + #FFFFFF 97%，sRGB 逐通道混合>" # 主题派生近白；深强调表面的主要前景
      "--oyd-emphasis-muted": "<生成实际色值：--color-brand1-6 8% + #C8C8C8 92%，sRGB 逐通道混合>" # 主题派生浅灰；深强调表面的次要前景
      "--oyd-glass-fill": "rgba(255, 255, 255, 0.10)" # 深表面上的透光薄层
      "--oyd-glass-line": "rgba(255, 255, 255, 0.26)" # 透光薄层细边界
      "--oyd-control-tint": "<生成实际色值：--color-brand1-6 5% + #F7F7F7 95%，sRGB 逐通道混合>" # theme-gray；胶囊分段轨道与轻量分类底
      "--oyd-data-step-0": "<生成实际色值：--color-brand1-6 2% + #F5F5F5 98%，sRGB 逐通道混合>" # 主题派生浅填充；已知零值，与缺失数据分开
      "--oyd-data-step-1": "<生成实际色值：--color-brand1-6 10% + #FFFFFF 90%，sRGB 逐通道混合>" # 连续强度色阶
      "--oyd-data-step-2": "<生成实际色值：--color-brand1-6 22% + #FFFFFF 78%，sRGB 逐通道混合>"
      "--oyd-data-step-3": "<生成实际色值：--color-brand1-6 38% + #FFFFFF 62%，sRGB 逐通道混合>"
      "--oyd-data-step-4": "<生成实际色值：--color-brand1-6 68% + #FFFFFF 32%，sRGB 逐通道混合>"
      "--oyd-data-step-5": "var(--color-brand1-6)" # 数据最高强度，独立于交互状态
      "--oyd-data-reference": "<生成实际色值：--color-brand1-6 18% + #080808 82%，sRGB 逐通道混合>" # 主题派生深实心对比系列，非负面状态
    materials:
      "--oyd-emphasis-surface": "radial-gradient(ellipse at 50% 125%, var(--oyd-emphasis-glow) 0%, var(--oyd-emphasis-bg) 72%)" # 推断参数；光在底缘聚集，上部维持主题派生近黑
    typography:
      "--oyd-display-title-size": "32px" # 推断；仅独立概览展示标题
      "--oyd-display-title-weight": 500
      "--oyd-display-title-lineheight": 1.2
      "--oyd-metric-size": "28px" # 推断；独立核心数值，不影响表格
      "--oyd-metric-weight": 400
      "--oyd-metric-lineheight": 1.2
---

# {{PROJECT_NAME}} design.md

## 1. 风格摘要

**墨底微光 · 柔圆面板（ink-glow-soft-panels）**

以低比例主题色染入的浅灰画布托起近白面板，浅色主体保持平静、舒展的阅读节奏。深色只用于少量需要明确强调的对象：主题派生近黑表面下缘聚集品牌色光晕，内部薄透面板露出下方色光。文字偏轻，边界偏细，面板、控件与数据单元各有圆角尺度。主题的辨识度来自明暗表面、低位光和薄层之间的关系，不依赖固定品牌色相。

| 核心特征 | 可见表现 | 主要偏离风险 |
| --- | --- | --- |
| 轻染底、白面、轻分隔 | 画布轻微染入主题色，内容面板近白；浅面板以留白和色差分层 | 全部改为纯白会抹平层次；厚边框或卡片重影会令页面显得拥挤 |
| 主题暗面底缘微光 | 强调对象上部保持暗色，光色贴近下边缘，白色文字清晰 | 满幅均匀渐变、霓虹外描边或全页深底会改变视觉重心 |
| 深底上的透光薄层 | 内部面板有细浅边和透明填充，光晕从下层透出 | 把浅色正文面板也玻璃化，或依赖强模糊，会削弱阅读稳定性 |
| 分工明确的柔圆形状 | 大面板柔圆，常规操作为圆角矩形，搜索和分段控件呈胶囊，小数据单元保留方形感 | 所有元素做成胶囊、所有嵌套层使用同一个大圆角，都会丢失节奏 |
| 克制的线条与图形编码 | 线性图标、轻字重；有相应数据时采用同色阶小方格或实心与条纹并置 | 粗描边、多色插画或无数据依据的装饰图表抢夺内容注意力 |

页面内容和主次由需求决定。普通表单或列表通过浅色层次、柔圆容器、细分隔和深色主要操作即可体现主题；透光强调区、热力单元和纹理对比仅在满足内容条件时启用。

## 2. 页面视觉系统

### 2.1 表面、区块与层次

浅色内容主要依靠色差和空间分区；深色强调区才引入透光材质。应用边缘不增加展示用彩色外框或大面积投影，实际页面随宿主窗口延展。所有色值以 YAML 为准，以下定义消费关系。

| 对象 | 背景与前景 | 边界、圆角及阴影 |
| --- | --- | --- |
| 应用根背景 | `--pod-app-root-bg-color`；背景图由 `--pod-app-root-bg-image` 独立控制 | 无展示外框、无整体悬浮投影；背景图仅作用于根节点 |
| 页面画布 | `--pod-page-bg-color`；自定义页通过 `--oyd-page-bg` 桥接；主要文字 `--color-text1-4` | 以浅灰主题染色区分近白面板，不额外叠加纹理 |
| 一级卡片、表单主容器、详情面板 | `--pod-card-bg-color`；正文 `--color-text1-4`，说明 `--color-text1-3` | `--corner-5`，默认无边框、无投影；相邻分区靠留白 |
| 表格正文 | `--pod-table-cell-color`；表头文字 `--color-text1-10` | 行间使用 `--color-line1-1`，无逐单元格圆角 |
| 内部分段、辅助信息 | 优先沿用所在面板；交互浅填充 `--color-fill1-1`，中性选中 `--color-fill1-2` | 需要分段时使用 `--color-line1-1`；不逐层加卡片与阴影 |
| 局部深色强调对象 | `--oyd-emphasis-bg` 兜底，`--oyd-emphasis-surface` 形成底缘光；前景 `--oyd-emphasis-text`、`--oyd-emphasis-muted` | 外部内容容器使用 `--corner-5`，通常无外投影；按钮沿用自身形状 |
| 深色对象内部的薄层 | `--oyd-glass-fill`，前景沿用强调表面配对 | 推断为 1px 的 `--oyd-glass-line`；内部面板 `--corner-4`，不默认依赖背景模糊 |
| 下拉、浮层、气泡、弹窗、弹出日历 | 独立白色 `--color-fill1-5`；文字 `--color-text1-4`、`--color-text1-3` | `--corner-3`、`--color-line1-1` 细边、`--shadow-2`；内部菜单项 `--corner-2` |
| 抽屉 | `--color-fill1-5`；使用浅表面的文字配对 | 暴露角使用 `--corner-5`，贴边角使用 `--corner-zero`；以 `--shadow-2` 区分覆盖关系 |
| 图表读数浮层、导航弹出层 | `--color-fill1-5`，主要读数 `--color-text1-4`，元信息 `--color-text1-3` | `--corner-3`、`--shadow-2`；从深表面弹出也保持独立白底 |
| 简短 Tooltip | 固定 `--color-fill1-10` 搭配 `--color-text1-5` | `--corner-3`，只承载简短提示，不借作多字段读数表面 |

普通内容卡片不使用投影。`--shadow-1` 仅用于确有浮起反馈的轻量操作，`--shadow-2` 用于覆盖层；`--shadow-3` 保留为平台档位，本主题默认不消费。深色透光面板也不额外加外发光；其边界应在暗部可见，亮部不能盖过文字。

### 2.2 应用导航

浅色导航以小圆角菜单和轻染色搜索区延续内容配色，当前入口采用深色底与白字形成局部焦点。

常驻导航优先沿用平台原始样式，通过主题文字、背景与字重区分状态。菜单 border、box-shadow 是可选覆盖，没有明确用途就不声明；不为了统一风格给每项加框或投影。普通入口融入同一侧栏，按连续目录组织；分组靠留白与文字层级，不把导航复制成输入框、独立按钮或卡片堆叠。内容卡片、主按钮和表单可以使用更强的形状与材质，同一主题不意味着所有组件装饰强度相同。业务确有触控或特殊展示需求时，在本 design.md 调整并验收，不在运行时限制项目自定义值。

菜单圆角可通过 --pod-nav-menu-item-radius 与内容层级配套。只有明确需要自定义边界时才声明 --pod-nav-menu-item-border、--pod-nav-menu-item-hover-border、--pod-nav-menu-item-selected-border，并检查状态切换不引起文字跳动；省略时保留平台原始表现。

导航与应用框架、表单、自定义页面和详情页共用设计语言。先按业务入口安排菜单、分组、搜索、品牌区与常用操作，再一起确定导航与正文的明暗、表面、字体、边界、圆角和密度。平台导航使用真实页面菜单；自绘导航按同一套导航 Token 实现。导航外观属于这份完整应用主题，颜色、三态边框、圆角、阴影与表单、详情和自定义页面一起设计。业务决定入口组织、操作频率与交互需求；主题决定这些需求的视觉表达。主色只是颜色角色之一，辅助色和材质色可以独立存在；仅显式 var 引用建立联动，不按主色批量染色。项目更换配色时，回到同一份 design.md 成组调整实际受影响的 Token，并核对五类界面的整体搭配。

导航底色使用 --pod-shell-theme-bg-color；普通、悬停和选中文字分别使用 --pod-nav-item-text-color、--pod-nav-item-text-hover-color、--pod-nav-item-text-selected-color；悬停和选中背景使用 --pod-nav-menu-bg-hover-color、--pod-nav-menu-bg-selected-color。图标跟随对应文字状态，当前入口同时用背景或字重表达。

菜单高度、圆角与间距使用 --pod-nav-menu-item-height、--pod-nav-menu-item-radius、--pod-nav-menu-gap；搜索、品牌区、分组和操作优先沿用平台已有的变量绑定，navigation 分组只声明本主题需要覆盖的差异。弹出菜单的底色、文字与搜索状态成组配套，导航与内容可以分别选择明暗。选中项通常沿用平台样式；仅需额外位置标记时才声明 --pod-nav-menu-item-selected-shadow，显式 none 用于有意关闭阴影。省略时不生成额外 box-shadow 规则；该 Token 独立于导航明暗。菜单高度、文字行高、内距和框架留白一起调整，给外阴影、长标题与键盘焦点留出空间。

桌面检查菜单、搜索、选中态与表单的协调；折叠后保留可识别图标和入口名称；窄屏保持菜单可展开、当前页面可定位、键盘焦点可见。提交、编辑、详情与自定义页都沿用这一导航设计。

### 2.3 页面标题与操作

标题区直接放在主题浅灰画布上，与下方近白面板形成层次，不再包一层空卡片。普通内容页标题使用全局分组标题规格；若真实页面存在独立概览展示标题，可启用页面层展示标题规格，保持轻字重、短行文案和充分留白。

现有主要操作与标题同一区域对齐，深色主按钮作为小面积视觉锚点，次要操作采用白色或中性浅表面。多个操作之间使用 `--s-2`，标题与内容面板之间使用 `--s-5` 或 `--s-6`。空间不足时操作换到标题下方，保持阅读顺序，标题不压缩为难以辨认的小字。

页面已有搜索、通知或账户入口时，可组合为轻量页头工具区：搜索呈长胶囊，独立图标操作为圆角方形，账户信息由头像、名称和说明组成。工具区不充当第二层导航；没有相关内容时不保留占位。具体位置与宽度在项目页面方案中确定。

### 2.4 排版、间距与形状

字体统一消费 `--font-family-base`，以常规和中等字重形成层级；中文使用该字体栈的系统回退。不通过放大图片导出倍率调整全局字体，也不依赖特定品牌字体才成立。

| 角色 | 字号 / 字重 / 行高 | 用法 |
| --- | --- | --- |
| 普通页面标题、面板标题 | `--font-size-subhead` / `--font-weight-subhead` / `--font-lineheight-subhead` | 深色或浅色表面各自使用对应主要前景 |
| 重要标签、组内主文本 | `--font-size-body-2` / `--font-weight-body-2` / `--font-lineheight-body-2` | 保持轻于粗黑展示字的观感 |
| 正文、导航、输入与操作 | `--font-size-body-1` / `--font-weight-body-1` / `--font-lineheight-body-1` | 信息密度的基础尺度 |
| 表格文本 | `--font-size-table` / `--font-weight-table` / `--font-lineheight-table` | 连续比较，行内主次不靠缩字实现 |
| 说明、坐标、元信息 | `--font-size-caption` / `--font-weight-caption` / `--font-lineheight-caption` | 通常为次要前景；不使用禁用色替代说明色 |
| 独立概览展示标题 | `--oyd-display-title-size` / `--oyd-display-title-weight` / `--oyd-display-title-lineheight` | 仅在项目明确安排展示标题时使用，不能替换所有原生页标题 |
| 独立核心数值 | `--oyd-metric-size` / `--oyd-metric-weight` / `--oyd-metric-lineheight` | 用于真实关键值；普通表格继续使用表格规格 |

数字使用等宽数字特性；相同口径统一精度、千分位和单位。独立大数值通常左对齐，表格数值按列对齐；较小单位与主值共享基线，说明另起一行。

页面内边距与主要面板内边距以 `--s-6` 为基准，紧凑区域用 `--s-4`；区块之间用 `--s-5`，标题到主体用 `--s-4`，相关内容之间用 `--s-2` 或 `--s-3`。密度调整优先改变留白与呈现范围，不更改固定字体或压缩点击对象。

形状按角色选择：一级容器 `--corner-5`，深底内层面板 `--corner-4`，浮层 `--corner-3`，普通输入与菜单 `--corner-2`，小图形与紧凑标签 `--corner-1`。搜索、分段选项及明确的胶囊操作使用 `--corner-semicircle`；正圆头像、圆形图标操作使用 `--corner-circle`。常规主要按钮保持圆角矩形，不因可点击就一律变胶囊。具体页面的宽度、列数、高度、对齐及窄屏顺序在第五部分确定。

### 2.5 色彩、图标与点缀

品牌色负责交互强调、主题暗面、导航强调、局部光色及数据强度色阶；画布随主色保持低饱和浅灰，内容中性灰保持无色相。连续数据使用专属强度色阶，不借用交互按下、悬停或禁用色；独立类别需要稳定的文字和图例，不能直接当作连续强度。成功、警告、错误、信息沿用平台已有状态语义。

图标采用同一线性家族，圆滑端点、轻描边，图标跟随其文字前景。推断的视觉规格为常用图标 18–20 CSS px、描边约 1.5 CSS px；侧边菜单或独立图标操作可使用接近 `--s-6` 的图形尺度。深色信息标签的图标可放入使用 `--oyd-glass-fill`、`--oyd-glass-line` 和 `--corner-1` 的小底盒；普通列表图标直接呈现，不逐个加装饰底。

深色材质使用 `--oyd-emphasis-surface`，暗部在上、光色在下；渐变位置与范围是实现推断，效果应表现为边缘泛光。主要操作可以复用这一表面，光色降低存在感以突出按钮文字。普通白面板、输入和表格不使用该渐变。

条纹只出现在有明确定义的图形系列中；强度色阶只表达真实数值，不生成随机图格。页面无需额外纹理照片、插画或装饰性光斑；账户头像存在时使用真实可用素材，缺失时使用平台默认占位。

## 3. 基础组件表达

本部分定义已有组件的主题表达，不构成页面必备组件清单。没有单独规定的组件按“任务结构 → 表面层级 → 文字角色 → 控件形状 → 状态表达”应用以上规则。

### 面板与分组

浅面板标题与已有筛选操作共用一个顶部区域，主体内容另起区段。普通表单以标签、控件和组间留白组织，避免每个字段再包卡片。信息详情优先利用同一表面内的细分隔线；同层分组无需强制等高。深色表面需要说明时使用 `--oyd-emphasis-muted`，不可沿用浅表面灰字。

### 按钮与图标操作

宜搭按钮按角色使用 `--s-7`、`--s-8`、`--s-9`、`--s-10` 四档高度。普通页级主操作优先最大档，紧凑行内操作使用较小档；相同区域保持一致。文本与图标间距为 `--s-2`，普通横向内边距为 `--s-4`。

自绘主按钮采用深色强调表面和 `--oyd-emphasis-text`，圆角使用 `--corner-2`；hover 时略增强底缘光，active 时减弱光晕，轮廓与文字位置保持稳定（状态推断）。原生品牌按钮遵循平台已有品牌映射，分别消费 `--color-brand1-6`、`--color-brand1-1`、`--color-brand1-9`、`--color-brand1-10`；不要求平台原生按钮支持局部光晕。

次要按钮使用中性基础表面、主要文字和必要的 `--color-line1-2` 细边。独立图标按钮有与当前按钮档位相同的方形点击区域，可按页面角色使用圆角矩形或正圆外观，不能只留下细小图标作为操作范围。无实际动作的数据标签不套按钮外观。

### 输入、搜索、选择与分段控件

输入与筛选采用 `--s-8`、`--s-9`、`--s-10` 三档高度，默认背景必须消费 `--color-fill1-1`；文字 `--color-text1-4`、占位 `--color-text1-10`，必要边界 `--color-line1-2`，常规形状 `--corner-2`。输入不会因放在白卡片上而改用卡片或覆盖层 Token。

搜索输入使用同一基础表面，外形可切换为 `--corner-semicircle`；左侧搜索图标与正文保持 `--s-2` 间距。只有真实支持快捷键时才出现快捷键标签，标签使用紧凑说明规格。

分段控件以 `--oyd-control-tint` 为轻染色轨道，采用胶囊形状；选中分段使用 `--color-white` 和主要文字，未选中分段使用次要文字，不使用重阴影。该轻染色是分段轨道的独立语义，普通中性菜单项的 selected 仍使用 `--color-fill1-2`。下拉选项在独立白色覆盖层内显示，前景使用设计稿确定的浅底深字配对。

### 标签、图标盒与进度

轻量分类标签可使用 `--oyd-control-tint`，文字为主要或次要前景，小圆角使用 `--corner-1`；胶囊筛选使用 `--corner-semicircle`。状态标签必须回到平台状态色与状态名称，不能把主题装饰色当作成功或完成。

深色信息单元中的图标底盒遵循第二部分的薄层规则，其视觉重量低于名称和数值。无任务依据时不额外制造图标框。线性进度轨道使用 `--color-fill1-3`，有效进度使用品牌色；若承载失败或警示含义则沿用平台状态色，保留明确数值或状态说明。

### 表格与记录列表

表格正文单元格背景使用 `--pod-table-cell-color`，通过 `var(--pod-card-bg-color)` 跟随卡片。表头与正文共用近白表面，表头文字为 `--color-text1-10`，行间只使用 `--color-line1-1` 水平细线；默认不加斑马纹与纵向网格。行内上下留白以 `--s-3` 为起点，双行名称与元信息自然增高，不设置遮住内容的固定行高。

姓名、对象名称或记录标题可组合前置线性图标或真实头像；次行元信息采用说明规格。数值和操作各自对齐，同列口径一致。行 hover 使用 `--color-fill1-1`，可选行的 selected 使用 `--color-fill1-2`，同时保留勾选或其他明确标记。连续比较、合并单元格或批量录入保持表格结构，不拆成逐行圆角卡片。

独立记录列表可以用行间留白和细分隔组织主次文字；只有任务要求每项独立成组时才使用独立面板。主题不要求列表复刻任何固定业务字段、人数或示例文案。

### 图形、图例与读数

图形优先采用有限主题同色阶、主题深色实心和明确纹理，文字标签保持中性。连续强度使用 `--oyd-data-step-0` 到 `--oyd-data-step-5`：零值只用零级，正值按照项目确定的阈值分入其余等级；图例展示完整范围和单位。缺失数据保留空位或明确缺失标记，不能涂成已知零值。

对比系列的深色使用 `--oyd-data-reference`，浅色可使用 `--oyd-data-step-1`，条纹使用 `--oyd-data-step-3` 搭配所在浅色表面。语义、排序与图例必须一致；不用随机颜色或填充样式表示未经定义的类别。必要的辅助线消费 `--color-line1-1`，避免粗坐标框抢夺图形。

多字段读数浮层使用独立覆盖层，不能把简短 Tooltip 深底作为复杂数据面板。图形、显示值与可读数据入口来自同一数据源；无值、零值、加载和错误分别表达，比例、量纲、时间域和比较基准明确。

### 交互与反馈状态

未展示状态按以下规则推断，实例化时配合实际平台验证：中性 hover 使用 `--color-fill1-1`，中性 active 或 selected 使用 `--color-fill1-2`，较重填充使用 `--color-fill1-3`；品牌操作使用对应 Brand 状态，深色主操作使用前述光晕强度变化。导航始终优先使用专用六色映射。

focus 使用清晰品牌边界或外环，与控件之间保留细小间隔；深色背景上保证轮廓可辨，不能只用微弱透明色。disabled 去除光晕和浮起反馈，文字使用 `--color-text1-2`，品牌控件使用 `--color-brand1-10`；水印文字色不参与普通反馈。error、warning、success、info 沿用平台已有的语义色、图标与说明，不新建同义页面 Token，也不臆造平台变量名。

空状态在已有容器内保留简短说明；加载使用静态浅填充或平台低强度反馈，不显示虚构指标。可点击项与纯展示项保持语义区分。色彩、边界和分段切换可采用约 150–180ms 的短过渡（推断），不使用循环光晕、弹跳或拖尾装饰。

### 表单组件与版式结构

原生表单与详情通过 appearance.native-form明确接入本主题：输入基础面使用 --color-fill1-1，边界使用 --color-line1-2，控件和只读数据框使用 --corner-2；焦点使用品牌交互角色。表单主面延续页面画布，操作底栏使用卡片表面与 --corner-5，详情保持正文前景与控件密度，不额外添加默认胶囊底栏或数据框阴影。项目有其他材质与状态需求时，在同一份 design.md 中调整对应 Token。

表单使用与自定义页面相同的应用全局样式，字体、色彩、表面、边界、圆角、密度和状态延续本主题。表单支持在顶部、左侧、主体、右侧和字段之间组合 Tab/切换、按钮组/操作入口、图片/图形、状态区、标题与 `Divider`、`ColumnContainer`、辅助内容和业务字段。各组件承担导航、操作、视觉焦点、反馈、层级、节奏、装饰或采集作用。普通业务分组和章节分隔使用 `Divider`，横向字段组合使用 `ColumnContainer`。每张表单在项目 `design.md` 写清组件位置与作用、列比例、标签位置、字段与章节间距、底栏、详情延续和窄屏重排。

## 4. 特色表达配方

### R1 底缘微光与透光信息组

**适用内容：** 页面存在明确优先级的摘要，且包含一组需要同时快速读取的真实关键值或短信息。普通字段较多、解释较长的内容不强行进入深底。

**继承基础：** 使用第二部分的强调表面、前景配对、透光薄层和数值规格，继承第三部分的面板分组与图标盒规则。

**特殊组合：** 容器标题和已有说明置于暗部；下方信息单元使用半透明填充和细浅边界，让底缘光自然穿过内层。每个单元按图标或名称、主值、必要说明组织，保持主值为阅读焦点。深区形成局部强对比，周围内容继续使用近白表面；数量、行列、宽度和高度在项目页面方案中确定，不固定为某个卡片数。窄宽度下让实际信息重新排列，不截掉主值。

**无匹配时：** 不创建摘要、统计或深色横幅；已有单条信息回到普通面板，主题仍通过基础表面和主要操作体现。

### R2 同色阶圆角密度矩阵

**适用内容：** 已有按日期或其他明确双维度聚合的数值，且任务需要观察分布、稀疏度或活跃区间。必须有明确的单元含义、时间域或轴域及等级阈值。

**继承基础：** 使用浅色面板、说明文字、专属数据色阶、图例及独立读数浮层，不引用交互状态色作为数据强度。

**特殊组合：** 等尺寸小方格使用 `--corner-1`，格间距以 `--s-1` 为起点；轴标签仅保留有助于定位的刻度，低值以很浅的色阶融入底面，高值形成有节奏的色块。图例按低到高排列，必要的已有范围或类型筛选可置于标题区，切换只改变真实聚合口径。单元尺寸与完整范围由项目确定；数据完整性优先于强行排成某种装饰形状。

**无匹配时：** 没有双维度数据就不绘制矩阵；单维度内容用普通列表或合适的基础图形。有缺失的单元明确表达缺失，不随机填格凑成完整画面。

### R3 实心与斜纹的紧凑对比

**适用内容：** 少量同量纲、可比较的真实数据系列，或共享比例分母和尺度的比率；系列区分本身具有业务意义。条纹的含义必须在图例或直接标签中定义，不自动代表预测、目标或未完成。

**继承基础：** 使用浅面板、数据系列色、文字规格与图形读数规则，统一比较基线和尺度。

**特殊组合：** 图形以主题深色实心、极浅同色系实心和浅色斜纹形成有限对比，每个系列有直接名称和数值。条纹参数推断为约 60° 倾角，实色与留白各约 4 CSS px；纹理只裁剪在真实图形范围内。柱形使用 `--corner-4` 的柔圆轮廓，数值标签放在图形上方或邻近位置，轻标签底消费 `--oyd-control-tint`。系列身份依靠标签与纹理共同辨认；长度、高度或面积必须与数值编码一致，不能为构图美观调整真实比例。

**无匹配时：** 不同分母或不同比较尺度的内容分开展示为普通数值，不并置成误导性的柱形。没有可比较数据时不新增系列或装饰柱。

## 5. 项目应用与调整规则

### 变量、平台与取值边界

YAML 是变量值的唯一来源；正文只定义角色和消费关系。全局变量供原生与自定义页面使用，页面层补充局部强调材质、连续数据编码和独立展示文字等缺失语义。提取时递归读取以双连字符开头的标量叶子，分组名不拼入 CSS 变量名。`--oyd-page-bg` 单向桥接全局页面底；平台基础与项目扩展均在主题中声明，可无环引用，并按实际设计补充变量。

需求确定实际内容和任务，平台约束决定可实现范围，主题规定表面与视觉关系。原生能力不足时保留实色表面、文字层级和独立导航配色；自绘材质不成为原生页面必须支持的接口。局部尺寸、渐变位置、条纹间隔和反馈强度为实现推断，不视为原稿物理像素的测量值；不放大整个全局排版去匹配图片导出尺寸。

### 品牌色与数据色实例化

- 色彩来源：{{COLOR_SOURCE}}。
- `{{PRIMARY_COLOR}}` 为唯一品牌种子；用户未提供品牌色时从项目已选品牌或明确的色彩来源确定并记录，不保留固定色相兜底；用户提供的种子优先，不静默替换。
- YAML 中所有“生成实际色值”标记均在生成项目文档时计算：将各颜色解析为 0–255 的 sRGB 三通道，对每个通道按标明比例相乘后求和，四舍五入至最近整数，输出六位十六进制；不先转换到线性光空间。按依赖顺序解析 Token 引用，完成计算后用实际值替换标记。
- 七个 Brand Token 分别保留悬停、平台预留浅色、派生浅色、派生深色、主色、按下及禁用语义。数据色阶有独立 Token，即使部分颜色接近品牌浅色，也不改为交互状态引用。
- `--oyd-control-tint` 是随品牌种子生成的 theme-gray，基底和比例已在 YAML 明示。内容中性灰为 neutral-gray；画布、主题暗面、光晕及深表面前景均从主色与无色相基底生成，维持浅色主体与深色局部的反差。
- 六项导航色保持独立角色，需要主题色的悬停与选中底引用对应 Brand Token；保留设计稿既定的文字和底色关系，不将内容 Text、Fill、页面、卡片或覆盖层 Token 绑定到导航。自绘导航的底缘光为可选装饰层，不能代替导航的基础可读性。
- 实例化保留设计稿既定的深浅表面、按钮前景及各状态配对；主题值按既定公式关联主色，不按主色亮度自动调整前景、底色明度或光晕范围。数据强度等级仍按真实数值顺序分配，状态色和独立分类色保留自身语义。

### 项目页面设计

仅为真实需求中存在的页面填入确定方案，每页包含以下内容，不根据配方反向制造业务：

- **页面内容：** 页面名称、任务、真实内容、实际字段与操作。
- **首屏印象：** 第一视觉焦点，以及形成它的明暗关系、构图、层次和留白。
- **布局安排：** 区块位置与主次、具体宽度与列数、必要高度与对齐关系、窄屏顺序及重排结果；只在任务需要时设置等高或局部滚动。
- **视觉表达：** 各区块的表面、组件与状态规则；实际采用的特色配方注明编号和位置。
- **标志性时刻：** 一处明确的静态画面或真实操作反馈，说明出现位置或触发条件、具体表现，以及如何帮助阅读或操作。

首屏印象与标志性时刻可以来自同一区域；普通表单或列表也可以通过浅色分区和深色主要操作形成清晰焦点。需要头像、标识或其他素材时，把来源、缺口处理及使用限制直接写入对应页面；不借用示例人物与业务数据。最终项目方案给出确定设计结果，不保留未完成的布局选择。

{{PAGE_APPLICATIONS}}

### 页面设计验收

以下为实际页面生成后的待执行验收，仅核对本页使用的内容：

- [ ] **首屏印象：** 焦点与主次符合方案，主题浅灰画布和近白面板关系成立，深色强调面积与真实任务的重要性相符。
- [ ] **布局安排：** 区块位置、比例、列数、高度、对齐与窄屏顺序符合逐页方案，内容自然增长时仍保持清晰层级。
- [ ] **风格表达：** 细分隔、柔圆分工与轻字重落到实际组件；使用深底时呈现低位光和可读前景，使用图形时纹理、色阶与数据语义一致。
- [ ] **标志性时刻：** 指定画面或反馈在约定位置或条件下出现，帮助理解内容或完成操作，不依赖虚构数据及额外装饰模块。
