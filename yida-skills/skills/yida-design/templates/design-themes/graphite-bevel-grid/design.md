---
name: "{{PROJECT_NAME}}"
description: "相近明度的石墨灰画布与暗面板，以细网格、轻微边缘高光和紧凑排版建立秩序；彩色短柱、微型方标及描边标签在局部呈现受控的渐变质感。"
themeId: graphite-bevel-grid
navTheme: dark
tokens:
  application-global:
    appearance:
      surfaces:
        "--pod-app-root-bg-color": "#181818" # neutral-gray；根背景与加载兜底
        "--pod-app-root-bg-image": "none" # 应用根节点专属；无主题背景图
        "--pod-page-bg-color": "#1D1D1D" # neutral-gray；内容画布，略亮于常规面板
        "--pod-card-bg-color": "#171717" # neutral-gray；卡片、表单、详情主面
        "--pod-table-cell-color": "var(--pod-card-bg-color)" # 表格正文单向跟随卡片
      navigation:
        "--pod-shell-theme-bg-color": "#171717"
        "--pod-nav-item-text-color": "#A6A6A6"
        "--pod-nav-item-text-hover-color": "#DADADA"
        "--pod-nav-item-text-selected-color": "#F5F5F5"
        "--pod-nav-menu-bg-hover-color": "#1D1D1D"
        "--pod-nav-menu-bg-selected-color": "#1D1D1D"
        "--pod-nav-menu-item-selected-shadow": "none"
        "--pod-page-header-bg-color": "var(--pod-shell-theme-bg-color)"
        "--pod-nav-l-sub-main-bg-color": "var(--pod-shell-theme-bg-color)"
        "--pod-nav-top-main-border-width": "1px"
        "--pod-nav-top-main-border-color": "#353535"
        "--pod-nav-top-tab-indicator-width": "0px"
        "--pod-nav-logo-text": "var(--pod-nav-item-text-hover-color)"
        "--pod-nav-logo-bg": "var(--pod-nav-menu-bg-selected-color)"
        "--pod-nav-logo-icon": "var(--pod-nav-item-text-selected-color)"
        "--pod-nav-logo-border": "1px solid #353535"
        "--pod-nav-logo-border-radius": "6px"
        "--pod-nav-sub-divider-color": "#353535"
        "--pod-nav-item-text-disabled-color": "rgba(255,255,255,.30)"
        "--pod-nav-l-container-bg": "var(--pod-shell-theme-bg-color)"
        "--pod-nav-l-group-label-color": "var(--pod-nav-item-text-color)"
        "--pod-nav-l-search-border-color": "#353535"
        "--pod-nav-popup-bg-color": "var(--pod-shell-theme-bg-color)"
        "--pod-nav-popup-border-radius": "6px"
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
        "--pod-nav-menu-item-height": "34px"
        "--pod-nav-menu-item-radius": "2px"
        "--pod-nav-menu-item-border": "1px solid #353535"
        "--pod-nav-menu-item-hover-border": "1px solid #626262"
        "--pod-nav-menu-item-selected-border": "1px solid #909090"
        "--pod-nav-menu-font-size": "14px"
        "--pod-nav-menu-item-selected-font-weight": "500"
        "--pod-nav-menu-line-height": "20px"
        "--pod-nav-menu-gap": "4px"
        "--pod-shell-lshape-border-radius": "6px"
    colors:
      "--color-white": "var(--pod-card-bg-color)" # 全应用基础表面；随暗色内容主面，不用于白字
      "--color-brand1-1": "<生成实际色值：--color-brand1-6 88% + #FFFFFF 12%，sRGB 逐通道混合>" # 品牌悬停
      "--color-brand1-2": "<生成实际色值：--color-brand1-6 12% + #FFFFFF 88%，sRGB 逐通道混合>" # 平台预留品牌浅色
      "--color-brand1-3": "<生成实际色值：--color-brand1-6 4% + #FFFFFF 96%，sRGB 逐通道混合>" # 品牌派生浅色
      "--color-brand1-5": "<生成实际色值：--color-brand1-6 38% + #171717 62%，sRGB 逐通道混合>" # 品牌派生深色
      "--color-brand1-6": "{{PRIMARY_COLOR}}" # 唯一品牌种子；实例化时使用用户、项目或平台当前主题色，不从参考图补回固定色
      "--color-brand1-9": "<生成实际色值：--color-brand1-6 76% + #000000 24%，sRGB 逐通道混合>" # 品牌按下
      "--color-brand1-10": "<生成实际色值：--color-brand1-6 26% + #202020 74%，sRGB 逐通道混合>" # 品牌禁用
      "--color-line1-1": "#2B2B2B" # neutral-gray；网格、行列分隔和弱轮廓
      "--color-line1-2": "#383838" # neutral-gray；控件及浮层边界
      "--color-fill1-1": "#1D1D1D" # neutral-gray；输入基础面、中性悬停和弱填充
      "--color-fill1-2": "#292929" # neutral-gray；按下或中性选中
      "--color-fill1-3": "#363636" # neutral-gray；较重填充及进度轨道
      "--color-fill1-5": "#262626" # neutral-gray；下拉、弹窗及数据读数等独立覆盖层
      "--color-fill1-10": "#262626" # neutral-gray；固定短 Tooltip 背景
      "--color-text1-5": "#FFFFFF" # neutral-gray；固定短 Tooltip 前景
      "--color-text1-4": "#F0F0F0" # neutral-gray；标题、正文重点与核心数字
      "--color-text1-10": "#BDBDBD" # neutral-gray；表头与 placeholder
      "--color-text1-3": "#A3A3A3" # neutral-gray；说明、元信息及坐标轴
      "--color-text1-2": "#686868" # neutral-gray；仅禁用文字
      "--color-text1-1": "#424242" # neutral-gray；仅水印文字
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
      "--corner-zero": 0px # 连续表格与贴边区域
      "--corner-1": 3px # 小标签、数据柱及微型标识
      "--corner-2": 6px # 输入、菜单项和矩形按钮
      "--corner-3": 8px # 浮层与弹窗
      "--corner-4": 10px # 成组工具区或实体信息盒
      "--corner-5": 12px # 卡片、详情容器与抽屉
      "--corner-circle": 50% # 头像与状态圆点
      "--corner-semicircle": 500px # 确需圆形或半圆端头的按钮
    shadow:
      "--shadow-1": "0px 2px 4px 0px rgba(0, 0, 0, 0.12)"
      "--shadow-2": "0px 4px 20px -1px rgba(0, 0, 0, 0.16)"
      "--shadow-3": "0px 10px 28px -2px rgba(0, 0, 0, 0.24)"
  custom-page:
    colors:
      "--oyd-page-bg": "var(--pod-page-bg-color)" # 页面桥接
      "--oyd-raised-surface": "#1D1D1D" # neutral-gray；比卡片底稍亮的指标正面、表头与实体信息盒，明度与页面画布接近
      "--oyd-edge-highlight": "rgba(255, 255, 255, 0.045)" # neutral-gray；微弱的上缘高光
      "--oyd-on-dark-color": "#FFFFFF" # neutral-gray；自绘深色操作和分类图标的独立浅色前景
      "--oyd-viz-primary": "var(--color-brand1-6)" # 主数据／分类强调随品牌种子变化，不随交互状态变化
      "--oyd-viz-orange": "#F58A35" # 独立数据／分类色
      "--oyd-viz-green": "#20BE61" # 独立数据／分类色，不等于平台成功色
      "--oyd-viz-violet": "#9963DF" # 独立数据／分类色
      "--oyd-viz-comparison": "<生成实际色值：--color-brand1-6 60% + #FFFFFF 40%，sRGB 逐通道混合>" # 同主题对照色；随品牌种子重新派生
    typography:
      "--oyd-font-family-metric": "'SFMono-Regular', Consolas, 'Liberation Mono', monospace" # 独立数值显示字体，推断
      "--oyd-font-size-metric": "24px"
      "--oyd-font-weight-metric": 500
      "--oyd-font-lineheight-metric": 1.25
