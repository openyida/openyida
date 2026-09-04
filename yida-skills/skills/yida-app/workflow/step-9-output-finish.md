# Step 9：输出与收尾

最终输出让用户先理解业务能力，再看到一组用途明确的应用访问入口。内部 ID、构建产物、中间文件和逐项业务资源不作为用户可见交付物。

交付话术遵循 [用户可见表达契约](../../yida-design/references/ask-human-interaction-contract.md)。本文件中的接口字段用于内部核验；对用户描述已验证的业务效果。例如，自定义导航完成配置和跨页跳转验证后写“已启用自定义导航，可在各业务页面间切换”。尚未验证的部分如实说明待验证的页面或操作。

## 输入

- 发布成功证据；
- 主入口 URL；
- 资源创建、复用、更新摘要；
- seed records 写入或跳过结果；
- 导航排序结果。
- 页面/资源数量完整性风险检查结果。

## 完成条件核对

完整应用默认完成需要同时满足：

1. 主页面发布成功；
2. Canvas 主页面发布结果为 `publishMode=canvas`，读回 `hasYidaCodeCanvas=true` 且 `runtimeCodeBytes>0`；
3. 真实数据页面在已登录浏览器中退出 loading、无业务错误，并显示至少一条已 query 确认的记录；看板还必须有至少一个 KPI 数量或列表记录与只读 query 结果一致。已知记录数大于 0 但页面 KPI 全 0、列表为空或显示“暂无数据”时必须失败或标记 `needs_review`；
4. 获得可访问 URL；
5. 轻量导航排序已执行，或给出明确 warning；
6. 新建或作为页面数据源的核心普通表单已写入 1-3 条真实示例记录并 query 抽查，或明确说明跳过原因；
7. 应用主题文件已在应用级统一配置，自定义页面只在 `YidaComp` 内消费对应 token，未向上层注入或同步主题样式。
8. final 前先写入轻量 `prd/<项目名>/build-manifest.json`，再运行 `openyida check-prd-completeness prd/<项目名>/prd.md --app-type <appType> --build-manifest prd/<项目名>/build-manifest.json --json`；该命令只证明页面/资源数量完整性，不能替代第 3 条运行态数据验收。只有 `verdict=pass` 且运行态数据证据通过时才说“已按 PRD 完成搭建”；`verdict=needs_review` 时可以交付但必须列出 `items` 中 `status=needs_review/not_checked` 的复核项，`verdict=fail` 时列出 `hardFailures` 并说明未完成；
9. 未继续执行用户未要求的公开访问、截图验收、报表、大屏、数据源深接或精细导航分组。

若本轮修改过页面源码但没有成功执行 `openyida publish <source> <appType> <displayPageFormUuid>`，只能交付“源码已修改，尚未发布”的说明。

## build-manifest 约定

完整搭建收尾前，从本轮真实创建、复用和发布结果写入 `prd/<项目名>/build-manifest.json`。它只是轻量事实源，不是严格 schema；只记录已经拿到的真实资源名、类型和 ID，用于让 `check-prd-completeness` 做一次 app 资源列表 readback 后判断页面/资源数量是否完整。

`build-manifest.json` 与 Step 2 的 `requirement-brief.json`、`prd.md`、`design.md` 一样只供内部编排和验收使用。不得把它们登记为用户可见附件或下载卡片。

一期检查只消费 `display-page`、`normal-form`、`process-form` 资源项；不检查字段、必填、选项、seed records、导航顺序、表单 Schema、页面发布内容、截图或视觉体验。

最小示例：

```json
{
  "resources": [
    { "name": "销售工作台", "type": "display-page", "formUuid": "FORM-HOME", "main": true, "required": true },
    { "name": "客户信息", "type": "normal-form", "formUuid": "FORM-CUSTOMER", "required": true }
  ],
  "pages": [
    { "name": "销售工作台", "type": "display-page", "formUuid": "FORM-HOME", "main": true, "required": true }
  ],
  "forms": [
    { "name": "客户信息", "type": "normal-form", "formUuid": "FORM-CUSTOMER", "required": true }
  ]
}
```

## 结果输出格式

- 先写 2-3 句业务交付总结，再给一个名为“应用访问入口”的入口组。
- 一次完整应用搭建只产生这一组用户可见交付，不把表单、流程、报表、页面、资源清单或内部文件分别登记为附件、链接卡或下载卡。
- 业务资源只在总结中按能力或数量概述，例如“已完成 4 张业务表单、1 条审批流程和 1 个经营看板”；不默认输出资源 ID 表格、资源清单、长列表、appType、formUuid、pageId、reportId。
- 新增、修改或发布单个具体页面时，仍只交付当前页面，不扩展成完整应用入口组。
- 完整应用的入口组始终包含“应用工作台” `{base_url}/{appType}/workbench`。
- 主页面在 PRD 中为 `entryMode=standalone`，且 Step 8 回读确认 `isRenderNav=false` 时，入口组额外包含“独立业务入口” `{base_url}/{appType}/custom/{formUuid}`；否则不得输出。
- 先读取 `openyida agent-capabilities --summary-json` 的 `application_entry_policy.entries.admin`：值为 `include` 时，入口组额外包含“应用开发后台” `{base_url}/{appType}/admin`；值为 `omit` 时不得输出。不要根据 Agent 名称或自然语言猜测云端/非云端。
- 三个入口属于同一个应用入口组，不得各自连同业务资源再生成多组交付。
- 不把 `g.alicdn.com` 的 `index.css`、`index.js`、`index.html`、`locales/*.json`、构建产物 URL、CDN 资源 URL 或中间文件链接当成最终结果展示。
- 调用方或评测要求结构化结果时，额外输出顶层 `skillsUsed`，只填写本轮实际读取并使用的 `yida-*` 子技能名；不得把计划使用或未加载的技能写入。

