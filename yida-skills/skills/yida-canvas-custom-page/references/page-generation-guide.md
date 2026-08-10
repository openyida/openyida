# Code Canvas 页面实现入口

完整应用的 Code Canvas 消费 `page-spec.json`、项目 Canvas 脚手架和真实资源 ID。`page-spec.json` 在 PRD 与 design.md 对齐后派生一次；项目脚手架在 design.md 生成后准备。单页任务没有这些派生产物时，才直接读取当前需求和设计上下文。

## 页面场景到实现入口

完整应用在设计对齐阶段读取一次 `prd.md + design.md`，生成当前页面的 `page-spec.json`。spec 包含业务区块、数据来源、主操作、移动端要求，以及当前页面实际使用的布局、层级、材质、圆角、密度、间距、组件和状态摘要。

页面实现阶段直接使用：

1. `.cache/openyida/<项目名>/scaffolds/canvas.canvas.jsx`；
2. 当前页面的 `page-spec.json`；
3. CLI 返回的真实 `appType/formUuid/fieldId`。

主题注入、ConfigProvider、表单抽屉和 iframe helper 已在项目脚手架中，页面实现阶段无需处理。

## Source Of Truth

`prd.md` 和 `design.md` 是事实源。`page-spec.json` 和项目脚手架是派生产物，不是新的设计事实源。

- `page-spec.json` 必须由当前 `prd.md + design.md` 派生，不允许凭空新增视觉规则、页面结构或业务功能。
- `page-spec.json` 只保存当前页面要执行的视觉摘要，不复制整份 design.md。主题 token、通用圆角和间距已写入项目脚手架；页面特有结构写入 `visualImplementation`。
- spec 必须包含 `sourceOfTruth.prdFile`、`sourceOfTruth.designFile`、`sourceOfTruth.designRefs` 和 `sourceOfTruth.conflictPolicy = "prd-design-win"`。
- spec 与 PRD/design.md 冲突时，以 PRD/design.md 为准，重新生成 spec；不要修改 PRD/design.md 来迎合旧 spec。
- 完整应用不跳过 `page-spec.json`。单页任务结构清楚时可以不生成 spec。

实现阶段不从 PRD 反推视觉，也不读取 `references/style-designs/`。页面结构和视觉值来自 `page-spec.json` 与项目脚手架。工作台、首页、门户、看板、展示页和业务入口页至少落地 10 个有业务目的的区块；KPI 子项、快捷入口子项和列表行不计入区块数量，不能用重复卡片或大空白凑数。

如果 `page-spec.json` 或项目脚手架缺少页面需要的视觉值，先回写 design.md，再重新生成 `design-runtime.json`、项目脚手架和受影响的 spec。不要在源码里猜值。

完整应用使用结构化路径：先派生 `page-spec.json`，再从项目脚手架扩展最终源码。单页任务结构明确时可以直接扩展标准脚手架。只有实现偏差才小范围修改源码。

实现工具会在 `.openyida-page.json` 中写入 `domainFidelity`，并在 CLI 输出中提示当前页面的业务化程度：

- `domain-ready`：主要业务语义已覆盖，可以作为真实业务页面继续校验和发布。
- `draft-needs-domain-spec`：用户已有业务要求，但 `page-spec.json` 仍缺业务对象、指标、交互或视觉方向；先补事实源，再重新派生 spec 和项目脚手架，不能用源码修改代替。

真实业务页的 `page-spec.json` 至少写清业务名称与定位、业务模块/对象、指标口径、用户动作或下钻方式、`sourceOfTruth`、`designFile`、`designRefs` 和 `themeSummary`；页面美感提升/页面重构写入 `functionContract`，保留现有数据源、字段映射、按钮动作、筛选逻辑、提交 URL、权限和业务状态；看板/列表/详情如果本轮已经创建或解析业务表单，写入 `dataBinding.mode=form`、真实 `appType/formUuid` 和字段映射，并读取 `yida-app` 通过 `yida-data-management` 写入的 1-3 条 seed records；seed 写入可与页面实现并行，页面先保留空态、刷新和登记入口；官网/品牌页写入 `assets` 或素材缺口。