---

# {{PROJECT_NAME}} design.md

## 1. 风格摘要

**石墨细格 · Graphite Bevel Grid**

石墨灰画布承载略暗的内容面，表面间仅有小幅明度变化。指标正面和表头比卡片底稍亮，接近画布明度；它们借细边界和局部上缘微光形成很轻的实体感，不逐层抬高整页亮度。连续行列网格和紧凑对齐建立秩序，颜色集中在数据柱、分类标识、状态和少量交互焦点。

| 核心特征 | 可见表现 | 主要偏离风险 |
| --- | --- | --- |
| 连贯的深灰材质 | 画布和面板彼此接近，利用微小明度差区分；导航独立配色 | 改成纯黑与亮灰强反差、蓝灰玻璃或大面积渐变会改变整体气质 |
| 细网格与紧凑节奏 | 窄模块间隙，表格保留轻微横纵分界，标题和内容对齐 | 删除列边界、每行独立卡片化或过度留白会削弱连续比较 |
| 轻边缘高光 | 少数抬起的正面出现细小上缘高光，轮廓圆角克制 | 多层投影、厚倒角、发光描边会变成重拟物效果 |
| 局部的彩色实体感 | 小图形的上亮下暗渐变、彩色方形标识与细描边标签 | 给所有容器上色，或用随机短柱装饰，会压过内容并误导数据 |

