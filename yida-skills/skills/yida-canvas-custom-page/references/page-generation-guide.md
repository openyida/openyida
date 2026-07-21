# Code Canvas 页面生成与视觉路由指南

本文承载 `yida-canvas-custom-page` 的页面类型路由、主题作用域、官网素材流程和 Page Spec 字段说明。SKILL.md 只保留摘要和命令入口。

## 首次生成模板路由

用户通常不会直接说模板名，Agent 需要按自然语言选择模板。

`generate-page` 的模板只用于选定运行时契约、数据桥、主题变量和首版 primitives；它不是最终视觉稿。生成真实页面时，必须结合 `yida-page-uiux` 的视觉方向决策块重写区块顺序、信息层级、局部构图、文案和样式节奏。可以保留模板的编译安全结构和必要 primitive class，但不要照搬默认 Hero、卡片网格、三段式卖点或库存文案。

生成器会在 `.openyida-page.json` 中写入 `domainFidelity`，并在 CLI 输出中提示当前页面是否还依赖 sample fallback：

- `domain-ready`：主要业务语义已覆盖，sample 只剩编译骨架。
- `draft-needs-domain-spec`：用户已有业务要求，但 page spec 仍缺业务对象、指标、交互或视觉方向；继续补 spec 或改源码。
- `sample-reference`：基本没有业务化输入，结果只能当 sample 参考，不能交付为真实应用页面。

真实业务页的 `page-spec.json` 不能只写 `template/title/output`。至少写清业务名称与定位、业务模块/对象、指标口径、用户动作或下钻方式、视觉方向；看板/列表/详情如果本轮已经创建或解析业务表单，必须写 `dataBinding.mode=form`、真实 `appType/formUuid` 和字段映射，官网/品牌页优先写 `assets` 或素材缺口。`sample` 是例子，不是框架；如果 `domainFidelity.sampleFallbacks` 里还出现 `features`、`metrics`、`roadmap`、`heroText` 等关键项，必须继续定制。

数据真实性边界：

- `openyida sample` 或模板原样发布可以展示 sample/seed 数据，但页面必须标注 sample/seed。
- 完整应用或真实交付页不能用前端 seedRows 冒充业务记录；需要演示数据时，先把 demo/mock records 写入真实宜搭表单，再由 Canvas 读取。
- 未写入 demo records 且没有真实数据时，页面应展示空态、表单入口、刷新/登记按钮和 dataBinding 接入提示。

| 用户需求 | CLI 模板 | scene | 视觉要点 |
| --- | --- | --- | --- |
| 官网首页、品牌官网、律所官网、茶叶官网、落地页、门户官网 | `official-homepage` | `landing` | 首屏叙事、可信视觉面板、服务矩阵、信任背书 |
| 数据大屏、实时监控、预警系统、指挥舱、态势屏 | `data-screen` | `screen` | 中心态势图、左右信息塔、趋势、排行、预警 |
| 数据看板、经营看板、管理驾驶舱 | `dashboard-overview`，复杂经营大屏切 `data-screen` | `dashboard` | KPI、图表、明细、排行、洞察 |
| 工作台、运营台、任务中心、业务首页 | `workbench-home` | `workbench` | 入口、待办、状态、流程闭环 |
| 列表、管理页、订单管理、客户列表、工单池 | `business-list` | `list` | 搜索筛选、表格、状态标签、详情抽屉 |
| 详情页、客户档案、订单详情、项目详情 | `detail-profile` | `detail` | 单对象摘要、章节、侧栏元信息、时间线 |
| 主从分栏、工单处理台、左列表右详情 | `split-pane-detail` | `list` | 左侧队列、右侧详情、时间线、动作区 |
| 页面内门户壳、多入口门户、隐藏导航门户 | `portal-shell-home` | `workbench` | 自绘门户导航、角色入口、常用应用、动态摘要 |

如果用户要求“门户组件 / 成员 / 部门 / 上传组件”，继续使用 Code Canvas，但按 [native-components-bridge.md](native-components-bridge.md) 选择 `portal-native-components` 示例或桥接方案。

当模板本身包含页面内应用导航（如 `workbench-home` 的侧边导航、`portal-shell-home` 的门户导航）时，生成的 `.openyida-page.json` 会默认写入 `appBlueprint.renderNav: false` / `navConfig.isRenderNav: false`。发布后必须用 `openyida update-form-config <appType> <formUuid> false "<页面标题>"` 隐藏宜搭原应用导航，避免双导航。

## 官网与品牌页素材流程

命中 `official-homepage` 时，写代码前先形成轻量设计规格和素材清单。

强视觉品牌先读 `yida-page-uiux/references/landing/realistic-brand-homepage.md`。不要把“有 heroImage”当作官网完成条件：至少规划场景 Hero、产品/服务、过程/空间三类素材，并给出从真实材质推导的页面级品牌 token、不同 section 的构图节奏和一个明确 CTA。

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

