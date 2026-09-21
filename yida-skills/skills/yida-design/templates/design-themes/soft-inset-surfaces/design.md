---
name: "{{PROJECT_NAME}}"
description: "以主题色轻染的浅灰外衬、近白画布和柔圆白面板构成低对比分层；导航以独立配色标记选中，细线图标、浅色圆形标记与局部主题色强调组织阅读，浮层以独立白面和克制投影浮起。"
themeId: soft-inset-surfaces
navTheme: light
tokens:
  application-global:
    appearance:
      surfaces:
        "--pod-app-root-bg-color": "var(--color-brand1-3)" # 主题色轻染的浅灰外衬，随唯一主色重算
        "--pod-app-root-bg-image": "none"
        "--pod-page-bg-color": "#FAFAFA" # neutral-gray；近白内容画布
        "--pod-card-bg-color": "#FFFFFF" # neutral-gray；白色内容面板
        "--pod-table-cell-color": "var(--pod-card-bg-color)"
      navigation:
        "--pod-shell-theme-bg-color": "#F7F7F7"
        "--pod-nav-item-text-color": "#666666"
        "--pod-nav-item-text-hover-color": "#414141"
        "--pod-nav-item-text-selected-color": "#303030"
        "--pod-nav-menu-bg-hover-color": "#F2F2F2"
        "--pod-nav-menu-bg-selected-color": "#EEEEEE"
        "--pod-nav-menu-item-selected-shadow": "none"
        "--pod-page-header-bg-color": "var(--pod-shell-theme-bg-color)"
        "--pod-nav-l-sub-main-bg-color": "var(--pod-shell-theme-bg-color)"
        "--pod-nav-top-main-border-width": "1px"
        "--pod-nav-top-main-border-color": "#DEDEDE"
        "--pod-nav-top-tab-indicator-width": "0px"
        "--pod-nav-logo-text": "var(--pod-nav-item-text-hover-color)"
        "--pod-nav-logo-bg": "var(--pod-nav-menu-bg-selected-color)"
        "--pod-nav-logo-icon": "var(--pod-nav-item-text-selected-color)"
        "--pod-nav-logo-border": "1px solid #DEDEDE"
        "--pod-nav-logo-border-radius": "8px"
        "--pod-nav-sub-divider-color": "#DEDEDE"
        "--pod-nav-item-text-disabled-color": "rgba(24,28,31,.30)"
        "--pod-nav-l-container-bg": "var(--pod-shell-theme-bg-color)"
        "--pod-nav-l-group-label-color": "var(--pod-nav-item-text-color)"
        "--pod-nav-l-search-border-color": "#DEDEDE"
        "--pod-nav-popup-bg-color": "var(--pod-shell-theme-bg-color)"
        "--pod-nav-popup-border-radius": "8px"
        "--pod-nav-popup-shadow": "0 8px 24px rgba(24,28,31,.10)"
        "--pod-nav-tab-line-hover-color": "var(--pod-nav-item-text-hover-color)"
        "--pod-nav-tab-line-selected-color": "var(--pod-nav-item-text-hover-color)"
        "--pod-nav-search-bg-color": "var(--pod-nav-menu-bg-hover-color)"
        "--pod-nav-search-bg-hover-color": "var(--pod-nav-menu-bg-hover-color)"
        "--pod-nav-search-bg-active-color": "var(--pod-nav-menu-bg-hover-color)"
        "--pod-nav-search-placeholder-color": "var(--pod-nav-item-text-color)"
        "--pod-nav-search-text-color": "var(--pod-nav-item-text-hover-color)"
        "--pod-nav-search-icon-color": "var(--pod-nav-item-text-color)"
        "--pod-nav-search-border-color": "#DEDEDE"
        "--pod-nav-search-border-hover-color": "var(--pod-nav-item-text-hover-color)"
        "--pod-nav-search-border-active-color": "var(--pod-nav-item-text-hover-color)"
        "--pod-nav-action-icon-color": "var(--pod-nav-item-text-color)"
        "--pod-nav-action-border-color": "#DEDEDE"
        "--pod-nav-action-border": "1px solid #DEDEDE"
        "--pod-nav-action-bg-hover-color": "var(--pod-nav-menu-bg-hover-color)"
        "--pod-nav-action-bg-active-color": "var(--pod-nav-menu-bg-hover-color)"
        "--pod-nav-menu-item-height": "42px"
        "--pod-nav-menu-item-radius": "12px"
        "--pod-nav-menu-item-border": "none"
        "--pod-nav-menu-item-hover-border": "none"
        "--pod-nav-menu-item-selected-border": "none"
        "--pod-nav-menu-font-size": "14px"
        "--pod-nav-menu-item-selected-font-weight": "500"
        "--pod-nav-menu-line-height": "20px"
        "--pod-nav-menu-gap": "8px"
        "--pod-shell-lshape-border-radius": "8px"
    colors:
      "--color-white": "var(--pod-card-bg-color)" # 全应用基础表面，跟随内容明暗；不作为固定白字变量
      "--color-brand1-1": "<生成实际色值：--color-brand1-6 88% + #FFFFFF 12%，sRGB 逐通道混合>" # 品牌交互悬停
      "--color-brand1-2": "<生成实际色值：--color-brand1-6 12% + #FFFFFF 88%，sRGB 逐通道混合>" # 平台预留品牌浅色
      "--color-brand1-3": "<生成实际色值：--color-brand1-6 3% + #EAEAEA 97%，sRGB 逐通道混合>" # 品牌派生浅色；低比例染色保留浅灰层次
      "--color-brand1-5": "<生成实际色值：--color-brand1-6 38% + #171717 62%，sRGB 逐通道混合>" # 品牌派生深色
      "--color-brand1-6": "{{PRIMARY_COLOR}}" # 唯一主题色种子；由项目输入确定，不回填截图固定色
      "--color-brand1-9": "<生成实际色值：--color-brand1-6 76% + #000000 24%，sRGB 逐通道混合>" # 品牌交互按下
      "--color-brand1-10": "<生成实际色值：--color-brand1-6 26% + #FFFFFF 74%，sRGB 逐通道混合>" # 品牌交互禁用
      "--color-line1-1": "#F1F1F1" # neutral-gray；行分隔与图形辅助线
      "--color-line1-2": "#E8E8E8" # neutral-gray；控件及导航分界
      "--color-fill1-1": "#FAFAFA" # neutral-gray；输入基础表面、中性悬停与弱填充
      "--color-fill1-2": "#EEEEEE" # neutral-gray；中性按下及选中
      "--color-fill1-3": "#E3E3E3" # neutral-gray；较重填充、进度轨道
      "--color-fill1-5": "#FFFFFF" # neutral-gray；独立 pop-up 表面
      "--color-fill1-10": "#262626" # neutral-gray；固定短 Tooltip 背景
      "--color-text1-5": "#FFFFFF" # neutral-gray；固定短 Tooltip 前景
      "--color-text1-4": "#303030" # neutral-gray；标题、正文重点与核心数字
      "--color-text1-10": "#606060" # neutral-gray；表头与输入占位文字
      "--color-text1-3": "#767676" # neutral-gray；辅助说明与坐标标签
      "--color-text1-2": "#ADADAD" # neutral-gray；禁用文字
      "--color-text1-1": "#D6D6D6" # neutral-gray；水印
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
      "--corner-zero": 0px # 拼接面与普通表格正文
      "--corner-1": 4px # 小缩略图、键位提示与图形末端
      "--corner-2": 8px # 输入、菜单项与常规按钮
      "--corner-3": 12px # 浮层与独立记录行
      "--corner-4": 16px # 内嵌辅助区块
      "--corner-5": 20px # 一级面板、应用外轮廓与抽屉
      "--corner-circle": 50% # 等宽高头像、图例圆点、圆形图标底盒
      "--corner-semicircle": 500px # 短状态标签及确需胶囊形的控件
    shadow:
      "--shadow-1": "0px 2px 4px 0px rgba(0, 0, 0, 0.12)"
      "--shadow-2": "0px 4px 20px -1px rgba(0, 0, 0, 0.16)"
      "--shadow-3": "0px 10px 28px -2px rgba(0, 0, 0, 0.24)"
  custom-page:
    colors:
      "--oyd-page-bg": "var(--pod-page-bg-color)"
      "--oyd-strong-action-bg": "#303030" # neutral-gray；深色实心主操作，独立于文字角色
      "--oyd-strong-action-fg": "#FFFFFF" # neutral-gray；深色实心操作前景
      "--oyd-chart-series-primary": "var(--color-brand1-6)" # 主数据序列基色；不消费品牌按下色
      "--oyd-chart-series-secondary": "<生成实际色值：--color-brand1-6 14% + #FFFFFF 86%，sRGB 逐通道混合>" # 次数据序列；独立数据语义
      "--oyd-category-primary": "<生成实际色值：--color-brand1-6 75% + #A0A0A0 25%，sRGB 逐通道混合>" # 主题同源分类色，分类职责独立但随主色重算，不表示状态
      "--oyd-category-gold": "#FFCB5B" # 独立分类色，不表示警告
      "--oyd-category-orchid": "#DC76CF" # 独立分类色，不表示错误
    typography:
      "--oyd-font-size-metric": "22px" # 核心数字；产品尺度推断
      "--oyd-font-weight-metric": 500
      "--oyd-font-lineheight-metric": 1.3
    shadow:
      "--oyd-shadow-resting": "0px 1px 2px 0px rgba(0, 0, 0, 0.03)" # 静置面板与轻控件的局部弱阴影，推断