前三项属于跨页基础；彩色短柱、分类方标和复合数值依赖实际内容。普通表单或列表也能通过表面、边界和排版体现主题，不要求存在图表、指标或动态信息流。

## 2. 页面视觉系统

YAML 维护变量值，正文维护角色关系。未能直接确定的尺寸、字体选择与交互变化按实施推断处理，不以图片物理像素作为 CSS 尺寸。

### 2.1 表面、区块与层次

| 对象 | 背景及前景 | 边界、圆角与阴影 |
| --- | --- | --- |
| 应用根背景 | `--pod-app-root-bg-color` 与 `--pod-app-root-bg-image`；背景图仅作用于根节点 | 应用按实际窗口承载，不增加外部壁纸、浏览器栏或展示边框 |
| 页面画布 | `--pod-page-bg-color`；自定义页通过 `--oyd-page-bg` 桥接 | 以留白承接区块；贴边采用 `--corner-zero` |
| 一级卡片、表单主容器、详情面板 | `--pod-card-bg-color`；主文字 `--color-text1-4`、说明 `--color-text1-3` | `--color-line1-1` 细轮廓、`--corner-5`，默认无外投影 |
| 局部稍亮的实体面 | `--oyd-raised-surface`；比卡片底稍亮，与页面画布接近；前景沿用内容角色 | 用于指标正面、表头或真实实体信息盒；指标正面与信息盒可用 `--oyd-edge-highlight` 表达一线内侧上缘，表头仅使用底色，不默认加材质高光；不无限嵌套 |
| 表格正文 | `--pod-table-cell-color` 单向引用卡片背景；表头文字 `--color-text1-10` | 连续细行列线 `--color-line1-1`；单元格不逐格圆角 |
| 内部分段与弱辅助填充 | 优先保持所在底色，必要时 `--color-fill1-1` | 以留白或弱线分隔，不为字段组重复包卡 |
| 下拉、气泡、弹出日历、弹窗与导航弹出层 | `--color-fill1-5`；主文字 `--color-text1-4`、说明 `--color-text1-3` | `--color-line1-2`、`--corner-3`；小浮层 `--shadow-1`，弹窗 `--shadow-2` |
| 抽屉 | `--color-fill1-5` 及其对应内容前景 | 外露角 `--corner-5`，贴边角归零；`--color-line1-2`、`--shadow-2` |
| 数据读数浮层 | `--color-fill1-5`；时间、分类与数值分别按说明及正文角色 | `--corner-3`、`--color-line1-2`、`--shadow-1`；可用小尖角指向真实数据项 |
| 短 Tooltip | 固定 `--color-fill1-10` 与 `--color-text1-5` 配对 | `--corner-3`；与完整数据读数卡分别定义，即使当前底色相同也不混用角色 |

边界默认 1 CSS px（推断）。高光只在选定的抬起正面沿上缘绘制同宽细线，不能绕整个容器发光；它是材质细节，不能作为唯一焦点或选中反馈。普通内容卡片的层次依靠底色与边界。全局 `--shadow-3` 保留，但本主题不默认使用。

`--color-white` 是全应用基础表面，当前跟随暗色卡片；需要白字时使用独立前景 `--oyd-on-dark-color`，不借用基础表面或 Tooltip 前景。背景图不传递给卡片、输入或表格。分区不要求逐层变亮；局部正面只是轻微突出，不形成多重套框。

### 2.2 应用导航

石墨导航以细分隔和低圆角组织菜单，浅字与微亮选中底延续表格网格的密度。

