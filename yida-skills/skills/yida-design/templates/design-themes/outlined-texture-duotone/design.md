---
name: "{{PROJECT_NAME}}"
description: "深炭内容面由暗外线与微亮内沿勾勒，卡片底栏和表头以灰阶带承接；品牌焦点与任务操作共用主题色来源、分别消费数据与操作角色，数据图形局部叠加细斜纹。"
themeId: outlined-texture-duotone
navTheme: dark
tokens:
  application-global:
    appearance: # 应用外观：应用背景、内容表面与完整导航设计
      surfaces: # 应用背景与内容表面
        "--pod-app-root-bg-color": "#141414" # neutral-gray；应用根背景及加载兜底
        "--pod-app-root-bg-image": "none" # 应用根背景图；支持 none、完整 url("...") 或 CSS 渐变，只作用于根节点
        "--pod-page-bg-color": "#141414" # neutral-gray；页面画布
        "--pod-card-bg-color": "#141414" # neutral-gray；卡片、表单与详情主面
        "--pod-table-cell-color": "var(--pod-card-bg-color)" # 表格正文单元格背景；跟随卡片背景
      navigation:
        "--pod-shell-theme-bg-color": "#141414"
        "--pod-nav-item-text-color": "#AAAAAA"
        "--pod-nav-item-text-hover-color": "#DDDDDD"
        "--pod-nav-item-text-selected-color": "#F2F2F2"
        "--pod-nav-menu-bg-hover-color": "#191919"
        "--pod-nav-menu-bg-selected-color": "#141414"
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
        "--pod-nav-logo-border-radius": "8px"
        "--pod-nav-sub-divider-color": "#353535"
        "--pod-nav-item-text-disabled-color": "rgba(255,255,255,.30)"
        "--pod-nav-l-container-bg": "var(--pod-shell-theme-bg-color)"
        "--pod-nav-l-group-label-color": "var(--pod-nav-item-text-color)"
        "--pod-nav-l-search-border-color": "#353535"
        "--pod-nav-popup-bg-color": "var(--pod-shell-theme-bg-color)"
        "--pod-nav-popup-border-radius": "8px"
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
        "--pod-nav-menu-item-radius": "12px"
        "--pod-nav-menu-item-border": "2px solid #535353"
        "--pod-nav-menu-item-hover-border": "2px solid #888888"
        "--pod-nav-menu-item-selected-border": "2px solid #BBBBBB"
        "--pod-nav-menu-font-size": "14px"
        "--pod-nav-menu-item-selected-font-weight": "500"
        "--pod-nav-menu-line-height": "20px"
        "--pod-nav-menu-gap": "8px"
        "--pod-shell-lshape-border-radius": "8px"
    colors: # 品牌色、内容区语义色与固定色；不随导航深浅切换
      "--color-white": "var(--pod-card-bg-color)" # 全应用基础表面，跟随内容明暗；不承担反色文字或固定亮面职责
      "--color-brand1-1": "<生成实际色值：--color-brand1-6 88% + #FFFFFF 12%，sRGB 逐通道混合>" # 品牌交互元素悬停
      "--color-brand1-2": "<生成实际色值：--color-brand1-6 12% + #FFFFFF 88%，sRGB 逐通道混合>" # 平台预留品牌浅色，保留平台既有消费关系
      "--color-brand1-3": "<生成实际色值：--color-brand1-6 4% + #FFFFFF 96%，sRGB 逐通道混合>" # 品牌派生浅色
      "--color-brand1-5": "<生成实际色值：--color-brand1-6 38% + #171717 62%，sRGB 逐通道混合>" # 品牌派生深色
      "--color-brand1-6": "{{PRIMARY_COLOR}}" # 唯一品牌种子；由项目输入与 {{COLOR_SOURCE}} 确定，不设固定兜底色
      "--color-brand1-9": "<生成实际色值：--color-brand1-6 76% + #000000 24%，sRGB 逐通道混合>" # 品牌交互元素激活或按下
      "--color-brand1-10": "<生成实际色值：--color-brand1-6 26% + #202020 74%，sRGB 逐通道混合>" # 品牌交互元素禁用
      "--color-line1-1": "#292929" # neutral-gray；内部分隔、表格行线与辅助网格
      "--color-line1-2": "#383838" # neutral-gray；控件与浮层常规边界
      "--color-fill1-1": "#141414" # neutral-gray；输入基础表面、中性悬停及弱填充；与画布同色但独立消费
      "--color-fill1-2": "#2A2A2A" # neutral-gray；中性按下及选中
      "--color-fill1-3": "#363636" # neutral-gray；较重中性填充及进度轨道
      "--color-fill1-5": "#2B2B2B" # neutral-gray；下拉、浮层、弹窗、抽屉与数据读数背景
      "--color-fill1-10": "#262626" # neutral-gray；固定深色 Tooltip 背景，不随品牌或明暗主题变化
      "--color-text1-5": "#FFFFFF" # neutral-gray；固定 Tooltip 反色文字，与 --color-fill1-10 配套
      "--color-text1-4": "#EEEEEE" # neutral-gray；一级文字、标题与核心数字
      "--color-text1-10": "#BEBEBE" # neutral-gray；表头与 placeholder
      "--color-text1-3": "#A6A6A6" # neutral-gray；说明、元信息与坐标
      "--color-text1-2": "#6B6B6B" # neutral-gray；仅禁用文字
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
      "--corner-zero": "0px" # 贴边与连续拼接
      "--corner-1": "4px" # 小标签与微型色块
      "--corner-2": "8px" # 输入、菜单项及常规矩形按钮
      "--corner-3": "10px" # 浮层、气泡与弹窗
      "--corner-4": "12px" # 面板内部独立图形容器
      "--corner-5": "16px" # 卡片、表单主容器与抽屉
      "--corner-circle": "50%" # 头像、状态点与图表焦点圆环
      "--corner-semicircle": "500px" # 仅需圆形或半圆端头的按钮
    shadow: # 全局阴影档位；具体对象是否使用阴影及使用哪一档，由正文明确
      "--shadow-1": "0px 2px 4px 0px rgba(0, 0, 0, 0.12)"
      "--shadow-2": "0px 4px 20px -1px rgba(0, 0, 0, 0.16)"
      "--shadow-3": "0px 10px 28px -2px rgba(0, 0, 0, 0.24)"
  custom-page:
    colors:
      "--oyd-page-bg": "var(--pod-page-bg-color)" # 页面单向桥接
      "--oyd-on-accent-light": "#FFFFFF" # neutral-gray；品牌说明区与品牌按钮的浅色前景，与基础表面职责分离
      "--oyd-bright-action-surface": "#FFFFFF" # neutral-gray；局部品牌说明区内的独立亮面按钮
      "--oyd-support-band-surface": "#222222" # neutral-gray；卡片底栏及表头的连续辅助底带
      "--oyd-edge-ink": "#080808" # neutral-gray；双层轮廓的暗外线
      "--oyd-edge-light": "rgba(255, 255, 255, 0.07)" # neutral-gray；双层轮廓的微亮内沿
      "--oyd-action-accent": "var(--color-brand1-6)" # 主题色任务操作背景；职责与数据焦点、平台状态分开
      "--oyd-action-hover": "var(--color-brand1-1)" # 任务操作悬停，跟随品牌派生
      "--oyd-action-active": "var(--color-brand1-9)" # 任务操作按下，跟随品牌派生
      "--oyd-on-accent-color": "#111111" # neutral-gray；明亮品牌面、操作按钮和白底按钮的独立深色前景
      "--oyd-chart-neutral": "#222222" # neutral-gray；普通柱形的低亮度非聚焦填充
      "--oyd-viz-tone-1": "var(--color-brand1-6)" # 数据焦点及同色系图形首色；明确随品牌种子派生
      "--oyd-viz-tone-2": "<生成实际色值：--color-brand1-6 60% + #141414 40%，sRGB 逐通道混合>" # 第二分类色阶，非 hover
      "--oyd-viz-tone-3": "<生成实际色值：--color-brand1-6 36% + #141414 64%，sRGB 逐通道混合>" # 第三分类色阶，非 active
      "--oyd-viz-tone-4": "<生成实际色值：--color-brand1-6 22% + #141414 78%，sRGB 逐通道混合>" # 第四分类色阶，非 disabled
      "--oyd-texture-ink": "rgba(0, 0, 0, 0.08)" # neutral-gray；图形内部细斜纹
    typography:
      "--oyd-font-size-metric": "32px" # 重点数值独立规格，推断
      "--oyd-font-weight-metric": 500
      "--oyd-font-lineheight-metric": 1.2
