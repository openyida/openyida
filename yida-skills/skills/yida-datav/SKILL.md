---
name: yida-datav
description: 仅在用户明确要求宜搭原生数字大屏、原生数据大屏或 DataV 大屏时使用。查询模板、创建、复制、回读状态、改名和显式发布，提供原生设计器和预览入口。普通大屏默认使用自定义页面。
---

# 宜搭原生 DataV 大屏

## 适用范围

- 用户明确要求宜搭原生大屏或 DataV 大屏时使用；一般数字大屏、数据大屏、驾驶舱和投屏监控由 `yida-dashboard` 组织内容，并用 `yida-canvas-custom-page` 承载。
- 继续已有原生大屏时使用其真实 `appType` 和 `formUuid`。先读取状态，确认 `formType=datav`。
- 平台权益、额度和企业数据授权沿用用户现有设置；CLI 不代用户开通权益或授权 DataV 访问企业数据。平台拒绝时反馈其错误及错误码。

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

1. 打开回读的 `designerUrl`，在原生设计器内配置图表、布局和数据源。
2. 用户在设计器完成编辑并明确要求发布、启用大屏时执行：

```bash
openyida datav publish <appType> <formUuid> --confirm --json
```

`publish --confirm` 调用平台 `saveScreen` 接口，实际会发布并启用大屏，保留平台的 Token 和人员权限校验；不能把它当作保存草稿。不接受布局 JSON，不自动配置公开分享。返回 `publishAccepted=true`、`enableRequested=true` 表示平台接受了发布启用操作；`layoutVerified=false`、`readbackVerified=false` 保留内容验收缺口。在 `previewUrl` 验证布局、真实数据、交互和投屏效果后，再反馈完成结果。

## 交付与恢复

- 返回资源名称、真实编号和本轮需要的设计器/预览入口；只操作单个大屏时保持单资源交付。
- 写入请求只发一次。网络异常或回读不匹配时保留 `appType`、`formUuid`、`retrySafe=false` 和恢复命令，先查询现状，不重复写入。
- 不自动删除大屏，不发起公开分享，不因创建资源而启动发布、启用或发送。
