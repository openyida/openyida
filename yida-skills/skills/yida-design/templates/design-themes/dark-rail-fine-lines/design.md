---
name: "{{PROJECT_NAME}}"
description: "独立导航与白色工作区形成分区；细边线、平整白面和疏朗行距组织内容，主题色深色信息与少量品牌色建立焦点，胶囊操作、灰色数据参照和局部斜纹补充细节。"
themeId: dark-rail-fine-lines
navTheme: dark
tokens:
  application-global:
    appearance:
      surfaces:
        "--pod-app-root-bg-color": "#FFFFFF" # neutral-gray；应用根背景兜底
        "--pod-app-root-bg-image": "none" # 仅作用于根节点；本主题不使用背景图
        "--pod-page-bg-color": "#FFFFFF" # neutral-gray；白色内容画布
        "--pod-card-bg-color": "#FFFFFF" # neutral-gray；一级内容表面
        "--pod-table-cell-color": "var(--pod-card-bg-color)" # 表格正文跟随卡片表面
      navigation:
        "--pod-shell-theme-bg-color": "#1B1B1B"
        "--pod-nav-item-text-color": "#A0A0A0"
        "--pod-nav-item-text-hover-color": "#E7E7E7"
        "--pod-nav-item-text-selected-color": "#FFFFFF"
        "--pod-nav-menu-bg-hover-color": "#272727"
        "--pod-nav-menu-bg-selected-color": "#323232"
        "--pod-nav-menu-item-selected-shadow": "inset 3px 0 0 var(--color-brand1-6)"
        "--pod-page-header-bg-color": "var(--pod-shell-theme-bg-color)"
        "--pod-nav-l-sub-main-bg-color": "var(--pod-shell-theme-bg-color)"
        "--pod-nav-top-main-border-width": "1px"
        "--pod-nav-top-main-border-color": "#353535"
        "--pod-nav-top-tab-indicator-width": "0px"
        "--pod-nav-logo-text": "var(--pod-nav-item-text-hover-color)"
        "--pod-nav-logo-bg": "var(--pod-nav-menu-bg-selected-color)"
        "--pod-nav-logo-icon": "var(--pod-nav-item-text-selected-color)"
        "--pod-nav-logo-border": "1px solid #353535"
        "--pod-nav-logo-border-radius": "2px"
        "--pod-nav-sub-divider-color": "#353535"
        "--pod-nav-item-text-disabled-color": "rgba(255,255,255,.30)"
        "--pod-nav-l-container-bg": "var(--pod-shell-theme-bg-color)"
        "--pod-nav-l-group-label-color": "var(--pod-nav-item-text-color)"
        "--pod-nav-l-search-border-color": "#353535"
        "--pod-nav-popup-bg-color": "var(--pod-shell-theme-bg-color)"
        "--pod-nav-popup-border-radius": "2px"
        "--pod-nav-popup-shadow": "0 8px 24px rgba(0,0,0,.24)"
        "--pod-nav-tab-line-hover-color": "var(--pod-nav-item-text-hover-color)"
        "--pod-nav-tab-line-selected-color": "var(--pod-nav-item-text-hover-color)"
        "--pod-nav-search-bg-color": "var(--pod-nav-menu-bg-hover-color)"
        "--pod-nav-search-bg-hover-color": "var(--pod-nav-menu-bg-hover-color)"
        "--pod-nav-search-bg-active-color": "var(--pod-nav-menu-bg-hover-color)"
        "--pod-nav-search-placeholder-color": "var(--pod-nav-item-text-color)"
        "--pod-nav-search-text-color": "var(--pod-nav-item-text-hover-color)"
        "--pod-nav-search-icon-color": "var(--pod-nav-item-text-color)"
        "--pod-nav-search-border-color": "#353535"
        "--pod-nav-search-border-hover-color": "var(--pod-nav-item-text-hover-color)"
        "--pod-nav-search-border-active-color": "var(--pod-nav-item-text-hover-color)"
        "--pod-nav-action-icon-color": "var(--pod-nav-item-text-color)"
        "--pod-nav-action-border-color": "#353535"
        "--pod-nav-action-border": "1px solid #353535"
        "--pod-nav-action-bg-hover-color": "var(--pod-nav-menu-bg-hover-color)"
        "--pod-nav-action-bg-active-color": "var(--pod-nav-menu-bg-hover-color)"
        "--pod-nav-menu-item-height": "38px"
        "--pod-nav-menu-item-radius": "2px"
        "--pod-nav-menu-item-border": "none"
        "--pod-nav-menu-item-hover-border": "none"
        "--pod-nav-menu-item-selected-border": "none"
        "--pod-nav-menu-font-size": "14px"
        "--pod-nav-menu-item-selected-font-weight": "500"
        "--pod-nav-menu-line-height": "20px"
        "--pod-nav-menu-gap": "8px"
        "--pod-shell-lshape-border-radius": "2px"
    colors:
      "--color-white": "var(--pod-card-bg-color)" # 全应用基础表面；当前随浅色内容主面，不承担白字语义
      "--color-brand1-1": "<生成实际色值：--color-brand1-6 88% + #FFFFFF 12%，sRGB 逐通道混合>" # 品牌交互悬停
      "--color-brand1-2": "<生成实际色值：--color-brand1-6 12% + #FFFFFF 88%，sRGB 逐通道混合>" # 平台预留品牌浅色
      "--color-brand1-3": "<生成实际色值：--color-brand1-6 4% + #FFFFFF 96%，sRGB 逐通道混合>" # 品牌派生浅色表面
      "--color-brand1-5": "<生成实际色值：--color-brand1-6 38% + #171717 62%，sRGB 逐通道混合>" # 品牌派生深色
      "--color-brand1-6": "{{PRIMARY_COLOR}}" # 唯一品牌种子；实例化时使用用户、项目或平台当前主题色，不从参考图补回固定色
      "--color-brand1-9": "<生成实际色值：--color-brand1-6 76% + #000000 24%，sRGB 逐通道混合>" # 品牌交互按下
      "--color-brand1-10": "<生成实际色值：--color-brand1-6 26% + #FFFFFF 74%，sRGB 逐通道混合>" # 品牌交互禁用
      "--color-line1-1": "#EBEBEB" # neutral-gray；弱边框、分隔线与图表网格
      "--color-line1-2": "#E3E3E3" # neutral-gray；控件常规边界
      "--color-fill1-1": "#FFFFFF" # neutral-gray；输入默认表面与中性悬停角色，主题保持白面
      "--color-fill1-2": "#FAFAFA" # neutral-gray；中性按下、选中与表头浅填充
      "--color-fill1-3": "#F5F5F5" # neutral-gray；较重中性填充与进度轨道
      "--color-fill1-5": "#FFFFFF" # neutral-gray；下拉、浮层、气泡、抽屉、弹窗和数据读数
      "--color-fill1-10": "#262626" # neutral-gray；固定短 Tooltip 深底
      "--color-text1-5": "#FFFFFF" # neutral-gray；固定短 Tooltip 反色文字
      "--color-text1-4": "#1B1B1B" # neutral-gray；主标题、核心数值和普通正文
      "--color-text1-10": "#737373" # neutral-gray；表头、placeholder 与辅助操作
      "--color-text1-3": "#8A8A8A" # neutral-gray；次级说明、非关键刻度与元信息
      "--color-text1-2": "#B8B8B8" # neutral-gray；仅用于禁用文字
      "--color-text1-1": "#DEDEDE" # neutral-gray；仅用于水印文字
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
      "--corner-zero": 0px # 贴边栏目、表格拼接和区块分隔
      "--corner-1": 2px # 小型条形图端角、矩形状态底片
      "--corner-2": 2px # 输入控件与菜单项
      "--corner-3": 2px # 气泡、浮层、弹窗外轮廓
      "--corner-4": 2px # 小型嵌入摘要与内部组合容器
      "--corner-5": 2px # 卡片、独立面板与抽屉外轮廓
      "--corner-circle": "var(--corner-2)" # 等宽高头像、图例圆点
      "--corner-semicircle": 2px # 胶囊按钮、计数标记、进度条圆头
    shadow:
      "--shadow-1": "0px 2px 4px 0px rgba(0, 0, 0, 0.12)"
      "--shadow-2": "0px 4px 20px -1px rgba(0, 0, 0, 0.16)"
      "--shadow-3": "0px 10px 28px -2px rgba(0, 0, 0, 0.24)"
  custom-page:
    colors:
      "--oyd-page-bg": "var(--pod-page-bg-color)" # 全局页面背景的单向桥接
      "--oyd-entity-ink": "<生成实际色值：--color-brand1-6 26% + #1B1B1B 74%，sRGB 逐通道混合>" # 主题色深色信息变体；用于对象名称、结构化信息和线性操作图标
      "--oyd-data-series-primary": "var(--color-brand1-6)" # 主序列随主题色变化，不随交互状态变化
      "--oyd-data-series-secondary": "<生成实际色值：--color-brand1-6 40% + #171717 60%，sRGB 逐通道混合>" # 品牌派生深色对照序列，非正文颜色别名
      "--oyd-data-series-context": "#EBEBEB" # neutral-gray；非焦点数据柱
      "--oyd-data-series-reference": "#D2D2D2" # neutral-gray；真实参考曲线
      "--oyd-data-area-fill": "<生成实际色值：取 --oyd-data-series-secondary 的 sRGB 三通道，alpha 设为 0.06，输出 rgba>" # 面积图顶部轻填充
      "--oyd-certification-mark": "var(--color-brand1-6)" # 已有认证标记随主题色变化，非通用成功状态
      "--oyd-shell-brand-panel": "#101010" # neutral-gray；仅自绘导航已有品牌区使用
    typography:
      "--oyd-font-size-metric": "28px" # 独立指标数字；按产品界面尺度推断
      "--oyd-font-weight-metric": 500
      "--oyd-font-lineheight-metric": 1.2