---

# {{PROJECT_NAME}} design.md

## 1. 风格摘要

**暗轮廓与纹理强调 · Outlined Texture Duotone**

同色的深炭画布与内容面，通过暗外线和微亮内沿形成清晰而低调的轮廓。卡片正文保持沉静，底部辅助信息以略亮的通栏灰面承接；少量实色操作按钮与品牌数据焦点共享主题色来源，并以位置、形状和职责分工。圆角适中、文字舒展，图形局部的细斜纹增加触感。

| 核心特征 | 可见表现 | 主要偏离风险 |
| --- | --- | --- |
| 深面双层轮廓 | 卡片、输入和选中导航以暗外框与细亮内沿从同色画布中显现 | 改用亮白描边、发光或强外投影，会失去沉稳的内嵌感 |
| 卡片内的通栏底带 | 正文下方略亮的底带将元信息与已有动作收束在同一容器内 | 拆成独立悬浮卡或让每张卡都出现空底栏，会破坏结构 |
| 操作与数据分工 | 操作与数据均由主题色派生，各自通过专用角色消费，灰色区域保持中性 | 将数据角色当作交互状态，或把主题色变化联动到平台状态，会混淆职责 |
| 图形中的微纹理 | 比例分段与关注柱内部出现低强度斜纹，其他表面平整 | 全屏纹理、浓重条纹或把纹理当作额外数值编码，会干扰阅读 |

