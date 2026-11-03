---
name: "{{PROJECT_NAME}}"
description: "二比一主次区、任务流与状态摘要条；青绿弱填充、清晰分组、适度圆角。适合运营排班、供应与项目协同。"
themeId: "app-teal"
tokens:
  application-global:
    appearance:
      surfaces:
        "--pod-app-root-bg-color": "#edf4f2"
        "--pod-app-root-bg-image": "none"
        "--pod-page-bg-color": "#edf4f2"
        "--pod-card-bg-color": "#ffffff"
        "--pod-table-cell-color": "var(--pod-card-bg-color)"
      navigation:
        "--pod-nav-sub-divider-color": "#A8CFC0"
        "--pod-shell-theme-bg-color": "#DFEDE7"
        "--pod-nav-item-text-color": "#24665F"
        "--pod-nav-item-text-hover-color": "#154D45"
        "--pod-nav-item-text-selected-color": "#F5FCF9"
        "--pod-nav-menu-bg-hover-color": "#C9E2D7"
        "--pod-nav-menu-bg-selected-color": "#24665F"
        "--pod-nav-menu-item-height": "40px"
        "--pod-nav-menu-item-radius": "8px"
        "--pod-nav-menu-item-selected-font-weight": "600"
        "--pod-nav-menu-gap": "6px"
        "--pod-nav-popup-bg-color": "var(--pod-shell-theme-bg-color)"
      native-form:
        "--form-element-medium-corner": "8px"
        "--form-element-medium-height": "40px"
        "--form-element-medium-font-size": "14px"
        "--input-bg-color": "#ffffff"
        "--input-border-width": "1px"
        "--input-border-color": "#bfd6d0"
        "--input-hover-border-color": "var(--color-brand1-6)"
        "--input-focus-border-color": "var(--color-brand1-6)"
        "--input-hover-bg-color": "#ffffff"
        "--input-focus-bg-color": "#ffffff"
        "--pod-form-label-color": "var(--color-text1-4)"
        "--form-top-label-margin-b": "8px"
        "--yida-divider-secondary-color": "var(--color-brand1-2)"
        "--yida-form-content-bgcolor": "#ffffff"
        "--pod-page-content-max-width": "980px"
        "--pod-page-border-radius": "8px"
        "--pod-page-footer-bg-color": "#ffffff"
        "--pod-page-footer-border-radius": "8px"
        "--pod-sticky-footer-box-shadow": "none"
        "--pod-formView-stickyFooter-bg-color": "#edf4f2"
        "--pod-formView-stickyFooter-box-shadow": "none"
        "--pod-formView-stickyFooter-border": "none"
        "--pod-formView-stickyFooter-border-top": "1px solid #bfd6d0"
        "--pod-formView-stickyFooter-height": "56px"
        "--pod-formView-stickyFooter-bottom": "8px"
        "--pod-field-preview-min-height": "32px"
        "--pod-field-preview-padding": "8px 12px"
        "--pod-field-preview-gap": "4px"
        "--pod-field-preview-bg-color": "#ffffff"
        "--pod-field-preview-border-radius": "8px"
        "--pod-field-preview-indicator-color": "var(--color-fill1-3)"
        "--pod-field-preview-shadow": "none"
        "--pod-field-preview-text-color": "var(--color-text1-4)"
        "--pod-field-preview-line-height": "20px"
    colors:
      "--color-white": "var(--pod-card-bg-color)"
      "--color-brand1-1": "#3E7872"
      "--color-brand1-2": "#E5EDEC"
      "--color-brand1-3": "#F6F9F9"
      "--color-brand1-5": "#1C3532"
      "--color-brand1-6": "#24665F"
      "--color-brand1-9": "#1B4E48"
      "--color-brand1-10": "#213230"
      "--color-line1-1": "#C3C8C8"
      "--color-line1-2": "#C3C8C8"
      "--color-fill1-1": "#F0F2F2"
      "--color-fill1-2": "#EAECEC"
      "--color-fill1-3": "#C3C8C8"
      "--color-fill1-5": "#ffffff"
      "--color-fill1-6": "var(--color-text1-3)" # 弱图标与辅助操作 glyph 前景色
      "--color-fill1-10": "#262626"
      "--color-text1-5": "#FFFFFF"
      "--color-text1-4": "#3E4140"
      "--color-text1-10": "var(--color-text1-3)"
      "--color-text1-3": "#616464"
      "--color-text1-2": "#828584"
      "--color-text1-1": "#CACDCC"
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
      "--corner-1": "8px"
      "--corner-2": "8px"
      "--corner-3": "8px"
      "--corner-4": "8px"
      "--corner-5": "8px"
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
    "--oyd-radius": "8px"
    "--oyd-content-width": "980px"
    "--oyd-content-padding": "32px"
    "--oyd-field-gap": "24px"
    "--oyd-section-gap": "48px"
    "--oyd-heading-font": "var(--font-family-base)"
    "--oyd-heading-size": "32px"
    "--oyd-rule-style": "solid"
    "--oyd-layout-columns": "minmax(0, 8fr) minmax(0, 4fr)"
    "--oyd-surface-shadow": "none"