---

# {{PROJECT_NAME}} design.md

## 1. 风格摘要

**深色侧栏 · 白底细线（dark-rail-fine-lines）**

独立配色的应用导航构成稳定的视觉边界，内容区以连续白色画布展开。标题、细分隔线和留白承担主要层级，卡片边界很轻，常驻内容几乎没有投影。近黑标题与主题色派生的深色关键信息交替组织阅读，品牌强调只在操作、选中标记和少量数据图形中出现。整体信息量较高，但行距与区块间距舒展，避免把每个信息片段都包成醒目的卡片。

| 核心特征               | 可见表现                                                                                     | 主要偏离风险                                       |
| ---------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 明暗分区，配色独立     | 导航与白色内容独立配色；选中使用专用背景和前景                                               | 将导航改成品牌色大面填充，或让内容跟随导航一起变暗 |
| 白面连续，细线划界     | 同色卡片靠浅边框识别，横向分段和辅助栏目以单线分隔                                           | 以灰色大背景、重投影和多层嵌套卡片取代留白         |
| 中性文字配主题深色信息 | 标题、数字近黑；对象名、部分结构化数值与图标使用主题色深色变体                               | 把所有文字染成品牌色，或用过浅灰承载关键数据       |
| 容器克制，操作圆润     | 面板使用适中圆角；工具按钮、计数和进度条使用胶囊或圆头                                       | 所有元素统一成大圆角、厚描边的按钮形状             |
| 强调集中于当前对象     | 有数据图形时，灰色参照中出现少量品牌色、品牌深色变体与细斜纹；有集合切换时用细顶线标记当前项 | 每个柱、每张卡片都着重强调，失去视觉主次           |