双层轮廓、灰阶底带、排版和操作色可在表单、详情与列表中成立。比例带、聚焦柱形与大面积品牌说明块均按真实内容启用，不规定页面必须拥有指标、图表、推广或固定列数。

## 2. 页面视觉系统

YAML 是数值事实源，正文定义消费关系。未能直接确定的尺寸、微纹理与状态外观属于实施推断；不将图像导出尺寸当作实际 CSS 尺寸。

### 2.1 表面、区块与层次

| 对象 | 背景与前景 | 边界、形状与阴影 |
| --- | --- | --- |
| 应用根背景 | `--pod-app-root-bg-color`，背景图 `--pod-app-root-bg-image` 仅限根节点 | 应用填满实际承载范围，不额外增加展示用外衬或设备边框 |
| 页面画布 | `--pod-page-bg-color`；自定义页单向桥接 `--oyd-page-bg` | 贴边区域用 `--corner-zero`，以分区和留白承载内容 |
| 卡片、表单主容器、详情面板 | `--pod-card-bg-color`；主文案 `--color-text1-4`，说明 `--color-text1-3` | `--corner-5`，双层轮廓；普通容器无外投影 |
| 图表绘图区 | 沿用所在卡片表面；坐标、类别与单位使用 `--color-text1-3`，关键读数使用 `--color-text1-4` | 直接铺在卡片内，不增加更黑的内嵌底盒或另一组完整轮廓 |
| 卡片底栏与表格表头 | `--oyd-support-band-surface`；主操作文字 `--color-text1-4`、说明 `--color-text1-3`、表头 `--color-text1-10` | 与所在容器共边；底栏只保留底部外露圆角，内部拼接处不另画整框 |
| 表格正文 | `--pod-table-cell-color` 单向跟随卡片；文字按正文和说明分工 | `--color-line1-1` 水平行分隔，单元格连续拼接，不各自圆角 |
| 内部分段与弱辅助面 | 优先沿用所在表面，必要弱填充用 `--color-fill1-1` | 使用留白、标题或 `--color-line1-1` 分隔，不逐组增加厚框 |
| 下拉、气泡、弹出日历、弹窗及导航弹出层 | `--color-fill1-5`；主文案 `--color-text1-4`，说明 `--color-text1-3` | `--corner-3` 与 `--color-line1-2`；小浮层 `--shadow-1`，弹窗 `--shadow-2` |
| 抽屉 | `--color-fill1-5` 与配套内容文字 | 外露角 `--corner-5`，贴边角归零；`--color-line1-2`、`--shadow-2` |
| 图表读数浮层 | `--color-fill1-5`；读数 `--color-text1-4`、时间／单位 `--color-text1-3` | `--corner-3`，`--color-line1-2`，必要时 `--shadow-1` |
| 简短 Tooltip | 固定 `--color-fill1-10` 与 `--color-text1-5` 配对 | `--corner-3`；与图表读数卡分开定义 |

页面、卡片正文与图表绘图区保持同色，不靠抬亮整张卡片区分层次；更亮的灰面集中在底栏与表头。双层轮廓由 `--oyd-edge-ink` 暗外线与 `--oyd-edge-light` 微亮内沿组成，每层建议 1 CSS px（推断）。暗线强调结构，内沿帮助同色表面分离；只绘制一组轮廓，不在嵌套字段上重复叠加。普通分隔仍用 Line 变量，不能将一条行线变成双框。