---

# {{PROJECT_NAME}} design.md

## 1. 风格摘要

**柔灰嵌白 · soft-inset-surfaces**

浅灰应用外衬包围柔圆的内容区域，导航与近白画布独立配色，白面板以留白、极淡边界和轻微底影分层。界面保持中等信息密度：标题短而清晰，主要数值用深灰突出，辅助文字退后；色彩集中于小图标底盒、短标签和数据图形。普通操作保留圆角矩形，圆形与胶囊只用于有相应用途的小元素。

| 核心特征 | 可见表现 | 主要偏离风险 |
| --- | --- | --- |
| 浅色表面的细微层差 | 外衬、画布和白面板依次分离，面板看起来嵌在宽松的浅色底面中 | 所有底面同白会丢失分区；整页加深投影会使面板过度浮起 |
| 独立的中性导航 | 普通菜单与选中项使用专用导航色；自定义导航按形态选择协调的中性标记，品牌色只在少量识别元素出现 | 把选中菜单铺成高饱和品牌色，或把内容区一并染成导航色 |
| 容器柔圆、内部克制 | 大面板圆角明显，输入和按钮圆角较小，表格保持连续行 | 所有按钮胶囊化，或每个表格单元格都卡片化 |
| 深灰文字与轻量线图标 | 数字、标题和正文构成稳定主次，线图标通常无底盒，需要聚焦时才加浅色圆底 | 全部文字加粗、满屏彩色图标，或通过缩小字号提高密度 |
| 局部彩色焦点 | 数据图形或短标签承担彩色强调；出现图表读数时，以白浮卡和局部轮廓聚焦 | 大面积渐变背景、发光面板或无业务含义的装饰图形 |

