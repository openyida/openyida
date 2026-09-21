---
name: "{{PROJECT_NAME}}"
description: "近黑画布承载紧凑炭灰面板，细描边与横向分隔建立秩序；窄图标导航以局部色条指示位置，数据量表和低亮面积趋势按内容启用，品牌强调与测量色阶各司其职。"
themeId: dark-rail-signal-panels
navTheme: dark
tokens:
  application-global:
    appearance: # 应用外观：应用背景、内容表面与完整导航设计
      surfaces: # 应用背景与内容表面
        "--pod-app-root-bg-color": "#0A0A0A" # neutral-gray；应用根背景及加载兜底
        "--pod-app-root-bg-image": "none" # 应用根背景图；支持 none、完整 url("...") 或 CSS 渐变，只作用于根节点
        "--pod-page-bg-color": "#0A0A0A" # neutral-gray；近黑内容画布
        "--pod-card-bg-color": "#161616" # neutral-gray；卡片、表单与详情主容器
        "--pod-table-cell-color": "var(--pod-card-bg-color)" # 表格正文单元格背景；跟随卡片背景
      navigation:
        "--pod-shell-theme-bg-color": "#151515"
        "--pod-nav-item-text-color": "#AAAAAA"
        "--pod-nav-item-text-hover-color": "#E3E3E3"
        "--pod-nav-item-text-selected-color": "var(--color-brand1-6)"
        "--pod-nav-menu-bg-hover-color": "#1D1D1D"
        "--pod-nav-menu-bg-selected-color": "#242424"
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
        "--pod-nav-menu-item-radius": "0px"
        "--pod-nav-menu-item-border": "1px solid #353535"
        "--pod-nav-menu-item-hover-border": "1px solid #727272"
        "--pod-nav-menu-item-selected-border": "1px solid var(--color-brand1-6)"
        "--pod-nav-menu-font-size": "14px"
        "--pod-nav-menu-item-selected-font-weight": "600"
        "--pod-nav-menu-line-height": "20px"
        "--pod-nav-menu-gap": "4px"
        "--pod-shell-lshape-border-radius": "6px"
    colors: # 品牌色、内容区语义色与固定色；不随导航深浅切换
      "--color-white": "var(--pod-card-bg-color)" # 全应用基础表面；随暗色内容主面，不用于白字
      "--color-brand1-1": "<生成实际色值：--color-brand1-6 88% + #FFFFFF 12%，sRGB 逐通道混合>" # 品牌交互元素悬停
      "--color-brand1-2": "<生成实际色值：--color-brand1-6 12% + #FFFFFF 88%，sRGB 逐通道混合>" # 平台预留品牌浅色，保留平台既有消费关系
      "--color-brand1-3": "<生成实际色值：--color-brand1-6 4% + #FFFFFF 96%，sRGB 逐通道混合>" # 品牌派生浅色
      "--color-brand1-5": "<生成实际色值：--color-brand1-6 38% + #171717 62%，sRGB 逐通道混合>" # 品牌派生深色
      "--color-brand1-6": "{{PRIMARY_COLOR}}" # 唯一品牌种子；实例化时使用用户、项目或平台当前主题色，不从参考图补回固定色
      "--color-brand1-9": "<生成实际色值：--color-brand1-6 76% + #000000 24%，sRGB 逐通道混合>" # 品牌交互元素激活或按下
      "--color-brand1-10": "<生成实际色值：--color-brand1-6 26% + #202020 74%，sRGB 逐通道混合>" # 品牌禁用
      "--color-line1-1": "#303030" # neutral-gray；行分隔与图表辅助网格
      "--color-line1-2": "#3B3B3B" # neutral-gray；面板、控件与浮层常规边界
      "--color-fill1-1": "#202020" # neutral-gray；输入基础、中性悬停及弱填充
      "--color-fill1-2": "#2B2B2B" # neutral-gray；中性按下与选中
      "--color-fill1-3": "#363636" # neutral-gray；较重填充与进度轨道
      "--color-fill1-5": "#282828" # neutral-gray；下拉、弹窗、抽屉和读数浮层
      "--color-fill1-10": "#262626" # neutral-gray；固定深色 Tooltip 背景，不随品牌或明暗主题变化
      "--color-text1-5": "#FFFFFF" # neutral-gray；固定 Tooltip 反色文字，与 --color-fill1-10 配套
      "--color-text1-4": "#F0F0F0" # neutral-gray；标题、主内容与核心数值
      "--color-text1-10": "#C0C0C0" # neutral-gray；表头与 placeholder
      "--color-text1-3": "#A7A7A7" # neutral-gray；说明、坐标与时间
      "--color-text1-2": "#696969" # neutral-gray；仅禁用文字
      "--color-text1-1": "#414141" # neutral-gray；仅水印文字
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
    rounded: # 按组件用途选择 Token；修改数值会同步影响所有引用该 Token 的组件
      # 调整风格时保留用途映射；常规圆角增大更圆润、减小更利落，各数值档位保持递增
      "--corner-zero": "0px" # 贴边及连续表格拼接
      "--corner-1": "4px" # 小标签、分页方钮及微型色块
      "--corner-2": "6px" # 输入、按钮和菜单项
      "--corner-3": "8px" # 浮层、气泡和弹窗
      "--corner-4": "10px" # 组内独立信息单元与缩略图托底
      "--corner-5": "12px" # 卡片、主容器与抽屉
      "--corner-circle": "50%" # 头像与状态圆点
      "--corner-semicircle": "500px" # 真实需要的状态胶囊或圆形按钮
    shadow: # 全局阴影档位；具体对象是否使用阴影及使用哪一档，由正文明确
      "--shadow-1": "0px 2px 4px 0px rgba(0, 0, 0, 0.12)"
      "--shadow-2": "0px 4px 20px -1px rgba(0, 0, 0, 0.16)"
      "--shadow-3": "0px 10px 28px -2px rgba(0, 0, 0, 0.24)"
  custom-page:
    colors:
      "--oyd-page-bg": "var(--pod-page-bg-color)" # 页面桥接
      "--oyd-metric-surface": "#202020" # neutral-gray；汇总带内的独立数值单元
      "--oyd-score-surface": "#0A0A0A" # neutral-gray；独立量表整张卡片的近黑表面，包含标题与读数
      "--oyd-on-accent-color": "#080808" # neutral-gray；自绘亮底操作的深色前景
      "--oyd-on-dark-color": "#FFFFFF" # neutral-gray；自绘深色操作的独立浅色前景
      "--oyd-trend-color": "var(--color-brand1-6)" # 单一趋势主序列，明确随品牌种子变化
      "--oyd-scale-1": "#B93832" # 独立有序测量色阶第一级；不等于平台错误状态
      "--oyd-scale-2": "#E64B37" # 独立有序测量色阶第二级
      "--oyd-scale-3": "#F58A20" # 独立有序测量色阶第三级
      "--oyd-scale-4": "#7BAF36" # 独立有序测量色阶第四级
      "--oyd-scale-5": "#269D4B" # 独立有序测量色阶第五级；不等于平台成功状态
    typography:
      "--oyd-font-size-metric": "24px" # 普通重点数值，推断
      "--oyd-font-weight-metric": 500
      "--oyd-font-lineheight-metric": 1.25
      "--oyd-font-size-score": "44px" # 独立量表核心读数，推断
      "--oyd-font-weight-score": 600
      "--oyd-font-lineheight-score": 1.1