applicationStyle:
  recipe: "application-style-v1"
  mode: "template"
themeProfile:
  contentTone: "light"
  navTheme: "light"
---
# {{PROJECT_NAME}} design.md

## 1. 风格摘要

**青岚运营**

二比一主次区、任务流与状态摘要条；青绿弱填充、清晰分组、适度圆角。适合运营排班、供应与项目协同。

导航、应用框架、自定义页面、表单、编辑与详情共用这一套视觉语言。业务内容来自 PRD，按实际行业、页面标题和数据设计。默认采用青岚绿 #24665F，完整品牌色阶及中性色以 YAML Token 为准。项目另有明确配色时，在设计源中成组更新品牌、导航、交互和文字背景配对，再生成应用主题 CSS。

## 2. 页面视觉系统

### 2.1 表面、区块与层次

正文、字段标签和详情值使用内容文字色，说明与占位文字使用辅助文字色；品牌色用于局部操作和数据强调，不把整页文字染成主色。

二比一主次区、任务流与状态摘要条。青绿弱填充、清晰分组、适度圆角。画布消费 --oyd-page-bg，内容消费 --oyd-surface，文字消费 --oyd-ink，边界消费 --oyd-border。内容最大宽度 --oyd-content-width，内距 --oyd-content-padding；宽屏不放大成空白 KPI 卡。

### 2.2 应用导航

浅青绿导航与运营状态带相连，适度圆角、稳定行距和清晰分组组织任务入口，选中项为深青底浅字。

常驻导航优先沿用平台原始样式，通过主题文字、背景与字重区分状态。菜单 border、box-shadow 是可选覆盖，没有明确用途就不声明；不为了统一风格给每项加框或投影。普通入口融入同一侧栏，按连续目录组织；分组靠留白与文字层级，不把导航复制成输入框、独立按钮或卡片堆叠。内容卡片、主按钮和表单可以使用更强的形状与材质，同一主题不意味着所有组件装饰强度相同。业务确有触控或特殊展示需求时，在本 design.md 调整并验收，不在运行时限制项目自定义值。

菜单圆角可通过 --pod-nav-menu-item-radius 与内容层级配套。只有明确需要自定义边界时才声明 --pod-nav-menu-item-border、--pod-nav-menu-item-hover-border、--pod-nav-menu-item-selected-border，并检查状态切换不引起文字跳动；省略时保留平台原始表现。

导航与应用框架、表单、自定义页面和详情页共用设计语言。先按业务入口安排菜单、分组、搜索、品牌区与常用操作，再一起确定导航与正文的明暗、表面、字体、边界、圆角和密度。平台导航使用真实页面菜单；自绘导航按同一套导航 Token 实现。导航外观属于这份完整应用主题，颜色、三态边框、圆角、阴影与表单、详情和自定义页面一起设计。业务决定入口组织、操作频率与交互需求；主题决定这些需求的视觉表达。主色只是颜色角色之一，辅助色和材质色可以独立存在；仅显式 var 引用建立联动，不按主色批量染色。项目更换配色时，回到同一份 design.md 成组调整实际受影响的 Token，并核对五类界面的整体搭配。

导航底色使用 --pod-shell-theme-bg-color；普通、悬停和选中文字分别使用 --pod-nav-item-text-color、--pod-nav-item-text-hover-color、--pod-nav-item-text-selected-color；悬停和选中背景使用 --pod-nav-menu-bg-hover-color、--pod-nav-menu-bg-selected-color。图标跟随对应文字状态，当前入口同时用背景或字重表达。