页面需求决定结构、模块数量与操作。没有指标、图表或事件记录的页面，也应通过浅色层差、柔圆面板、中性导航和克制控件体现主题。精确色值、局部尺寸和阴影参数为视觉推断；字体采用统一产品基线，不推定素材中字体的准确名称。未展示交互状态也按主题推断，不把图片物理像素直接作为 CSS 尺寸。

## 2. 页面视觉系统

### 2.1 表面、区块与层次

层次优先由浅色差和留白建立，分隔线只在需要确定边界时出现。常规面板不使用宽而深的投影；覆盖层在同样的白底上通过投影明确遮挡关系。

| 对象 | 背景变量 | 边界与阴影 | 前景语义 |
| --- | --- | --- | --- |
| 应用根背景 | `--pod-app-root-bg-color`、`--pod-app-root-bg-image` | 主题色轻染的浅灰外衬；真实应用是否露出外衬由宿主空间决定，不固定复制展示边框 | 若有内容，仍使用可读深色文字 |
| 页面画布 | `--pod-page-bg-color`；自定义页用桥接 `--oyd-page-bg` | 近白底，不叠加纹理或整页投影 | 正文 `--color-text1-4`，说明 `--color-text1-3` |
| 一级卡片、表单主容器、详情面板 | `--pod-card-bg-color` | `--corner-5`；可用细弱边界 `--color-line1-1` 和 `--oyd-shadow-resting`，不叠加全局重阴影 | 标题与主值使用 `--color-text1-4` |
| 表格正文单元格 | `--pod-table-cell-color` | 连续白面，按行用 `--color-line1-1` 分隔，无独立阴影 | `--color-text1-4`，元信息用 `--color-text1-3` |
| 内部分段、辅助信息 | `--color-fill1-1`；需明确选中时用 `--color-fill1-2` | 优先留白或单条分隔线；有独立辅助区块时用 `--corner-4`，不增加阴影 | 主次文字沿用内容区语义 |
| 下拉、浮层、气泡、弹窗、弹出日历、导航弹出层 | `--color-fill1-5` | 独立不透明白面；`--corner-3`、`--color-line1-1`，普通小浮层用 `--shadow-1`，遮挡范围较大时用 `--shadow-2` | `--color-text1-4`、`--color-text1-3`；选项状态依照自身白色表面 |
| 抽屉 | `--color-fill1-5` | `--corner-5` 用于露出的外角，贴边处 `--corner-zero`；默认 `--shadow-2` | 与浅色内容前景配套 |
| 图表读数浮卡 | `--color-fill1-5` | `--corner-3` 与 `--shadow-2`；细弱边界，仅在实际读数位置出现 | 序列圆点、次级标签和深色值，不把整卡做成深底 |
| 短提示 Tooltip | `--color-fill1-10` | 紧凑轮廓，`--corner-3`，不扩大成信息面板 | 固定配对 `--color-text1-5` |