---

# {{PROJECT_NAME}} design.md

## 1. 风格摘要

**暗轨信号面板 · Dark Rail Signal Panels**

近黑画布上排列略亮的炭灰面板，窄间距、单层细描边与水平分隔共同组织密集信息。常规图表延续炭灰卡面，独立量表可整卡回到近黑底；汇总带里的数值单元再亮一档。标题和关键数值明亮，说明与更新时间退后；品牌色只点亮当前位置、少量操作及主趋势。真实状态和量表等级独立编码，使阅读重心落在内容本身。

| 核心特征 | 可见表现 | 主要偏离风险 |
| --- | --- | --- |
| 暗画布上的有界面板 | 画布、面板和内部弱填充形成小幅明度阶梯，普通卡片不依赖强投影 | 改为大片玻璃、双层浮雕边或发光描边，会改变层次机制 |
| 紧凑而连续的信息组织 | 标题、检索、表格行和元信息短距离衔接，横分隔线保持扫描连续性 | 缩小字体、逐行卡片化、过多彩色底块会削弱比较效率 |
| 克制的位置强调 | 导航、当前页码和轻操作以小面积品牌方向的强调提示位置 | 将所有选中容器整块染色，或强制所有项目采用图标侧栏 |
| 独立的数据信号 | 评分短条、量表和等级图共用测量映射；操作与运行状态仍各自独立 | 将品牌色、告警色和评分色混为一组，导致相同分值显示不同等级 |

