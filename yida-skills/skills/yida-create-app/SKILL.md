---
name: yida-create-app
description: 创建宜搭应用并返回 appType；仅当没有目标 app 且用户意图允许新建时使用。
---

# 创建应用

> 资源边界：本技能只处理普通 OpenYida 应用创建；目标不明时先只读确认或询问用户。

创建成功结果同时包含 `url` / `appUrl` / `workbenchUrl`（应用工作台）和 `adminUrl`（开发者管理后台）。完整应用最终交付默认保留 `adminUrl`，与前台、可选业务后台区分；不因云端登录态省略。地址可生成不等于收件人已获得管理权限。历史结果缺少该字段时可通过 `app-list` 分页匹配真实 `appType` 回查。

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
- 若完整搭建已确认 PRD 和视觉设计，创建成功后不得回写 `.cache/openyida/<项目名>/requirement-brief.json`，也不得仅因拿到真实 `appType` 重新生成或校验 PRD 和视觉设计；真实 `appType` 只写入 schema 或当前任务资源上下文。
- 创建前确认当前登录的组织（corpId）与目标组织一致
- **本技能不读写 memory**：appType 等信息输出到 stdout，通过 `.cache/<项目名>-schema.json` 持久化，不依赖跨会话的 memory 状态

## 适用场景

用户说"只创建应用壳"、"新建应用并返回 appType"，且 resource context 没有目标 app 时使用此技能。
创建应用后，若任务只是创建应用壳则返回真实 `appType` 即可；若继续完整搭建，把真实 `appType` 写入 `.cache/<项目名>-schema.json` 或当前任务资源上下文，然后直接按已经确认的 PRD 与视觉设计执行：创建/更新表单（`yida-create-form-page`）→ 创建或复用页面（`yida-create-page` / existing page）→ 发布页面（`yida-publish-page`）。
后续如果需要自定义页面，源码写到 `project/pages/src/<页面名>.canvas.jsx` 并发布。

---

## 命令

```bash
openyida create-app --name <appName> [--desc <description>]
# 提取返回的 appType 后，单独更新应用基础设置
openyida update-app <appType> --theme-file <app-theme.css> --nav-theme light --logo-source appIcon --layout <side|top|l_shape>
```

`openyida create-app` 不支持 `--json` 参数；不要添加 `--json`。创建成功时命令本身会输出一行 JSON，从该输出中提取 `appType`。

### 千问办公调用约定

仅在当前宿主为千问办公（QwenWork）时执行以下约定；可复用已确认的宿主信息，需核实时单独执行 `openyida env --json`，以 `active.toolId=qwenwork` 为准。其他云端、Codex 等环境沿用各自的命令与浏览器交接方式。

- 使用 Bash 工具单独执行一条 `openyida create-app` 命令，添加 `--quiet --no-open`，保留本次已确定的名称、描述等业务参数；已有 `--open` 时替换为 `--no-open`。
- 命令直接以 `openyida create-app` 开头；工作目录通过工具参数指定。不要包装成脚本、命令替换或变量赋值，也不要拼接 `cd`、管道 `|`、重定向（如 `>`、`2>&1`）、分号、`&&`、`||` 或其他命令；不要追加 `echo`、`wc`、查询或验证命令。
- 保留 Bash 返回的原始 stdout、stderr 和退出码，直接交给宿主 Hook；不要截断、过滤、重定向或用自行整理的文本替换工具输出。宿主 Hook 从成功结果的顶层 `url` 接管侧边栏开页，AI 不再主动调用浏览器重复打开。
- `--no-open` 只关闭 `browser_handoff` 提示，成功结果仍包含 `url`、`appType` 等字段。侧边栏是否打开不作为创建成功依据；按返回结果记录真实 `appType`，不要因未开页而重跑创建。
- 原始工具输出保留后，继续本次已授权的搭建步骤。Schema 文件使用文件写入工具保存，后续主题更新或必要查询通过新的工具调用执行。