底栏必须有实际辅助信息或操作，无内容时自然移除。输入表面不能借用底栏或覆盖层；背景图不传递给任何卡片或控件。全局 `--shadow-3` 保留为平台档位，本主题默认不使用；不要用投影替换细轮廓。

### 2.2 应用导航

深炭导航延续暗轮廓内容面，以微亮边界、圆角菜单和明亮选中文字建立清楚层次。

菜单轮廓使用 --pod-nav-menu-item-radius、--pod-nav-menu-item-border、--pod-nav-menu-item-hover-border、--pod-nav-menu-item-selected-border。侧栏和顶部菜单共用轮廓，各状态保持相同边框宽度，文字位置稳定；具体数值以本项目 Token 为准。

导航与应用框架、表单、自定义页面和详情页共用设计语言。先按业务入口安排菜单、分组、搜索、品牌区与常用操作，再一起确定导航与正文的明暗、表面、字体、边界、圆角和密度。平台导航使用真实页面菜单；自绘导航按同一套导航 Token 实现。命名模板沿用自身 navTheme，换主色保持导航明暗与内容画布；需要另一导航明暗时改选主题，自由创意按项目明确设计。

导航底色使用 --pod-shell-theme-bg-color；普通、悬停和选中文字分别使用 --pod-nav-item-text-color、--pod-nav-item-text-hover-color、--pod-nav-item-text-selected-color；悬停和选中背景使用 --pod-nav-menu-bg-hover-color、--pod-nav-menu-bg-selected-color。图标跟随对应文字状态，当前入口同时用背景或字重表达。

菜单高度、圆角与间距使用 --pod-nav-menu-item-height、--pod-nav-menu-item-radius、--pod-nav-menu-gap；搜索、品牌区、分组、操作和弹出菜单使用 navigation 分组中的对应 Token。弹出菜单的底色、文字与搜索状态成组配套，导航与内容可以分别选择明暗。选中项使用 --pod-nav-menu-item-selected-shadow：none 关闭额外标记，完整 box-shadow 值可表达左、右或底部内阴影，不占据菜单布局空间；该 Token 独立于导航明暗。菜单高度、文字行高、内距和框架留白一起调整，给外阴影、长标题与键盘焦点留出空间。

桌面检查菜单、搜索、选中态与表单的协调；折叠后保留可识别图标和入口名称；窄屏保持菜单可展开、当前页面可定位、键盘焦点可见。提交、编辑、详情与自定义页都沿用这一导航设计。

### 2.3 页面标题与操作

页头沿用页面画布，底部以弱分界线与主体区隔。页面标题使用 subhead 规格，搜索若存在则与标题组成紧凑起始区，间隔 `--s-6`；尾部聚合真实的主要动作、辅助图标和用户信息，组内间距 `--s-3`。图稿中较大的物理字形不作为放大全局字号的依据。

主要任务按钮使用品牌关联操作色；次级图标按钮采用中性表面与小圆角轮廓。没有检索、用户信息或通知能力时不展示对应空壳。空间不足时操作区换行，维持标题及其相关控件的阅读顺序，不压缩正常字号。

内容面板的标题行采用图标、文字与已有尾部操作，标题文字以 `--color-text1-3` 保持低于核心读数的灰阶，线性图标可使用主前景。图标只提供内容识别，不为每个标题加彩色底盒。标题与主体以 `--s-4` 留白或一条弱线组织；底栏属于面板内部，不能冒充另一层导航。

### 2.4 排版、间距与形状

全局使用 `--font-family-base`，中文回退到可用系统无衬线字体。数字使用等宽数字特性，金额、比例和数量保持一致精度及单位策略；不把普通标签改为等宽代码字体。

| 角色 | 字号 / 字重 / 行高 | 前景 |
| --- | --- | --- |
| 页面标题 | `--font-size-subhead` / `--font-weight-subhead` / `--font-lineheight-subhead` | `--color-text1-4` |
| 面板标题 | `--font-size-body-2` / `--font-weight-body-2` / `--font-lineheight-body-2` | `--color-text1-3` |
| 重要实体名称 | `--font-size-body-2` / `--font-weight-body-2` / `--font-lineheight-body-2` | `--color-text1-4` |
| 正文、标签、按钮文案 | `--font-size-body-1` / `--font-weight-body-1` / `--font-lineheight-body-1` | 正常内容 `--color-text1-4`，辅助内容 `--color-text1-3` |
| 表格文本 | `--font-size-table` / `--font-weight-table` / `--font-lineheight-table` | 表头 `--color-text1-10`，正文 `--color-text1-4` |
| 元信息、单位、坐标与说明 | `--font-size-caption` / `--font-weight-caption` / `--font-lineheight-caption` | `--color-text1-3`，不使用禁用灰 |
| 独立重点数值 | `--oyd-font-size-metric` / `--oyd-font-weight-metric` / `--oyd-font-lineheight-metric` | `--color-text1-4` |

