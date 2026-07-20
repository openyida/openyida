---
name: yida-create-app
description: 创建宜搭应用并返回 appType；仅当没有目标 app 且用户意图允许新建时使用。schema-managed 应用由根技能或明确 context 路由到 schema workflow。
---

# 创建应用

> 资源边界：本技能只处理普通 OpenYida 资源；若根技能、上下文或 CLI guard 显示目标是 schema-managed，停止本技能并走 schema workflow；目标不明时回到根技能确认。
> direct/standalone 路径才可执行本技能；schema-managed 路径必须回到 schema validate → plan → apply，不在本技能内降级写入。

## Resource-First 使用门槛

本技能不是完整搭建的默认第一步，只能在以下条件同时满足时加载/执行：

1. 根技能或 `yida-app` 已完成 `resolve_resource_context`；
2. 没有从本轮 prompt、应用 URL、agent bound context、workspace config/cache 或会话历史解析到目标 `appType`；
3. 用户明确要求从零创建应用，或完整搭建缺少 app 且 `allowCreate=true`。

若已解析到 `appType`、应用 URL、bound app 或 workspace 中可确认的 standalone app，必须复用该 app 并继续后续表单/页面/发布步骤，不得调用 `openyida create-app`。若用户说“新建另一个应用”，先确认目标组织和新应用名，再执行本技能。

若该 app 是 yida-agent / 宿主预创建的占位 app（例如名称为“新应用”“未命名”“占位”或 `APP_xxx` 样式，且 context 标记 `source=agent_bound`、`precreated=true`、`allowRename !== false`），也仍然视为“已有目标 app”：不得调用 `openyida create-app`。占位名修正由 `yida-app` 在最小需求分析得到稳定语义应用名后调用 `openyida update-app <appType> --name "<语义应用名>"` 完成；本技能只负责在确实没有目标 app 且允许创建时新建应用。

## 严格禁止 (NEVER DO)
- 不要编造 appType，必须从命令返回的 JSON 中提取
- 不要在未确认 corpId 的情况下创建应用（先运行 `openyida env` 确认登录态）
- 不要在同一轮已成功创建应用后重复创建。若接口明确返回名称冲突，单点任务先询问用户；`yida-app fast_build` 可追加短后缀重试一次，不要为了查重额外探测。
- 已有 `appType`、应用 URL、bound app 或 workspace app 时，不要创建新应用；除非用户明确要求新建另一个应用并确认。

## 严格要求 (MUST DO)

- 创建成功后，将 appType 记录到 `.cache/<项目名>-schema.json`
- 创建前确认当前登录的组织（corpId）与目标组织一致
- **本技能不读写 memory**：appType 等信息输出到 stdout，通过 `.cache/<项目名>-schema.json` 持久化，不依赖跨会话的 memory 状态

## 适用场景

用户说"从零创建应用"、"新建另一个系统"、"新建应用并返回 appType"，且 resource context 没有目标 app 时使用此技能。
创建应用后，通常需要继续执行：创建/更新表单（`yida-create-form-page`）→ 创建或复用页面（`yida-create-page` / existing page）→ 发布页面（`yida-publish-page`）。
后续如果需要自定义页面，默认走 Code Canvas 链路：源码写到 `project/pages/src/<页面名>.canvas.jsx`，通过 Canvas 编译链路发布。用户明确要求普通自定义页面 JSX/Jsx 组件链路，或页面强依赖普通自定义页实例桥（`this.$(fieldId)`、`this.utils.yida.*`、`this.dataSourceMap`、表单提交或字段双向绑定深度耦合）时，选择 `.oyd.jsx` / `.jsx` 并执行 `openyida check-page` / `openyida compile`。

---

## 命令

```bash
openyida create-app <appName> [description] [icon] [iconColor] [colour] [navTheme] [layoutDirection]
```

| 参数 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `appName` | 是 | — | 应用名称 |
| `description` | 否 | 同 appName | 应用描述 |
| `icon` | 否 | `xian-yingyong` | 图标标识（见下方图标表） |
| `iconColor` | 否 | `#0089FF` | 图标背景色 |
| `colour` | 否 | `deepBlue` | 主题色（见下方主题色表） |
| `navTheme` | 否 | 不传 | 导航风格：仅用户明确要求时传 `dark`（深色）/ `light`（浅色） |
| `layoutDirection` | 否 | 不传 | 导航布局：仅用户明确要求时传 `slide`（侧边栏）/ `ver`（L 型顶导） |

## 行业默认创建建议

如果用户只说“创建一个律所/茶叶官网/数据大屏应用”，不要直接使用通用默认壳。先按行业选择图标、主题色和首屏自定义页模板：

