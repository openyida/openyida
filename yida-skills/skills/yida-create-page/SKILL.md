---
name: yida-create-page
description: 创建自定义展示页或宜搭原生门户，返回 pageId（formUuid）。仅当目标页面缺失且用户意图允许新增时使用，原生门户需用户明确选择。
---
# 创建自定义页面和原生门户

目标不明时先只读确认或询问用户。

## Resource-First 使用门槛

执行前先确认目标应用和页面资源。已有原生门户复用原页面，在门户设计器中编辑。

- 如果本轮用户给了页面 URL、`formUuid`、bound page，或 workspace cache/config 中已有目标 display page，禁止调用 `openyida create-page`；改由 `yida-canvas-custom-page` 编写页面源码，再由 `yida-publish-page` 发布。已确认是历史平台 JSX 组件页面维护时，不由本技能创建或派发，改走根路由的“JSX 自定义页面开发”入口。
- 如果用户给的是普通表单 `formUuid` 且诉求是改字段结构，改用 `yida-create-form-page`；不要把表单 ID 当作自定义页面创建目标。
- 目标 app 已明确、目标页面缺失且用户意图允许新增时，才执行创建。明确要求原生门户时使用 `--mode portal`。
- 多个已有页面候选按根技能来源优先级选择；同级冲突或无法判断主页面时才问用户。

## 严格禁止 (NEVER DO)

- 不要编造 formUuid，必须从命令返回的 JSON 中提取
- 不要用此命令创建表单页面（带字段的数据收集页），应使用 `yida-create-form-page`
- 已有页面 URL / `formUuid` / bound page 时，不要创建新页面；除非用户明确要求新增另一个页面并确认。

## 严格要求 (MUST DO)

- **创建前必须确认**：单点创建页面时，执行创建命令前必须向用户确认页面名称和目标应用。由 `yida-app` 完整应用统一编排且用户已说“默认方案 / 不要追问 / 直接创建”时，合理命名并直接创建，不再二次追问。
- 创建成功后，将 formUuid 记录到 `.cache/<项目名>-schema.json`
- 由 `yida-app` 完整应用统一编排的首页/工作台/智能助手/门户门面页，可以先于业务表单创建；先占位记录 `formUuid`，待表单 ID 明确后再写源码并发布。
- 单独新增自定义页面时，在编写源码前进入 [单页设计](../yida-design/sub_skill/page-design/SKILL.md)，核对主题和页面风格。
- 自定义页面创建成功后，用真实 `formUuid` 交给 `yida-canvas-custom-page` 编写源码，再由 `yida-publish-page` 发布。本技能不使用 `yida-custom-page` 处理新建页面。原生门户在 `designerUrl` 对应的门户设计器中编辑和发布。
- **本技能不读写 memory**：formUuid 等信息输出到 stdout，通过 `.cache/<项目名>-schema.json` 持久化，不依赖跨会话的 memory 状态

## 适用场景

用户需要创建"自定义展示页面"、"可视化大屏"、"自定义 UI 页面"，且 resource context 未解析到目标页面时使用。

**关键区分**：
- 自定义展示页面（无字段，纯 JSX/React 开发）→ 本技能
- 表单页面（有字段，数据收集）→ `yida-create-form-page`

## 触发条件

**正向触发**：
- "创建自定义展示页面"、"新建可视化大屏"
- "创建自定义 UI 页面"、"新建一个页面"
- "创建宜搭原生门户"
- 完整应用开发流程中主页面缺失且允许创建的页面创建步骤（由 `yida-app` 编排调用）

---


## 命令

```bash
openyida create-page <appType> "<pageName>" [--mode dashboard|portal] [--hide-nav] [--locale zh_CN|en_US|ja_JP] [--open|--no-open]
```

传入 `--mode portal` 创建宜搭原生门户。创建后回读 `formType=portal`，并输出 `designerUrl` 和 `workbenchUrl`。使用门户设计器编辑和发布门户。门户模式不支持 `--hide-nav`。原生报表使用 `create-report`。

### 原生门户沿用应用主题

- 开发前读取目标应用的主题模式、品牌色和已启用的主题 CSS。可在应用主题设置中查看，或使用 `openyida app-theme snapshot <appType> --output-dir <new-dir> --json` 只读获取应用主题配置和 CSS。
- 应用已启用新版主题样式时，以现有应用配色为准。在门户设计器中将支持绑定的属性设为「跟随主题」，使用 `--color-brand1-6` 作为强调色，页面底色和背景图使用 `--pod-page-bg-color`、`--pod-page-bg-image`，卡片底色和圆角使用 `--pod-card-bg-color`、`--pod-card-border-radius`。布局和间距沿用应用主题值。
- 新版样式由 `isUseNewAppThemeStyle()` 决定，应用仍是旧版主题但启用了 Pod Premium 时也走新版样式。保留既有门户的自定义值，移动端页边距跟随 `--pod-page-mobile-margin`。在门户设计器核对可用绑定，再分别检查 PC 和移动端的品牌色、背景和卡片文字对比度。

### 千问办公调用约定

仅在当前宿主为千问办公（QwenWork）时执行以下约定；可复用已确认的宿主信息，需核实时单独执行 `openyida env --json`，以 `active.toolId=qwenwork` 为准。其他云端、Codex 等环境沿用各自的命令与浏览器交接方式。