根背景图仅作用于根节点，不继承到输入、面板或表格。普通卡片中的内部区块以间距分组，避免重复的白卡套白卡。`--shadow-3` 保留供平台调用，本主题没有默认使用对象；未出现重叠任务层时不启用该档。

### 2.2 应用导航

冷浅灰导航与白色内容区保持细微层差，菜单圆角柔和，选中与搜索使用中性浅底。

菜单轮廓使用 --pod-nav-menu-item-radius、--pod-nav-menu-item-border、--pod-nav-menu-item-hover-border、--pod-nav-menu-item-selected-border。侧栏和顶部菜单共用轮廓，各状态保持相同边框宽度，文字位置稳定；具体数值以本项目 Token 为准。

导航与应用框架、表单、自定义页面和详情页共用设计语言。先按业务入口安排菜单、分组、搜索、品牌区与常用操作，再一起确定导航与正文的明暗、表面、字体、边界、圆角和密度。平台导航使用真实页面菜单；自绘导航按同一套导航 Token 实现。命名模板沿用自身 navTheme，换主色保持导航明暗与内容画布；需要另一导航明暗时改选主题，自由创意按项目明确设计。

导航底色使用 --pod-shell-theme-bg-color；普通、悬停和选中文字分别使用 --pod-nav-item-text-color、--pod-nav-item-text-hover-color、--pod-nav-item-text-selected-color；悬停和选中背景使用 --pod-nav-menu-bg-hover-color、--pod-nav-menu-bg-selected-color。图标跟随对应文字状态，当前入口同时用背景或字重表达。

菜单高度、圆角与间距使用 --pod-nav-menu-item-height、--pod-nav-menu-item-radius、--pod-nav-menu-gap；搜索、品牌区、分组、操作和弹出菜单使用 navigation 分组中的对应 Token。弹出菜单的底色、文字与搜索状态成组配套，导航与内容可以分别选择明暗。选中项使用 --pod-nav-menu-item-selected-shadow：none 关闭额外标记，完整 box-shadow 值可表达左、右或底部内阴影，不占据菜单布局空间；该 Token 独立于导航明暗。菜单高度、文字行高、内距和框架留白一起调整，给外阴影、长标题与键盘焦点留出空间。

桌面检查菜单、搜索、选中态与表单的协调；折叠后保留可识别图标和入口名称；窄屏保持菜单可展开、当前页面可定位、键盘焦点可见。提交、编辑、详情与自定义页都沿用这一导航设计。

### 2.3 页面标题与操作

标题直接落在页面画布上，左侧建立阅读起点，已有全局操作在右侧横向对齐，不另设整条深色标题栏。标题与首个内容区之间以 `--s-6` 或 `--s-8` 留白分隔。面板标题位于面板内部，已有线图标可放在标题左侧，相关次操作或筛选放在右侧；标题和操作之间保留明确空隙。

说明文字位于标题下方，使用次级文字色；没有说明时不留空行。搜索、用户菜单、通知与协作头像只在需求已包含时展示，不因标题右侧有空间补齐这些控件。操作间距使用 `--s-2` 或 `--s-3`；空间不足时让操作整体换到标题下方，保留标题在前的阅读顺序，不缩小字体。

### 2.4 排版、间距与形状

统一使用 `--font-family-base`。数值采用稳定的等宽数字排版，货币单位、精度和千分位在同一比较集合内统一；标签与数值保持不同层次，不通过更浅的小字承载唯一关键信息。

| 文字角色 | 字号 / 字重 / 行高 | 颜色与使用条件 |
| --- | --- | --- |
| 普通页面标题 | `--font-size-subhead` / `--font-weight-subhead` / `--font-lineheight-subhead` | `--color-text1-4` |
| 面板标题、独立记录主标题 | `--font-size-body-2` / `--font-weight-body-2` / `--font-lineheight-body-2` | `--color-text1-4` |
| 正文、字段标签、导航菜单与常规操作 | `--font-size-body-1` / `--font-weight-body-1` / `--font-lineheight-body-1` | 主文字用 `--color-text1-4`；导航用专属颜色 |
| 表头、表格数据与紧凑读数 | `--font-size-table` / `--font-weight-table` / `--font-lineheight-table` | 表头 `--color-text1-10`，数据 `--color-text1-4` |
| 时间、辅助说明、图例与坐标标签 | `--font-size-caption` / `--font-weight-caption` / `--font-lineheight-caption` | `--color-text1-3`，重要图例可用主文字色 |
| 已有指标或图形中心总值 | `--oyd-font-size-metric` / `--oyd-font-weight-metric` / `--oyd-font-lineheight-metric` | `--color-text1-4`；仅用于实际核心数值，不扩大所有标题 |

