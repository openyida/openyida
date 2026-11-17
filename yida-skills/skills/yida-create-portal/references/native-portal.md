# 原生门户组件与磁贴布局

## 读、配、验

1. 明确门户所在应用、使用人、第一屏任务及现有数据资源。已有原生门户先读回，缺少门户时用 `create-portal` 创建。目标应用的实际主题通过主题设置或 `app-theme snapshot` 读取。
2. 用 `openyida portal catalog [componentName]` 查看可写字段、默认布局和实例上限。运行 `openyida portal inspect <appType> <formUuid> --editable`。记录 `revision`、现有 `fieldId`、布局、主题及使用中的物料。`catalog` 是 CLI 的本地配置目录，无需登录。目标应用的实际物料和选择器以设计器或同场景门户的回读为准。
3. 编写 `{"tiles":[...]}` JSON。每个磁贴填写稳定的 `key`、准确的 `componentName`、需要写入的 `props`、可选的 `layout`。编辑已有门户时，可将回执的 `config` 对象直接另存为配置文件。修改设计器创建的磁贴时传回读得到的 `fieldId` 并保持组件类型，避免添加重复节点。保留 `key` 以识别同一磁贴，重跑前重新读取版本。
4. 用 `openyida portal configure <appType> <formUuid> portal.json --dry-run --json` 查看预计配置，再执行 `openyida portal configure <appType> <formUuid> portal.json --expected-revision <revision> --json`。版本冲突时重新 inspect，按最新布局重做变更。保存后使用设计器预览和工作台核对真实渲染、权限、链接及移动端顺序。
5. 按门户设计器的页面发布流程核对访问范围。对外分享或配置播报是独立操作。只有用户明确指定门户为应用首页或调整导航顺序时才配置导航，并回读实际首屏入口。AI 对话入口依赖业务关系图谱。设计器首次保存可能提示生成图谱，生成中访问态可暂时隐藏入口，验收需等可用后再做。

## 应用场景与能力限制

- 原生应用门户走现有应用的 `formType=portal` 创建和保存链路。保留服务端返回的应用类型、创建来源和权益。门户的主题 patch 只写页面 Schema。资源配额、设计权限、访问权限、组织灰度和物料版本按目标应用实际能力执行。
- 普通应用优先用快捷入口、轮播、公告和资讯。快捷入口使用已核对的本应用页面或可访问 URL。待办用当前应用的数据源。快捷访问及最近使用读取访问者的应用列表，按该账号核对可见范围和空态。
- 数据管理视图绑定同一应用的普通或流程表单。数据卡片绑定同一应用已经发布的卡片。钉钉日程还需访问者的日历授权。AI 对话入口先核实图谱和问答能力；只有按钮或 Schema 回读时，交付状态为待验证。
- 组织门户的应用选择器、跨应用聚合、空间分组和工作台入口依赖实际空间能力。普通应用里的数据卡片用 `cardCode`，普通待办和快捷入口沿用实际页面链接。按目标设计器和访问态核对场景物料。
- 面板与运行态分别判断。数据管理视图、原生快捷入口和顶部横幅在 AI 应用面板有专门入口，也有普通应用已保存的实例。快捷访问和最近使用受环境及工作台灰度控制面板入口。`portal catalog` 列出 CLI 配置契约，交付前仍需在目标应用验收物料加载。

## 线上官方目录

以下组件曾在应用门户的官方目录加入画布并读到保存的 Schema。运行时名称是底层组件标识，右侧面板文案可能随物料版本和组织变化。