页面边距使用 `--s-5` 至 `--s-6`，模块间距 `--s-4`，独立区段间距 `--s-6`。卡片正文内边距 `--s-4` 至 `--s-5`，底栏横向继承正文边距、纵向用 `--s-3`。标题与主要数值间隔 `--s-4`，同一实体的两行信息间隔 `--s-1`。

容器用 `--corner-5`，独立图形区域用 `--corner-4`，浮层用 `--corner-3`，输入、菜单和矩形按钮用 `--corner-2`，小标签用 `--corner-1`。头像与图表焦点圆环使用 `--corner-circle`，`--corner-semicircle` 仅用于需要圆形或半圆端头的按钮。卡片底栏沿同一外壳圆角收口。

密度通过间距、列宽和内容优先级调整，不缩小固定字号。具体列数、比例、等高对象和窄屏顺序由第五部分确定，不要求所有卡片锁高或内部独立滚动。

### 2.5 色彩、图标与点缀

品牌主色负责品牌标识和被明确关注的数据／内容区域。`--oyd-viz-tone-1` 到 `--oyd-viz-tone-4` 是单独的数据色阶角色，明确由品牌种子与固定暗底派生；不借用品牌 hover、active 或 disabled 来画图。明度差用作稳定分类区分，不默认编码大小、好坏或优先级。

`--oyd-action-accent` 专门表达主要任务操作，悬停和按下分别使用 `--oyd-action-hover`、`--oyd-action-active`，各状态沿用深色前景 `--oyd-on-accent-color`。这组颜色引用品牌主色及交互派生档位，品牌换色时同步更新；职责与平台成功状态保持分离。原生控件使用平台可配置的品牌按钮能力，不为单个按钮另设固定色。

成功、错误、警告和信息使用平台已有状态语义，未知平台变量名时只描述语义，不编造接口。涨跌颜色由业务好坏决定，正数不自动等于成功。中性灰保持 `neutral-gray`，不随品牌染色。

图标使用统一细线家族，建议 18–20 CSS px、线宽 1.5–2 CSS px（推断），跟随文字颜色。头像依赖真实素材；无素材时使用姓名首字或现有实体标识。品牌标识不从示例产品复制。

仅真实数据段和焦点柱内部可叠加 `--oyd-texture-ink`：建议 135° 斜向、线宽 1 CSS px、周期 4 CSS px（推断），裁切于图形轮廓内。纹理不改变柱高、面积或比例，不代表额外数据类别；它不能铺到页面、表格、导航或输入上。大面积表面保持平整，不添加雾化背景或霓虹光晕。

普通柱形使用 `--oyd-chart-neutral`，保留低亮度实面，不额外套亮灰描边；关注柱通过主题色、纹理与读数形成焦点。类别名称与坐标使用说明色，比例和核心数值使用主前景，不能只凭暗色差判断数值。

## 3. 基础组件表达

本节说明组件存在时的表达，不构成必须搭建的功能清单。未列出的组件按任务、表面、文字、形状和状态推导。

### 面板、数值与底栏

面板继承 2.1 的暗面与双层轮廓，标题区、正文和底栏在同一外壳内连续排列。底栏左侧承载补充口径，右侧承载实际详情或后续动作；采用 `--oyd-support-band-surface`，不重复添加独立圆框与阴影。仅有一类内容时自然对齐，无底部内容时省略。

数值单元以说明色名称、明亮主值、真实变化量建立层级；变化量可与主值分居同一行两端，保留符号或方向图标，补充基期写在底栏或说明区。主值不能因为字号较大就省略必要单位；无对比数据时不显示虚构增长率。跳转箭头只出现在真实可用的动作上。

### 按钮、输入与表单