页面、字段、操作及组件数量由实际需求确定。普通表单和列表仅靠白色表面、细边界、墨色文字与圆润操作即可呈现主题；图表、辅助栏、认证标志等只在存在对应内容时启用。

## 2. 页面视觉系统

### 2.1 表面、区块与层次

层次优先通过留白、边线和文字建立。常驻区块与画布保持同色；只有短暂覆盖内容才增加有限阴影。以下边线粗细、局部阴影及后文图形尺寸为实施推断，不以图片导出像素直接换算 CSS 尺寸。

| 对象                                         | 背景与前景                                                                                   | 边界、形状与阴影                                                               |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 应用根背景                                   | `--pod-app-root-bg-color`；背景图由 `--pod-app-root-bg-image` 控制                           | 根节点平铺，背景图不向输入或卡片继承                                           |
| 页面画布与白色页头                           | `--pod-page-bg-color`；自定义页使用 `--oyd-page-bg`；主文字用 `--color-text1-4`              | 页头下方可用 1px `--color-line1-1`；无默认投影                                 |
| 一级卡片、表单主容器、独立详情面板           | `--pod-card-bg-color`；标题用 `--color-text1-4`                                              | 1px `--color-line1-1`，`--corner-5`，无阴影                                    |
| 表格正文                                     | `--pod-table-cell-color`，对象名可用 `--oyd-entity-ink`                                      | 连续行表面与横分隔线，拼接处使用 `--corner-zero`                               |
| 内部分段、表头与辅助信息                     | 通常保持父级白面；需要中性填充时使用 `--color-fill1-2`，轨道与较重填充使用 `--color-fill1-3` | 优先空白与单向边线，不重复套完整容器                                           |
| 下拉、浮层、气泡、弹窗、弹出日历、导航弹出层 | `--color-fill1-5`；主文字用 `--color-text1-4`，辅助文字用 `--color-text1-10`                 | `--corner-3`，浅边框；小浮层可用 `--shadow-1`，模态弹窗可用 `--shadow-2`       |
| 抽屉                                         | `--color-fill1-5`；文字按浅色表面配套                                                        | `--corner-5` 用于露出角，贴边处直角；必要时用 `--shadow-2`                     |
| 图表读数浮卡                                 | `--color-fill1-5`；标签用 `--color-text1-10`，数值跟随对应数据序列                           | `--corner-3`；采用局部弱阴影 `0 8px 24px rgba(0,0,0,0.06)`，避免遮挡整个数据区 |
| 简短 Tooltip                                 | `--color-fill1-10` 配 `--color-text1-5`                                                      | `--corner-3`；与白色数据读数浮卡区分                                           |