基础规则可用于普通表单、列表与详情。图标轨道仅适用于已确定的自绘导航；汇总数值、量表和趋势依赖真实内容，不规定业务领域、固定模块数量或页面结构。

## 2. 页面视觉系统

YAML 保存变量值，正文约定消费关系。局部尺寸及未展示的状态为实施推断，不把截图物理像素直接换成 CSS 尺寸。

### 2.1 表面、区块与层次

| 对象 | 背景与前景 | 边界、圆角与阴影 |
| --- | --- | --- |
| 应用根背景 | `--pod-app-root-bg-color`，背景图 `--pod-app-root-bg-image` 仅作用于根节点 | 默认纯暗底；外围光斑、展示留白与设备外框不进入应用主题 |
| 页面画布 | `--pod-page-bg-color`；自定义页由 `--oyd-page-bg` 单向桥接 | 贴边使用 `--corner-zero`；通过间距区分内容区 |
| 一级卡片、表单与详情主容器 | `--pod-card-bg-color`；主前景 `--color-text1-4`、说明 `--color-text1-3` | `--color-line1-2` 单层细边界，`--corner-5`，默认无外投影 |
| 汇总带内的数值单元 | `--oyd-metric-surface`；主值 `--color-text1-4`，说明 `--color-text1-3` | `--corner-2`，以底色和留白区隔，不重复厚边框 |
| 独立量表卡片 | 整卡使用 `--oyd-score-surface`，标题与核心读数 `--color-text1-4`；此处是普通卡片的表面变体 | 与普通卡片同样使用 `--color-line1-2`、`--corner-5`；标题和量表共用近黑底，不在炭灰卡内再嵌一个暗盒 |
| 趋势、分布等常规图表绘图区 | 沿用所在卡片的 `--pod-card-bg-color`，坐标与图例说明使用 `--color-text1-3` | 绘图区不额外铺近黑底、不加内框；网格保持弱于面板边界 |
| 表格表头、弱辅助区 | `--color-fill1-1`；表头 `--color-text1-10` | `--color-line1-1` 分隔，内部拼接不逐格圆角 |
| 表格正文 | `--pod-table-cell-color` 单向跟随卡片；正文与说明分别使用 Text 角色 | 水平行线 `--color-line1-1`，不默认增加垂直网格 |
| 下拉、气泡、弹出日历、弹窗及导航弹出层 | `--color-fill1-5`；主前景 `--color-text1-4`、说明 `--color-text1-3` | `--corner-3` 与 `--color-line1-2`；小浮层用 `--shadow-1`，弹窗用 `--shadow-2` |
| 抽屉 | `--color-fill1-5` 与配套内容前景 | 外露角 `--corner-5`，贴边角归零；`--color-line1-2`、`--shadow-2` |
| 图表读数卡 | `--color-fill1-5`；读数 `--color-text1-4`、时间和单位 `--color-text1-3` | `--corner-3`、`--color-line1-2`、必要时 `--shadow-1` |
| 短 Tooltip | 固定 `--color-fill1-10` 与 `--color-text1-5` 配对 | `--corner-3`；与完整数据读数卡分别处理 |

层次由近黑画布、炭灰常规卡片与略亮的汇总单元组成；独立量表是整卡近黑的局部例外，不能把它的背景推广到所有卡片和图表。细边界建议 1 CSS px（推断），内部线条弱于面板边界。阴影用于覆盖关系，普通卡片不套用全局阴影；`--shadow-3` 保留为档位，主题默认不使用。嵌套层级以任务关系为依据，不能为每个字段再造一层容器。

`--color-white` 是全应用基础表面，当前跟随暗色卡片；白字使用独立前景 `--oyd-on-dark-color`，不借用基础表面或 Tooltip 前景。输入默认表面始终消费输入 Fill；汇总单元和输入当前同色，不代表二者共用语义。背景图不传递给卡片、输入或表格。

### 2.2 应用导航