- 使用 Bash 工具单独执行一条 `openyida create-page` 命令，添加 `--quiet --no-open`，保留已确认的 `appType`、页面名称及模式、导航、语言等业务参数；已有 `--open` 时替换为 `--no-open`。
- 命令直接以 `openyida create-page` 开头；工作目录通过工具参数指定。不要包装成脚本、命令替换或变量赋值，也不要拼接 `cd`、管道 `|`、重定向（如 `>`、`2>&1`）、分号、`&&`、`||` 或其他命令；不要追加 `echo`、`wc`、查询或验证命令。
- 保留 Bash 返回的原始 stdout、stderr 和退出码，直接交给宿主 Hook；不要截断、过滤、重定向或用自行整理的文本替换工具输出。宿主 Hook 从成功结果的顶层 `url` 接管侧边栏开页，AI 不再主动调用浏览器重复打开。
- `--no-open` 只关闭 `browser_handoff` 提示，成功结果仍包含 `url`、`pageId` 等字段。按真实 `pageId` 记录 `formUuid`；侧边栏开页不代表页面源码已发布或渲染已验收，也不要因未开页而重跑创建。
- 原始工具输出保留后，按页面类型继续。原生门户交付 `designerUrl`，自定义页面继续编写并发布源码。`pageCreated:true` 的失败按下方恢复规则处理，复用原页面。

千问办公示例（`APP_XXX` 替换为已确认的应用 ID，整行单独执行）：

```bash
openyida create-page APP_XXX "客户工作台" --quiet --no-open
```

### 参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `appType` | 是 | 应用 ID，如 `APP_XXX` |
| `pageName` | 是 | 页面名称 |
| `--mode dashboard` | 否 | 看板/驾驶舱页面推荐使用；只表达页面模式，不会自动隐藏导航 |
| `--mode portal` | 否 | 创建原生门户，成功后返回设计器和访问链接 |
| `--hide-nav` | 否 | 兼容已有的显式隐藏导航调用；命令自动配置并回读，未生效时在同一页面补写一次。确认隐藏后才输出 `hideNav=true` 和不带导航参数的 `/custom/<pageId>`。完整应用的前台用途由编排判断，创建后通过持久化页面配置完成，不要求用户传此开关；这不等同于应用导航隐藏 |
| `--locale` | 否 | 页面内容语言：`zh_CN`、`en_US`、`ja_JP`；省略时按当前环境选择 |
| `--open` / `--no-open` | 否 | 控制成功后是否返回浏览器打开提示，由宿主执行打开，不影响页面配置 |

优先使用上表参数。兼容别名：`--hide-navigation` / `--no-nav` 等同于 `--hide-nav`；`--render-nav false`（也接受 `--is-render-nav` / `--isRenderNav`）要求隐藏，`true` 保持默认；多个导航参数以最后一个为准。`--content-locale` / `--lang` 等同于 `--locale`。本命令自动输出结果 JSON，不提供专用 `--json` 参数。

使用 `--hide-nav` 时，页面级配置与回读已包含在创建命令中，不需要常规追加 `update-form-config`。已确认的自定义应用导航隐藏在应用设置更新时同步保存，与这里的页面级配置分开执行。

默认生成页面导航可见；仅说“看板 / 驾驶舱 / 首页 / 门户 / 工作台”不等于隐藏导航。

## 输出

```json
{"success":true,"pageCreated":true,"pageId":"FORM-XXX","pageName":"驾驶舱","appType":"APP_XXX","mode":"dashboard","hideNavRequested":false,"hideNav":false,"chromeless":false,"navigationVerification":null,"url":"{base_url}/APP_XXX/workbench/FORM-XXX","workbenchUrl":"{base_url}/APP_XXX/workbench/FORM-XXX","dashboardConfigWarning":null}
```

隐藏导航时，`navigationVerification` 记录 `requestedRenderNav:false`、实际 `renderNav`、`verified` 和配置次数 `attempts`。回读优先使用平台的 `renderNav`，缺少该字段时才读 `isRenderNav`；布尔值及字符串 `"true"` / `"false"` 均可识别，缺失值不会当成隐藏成功。

补写后仍未确认时，命令以非零退出码返回 `success:false`、`pageCreated:true`、真实 `pageId` 和 `CREATE_PAGE_NAVIGATION_NOT_VERIFIED`。此时 `hideNav` 表示回读结果，未知为 `null`，`chromeless:false`；按 `recovery` 提供的参数对原页面执行 `update-form-config`，再用 `get-form-config --json` 确认。不要重跑创建命令，也不要用 URL 中的 `isRenderNav=false` 代替配置回读。

原生门户回读确认后返回 `formType: "portal"`、`readbackVerified: true` 和 `designerUrl`。收到 `CREATE_PAGE_PORTAL_NOT_VERIFIED` 时，按返回的 `recovery` 对该 `pageId` 执行 `get-form-config`。

> 如需创建表单页面（带字段的数据收集页），请使用 `yida-create-form-page`。

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| 命令返回失败 | 检查 appType 是否正确，确认登录态有效（`openyida env`） |
| 返回 JSON 中无 pageId | 先用 `list-forms` 核对是否已创建，找到页面后复用；不要因缺少返回值直接重跑创建 |
| 页面名称重复 | 宜搭允许同名页面，但建议使用唯一名称避免混淆 |