`--color-white` 是全应用基础表面，当前随白色内容主面；切换内容明暗时跟随主面，不作为固定白字。普通卡片不使用阴影档位。`--shadow-3` 保留为平台完整变量，本主题未指定默认使用对象。独立辅助栏目可以直接落在页面画布上，以一条纵向边线划分；若页面没有平行辅助内容，不保留空栏。

### 2.2 应用导航

深炭导航与白色工作区形成清楚分区，白字灰底标识当前菜单；细边界和低圆角与正文一致。

菜单轮廓使用 --pod-nav-menu-item-radius、--pod-nav-menu-item-border、--pod-nav-menu-item-hover-border、--pod-nav-menu-item-selected-border。侧栏和顶部菜单共用轮廓，各状态保持相同边框宽度，文字位置稳定；具体数值以本项目 Token 为准。

导航与应用框架、表单、自定义页面和详情页共用设计语言。先按业务入口安排菜单、分组、搜索、品牌区与常用操作，再一起确定导航与正文的明暗、表面、字体、边界、圆角和密度。平台导航使用真实页面菜单；自绘导航按同一套导航 Token 实现。命名模板沿用自身 navTheme，换主色保持导航明暗与内容画布；需要另一导航明暗时改选主题，自由创意按项目明确设计。

导航底色使用 --pod-shell-theme-bg-color；普通、悬停和选中文字分别使用 --pod-nav-item-text-color、--pod-nav-item-text-hover-color、--pod-nav-item-text-selected-color；悬停和选中背景使用 --pod-nav-menu-bg-hover-color、--pod-nav-menu-bg-selected-color。图标跟随对应文字状态，当前入口同时用背景或字重表达。

菜单高度、圆角与间距使用 --pod-nav-menu-item-height、--pod-nav-menu-item-radius、--pod-nav-menu-gap；搜索、品牌区、分组、操作和弹出菜单使用 navigation 分组中的对应 Token。弹出菜单的底色、文字与搜索状态成组配套，导航与内容可以分别选择明暗。选中项使用 --pod-nav-menu-item-selected-shadow：none 关闭额外标记，完整 box-shadow 值可表达左、右或底部内阴影，不占据菜单布局空间；该 Token 独立于导航明暗。菜单高度、文字行高、内距和框架留白一起调整，给外阴影、长标题与键盘焦点留出空间。

桌面检查菜单、搜索、选中态与表单的协调；折叠后保留可识别图标和入口名称；窄屏保持菜单可展开、当前页面可定位、键盘焦点可见。提交、编辑、详情与自定义页都沿用这一导航设计。

### 2.3 页面标题与操作

页面标题直接落在白色画布上，左对齐，不另加有色标题卡。标题下如有面包屑或说明，以 `--s-1` 或 `--s-2` 分隔；上级信息用 `--color-text1-3`，当前位置用 `--oyd-entity-ink`。标题与下一内容组之间使用 `--s-5` 或 `--s-6`。

已有主要操作排在标题或集合工具栏的另一侧，保持与标题的视觉中线一致。搜索图标、筛选胶囊与主操作之间使用 `--s-2`；确需区分操作组时增加 `--s-3` 间隔和一条短竖线。集合标题与工具栏共享一行，表格从下一行完整展开。操作不足一行时自然换行并保持次序，不通过缩小字号容纳。

页头与页面内标题分工明确：页头识别应用或工作环境，页内标题识别当前任务。没有说明、面包屑、头像或操作时不占位，不从参考画面复制业务文案。

### 2.4 排版、间距与形状

使用 `--font-family-base`。全局字体与间距固定，独立指标使用页面层的数值排版；未知字体不以截图外观断言其字体名称。

