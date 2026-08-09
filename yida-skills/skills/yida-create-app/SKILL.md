---
name: yida-create-app
description: 创建宜搭应用并返回 appType。仅在没有目标 app 且允许新建时使用。不是完整应用入口。
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
- 创建成功后，把真实 `appType` 写入 `.cache/<项目名>-schema.json`，并交给当前编排步骤继续使用。
- 创建前确认当前登录的组织（corpId）与目标组织一致
- **本技能不读写 memory**：appType 等信息输出到 stdout，通过 `.cache/<项目名>-schema.json` 持久化，不依赖跨会话的 memory 状态

## 适用场景

用户说"只创建应用壳"、"新建应用并返回 appType"，且 resource context 没有目标 app 时使用此技能。
完整应用场景下，本技能只返回真实 `appType`；后续步骤由 `yida-app` 阶段表继续编排。

---

## 命令

```bash
openyida create-app <appName> [description] [icon] [iconColor] [colour] [navTheme] [layoutDirection]
```

`openyida create-app` 不支持 `--json` 参数；不要添加 `--json`。创建成功时命令本身会输出一行 JSON，从该输出中提取 `appType`。

| 参数 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `appName` | 是 | — | 应用名称 |
| `description` | 否 | 同 appName | 应用描述 |
| `icon` | 否 | `xian-yingyong` | 图标标识（见下方图标表） |
| `iconColor` | 否 | `#0089FF` | 图标背景色 |
| `colour` | 否 | 平台默认 | 平台壳层应用主题 key；只在 PRD 的 `shouldPassCreateAppTheme=true` 且 `themePresetKey` 命中平台预置 key 时传。自定义品牌色不要传 `colour/theme`，改由页面或全局 `style#yida-global-theme` / `customThemeStyle.tokens` 注入 |
| `navTheme` | 否 | 不传 | 导航风格：仅用户明确要求时传 `dark`（深色）/ `light`（浅色） |
| `layoutDirection` | 否 | 不传 | 导航布局：仅用户明确要求时传 `slide`（侧边栏）/ `ver`（L 型顶导） |

## 创建应用壳层兜底

完整应用的主题结论由 `yida-design` 产出。本技能读取 PRD 中的 `shouldPassCreateAppTheme` 和 `themePresetKey`：命中平台预置 key 才传 `colour/theme`，否则不传主题。

| 场景语义 | CLI 壳层 fallback 主题（非设计结论） | create-app 壳层 fallback | 创建后的首屏页面 |
|------|------|------|------|
| 律所、律师、法律服务、法务合规 | `podBlue` | `xian-falv #5C72FF podBlue` | `official-homepage`，走专业服务官网叙事 |
| 茶叶、茶园、生态、环保、健康品牌 | `podGreen` | `xian-diqiu #00B853 podGreen` | `official-homepage`，走品牌官网叙事 |
| 数据大屏、实时监控、预警系统、态势屏、水质/IoT | `podBlue` | `xian-baogao #14A9FF podBlue` | `data-screen`，走沉浸式指挥舱 |
| 咨询、审计、会计、投顾、企业服务 | `podBlue` | `xian-qiye #5C72FF podBlue` | `official-homepage` 或工作台，按用户目标选择 |
| 普通内部管理、CRM、OA、项目管理 | `podBlue`，业务强调增长/活力时可选 `podOrange` | 可使用默认或用户指定参数 | `product-homepage --scene workbench` |

CLI 已内置上述行业推断作为创建壳层的兜底能力，不代表 `yida-design` 的主题结论。当用户没有显式传 `icon/iconColor/colour` 时，CLI 会根据应用名和描述自动补齐；`navTheme/layoutDirection` 默认不传，只有用户明确要求时才传。显式参数始终优先。

**应用主题（colour）口径**：

`colour` / `--theme` 只能传宜搭平台预置 key，不能传自定义色值或 AI 自造主题名。完整主题判断和 token 变量查看 `yida-design`，本技能只负责把已确认的平台预置 key 传给创建命令。

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
| 火车 | `huoche` | | 查询 | `xian-chaxun` |
| 申报 | `xian-shenbao` | | 打卡 | `xian-daka` |

**图标背景色**：`#0089FF` `#00B853` `#FFA200` `#FF7357` `#5C72FF` `#85C700` `#FFC505` `#FF6B7A` `#8F66FF` `#14A9FF`

## 创建后交付约定

- 将 `appType`、页面 `formUuid`、表单 `fieldId` 写入 `.cache/<项目名>-schema.json`，PRD 只保留业务语义。
- 自定义页面源码默认使用 `.canvas.jsx`，通过 `yida-canvas-custom-page` 生成或编写并走 Canvas 编译发布；明确要求普通自定义页面 JSX/Jsx 组件链路，或强依赖普通自定义页实例桥时才使用 `.oyd.jsx` / `.jsx`，并遵循 `yida-custom-page` 的事件绑定、timestamp 隐藏节点、loading 兜底等规范。
- 造测试数据或修旧数据时，可以用 Python 或 JS 编写 `.cache/` 下的一次性脚本；优先选择更快更清晰的方式，但字段 ID 和记录 ID 必须来自真实查询。

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| 命令返回失败（非 success） | 检查登录态（`openyida env`），确认 corpId 正确 |
| 应用名称重复 | 询问用户是否使用已有应用，或修改应用名称后重试 |
| 登录态失效（401） | 执行 `openyida login` 重新登录后重试 |
| 返回 JSON 中无 appType | 不要猜测 appType，重新执行命令获取 |