`dataBinding.mode=form` 的页面实现必须读取 [data-bridge-guide.md](data-bridge-guide.md) 的表单数据契约。源码使用本地 `useYidaData(binding)` / `DataBridge`，默认调用发布层注入的 `window.__OPENYIDA_RUNTIME__.yida.searchFormDatas(params)`，兼容 `window.__OPENYIDA_YIDA_API__.searchFormDatas(params)`；只有 runtime 不可用时才降级同源直连 `/dingtalk/web/<appType>/v1/form/searchFormDatas.json`。生成器或手写页面如果没有 `dataBinding.mode=form`、真实 `appType/formUuid` 和字段映射，只能标记为未接真实表单数据。

完整应用从项目 `scaffolds/canvas.canvas.jsx` 扩展；单页任务从 `openyida sample yida-canvas-custom-page canvas` 输出的标准脚手架扩展。`FORM_UUIDS.<formKey>` 与 `FIELDS.<formKey>` 使用同一个表单键，并填写 `get-schema --field-map-json` 返回的完整 ID；发布前由 CLI 与线上 Schema 核对。13 个 Yida API、主题、表单容器、URL、实例校验和基础状态不按场景裁剪。

页面中的按钮、搜索框、快捷入口、可点击卡片和文字操作必须有真实动作。使用原生 `button`、Antd `Button`、`Input.Search`、`role="button"`、`hoverable` 或 `cursor:pointer` 时，必须绑定对应事件；暂未实现的操作使用禁用态或静态文本，不保留可点击外观。

## 修复路径

| 问题类型 | 必须修改哪里 | 不允许的做法 |
| --- | --- | --- |
| 页面目标、业务对象、指标口径、主操作、表单入口、数据来源、`contentBlocks`、空/载/错业务语义不足或错误 | 回写 `prd.md`，再重新派生 `page-spec.json` | 只在 `page-spec.json` 或源码里新增业务区块、指标和动作 |
| 主题关系、token、页面结构、材质、圆角、密度、间距、组件、状态或响应式规则不足或错误 | 回写 `design.md`，再生成 `design-runtime.json`、项目脚手架和 `page-spec.json` | 只在源码里临时写 CSS、主色、材质、圆角、密度或状态样式 |
| `page-spec.json` 缺少 `sourceOfTruth`、`designFile/designRefs`、`dataBinding` 字段，或与 `prd.md/design.md` 不一致 | 丢弃并从最新 `prd.md + design.md` 重新生成 `page-spec.json` | 修改 PRD/design.md 来迎合旧 spec，或把 design.md 的完整视觉规则复制进 spec |
| 已创建或解析业务表单，但页面源码没有 `dataBinding.mode=form`、没有 `useYidaData` / `DataBridge`，或没有优先消费 `window.__OPENYIDA_RUNTIME__.yida` / `window.__OPENYIDA_YIDA_API__` | 补齐 `page-spec.json` 的真实 `dataBinding`，读取 `data-bridge-guide.md` 后重新生成或小范围修复源码 | 默认手写 `/query/form/searchFormDatas.json` 或 `/v1/form/searchFormDatas.json` fetch，缺字段映射，或用前端 seedRows 冒充真实表单数据 |
| PRD、design.md、spec 和项目脚手架都完整，但源码存在 className、字段映射、响应式、loading/empty/error 或编译错误 | 小范围修改源码 | 借源码修改新增事实源未定义的页面区块、业务动作或视觉风格 |

源码修改过程中一旦发现需要新增业务区块、改页面目标、改主题关系或补视觉规则，停止修改，先回写 `prd.md` 或 `design.md`，再重新生成派生产物。

`page-spec.visualImplementation` 必须包含当前页的 `rootShell`、`prioritySurface`、`statusPrimitive`、`actionPrimitive`、`contentPrimitive`、`contextPrimitive`、`statePrimitive`、`responsiveRule`、`roundedRule`、`densityRule` 和 `breathingRule`。如果只有区块名称，先回写 design.md 并重新派生 spec。

页面要求玻璃感、质感、背景感、光影、流光、不规则顶部或丰富色彩时，消费 `page-spec.visualImplementation` 中的 `backgroundLayer`、`surfaceMaterial`、`colorRoles` 和 `depthRule`。近白画布必须用渐变、装饰、素材焦点或内容密度形成层次；动效必须提供 `prefers-reduced-motion` 静态降级。