| 组件 | 表达与角色 |
| --- | --- |
| 主要任务按钮 | 自绘背景 `--oyd-action-accent`，前景固定使用 `--oyd-on-accent-color`，圆角 `--corner-2`；用明确动作名称说明用途，可保留一层细轮廓 |
| 中性按钮 | 默认弱填充 `--color-fill1-1` 或透明底，前景 `--color-text1-4`；需要较重底面时使用 `--color-fill1-3`，轮廓与输入保持一致 |
| 品牌色按钮 | 使用 `--color-brand1-6`，与主要任务操作共享色源并保持职责清楚；前景使用 `--oyd-on-accent-light`，沿用品牌行动区的浅字配对 |
| 图标按钮 | 等宽高的小圆角轮廓，沿用中性控件；图标大小与同组视觉重量一致，不为每项加彩色底盒 |
| 输入、搜索与筛选 | 基础表面 `--color-fill1-1`，前景 `--color-text1-4`，placeholder `--color-text1-10`，圆角 `--corner-2`；常规边界 `--color-line1-2`，自绘时可采用双层轮廓 |
| 多行输入 | 使用输入角色并容纳内容增长，附属工具与正文以 `--s-3` 区分 |

按钮高度在 `--s-7` 至 `--s-10` 中选择，常规为 `--s-9`，紧凑辅助操作为 `--s-8`；输入和筛选使用 `--s-8` 至 `--s-10`，常规为 `--s-9`。搜索保持矩形圆角，不扩大成胶囊。输入不能因为颜色接近而引用卡片、底栏或 pop-up 背景。

表单标签在对应输入上方，间距 `--s-2`；字段间距 `--s-4`，独立分组间距 `--s-6`。错误信息贴近字段并使用平台错误语义，必要说明使用正常说明色；禁用灰不用于阅读中仍需理解的帮助文本。

### 表格、列表与标签

表格使用 `--oyd-support-band-surface` 表头与 `--pod-table-cell-color` 正文，表头文字 `--color-text1-10`。仅保留 `--color-line1-1` 水平行分隔；默认不绘制纵向栅格，也不将每行做成独立卡片。外壳统一圆角，内部保持连续比较结构。

行内上下留白 `--s-3`，左右 `--s-4`。名称、描述与日期左对齐，数量和金额右对齐；行尾已有操作保持同一锚点。真实人员或实体可用头像／标识加两行文字：主名使用正文前景，附属地址或联系信息使用说明前景。单行字段不人为凑成两行。

状态标签使用小圆角、平台状态前景与低强度衍生填充，不以整行染色代替。状态填充可由状态色和承载面按 14:86 混合（推断），标签文字须单独配对，不把整个标签统一降低透明度。独立类别标签用明确的分类映射，不借用成功或错误名称作装饰。

独立记录列表沿用横向分隔和稳定对齐；自然增长的说明可以换行。筛选、更多和查看全部只在真实功能存在时出现；没有可操作内容的行不表现为按钮。

### 图形、进度与数据说明

图例、图形和读数共用同一套数据与色彩映射；坐标轴与浮层单位一致，周期、基期与筛选范围明确。横轴标签从实际数据生成，不照抄重复年份或示例刻度；合法重复标签需通过完整时间或子分组消除歧义。

普通柱与关注柱使用同一量尺。缺失值不能当作零，无统计口径时不伪造数值；读数及可读明细来自同一份数据。主题不要求始终显示金额、百分比或某个年份。

基础进度的未完成轨道使用 `--color-fill1-3`，完成部分按真实语义使用品牌或平台状态色；必须有当前量与有效目标。比例带与普通任务进度分开定义，组成项不是完成百分比。

### 状态与反馈

以下交互外观为实施推断，沿用轻微明暗变化，不通过位移或持续闪动吸引注意。

| 状态 | 视觉表达 |
| --- | --- |
| Hover | 中性透明对象使用 `--color-fill1-1`；已有填充对象加强文字或边界。任务按钮用 `--oyd-action-hover`，品牌按钮用 `--color-brand1-1` |
| Active | 中性控件使用 `--color-fill1-2`，任务按钮用 `--oyd-action-active`，品牌按钮用 `--color-brand1-9`；布局不改变 |
| Focus | 采用清楚的焦点轮廓，任务按钮优先以 `--oyd-action-accent` 外圈配中性间隔，其他控件可用品牌色；建议线宽与偏移各 2 CSS px（推断），不只加亮内沿 |
| Selected | 中性选中用 `--color-fill1-2` 配文字／勾选；导航使用专属六项色，图形聚焦使用明确的数据焦点色和定位标记 |
| Disabled | 文字 `--color-text1-2`，控件用中性禁用表达；品牌控件用平台品牌禁用角色。任务按钮回到中性 Fill，不继续使用明亮操作色 |
| Error / Warning / Success / Info | 使用平台状态前景、边界、图标及明确文字；与任务操作色保持独立 |
| Loading / Empty | 中性占位或明确空状态，不补入随机柱形、默认增长或虚构人员记录 |