| 文字角色                   | 字号、字重、行高                                                                     | 颜色与使用                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| 页面标题、页头应用名称     | `--font-size-subhead`、`--font-weight-subhead`、`--font-lineheight-subhead`          | `--color-text1-4`；页面任务标题可采用 `--oyd-entity-ink`                    |
| 分组与面板标题             | `--font-size-body-2`、`--font-weight-body-2`、`--font-lineheight-body-2`             | `--color-text1-4`；前置线性图标不抢占文字焦点                               |
| 正文、标签与常规操作       | `--font-size-body-1`、`--font-weight-body-1`、`--font-lineheight-body-1`             | 正文用 `--color-text1-4`，有名称辨识任务时用 `--oyd-entity-ink`             |
| 表格表头与单元格           | `--font-size-table`、`--font-weight-table`、`--font-lineheight-table`                | 表头用 `--color-text1-10`；主内容用 `--color-text1-4` 或 `--oyd-entity-ink` |
| 元信息、图表标签和次要说明 | `--font-size-caption`、`--font-weight-caption`、`--font-lineheight-caption`          | `--color-text1-3`；直接影响判断的说明提高到 `--color-text1-10` 或主文字色   |
| 独立指标值                 | `--oyd-font-size-metric`、`--oyd-font-weight-metric`、`--oyd-font-lineheight-metric` | `--color-text1-4`；单位与附属变化值降为正文或说明角色                       |

页面外侧留白使用 `--s-8` 或 `--s-10`；一级分组间距使用 `--s-6` 或 `--s-8`；卡片内边距使用 `--s-4` 或 `--s-5`；标签与值、图标与文字之间使用 `--s-2`。当内容宽度受限时收紧到相邻间距档，不改变全局文字规格。具体宽度、列数和高度在项目页面设计中一次确定，不强制所有面板等高。

数字采用等宽数字特性；同列金额、百分比和计数保持单位位置、精度及对齐一致。卡片大数值与标签对齐，表格连续比较数值优先右对齐。负号、缺失值和真实零值不能混用。

圆角依用途消费：贴边分区与连续表格使用 `--corner-zero`，小图形使用 `--corner-1`，输入和菜单项使用 `--corner-2`，浮层使用 `--corner-3`，内部短摘要使用 `--corner-4`，独立卡片与抽屉使用 `--corner-5`。头像和图例圆点使用 `--corner-circle`；按钮、进度圆头和计数胶囊使用 `--corner-semicircle`。页面本身不因为存在容器圆角就裁成一张大卡片。

### 2.5 色彩、图标与点缀

品牌色承担可操作重点、激活线与少量图形焦点，实际色相由项目种子确定。主体仍保持大面积白色与中性灰。`--oyd-entity-ink` 是品牌派生的深色信息角色，混合基底仅使用无色相灰；更换品牌时同步重算，不保留截图色相。数据主序列使用 `--oyd-data-series-primary`，第二序列使用 `--oyd-data-series-secondary`，二者不借用 hover、active 或 disabled 色表达数值。

认证标识仅在真实存在认证字段时使用 `--oyd-certification-mark`，采用小型齿形印章或明确的勾记；不将该色解释为通用成功。待处理提醒、风险、成功、错误与信息状态沿用平台已有语义色及其文字说明。评分可以按其既定等级语义使用星形与强调色，不能将状态色任意分配给普通类别。

功能图标采用同一套圆端轻描边图标，视觉尺寸以 `--s-4` 至 `--s-5` 为主，线宽约 1.5–1.75px（推断）。标题前图标和菜单图标不默认加彩色底盒；只有图标按钮拥有可点击的圆形边界。头像保持圆形，小型认证徽章独立于头像或对象文字，不为每行添加大图形装饰。

斜纹仅用于真实数据的重点区或已有对象标识，不扩散到页面背景、卡片表面与标题区。渐变仅用于趋势图的极浅面积衰减，不能把白面板改成品牌渐变卡。装饰不新增数据类别，不生成伪造曲线、头像、商标或随机图表。

## 3. 基础组件表达

本部分描述组件存在时的表达方式，不构成必建清单。没有单独说明的组件按“任务结构、表面层级、文字角色、控件形状、状态表达”推导，不增设同义变量。

### 面板与数值摘要

面板继承白色表面、轻边框和无阴影规则。标题可带无底盒线性图标，操作或周期切换与标题对齐；内容自然增长，不能为对齐邻居强行截断。

数值摘要采用“上方短标签、下方较大数值”的两层结构，配 `--s-4` 内边距与 `--s-4` 层间距。标签可按真实状态使用语义色，大数字维持近黑。变化值靠近指标并显示方向或比较口径；不能仅用正负号或颜色暗示未定义的增长意义。不要求固定摘要数量，也不把每个数值都变成独立卡片。

### 按钮、图标按钮与链接

默认工具操作是白面、细描边胶囊，边框用 `--color-line1-2`，文字和图标用 `--oyd-entity-ink`。重点新增或确认入口可用品牌文字与品牌图标，保留轻描边；只有确需提升优先级的唯一主操作才使用品牌实底；其前景沿用项目设计已确定的状态配对，替换主色不触发黑白选择。