页面边距通常取 `--s-6` 至 `--s-10`，面板间距用 `--s-6`，面板内边距取 `--s-4` 或 `--s-5`，分组间距取 `--s-4`，图标与文字及相邻小控件间距取 `--s-2`，标题与附属说明间距取 `--s-1`。这些是主题的节奏档位；第五部分为具体页面确定布局，不预设固定列数、统一高度或内部滚动。

大容器用 `--corner-5`；内嵌辅助区块用 `--corner-4`；浮层和独立记录行用 `--corner-3`；默认菜单、输入与常规按钮用 `--corner-2`；缩略图用 `--corner-1`。圆形底盒和头像用 `--corner-circle`，短标签用 `--corner-semicircle`。自定义导航中满足第五部分条件的紧凑选中项可以使用胶囊形；常规按钮保持圆角矩形，不能因存在半圆角变量就全部改为胶囊。

### 2.5 色彩、图标与点缀

主题色集中于真实品牌标识、交互焦点、小面积标记和主题同源数据序列；应用外衬仅加入很低比例的主题色，保留浅灰层次。内容中的无色相灰保持中性。`--oyd-category-primary` 是随主色重算的分类角色；金色与粉色分类分别由 `--oyd-category-gold`、`--oyd-category-orchid` 承接，独立于主题强调且没有默认业务含义。分类色必须与实际图例绑定，不能把“分类职责独立”理解为主题近色不需联动。

成功、警告、错误、信息使用平台已有状态色与文字，数值正负也只在业务明确其意义时映射状态。不得把分类金色当成告警接口，也不得把主品牌色直接等同于所有信息状态。小型图标底盒和标签允许从其语义前景色向白色混合得到浅底；混合规则见第三部分。

图标保持同一细线家族，局部建议尺寸为 16–20 CSS px、线宽为 1.5–1.75 CSS px，均为推断。面板标题与菜单图标通常无底盒；指标和独立记录中的识别图标才使用浅色圆底。图例用小实心圆点。若内容存在缩略图，保持小尺寸、完整可辨，避免作为装饰铺满面板。

渐变仅用于实际数据图形的同色纵向层次，方法见第三部分，不用于整张卡片、页面背景或无意义的装饰球体。没有纹理、玻璃模糊、大面积发光或背景插画。状态过渡可在 120–180 ms 内完成，作为未展示交互的推断；不为增加动感改变数据尺寸或制造自动脉动。

## 3. 基础组件表达

以下定义组件存在时的外观，不构成项目功能清单。未列出的组件按任务结构、表面层次、文字角色、控件形状及状态表达推导。

### 面板与分组

面板继承第二部分的白面与柔圆轮廓，内容优先靠留白分组。标题行与正文之间使用 `--s-4`；标题图标轻于标题文字。表单字段分组以分组标题、间距及必要分隔线组织，不给每个字段再套卡片。页面内较窄的说明区可采用中性浅底与 `--corner-4`，保留单一清晰主操作；该组合仅在已有说明任务时出现。

### 按钮、输入与分段选择

常规次操作使用 `--color-white` 表面、`--color-text1-4` 前景、`--color-line1-2` 边界与 `--corner-2`，可采用 `--oyd-shadow-resting`。工具栏图标按钮保持相同边界强度；只有头像相邻的圆形辅助操作等明确圆形用途才用 `--corner-circle`。已有主要提交或确认操作可使用 `--oyd-strong-action-bg` 与 `--oyd-strong-action-fg`；已有品牌操作用品牌主色，两类实心按钮不在同一局部争夺焦点。

按钮高度按角色使用 `--s-7`、`--s-8`、`--s-9`、`--s-10` 四档，默认工具栏用 `--s-8`，强调操作可用 `--s-9` 或 `--s-10`；左右内边距用 `--s-3` 或 `--s-4`。不要把截图导出尺寸当作超大按钮规格。

输入、搜索与筛选控件基础表面使用 `--color-fill1-1`，前景用 `--color-text1-4`，placeholder 用 `--color-text1-10`，边界用 `--color-line1-2`。高度使用 `--s-8` 至 `--s-10`，圆角用 `--corner-2`；不引用卡片或 pop-up 背景来得到相似浅色。前置搜索图标与内容间距为 `--s-2`；已有快捷键提示可使用 caption 文字和浅灰小底面，不新增无效提示。

分段选择器以 `--color-fill1-1` 作为整体托底，选中项用白色按钮表面与局部弱阴影，文字加深；未选中项保持无边框文字。此处选中白面由分段控件的表面关系决定，不改写中性选中填充的全局含义。分段数量和选项来自真实筛选维度，不固定为某组三段时间单位。

### 小型标记、头像与标签

