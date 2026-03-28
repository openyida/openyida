---
name: yida-get-schema
description: 获取表单的完整 Schema 结构，用于确认字段 ID（fieldId）和组件配置。
---

# 获取表单 Schema

## 命令

```bash
openyida get-schema <appType> <formUuid>
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `appType` | 是 | 应用 ID |
| `formUuid` | 是 | 表单 UUID |

## 输出

完整的 Schema JSON 输出到 stdout，包含 `pages`、`componentsMap` 等字段结构。

> 编码前可用此命令确认表单中各字段的 `fieldId`。