菜单轮廓使用 --pod-nav-menu-item-radius、--pod-nav-menu-item-border、--pod-nav-menu-item-hover-border、--pod-nav-menu-item-selected-border。侧栏和顶部菜单共用轮廓，各状态保持相同边框宽度，文字位置稳定；具体数值以本项目 Token 为准。

导航与应用框架、表单、自定义页面和详情页共用设计语言。先按业务入口安排菜单、分组、搜索、品牌区与常用操作，再一起确定导航与正文的明暗、表面、字体、边界、圆角和密度。平台导航使用真实页面菜单；自绘导航按同一套导航 Token 实现。命名模板沿用自身 navTheme，换主色保持导航明暗与内容画布；需要另一导航明暗时改选主题，自由创意按项目明确设计。

导航底色使用 --pod-shell-theme-bg-color；普通、悬停和选中文字分别使用 --pod-nav-item-text-color、--pod-nav-item-text-hover-color、--pod-nav-item-text-selected-color；悬停和选中背景使用 --pod-nav-menu-bg-hover-color、--pod-nav-menu-bg-selected-color。图标跟随对应文字状态，当前入口同时用背景或字重表达。

菜单高度、圆角与间距使用 --pod-nav-menu-item-height、--pod-nav-menu-item-radius、--pod-nav-menu-gap；搜索、品牌区、分组、操作和弹出菜单使用 navigation 分组中的对应 Token。弹出菜单的底色、文字与搜索状态成组配套，导航与内容可以分别选择明暗。选中项使用 --pod-nav-menu-item-selected-shadow：none 关闭额外标记，完整 box-shadow 值可表达左、右或底部内阴影，不占据菜单布局空间；该 Token 独立于导航明暗。菜单高度、文字行高、内距和框架留白一起调整，给外阴影、长标题与键盘焦点留出空间。

桌面检查菜单、搜索、选中态与表单的协调；折叠后保留可识别图标和入口名称；窄屏保持菜单可展开、当前页面可定位、键盘焦点可见。提交、编辑、详情与自定义页都沿用这一导航设计。

### 2.3 页面标题与操作

页头沿页面画布展开，下方用细线与主体区隔。已有路径可采用中性前序文字与品牌色当前项；当前项为纯位置说明时不伪装链接。页面标题使用 subhead 规格；没有完整标题的页面可由已明确的路径或当前视图承担定位，不重复制造标题条。

搜索和已有全局操作在页头尾部紧凑对齐，间距 `--s-2`；搜索为小圆角矩形而非胶囊。已有视图切换与时间／筛选操作可组成内容上方的一行工具区，主次分居两端，与主体间隔 `--s-4`。视图数量和筛选能力由需求确定。

页面无路径、视图、说明或操作时不预留相应空行。可用宽度不足时尾部操作换行，保持标题、路径和操作的阅读次序；具体窄屏安排由项目页设计确定。

### 2.4 排版、间距与形状

全局使用 `--font-family-base`。独立重点数值可使用 `--oyd-font-family-metric` 的等宽显示，普通正文和表格仍用全局字体；表格数值采用等宽数字特性，避免整张表切换为代码字体。

| 角色 | 字号 / 字重 / 行高 | 前景及用途 |
| --- | --- | --- |
| 页面标题 | `--font-size-subhead` / `--font-weight-subhead` / `--font-lineheight-subhead` | `--color-text1-4` |
| 面板标题与重点名称 | `--font-size-body-2` / `--font-weight-body-2` / `--font-lineheight-body-2` | `--color-text1-4` |
| 正文、字段标签、操作名称 | `--font-size-body-1` / `--font-weight-body-1` / `--font-lineheight-body-1` | 主要内容 `--color-text1-4`，辅助内容 `--color-text1-3` |
| 表格 | `--font-size-table` / `--font-weight-table` / `--font-lineheight-table` | 表头 `--color-text1-10`，正文 `--color-text1-4` |
| 辅助说明、图例与时间 | `--font-size-caption` / `--font-weight-caption` / `--font-lineheight-caption` | `--color-text1-3`；保持可读而非一味降低亮度 |
| 重点指标 | `--oyd-font-size-metric` / `--oyd-font-weight-metric` / `--oyd-font-lineheight-metric` | `--color-text1-4`；仅用于真实重点数据 |