近黑导航贴合技术面板，菜单以窄间距排列，品牌文字标出当前页面，分组与搜索沿用信号面板的细线。

菜单轮廓使用 --pod-nav-menu-item-radius、--pod-nav-menu-item-border、--pod-nav-menu-item-hover-border、--pod-nav-menu-item-selected-border。侧栏和顶部菜单共用轮廓，各状态保持相同边框宽度，文字位置稳定；具体数值以本项目 Token 为准。

导航与应用框架、表单、自定义页面和详情页共用设计语言。先按业务入口安排菜单、分组、搜索、品牌区与常用操作，再一起确定导航与正文的明暗、表面、字体、边界、圆角和密度。平台导航使用真实页面菜单；自绘导航按同一套导航 Token 实现。命名模板沿用自身 navTheme，换主色保持导航明暗与内容画布；需要另一导航明暗时改选主题，自由创意按项目明确设计。

导航底色使用 --pod-shell-theme-bg-color；普通、悬停和选中文字分别使用 --pod-nav-item-text-color、--pod-nav-item-text-hover-color、--pod-nav-item-text-selected-color；悬停和选中背景使用 --pod-nav-menu-bg-hover-color、--pod-nav-menu-bg-selected-color。图标跟随对应文字状态，当前入口同时用背景或字重表达。

菜单高度、圆角与间距使用 --pod-nav-menu-item-height、--pod-nav-menu-item-radius、--pod-nav-menu-gap；搜索、品牌区、分组、操作和弹出菜单使用 navigation 分组中的对应 Token。弹出菜单的底色、文字与搜索状态成组配套，导航与内容可以分别选择明暗。选中项使用 --pod-nav-menu-item-selected-shadow：none 关闭额外标记，完整 box-shadow 值可表达左、右或底部内阴影，不占据菜单布局空间；该 Token 独立于导航明暗。菜单高度、文字行高、内距和框架留白一起调整，给外阴影、长标题与键盘焦点留出空间。

桌面检查菜单、搜索、选中态与表单的协调；折叠后保留可识别图标和入口名称；窄屏保持菜单可展开、当前页面可定位、键盘焦点可见。提交、编辑、详情与自定义页都沿用这一导航设计。

### 2.3 页面标题与操作

标题区沿用近黑画布，不额外包入整张卡片。页面标题使用 subhead 规格；已有简短状态可位于其旁，间隔 `--s-4`，以弱填充胶囊容纳文字和小图标。该胶囊只说明有依据的状态，不因视觉需要标注“实时”。

已有日期、用户信息和页面操作可在尾部紧凑排列，组内 `--s-3`。日期与用户信息可各用炭灰卡片表面承接、保持小圆角，标题本身仍直接放在画布上。展示时间需来自明确时区和数据来源，不添加装饰性时钟。标题与主体间隔 `--s-4`；空间不足时操作区换行，保持标题优先。

实际存在汇总内容时，可以在普通面板中先呈现标题与解释，再安排数值单元；数量、排列和窄屏顺序由页面方案确定。没有汇总、状态或用户信息时不保留空位。

### 2.4 排版、间距与形状

字体使用 `--font-family-base`，中文回退到可用系统无衬线。数值使用等宽数字特性，单位、百分比和小数精度保持口径一致，不把整张表格改为等宽代码字体。

| 角色 | 字号 / 字重 / 行高 | 前景 |
| --- | --- | --- |
| 页面标题 | `--font-size-subhead` / `--font-weight-subhead` / `--font-lineheight-subhead` | `--color-text1-4` |
| 面板标题、重点记录名称 | `--font-size-body-2` / `--font-weight-body-2` / `--font-lineheight-body-2` | `--color-text1-4` |
| 正文、字段标签与操作文案 | `--font-size-body-1` / `--font-weight-body-1` / `--font-lineheight-body-1` | 主要内容 `--color-text1-4`，辅助内容 `--color-text1-3` |
| 连续表格 | `--font-size-table` / `--font-weight-table` / `--font-lineheight-table` | 正文 `--color-text1-4`，表头 `--color-text1-10` |
| 时间、说明、图例与刻度 | `--font-size-caption` / `--font-weight-caption` / `--font-lineheight-caption` | `--color-text1-3`；不借用禁用灰 |
| 普通重点数值 | `--oyd-font-size-metric` / `--oyd-font-weight-metric` / `--oyd-font-lineheight-metric` | `--color-text1-4` |
| 独立量表核心读数 | `--oyd-font-size-score` / `--oyd-font-weight-score` / `--oyd-font-lineheight-score` | `--color-text1-4`；仅用于单个明确的量表焦点 |

