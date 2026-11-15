# 原生门户组件与磁贴布局

## 读、配、验

1. 明确门户所在应用、使用人、第一屏任务及现有数据资源。已有原生门户先读回，缺少门户时用 `create-page --mode portal` 创建。目标应用的实际主题通过主题设置或 `app-theme snapshot` 读取。
2. 运行 `openyida portal inspect <appType> <formUuid> --json`。记录 `revision`、现有 `fieldId`、布局、主题及使用中的物料。组件目录取决于当前应用场景、组织灰度和可用物料。已保存的门户样例可提供目标组织的真实实体选择器、动态数据源、链接和主题对象。
3. 编写 `{"tiles":[...]}` JSON。每个磁贴填写稳定的 `key`、准确的 `componentName`、需要写入的 `props`、可选的 `layout`。修改设计器创建的磁贴时传回读得到的 `fieldId` 并保持组件类型，避免添加重复节点。保留原 `key` 可安全重跑同一配置。
4. 用 `openyida portal configure <appType> <formUuid> portal.json --dry-run --json` 查看预计配置，再执行 `openyida portal configure <appType> <formUuid> portal.json --expected-revision <revision> --json`。版本冲突时重新 inspect，按最新布局重做变更。保存后使用设计器预览和工作台核对真实渲染、权限、链接及移动端顺序。
5. 按门户设计器的页面发布流程核对访问范围。对外分享或配置播报是独立操作。AI 对话入口依赖业务关系图谱。设计器首次保存可能提示生成图谱，生成中访问态可暂时隐藏入口，验收需等可用后再做。

## 线上官方目录

以下组件曾在应用门户的官方目录加入画布并读到保存的 Schema。运行时名称是底层组件标识，右侧面板文案可能随物料版本和组织变化。

| 组件 | `componentName` | 配置与验收 |
| --- | --- | --- |
| 数据卡片 | `DataCard` | 先在同一应用准备并发布实际卡片，从门户卡片选择器或现有节点确认 `cardId`。将 `colorMode` 设为 `brand` 跟随门户主题，`default` 使用默认样式。打开工作台核对卡片的指标、时间口径和数据权限。应用门户设计器上限 5 张。 |
| AI 对话入口 | `AIChatEntry` | `title`、`componentStyle`、`showIcon`、`colorMode`、`gradientFrom`、`gradientTo`、`solidColor`、`radius`、`motion`。按钮文案控制在 8 字内，从当前版本样式库选择外观。图谱生成后用受限账号核对回答和来源权限。 |
| 轮播图 | `CC_PortalCarouselView` | `titleConfig`、`styleConfig.zoomRule` 支持 `cover/contain` 等目标样式。静态项使用 `content`，每项有 `__sid`、`title`、`src` 及链接语义。动态配置通过目标设计器选择表单并回读 `dataConfig`，核对图片比例、链接和移动端裁切。 |
| 资讯列表 | `CC_PortalNewsListView` | `theme`、`titleConfig`、`dataType`、`dataConfig`、`content`。静态项含标题、摘要 `subTitle`、`image`、作者、日期及链接。动态来源用实际表单字段映射及筛选，配图不足时选文字布局。 |
| 公告栏 | `CC_PortalNoticeBoardView` | `titleConfig`、`theme`、`dataType`、`dataConfig`、`content`、`showBanner`、`banner`、`zoomRule`、配图 `link`。用少量有效公告核对日期排序、阅读入口及配图跳转。 |
| 快捷入口 | `CC_PortalQuickEntryView` | `theme`、`columnConfig.pcCount/mobileCount`、`titleConfig`、`groupConfig`、`content`。每个静态项用 `linkType` 区分应用、页面和 URL，分别提供真实 `app`、`page` 选择器对象或 `url`，再配标题、说明、图标和分组。桌面与手机分别核对列数和跳转目标。 |
| 待办指标 | `CC_PortalTodoIndicatorView` | `titleConfig`、`theme`、`backgroundImage`、`compConfig`。开关为 `taskTodo/taskCreated/taskDone/taskCopy`，保留实际 `dataSourceFrom` 和过滤条件。应用门户只有一张，对照真实待办计数。 |
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

「我的应用」在宜搭导航中是页面入口。门户需要当前访问者的应用列表时，按任务选择快捷访问或最近使用；固定应用入口交给快捷入口。门户分组容器 `PortalTabs`、`PortalContainer` 可由模板或组合物料在内部创建，保存既有页面时保留结构。组织门户的分组布局 `TabsLayoutRgl` 取决于组织和灰度。

## 布局与应用主题

- 先把首屏任务按「看状态 → 找入口 → 处理事项」排序。运营门户优先将一排指标放在主趋势上方，主趋势或待办清单占 4 列，放在旁边的异常公告、待办指标或日程占 2 列。跨业务工作台可用全宽快捷入口，下面用 4 列常用应用配 2 列近期信息。数据管理视图和长表独占一整行。
- 形态保持一致的磁贴可以并排，例如同口径 KPI 三张各 2 列，或者两个简短应用清单各 3 列。每段只选一种主视觉。公告与资讯服务不同信息时再并存，避免让轮播、横幅和公告重复抢占首屏。
- 磁贴网格为 6 列，`layout: { "x": 0, "y": 0, "w": 4, "h": 13 }`。`x/y` 从零开始，`h` 为网格单位。一个磁贴的 `fieldId` 只对应一个网格位置。省略坐标时，新增磁贴从底部开始；用明确的坐标表达并排关系，不压住其他磁贴。AI 对话、资讯列表和待办清单使用各自的固定高度，其余磁贴按内容和实际物料调整。内容自适应的左右磁贴可能压缩到不同的垂直位置；需要等高时，可在支持的组件上关闭 `isHeightAuto` 并使用相同 `h`，再检查空态与长内容。
- 移动端预览从上至下检查主指标、任务及入口。依赖桌面宽度的数据视图可以仅在 PC 显示，手机保留可访问的详情或列表入口。PC 的并排关系与手机的阅读顺序分别核对，保持同一页面主题体系。
- 新版应用主题由 `isUseNewAppThemeStyle()` 决定。已有门户保留页面主题和单项自定义值。组件支持「跟随主题」时优先使用平台选项。新门户以应用品牌色作强调色，背景、表面、边距和圆角走平台主题变量；创建 CLI 保存磁贴时保留主题属性。用实际工作台确认 CSS 已加载，尤其是背景图、移动边距和卡片文字对比度。