页面内边距建议 `--s-4`，相邻模块间距 `--s-3` 至 `--s-4`，独立大分组间距 `--s-6`；普通面板内边距 `--s-4`，紧凑工具区用 `--s-2` 或 `--s-3`。标题与主体间距 `--s-3`，同一信息的上下两行用 `--s-1`。密度通过列宽和间距调整，不缩小固定字号。

数值精度、单位与币种按字段口径统一；数值列右对齐，日期列保持一致格式。主数值与小单位靠近排列，单位不与数值竞争字重。

大容器用 `--corner-5`，成组实体信息盒用 `--corner-4`，浮层用 `--corner-3`，输入／按钮／菜单用 `--corner-2`，微型图形与分类标签用 `--corner-1`。头像和圆点用 `--corner-circle`；`--corner-semicircle` 只服务真实需要的圆形或半圆端头按钮，不将搜索、Tab、标签全部胶囊化。

列数、比例、面板高度及必要的等高对象按第五部分逐页确定；多行文本和记录自然增长，不统一强制固定高度或内部滚动。

### 2.5 色彩、图标与点缀

品牌色负责品牌标识、真实链接、主操作与焦点。中性表面均为固定 `neutral-gray`；导航六色独立维护。品牌换色同步更新主序列与同主题对照色，但不改变数据和分类的既有含义。

`--oyd-viz-primary` 与 `--oyd-viz-comparison` 分别为品牌主序列和品牌派生对照色；`--oyd-viz-orange`、`--oyd-viz-green`、`--oyd-viz-violet` 保留为非主题的独立分类颜色，不用于品牌操作或装饰。项目为真实序列和分类确定映射，图例、图形、标签和读数保持一致；调色板不是固定的五类业务。换主题色仅更新相应引用或派生值，保留既定图形和标注。不同图形中的同一色相不自动代表同一个实体，需有清楚的局部图例。

成功、错误、警告和信息使用平台已有状态语义，不在页面层复制同义状态 Token。阶段标签属于分类还是结果反馈，由真实业务决定；上升不自动意味着成功，下降也不自动意味着错误。尚未给出平台状态变量名时保留语义约束，不杜撰接口。

图标统一细线家族，建议 16–18 CSS px、线宽 1.5 CSS px（推断）。导航和普通操作不设彩色底盒；分类事件图标才使用小圆角方底。大表面无纹理、无渐变、无背景模糊。

局部彩色质感采用同一算法：以数据或分类基色 C 为种子，顶部为 C 与白色按 90:10 混合，底部为 C 与黑色按 72:28 混合，沿垂直方向插值；均为编码后 sRGB 逐通道混合（比例为推断）。仅用于真实数据柱或分类图标底，不能让渐变改变图形几何或数值。小描边标签的填充使用 C 与所在表面按 12:88 混合，边线按 45:55 混合；文字使用对应分类基色 C，不按主题种子另行调亮。渐变和分类标签的派生色不借用品牌 hover／active 色。

## 3. 基础组件表达

仅定义组件出现时的视觉规则，不要求项目配齐所有组件。未列出的组件依次按任务结构、表面层级、文字角色、形状和状态推导。

### 面板、工具区与视图切换

面板沿用 2.1 的主内容表面，标题与已有尾部操作对齐，主体使用稳定内边距。标题区与正文需要明确区分时加一条细线，不以大面积亮底划分。仅在真实操作存在时展示更多菜单、信息图标或查看全部。

已有 Tab 或视图切换采用紧凑中性表达：非选中项用 `--color-text1-3`，选中项用 `--color-fill1-2` 与 `--color-text1-4`，轮廓 `--corner-2`，可加一线 `--oyd-edge-highlight`。不通过缩小字号塞入更多视图，也不将所有标签染成品牌色。相邻筛选器、日期和检索控件按同一控件基线对齐。

### 按钮、输入与表单

| 组件 | 默认表达与尺寸角色 |
| --- | --- |
| 中性按钮 | 默认弱填充 `--color-fill1-1`，文字 `--color-text1-4`，边界 `--color-line1-2`，圆角 `--corner-2`；需要更重底面时用 `--color-fill1-3` |
| 品牌主按钮 | 背景 `--color-brand1-6`，前景固定使用 `--oyd-on-dark-color`；hover 与 active 仅切换对应品牌背景档，保留浅色前景；原生按钮沿用同一状态配对 |
| 图标按钮 | 等宽高，使用中性按钮的边界与形状；同组视觉尺寸一致，无需每个图标都加彩底 |
| 输入、搜索、筛选与选择器 | 基础表面 `--color-fill1-1`，常规边界 `--color-line1-2`，圆角 `--corner-2`；正文 `--color-text1-4`，placeholder `--color-text1-10` |
| 多行输入 | 使用同一输入角色，按内容增长；工具与文本通过 `--s-2` 或 `--s-3` 留白分开 |