| 组件 | `componentName` | 配置与验收 |
| --- | --- | --- |
| 数据卡片 | `DataCard` | 先在同一应用准备并发布实际卡片，从门户选择器或 `data-card list` 确认已发布的 `cardCode`。将 `colorMode` 设为 `brand` 跟随门户主题，`default` 使用默认样式。打开工作台核对卡片的指标、时间口径和数据权限。应用门户设计器上限 5 张。 |
| AI 对话入口 | `AIChatEntry` | `title`、`componentStyle`、`showIcon`、`colorMode`、`gradientFrom`、`gradientTo`、`solidColor`、`radius`、`motion`。按钮文案控制在 8 字内，从当前版本样式库选择外观。图谱生成后用受限账号核对回答和来源权限。 |
| 轮播图 | `CC_PortalCarouselView` | `titleConfig`、`styleConfig.zoomRule` 支持 `cover/contain` 等目标样式。静态项使用 `content`，每项有 `__sid`、`title`、`src` 及链接语义。动态配置通过目标设计器选择表单并回读 `dataConfig`，核对图片比例、链接和移动端裁切。 |
| 资讯列表 | `CC_PortalNewsListView` | `theme`、`titleConfig`、`dataType`、`dataConfig`、`content`。静态项含标题、摘要 `subTitle`、`image`、作者、日期及链接。动态来源用实际表单字段映射及筛选，配图不足时选文字布局。 |
| 公告栏 | `CC_PortalNoticeBoardView` | `titleConfig`、`theme`、`dataType`、`dataConfig`、`content`、`showBanner`、`banner`、`zoomRule`、配图 `link`。用少量有效公告核对日期排序、阅读入口及配图跳转。 |
| 快捷入口 | `CC_PortalQuickEntryView` | `theme`、`columnConfig.pcCount/mobileCount`、`titleConfig`、`groupConfig`、`content`。每个静态项用 `linkType` 区分应用、页面和 URL，分别提供真实 `app`、`page` 选择器对象或 `url`，再配标题、说明、图标和分组。桌面与手机分别核对列数和跳转目标。 |
| 待办指标 | `CC_PortalTodoIndicatorView` | `titleConfig`、`theme`、`backgroundImage`、`compConfig`。开关为 `taskTodo/taskCreated/taskDone/taskCopy`，保留实际 `dataSourceFrom` 和过滤条件。应用门户只有一张，对照真实待办计数。用 `portal catalog CC_PortalTodoIndicatorView` 查看 9 个外观。磁贴级 `"stylePreset":"transparentLight"` 选择「透明背景」，同时省略 `props.theme`；未配置背景时填入官方浅蓝图。用 `props.backgroundImage` 换图或传空串清空；切换其他样式保留已有背景。 |
| 待办清单 | `CC_PortalTodoListView` | `titleConfig`、`theme`、`compConfig`。可配置同一组状态、`taskCopyUnread`、过滤条件、`limit` 和 `displayFields`。应用门户只有一张，用同一账号核对数据、空态和详情跳转。 |
| 钉钉日程 | `CC_PortalTodoOverviewView` | `titleConfig` 与显示设备，组件读取当前访问者钉钉日程。应用门户只有一张，在已获日历访问的环境看日程、空态和下钻。 |

`titleConfig` 通常含 `showTitle/title/desc/showLink`，启用「查看更多」时复用当前物料的真实链接对象。标题、说明和静态项文案沿用 `{ "type":"i18n", "zh_CN":"…", "en_US":"…" }`。动态表单字段用真实 ID，字段映射、排序及筛选从已验证的同版本组件配置复制。组件样例数据仅是设计器占位，交付前换成目标应用内容。按所选组件能力使用 `displayDevice: "ALL" | "PC"`，命令同步其 `visibility`。

## 组件面板按场景显示的物料

以下物料在 `vc-deep-yida` 注册，OpenYida 可将其写入原生门户磁贴 Schema。验证目标门户加载对应组件，确认用户实际可见的数据。创建磁贴沿用平台账号权限和资源限制。

| 组件 | `componentName` | 配置与验收 |
| --- | --- | --- |
| 数据管理视图 | `DataManageViews` | `form` 含同应用 `appType`、普通/流程表单 `value`、`label`，可沿用真实实体的 `title/isNewForm`。内部呈现该表单可访问的数据管理视图，过滤表单视图。新增、导入、导出或批量操作以目标运行时与访问权限为准，按访问者角色检查实际按钮。常规应用门户按单实例配置。默认仅 PC，开启双端后实测表格与详情。 |
| 快捷访问卡片 | `QuickAccessCard` | 读取访问者的快捷访问列表。列表为空时平台会尝试用户可用应用。支持 `theme`、背景图、桌面/移动分栏、`showTitle/title/helpTip`、`enableGrouping`、`maxItems`、`viewMore`、`showAppDescription`、`enableCancelAccess`。单实例。 |
| 最近使用卡片 | `RecentlyUsedCard` | 读取访问者最近访问的应用。支持主题、背景图、双端分栏、标题、帮助提示、展示条数、查看更多、描述和 `enableQuickAccess`。与快捷访问搭配时用添加入口保留收藏动作，单实例。 |
| 快捷入口（原生物料） | `PortalQuickEntry` | 用 `content` 配明确的业务链接，`themeConfig` 控制图标与底色的样式，分组、标题和双端列数按原生物料配置。与官方目录的 `CC_PortalQuickEntryView` 使用不同组件标识，沿用目标门户已有配置契约。 |
| 顶部横幅 | `PortalTopBanner` | 使用 `bannerImage/mainTitle/subTitle` 形成全宽主题视觉区。确认桌面与手机文字对比度和图像裁切。 |