菜单高度、圆角与间距使用 --pod-nav-menu-item-height、--pod-nav-menu-item-radius、--pod-nav-menu-gap；搜索、品牌区、分组和操作优先沿用平台已有的变量绑定，navigation 分组只声明本主题需要覆盖的差异。弹出菜单的底色、文字与搜索状态成组配套，导航与内容可以分别选择明暗。选中项通常沿用平台样式；仅需额外位置标记时才声明 --pod-nav-menu-item-selected-shadow，显式 none 用于有意关闭阴影。省略时不生成额外 box-shadow 规则；该 Token 独立于导航明暗。菜单高度、文字行高、内距和框架留白一起调整，给外阴影、长标题与键盘焦点留出空间。

桌面检查菜单、搜索、选中态与表单的协调；折叠后保留可识别图标和入口名称；窄屏保持菜单可展开、当前页面可定位、键盘焦点可见。提交、编辑、详情与自定义页都沿用这一导航设计。 当前模板使用 contentTone: light、navTheme: light。

### 2.3 页面标题与操作

窄色带章节与任务说明。标题字体消费 --oyd-heading-font 与 --oyd-heading-size，辅助说明按正文层级。主操作与当前任务相邻；不堆造虚假标签、指标或章号。

### 2.4 布局和移动端

桌面业务工作区：二比一主次区、任务流与状态摘要条。短字段建议 8:4，字段间距 24px、章节间距 48px、内容内距 32px；这些是项目起点，必须在每张表单设计中按组件树和字段长度确定。窄屏与半屏抽屉按实际可用宽度重排顶部、左侧、主体、右侧及字段间区域，侧栏组件可移到主体前后或折叠为合适的窄屏结构；长文本、附件和子表通常占整行。不把屏幕断点当 iframe 宽度，不用 fixed 卡片截断自然内容。

### 2.5 自定义页面设计

自定义页面以 二比一主次区、任务流与状态摘要条 组织真实业务内容，以 窄色带章节与任务说明 建立标题与首屏焦点，并用 青绿弱填充、清晰分组、适度圆角 统一页面表面。页面根据 PRD 安排标题与操作区、状态摘要、筛选、主要内容、上下文信息和反馈区；列表、表格、图表、详情抽屉和表单入口只在业务需要时出现。宽度、列数、高度和滚动方式按内容增长确定，移动端按阅读与操作顺序重排。

每个自定义页面逐页写清页面任务、首屏焦点、布局、表面与组件、主操作、状态、响应式和验收。状态覆盖加载、空、错误和无权限反馈及恢复动作；页面使用全局主题 token 落实当前风格，并为键盘焦点、纯图标按钮、非颜色状态表达和 reduced motion 提供可执行规则。

### 指标卡与按钮配色

先看页面的画布、卡片、图片和导航已经用了哪些颜色，再确定用户最需要看见的信息和操作。结合这些背景的冷暖、明暗、饱和度与面积，选择同色系的温和搭配，或用少量对比色突出重点；大面积背景宜克制，小面积操作可以更鲜明。品牌色、邻近色、协调的对比色和中性色都可使用，不把“与主题协调”理解成“全部使用主题主色”，也不默认选黑色。已确认的暗色、黑白品牌或用户参考仍按原方向设计。

| 对象 | 配色方式 |
| --- | --- |
| 普通指标 | 使用卡片底和正文色，辅助说明降低强调程度；同组指标保持一致，不按序号轮换彩色背景 |
| 重点指标 | 选择与画布协调的浅彩底，或只强调数字、图标和短色带；颜色可与品牌不同，但要服务信息分组。需要实色面板时单独配套前景，不因“有指标”就把整条摘要染深，也不抢过当前主操作 |
| 主按钮 | 根据所在背景和整页配色选择操作强调色，可用品牌色、协调的辅助色或中性色。先保证容易找到、文字清晰，再看它与指标、图片和导航是否协调；同一操作组突出一个主要动作，不要求按钮与导航选中态同色 |
| 次按钮与工具 | 使用中性底、文字和边框，刷新、筛选、详情不自动变成实色主按钮；形状与颜色分别决定，胶囊形不代表近黑色 |
| 状态与危险操作 | 逾期、失败、成功和删除使用对应语义色，并保留文字说明；普通待办不自动算警告，普通总数不自动算成功 |

