# Step 9：输出与收尾

最终输出让用户先理解业务能力，再打开唯一主入口。内部 ID、构建产物和中间文件不作为交付结果。

## 输入

- 发布成功证据；
- 主入口 URL；
- 资源创建、复用、更新摘要；
- seed records 写入或跳过结果；
- 导航排序结果。

## 完成条件核对

完整应用默认完成需要同时满足：

1. 主页面发布成功；
2. 获得可访问 URL；
3. 轻量导航排序已执行，或给出明确 warning；
4. 新建或作为页面数据源的核心普通表单已写入 1-3 条真实示例记录并 query 抽查，或明确说明跳过原因；
5. 普通表单和流程表单已注入全局主题样式，详情页已注入 formDetail CSS，或明确说明无法注入的阻塞原因；
6. 未继续执行用户未要求的公开访问、截图验收、报表、大屏、数据源深接或精细导航分组。

若本轮修改过页面源码但没有成功执行 `openyida publish <source> <appType> <displayPageFormUuid>`，只能交付“源码已修改，尚未发布”的说明。

## 结果输出格式

- 先写 2-3 句业务交付总结，再给一个主入口链接。
- 新增、修改或发布单个具体页面时，主入口是当前页面 URL。
- 其他完整应用、建表单、建流程、权限、主题、导航或批量资源场景，主入口是应用首页 `{base_url}/{appType}/workbench`。
- 不默认输出资源 ID 表格、资源清单、长列表、appType、formUuid、pageId、reportId。
- 不默认输出 `/admin`、配置页、Schema 页、分享配置页等管理态链接。
- 不把 `g.alicdn.com` 的 `index.css`、`index.js`、`index.html`、`locales/*.json`、构建产物 URL、CDN 资源 URL 或中间文件链接当成最终结果展示。

推荐口径：

```markdown
已完成订单、客户和商品等核心业务表单，并发布首页、订单管理和库存看板等入口页面。当前应用已支持订单录入、库存预警、销售统计、表单提交入口和详情查看，示例记录、轻量导航排序、表单主题样式与表单详情样式也已就绪。

主入口：`{base_url}/{appType}/workbench`
```

只有用户明确要求排障、复盘资源 ID、迁移或复制配置时，才补充技术 ID。

## URL 规则

| 页面类型 | URL 格式 |
| --- | --- |
| 应用首页 | `{base_url}/{appType}/workbench` |
| 表单提交页（默认隐藏导航） | `{base_url}/{appType}/submission/{formUuid}?isRenderNav=false` |
| 自定义页面 | `{base_url}/{appType}/custom/{formUuid}` |
| 自定义页面（隐藏导航） | `{base_url}/{appType}/custom/{formUuid}?isRenderNav=false` |
| 表单详情页（抽屉/隐藏导航） | `{base_url}/{appType}/formDetail/{formUuid}?formInstId={formInstId}&navConfig.layout=1180&isRenderNav=false` |
| 表单详情页（编辑模式） | `{base_url}/{appType}/formDetail/{formUuid}?formInstId={formInstId}&mode=edit&navConfig.layout=1180&isRenderNav=false` |

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

- [ ] final 先写业务总结，再给唯一主入口；
- [ ] 未默认暴露资源 ID 或管理态链接；
- [ ] 未把 CDN 构建产物当作交付链接；
- [ ] 未执行用户未要求的可选后置动作。
