---
name: yida-create-app
description: 创建宜搭应用并返回 appType；仅当没有目标 app 且用户意图允许新建时使用。
---

# 创建应用

> 资源边界：本技能只处理普通 OpenYida 应用创建；目标不明时先只读确认或询问用户。

## Resource-First 使用门槛

本技能不是完整搭建的默认第一步，只能在以下条件同时满足时加载/执行：

1. 根技能或 `yida-app` 已完成 `resolve_resource_context`；
2. 没有从本轮 prompt、应用 URL、已绑定资源上下文、workspace 配置/缓存或会话历史解析到目标 `appType`；
3. 用户明确要求从零创建应用，或完整搭建缺少 app 且 `allowCreate=true`。

若已解析到 `appType`、应用 URL、已绑定 app 或 workspace 中可确认的 app，必须复用该 app 并继续后续表单/页面/发布步骤，不得调用 `openyida create-app`。若用户说“新建另一个应用”，先确认目标组织和新应用名，再执行本技能。

若该 app 是外部工具预创建的 app（上下文标记 `source=agent_bound` 或 `precreated=true`），也仍然视为“已有目标 app”：不得调用 `openyida create-app`，也不得在本技能中修改应用名称。本技能只负责在确实没有目标 app 且允许创建时新建应用。

## 严格禁止 (NEVER DO)
- 不要编造 appType，必须从命令返回的 JSON 中提取
- 不要在未确认 corpId 的情况下创建应用（先运行 `openyida env` 确认登录态）
- 不要在同一轮已成功创建应用后重复创建。若接口明确返回名称冲突，单点任务先询问用户；`yida-app` 完整应用统一编排可追加短后缀重试一次，不要为了查重额外探测。
- 已有 `appType`、应用 URL、已绑定 app 或 workspace app 时，不要创建新应用；除非用户明确要求新建另一个应用并确认。

## 严格要求 (MUST DO)

- 创建成功后，将 appType 记录到 `.cache/<项目名>-schema.json`
- 创建成功后，把真实 `appType` 交给 `yida-design` 生成或更新 `prd/<项目名>/prd.md` 与 `prd/<项目名>/design.md`；后续表单、流程、页面和发布都按 PRD 执行业务，按 design.md 执行视觉。
- 创建前确认当前登录的组织（corpId）与目标组织一致
- **本技能不读写 memory**：appType 等信息输出到 stdout，通过 `.cache/<项目名>-schema.json` 持久化，不依赖跨会话的 memory 状态

## 适用场景

用户说"只创建应用壳"、"新建应用并返回 appType"，且 resource context 没有目标 app 时使用此技能。
创建应用后，先用 `yida-design` 产出或更新 PRD，再继续执行：创建/更新表单（`yida-create-form-page`）→ 创建或复用页面（`yida-create-page` / existing page）→ 发布页面（`yida-publish-page`）。
后续如果需要自定义页面，源码写到 `project/pages/src/<页面名>.canvas.jsx` 并发布。

---

## 命令

```bash
openyida create-app --name <appName> [--desc <description>] [--theme-file <app-theme.css> --nav-theme <light|dark|white|gray> --logo-source appIcon --layout <side|top|l_shape>]
```

`openyida create-app` 不支持 `--json` 参数；不要添加 `--json`。创建成功时命令本身会输出一行 JSON，从该输出中提取 `appType`。

| 参数 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `appName` | 是 | — | 应用名称 |
| `description` | 否 | 同 appName | 应用描述 |
| `icon` | 否 | 见下文 | 显式指定优先；否则优先使用命中的行业图标，仅未命中行业时从平台系统图标中随机选择 |
| `iconColor` | 否 | 见下文 | 传主题文件时统一跟随 `--color-brand1-6` 的 HEX 值；未传主题文件时保留兼容默认值 |
| `themeFile` | 否，推荐 | — | 基于 `yida-design/references/theme/app-custom-theme-template.css` 生成的 CSS；必须完整声明平台实际生成的 `--color-brand1-1/2/3/5/6/9/10`，不要补造 `4/7/8`；其中 `--color-brand1-6` 必须为字面量，CLI 自动以它保存 `themeColor` |
| `navTheme` | 否 | `themeFile` 场景默认 `light` | 导航风格：`light` / `dark` / `white` / `gray` |
| `logoSource` | 否 | `themeFile` 场景默认 `appIcon` | 新建应用只支持应用图标；`customImage` 需要已有 `homepageLogo`，只在已有应用更新时使用 |
| `layoutDirection` | 否 | `l_shape` | 新建应用默认使用 L 型导航；可显式改为 `side`（侧边）/ `top`（顶部）/ `l_shape`（L 型） |

## 创建应用壳层兜底

如果用户只说“创建一个律所/茶叶官网/数据大屏应用”，先由 `yida-design` 根据行业、品牌、业务情绪和视觉目标设计任意合适的品牌色，禁止把行业词直接映射成固定颜色。把完整色盘写入应用主题 CSS；创建命令负责创建应用后立即上传该文件，并联合保存导航主题、Logo 来源和导航布局。