按钮高度按角色选择 `--s-7`、`--s-8`、`--s-9`、`--s-10`；紧凑工具栏优先较小两档，常规操作使用中间档。圆形图标按钮宽高相等，轮廓使用 `--corner-semicircle`；图标与文字按钮使用相同视觉高度。纯链接不包成胶囊，可通过品牌色与细下划线表达跳转。

### 输入与筛选

输入默认表面使用 `--color-fill1-1`，不能因当前同为白色而引用卡片或 pop-up 背景。高度使用 `--s-8`、`--s-9`、`--s-10`，边框使用 `--color-line1-2`，圆角使用 `--corner-2`；标签和输入沿同一左边界对齐。placeholder 用 `--color-text1-10`，禁用说明才使用 `--color-text1-2`。

可收起筛选使用带线性筛选图标的描边胶囊，展开后的字段仍保持标准输入形状。已选条件以轻描边或浅品牌底加文字表达，不给每个条件配置饱和色块。弹出选项列表使用覆盖层表面，与触发输入的背景职责分开。

### 页签与周期切换

集合分类页签采用文字横排，未选项用次级文字；当前项用主文字，并在该项顶部放置约 1px 的品牌色细线。激活区域可辅以 `--color-fill1-2` 的轻填充，不使用厚底线、实色块或整组胶囊框。真实待处理数可紧随标签显示品牌色小计数胶囊。

图表周期切换采用独立文字选项，仅当前项显示细描边胶囊。未选项保持无框，避免给每项都套边界。两种切换形式职责不同，不能把集合页签的顶线统一改成周期胶囊。

### 表格与独立记录列表

表格表头使用 `--color-fill1-2` 与 `--color-text1-10`；正文单元格使用 `--pod-table-cell-color`，通过 `var(--pod-card-bg-color)` 跟随卡片表面。行间只加 1px `--color-line1-1`，默认无竖向网格和斑马纹。单行单元格垂直留白使用 `--s-4`；多行文本允许自然增高，不将每行变成悬浮卡片。

对象名称优先用 `--oyd-entity-ink`，分类用正常正文，数值、进度、评分与尾部操作各自沿列轴对齐。进度条外侧保留可读数值，宽度不能替代具体读数。次要行操作可收为无底色省略号按钮，不以装饰徽章代替可辨认的操作入口。

独立记录列表允许圆形对象标识、两行文字和尾部小标志的横向组合；相邻记录用浅线与留白分开，不复制表格表头或多层卡片。已有真实头像或标志按等宽高容器裁切；缺图时采用首字或统一中性占位，不能随机绘制商标暗示真实品牌。

### 进度、徽标与图表基础

进度轨道使用 `--color-fill1-3`，真实完成段使用品牌色；高度可取约 8px（推断），两端使用 `--corner-semicircle`。只有存在明确风险阈值时才切换为平台警告色，不能仅因进度较低就赋予告警含义。计数胶囊保留紧凑内边距，认证、数量和流程状态分别表达。

图表以细坐标线和很淡的网格保持秩序；网格使用 `--color-line1-1`，主坐标和重点读数可用 `--oyd-entity-ink`。数据颜色、图例、读数浮卡与可读数据入口必须对应同一序列、时间范围和单位。背景参照柱使用 `--oyd-data-series-context`，真实参考曲线使用 `--oyd-data-series-reference`，二者不作为禁用或选中填充消费。

柱形图的数值编码从合理基线展开；比较总量时以零为基线，确需截断时明确标识。只有真实目标或区间才显示目标帽线、背景容量柱或范围条。曲线的平滑方式不得制造额外极值，不能复制同一条曲线并位移充当另一组数据。缺失数据保留缺口或缺失说明，不能补为零。

### 状态与反馈

| 状态                             | 本主题的视觉处理                                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Hover                            | 中性控件保持 `--color-fill1-1`，通过边框与图标加深形成变化；品牌交互可使用 `--color-brand1-1`。不抬升整张常驻卡片 |
| Active / pressed                 | 中性操作用 `--color-fill1-2`；品牌操作用 `--color-brand1-9`，不改变尺寸                                           |
| Selected                         | 集合或中性选项用 `--color-fill1-2` 配清晰标记；品牌关系用细线或局部品牌色。导航使用六项专用颜色与选中项阴影       |
| Focus                            | 以约 2px 的品牌色外轮廓及清晰间隔表达焦点（推断）；不依赖仅几乎不可见的填充变化                                   |
| Disabled                         | 使用 `--color-text1-2` 或 `--color-brand1-10`，关闭强调；不把正常辅助说明标成禁用态                               |
| Error / warning / success / info | 使用平台已有语义色、文字与必要图标；错误字段保留输入结构，边界和说明同步指出问题，不新增同义状态 Token            |
| Loading / empty                  | 骨架使用中性填充；空状态以简短正文与已有可用操作呈现，不用假指标、假柱形或装饰插画填满空间                        |