页面边距用 `--s-4` 至 `--s-6`，相邻模块间距 `--s-3`，独立区段间距 `--s-5`；面板内边距 `--s-4`，检索与主体之间 `--s-3`，同一行紧密元素之间 `--s-2`。缩略图与文案留 `--s-3`，两行同属一条记录的信息间距 `--s-1`。紧凑感来自稳定对齐和较短间距，不缩小全局字体。

外容器用 `--corner-5`，组内独立信息单元或缩略图托底用 `--corner-4`，浮层用 `--corner-3`，输入及按钮用 `--corner-2`，小标签及分页方钮用 `--corner-1`。头像和状态点用 `--corner-circle`；仅真实需要的状态胶囊或圆按钮使用 `--corner-semicircle`。

具体列数、宽度、比例和等高对象由第五部分确定，主题不统一锁定高度，也不要求每个面板独立滚动。

### 2.5 色彩、图标与点缀

品牌色用于实际链接、当前分页、少量主操作及品牌识别。单一趋势序列通过 `--oyd-trend-color` 明确继承品牌种子；它表示序列身份，不能根据每个点的好坏随意跳色。导航的选中强调直接引用 `--color-brand1-6`，保持既定状态配对；中性表面与普通前景保持各自角色。

运行状态、成功、错误、警告与信息使用平台已有语义，不在页面层重建同义状态变量。`--oyd-scale-1` 至 `--oyd-scale-5` 是独立有序测量调色板，服务同一评分定义下的数值等级，不能拿它替换运行状态。五个可用色阶不等于每个项目必须有五个等级；实际区间、等级数与方向由真实测量规则确定。

同一评分规则中的表格短条、半环、分布图及文字等级必须使用相同的“数值 → 等级 → 颜色”映射；颜色不能替代等级文字与区间说明。区间需覆盖完整合法定义域且无交叠，含边界的开闭规则明确。若数值越低越好，映射按实际含义确定，不因截图就认定高分一定有利。

图标统一线性家族，普通内容图标建议 16–20 CSS px、轨道主图标 22–24 CSS px，线宽约 1.5–2 CSS px（推断）。状态图标可按平台语义着色；普通表格图标保持中性。实体缩略图和头像只使用真实素材或明确的中性替代，不生成装饰性业务对象。

大面积表面保持平整无纹理。仅面积趋势允许沿纵向由序列色向透明衰减，建议顶部不透明度 24%、底部 0（推断），范围裁切在真实曲线与基线之间。无阴影光晕、背景雾化或外部彩色光斑；图形渐变不制造数据或类别。

## 3. 基础组件表达

组件是否存在由任务决定。未列出的组件按任务结构、表面、文字、形状与状态顺序推导，不新增同义 Token。

### 面板、汇总与控件

面板使用 2.1 的卡片表面，标题与真实辅助操作同排，主体通过间距和细线衔接。已有汇总数据可组成紧凑数值单元：名称在上，主值在下，真实关联图标在旁；图标不反复染成品牌色，统计数值只有具有明确状态语义时才借助平台状态色强调。无汇总数据时保留普通正文结构。

按钮采用 `--corner-2`；中性默认面使用 `--color-fill1-1`，必要较重底面使用 `--color-fill1-3`，边界 `--color-line1-2`，文字 `--color-text1-4`。主操作使用 `--color-brand1-6`，前景固定使用 `--oyd-on-accent-color`，沿用设计稿的品牌底、深色字；悬停和按下仅切换对应品牌背景档，保留深色前景。原生按钮沿用同一状态配对。

按钮高度选 `--s-7` 至 `--s-10`，常规为 `--s-8`；输入、检索与筛选选 `--s-8` 至 `--s-10`，常规也为 `--s-8`。输入基础面固定消费 `--color-fill1-1`，文字 `--color-text1-4`，placeholder `--color-text1-10`，边界 `--color-line1-2`；不能借用卡片或覆盖层背景。