按钮高度选用 `--s-7` 至 `--s-10`，默认 `--s-8`，紧凑辅助操作可用 `--s-7`；输入和筛选控件选用 `--s-8` 至 `--s-10`，默认 `--s-8`。输入不借用卡片或 pop-up 背景，常态按钮不借用按下／选中 Fill。

表单标签贴近相应输入，间隔 `--s-2`；字段间距 `--s-4`，分组间距 `--s-6`。字段组通过标题和细线建立联系，不逐字段包成卡片。辅助说明使用正常可读的说明色，错误文本使用平台错误语义，必填与校验标记以真实规则为准。

### 连续表格与独立记录列表

表格正文消费 `--pod-table-cell-color`。表头可使用 `--oyd-raised-surface` 形成轻微差别，文字用 `--color-text1-10`；正文行默认同色，不额外叠加强斑马纹。横线和列线共同使用 `--color-line1-1`，保证纵向扫描和横向比较的连续性。表格外壳统一圆角，内部单元格保持 `--corner-zero`。

行内上下留白 `--s-3`，左右 `--s-3`；文本左对齐，数值右对齐，表头跟随其字段对齐。排序标识只出现在实际可排序列。列宽、固定列、截断与换行由具体任务确定，不为保持紧凑而隐去必要内容。

复合数值单元格可以将主值与变化量放在同一行，靠对齐、间距和小箭头区分；两者量纲、基期与方向需明确。变化量使用业务确定的状态颜色，仍保留正负号及文本。没有对比数据时不添加箭头或百分比。

实体标签可用 `--oyd-raised-surface`、`--corner-2` 与细竖色标，文字使用正常前景；竖线只表示明确分类或来源，不随机为每行染色。阶段分类使用 2.5 的小描边标签规则，真正的成功／异常状态仍使用平台语义。

独立记录列表保留连续阅读结构，每条记录用细分隔线而非完整卡片包围；有说明时采用主文案与次行元信息。活动型列表允许弱虚线分隔，常规表格继续使用实线网格。真实头像或实体素材存在时才显示，不复制示例名称、邮箱或图片。

### 标签、图形与状态

分类标签使用 `--corner-1`，状态图标与文案成对出现；圆点只表示有定义的状态，不用装饰性圆点冒充未读或在线。彩色图标底上的前景固定使用 `--oyd-on-dark-color`，保持设计稿的浅色线性图标与既定渐变背景配对，不因主色变化另选黑白或改变背景明度。

进度轨道使用 `--color-fill1-3`；完成区域根据业务语义使用品牌或平台状态色。必须有有效总量或目标，未知比例显示未知，不用随机长度代替。

图例、图形、读数和可读数据入口共用同一份数据映射；同一序列保持同色。坐标轴、标签和读数显示对应单位，轴的计数、百分比或金额不能与另一种量纲混用。所选时间范围、聚合周期、横轴区间与浮层时间保持一致；若有跨年范围需明确年份。缺失数据不能当作零，隐藏序列后的总量与读数需遵循明确口径。

| 状态 | 视觉表达 |
| --- | --- |
| Hover | 透明中性对象使用 `--color-fill1-1`；已有同底色的控件加强边界或文字；品牌按钮使用 `--color-brand1-1` |
| Active | 中性控件使用 `--color-fill1-2`，品牌按钮使用 `--color-brand1-9`；不挪动布局 |
| Focus | 清晰品牌轮廓，建议 2 CSS px、外偏移 2 CSS px（推断）；必要时用中性间隔区分相邻表面，不能只加强微弱高光 |
| Selected | `--color-fill1-2` 配合高对比文字或明确勾选；导航继续消费自己的六项颜色 |
| Disabled | 文字 `--color-text1-2`，按钮采用对应禁用语义；不保留高亮 hover；水印色不用于正常说明 |
| Error / Warning / Success / Info | 平台已有状态色、可读文本和必要图标共同表达；不新建同义页面变量 |
| Loading / Empty | 中性加载占位或明确空状态；不以示例曲线、数字、随机活动记录填充空白 |