实现页面背景和卡片时必须消费 `surfaceContrast`：页面背景与卡片背景不可相近或相同。白色/浅色背景配有边框卡片；浅灰背景（如 `#F3F4F6`）配白色无边框卡片；浅彩色背景配白色无边框卡片；渐变背景配玻璃感卡片。源码不得输出浅底白卡无边框、同色背景同色卡片，或只靠弱阴影区分层级。

实现背景层时先写根节点和伪元素，再写内容网格：`.oy-page-root` 承载基础底色、`::before` 承载不规则顶部色块或光洗、`::after` 承载低速流光或弱纹理，`.oy-page-content` 使用 `position: relative; z-index: 1;`。背景可以不规则，内容必须规则；标题、筛选、表格、图表、按钮和列表都保持稳定栅格、对齐和对比度。

数据真实性边界：

- 明确做离线预览时可以展示前端 seed 数据，但页面必须标注演示数据状态。
- 完整应用或真实交付页使用真实业务记录；默认把 1-3 条 demo records 写入真实宜搭表单，写入任务可与 Canvas 实现并行。
- 真实数据暂未接入或 seed records 写入失败时，页面应展示空态、表单入口、刷新/登记按钮和 dataBinding 接入提示。

| 已确认的页面场景 | 页面结构 | scene | 实现重点 |
| --- | --- | --- | --- |
| 官网首页、品牌官网、律所官网、茶叶官网、落地页、门户官网 | `official-homepage` | `landing` | 首屏叙事、可信视觉面板、服务矩阵、信任背书 |
| 数据大屏、实时监控、预警系统、指挥舱、态势屏 | `data-screen` | `screen` | 中心态势图、左右信息塔、趋势、排行、预警 |
| 数据看板、经营看板、管理驾驶舱 | `dashboard-overview`，复杂经营大屏切 `data-screen` | `dashboard` | KPI、图表、明细、排行、洞察 |
| 工作台、运营台、任务中心、业务首页 | `data-management` 或按 `page-spec.visualImplementation` 定义结构 | `workbench` | 入口、待办、状态、流程闭环，必须由 `contentBlocks` 驱动 |
| 列表、管理页、订单管理、客户列表、工单池 | `business-list` | `list` | 搜索筛选、表格、状态标签、详情抽屉 |
| 详情页、客户档案、订单详情、项目详情 | `detail-profile` | `detail` | 单对象摘要、章节、侧栏元信息、时间线 |
| 主从分栏、工单处理台、左列表右详情 | `split-pane-detail` | `list` | 左侧队列、右侧详情、时间线、动作区 |
| 页面内门户壳、多入口门户、隐藏导航门户 | `portal-shell-home` | `workbench` | 仅显式要求页面内门户壳、自绘导航或隐藏平台导航时使用；默认门户/工作台不自建导航 |

如果用户要求“门户组件 / 成员 / 部门 / 上传组件”，继续使用 Code Canvas，并按 [native-components-bridge.md](native-components-bridge.md) 的桥接规则实现。

默认实现保留平台应用导航，同应用内页面入口写入 `appBlueprint.navigation` 或平台导航分组。页面内 tab、自绘侧边栏或独立门户壳最多写 `appBlueprint.hasPageNavigation: true`，并保持平台导航可见；PRD 明确隐藏平台导航、无导航全屏体验或 `isRenderNav=false` 时，在 spec 里写 `appBlueprint.renderNav: false`；发布后再用 `openyida update-form-config <appType> <formUuid> false "<页面标题>"` 隐藏平台导航，保持页面单导航。

快捷入口目标是同应用内页面时，先把目标放入 `appBlueprint.navigation` / 平台导航分组，由应用导航内切换；默认工作台或门户内容区聚焦当前页动作、表单新建/查看、外部链接、跨应用资源，或用户显式隐藏平台导航后的页面内导航壳。表单新建/提交入口必须写清 `targetType: "submission"` 与 `openMode: "responsive-drawer"`；表单查看入口必须写清 `targetType: "detail"`、目标 `formUuid` 和真实 `formInstId` 来源。两类入口使用项目脚手架内置的 `FormOpenContainer`：桌面端侧边抽屉，移动端全屏抽屉；不要重新编写 iframe 主题同步。

## 官网与品牌页素材流程

实现 `official-homepage` 时，先读取 PRD 中的素材清单；缺少素材时按下方补齐素材清单。