已有搜索、筛选和排序在工具行紧凑排列，间距 `--s-2`，自然换行不压缩字号；不存在的筛选维度不添加空选择器。表单标签与输入间距 `--s-2`，字段间距 `--s-4`，分组间距 `--s-6`。错误说明贴近字段，使用平台错误语义；多行文本按内容自然增长。

### 表格、短量条与分页

表头使用 `--color-fill1-1`，文字 `--color-text1-10`；正文使用 `--pod-table-cell-color`，通过 `var(--pod-card-bg-color)` 跟随卡片。仅保留水平行线，行内上下留白 `--s-3`、左右 `--s-3`，文本与身份信息左对齐，数值列右对齐，时间与动作保持一致锚点。

实体信息可以由小型缩略图、主标识和次行描述组成；与实体相关的人物列可使用圆头像与姓名。二者含义分别说明，不将所有缩略图都做成头像。实际唯一标识从数据读取；无素材时用中性实体图标或名称首字，不沿用演示人物与编号。

评分类单元格仅在量表定义明确时显示“当前值／上限”或包含下限的完整范围，下方配短条。轨道使用 `--color-fill1-3`，填充色使用实际等级对应的测量色阶；长度由 (值 − 下限) / (上限 − 下限) 计算，并与读数共源。短条建议高 4 CSS px（推断），不得用独立随机宽度装饰。缺失值显示明确缺失，不显示零分；越界值保留真实数值并标明异常，图形绘制可限制在轨道内。

运行状态使用平台状态色的圆点加文字，可配低强度边界和填充，不整行染色。评分等级与运行状态各有字段和解释，即使同一行颜色相近也不能合并。

分页放在表格末尾，与真实记录范围说明同排。当前页采用小型品牌色方钮，数字固定使用深色前景 `--oyd-on-accent-color`；其余页码保持中性；不可用的翻页进入禁用状态。页数与总数来自实际查询，分页不会默认改变整个筛选范围的汇总值。无分页需求时不保留空分页栏。

### 独立列表与优先提示

普通列表使用横分隔线和稳定对齐，不把每条记录包成悬浮卡。含优先级的真实提示可用语义图标、主标题、补充信息及末尾等级标签，颜色采用平台警告／错误等已有语义，不能直接套评分色阶。

提示必须有对应记录、依据和时间或触发条件；顺序由实际优先级与任务决定。尾部箭头只表示真实可进入的详情，更多操作只显示实际可执行项。没有异常时明确说明当前无提示，不制造示范告警。

### 图形、状态与反馈

图表图例、读数、图形和可读明细共用真实数据与单位。时间轴由有效日期生成；当前数据时间、时区、统计周期和筛选区间明确，未来预测需与历史实测有可辨认的表达。没有真实持续更新能力时不展示“实时”或持续闪动状态。

| 状态 | 视觉表达 |
| --- | --- |
| Hover | 中性透明对象用 `--color-fill1-1`；已有同底色控件加强边界或文字；品牌操作用 `--color-brand1-1` |
| Active | 中性对象用 `--color-fill1-2`，品牌操作用 `--color-brand1-9`；不改变布局 |
| Focus | 可见品牌轮廓，建议线宽 2 CSS px、偏移 2 CSS px（推断）；不能只依靠原有弱边框 |
| Selected | 中性填充 `--color-fill1-2` 配合勾选或明确文字；导航沿用六项专属配色，当前分页沿用品牌方钮 |
| Disabled | `--color-text1-2` 与弱化操作表面，不保留高亮 hover；水印色不用于正常说明 |
| Error / Warning / Success / Info | 使用平台现有状态前景与文本／图标，页面层不重建同义状态色 |
| Loading / Empty / Stale | 加载使用中性占位，空状态说明无数据；过期数据保留明确时间与过期提示，不冒充实时结果或归零 |

微变化建议 120–180 ms（推断），不使用整卡放大、持续发光和非任务所需的自动循环动画。覆盖层内的输入与选中项分别消费各自 Fill，不直接继承导航色。

### 表单组件与版式结构