独立识别图标可放入直径 `--s-8` 或 `--s-9` 的圆底；有更强识别需求的记录可用 `--s-10`。底色可按语义色 8% 与白色 92% 的 sRGB 通道混合生成，图标使用同色相的可读深色，与实际底色至少达到 3:1；浅色品牌不能直接充当前景。语义来自品牌、真实类别或平台状态，不随机配色。圆底不使用强阴影，至多采用 `--oyd-shadow-resting`。

短标签使用 caption 字体、`--corner-semicircle` 和少量水平内边距；浅底按对应语义前景 10% 与白色 90% 混合，文字保持可读深度。标签包含文字，不能仅凭色相识别状态。标签与图标可共享语义来源，但不把标签数量固定到版面中。头像使用 `--corner-circle`，多头像轻微叠合时保留白色分隔边；只有真实成员数量才能生成溢出计数。

### 表格与独立记录列表

表格正文单元格背景使用 `--pod-table-cell-color`，通过 `var(--pod-card-bg-color)` 跟随卡片；表头使用 `--color-fill1-1` 与 `--color-text1-10`。横向行线用 `--color-line1-1`，默认无竖向网格。数值列右对齐，列内单位与精度一致；文本列左对齐，已有缩略图与主文本相邻。行垂直内边距使用 `--s-3` 或 `--s-4`，由实际内容密度确定，不缩小表格字体。排序符号细小且弱于列名，只有支持排序的列显示。

独立记录可以使用圆角行容器、细弱边界和行间 `--s-3` 间距；左侧可有语义图标，中间为主标题和次级元信息，右侧为已有状态或操作。含连续比较、合并或批量编辑任务的数据仍采用普通表格，不套独立卡片行。记录内容自然增长时优先保持标题可读，面板不以统一高度截掉业务信息。

### 数据图形与读数

主序列使用 `--oyd-chart-series-primary`，次序列使用 `--oyd-chart-series-secondary`。分类图可加入三个独立分类色，绑定顺序与图例一致；超出已定义类别时在项目页方案中补充可辨编码，不循环颜色制造相同类别的错觉。

纵向柱形允许从同一序列基色的 22% 不透明度渐变至 48% 不透明度，方向自上而下，白色绘图区作为合成基底；主序列聚焦时可提高到上端 55%、下端 100%。该数值为推断，需保证最浅段仍可辨认。次序列保持独立浅色语义，不能直接借用品牌 hover、active 或 disabled 变量表示数据。只有有圆角外轮廓的暴露端使用 `--corner-1` 或 `--corner-2`，堆叠连接面保持平直。

辅助网格用 `--color-line1-1`，坐标标签用 caption 和 `--color-text1-3`；尽量弱化轴线。图例圆点与实际序列同源。图表浮卡继承白色覆盖层，名称与值分行排布，多序列之间使用间距或浅线分组。读数来自真实数据，悬停与焦点使用相同数据源。缺失值显示缺失，不能转为零；刻度遵循所选尺度，柱高、堆叠总值、占比与图例读数保持一致。

若页面已有进度表达，轨道使用 `--color-fill1-3`，实际进度使用对应语义前景；不能用 hover 色充当轨道，也不能用占位条长冒充数值。

### 交互与反馈状态

除可见的选中菜单、分段选择和图表聚焦外，下表为同一语言下的状态推断；导航优先使用专用六项配色。

| 状态 | 视觉表达 |
| --- | --- |
| hover | 中性操作以 `--color-fill1-1` 轻微提亮边界；品牌操作用 `--color-brand1-1`；面板整体不抬升 |
| active | 中性操作用 `--color-fill1-2`；品牌操作用 `--color-brand1-9`；深色主操作用原表面加局部低透明黑色叠层，不借用图表色 |
| focus | 使用品牌色细轮廓与浅色外圈，保留文字和输入面；推断为 1px 轮廓和 2px 外圈，外圈按品牌种子 14% 与白色 86% 混合 |
| selected | 普通集合使用 `--color-fill1-2` 与清晰的选中标记；导航与分段控件依照自身映射，不能仅靠改变文字色表达 |
| disabled | 文字用 `--color-text1-2`；中性底面保持浅灰，品牌元素用 `--color-brand1-10`；不将正常说明文字渲染成禁用灰 |
| error / warning / success / information | 使用平台已有状态前景、边界及提示语义；错误信息就近出现，保留可读文字，不在 custom-page 新建同义状态 Token |
| loading / empty | 只在真实加载时使用中性浅块；空态保留面板表面与简短说明，已有可执行操作才显示按钮；不放虚构记录或装饰数据 |

标签、按钮和图标沿用设计稿确定的文字与底色配对；主题相关色随主色更新。黑色主操作、数据图形与警告标签的强调各有职责，不把一种状态色扩散为整片背景。

### 表单组件与版式结构

