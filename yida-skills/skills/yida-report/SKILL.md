---
name: yida-report
description: 创建宜搭原生报表，包括图表、表格、筛选器和指标卡。
---

# 宜搭原生报表

## 何时使用

- 创建宜搭原生统计报表。
- 在已有报表中追加图表、表格、筛选器或指标卡。
- 为 Recharts 或已有 ECharts 页面提供服务端聚合结果。
- 创建自定义 Recharts 图表页 → 使用 `yida-rechart`。
- 维护已有普通 JSX ECharts 页面 → 使用 `yida-chart`。

## 必须遵守

1. 报表字段使用真实 `fieldId`，创建前通过 `yida-get-schema` 获取。
2. 统计聚合由原生报表完成，不在自定义页面拉取全量明细后计算。
3. 报表配置文件写入 `<projectRoot>/.cache/openyida/<任务名>/report/`。
4. 报表作为自定义页面数据源时，与页面保持相同 `appType`。
5. 跨应用迁移时重新创建报表，并更新页面绑定。

## 命令

```bash
openyida create-report <appType> "<报表名称>" <配置JSON文件路径>
openyida append-chart <appType> <reportId> <图表配置JSON文件路径>
```

CLI 使用 `lib/report/chart-builder.js` 生成原生报表 Schema。入口文件只填写业务图表配置，不手写完整页面 Schema。

## 执行步骤

1. 确认目标应用、数据表单、统计指标和筛选条件。
2. 使用 `yida-get-schema` 获取真实字段 ID。
3. 编写报表配置文件。
4. 执行 `create-report` 或 `append-chart`。
5. 检查返回的 `reportId` 和页面 URL。
6. 回读报表 Schema，确认数据集、组件和字段绑定。
7. 页面需要使用报表数据时，保存真实 `reportId` 和绑定配置。

## 页面绑定

- 报表 ID 使用平台返回的 `REPORT_xxx`。
- 页面通过报表接口读取聚合结果。
- 报表和页面跨应用时，先在页面所在应用创建对应报表。
- 页面只负责展示报表结果；指标和分组在原生报表配置中定义。

## 完成条件

- 创建或追加命令返回成功。
- Schema 回读中存在预期组件和真实字段绑定。
- 需要页面绑定时，页面与报表位于同一应用，绑定配置使用真实 `reportId`。

## 参考文件

| 文件 | 何时读取 |
|------|----------|
| [报表 API](references/report-api-guide.md) | 核对接口和返回值时 |
| [Schema 构建](references/schema-builder-details.md) | 查看组件类型、settings 和数据集结构时 |
| [示例](references/examples.md) | 编写图表、表格、筛选器或指标卡配置时 |
