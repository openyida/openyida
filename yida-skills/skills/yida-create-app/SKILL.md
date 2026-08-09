---
name: yida-create-app
description: 创建宜搭应用并返回 appType。用户只需要新应用壳，或完整应用流程确认缺少目标应用时使用。
---

# 创建应用

> 资源边界：本技能只处理普通 OpenYida 应用创建；目标不明时先只读确认或询问用户。

## 何时使用

只在以下条件同时满足时使用：

1. 根技能或 `yida-app` 已检查现有目标资源；
2. 用户输入、应用 URL、已绑定资源、workspace 配置和缓存中都没有目标 `appType`；
3. 用户明确要求从零创建应用，或完整搭建缺少 app 且 `allowCreate=true`。

已有 `appType`、应用 URL、已绑定 app 或 workspace app 时，复用该应用，不执行 `openyida create-app`。若用户说“新建另一个应用”，先确认目标组织和新应用名。

外部工具预创建且标记 `source=agent_bound` 或 `precreated=true` 的 app 也属于已有应用，不得重复创建或修改应用名称。

## 严格禁止 (NEVER DO)
- 不要编造 appType，必须从命令返回的 JSON 中提取
- 不要在未确认 corpId 的情况下创建应用（先运行 `openyida env` 确认登录态）
- 同一轮成功创建应用后直接使用返回的 `appType`。名称冲突时，单项任务询问用户；完整应用可以追加短后缀重试一次。

## 严格要求 (MUST DO)

- 创建前确认当前登录的组织（corpId）与目标组织一致
- 创建成功后，将真实 `appType` 写入 `.cache/<项目名>-schema.json`，并交给当前步骤继续使用。

完整应用中，本技能只返回真实 `appType`；后续步骤由 `yida-app` 阶段表执行。

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
| `iconColor` | 否 | CLI 默认 | 用户或 `yida-app` 明确给定时传入 |
| `colour` | 否 | 平台默认 | 用户或 `yida-app` 明确给定平台支持的主题 key 时传入 |
| `navTheme` | 否 | 不传 | 导航风格：仅用户明确要求时传 `dark`（深色）/ `light`（浅色） |
| `layoutDirection` | 否 | 不传 | 导航布局：仅用户明确要求时传 `slide`（侧边栏）/ `ver`（L 型顶导） |

## 参数边界

本技能只创建应用壳层并返回 `appType`。应用主题、品牌色、页面视觉和 token 由 `yida-design` 决定；本技能不按行业、场景或应用名推断颜色。

`icon`、`iconColor`、`colour`、`navTheme`、`layoutDirection` 只在用户明确给定或 `yida-app` 上游步骤已给定时传。没有明确值时使用 CLI 和平台默认值。

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

## 创建后交付约定

- 后续页面 `formUuid` 和表单 `fieldId` 由对应技能写入 `.cache/<项目名>-schema.json`。
- 新建自定义页面源码使用 `.canvas.jsx` / `.canvas.tsx`，通过 `yida-canvas-custom-page` 编写并使用 Canvas 编译发布。`yida-custom-page` 只用于修改已确认的存量普通 JSX/Jsx 页面。
- 造测试数据或修旧数据时，可以用 Python 或 JS 编写 `.cache/` 下的一次性脚本；优先选择更快更清晰的方式，但字段 ID 和记录 ID 必须来自真实查询。

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| 命令返回失败（非 success） | 检查登录态（`openyida env`），确认 corpId 正确 |
| 应用名称重复 | 询问用户是否使用已有应用，或修改应用名称后重试 |
| 登录态失效（401） | 执行 `openyida login` 重新登录后重试 |
| 返回 JSON 中无 appType | 不要猜测 appType，重新执行命令获取 |