表单使用与自定义页面相同的应用全局样式，字体、色彩、表面、边界、圆角、密度和状态延续本主题。表单支持在顶部、左侧、主体、右侧和字段之间组合 Tab/切换、按钮组/操作入口、图片/图形、状态区、标题与 `Divider`、`ColumnContainer`、辅助内容和业务字段。各组件承担导航、操作、视觉焦点、反馈、层级、节奏、装饰或采集作用。普通业务分组和章节分隔使用 `Divider`，横向字段组合使用 `ColumnContainer`。每张表单在项目 `design.md` 写清组件位置与作用、列比例、标签位置、字段与章节间距、底栏、详情延续和窄屏重排。

## 4. 特色表达配方

### R1 侧置圆标的紧凑数值面板

- **适用内容：** 已有可独立阅读的统计值、计量单位与短名称；是否可相互比较由实际口径决定。
- **继承基础：** 白色一级面板、小型语义圆标和核心数字排版。
- **特殊组合：** 将圆形识别图标放在数值块左侧，名称在上、主值在下，名称使用次级文字，主值保留深灰；色彩停留在图标范围。若真实数据包含趋势，再用次级位置呈现，不为平衡版面补充涨跌箭头。
- **无匹配时：** 省略指标面板；指标少或名称较长时按内容重排，不强制凑成四项或等宽一排。

### R2 轻渐变柱形与局部读数焦点

- **适用内容：** 按有序类别或时间比较的真实数值；只有单位一致、可以相加的部分才使用堆叠柱。
- **继承基础：** 白色图表面板、主次数据色、浅网格、纵向同色渐变和白色读数浮卡。
- **特殊组合：** 图例靠近标题，已有时间维度选择器可位于标题另一侧。正常柱形保持轻量；聚焦柱提高主序列饱和度，并沿完整柱形外轮廓描出细品牌线和很浅的外圈，浮卡靠近该柱呈现各序列名称与值。焦点不改变柱宽、柱高或比较尺度。浮卡避让当前关键数值，不能把相邻柱永久遮住。
- **无匹配时：** 无有序比较数据则省略图表；不可加总的序列使用并列或独立图形。单序列不伪造浅色上段，轴刻度与柱段高度按数据生成。

### R3 留白环形与对齐的分类明细

- **适用内容：** 非负、同口径且可构成整体的分类数据；存在有意义的总值。
- **继承基础：** 白色面板、独立分类色、核心数字与图例文字规则。
- **特殊组合：** 上部环形留出较大的中心空白，中心用次级短标签与深灰总值形成双层文字。环宽可取外径约十分之一，段间以细小白缝分隔、端部轻圆，均为推断。下部将图例组织为“色点与类别 / 数值 / 占比”三组对齐信息，占比比数值更强调。分类较少时保留足够空白，不放大图例色点。
- **无匹配时：** 类别很多时使用可比较的条形或明细；没有整体关系时不显示占比环。弧长必须按真实占比计算，不固定复用近等长色块；总量为零时显示明确空态，不绘制完整彩环。

### R4 圆标、双层文字与末端标签的记录栈

- **适用内容：** 已有相互独立、带类型或状态的记录，且主要任务是快速了解单条事件。
- **继承基础：** 独立记录行、语义圆形图标、正文主次层级与短标签。
- **特殊组合：** 每条记录以浅边界柔圆行呈现，左侧圆标、中间两层文字、末端短标签形成稳定节奏；次级行可把真实时间与补充信息以弱分隔点连接。相邻记录通过小间隔分开，不加纵向贯穿线。标签靠近自身记录，避免形成独立彩色侧栏。
- **无匹配时：** 没有真实状态就省略标签；没有元信息就保留单层正文。任务需要跨行数值比较或批量操作时回到基础表格，不强制采用记录栈。

## 5. 项目应用与调整规则

### 变量与平台边界

YAML 是变量值的唯一事实源，正文定义消费关系。全局层供应用外观与内容组件使用；自定义页以 `--oyd-page-bg` 桥接背景，并补充独立的核心数值、深色操作、分类数据色与局部弱阴影。递归读取以 `--` 开头的标量叶子，分组名不拼入变量名，不重复定义或跨层覆盖。平台基础与项目扩展均在主题中声明，可无环引用，并按实际设计补充变量。

需求确定真实内容与操作，平台约束限定实现能力，主题规定外观。条件配方不能增加业务字段、示例人物、假数值或没有功能的控件。局部推断参数只服务其对象，不改写固定字体与间距。原生导航只消费开放的六项配色；项目明确自绘导航后才应用相应外观补充。页面标题不自动形成另一层导航。

### 品牌色与数据色实例化

