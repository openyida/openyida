# 自定义页面实现入口

**MUST：先读实现规范再写页面。** 新建页面或调整视觉前，完整读取 [canvas-style-implementation-guide.md](canvas-style-implementation-guide.md)，并按 [编码前必读](../SKILL.md#编码前必读must) 记录本页规则与落点。卡片边界、导航画布和控件主题规则不能仅凭 design.md 或历史示例推断；生成器和手写路径都遵守这一前置条件。

使用 `YidaCodeCanvas` 组件实现的自定义页面消费 `yida-prd` 输出的 `prd.md` 与 `yida-design` 输出的 `design.md`，或单页 PRD 章节 + design spec，把页面场景、区块、主题、交互、数据绑定和素材清单实现成 `.canvas.jsx` / `.canvas.tsx`。

## 页面场景到实现入口

用户描述页面目标后，先读取 `yida-prd` 的 `prd/<项目名>/prd.md` 和 `yida-design` 的 `prd/<项目名>/design.md`，或单页 PRD 章节和对应 design spec。PRD 用来确认页面场景、区块、数据来源、主操作和移动端要求；design.md 用来确认主题色、页面风格、视觉 DNA、布局配方、材质、圆角、密度、呼吸感、组件和状态规则。实现时按下表选择页面结构；页面结构、数据桥和样式细节已经明确时，直接手写 `.canvas.jsx`。

结构化实现工具提供可编译运行时结构、数据桥、主题变量和基础 primitives。真实业务页结合 `prd.md` 落地业务化区块顺序、数据和文案，结合 `design.md` 落地信息层级、局部构图和样式节奏。

PRD 写有 `pageSpecHandoff` 时，可以把 `pageSpecHandoff` 转成 `page-spec.json`；其中 `entryMode`、`navigation`（只作用于当前入口）、`pageStructure`、`scene`、`contentBlocks`、`themeSummary`、`designFile`、`designRefs`、`dataBinding` 和 `primaryAction` 是页面实现的业务输入。随后读取 `designFile`：用 `designRefs` 查 frontmatter 的场景、组件和状态索引，再按显式 anchor 找到当前页八项设计与共享规则。格式见 [design.md 公共输出契约](../../yida-design/workflow/output-design.md)；索引不是规则正文，不能只读元数据就实现。

平台导航管理页默认生成纯业务内容，跨模块菜单由平台负责；不要从 `entryRecommendation.menu` 再生成页面侧栏或模块 Tabs。Plan 的 `pages[].navigationPolicy` 与 `pageSpecHandoff` 一并作为实现上下文，Fast 同样记录导航归属；详见[管理页面边界](navigation-and-entry-guide.md#平台导航下的管理页面)。

## Source Of Truth

业务按 `prd.md` 实现，视觉按 `design.md` 实现。手写页面可直接使用这两份文件；使用生成器时，先整理 `page-spec.json`：

- 业务字段来自当前 PRD。
- 视觉部分保存 `designFile/designRefs` 和一致的 `themeSummary`，完整视觉规则从 design.md 读取。
- `sourceOfTruth` 填写 `prdFile`、`designFile`、`designRefs` 和 `conflictPolicy = "prd-design-win"`。
- spec 与 PRD/design.md 冲突时，按这两份文件重新生成 spec。

按页面任务组织内容：工作台通常包含状态摘要、高频动作、待办、动态和上下文信息；列表页通常包含搜索筛选、列表或表格、详情预览，以及空态和错误时的下一步操作。工作台、首页、门户、看板和展示页推荐 8-10 个有业务目的的区块，窄场景或精简需求按实际任务减少。KPI 子项、快捷入口子项和列表行计入各自所属区块。

如果当前页面正文没有具体布局、表面与组件、状态、响应式或验收安排，先补设计事实再实现。圆角、padding、gap 和密度采用选中主题与当前页决定，不能用固定大圆角或统一间距覆盖主题。状态、列表、动作与空态按真实内容组织，不用空白容器撑满首屏。

页面实现路径二选一：结构化实现路径先从 `prd.md + design.md` 派生业务化 `page-spec.json` 并生成可编译骨架，之后读取 CLI 摘要或 `.openyida-page.json`。若发现业务或视觉事实源缺失，先回写 `prd.md` / `design.md` 并重生成 spec；只有实现偏差才对生成源码做小范围 Edit/patch。手写路径直接 Write 最终 `.canvas.jsx`。

实现工具会在 `.openyida-page.json` 中写入 `domainFidelity`，并在 CLI 输出中提示当前页面的业务化程度：

- `domain-ready`：主要业务语义已覆盖，可以作为真实业务页面继续校验和发布。
- `draft-needs-domain-spec`：用户已有业务要求，但 `page-spec.json` 仍缺业务对象、指标、交互或视觉方向；先按下方修复路径补 `prd.md` / `design.md`，再重新派生 spec，不能直接用源码 patch 代替事实源。

真实业务页的 `page-spec.json` 至少写清业务名称与定位、业务模块/对象、指标口径、用户动作或下钻方式、`sourceOfTruth`、`designFile`、`designRefs` 和 `themeSummary`；页面美感提升/页面重构写入 `functionContract`，保留现有数据源、字段映射、按钮动作、筛选逻辑、提交 URL、权限和业务状态；看板/列表/详情如果本轮已经创建或解析业务表单，写入 `dataBinding.mode=form`、真实 `appType/formUuid` 和字段映射，并默认读取 `yida-app` 通过 `yida-data-management` 写入的 1-3 条 seed records；官网/品牌页写入 `assets` 或素材缺口。

`dataBinding.mode=form` 的页面实现必须读取 [data-bridge-guide.md](data-bridge-guide.md) 的表单数据契约。源码使用本地 `useYidaData(binding)` / `DataBridge`，默认调用发布层注入的 `window.__OPENYIDA_YIDA_API__.searchFormDatas(params)`；根级 `toast`、`router.push`、`openPage` 等工具通过 `window.__OPENYIDA_UTILS__` 访问。只有桥不可用时才降级同源直连 `/dingtalk/web/<appType>/v1/form/searchFormDatas.json`。生成器或手写页面如果没有 `dataBinding.mode=form`、真实 `appType/formUuid` 和字段映射，只能标记为未接真实表单数据。

## 修复路径

| 问题类型 | 必须修改哪里 | 不允许的做法 |
| --- | --- | --- |
| 页面目标、业务对象、指标口径、主操作、表单入口、数据来源、`contentBlocks`、空/载/错业务语义不足或错误 | 回写 `prd.md`，再重新派生 `page-spec.json` | 只在 `page-spec.json` 或源码里新增业务区块、指标和动作 |
| 主题关系、token、页面布局、表面层次、色彩角色、形状、密度、组件状态或响应式不足或错误 | 回写 `design.md`，再重新派生 `page-spec.json` 或重读 design.md 实现 | 只在源码里临时写 CSS、主色、玻璃感、卡片材质、圆角、密度、呼吸感或状态样式 |
| `page-spec.json` 缺少 `sourceOfTruth`、`designFile/designRefs`、`dataBinding` 字段，或与 `prd.md/design.md` 不一致 | 丢弃并从最新 `prd.md + design.md` 重新生成 `page-spec.json` | 修改 PRD/design.md 来迎合旧 spec，或把 design.md 的完整视觉规则复制进 spec |
| 已创建或解析业务表单，但页面源码没有 `dataBinding.mode=form`、没有 `useYidaData` / `DataBridge`，或没有优先消费 `window.__OPENYIDA_YIDA_API__` | 补齐 `page-spec.json` 的真实 `dataBinding`，读取 `data-bridge-guide.md` 后重新生成或小范围修复源码 | 默认手写 `/query/form/searchFormDatas.json` 或 `/v1/form/searchFormDatas.json` fetch，缺字段映射，或用前端 seedRows 冒充真实表单数据 |
| PRD、design.md 和 spec 都完整，但生成源码存在 className、布局比例、字段映射、响应式、loading/empty/error 渲染、编译错误等实现偏差 | 小范围 Edit/patch 源码 | 借源码 patch 新增 PRD 未定义的页面区块、业务动作或 design.md 未定义的视觉风格 |

源码 patch 过程中一旦发现需要新增业务区块、改页面目标、改主题关系或补视觉规则，停止 patch，先回写 `prd.md` 或 `design.md`，再重新派生 spec 或重读两份事实源实现。

设计内容直接映射到源码：外壳、首屏焦点、主要内容、动作、必要上下文、状态反馈与响应式都应有实现位置。`design.md` 的页面正文覆盖这些含义即可，不要求旧 `visualScaffold` 或同名 primitive 字段；没有真实内容的可选侧栏、指标或图形不渲染。

玻璃、光影、纹理、流光与不规则背景只在已确认设计需要时实现。玻璃明确半透明表面、边框、背景关系和 `backdrop-filter`；光洗不能干扰阅读，流光提供 `prefers-reduced-motion` 静态降级。背景可以自由，内容仍保持栅格、对齐、行高与操作位置稳定；平整画布主题不为“高级感”额外添加装饰。

画布、内容面与边界按设计正文和 token 实现。同色画布与卡片可以通过细边界、共容器或留白建立层次；灰底不必统一无边框，渐变不强制搭配玻璃。验收看是否还原当前主题，不用另一套统一材质或尺寸规则覆盖它。

按 design.md 第 2 章已合并的项目配色和导航规则实现，不从模板重新推导另一套默认值；整体绿色风格不能只让按钮变绿。卡片背景使用 `var(--pod-card-bg-color, var(--color-white, #fff))`，边界消费 `--pod-card-border`；页面、卡片、导航、表头、文字与控件一并核对。antd 页面通过主题脚本统一映射主色、容器、文字、填充和边框；语义色暂用 antd 默认值，不能把所有状态改成品牌色。

设计需要背景装饰层时，先写根节点和伪元素，再写内容网格：`.oy-page-root` 承载基础底色、`::before` 承载不规则顶部色块或光洗、`::after` 承载低速流光或弱纹理，`.oy-page-content` 使用 `position: relative; z-index: 1;`。背景可以不规则，内容必须规则；标题、筛选、表格、图表、按钮和列表都保持稳定栅格、对齐和对比度。

数据真实性边界：

- 明确做离线预览时可以展示前端 seed 数据，但页面必须标注演示数据状态。
- 完整应用或真实交付页使用真实业务记录；默认先把 1-3 条 demo records 写入真实宜搭表单，再由页面读取。
- 真实数据暂未接入或 seed records 写入失败时，页面应展示空态、表单入口、刷新/登记按钮和 dataBinding 接入提示。

| 已确认的页面场景 | 页面结构 | scene | 实现重点 |
| --- | --- | --- | --- |
| 官网首页、品牌官网、律所官网、茶叶官网、落地页、门户官网 | `official-homepage` | `landing` | 首屏叙事、可信视觉面板、服务矩阵、信任背书 |
| 数据大屏、实时监控、预警系统、指挥舱、态势屏 | `data-screen` | `screen` | 中心态势图、左右信息塔、趋势、排行、预警 |
| 数据看板、经营看板、管理驾驶舱 | `dashboard-overview`，复杂经营大屏切 `data-screen` | `dashboard` | KPI、图表、明细、排行、洞察 |
| 工作台、运营台、任务中心、业务首页 | `data-management` 或按 `design.md` 自定义结构 | `workbench` | 入口、待办、状态、流程闭环，必须由 `contentBlocks` 驱动 |
| 列表、管理页、订单管理、客户列表、工单池 | `business-list` | `list` | 搜索筛选、表格、状态标签、详情抽屉 |
| 详情页、客户档案、订单详情、项目详情 | `detail-profile` | `detail` | 单对象摘要、章节、侧栏元信息、时间线 |
| 主从分栏、工单处理台、左列表右详情 | `split-pane-detail` | `list` | 左侧队列、右侧详情、时间线、动作区 |
| 页面内门户壳、多入口门户、隐藏应用导航门户 | `portal-shell-home` | `workbench` | 仅显式要求页面内门户壳、自绘顶部/侧边导航或隐藏应用导航时使用；默认门户/工作台不自建导航 |

如果用户要求“门户组件 / 成员 / 部门 / 上传组件”，继续使用本技能，并按 [native-components-bridge.md](native-components-bridge.md) 的桥接规则用 `YidaCodeCanvas` 组件实现。

### 导航生成规则

先读应用 navigationType 和当前页 pageSpecHandoff。前台 standalone + navigation.custom 只自绘当前入口菜单，不修改 appBlueprint.hideAppNav；后台继续使用平台导航。前后台页面内普通表单提交与详情均接入 CLI 的 `form-open-container` 模板；全码开发不豁免，不另写填写提交 UI。查询、筛选和展示继续按页面设计实现。

自定义导航按 PRD 和 `design.md` 直接实现；参考 [导航壳形态目录](../../yida-nav-shell/references/nav-shell-patterns.md) 的场景与骨架，UI 示例按需查阅。连续展示页使用共同首屏画布与页面滚动，业务工作区保留导航占位和剩余高度；侧边及混合布局支持折叠、恢复宽度和拖拽调宽。菜单同时记录入口用途和打开方式：管理走 workbench，填写走 submission；本页视图切状态，保留导航的表单入口更新主内容 iframe，同标签跨页仅用于已确认承载同一导航壳的目标。页面内新增/详情按钮沿用 FormOpenContainer，切换与返回按 [页面与导航连续性](../../yida-design/references/page-continuity.md) 保留上下文。

完整地址通过数据桥使用 `router.push(href, params, false, true)`；省略 URL 模式的自动识别只作兼容，详见 [路由模式与数据桥兜底](../../yida-nav-shell/references/nav-shell-patterns.md#路由模式与数据桥兜底)。导航显示参数不控制是否新开标签。

| 场景 | spec 字段 | 发布后动作 |
| --- | --- | --- |
| 普通自定义页、工作台、门户、看板、首页 | 不写 `hideAppNav` | 保留平台应用导航 |
| 页面内 tab、分段筛选、内容区快捷入口 | 不写 `hideAppNav` | 保留平台应用导航 |
| 整个应用的顶部导航、侧边导航、导航壳、自绘应用级导航 | 写 `appBlueprint.hideAppNav: 'y'` | 执行 `openyida update-app <appType> --hide-app-nav` |
| 独立前台菜单、页面隐藏导航、无导航全屏、`isRenderNav=false` | 写 `appBlueprint.renderNav: false` | 执行 `openyida update-form-config <appType> <formUuid> false "<页面标题>"` |

两条规则必须分开：`hideAppNav` 控制应用导航，`renderNav/isRenderNav=false` 控制页面导航。其他自定义页默认不调用 `update-app --hide-app-nav`。

### 快捷入口生成规则

| 入口目标 | spec 写法 | 页面实现 |
| --- | --- | --- |
| 同应用内页面 | 放入 `appBlueprint.navigation` / 平台导航分组 | 由应用导航内切换 |
| 当前页动作、外部链接、跨应用资源 | 写当前页快捷入口 | 留在自定义页内容区 |
| 表单新建/提交 | `targetType: "submission"` + `openMode: "responsive-drawer"` | PC 用 `FormOpenContainer` 右侧抽屉 iframe，URL 带 `isRenderNav=false` |
| 表单查看详情 | `targetType: "detail"` + 目标 `formUuid` + 真实 `formInstId` 来源 | PC 用同一套抽屉宽度，详情 URL 带 `navConfig.layout=1180&isRenderNav=false` |

表单提交/详情里的 `isRenderNav=false` 只隐藏原生表单页或详情页的页面导航，不用于隐藏自定义页应用导航。

## 官网与品牌页素材

按 `design.md.assetStrategy` 调用 `yida-image-assets`。读取当前页的 `asset-manifests/<pageId>.json`（已有项目可用总清单 `asset-manifest.json`）中 `pages[].materialStatus`；当前页为 `final` 时，只读取该页 `assets[].materialStatus=final` 的图片 URL。总状态为 `draft` 不阻塞已就绪的页面；不手拼 URL，也不内嵌 data URI。

联网搜图仅使用 Unsplash/Pexels。Unsplash 保留 API 热链和署名；Pexels 保留来源页和摄影师信息。

## 主题实现

antd 页面按 [CanvasThemeProvider 指南](canvas-theme-provider.md) 统一接入主题。已有 Provider 或直接合并 Provider 的页面编译发布原文件；仅使用标记和主题脚本时，才编译发布生成的 `.themed.canvas.jsx`。纯 DOM 页面直接使用应用 CSS 变量。

主题色决策来自 `yida-design` 的 `design.md`。`app-theme.css` 只在应用级配置，由平台统一作用于整个应用。

`page-spec.json` 只保存与 `design.md` 一致的主题摘要。自定义页面只在 `YidaComp` 内消费当前应用的 `--color-brand1-*`、`--color-group` 和 `--pod-*`，不向上层写入或同步主题样式。

从 PRD 或派生的 `page-spec.json` 读取业务边界，从 design.md 读取应用主题 token 与视觉执行规则。全局换肤、导航与内容统一换色或新品牌色都通过应用主题 CSS、`themeColor` 和 `navTheme` 配置；单页美化沿用该应用主题并调整页面结构和视觉语言。

## Page Spec 结构化字段

页面实现会读取结构化字段并写入 `.openyida-page.json` manifest，后续 AI 修改可以基于 manifest 更稳定地更新。manifest 和 `page-spec.json` 都是实现记录；当它们和 `prd.md/design.md` 冲突时，以 `prd.md/design.md` 为准。

| 字段 | 说明 | 默认 |
| --- | --- | --- |
| `researchLevel` | 官网/落地页调研深度：`none/light/enhanced/deep` | landing 默认 `light` |
| `sourceOfTruth` | `prdFile`、`designFile`、`designRefs`、`conflictPolicy` | 必填，来自当前项目 PRD 与 design.md |
| `appBlueprint` | 应用名、角色、导航分组、页面组合、壳形态 | 单页自动生成当前页 entry |
| `resourceBlueprint` | 完整应用的主页面、业务页面、普通表单、流程表单和报表资源 | 来自 `yida-design` |
| `archetype` | 页面类型，如 `overview/analysis/monitor/profile` | 按 scene 推断 |
| `interactionProfile` | 主操作、详情方式、批量动作、空/载/错状态 | 按 scene 推断 |
| `functionContract` | 页面美感提升时保留的数据源、字段映射、按钮动作、筛选逻辑、提交 URL、权限、状态 | 现有页面契约 |
| `insights` | 看板/报告/工作台的数据洞察 | 无则空数组或场景默认洞察 |
| `designFile` | 当前项目设计契约路径 | 来自 `yida-design` Step 5 |
| `designRefs` | 当前页面引用的 design.md 章节 ID | 来自 PRD 的 pageSpecHandoff |
| `themeSummary` | 应用主题色、风格关键词、主题交付方式摘要 | 来自 PRD 摘要，必须与 design.md 一致 |
| `contentBlocks` | 页面区块清单，工作台/首页/门户/看板/展示页/业务入口页推荐 8-10 个有业务目的的区块以上，但不作为硬门槛；KPI 组、快捷入口组、列表组各只算 1 个区块 | 来自 `yida-design` Step 4 |
| `domainFidelity` | 实现后由 CLI 回填，标记业务化程度 | 无需手写 |

示例：

```json
{
  "sourceOfTruth": {
    "prdFile": "prd/渠道增长应用/prd.md",
    "designFile": "prd/渠道增长应用/design.md",
    "designRefs": ["themeProfile", "sceneRecipes.dashboard", "components.chart", "states.empty"],
    "conflictPolicy": "prd-design-win"
  },
  "pageStructure": "dashboard-overview",
  "scene": "dashboard",
  "designFile": "prd/渠道增长应用/design.md",
  "designRefs": ["themeProfile", "sceneRecipes.dashboard", "components.chart", "states.empty"],
  "themeSummary": {
    "themeColor": "青绿色应用主题",
    "styleKeywords": ["运营洞察", "轻量玻璃感", "高密信息"]
  },
  "researchLevel": "none",
  "archetype": "analysis",
  "appBlueprint": {
    "appName": "渠道增长应用",
    "shell": "side_nav",
    "renderNav": false,
    "roles": ["运营", "经销商"],
    "navigation": ["品牌展示", "经营看板"],
    "pages": [
      { "name": "品牌官网首页", "scene": "landing", "pageStructure": "official-homepage" },
      { "name": "经营看板", "scene": "dashboard", "pageStructure": "dashboard-overview" }
    ]
  },
  "interactionProfile": {
    "primaryAction": "查看本周经营",
    "detailMode": "drawer",
    "submitMode": "responsive-drawer",
    "bulkActions": ["导出巡店建议"],
    "states": ["empty", "loading", "error"]
  },
  "insights": [
    { "conclusion": "华东区贡献 43%", "evidence": "环比 +5.2pp", "suggestion": "优先补货高增长门店" }
  ]
}
```

## 页面 primitives 验收

实现后至少确认源码包含对应场景的 primitive class，并且本地编译通过。

| 页面结构 | 内置 UI primitives |
| --- | --- |
| `dashboard-overview` | KPI、Chart panel、Rank list、Insight callout、Freshness badge |
| `business-list` | Filter bar、Table state badge、Bulk action bar、Detail preview |
| `detail-profile` | Object hero、Meta stack、Timeline primitive、Insight callout |
| `split-pane-detail` | Split queue、Filter bar、Detail pane、Timeline card、Insight card |
| `portal-shell-home` | Portal nav、Hero panel、Entry card、Dynamic card、Update feed |
| `official-homepage` | Real-scene hero、Product/service visual、Process/space story、Visit/service section、CTA |
| `data-screen` | Command map、Metric grid、Rank panel、Screen insight header |

工作台状态摘要按主题保持紧凑，未定义时可参考 64-88px；不使用横跨整页但内容稀疏的空矩形；快捷入口必须有分组和主次，不能平铺成图标卡阵列；待办、动态、最近记录、洞察、提醒和右侧上下文推荐组合成 8-10 个业务目的区块以上，但不作为硬门槛。空数据也用薄空态行 + 主操作入口，不渲染大块空白卡片。

展示型自定义页面验收时检查 `contentBlocks` 或源码结构：工作台、首页、门户、看板、展示页和业务入口页应有足够多有业务目的的区块；每个区块承担不同任务，例如判断状态、发起动作、筛选、处理待办、查看动态、看洞察、看异常、进入详情、处理空态或补充上下文。区块数量不作为阻塞实现的硬门槛。若 PRD 只写“`KPI 卡片: 学生总数, 课程总数, 本月出勤率, 平均分`、`快捷入口: 录入学生/登记成绩/记录考勤/管理课程`、`最近成绩列表`、`最近考勤记录`”，实现前建议补充 `contentBlocks`；若业务确实是窄场景，可以继续实现并说明取舍。

所有展示型页面都按当前项目 `design.md` 的页面八项要点与共享规则实现。若只有业务区块和视觉形容词，没有实际布局、表面、组件和响应式决定，先补设计源事实：

1. 按当前页正文中的布局安排放置真实 `contentBlocks`，不从主题示例补造业务内容。
2. 按表面与组件说明选择开放区、连续行、表格或必要容器，并引用对应共享组件 anchor。
3. 用主题 token 与明确的局部数值实现间距、圆角和层次，保持首屏焦点与内容主次。
4. 按主操作、状态与响应式说明实现动作、反馈、恢复入口及窄屏重排。
5. 将实际页面八项验收逐条对应源码和截图；实现偏差局部修正，设计事实变化先更新源事实。

整页刷新时，表格加载遮罩可能因 `transition: all` 遇到延迟加载的基础样式而闪出黑边。标准 Provider 已将遮罩边框固定为零，只保留透明度过渡；保留内置 style，旧页面按 [主题接入步骤](canvas-theme-provider.md) 更新 Provider 并重新发布，不通过修改主题色或全局清除边框处理。

其他控件默认保留组件库样式，仅在实际受到宿主样式干扰时修正：需要局部浮层样式时，通过 `CanvasThemeProvider.getPopupContainer` 选择不会裁剪弹层的容器，`OPENYIDA_CANVAS_CONTROL_CSS` 统一输入框、下拉、日期、运行态字段组件的 hover / focus / dropdown 样式。控件焦点边框或下拉浮层不符合设计时，先检查主题与挂载位置，再按样式指南局部调整，保留可见的键盘焦点。