| 场景语义 | create-app 推荐参数 | 创建后的首屏页面 |
|------|------|------|
| 律所、律师、法律服务、法务合规 | `xian-falv #5C72FF greyBlue` | `official-homepage`，走专业服务官网叙事 |
| 茶叶、茶园、生态、环保、健康品牌 | `xian-diqiu #00B853 teal` | `official-homepage`，走品牌官网叙事 |
| 数据大屏、实时监控、预警系统、态势屏、水质/IoT | `xian-baogao #14A9FF greyBlue` | `data-screen`，走沉浸式指挥舱 |
| 咨询、审计、会计、投顾、企业服务 | `xian-qiye #5C72FF royalBlue` | `official-homepage` 或工作台，按用户目标选择 |
| 普通内部管理、CRM、OA、项目管理 | 可使用默认或用户指定参数 | `product-homepage --scene workbench` |

CLI 已内置上述行业推断：当用户没有显式传 `icon/iconColor/colour` 时，会根据应用名和描述自动补齐；`navTheme/layoutDirection` 默认不传，只有用户明确要求时才传。显式参数始终优先。

**主题色（colour）可选值**：

默认不要把黑色、深灰或灰黑中性色作为普通应用主题色。创建业务系统、工作台、门户、数据管理类应用时，优先选择蓝、青、绿、紫、橙等有品牌识别度的主题；`black` 仅在用户明确要求暗色模式、高对比、奢侈品牌或极简黑色视觉时使用，`greyBlue` 也只在工业制造、技术工程等稳重场景下使用。

| 值 | 颜色 | 适合场景 |
|------|------|------|
| `deepBlue` | 深蓝 | 政务、金融、法律、企业管理、正式场合 |
| `podBlue` | 蓝色 | 科技、教育、通用办公、SaaS 应用 |
| `royalBlue` | 皇家蓝 | 高端商务、专业服务、企业级应用 |
| `lightBlue` | 浅蓝 | 清新简约、云服务、通讯社交 |
| `teal` | 青色 | 医疗健康、环保、清新简洁类应用 |
| `podGreen` | 绿色 | 农业、环保、健康、生态 |
| `deepPurple` | 深紫 | 创意设计、艺术、高端品牌 |
| `purple` | 紫色 | 女性用户、美妆、时尚、创新科技 |
| `podOrange` | 橙色 | 活力、电商、餐饮、娱乐、社交 |
| `yellow` | 黄色 | 儿童教育、阳光活力、警示提醒 |
| `magenta` | 玖红色 | 时尚、创意、社交、娱乐类应用 |
| `red` | 红色 | 党建、政务、新闻、紧急类应用 |
| `greyBlue` | 灰蓝 | 稳重商务、工业制造、技术工程 |
| `coffee` | 咖啡 | 传统行业、文化教育、复古风格 |
| `black` | 黑色 | 极简设计、奢侈品牌、科技前沿 |

## 输出

```json
{"success":true,"appType":"APP_XXX","appName":"考勤管理","url":"{base_url}/APP_XXX/admin"}
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

## 代码示例

> 需要参考完整应用创建流程时，执行以下命令获取示例，再用 `read_file` 读取：

```bash
openyida sample yida-create-app ipd-app-template   # 完整应用创建示例（含多页面/表单/仪表盘的 IPD 应用模板）
```

## 创建后交付约定

- 将 `appType`、页面 `formUuid`、表单 `fieldId` 写入 `.cache/<项目名>-schema.json`，PRD 只保留业务语义。
- 自定义页面源码默认使用 `.canvas.jsx`，通过 `yida-canvas-custom-page` / `openyida generate-page` 生成并走 Canvas 编译发布；明确要求普通自定义页面 JSX/Jsx 组件链路，或强依赖普通自定义页实例桥时才使用 `.oyd.jsx` / `.jsx`，并遵循 `yida-custom-page` 的事件绑定、timestamp 隐藏节点、loading 兜底等规范。
- 造测试数据或修旧数据时，可以用 Python 或 JS 编写 `.cache/` 下的一次性脚本；优先选择更快更清晰的方式，但字段 ID 和记录 ID 必须来自真实查询。

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| 命令返回失败（非 success） | 检查登录态（`openyida env`），确认 corpId 正确 |
| 应用名称重复 | 询问用户是否使用已有应用，或修改应用名称后重试 |
| 登录态失效（401） | 执行 `openyida login` 重新登录后重试 |
| 返回 JSON 中无 appType | 不要猜测 appType，重新执行命令获取 |
