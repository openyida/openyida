# 表单消息通知配置

选择触发时机、消息样式或接收对象，以及编写配置文件时，查阅本指南。

## 场景与触发

| 场景 | trigger | 说明 |
| --- | --- | --- |
| 新记录提醒 | `FORM_DATA_CREATE` | 表单创建成功后发送 |
| 记录被修改 | `FORM_DATA_EDIT` | 任意编辑成功后发送；当前配置范围为整条记录的编辑事件 |
| 删除审计提醒 | `FORM_DATA_DELETE` | 删除成功后发送，接收人需在删除后仍可解析 |
| 评论协作提醒 | `FORM_COMMENT` | 评论成功后发送 |

日期字段定时、流程开始/结束、到达节点和审批操作的已有通知支持查询；配置这些发送规则时，使用宜搭页面设置对应的时间、流程版本、节点和审批结果。

## 七种消息样式

| 页面名称 | `template.key` | 主要用途 | 内容参数 |
| --- | --- | --- | --- |
| 纯文本普通消息（工作通知） | `workNotice` | 向接收人发送文字提醒 | `content` |
| 图文详情卡片 | `detailImage` | 用图文卡片展示表单字段，配置详情入口 | `fields` |
| 图文卡片 | `imageCard` | 用图文展示通知内容 | `content` |
| 纯文本详情卡片 | `detailText` | 用文字卡片展示表单字段，配置详情入口 | `fields` |
| 图文评论卡片 | `commentCard` | 展示通知内容，配置评论入口 | `content` |
| 图文群置顶卡片 | `pinnedImage` | 在指定群中置顶图文通知 | `content` |
| 纯文本详情置顶卡片 | `pinnedText` | 在指定群中置顶文字通知，配置详情入口 | `content` |

前五种模板通过 `recipients` 选择接收人；后两种通过 `groups` 选择群。七种模板均有配置支持，实际送达、详情跳转、评论和群置顶效果分别在接收端验证。

## 配置示例

### 发送给发起人

将下面的配置保存为 `message.json`，用于普通表单新增后通知发起人：

```json
{
  "trigger": "FORM_DATA_CREATE",
  "recipients": [
    {"type": "variable", "value": "originator"}
  ],
  "groups": [],
  "template": {
    "key": "workNotice",
    "title": "订单已提交",
    "content": "订单 $!{serialNo} 已提交，请及时处理",
    "fields": [],
    "image": [],
    "button": null
  }
}
```

变量格式为 `$!{变量或字段ID}`。系统字段从 `options.systemFields` 选取；表单字段从 `options.messageFields` 选取实际 ID。详情卡片中的 `fields` 也使用这两类选项。

### 展示表单详情

下面的金额字段 ID 替换为 `options.messageFields` 中的实际 ID：

```json
{
  "trigger": "FORM_DATA_CREATE",
  "recipients": [{"type": "variable", "value": "originator"}],
  "groups": [],
  "template": {
    "key": "detailText",
    "title": "订单详情",
    "fields": [
      {"type": "variable", "value": "serialNo", "title": "流水号"},
      {"type": "formField", "value": "实际金额字段ID", "title": "金额"}
    ],
    "image": [],
    "button": {"name": "查看详情", "type": "formInstDetail", "value": ""}
  }
}
```

`detailImage` / `detailText` 使用 `fields`；`workNotice` / `imageCard` / `commentCard` / `pinnedImage` / `pinnedText` 使用 `content`。`button.type` 可为 `formInstDetail`、`comment` 或 `custom`；自定义链接仅接受无账号密码的 HTTP(S) URL。

### 在群中置顶

群置顶模板把 `recipients` 设为空，并提供平台返回的群标识：

```json
{
  "trigger": "FORM_DATA_EDIT",
  "recipients": [],
  "groups": [{"cid": "实际群ID", "name": "业务群"}],
  "template": {
    "key": "pinnedText",
    "title": "订单状态更新",
    "content": "订单状态已更新",
    "fields": [],
    "image": []
  }
}
```

## 接收对象

- `employee`：指定人员的平台 ID，选择目标组织中仍有效且可见的人员。
- `role`：宜搭角色 ID；实际成员按触发时权限解析。
- `formField`：目标表单中的人员字段，必须出现在 `options.recipientFields`。
- `variable`：当前仅支持原生 `originator`（发起人）。
- `groups`：原生群置顶卡片目标；群权限、酷应用支持和成员关系仍由平台校验。

向指定人员发送时，将接收项设为 `{"type":"employee","value":"实际人员ID"}`；向表单人员字段中的成员发送时，使用 `{"type":"formField","value":"实际人员字段ID"}`。一次消息最多选择 100 人，具体可见范围和可用能力以目标组织为准。

## 备份位置

创建、修改和删除配置时，CLI 自动把原配置备份到 `.cache/openyida/form-message/`。传入 `--backup` 可指定一个新的备份文件路径；操作返回的 `backupPath` 可用于查找该文件。