千问办公示例（整行单独执行）：

```bash
openyida create-app "客户管理" --quiet --no-open
```

### 参数

| 参数 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `appName` | 是 | — | 应用名称 |
| `description` | 否 | 同 appName | 应用描述 |
| `icon` | 否 | 见下文 | 显式指定优先；否则优先使用命中的行业图标，仅未命中行业时从平台系统图标中随机选择 |
| `iconColor` | 否 | 见下文 | 创建时的图标颜色；后续 `update-app --theme-file` 会同步为 CSS 主色 |

以下参数只用于 `update-app <appType>`，不能传给 `create-app`：

| 更新参数 | 作用 |
|---------|------|
| `--colour` / `--theme` | 平台主题 key，例如 `podBlue`、`podGreen`、`podOrange`、`black`、`custom`；禁止填写 HEX、RGB 或自造名称 |
| `--nav-theme` | `light` / `dark` / `white` / `gray` |
| `--layout` | 顶部传 `top`、侧边传 `side`、L 型传 `l_shape`；CLI 写入接口字段 `layoutDirection`，使用平台导航时同时传 `--show-app-nav` |
| `--theme-file` | 上传主题 CSS，保存 `customThemeStyle` 资源及从 CSS 提取的 `themeColor` |
| `--theme-color` | 仅更新应用主色；与主题文件同传时以 CSS 主色为准 |
| `--logo-source` | `appIcon` / `customImage`；后者要求应用已有 `homepageLogo` |
| `--hide-app-nav` / `--show-app-nav` | 隐藏或显示应用原生导航 |

主题确认后立即生成 CSS，可与表单创建和页面开发并行；真实 appType 与 CSS 就绪后立即更新，不等待页面完成。OpenYida 统一在 CSS 生成后通过一次 `update-app` 同步 `colour`、`themeColor`、`customThemeStyle`、`navTheme`、`logoSource`、`layoutDirection` 和导航显隐。创建命令不接受或提交这些设置字段。

## 创建应用壳层兜底

如果用户只说“创建一个律所/茶叶官网/数据大屏应用”，先由 `yida-design` 根据行业、品牌、业务情绪和视觉目标设计任意合适的品牌色，禁止把行业词直接映射成固定颜色。把完整色盘写入应用主题 CSS；获得真实 appType 后，必须执行 `update-app --theme-file` 上传该文件并保存到应用基础设置，同时保存导航主题、Logo 来源和导航布局。

创建命令只提交名称、描述、图标和必要的创建标记，不推断或提交应用主题与导航配置。创建完整应用、使用 PRD/design.md 或用户要求配置主题时，主题更新命令默认传入主题文件；只有用户明确只创建空壳或暂不配置主题时才跳过主题更新。搭建流程必须采用先 `create-app`、再 `update-app --theme-file` 的两个步骤。`create-app` 不接受 `--theme-file` 和 `--logo-source`，也不接受 `--colour`、`--theme`、`--nav-theme`、`--layout` 或旧位置参数里的主题与布局，不隐式执行应用设置更新。