| 场景语义 | CLI 壳层 fallback 主题（非设计结论） | create-app 壳层 fallback | 创建后的首屏页面 |
|------|------|------|------|
| 律所、律师、法律服务、法务合规 | `podBlue` | `xian-falv #5C72FF podBlue` | `official-homepage`，走专业服务官网叙事 |
| 茶叶、茶园、生态、环保、健康品牌 | `podGreen` | `xian-diqiu #00B853 podGreen` | `official-homepage`，走品牌官网叙事 |
| 数据大屏、实时监控、预警系统、态势屏、水质/IoT | `podBlue` | `xian-baogao #14A9FF podBlue` | `data-screen`，走沉浸式指挥舱 |
| 咨询、审计、会计、投顾、企业服务 | `podBlue` | `xian-qiye #5C72FF podBlue` | `official-homepage` 或工作台，按用户目标选择 |
| 普通内部管理、CRM、OA、项目管理 | `podBlue`，业务强调增长/活力时可选 `podOrange` | 可使用默认或用户指定参数 | `product-homepage --scene workbench` |

CLI 内部的 `colour` 仅用于 `registerApp` 创建阶段兼容，不作为新版主题设计结果。完整应用、带 PRD/design.md 的应用和用户要求新版主题时，默认推荐传主题文件；只有用户明确只要兼容空壳、暂不配置主题或需要保留旧创建方式时才省略。省略 `--theme-file` 不报错，也不会上传或伪造主题配置。

CLI 始终按“显式 `--icon` → 行业推断 → 随机系统图标”的顺序选择图标，只有未显式指定且未命中行业时才随机，与是否传主题文件无关。所有新建应用未显式传 `--layout` 时默认使用 `layoutDirection=l_shape`。传入主题文件时，CLI 还会在创建前校验 CSS，并将图标颜色统一为 `--color-brand1-6` 转换后的 HEX；未显式指定主题导航配置时使用 `navTheme=light`、`logoSource=appIcon`。

**应用主题（colour）口径**：

默认不要把黑色、深灰或灰黑中性色作为普通应用主题色。创建业务系统、工作台、门户、数据管理类应用时，先根据行业、品牌、业务情绪和视觉目标做创意色彩判断；`podBlue`、`podGreen`、`podOrange` 只是常用浅底候选，不是固定默认，也不是行业刻板答案。`black` 仅在用户明确要求暗色模式、高对比、奢侈品牌或极简黑色视觉时使用，`greyBlue` 也只在工业制造、技术工程等稳重场景下作为 fallback。

主题颜色不受平台预置 key 限制。读取 `yida-design/references/theme/app-custom-theme-template.css` 生成主题文件，将任意设计主色写入 `--color-brand1-6`，再执行：

```bash
openyida create-app --name "<应用名>" --desc "<描述>" --theme-file <app-theme.css> --nav-theme light --logo-source appIcon --layout l_shape
```

CLI 会先校验主题文件完整声明平台实际生成的 `--color-brand1-1/2/3/5/6/9/10`，并允许不存在 `--color-brand1-4/7/8`。创建成功后在同一流程中上传 CSS，并联合保存从 `--color-brand1-6` 提取的 `themeColor`、`customThemeStyle`、`navTheme`、`logoSource` 和 `layoutDirection`。创建或更新主题时，系统应用图标会同步保存为 `iconName%%主题色HEX`；外链或上传图片图标保持原值。运行容器会在自定义页面、表单、提交页和 formDetail 中加载同一应用主题文件。

完整应用主题 key、颜色倾向和 token 变量统一维护在 `yida-design/references/theme/theme-token-presets.md`，本技能不重复维护完整清单。

## 输出

```json
{"success":true,"appType":"APP_XXX","appName":"考勤管理","url":"{base_url}/APP_XXX/workbench"}
```

## 图标列表

| 名称 | 标识 | | 名称 | 标识 |
|------|------|-|------|------|
| 新闻 | `xian-xinwen` | | 地球 | `xian-diqiu` |
| 政府 | `xian-zhengfu` | | 汽车 | `xian-qiche` |
| 应用 | `xian-yingyong` | | 飞机 | `xian-feiji` |
| 学术帽 | `xian-xueshimao` | | 电脑 | `xian-diannao` |
| 企业 | `xian-qiye` | | 工作证 | `xian-gongzuozheng` |
| 单据 | `xian-danju` | | 购物车 | `xian-gouwuche` |
| 市场 | `xian-shichang` | | 信用卡 | `xian-xinyongka` |
| 经理 | `xian-jingli` | | 活动 | `xian-huodong` |
| 法律 | `xian-falv` | | 奖杯 | `xian-jiangbei` |
| 报告 | `xian-baogao` | | 流程 | `xian-liucheng` |
| 火车 | `huoche` | | 查询 | `chaxun` |
| 申报 | `shenbao` | | 打卡 | `daka` |

**图标背景色**：新版主题固定跟随 CSS 的 `--color-brand1-6`；下面这些颜色仅用于未传主题文件的兼容创建：`#0089FF` `#00B853` `#FFA200` `#FF7357` `#5C72FF` `#85C700` `#FFC505` `#FF6B7A` `#8F66FF` `#14A9FF`

## 创建后交付约定

- 将 `appType`、页面 `formUuid`、表单 `fieldId` 写入 `.cache/<项目名>-schema.json`，PRD 只保留业务语义。
- 自定义页面源码默认使用 `.canvas.jsx`，完成编写后发布。
- 造测试数据或修旧数据时，可以用 Python 或 JS 编写 `.cache/` 下的一次性脚本；优先选择更快更清晰的方式，但字段 ID 和记录 ID 必须来自真实查询。

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| 命令返回失败（非 success） | 检查登录态（`openyida env`），确认 corpId 正确 |
| 应用名称重复 | 询问用户是否使用已有应用，或修改应用名称后重试 |
| 登录态失效（401） | 执行 `openyida login` 重新登录后重试 |
| 返回 JSON 中无 appType | 不要猜测 appType，重新执行命令获取 |
