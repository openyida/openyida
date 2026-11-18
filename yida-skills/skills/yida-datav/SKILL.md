---
name: yida-datav
description: 仅在用户明确要求宜搭原生数字大屏、原生数据大屏或 DataV 大屏时使用。创建、复制和编辑前读取当前应用主题，配置配套的明暗与组件样式；查询模板、组件参数和图层配置，回读状态、改名和显式发布。普通大屏默认使用自定义页面。
---

# 宜搭原生 DataV 大屏

## 适用范围

- 用户明确要求宜搭原生大屏或 DataV 大屏时使用；一般数字大屏、数据大屏、驾驶舱和投屏监控由 `yida-dashboard` 组织内容，并用 `yida-canvas-custom-page` 承载。
- 继续已有原生大屏时使用其真实 `appType` 和 `formUuid`。先读取状态，确认 `formType=datav`。原生大屏通常返回 `DATAV-...` 编号，后续命令原样使用该编号。
- 平台权益、额度和企业数据授权沿用用户现有设置；CLI 不代用户开通权益或授权 DataV 访问企业数据。平台拒绝时反馈其错误及错误码。

## 创建、复制或编辑前：读取应用主题

先执行以下只读快照，再按[主题与应用一致](references/components-and-configuration.md#主题与应用一致)确定大屏配色。完整应用搭建与单独编辑大屏都执行此步骤；同轮已取得且应用主题未变化的快照直接复用。

```bash
openyida app-theme snapshot <appType> --output-dir <新的本地目录> --json
```

- 结合快照、当前应用工作台和已确认设计核对主色、导航与内容区明暗、文字及面板角色。`app-settings --section theme` 可能仅返回设置入口，不能据此认定主题已读取。
- 默认沿用当前应用：浅色应用使用浅色画布和面板，深色应用使用配套深色；用户明确要求独立投屏风格时采用该方向并保留应用品牌色。导航为浅色时一并检查大屏衔接，不能因模板默认深色就照搬深色。
- 新应用先等待本轮应用主题确定并读回，再适配大屏样式；已有应用不因搭建大屏而修改应用主题。主题未知时先核实，数据和组件检查可以继续，不猜主题或自动换肤。
- 编辑前读取 `datav config`，保留原有数据源、字段映射、蓝图、筛选、图层父子关系和权限；纯配色修改只调整已核实的样式字段及必要装饰。复制后也要重新检查模板样式，不能把复制成功当作主题适配完成。

## 查询模板和创建

```bash
openyida datav templates <appType> --page 1 --page-size 10 --json
openyida datav create <appType> "运营数字大屏" --template <templateId> --wait-seconds 15 --json
openyida datav inspect <appType> <formUuid> --json
```

模板编号来自 `templates` 返回的 `templateId`；分页参数以 1 开始。省略 `--template` 时由平台创建默认大屏，不猜模板编号。创建名称可用 `--locale zh_CN|en_US|ja_JP` 指定内容语言。

创建是异步操作。`create` 默认最多等待 15 秒，`--wait-seconds` 可设为 0–60 秒。超时返回 `DATAV_CREATE_PENDING`、已创建的 `formUuid` 和 `recovery`；后续只用 `inspect` 查询同一个资源，不能再次创建。创建请求结果不确定或返回缺少编号时，用 `list-forms` 核对应用已有页面后再判断，不能自动重试。

`inspect` 返回 `state=ready|pending`、`datavId`、`designerUrl` 和 `previewUrl`；`pending` 可能是尚未初始化完成，不能直接认定创建失败。入口使用宜搭域名，不导出 DataV 分享 Token。

## 复制和改名

```bash
openyida datav copy <appType> <formUuid> "运营数字大屏副本" --wait-seconds 15 --json
openyida datav rename <appType> <formUuid> "经营驾驶舱" --json
```

复制仅在同一应用内进行，返回新资源编号；源大屏必须已就绪。复制超时按新编号继续查询，保留源资源。改名前回读真实 DataV 编号，不要求用户手填 `datavId`；改名后核对标题。`--locale` 改动目标语言标题，同时按平台约定更新 `zh_CN` 作为 DataV 底层名称，其余语言保留。

## 配置和发布

1. 先读取[组件与配置指南](references/components-and-configuration.md)，根据目标查询图表、BI 分析、地图、信息、表格、控件或媒体的实际目录：

```bash
openyida datav components <appType> <formUuid> --category analysis --json
openyida datav components <appType> <formUuid> --component bar-basic --json
openyida datav config <appType> <formUuid> --json
openyida datav config <appType> <formUuid> --component "<实际图层ID>" --json
```

`components --component` 使用目录组件名，返回参数类型、范围、选项、默认值和数据/事件定义；`config --component` 使用保存图层的真实 ID，返回当前样式。先核对组件版本。目录可见不代表企业拥有权益或已安装商业组件包，返回 `entitlementVerified=false`。配置查询排除数据值与分享设置，不是完整备份。

组件选型覆盖图表、地图、BI、指标、表格和控件，具体字段及交互按指南查询当前版本。交付时区分目录可见、权益确认、配置已保存和运行已验收；目录总数包含不同版本资产、地图子层和工具项，不能当作已实测组件数。

2. 按前置主题决策，将画布、面板、图表、地图、控件和浮层的颜色角色配套。浅色适配同时处理深色背景图、装饰边框、背景柱、文字和浮层，不能只改画布底色。打开回读的 `designerUrl`，按实际版本在原生设计器内配置样式、地图子层、数据源与字段映射，以及蓝图中的筛选联动。当前 CLI 对组件配置提供查询，不提供组件、数据源或蓝图写入；应用主题 CSS 不会被 CLI 自动同步为 DataV 组件配置。

支持配置浅色样式，不代表当前宜搭环境提供内置浅色主题系列或全局一键切换；按指南的[主题能力核验](references/components-and-configuration.md#主题能力核验)检查模板与设计器真实入口，不把模板默认深色当作能力限制。

3. 保存后用 `config` 核对样式；在应用工作台中连同导航检查整页搭配，并在预览检查数据、指标口径、地图位置和控件联动。样式读回和视觉验收分别记录；缺少实际画面时保留视觉待验收状态。用户明确要求发布、启用大屏时执行：

```bash
openyida datav publish <appType> <formUuid> --confirm --json
```

`publish --confirm` 调用平台 `saveScreen` 接口，实际会发布并启用大屏，保留平台的 Token 和人员权限校验；不能把它当作保存草稿。不接受布局 JSON，不自动配置公开分享。返回 `publishAccepted=true`、`enableRequested=true` 表示平台接受了发布启用操作；`layoutVerified=false`、`readbackVerified=false` 保留内容验收缺口。在 `previewUrl` 验证布局、真实数据、交互和投屏效果后，再反馈完成结果。

## 交付与恢复

- 返回资源名称、真实编号和本轮需要的设计器/预览入口；只操作单个大屏时保持单资源交付。
- 写入请求只发一次。网络异常或回读不匹配时保留 `appType`、`formUuid`、`retrySafe=false` 和恢复命令，先查询现状，不重复写入。
- 不自动删除大屏，不发起公开分享，不因创建资源而启动发布、启用或发送。
