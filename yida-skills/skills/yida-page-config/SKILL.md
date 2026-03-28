---
name: yida-page-config
description: 页面公开访问和组织内分享配置。支持 URL 验证、配置保存、导航显示控制。
---

# 页面配置

## ⚠️ 关键限制

**使用宜搭表单数据的自定义页面不支持公开访问（`/o/xxx`）**，因为匿名用户无法调用需要登录态的表单接口。

| 页面类型 | 公开访问 `/o/` | 组织内分享 `/s/` |
|---------|:-:|:-:|
| 纯展示页面（静态/外部 API） | ✅ | ✅ |
| 使用宜搭表单数据 | ❌ | ✅ |

## 命令

### 验证 URL

```bash
openyida verify-short-url <appType> <formUuid> <url>
```

### 保存配置

```bash
openyida save-share-config <appType> <formUuid> <url> <isOpen> [openAuth]
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `url` | 是 | `/o/xxx` 或 `/s/xxx`，关闭时传 `""` |
| `isOpen` | 是 | `y` 开启 / `n` 关闭 |
| `openAuth` | 否 | `y` 需授权 / `n` 不需要（默认） |

### 查询配置

```bash
openyida get-page-config <appType> <formUuid>
```

### 隐藏顶部导航

```bash
openyida update-form-config <appType> <formUuid> false "<页面标题>"
```

## URL 格式

- 公开访问：`/o/xxx`，组织内分享：`/s/xxx`
- 仅支持 `a-z A-Z 0-9 _ -`，路径全局唯一
