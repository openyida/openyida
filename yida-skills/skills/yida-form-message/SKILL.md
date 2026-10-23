---
name: yida-form-message
description: 为已有普通表单配置消息通知，选择新增、编辑、删除或评论后的发送时机、接收人和消息样式。支持工作通知、详情卡片、图文卡片、评论卡片和群置顶卡片等七种模板；按用户要求执行真实发送测试。
---

# 表单消息通知

为已有普通表单配置“什么时候、向谁、发送什么通知”。使用 `openyida form-message` 查询、新增、修改和删除「页面设置 > 消息通知」中的配置。保存后，表单事件发生时发送通知。

## 适用场景

| 用户需求 | 使用入口 |
| --- | --- |
| 配置表单新增、编辑、删除或评论后的消息通知 | 本技能 |
| 查询日期定时、流程开始/结束、流程节点或审批操作的已有通知 | 本技能查询；这些类型的修改使用宜搭页面 |
| 配置集成自动化中的通知节点 | `yida-integration` |
| 应用级通知、自定义页面消息、机器人消息 | 对应功能入口，独立于表单消息设置 |

## 操作步骤

1. 查询现有通知和可用选项，核实目标表单、字段、接收人和模板。
2. 按用户要求准备配置文件，再创建或修改通知。首次配置可从[发送给发起人的示例](references/guide.md)开始。
3. 核对保存结果中的 `readbackVerified: true`，交付可点击的消息通知配置链接（CLI 返回的 `configUrl`），附上通知 ID、标题、触发时机和接收对象。完整应用搭建和单点新增、修改通知均按此要求交付。用户要求真实测试时，按已指定的对象和范围执行并确认送达；已有明确授权可直接沿用。

`configUrl` 指向该表单的消息通知列表，地址为 `<当前认证环境域名>/<appType>/admin/<formUuid>/settings/messageSetting`。使用返回的真实域名与标识；用户打开后可按通知标题找到本次配置。

```bash
openyida form-message list <appType> <formUuid> --json
openyida form-message options <appType> <formUuid> --json
openyida form-message inspect <appType> <formUuid> <messageId> --json
openyida form-message create <appType> <formUuid> --config message.json --json
openyida form-message update <appType> <formUuid> <messageId> --config patch.json --expected-hash <configHash> --json
```

## 配置规则

普通表单支持新增、编辑、删除和评论后通知。接收对象支持指定人员、角色、表单人员字段和发起人；群置顶模板使用平台群 ID。模板中文名称、参数和选用方式见[配置指南](references/guide.md)。

更新时 `template` 属性合并，`recipients`、`groups` 和 `template.fields` 数组整体替换。CLI 写入前自动备份并检查配置是否变化。遇到超时或回读不一致，保留 `backupPath`，先执行 `list` / `inspect` 确认远端状态，再决定下一步；不自动重放写请求。

## 删除与测试

用户明确要求移除通知时，先用 `inspect` 获取最新 `configHash`，再执行删除。平台当前提供配置删除功能，没有独立启停接口；`isSendMessage` 是平台原生字段，不是通知开关。

```bash
openyida form-message delete <appType> <formUuid> <messageId> --expected-hash <configHash> --yes --json
```

删除后重建会产生新 ID；备份保留原配置内容，恢复时需重新核对引用。真实测试使用独立测试目标，业务配置按用户指定的表单执行。测试前确认用户已授权触发表单事件及对应接收对象；交付时分别记录配置保存、事件触发和接收端送达结果。测试结束后，按用户要求保留或清理配置和数据。

## 参考文件

- [配置指南](references/guide.md)：四种触发、七种模板、接收对象、变量格式和配置示例。