每种实际使用的表面都成对确定背景、文字、图标及边界；按钮同时确定 hover、pressed、focus 和 disabled。普通文字对比度至少 4.5:1，传达信息的图标及必要控件边界至少 3:1；白字不一定适合亮品牌色，按实际对比选择深色前景或可读的品牌变体。不能只换背景而沿用原来的白字，也不能让图标与底盒共用同一个实色。

将配色和搭配理由写入现有组件规则及页面的 `surface`、`primaryAction`，对应值写入已有 token；只有缺少语义时才补项目变量，不增加文件或必填字段。相同角色的操作跨页面保持一致，特殊背景上的变体成组定义；操作色和信息色可以不同，不能每张卡、每个按钮临时选色。模板中的固定配色服从当前项目的配色决定。没有声明的旧主题变量不能靠黑色 fallback 继续生效；跨应用复用代码时，逐项替换指标与按钮的颜色角色。

### 分组标题与分割线

同一应用的所有普通表单和流程表单默认使用同一种分割线类型。先结合应用业务场景、整体主题、字段密度、标题长度和移动端使用方式，从 [23 个可见样式](../../../../yida-create-form-page/references/form-field-properties.md#divider) 中选择一种，再统一配置各表单的 `Divider.dividerType`。高频登记重扫描效率，可比较简线、圆点或浅底；审核申请重分组识别，可比较带条浅底；活动专题可考虑居中标签。这些是候选方向，不是行业到样式的固定映射。

在现有 `design.md` 的组件规则中记录应用默认类型与业务理由，各表单引用同一决定；新建表单、并行生成、重试和后续增改都复用，不按页面随机轮换。缺少记录时先核对同应用设计与已有表单配置，再按应用场景确定；场景依据不足时选择适合主要填写任务、标题和窄屏的简洁类型。用户明确指定的有效类型优先，个别表单例外记录适用范围；已有表单局部修改保留未涉及的样式，不为统一类型擅自批量改写。

Fast 与 Plan 使用同一应用级决定。原生表单排除 `none`，无需分组的内容可省略 Divider；Canvas 章节标题按业务层级协调设计，不假定可直接使用平台 Divider 组件。普通表格网格、卡片边框与章节分割线分别处理。

同一应用保持字体、间距、对齐和配色协调。平台主题模式使用品牌主色、随内容明暗变化的品牌弱背景和正文色；`dark-bar` 表示实底标题条，并非固定黑色。强色底、长标题和窄屏均检查文字可读性；内嵌椭圆、双色标签分别检查外条、标题承载面与文字，见 [复合分割线](../../../references/native-form-styles.md#内嵌标题与复合分割线)。

### 页面与导航连续性

适用于自定义页面的导航、锚点、tab、列表详情和原生任务切换。已有设计与业务权限优先；页内切换不因此创建应用导航或隐藏平台导航。

#### 导航归属先于布局

平台导航下的管理页只实现业务内容：平台负责跨模块切换，当前页只保留同任务分类、筛选与上下文动作。下文共同背景、导航占位和导航壳规则仅在当前页面确实拥有自绘导航时应用，不要求每个工作台再写一套顶部或侧边菜单。

#### 画布与滚动

- 官网、品牌、活动等连续展示页：沉浸首屏的图片/渐变从局部画布顶部开始，覆盖导航背后和四周；文字单独留导航安全区，沿用宿主页面滚动。
- 工作台、列表、表单等业务工作区：导航占位，内容撑满剩余高度；本地内容区或 iframe 内滚动，同一轴只有一个主滚动容器。

顶部导航默认贴顶通栏，无外侧悬空留白或胶囊轮廓；悬浮样式仅按用户参考或明确设计选用。有首屏背景图时，导航叠加背景、初始透明，滚动后增加遮罩底色，回到顶部恢复透明；展开菜单始终有可读底色。文字、图标及选中态随背景保持对比。

背景从画布顶部开始，安全区只留在首屏文字内部，禁止白底导航占一行后才开始图片。固定定位与悬浮外观分开决定：核实实际滚动容器、祖先 overflow/transform 和宿主边界，再选 sticky 或 fixed；不能默认监听 window、跨父页面改 CSS 或用负 margin 掩盖断层。

长页使用 canvas-nav-content 的 document 布局：根为自然高度，main 为 block，main/content 不带工作区的 flex 零基准与 min-height:0。不可只把 overflow 改为 visible 而保留定高工作区结构；宿主裁切时会让整页只剩导航高度。顶部组件以 headerOnly 接入，有首屏背景时传 overlay，不叠第二层内容壳。

各视图共享品牌、对齐线、宽度和外侧留白，不要求铺同一张图；宽表格等例外在设计中说明，不无意增加白卡、双导航或改变边距。

#### 操作与状态

| 操作 | 保留与切换 |
| --- | --- |
| 同页锚点 | 不卸载页面；滚动与选中态同步，避开导航，尊重 reduced motion |
| tab / 本地视图 | 只切内容；筛选、分页、已载数据、草稿放在稳定父层并按任务 key 保存，首次进入到顶部，返回按设计恢复位置 |
| 列表详情往返 | 抽屉或同壳视图；保留筛选、页码、列表位置，关闭后焦点回到入口 |
| 原生任务 | 真实 submission/workbench、保留壳与返回路径；不嵌套壳，iframe 状态只通过平台支持的通信判断 |
| 外链 / 跨页 | 真实链接，保留新窗口和修饰键；同标签跨页须确认目标保留同一导航壳 |

同一任务 key 驱动 URL、选中态和内容。沿用现有路由；hash 参数模式保留其余 query/hash 和 history.state，监听返回事件并 cleanup。权限查询完成后，不可用入口回退并 replaceState 校正地址，不新增无效历史。

重复点击当前项不重载、不重置位置、不重复写历史。不要给导航、Provider 或根节点设置随菜单变化的 key；contentKey 只卸载内容，不缓存草稿或 iframe。未保存输入的菜单切换、浏览器返回共用离开策略；取消后地址、选中态与内容均保持原任务。

loading/empty/error/无权限只替换内容区，保留导航和画布。快速切换取消旧请求或校验归属，旧响应不能覆盖当前任务；不把旧数据冒充新任务。失败提供局部重试与返回，iframe load 不证明业务成功。普通刷新保留内容和位置，提交后按需更新关联数据。

#### 交接与验收

状态交接应区分刷新、页内切换与跨页返回：非敏感枚举筛选及页码可由路由恢复；敏感筛选留在内存；未提交草稿单独约定保存、放弃和取消离开策略。按 `yida-canvas-custom-page` 的状态恢复规则落地，需要最小片段时提取 `canvas-view-state`；片段不负责跨任务缓存、草稿或离开拦截。业务动作还须按 `yida-canvas-data-binding` 的授权清单验证服务端规则，导航可见性不能替代授权。

实际验证首屏、第二屏、宽窄屏展开态：无背景断带、遮挡、双滚动、横向溢出或滚动锁残留，键盘焦点可见；实际滚动到页脚并回顶，比较根/main 高度与正文、导航高度，不能只看到首屏就认定底部可达。逐项测试菜单往返、直接链接、刷新、前进后退、重复/快速点击；再测慢加载、失败、空数据、无权限、未保存输入，无整页闪白、串数据或静默丢草稿。编译和静态检查不能代替视觉与交互验收，只报告实际验证范围。

## 3. 基础组件表达

### 自定义页面组件与交互

页面标题、筛选、主操作、状态摘要、列表、表格、图表、详情抽屉和表单入口按真实任务组合。标题与操作保持清楚的主次和对齐；列表、表格与图表使用稳定容器高度或自然增长规则；详情抽屉保留上下文并提供明确返回路径。默认、hover、active、focus、loading、empty、error、disabled 和 selected 状态使用同一套表面、边界、文字与状态语义。

`YidaCodeCanvas` 页面在 `YidaComp` 内消费 --oyd-page-bg、--oyd-surface、--oyd-ink、--oyd-border、--oyd-accent、--oyd-radius、--oyd-content-width、--oyd-content-padding、--oyd-section-gap 和其他已声明 token。页面局部 CSS 只负责当前组件的布局和特色表达；应用全局样式统一作用于应用框架、表单、详情页和自定义页面等。

### 表单、表格与记录集合

单行控件 40px、圆角 8px，边框 1px；字段 labelAlign=top（标签在字段上方）。多行文本、附件、日期范围、子表按自身布局。详情页沿用相同章节顺序与表面；只读字段的数据框使用 --pod-field-preview-bg-color、--pod-field-preview-border-radius、--pod-field-preview-shadow、--pod-field-preview-indicator-color、--pod-field-preview-text-color、--form-element-medium-font-size、--pod-field-preview-gap、--pod-field-preview-line-height、--pod-field-preview-min-height 和 --pod-field-preview-padding，延续应用的色彩、形状、字体与密度。表格保持紧凑，按钮、输入、浮层和导航消费同源色彩与形状。

### 表单组件与版式结构

表单支持在顶部、左侧、主体、右侧和字段之间放置分栏、Divider、图片/图形、Tab/切换、按钮组/操作入口、状态区和字段。各组件分别承担导航、操作、视觉焦点、反馈、层级、节奏、装饰或采集作用。普通业务分组和章节分隔使用 Divider，横向字段组合使用 ColumnContainer。form-layout.json 提供 8:4 空字段列，columnGap=24px、rowGap=24px、display=VERTICAL；按任务与容器宽度补充组件并调整布局。不因主题名称自动套 3:9，不重复已有标题，不用空泛文案凑版式。

### 组件状态

默认/hover/focus 同时配置边界和表面；键盘焦点保持可见。错误、警告、禁用沿用平台独立语义，不能被通用强调色覆盖；不得以全局 input 或 .next-* 强制改所有控件。应用 CSS 配置表单、编辑和详情的视觉样式。

### 底栏与对齐

普通提交按钮区使用 --pod-page-footer-bg-color 与 --pod-sticky-footer-box-shadow；数据管理、抽屉详情外层使用 --pod-formView-stickyFooter-bg-color 与 --pod-formView-stickyFooter-box-shadow。本风格按钮区跟随内容面，外层跟随画布，不叠加双阴影。底栏与正文共同消费 --pod-page-content-max-width。导航、无导航、管理内嵌、抽屉、移动端分别检查，不能全局覆盖 stickyFooter 的宽度与定位。

### 图标与相邻底色

图标前景和底盒分别取色，按上述配色规则检查对比度。颜色配对记录在 iconSystem.colorPairs，页面按同一变量实现，并检查颜色继承、描边和透明度。

## 4. 特色表达配方

### 材质与信息密度

青绿弱填充、清晰分组、适度圆角。二比一主次区、任务流与状态摘要条。图表、图片、时间线只为真实内容出现；没有媒体时以排版与章节构图成立，不为“丰富”捏造指标或入口。

## 5. 项目应用与调整规则

YAML Token 是唯一数值源。沿用当前主题的构图与材质语言，按业务调整主色、字段分组及信息密度。

逐页记录页面任务、首屏焦点、布局、组件、主操作、状态、响应式与验收。表单按第 3 节补充组件作用、列比例、标签、间距、窄屏重排和详情延续方式；在 form-layout.json 中填入真实字段与所需组件，并对照 design.md 验收。

### 按任务采用布局

- 服务门户：单列叙事流，首屏主张与主要行动相邻，其后安排服务入口、业务对象介绍、办理步骤与联系信息。内容最大宽度可按展示需要调整至 1200px，区块间距 32px；窄于 768px 时入口和介绍网格改为单列，主要按钮全宽。
- 运营工作台：采用 2:1 双列，主列放状态摘要与任务列表，辅列放待办、反馈摘要和当前任务操作；区块间距 20px。窄于 1024px 时合并为单列，摘要可重排为两列，宽表格在自身区域横向滚动。
- 数据看板：指标摘要后安排趋势与分类对比，主要图表和辅助图表可用 3:2 双列。窄屏图表改单列，保留口径、单位和图例；空数据说明原因，操作后的指标与明细使用同一筛选口径。

这些是按任务选择的布局起点，不要求每个应用同时创建三个页面。各页补齐主操作、加载/空/错误/无权限状态、响应式顺序与可验证的验收条件；数量与内容由真实业务决定。

{{PAGE_APPLICATIONS}}

### 验收

- [ ] 导航、应用框架、Canvas、表单与详情的字体、线条、材质和状态一致。
- [ ] 正文与底栏对齐；四类容器与移动端无横向溢出。
- [ ] 文字/焦点/禁用/错误在实际背景上可辨，长说明与表格未裁切。
- [ ] 表单布局与逐页设计一致；组件、字段、主题和响应式规则均已核对。