「我的应用」在宜搭导航中是页面入口。门户需要当前访问者的应用列表时，按任务选择快捷访问或最近使用；固定应用入口交给快捷入口。门户分组容器 `PortalTabs`、`PortalContainer` 可由模板或组合物料在内部创建，保存既有页面时保留结构。`TabsLayoutRgl` 的面板入口要求空间应用与组织灰度，选项卡、语雀和 Teambition 物料还可能有权益校验。

## 布局与应用主题

- `portal configure` 可单独保存页面级 `theme`，也可与 `tiles` 一起保存。页面背景独立于横幅和磁贴。先读取应用配色，再为门户选同色系的底色和浅纹理，保证内容区对比度。
- 在 `theme` 中用 `portalTheme:"diy"` 启用自定义样式，`chromatographer:"blue"` 选蓝色套色，`pageBackground:"color"` 与 `diyColor` 配底色。`topPcImg` 是图片对象，使用实际素材的 `type/name/value`，可提供 `mobile` 和 `fit`。透明纹理可用同色系 `bgLightColor/bgDarkColor` 衔接。按实际设计器和访问态确认。已有门户的未指定字段会保留。`follow` 表示报表跟随门户配色。

- 先确定访问者第一屏要判断什么、下一步去哪办事。只选有真实资源的磁贴，以主任务决定分区，磁贴清单不决定页面顺序。
- 桌面是 6 列。用 **6** 列放数据管理视图，**4+2** 放主任务与辅助信息，**3+3** 放同类应用列表，**2+2+2** 放同口径指标。业务门户有多个页面时，统一品牌强调色、卡片样式和背景纹理，可用同色系深浅区分页面。素材应服务于内容，首屏优先留给主要动作。
- RGL 会压缩纵向空位，自适应磁贴会按真实内容重算高度。不要靠空行留白，也别把两条快捷入口拉到待办列表高度。相同用途且内容相近的组件才等高。固定高度以 `portal catalog` 为准；表格验收是否能看到足够记录。数据卡片还有一层内部网格，单指标卡检查内部指标是否铺满，别只调外层磁贴。
- `layout: {"x":0,"y":0,"w":4,"h":13}` 的坐标从零开始，`h` 是网格单位。新增磁贴省略坐标会追加到底部，设计完整首页时应先规划每个分区的宽、高和起点。RGL 垂直尺寸随主题间距变化，使用实际工作台核对裁切、滚动和间距。
- 手机默认单列，顺序按桌面的 `y`、`x` 排。用顶层 `"mobileOrder":["entry","metrics","tasks"]` 将指定磁贴提前，接受本次配置的 `key` 或已有 `fieldId`。其余磁贴保持相对顺序；`"mobileOrder":"desktop"` 恢复按桌面坐标，PC 专用磁贴无需加入。回读 `mobileLayout` 并打开移动端预览。宽表可保留在 PC，手机用入口直达相应列表。
- 新版应用主题由 `isUseNewAppThemeStyle()` 决定。已有门户保留页面主题和单项自定义值。组件支持「跟随主题」时优先使用平台选项。新门户以应用品牌色作强调色，背景、表面、边距和圆角走平台主题变量；创建 CLI 保存磁贴时保留主题属性。用实际工作台确认 CSS 已加载，尤其是背景图、移动边距和卡片文字对比度。

- 应用启用 Pod Premium 时也按新版样式核对。使用 `--color-brand1-6` 作强调色，页面底色和背景图跟随 `--pod-page-bg-color`、`--pod-page-bg-image`，卡片底色和圆角跟随 `--pod-card-bg-color`、`--pod-card-border-radius`，移动端页边距跟随 `--pod-page-mobile-margin`。

### 两种常用搭配

- **办理型**。首行用 4 列快捷入口放两三个高频动作，右侧 2 列放一个有明确口径的实际指标。第二行用 6 列放明细。普通表单用本应用已发布的数据卡片和数据管理视图。确有流程任务时再用待办指标或清单。手机首屏优先保留登记和查记录入口，并点开检查是否分别到达表单与记录列表。
- **指南型**。顶部用一条紧凑入口直达业务页面，下方用 4 列文字资讯排操作步骤，2 列公告放访问提示或例外处理。步骤标题写动作，摘要写具体字段或按钮，链接落到对应的办理页面。文字列表有固定高度，验收最后一项是否能读到。
- 设备预览和实际访问态都要检查。桌面浏览器变窄或设计器切到手机时，布局可以变成单列，组件可见性仍可能按桌面环境计算。验收「仅 PC」磁贴用手机工作台或带移动端 User-Agent 的浏览器，并检查手机替代入口。