推荐口径：

```markdown
已完成订单、客户和商品等核心业务表单，并发布首页、订单管理和库存看板等入口页面。当前应用已支持订单录入、库存预警、销售统计、表单提交入口和详情查看，示例记录、轻量导航排序与统一应用主题也已就绪。

应用访问入口：

- 应用工作台：`{base_url}/{appType}/workbench`
- 独立业务入口：`{base_url}/{appType}/custom/{formUuid}`（仅 `standalone` 且回读通过）
- 应用开发后台：`{base_url}/{appType}/admin`（仅 capability 明确为 `include`）
```

只有用户明确要求排障、复盘资源 ID、迁移或复制配置时，才补充技术 ID。

## URL 规则

| 页面类型 | URL 格式 |
| --- | --- |
| 应用首页 | `{base_url}/{appType}/workbench` |
| 表单提交页（默认隐藏导航） | `{base_url}/{appType}/submission/{formUuid}?isRenderNav=false` |
| 自定义页面 | `{base_url}/{appType}/custom/{formUuid}` |
| 自定义页面（应用导航隐藏） | `{base_url}/{appType}/custom/{formUuid}`；由应用基础设置 `hideAppNav='y'` 控制 |
| 原生报表（仅单独交付该报表时） | 使用 CLI 返回的 `{base_url}/{appType}/workbench/{reportId}`；禁止拼接 `/{appType}/report/{reportId}` |
| 表单详情页（抽屉/隐藏导航） | `{base_url}/{appType}/formDetail/{formUuid}?formInstId={formInstId}&navConfig.layout=1180&isRenderNav=false` |
| 表单详情页（编辑模式） | `{base_url}/{appType}/formDetail/{formUuid}?formInstId={formInstId}&mode=edit&navConfig.layout=1180&isRenderNav=false` |

完整应用即使包含原生报表，也不得把模型猜测的报表路由或每张表单的管理地址作为应用交付入口。入口组只允许工作台、经回读确认的独立业务入口，以及 capability 允许的开发后台。

## 可选后置

以下动作只在用户明确要求或 PRD 验收标准命中时追加：

| 可选项 | 子技能 | doneWhen |
| --- | --- | --- |
| 精细导航整理 | `use_skill("yida-nav-group", "整理应用导航分组")` | 主页面/核心表单顺序符合业务入口 |
| 数据桥深度接入 | `use_skill("yida-canvas-data-binding", "接入页面数据")` 或 `use_skill("yida-data-source-connectors", "绑定设计器数据源")` | 页面真实数据读写稳定，空态/错误态可恢复 |
| 报表/图表 | `use_skill("yida-report", "创建原生报表")`、`use_skill("yida-rechart", "创建 Recharts 页面")` 或 `use_skill("yida-chart", "创建 ECharts 页面")` | 报表或图表页面已创建/发布 |
| 公开访问 | `use_skill("yida-page-config", "配置页面公开访问")` | 分享配置保存成功 |
| 截图/人工验收 | 按当前工具能力 | 截图或用户确认通过 |

## 错误处理

- 不编造 `appType`、`formUuid`、`fieldId`、`reportId`。
- OpenYida CLI 失败时保留 stdout/stderr 诊断。
- 同一命令失败后，必须改变登录态、组织、参数、输入文件或字段 ID 后才能重试。
- corpId 与目标组织不一致时先停下，让用户选择重新登录或确认在当前组织继续。
- 输入 JSON/YAML/CSV/JSX 等业务文件必须用结构化文件写入工具创建。
- 用户要求删除应用时，必须展示应用名称、应用 ID、影响范围，并等待明确“确认删除”后才可执行。

## Checklist

- [ ] final 先写业务总结，再给唯一一组“应用访问入口”；
- [ ] 已写入轻量 build-manifest 并运行页面/资源数量完整性风险检查；未通过时没有声称“已按 PRD 完成搭建”；
- [ ] 未把内部文件或每个业务资源分别交付；
- [ ] 工作台始终存在，custom 只在 `standalone` 写后回读通过时存在，admin 严格跟随 capability；
- [ ] 未默认暴露资源 ID 或其他管理态链接；
- [ ] 结构化结果中的 `skillsUsed` 只包含实际读取并使用的技能；
- [ ] 未把 CDN 构建产物当作交付链接；
- [ ] 未执行用户未要求的可选后置动作。

自定义导航应用交付前，核对应用导航已隐藏，且 PRD 清单中每个表单、流程表单和自定义页面均有 `get-form-config` 返回 `isRenderNav=false` 的记录。任一页面配置失败时，该导航方案尚未完成。