状态过渡保持轻量，可采用约 120–180ms 的颜色与透明度变化（推断）；不默认弹跳、缩放、霓虹发光或持续播放数字动画。未展示的输入、错误和焦点状态为按本主题推导的实现规则。

### 表单组件与版式结构

表单使用与自定义页面相同的应用全局样式，字体、色彩、表面、边界、圆角、密度和状态延续本主题。表单支持在顶部、左侧、主体、右侧和字段之间组合 Tab/切换、按钮组/操作入口、图片/图形、状态区、标题与 `Divider`、`ColumnContainer`、辅助内容和业务字段。各组件承担导航、操作、视觉焦点、反馈、层级、节奏、装饰或采集作用。普通业务分组和章节分隔使用 `Divider`，横向字段组合使用 `ColumnContainer`。每张表单在项目 `design.md` 写清组件位置与作用、列比例、标签位置、字段与章节间距、底栏、详情延续和窄屏重排。

## 4. 特色表达配方

### R1 白底辅助信息栏

**适用内容：** 页面确有与主要任务并行的相关摘要、对象排名或参考信息，并且这些内容需要同时阅读。

**继承基础：** 白色画布、分组标题、独立记录列表与浅分隔线规则。

**特殊组合：** 主内容与辅助区使用同一白底，仅以单条纵向边界和两侧留白划分。辅助区各组纵向排列，标题与已有查看入口分置两侧；组内名单直接排列，只有确需突出的一项可使用单独白色面板。实际宽度、位置、窄屏顺序由项目页面设计确定，不在主题中固定三栏比例。

**无匹配时：** 省略辅助栏，主内容使用可用空间；不为了维持构图新增排行或推荐。

### R2 灰色参照中的双色焦点柱

**适用内容：** 存在真实周期或类别序列，并需要突出当前项；若展示相邻双色柱，必须有两个实际可比较序列。

**继承基础：** 数据系列颜色、柱形基线、浅网格与白色读数浮卡规则。

**特殊组合：** 非焦点柱呈浅灰，当前类别的两序列分别显示品牌色与品牌派生深色。仅深色对照序列可叠约 45°、间距 6–8px、线宽约 1px 的低不透明度白色细斜纹（推断），纹理裁切在柱内。选择焦点时，靠近该类别显示小型白色浮卡，卡内以圆点、名称与数值对应序列；多个浮卡轻微错位但不互相遮字。目标帽线仅在真实存在目标数据时显示。

**无匹配时：** 单序列保留单色焦点，普通比较图遵循基础图表规则；没有图表需求则不渲染，不补造第二序列或目标线。

### R3 细曲线与浅面积对照

**适用内容：** 有连续时间趋势；只有存在真实基准或对照数据时才展示第二条曲线。

**继承基础：** 图表坐标、数据同源、系列色与白色读数浮卡规则。

**特殊组合：** 主曲线使用 `--oyd-data-series-secondary`，真实参考曲线使用 `--oyd-data-series-reference`；线条细而清楚，约 1–1.5px（推断）。主线下方从 `--oyd-data-area-fill` 向同色透明端垂直衰减，保持画布白底。只在当前读数或末端显示小圆点，其余节点不铺满标记。下方范围选择器仅在确有可调整时间范围时出现，使用细轨道与主题色深色圆形手柄。

**无匹配时：** 没有对照则仅保留主曲线，没有连续时间关系则改用适合真实数据的基础图形；不以灰色复制曲线作为阴影或虚构对照。

### R4 主摘要与短条明细

**适用内容：** 一项主要统计量带有真实趋势，以及与它相关的少量次级统计量；数据关系和比较周期明确。

**继承基础：** 数值摘要、白色面板、线性图标与数据颜色规则。

**特殊组合：** 主面板上方放标题、较大数值与紧凑变化值，下方放低视觉重量的小型柱图。相关次级项排列为简短的独立描边横条，左侧为图标和标签，右侧为变化或数值，保持共同左右边界。柱图不额外加入无数据依据的背景容量柱；短条数量随实际内容，不固定为两项。

**无匹配时：** 缺少趋势则回到普通数值摘要，缺少次级统计就移除短条；不为填满面板创建指标。

## 5. 项目应用与调整规则