CLI 始终按“显式 `--icon` → 行业推断 → 随机系统图标”的顺序选择图标，只有未显式指定且未命中行业时才随机，与后续是否更新主题文件无关。主题文件生成后按 PRD 在 `update-app --layout` 中显式设置布局；用户未指定布局时按业务场景选择，不固定使用 `l_shape`。参数映射与保存后核对遵守 [平台导航参数](../yida-app/workflow/step-3-create-or-reuse-app.md#平台导航参数)。在 `update-app --theme-file` 步骤中校验 CSS 并将图标颜色统一为 `--color-brand1-6` 转换后的 HEX；导航配置沿用 PRD，普通浅色方案显式传 `--nav-theme light --logo-source appIcon`。

**应用主题（colour）口径**：

默认不要把黑色、深灰或灰黑中性色作为普通应用主题色。创建业务系统、工作台、门户、数据管理类应用时，先根据行业、品牌、业务情绪和视觉目标做创意色彩判断；`podBlue`、`podGreen`、`podOrange` 只是常用浅底候选，不是固定默认，也不是行业刻板答案。`black` 仅在用户明确要求暗色模式、高对比、奢侈品牌或极简黑色视觉时使用，`greyBlue` 也只在工业制造、技术工程等稳重场景下作为 fallback。

主题颜色不受平台预置 key 限制。先执行以下命令复制内置主题模板，再定点修改品牌相关 token：

```bash
openyida sample yida-design app-theme --output .cache/openyida/<项目名>/app-theme.css --design-file prd/<项目名>/design.md
```

将任意设计主色写入 `--color-brand1-6` 后执行：

```bash
openyida create-app --name "<应用名>" --desc "<描述>"
# 从创建结果提取 appType 后执行；以下为 PRD 选择平台顶部导航的示例
openyida update-app <appType> --theme-file <app-theme.css> --nav-theme light --logo-source appIcon --layout top --show-app-nav
```

CLI 校验主题文件完整声明平台实际生成的 `--color-brand1-1/2/3/5/6/9/10`，允许缺少 4/7/8。`update-app --theme-file` 联合保存 CSS 资源、主色及导航设置；系统应用图标会同步保存为 `iconName%%主题色HEX`，图片图标保持原值。

`colour` 只保存平台 key，实际色值保存在 `themeColor`。导入主题文件时自动使用 `colour=custom`，无需手动填写；显式 `--colour custom` 需要主题文件或有效主题色，已有有效主题色可沿用。平台预置 key 不能与自定义 CSS 或 `--theme-color` 同传；切换预置主题会清空旧自定义 CSS。

按[主题上传与绑定](../../references/execution-rules.md#主题上传与绑定)核对本轮 `themeUpload` 与绑定回读。仅 `verified=true` 不证明上传；失败先只读核实，保留 appType 和已上传资源，不盲目重传或重建。CSS 修改后旧回执失效；页面效果仅由本地 Agent 按验收规则核验。

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

**图标背景色**：`update-app --theme-file` 时固定跟随 CSS 的 `--color-brand1-6`；下面这些颜色仅用于应用创建时的初始图标：`#0089FF` `#00B853` `#FFA200` `#FF7357` `#5C72FF` `#85C700` `#FFC505` `#FF6B7A` `#8F66FF` `#14A9FF`

## 创建后交付约定

- 将 `appType`、页面 `formUuid`、表单 `fieldId` 写入 `.cache/<项目名>-schema.json`，PRD 只保留业务语义。
- 自定义页面源码默认使用 `.canvas.jsx`，完成编写后发布。
- 造测试数据或修旧数据时，可以用 Python 或 JS 编写 `.cache/` 下的一次性脚本；优先选择更快更清晰的方式，但字段 ID 和记录 ID 必须来自真实查询。

## 千问办公权限处理

执行 `openyida create-app`，以 CLI 返回的权限结果和申请指引为准。

返回 `status=permission_required` 时，暂停后续搭建，展示 CLI 的错误说明和 `nextStep` 中的具名申请链接；未返回链接时保留原因。仅提供指引，等待用户处理并要求继续后再执行，不因权限不足重新登录或重复创建。

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| 命令返回失败（非 success） | 按 CLI 返回的错误说明和下一步指引处理；权限不足时暂停 |
| 应用名称重复 | 询问用户是否使用已有应用，或修改应用名称后重试 |
| 登录态失效（401） | 按 `yida-login` 的认证快照处理；千问办公复用宿主的身份处理，不因权限申请另发起登录 |
| 返回 JSON 中无 appType | 不猜测 appType；先核实失败原因及创建结果，确认可安全重试后再执行 |
