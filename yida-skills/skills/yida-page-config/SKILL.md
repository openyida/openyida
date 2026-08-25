---
name: yida-page-config
description: 配置已有页面的公开访问和组织内分享。
---

# 页面访问配置

## 适用范围

用户要求查询或修改已有普通 OpenYida 页面的公开短链 `/o/`、组织内分享短链 `/s/`，或明确要求隐藏页面级导航时使用本技能。

目标页面必须有可证明的 appType 和 formUuid。资源所有权不明、状态 stale、存在冲突或需要 reconciliation 时保持零写入；按标题或 URL 猜测页面身份不构成证明。

## 能力边界

| 配置 | 已确认语义 | 当前 CLI 能力边界 |
|------|------------|-------------------|
| `/o/<path>` | 公开访问短链，保存字段为 openUrl，并由 isOpen 控制开关 | openAuth 原样传给公开访问配置；CLI 不能证明页面是否具备公开访问资格，也不能推断授权主体或匿名数据能力 |
| `/s/<path>` | 组织内分享短链，保存字段为 shareUrl | isOpen 和 openAuth 不定义 `/s/` 的访问能力；以平台查询结果和实际访问验证为准 |

页面使用哪类数据、是否允许公开、openAuth 对当前页面和组织开放哪些资格，必须来自平台能力、用户确认或实际查询证据。本技能不根据页面类型或数据源猜测资格。

## 铁律

1. **目标必须可证明**：appType 和 formUuid 从创建/查询命令或当前项目 config.json 获取；证据冲突时停止。
2. **一类短链修改必须保留另一类**：修改 `/o/` 时保留已有 `/s/`；修改 `/s/` 时保留已有 `/o/`、isOpen 和公开授权配置。
3. **短链必须先验证**：启用或替换短链前运行 `verify-short-url`；验证失败时零写入。
4. **写后必须重查**：保存成功只表示请求成功；`get-page-config` 的实际 URL 与预期一致后才报告完成。
5. **平台状态是真相源**：本技能不使用 memory 保存页面配置。

## 标准流程

1. **查询**：运行 `openyida get-page-config <appType> <formUuid>`，记录 openUrl、shareUrl 和 isOpen。
2. **差异预览**：输出 before/after，明确目标短链的变化以及另一类短链保持值。
3. **确认**：用户确认 URL、`/o/` 或 `/s/` 语义；使用 `/o/` 时同时确认 isOpen 与 openAuth 输入只代表提交参数，不代表资格证明。
4. **写入**：先验证目标 URL，再执行一次 `save-share-config`。CLI 会再次查询当前配置并合并未修改字段。
5. **重查验证**：CLI 保存后会重查并返回 before/after；Agent 再以 `get-page-config` 和实际访问结果验证目标 URL。expected/actual 不一致时停止。

## 命令

查询：

```bash
openyida get-page-config <appType> <formUuid>
```

验证目标短链：

```bash
openyida verify-short-url <appType> <formUuid> </o/path|/s/path>
```

保存：

```bash
openyida save-share-config <appType> <formUuid> <url> <isOpen> [openAuth]
```

| 参数 | 规则 |
|------|------|
| `url` | `/o/...` 修改 openUrl；`/s/...` 修改 shareUrl |
| `isOpen` | `y` 或 `n`；控制 `/o/` 公开开关 |
| `openAuth` | `y` 或 `n`，默认 `n`；只写入公开访问授权配置，不声明授权资格或人员范围 |

路径段支持 `a-z A-Z 0-9 _ -`，可用单个 `/` 分隔。空路径段、连续 `/` 和尾部 `/` 校验失败。URL 是否可用由 `verify-short-url` 接口结果决定。

## 页面级导航

用户明确要求页面隐藏导航、无导航或全屏无框时执行：

```bash
openyida update-form-config <appType> <formUuid> false "<页面标题>"
```

这条命令只设置页面级 `isRenderNav=false`。自定义页要自绘应用侧边或顶部导航时，先使用 `openyida update-app <appType> --hide-app-nav` 隐藏应用导航；两者不是同一配置。

创建 dashboard 页面时，只有用户明确要求隐藏页面导航才使用：

```bash
openyida create-page <appType> "<页面名>" --mode dashboard --hide-nav
```

## 失败处理

| 结果 | 动作 |
|------|------|
| URL 格式或可用性验证失败 | 零写入；展示接口错误并让用户选择新路径 |
| 保存前查询失败 | 零写入；处理登录态、权限或资源身份问题 |
| 修改 `/s/` 时当前 `/o/` 授权配置缺失 | 零写入；保留查询结果并让用户在平台确认当前公开配置 |
| 保存请求失败 | 停止；保留 before，不自动重复提交 |
| 写后重查不一致 | 报告 expected/actual 和 before/after，不宣称完成 |
| 实际 URL 无法访问 | 记录状态码和页面响应；不猜测 CDN、公开资格或 openAuth 语义 |
| 网络超时 | 先重查配置；无法证明是否写入时停止并交给用户判断 |

## 明确不支持

页面人员/部门白名单、公开访问资格探测、openAuth 授权主体配置和 permission-v2。