强视觉品牌以 `page-spec.json` 的素材和视觉摘要为准。官网完成条件包括：场景 Hero、产品/服务、过程/空间三类素材，不同 section 的构图节奏，以及一个明确 CTA。

素材清单至少包含：

```json
{
  "assets": {
    "heroImage": "https://...",
    "heroImageAlt": "品牌主视觉",
    "productImages": [
      { "url": "https://...", "alt": "明星产品" }
    ]
  }
}
```

素材来源优先级：

1. 用户提供或已有官网图片。若有防盗链，优先用 `openyida cdn-upload` 转存。
2. AI 生成图片。先生成本地图片，再确认 CDN 配置，之后上传并回填 URL。
3. 公开图库。只使用可公开访问且通过 HTTP 200 校验的图片 URL；生产交付优先转存到自有 CDN。

若 `openyida cdn-config --show` 显示缺少 `accessKeyId/accessKeySecret/cdnDomain/ossBucket`，交付状态标为“素材待上传”；可先用已验证公开 URL 测试，或提示用户补 CDN 配置。

离线展示在无 CDN 时允许内嵌经过压缩的 JPEG/WebP data URI，保证源码原样发布也有真实图片；建议 3-5 张、单张不超过 250 KB、总量不超过 800 KB。生产页面使用稳定 CDN 素材 URL。

## 主题实现

完整应用的主题值已经写入项目脚手架，页面特有视觉写入 `page-spec.json`。页面重构或局部美化先以当前应用主题为基准；缺少主题证据时，回到设计阶段补齐，不固定使用 `podBlue` / #1677ff。

只有平台预置 key 才能传给应用 `theme/colour`。新建 Canvas 页面使用项目脚手架内置主题和 iframe 同步能力；只有维护缺少这些能力的旧源码时，才读取 `theme-runtime-helpers.md`。

`themeScope` 决定主题影响范围：

| 作用域 | 行为 | 何时使用 |
| --- | --- | --- |
| `page` | 只在当前页面根节点注入主题变量，不影响导航和其他页面 | 默认安全选择 |
| `app` | 页面加载时调用 `window.__YIDA__.updateShellConfig({ themeConfig })`，请求壳层一起换肤 | 需要左侧导航、顶部壳层和内容区统一 |

完整应用从 `page-spec.json` 读取业务边界和页面视觉摘要，从项目脚手架读取主题 token 与通用视觉默认值：

| 设计输入 | 实现方式 |
| --- | --- |
| 整个应用统一、全局换肤、系统整体主题、应用主题也改 | `themeScope: app` |
| 左侧导航/菜单/顶部壳层也一起变色，导航和内容区同色 | `themeScope: app` |
| 某个页面、首页、看板、自定义页变好看、页面重构或局部美化 | `themeScope: page`，主题基准为当前应用主题 |
| 保持导航不变、其他页面不变、只改当前页 | `themeScope: page` |

PRD 给出品牌色、色值、独立品牌/活动页诉求，或明确要求做成和当前应用很不一样时，Canvas 在页面作用域写入覆盖色。

## Page Spec 结构化字段

页面实现会读取结构化字段并写入 `.openyida-page.json` manifest，后续 AI 修改可以基于 manifest 更稳定地更新。manifest 和 `page-spec.json` 都是实现记录；当它们和 `prd.md/design.md` 冲突时，以 `prd.md/design.md` 为准。

| 字段 | 说明 | 默认 |
| --- | --- | --- |
| `researchLevel` | 官网/落地页调研深度：`none/light/enhanced/deep` | landing 默认 `light` |
| `sourceOfTruth` | `prdFile`、`designFile`、`designRefs`、`conflictPolicy` | 必填，来自当前项目 PRD 与 design.md |
| `appBlueprint` | 应用名、角色、导航分组、页面组合、壳形态 | 单页自动生成当前页 entry |
| `resourceBlueprint` | 完整应用的主页面、业务页面、普通表单、流程表单和报表资源 | 来自 `yida-prd` |
| `archetype` | 页面类型，如 `overview/analysis/monitor/profile` | 按 scene 推断 |
| `interactionProfile` | 主操作、详情方式、批量动作、空/载/错状态 | 按 scene 推断 |
| `functionContract` | 页面美感提升时保留的数据源、字段映射、按钮动作、筛选逻辑、提交 URL、权限、状态 | 现有页面契约 |
| `insights` | 看板/报告/工作台的数据洞察 | 无则空数组或场景默认洞察 |
| `designFile` | 当前项目设计契约路径 | 来自 `yida-design` |
| `designRefs` | 当前页面引用的 design.md 章节 ID | 来自 PRD 的 pageSpecHandoff |
| `themeSummary` | 应用主题色、风格关键词、themeScope 摘要 | 从 design.md 派生 |
| `visualImplementation` | 当前页布局、层级、材质、圆角、密度、间距、组件和状态摘要 | 从 design.md 的当前场景配方派生 |
| `contentBlocks` | 页面区块清单，工作台/首页/门户/看板/展示页/业务入口页不少于 10 个有业务目的的区块；KPI 组、快捷入口组、列表组各只算 1 个区块 | 来自 `yida-prd`；视觉结构补充来自 `yida-design` |
| `domainFidelity` | 实现后由 CLI 回填，标记业务化程度 | 无需手写 |