覆盖层内各控件仍独立消费输入、悬停和选中角色，不能继承导航配色。颜色与边界过渡建议 120–160 ms（推断）；不采用持续流光、呼吸灯或整卡悬浮位移。

### 表单组件与版式结构

表单使用与自定义页面相同的应用全局样式，字体、色彩、表面、边界、圆角、密度和状态延续本主题。表单支持在顶部、左侧、主体、右侧和字段之间组合 Tab/切换、按钮组/操作入口、图片/图形、状态区、标题与 `Divider`、`ColumnContainer`、辅助内容和业务字段。各组件承担导航、操作、视觉焦点、反馈、层级、节奏、装饰或采集作用。普通业务分组和章节分隔使用 `Divider`，横向字段组合使用 `ColumnContainer`。每张表单在项目 `design.md` 写清组件位置与作用、列比例、标签位置、字段与章节间距、底栏、详情延续和窄屏重排。

## 4. 特色表达配方

### R1 带底部说明条的微柱指标

**适用内容：** 已有一个重点数值及其真实变化或补充口径；仅当另有明确时间序列或分类分布时显示微柱。

**继承基础：** 采用 2.1 的主卡片与局部抬起正面、2.4 的数值规格、第三部分变化量语义。

**特殊组合：** 指标主面使用 `--oyd-raised-surface`，左侧为名称与数值，右侧留给同色系短柱；下方说明条沿用 `--pod-card-bg-color`，与主面贴合，在同一外壳中形成“稍亮正面＋较暗底沿”。说明条可放真实比较方向及基期，避免重复绘制另一张完整卡片。微柱沿同一底线排列，用该序列基色及 2.5 的渐变；每根柱高由真实值映射，建议柱宽 4–6 CSS px、间距 3 CSS px（推断），可用空间不足时减少可视项但明确范围，不能随机删数据。系列含负值时显示零线及对应负向柱，不能全部画成向上。

**无匹配时：** 没有微序列就保留数值与说明；没有比较基期就去掉增长率和箭头，改用已有口径说明。没有底部信息时合并为普通数值单元，不留空底条；不预设四张指标卡。

### R2 轻质感堆叠柱

**适用内容：** 同一时间点或分类中存在可相加、互不重叠、同量纲的组成项。仅有并列系列而不可相加时使用分组柱，不能套用堆叠。

**继承基础：** 使用第三部分数据一致性规则、2.5 的调色板及局部渐变、2.1 的读数浮层。

**特殊组合：** 暗面中保留稀疏水平网格和清楚的底线，单根柱内按固定顺序堆叠各组成项；各段上亮下暗，但基色、图例和读数保持一致。轻微分段边缘帮助区分实体感，堆叠端点仍严格落在累计数值坐标，不插入抬高总高度的像素缝隙，也不把每段单独抬离基线。圆角只修饰最外露的柱端，内部接缝使用细色界，避免每段圆角造成面积缺失的错觉。极小值不得用固定最小高度夸大，必要时通过读数补充。

读数浮层指向当前真实柱段或整柱；显示所选时间／分类、序列名称、单位及值。需要整柱总计时明确标为总计；点击或悬停某段时不能拿另一统计口径的金额替代。总体汇总与当前图表不是同一口径时，标题旁说明差别。

**无匹配时：** 不可加总的系列改用分组柱或普通表格；无有序数据时不用时间轴；缺失组成项明确标注，不让总量看似完整。渐变降低辨识度或平台不支持时保留实色与细边界，数据几何优先。

### R3 彩色方标活动列表

**适用内容：** 真实事件或记录具有类别、摘要以及时间；次级说明和未读标记仅在对应字段存在时出现。

**继承基础：** 沿用第三部分独立记录列表、2.4 的文字与间距、2.5 的分类色和图标规则。

**特殊组合：** 起始处以 `--s-8` 见方的小圆角图标承接类别，圆角 `--corner-2`，使用局部渐变和最多一条 `--oyd-edge-highlight` 上缘；其后为主文案和次行说明，尾部为时间及真实状态。图标表达类别，颜色映射跨记录稳定；全行保持中性表面，不形成彩色横幅。列表行以弱细线或轻虚线相隔，长文案自然换行，不为等高截断关键事件。