浮层中的输入与菜单仍分别消费基础、悬停和选中角色。微过渡建议 120–180 ms（推断）；普通卡片无悬浮放大，纹理保持静止，不采用扫描动画。

### 表单组件与版式结构

表单使用与自定义页面相同的应用全局样式，字体、色彩、表面、边界、圆角、密度和状态延续本主题。表单支持在顶部、左侧、主体、右侧和字段之间组合 Tab/切换、按钮组/操作入口、图片/图形、状态区、标题与 `Divider`、`ColumnContainer`、辅助内容和业务字段。各组件承担导航、操作、视觉焦点、反馈、层级、节奏、装饰或采集作用。普通业务分组和章节分隔使用 `Divider`，横向字段组合使用 `ColumnContainer`。每张表单在项目 `design.md` 写清组件位置与作用、列比例、标签位置、字段与章节间距、底栏、详情延续和窄屏重排。

## 4. 特色表达配方

### R1 细斜纹组成比例带

**适用内容：** 存在互不重叠、可加总的组成项及明确总量；需用部分与整体的关系解释真实数据。

**继承基础：** 使用第三部分数据规则、2.5 的品牌派生色阶和纹理；承载面与底栏沿用基础面板。

**特殊组合：** 上方为横向分段带，下方以色块、分类名称和右对齐比例形成清单。分段使用固定分类顺序和稳定色阶，斜纹只存在于各段内部；比例带两端及段角可用 `--corner-1`，不将每段胶囊化。若可绘制宽度为 W、段数为 n、间距为 g，先取有效宽度 U = W − (n − 1) × g，再按每项真实占比 p 分配 U × p；像素取整采用最大余数法，使分段总宽等于 U。段间距建议 `--s-2`（推断），空间不足时减小或去掉间距，不能挤出人为最小段宽夸大微小项。

色阶明度只区分类别，不再次编码数值。基线提供四个色阶并不要求恰好四类；类别更多或色差不足时，项目确定可辨识的扩展映射或使用直接标注清单，不循环套色造成歧义。四类以外的语义不得通过新增虚构状态凑齐。占比舍入规则、总量及口径在实际页面确定。

**无匹配时：** 不可加总、分母未知或类别重叠时改为普通清单；总量为零时显示空状态。极小项不可见时通过清单给出精确值，不删去该项。缺失组成数据时标明不完整，不强行归一化成完整的百分之百。

### R2 单一关注柱与顶端读数

**适用内容：** 有真实有序或时间数据，并有一个明确的当前关注项；关注来自用户选择或项目已定义的业务默认，不随意挑选，也不默认为最大值。

**继承基础：** 使用第三部分图形数据规则，2.5 的普通柱与焦点色，2.1 的数据读数浮层。

**特殊组合：** 大多数柱以 `--oyd-chart-neutral` 沉入暗面，关注柱使用 `--oyd-viz-tone-1` 和细斜纹；柱形直接位于卡片表面，不再增加内层容器。所有柱顶按同一真实数值映射定位。关注柱顶部增加圆环与相邻读数卡，圆环和浮层是附加标记，不计入柱高。柱顶使用小圆角，零值不画伪高度；网格以稀疏弱虚线作为参照，底线和单位明确。

关注变化时，颜色、圆环、读数与关联说明同步切换；不能只移动色块而保留旧值。只有一个明确焦点时采用单柱强调，多选或多序列比较回到常规图形表达。

**无匹配时：** 没有当前关注项就使用普通柱形或表格，不硬设主题色关注柱；柱宽不足以容纳纹理时取消纹理。含负值时明确零线和负向柱，无序类别不伪装为年份序列。暗柱无法承载清楚比较时补充直接标签或可读明细，不把普通柱统一改成亮边焦点。

### R3 品牌强调说明区

**适用内容：** 需求中已有需要突出的一段说明、服务介绍或辅助行动，且确有对应的可执行入口。

**继承基础：** 使用基础面板轮廓、正文层级和按钮规则，不改变其他区域的主操作语义。