示例：

```json
{
  "sourceOfTruth": {
    "prdFile": "prd/渠道增长应用/prd.md",
    "designFile": "prd/渠道增长应用/design.md",
    "designRefs": ["themeProfile", "sceneRecipes.dashboard", "components.charts", "states.empty"],
    "conflictPolicy": "prd-design-win"
  },
  "pageStructure": "dashboard-overview",
  "scene": "dashboard",
  "designFile": "prd/渠道增长应用/design.md",
  "designRefs": ["themeProfile", "sceneRecipes.dashboard", "components.charts", "states.empty"],
  "themeSummary": {
    "themeColor": "青绿色应用主题",
    "styleKeywords": ["运营洞察", "轻量玻璃感", "高密信息"],
    "themeScope": "page"
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

工作台的状态摘要必须是 64-88px 圆润紧凑状态条，不是 180px 高的大白卡，也不是横跨整页但内容稀疏的空矩形；快捷入口必须有分组和主次，不能平铺成图标卡阵列；待办、动态、最近记录、洞察、提醒和右侧上下文至少组合成 10 个业务目的区块。空数据也用薄空态行 + 主操作入口，不渲染大块空白卡片。

展示型 Canvas 页面验收时检查 `contentBlocks` 或源码结构：工作台、首页、门户、看板、展示页和业务入口页至少有 10 个有业务目的的区块以上；每个区块承担不同任务，例如判断状态、发起动作、筛选、处理待办、查看动态、看洞察、看异常、进入详情、处理空态或补充上下文。若 PRD 只写“`KPI 卡片: 学生总数, 课程总数, 本月出勤率, 平均分`、`快捷入口: 录入学生/登记成绩/记录考勤/管理课程`、`最近成绩列表`、`最近考勤记录`”，实现前必须退回补齐 `contentBlocks`，因为这只构成 4 个聚合区块。

所有展示型页面都按 `page-spec.visualImplementation` 实现。缺少 `layoutRecipe`、`surfaceMap` 或 `componentRecipe` 时，先回写 design.md 并重新生成 spec：

1. 先把 `contentBlocks` 映射到 `layoutRecipe` 的槽位。
2. 按 `surfaceMap` 决定无框区、细线面板、浅底条、列表行、表格、右侧栏或抽屉，不能把所有区块都做成卡片。
3. 按 `sectionRhythm` 排序和控制间距，保证首屏有主次和至少两层信息。
4. 按 `roundedRule`、`densityRule` 和 `breathingRule` 写圆角、padding、gap、跨区块间距、列表行高、状态摘要高度、空态高度和贴边修正。
5. 按 `componentRecipe` 统一按钮、入口、标签、图标、列表、图表和空态。
6. 按源码 primitive 写组件：外层壳、首屏最大视觉锚点、状态摘要、动作条、主要内容、右侧上下文、状态处理和响应式规则都要落成真实 JSX/CSS。
7. 写完源码后逐条核对 `acceptanceChecks`，不通过就继续 patch。

所有 Canvas 页面都带控件样式护栏：`ConfigProvider.getPopupContainer` 让 Select / DatePicker 弹层留在页面作用域，`OPENYIDA_CANVAS_CONTROL_CSS` 统一输入框、下拉、日期、运行态字段组件的 hover / focus / dropdown 样式。出现黑色粗边、浏览器原生 outline、下拉浮层脱离页面风格时，优先检查这两项是否保留。