### 变量、平台与规则优先级

YAML 是变量值的唯一事实源；正文只规定消费关系，独立局部参数在出现处标为推断。全局变量供平台原生页面与自定义页面消费；页面层补充主题色深色对象信息、图表色、认证标志、自绘品牌区和独立指标排版。递归提取以 `--` 开头的标量叶子，分组名称不拼接到 CSS 变量名；平台基础与项目扩展均在主题中声明，可无环引用，并按实际设计补充变量。

导航颜色成组独立确定，需要另一导航明暗时改选主题，不在当前模板中改写六项专用颜色，不改变内容区的文字、填充、卡片或覆盖层。原生导航额外通过 `--pod-nav-menu-item-selected-shadow` 使用不占位的选中标记；自绘导航才消费页面层品牌区色。若平台组件不开放细节样式，保留其原生交互与布局能力，在开放范围内落实表面、边界和文字层级。

需求决定内容，平台约束限定可实现能力，主题规定视觉机制。特色配方不能覆盖真实数据语义、自然内容增长或明确平台限制。未提供具体名称的平台状态变量按语义对接，不杜撰变量接口。

### 品牌色与数据色实例化

- 色彩来源：{{COLOR_SOURCE}}。
- 品牌种子保留 `{{PRIMARY_COLOR}}`，按“用户明确指定 → 项目已配置 → 平台当前主题”的顺序取值；没有可用种子时保留占位，由项目实例化补齐，不设置固定回退色。用户给定种子不静默替换。
- 七个品牌变量分别承担悬停、平台预留浅色、派生浅色、派生深色、主色、按下和禁用。各自的种子、基底与比例以 YAML 公式为准；不把 `--color-brand1-3` 或 `--color-brand1-5` 转作导航背景。
- sRGB 混合以 0–255 的编码通道计算，每个通道为 `round(种子通道 × 种子占比 + 基底通道 × 基底占比)`；占比相加为 100%，结果输出六位十六进制。此处不进行线性光转换。带 alpha 的面积色保留指定 RGB 通道，按公式输出 `rgba`。
- 主数据序列、深色对象信息、深色对照序列与认证标记全部直接或间接依赖 `--color-brand1-6`，换主题色同步更新；不随 hover／active 状态改变数据颜色。固定中性灰及平台状态色保留独立职责。保留两序列既定的斜纹、线型和标注，仅替换品牌关联色。
- 实例化时解析生成标记并保留源公式及引用关系，每次换主题色重新计算，不冻结旧值；同时保留设计稿中各组件与状态的文字、图标和背景配对，不按主色自动切换黑白、改变文字灰阶或重设背景明度。导航、浅色内容及白色浮层各自使用已确定的前景，不互相继承。

### 项目页面设计

项目阶段只为实际需求中的页面填入确定的设计结果；主题本身不预设指标数量、图表、菜单入口或商户业务。每页包含以下五项：

- **页面内容：** 页面名称、任务、真实信息、字段和已有操作。
- **首屏印象：** 第一视觉焦点及其构图方式，说明明暗分区、白面留白、文字主次和局部品牌色如何帮助理解当前任务。
- **布局安排：** 各区块位置、主次、实际宽度、列数、高度与对齐；明确窄屏后的内容顺序，避免照搬图片裁切或把表格底部截断固化为设计。
- **视觉表达：** 各区域采用的表面、组件与状态规则；采用特色配方时写出编号和位置，未采用部分直接省略。
- **标志性时刻：** 指定一处静态画面或真实交互反馈，交代位置或触发条件、具体表现及其任务价值；可以与首屏焦点为同一处。

素材来源、缺口处理及特殊约束直接写入对应页面。已有头像、标志与真实数据使用实际素材；不得将模板中的视觉示意认作可用业务资产。项目结果需确定布局决策，不以“按内容决定”替代设计，也不为应用配方新增模块。

{{PAGE_APPLICATIONS}}

### 页面设计验收

以下仅用于后续实际页面验收；尚未渲染时保持未勾选。

- [ ] **首屏印象：** 主要任务清晰，导航与白色内容的关系符合方案，强调集中在当前内容和操作。
- [ ] **布局安排：** 分区、宽度、列数、高度、对齐和窄屏顺序符合逐页方案，连续表格和自然内容增长未被视觉容器破坏。
- [ ] **风格表达：** 细边线、平整白面、主题深色信息与圆润操作在实际组件中成立；已采用的数据纹理与参考序列仍可辨认，颜色不混淆业务含义。
- [ ] **标志性时刻：** 指定静态构图或交互反馈在对应位置与条件下出现，帮助理解真实信息或完成操作。