**无匹配时：** 无类别时回到普通线性图标或不显示图标；无时间时采用普通记录列表；无未读模型时去掉尾部圆点。只读事件不伪装为可点击操作，不为保留配方虚构事件源。

## 5. 项目应用与调整规则

### 变量与项目换色

YAML 是变量值唯一事实源；全局变量供原生及自定义页消费，本模板的扩展包含抬起正面、高光、独立前景、数据分类色和重点数值排版。递归读取以 `--` 开头的标量叶子，分组名称不拼入变量名；平台基础与项目扩展均在主题中声明，可无环引用，并按实际设计补充变量，不重复定义已有角色。

需求决定页面、内容与操作，平台约束决定可用能力，主题规定视觉表达。导航模式和页面结构沿用项目选择；原生导航只配置其开放颜色，自绘导航才补充相关视觉细节。条件配方不得覆盖真实数据语义和自然内容增长。

- 色彩来源：{{COLOR_SOURCE}}。
- 品牌种子保留 `{{PRIMARY_COLOR}}`，按“用户明确指定 → 项目已配置 → 平台当前主题”的顺序取值；没有可用种子时保留占位，由项目实例化补齐，不设置固定回退色。用户给定种子不静默替换。
- 七个 Brand Token 按 YAML 明示比例计算：把种子与基底解析为 8 位 sRGB，每通道取 round(a × seed + b × base)，a + b = 1，限制在 0–255 后输出六位十六进制。混合编码后的 sRGB 值，不执行线性光转换；项目文档中替换全部生成标记。局部图形与标签派生沿用同一算法，按 2.5 的基色和比例计算；主题色引用或公式保留依赖关系，换种子时重新计算，不冻结为旧值。
- 固定中性灰、非主题分类色与平台状态色保持各自语义。主数据色及同主题对照色始终关联 `--color-brand1-6`，换主色时同步更新。导航六项按导航表面成组配对；当前均为中性色，若项目增加主题色导航角色，直接引用对应 Brand Token，不复制固定值，也不绑定内容 Text／Fill。
- 项目若改为浅色内容模式，应重新确定所有内容表面及文字配对，普通 pop-up 使用白色；这属于有明确需求的主题调整，不能通过单改画布自动完成。
- 保留每个组件及状态已确定的文字、图标和背景配对。换主色仅更新品牌引用与原有派生公式，不自动切换黑白前景、调亮背景或改变渐变明度；导航和覆盖层分别沿用自身配对。

局部尺寸和动效推断可按真实平台能力调整；保留相近明度的灰面、细行列分界、轻高光与局部彩色图形的关系。主题不新增图片、浏览器工具栏或桌面背景；仅在项目明确需要并有可用素材时，在对应页面记录素材安排。

### 项目页面设计

实例化仅填写实际页面，每页形成确定结果：

- **页面内容：** 页面名称、任务、真实信息和已有操作。
- **首屏印象：** 第一视觉焦点与整体感受，以及由构图、灰面差、文字主次和局部颜色形成它的具体方式。
- **布局安排：** 区块位置、宽度、列数、高度、对齐与必要等高对象；明确窄屏顺序和重排。不默认固定侧栏、四张指标卡或左右面板比例。
- **视觉表达：** 各区块消费的表面、组件与文字角色；使用配方时注明编号、位置和满足的内容条件。
- **标志性时刻：** 一处明确的静态画面或关键交互，说明位置或触发条件、具体表现及其任务价值。

首屏焦点和标志性时刻可以来自同一处。素材来源、缺口处理、平台限制直接写在对应页面；最终页面方案给出确定选择，不为套用视觉机制扩充业务或沿用示例数据。

{{PAGE_APPLICATIONS}}

### 页面设计验收

只检查该页实际使用的内容；未渲染的页面保留为待执行要求。

- [ ] **首屏印象：** 焦点、灰阶层次和内容主次符合方案，局部颜色没有压过主要任务。
- [ ] **布局安排：** 分区、比例、列数、高度、对齐和窄屏顺序符合方案，记录与文字增长得到容纳。
- [ ] **风格表达：** 相邻深灰表面、细网格与克制高光成立；真实数据、单位、时间和颜色映射一致，图形渐变与标签仍可辨认。
- [ ] **标志性时刻：** 指定画面或反馈在相应位置或条件下出现，帮助理解信息或完成操作，没有用虚构图形或不可用操作代替。