**特殊组合：** 单个局部区域使用 `--color-brand1-6` 实色底和较明确的内沿，配简短标题、说明与一个已有动作。前景固定使用 `--oyd-on-accent-light`，保留设计稿的实色底与浅字关系。按钮可采用 `--oyd-bright-action-surface` 底与 `--oyd-on-accent-color` 前景，圆角 `--corner-2`，与外围色面拉开层次。品牌图形只使用用户已有素材，普通面板不复制这块高饱和底色。

**无匹配时：** 没有真实说明与动作就不出现该区域；只有说明时回到普通文本面板。位置服从实际页面布局，不固定在导航底部，不新增付费、升级、AI 分析或任何未经需求定义的能力。

## 5. 项目应用与调整规则

### 变量与项目换色

YAML 为所有已声明变量的唯一数值来源；全局变量面向原生及自定义页，本模板的扩展包含通栏底带、双层轮廓、品牌关联任务操作角色、数据纹理及重点数值规格。递归提取以 `--` 开头的标量叶子，分组名不拼入变量名；不重复定义已有变量，平台基础与项目扩展均在主题中声明，可无环引用，并按实际设计补充变量。

需求决定内容与操作，平台约束决定可用能力，主题决定视觉机制。原生导航只消费开放六色，项目已确定自绘时才应用补充尺寸。条件配方不覆盖实际数据、内容增长或平台限制。

- 色彩来源：{{COLOR_SOURCE}}。
- 品牌种子为 `{{PRIMARY_COLOR}}`，由项目输入及色彩来源确定，不设固定兜底色；用户给定种子不静默替换。
- 所有派生公式以 YAML 为准。将种子与基底解析成 8 位 sRGB，逐通道计算 round(a × seed + b × base)，a + b = 1，限制在 0–255 后写为六位十六进制；直接混合编码后的 sRGB，不做线性光转换。项目文档中替换所有生成标记。
- 七个 Brand Token 保留各自职责；数据色阶明确随品牌派生，但继续通过数据专用角色消费。任务操作通过 `--oyd-action-accent` 关联品牌种子，hover 与 active 分别引用品牌交互档位；品牌换色同步更新操作与数据角色，不改变平台成功语义。
- 内容中性色、纹理与轮廓保持固定灰阶。导航六项独立成组确定，导航变化不改内容 Text、Fill、卡片或 pop-up。若项目明确改变内容明暗，需要重新配对全部内容表面与前景；浅色内容下普通 pop-up 为白色，不能只翻转画布。
- 换色沿用设计稿确定的配对：任务操作按钮使用深字，品牌说明区使用浅字，其中白底按钮使用深字；各状态不动态切换黑白前景，也不额外改动背景和文字明度。

局部推断的纹理密度、轮廓线宽和状态动效可以按平台能力微调，保留暗面、通栏底带、双层轮廓与操作、数据强调的职责分工。全局字体和间距档位保持不变；不把截图数据、人物、产品名或外部展示边框写入项目。

### 项目页面设计

仅为实际页面形成以下确定结果，不因模板配方新增页面或功能：

- **页面内容：** 页面名称、主要任务、真实内容与可用操作。
- **首屏印象：** 第一焦点、内容主次，以及由暗面轮廓、灰阶底带、字号、留白和局部强调色形成焦点的具体安排。
- **布局安排：** 各区块位置、宽度、列数、高度、对齐与必要等高对象；明确窄屏后的顺序与重排，不默认三张数值卡或固定主次栏比例。
- **视觉表达：** 各区块采用的表面、组件和文字角色；使用配方时注明编号、位置和数据／能力条件。
- **标志性时刻：** 一处明确静态画面或关键反馈，说明位置或触发条件、具体表现及其任务价值。

首屏焦点和标志性时刻可以来自同一处。素材来源、缺口处理和平台限制直接写在对应页面；最终方案给出确定选择，不留下未完成决定。

{{PAGE_APPLICATIONS}}

### 页面设计验收

只验证该页实际使用的内容；未渲染的页面保留为待执行要求。

- [ ] **首屏印象：** 焦点与主次符合方案，品牌数据焦点、任务操作及状态含义保持清楚。
- [ ] **布局安排：** 分区、比例、列数、高度、对齐和窄屏顺序符合方案，底栏共边且内容自然增长。
- [ ] **风格表达：** 暗面双层轮廓、灰阶底带与文字层级成立；纹理仅限指定图形，比例、刻度、单位与读数一致且可辨。
- [ ] **标志性时刻：** 指定画面或反馈在对应位置或条件出现，帮助理解信息或完成操作，不由虚构数据或不可用功能支撑。
