---
name: yida-create-page
description: 在应用中创建自定义展示页面（display 类型），返回 formUuid。
---

# 创建自定义页面

## 命令

```bash
openyida create-page <appType> <pageName>
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `appType` | 是 | 应用 ID，如 `APP_XXX` |
| `pageName` | 是 | 页面名称 |

## 输出

```json
{"success":true,"pageId":"FORM-XXX","pageName":"游戏主页","appType":"APP_XXX","url":"{base_url}/APP_XXX/workbench/FORM-XXX"}
```

> 创建后使用 `yida-custom-page` 编写 JSX 代码，再用 `openyida publish` 发布。
> 如需创建表单页面（带字段的数据收集页），请使用 `yida-create-form-page`。