- 色彩来源：{{COLOR_SOURCE}}。
- `{{PRIMARY_COLOR}}` 是唯一主题色种子，由用户、项目品牌或平台当前主题确定；无明确输入时在项目阶段确定并记录来源，不回填参考图固定色。用户指定种子优先，不能因对比不足静默换色。
- YAML 中所有生成标记在项目实例化阶段转换为实际色值。sRGB 逐通道混合算法为：将各基色解析为 0–255 通道整数，以标明比例加权相加，四舍五入并限制在该范围，最后输出六位十六进制；不做线性光空间转换。局部语义浅底也使用同一算法。
- 七项品牌变量分别保留悬停、平台浅色、派生浅色、派生深色、主色、按下、禁用语义。主数据色引用品牌主色，浅序列按独立数据配方生成；其独立语义不因与某个品牌浅色接近而合并成交互状态变量。
- 主题外衬、主次数据序列和主题同源分类色沿 `--color-brand1-6` 重算，混合基底只用黑、白或无色相灰。无色相基础灰、独立金色／粉色分类和平台状态色保留各自用途。品牌与分类色接近时，用标注、纹理或边界保证类别可辨；保留用户品牌输入。
- 六项导航颜色成组独立确定，导航换色不改写页面、面板、输入、内容文字或覆盖层。浅色内容的 pop-up 保持不透明白色。深色内容需要单独确定完整前景与表面关系，不能只反转根背景。
- 小字、标签、按钮与图例保留设计稿的文字深浅与底色关系，主题换色只更新关联色值。

### 项目页面设计

仅为需求实际包含的页面填入确定方案，不将配方列表直接当作页面规划。每页包含以下结果：

- **页面内容：** 页面名称、主要任务、真实内容、数据口径及已有操作。
- **首屏印象：** 明确第一视觉焦点，以及形成该焦点的主次、构图、浅色表面、色彩和留白。
- **布局安排：** 确定实际区块位置、宽度、列数、高度和对齐对象，并指定窄屏内容顺序及重排方式；不默认四项指标、两列图表或全体等高。
- **视觉表达：** 指明各区域使用的表面、排版及组件规则；启用特色配方时注明编号、位置与真实内容条件。导航如为原生，只记录实际六项颜色，不覆盖平台布局；PRD 明确要求页面内自定义导航时，按下方指南写出具体导航设计。
- **标志性时刻：** 指定一处静态构图或真实交互反馈，说明位置或触发条件、具体视觉表现及对理解信息或完成任务的作用。普通表单或列表也可通过清晰的表面与文字层次形成这一时刻。

素材来源、缺口处理与特殊约束写在对应页面内。头像、标识和缩略图仅用已提供或已获准素材；没有素材时确定文字或中性占位方式，不补造真实身份与品牌。首屏焦点与标志性时刻可来自同一位置；实例化结果需写出确定安排。

#### 自定义导航视觉设计指南

PRD 明确需要时启用，沿用已确定的需求、本主题导航配色和组件规格，落实三项设计：

1. **形态与构图：** 入口少、层级浅时优先顶部导航；入口多、名称长或需要分组时优先侧栏。明确导航尺寸、留白及与主内容的对齐，保留充足阅读空间。
2. **与页面的关系：** 融入式用浅底和细分割线；独立容器用柔圆轮廓与外侧留白；浮岛用于精简单层导航，四周留空、阴影轻微。选择一种主要分区方式，内外形状协调，避免边框与阴影层层叠加。
3. **菜单与选中态：** 侧栏优先圆角底块，融入式顶部导航可用下划线，紧凑横向导航可用胶囊。沿用专属导航色，以间距、缩进和文字区分层级；同层只选一种主标记，普通项轻量、当前项清晰，切换时尺寸稳定。

逐页写出最终组合及具体尺寸、间距和对齐；不只列候选样式或写“简洁美观”。

{{PAGE_APPLICATIONS}}

### 页面设计验收

以下为实际页面渲染后的待执行要求，只检查该页采用的内容。

- [ ] **首屏印象：** 焦点和内容主次与页面方案一致；深灰文字承担信息，彩色强调集中于规定区域。
- [ ] **布局安排：** 分区、比例、列数、高度、对齐及窄屏顺序符合页面方案，真实内容自然增长不被统一卡片高度截断；采用自定义导航时，其容器位置、尺寸、对齐和与内容的间距符合确定方案。
- [ ] **风格表达：** 浅色表面仍有可辨层差，导航独立配色，自定义导航的分区方式和选中形态协调、主次清晰，常规按钮与大容器的圆角角色明确，普通卡片没有被重阴影抬起；启用图形时读数、比例、颜色编码与数据一致。
- [ ] **标志性时刻：** 规定的静态画面或交互焦点按位置或条件出现；采用图表焦点时白色浮卡可读、描边克制，且不改变数据几何。