若 `openyida cdn-config --show` 显示缺少 `accessKeyId/accessKeySecret/cdnDomain/ossBucket`，不要承诺已完成上传，可先用已验证公开 URL 测试，或提示用户补 CDN 配置。

官方 Sample / 离线展示在无 CDN 时允许内嵌经过压缩的 JPEG/WebP data URI，保证源码原样发布也有真实图片；建议 3-5 张、单张不超过 250 KB、总量不超过 800 KB。生产页面不要沿用该兜底，应迁移到稳定 CDN。

## 主题作用域

`themeProfile: { "name": "yida-app-theme" }` 表示跟随宜搭运行态主题：线上由 `style#yida-global-theme` 的 `--color-brand1-*` 和 `--color-group` 决定页面主色、图表色组和局部强调色。

`themeScope` 决定主题影响范围：

| 作用域 | 行为 | 何时使用 |
| --- | --- | --- |
| `page` | 只在当前页面根节点注入主题变量，不影响导航和其他页面 | 默认安全选择 |
| `app` | 页面加载时调用 `window.__YIDA__.updateShellConfig({ themeConfig })`，请求壳层一起换肤 | 需要左侧导航、顶部壳层和内容区统一 |

自然语言推断：

| 用户表达 | 推断 |
| --- | --- |
| “整个应用统一风格 / 全局换肤 / 应用主题也改一下” | `themeScope: app` |
| “左侧导航也一起变色 / 菜单也跟着主题走” | `themeScope: app` |
| “页面好看一点 / 这个自定义页换主题 / 首页美化” | `themeScope: page` |
| “只改当前页 / 不影响导航 / 不要改其他页面” | `themeScope: page` |

显式覆盖色只在用户给定品牌色、色值或明确要求覆盖当前应用主题时使用。

## Page Spec 结构化字段

`openyida generate-page --spec <file>` 会读取结构化字段并写入 `.openyida-page.json` manifest，后续 AI 修改可以基于 manifest 更安全地更新。

| 字段 | 说明 | 默认 |
| --- | --- | --- |
| `researchLevel` | 官网/落地页调研深度：`none/light/enhanced/deep` | landing 默认 `light` |
| `appBlueprint` | 应用名、角色、导航分组、页面组合、壳形态 | 单页自动生成当前页 entry |
| `archetype` | 页面原型，如 `overview/analysis/monitor/profile` | 按 scene 推断 |
| `interactionProfile` | 主操作、详情方式、批量动作、空/载/错状态 | 按 scene 推断 |
| `insights` | 看板/报告/工作台的数据洞察 | 无则空数组或场景默认洞察 |
| `domainFidelity` | 生成后由 CLI 回填，标记是否仍像 sample | 无需手写 |

示例：

```json
{
  "template": "dashboard-overview",
  "scene": "dashboard",
  "researchLevel": "none",
  "archetype": "analysis",
  "appBlueprint": {
    "appName": "渠道增长应用",
    "shell": "side_nav",
    "renderNav": false,
    "roles": ["运营", "经销商"],
    "navigation": ["品牌展示", "经营看板"],
    "pages": [
      { "name": "品牌官网首页", "scene": "landing", "template": "official-homepage" },
      { "name": "经营看板", "scene": "dashboard", "template": "dashboard-overview" }
    ]
  },
  "interactionProfile": {
    "primaryAction": "查看本周经营",
    "detailMode": "drawer",
    "bulkActions": ["导出巡店建议"],
    "states": ["empty", "loading", "error"]
  },
  "insights": [
    { "conclusion": "华东区贡献 43%", "evidence": "环比 +5.2pp", "suggestion": "优先补货高增长门店" }
  ]
}
```

## 模板 primitives 验收

生成后至少确认源码包含对应场景的 primitive class，并且 `--compile` 通过。

| 模板 | 内置 UI primitives |
| --- | --- |
| `dashboard-overview` | KPI、Chart panel、Rank list、Insight callout、Freshness badge |
| `workbench-home` | Workbench metric、Quick entry、Task feed、Insight strip |
| `business-list` | Filter bar、Table state badge、Bulk action bar、Detail preview |
| `detail-profile` | Object hero、Meta stack、Timeline primitive、Insight callout |
| `split-pane-detail` | Split queue、Filter bar、Detail pane、Timeline card、Insight card |
| `portal-shell-home` | Portal nav、Hero panel、Entry card、Dynamic card、Update feed |
| `official-homepage` | Real-scene hero、Product/service visual、Process/space story、Visit/service section、CTA |
| `data-screen` | Command map、Metric grid、Rank panel、Screen insight header |

所有 Canvas 生成模板都必须带控件样式护栏：`ConfigProvider.getPopupContainer` 让 Select / DatePicker 弹层留在页面作用域，`OPENYIDA_CANVAS_CONTROL_CSS` 统一输入框、下拉、日期、运行态字段组件的 hover / focus / dropdown 样式。出现黑色粗边、浏览器原生 outline、下拉浮层脱离页面风格时，优先检查这两项是否被删掉。