表单使用与自定义页面相同的应用全局样式，字体、色彩、表面、边界、圆角、密度和状态延续本主题。表单支持在顶部、左侧、主体、右侧和字段之间组合 Tab/切换、按钮组/操作入口、图片/图形、状态区、标题与 `Divider`、`ColumnContainer`、辅助内容和业务字段。各组件承担导航、操作、视觉焦点、反馈、层级、节奏、装饰或采集作用。普通业务分组和章节分隔使用 `Divider`，横向字段组合使用 `ColumnContainer`。每张表单在项目 `design.md` 写清组件位置与作用、列比例、标签位置、字段与章节间距、底栏、详情延续和窄屏重排。

## 4. 特色表达配方

### R1 半环量表与中心读数

**适用内容：** 存在已定义上下限、单位及等级规则的单一量表，且上限严格大于下限，需要呈现其当前水平；汇总值还需明确其计算方法及数据范围。

**继承基础：** 量表使用 2.1 的独立量表卡片表面，标题与图形共同置于整张近黑卡内；沿用 2.4 的独立读数字号、第三部分短量条的归一化和缺失处理，以及 2.5 的测量等级映射。

**特殊组合：** 从左侧下限到右侧上限绘制半圆轨道，未填充部分为 `--color-fill1-3`。设归一化值 p = (值 − 下限) / (上限 − 下限)，有效填充角度为 180° × p，绘制范围限制为 0–180°，读数仍保留真实值。弧端圆润，线宽建议为外径的 6%（推断），圆帽不得使零值看似已有进度。中心突出实际读数，范围／单位较小，等级名称置于其下且与同域数据的等级一致。

聚合读数可以是实际定义的加权值或其他量表算法，不能默认对各等级的数量或百分比直接求平均。品牌色不替换量表等级色，中心读数始终可读，不强制全体文字跟随较暗色阶。

**无匹配时：** 没有定义域或聚合方法时仅显示已知数值与解释，不画半环；数据缺失时显示未知而非零弧。任务只是比较多个数值时使用表格或普通图形，不为造型增加评分体系。

### R2 等级分布环与对齐图例

**适用内容：** 同一测量定义、筛选范围和快照下，存在互斥且完备的等级分类及真实数量，需要查看整体构成。

**继承基础：** 沿用第三部分数据一致性与缺失规则、2.5 的测量等级映射，表面采用普通卡片。

**特殊组合：** 环形图与纵向图例并列或顺序排列；图例每行包含色点、等级及完整区间、数量和比例，文字列与数字列分别对齐。环宽建议为外半径的 35%–40%（推断），各段角度严格等于数量 / 总量 × 360°，边界仅分隔相邻段，不放大小类别。色点、环段、行内短条和相同量表读数保持同一等级映射。

等级区间无交叠和遗漏，数量和分母来自同一统计范围；百分比按明确舍入规则显示，不能从已舍入的百分比反推数量。缺失评分要明确计为“未知”或注明已从分母排除。表格只显示当前页时，环图仍可统计整个筛选结果，但必须说明范围，不将分页记录量误作总体。

**无匹配时：** 类别不互斥、分级不完整或总量未知时用普通清单，不画完整环形；总量为零时显示空状态。类别过多、色差不足或极小段不可辨时保留精确图例并采用更清楚的列表，不扩大扇区制造比例。

### R3 细折线与向下消隐面积

**适用内容：** 有真实时间或有序连续数据，能够用同一单位和口径描述一条主要趋势。

**继承基础：** 使用第三部分时间与读数规范、2.5 的 `--oyd-trend-color` 及面积透明度规则，读数浮层沿用独立 pop-up 表面。

**特殊组合：** 细折线配小节点作为数据主体，线下到真实基线间填充低透明渐变；细网格与灰色刻度退后。折线建议宽 2 CSS px、节点直径 3–4 CSS px（推断），节点对准真实采样值，不为平滑造型生成额外极值。量表趋势保留其真实定义域和基线；负值数据标出零线并按真实方向填充。

显示数据周期、单位和时区；不同统计口径不能用同一条连线接续。仅有部分采样时保留缺口或说明插值规则，未来数据为预测时给出独立标识及样式。节点读数和对应明细保持一致，品牌换色仅改变序列外观。

**无匹配时：** 无时间或顺序关系时用条形图或列表；只有单点时显示数值与时点，不伪造走势。多条系列需要真实比较时另行确定可区分调色板，不能全部复用同色面积遮挡彼此。

## 5. 项目应用与调整规则

### 变量与项目换色

