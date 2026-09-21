---
name: yida-page-config
description: 为已有页面设置公开访问、组织内分享，或隐藏该页的平台导航时使用。隐藏导航不会改变访问权限。
---

# 页面访问配置

## 适用范围

用户要求查询或修改已有普通 OpenYida 页面的公开短链 `/o/`、组织内分享短链 `/s/`，或明确要求隐藏页面级导航时使用本技能。

先通过创建结果、查询结果或项目配置确认目标页面的 `appType` 和 `formUuid`。页面归属不清、信息过期或结果冲突时，先查清再修改；不能只凭标题或猜测的链接确定页面。

## 能力边界

| 配置 | 已确认语义 | 当前 CLI 能力边界 |
|------|------------|-------------------|
| `/o/<path>` | 公开访问短链，保存字段为 openUrl，并由 isOpen 控制开关 | openAuth 为三态：省略时保留完整 `openPageAuthConfig`，显式 y/n 时只 patch `openAuth`；CLI 不改写 authType/authSources 等授权来源 |
| `/s/<path>` | 组织内分享短链，保存字段为 shareUrl | isOpen 和 openAuth 不定义 `/s/` 的访问能力；以平台查询结果和实际访问验证为准 |

页面使用哪类数据、是否允许公开、openAuth 对当前页面和组织开放哪些资格，必须来自平台能力、用户确认或实际查询证据。本技能不根据页面类型或数据源猜测资格。

## 匿名（免登）提交前置条件

当用户要求"自定义页面在公开访问下提交数据到表单"或"走免登提交接口"时，作为前置门禁：

1. **显示页和目标表单都需要 `isOpen`**：分别运行 `openyida get-page-config <appType> <显示页formUuid>` 和 `openyida get-page-config <appType> <目标formUuid>`，两者都返回 `isOpen === 'y'` 才承诺匿名提交。缺任一时先启用公开访问或改回登录态方案。
2. **目标表单权限需包含 `FREE_LOGIN`**：运行 `openyida get-permission <appType> <目标formUuid>`，DEFAULT 权限组的 `dataPermit.rule` 须包含 `{"type":"FREE_LOGIN","value":"y"}`。缺少时按 `yida-form-permission` 锁定 DEFAULT 组 `packageUuid`，在完整现有 `dataPermit` 中只补该规则并保留其他规则，禁止用固定模板覆盖现网权限。
3. 页面运行时分流是**匿名态**决定的，不是"表单公开"决定的：具体分流写法和 `RECEIPT_SAVE_FORM_DATA` 网关契约见 [`yida-canvas-custom-page/references/data-bridge-guide.md`](../yida-canvas-custom-page/references/data-bridge-guide.md) 的"公开访问（匿名态）提交"章节。
4. 匿名提交的能力边界（不能发起流程、唯一性校验不生效、成员/部门/关联字段不支持、提交人恒为匿名、附件默认不跨组织）由平台限制决定；需要这些能力时改用登录态页面 + 关闭公开访问。

## 铁律

1. **目标必须可证明**：appType 和 formUuid 从创建/查询命令或当前项目 config.json 获取；证据冲突时停止。
2. **一类短链修改必须保留另一类**：修改 `/o/` 时保留已有 `/s/`，并完整保留非目标授权字段；修改 `/s/` 时保留已有 `/o/`、isOpen 和公开授权配置。当前 `openPageAuthConfig` 缺失或不可解析时 fail-closed。
3. **短链必须先验证**：启用或替换短链前运行 `verify-short-url`；验证失败时零写入。
4. **写后必须重查**：保存成功只表示请求成功；`get-page-config` 的实际 URL 与预期一致后才报告完成。
5. **平台状态是真相源**：本技能不使用 memory 保存页面配置。

## 标准流程

1. **查询**：运行 `openyida get-page-config <appType> <formUuid>`，记录 openUrl、shareUrl 和 isOpen。
2. **差异预览**：输出 before/after，明确目标短链的变化以及另一类短链保持值。
3. **确认**：用户确认 URL、`/o/` 或 `/s/` 语义；使用 `/o/` 时确认 isOpen，并仅在明确要改变授权开关时传 openAuth。省略 openAuth 表示保持，不再默认为 n。
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
| `openAuth` | 可省略、`y` 或 `n`；省略=完整保留，显式 y/n=只修改 openAuth，不声明授权资格或人员范围 |

路径段支持 `a-z A-Z 0-9 _ -`，可用单个 `/` 分隔。空路径段、连续 `/` 和尾部 `/` 校验失败。URL 是否可用由 `verify-short-url` 接口结果决定。

## 页面级导航

用户明确要求页面隐藏导航、无导航或全屏无框，或者 `yida-app` 的 PRD 已把主页面明确标记为 `entryMode=standalone` 时执行：

```bash
openyida update-form-config <appType> <formUuid> false "<页面标题>"
```

这条命令只设置页面级 `isRenderNav=false`。只有整个应用采用自定义导航时，才使用 `openyida update-app <appType> --hide-app-nav` 隐藏应用导航；独立访客端自定义菜单与管理端平台导航共存时，保留 `hideAppNav=n`。页面内是否显示导航、平台菜单是否包含该页、实际访问权限分别配置。详见 [访问态入口契约](../yida-app/references/entry-navigation.md)。

完整应用的独立入口必须在写入后再执行 `openyida get-form-config <appType> <formUuid> --json`。只有回读确认 `renderNav=false` 后，才输出不带查询参数的 `/custom/{formUuid}`；仅缺少 `renderNav` 时兼容 `isRenderNav`，布尔值和字符串 `"false"` 均可，缺失或无效值不算成功。失败时保留 `/workbench`，不把 URL 参数当作持久配置成功证据。

创建 dashboard 页面时，只有用户明确要求隐藏页面导航才使用：

```bash
openyida create-page <appType> "<页面名>" --mode dashboard --hide-nav
```

## 失败处理

| 结果 | 动作 |
|------|------|
| URL 格式或可用性验证失败 | 零写入；展示接口错误并让用户选择新路径 |
| 保存前查询失败 | 零写入；处理登录态、权限或资源身份问题 |
| 当前 `/o/` 授权配置缺失或不可解析 | 零写入；保留查询结果并让用户在平台确认当前公开配置 |
| 保存请求失败 | 停止；保留 before，不自动重复提交 |
| 写后重查不一致 | 报告 expected/actual 和 before/after，不宣称完成 |
| 实际 URL 无法访问 | 记录状态码和页面响应；不猜测 CDN、公开资格或 openAuth 语义 |
| 网络超时 | 先重查配置；无法证明是否写入时停止并交给用户判断 |

## 明确不支持

页面人员/部门白名单、公开访问资格探测、openAuth 授权主体配置和 permission-v2。