YAML 是变量值唯一来源。全局供原生与自定义页消费，本模板的扩展包含汇总单元、量表暗区、亮底前景、趋势色、测量色阶和独立数值规格。递归读取以 `--` 开头的标量叶子，分组名不拼入变量名，不重复定义；平台基础与项目扩展均在主题中声明，可无环引用，并按实际设计补充变量。

需求决定内容与操作，平台约束限定能力，主题定义视觉机制。原生导航只配置开放六色，自绘导航沿用项目已确定的形式；主题不因图稿出现图标轨道就隐藏实际页面名称。条件配方不能覆盖数据语义或自然内容增长。

- 色彩来源：{{COLOR_SOURCE}}。
- 品牌种子保留 `{{PRIMARY_COLOR}}`，按“用户明确指定 → 项目已配置 → 平台当前主题”的顺序取值；没有可用种子时保留占位，由项目实例化补齐，不设置固定回退色。用户给定种子不静默替换。
- 品牌派生值按 YAML 计算：把种子和基底解析为 8 位 sRGB 通道，逐通道取 round(a × seed + b × base)，a + b = 1，限制到 0–255 后输出六位十六进制。直接混合编码后的 sRGB，不做线性光转换；项目文档中解析所有生成标记，保留源公式及引用依赖；每次换主题色重新计算，不冻结上次生成值。
- 七个 Brand Token 保留各自用途，需要主题色的外观角色引用相应派生档；`--oyd-trend-color` 明确随品牌变化。固定中性灰、测量色阶和平台状态保持独立，品牌换色不重新解释等级含义。
- 导航六项按导航表面成组确定，选中强调直接引用 `--color-brand1-6`；品牌变化时同步更新引用值，其他中性色不自动染色。不建立对内容 Text／Fill 的依赖。内容明暗变化须重新配对全部表面与前景，浅色内容模式下普通 pop-up 为白色。
- 固定测量色阶专用于已有阈值定义的严重程度／健康等级，不是主题强调。项目先确定测量定义域、聚合算法、等级边界及有利方向，再采用对应颜色；未定义阈值时不启用该色阶，普通量条和趋势改用品牌色。所有相关组件共享同一等级结果，标签与图形不得各自猜测分级。
- 沿用设计稿中每个组件及状态的固定前景／背景配对：品牌主操作与当前页码保持品牌底深色字，普通暗面内容保持已有浅色文字，导航选中图标使用品牌色。换主题色不自动挑选黑白前景、调亮品牌档或重设明暗。

局部推断尺寸可按平台能力微调，保留暗画布、细描边面板、紧凑行列与局部色彩的关系。固定全局字体和间距档位保持不变；素材来源、权限、缺口及特殊约束在对应页面中确定。

### 项目页面设计

仅为需求中实际存在的页面填写确定方案：

- **页面内容：** 页面名称、任务、真实内容与操作，以及数据范围和必要口径。
- **首屏印象：** 第一视觉焦点、信息主次及整体感受，并说明对应构图、灰阶层次、色彩和留白安排。
- **布局安排：** 区块位置、宽度、列数、高度、对齐及必要等高对象；明确窄屏顺序，不默认大表格、右侧双图或固定统计卡数量。
- **视觉表达：** 各区块采用的表面、组件与文字角色；使用配方时注明编号、位置及数据条件。
- **标志性时刻：** 一处明确静态画面或关键反馈，说明位置或触发条件、具体表现和任务价值。

首屏焦点与标志性时刻可以来自同一处。仅为真实内容确定图片与实体素材，不沿用示例产品、人物、编号或日期；最终方案给出具体安排，不留下未完成选择。

{{PAGE_APPLICATIONS}}

### 页面设计验收

只验收该页实际使用的内容；尚未渲染时保留为待执行要求。

- [ ] **首屏印象：** 内容主次与焦点符合方案，品牌交互、运行状态和测量等级保持清楚分工。
- [ ] **布局安排：** 分区、列数、比例、高度、对齐及窄屏顺序符合方案，内容增长得到容纳。
- [ ] **风格表达：** 暗面板、单层细边界与紧凑排版成立；测量映射、单位、时间、分母及同域颜色一致，必要文字和图形可辨。
- [ ] **标志性时刻：** 指定画面或反馈在对应位置或条件下出现，服务真实任务，不依赖演示数据、虚构更新或不可用操作。
