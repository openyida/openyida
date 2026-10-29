<div align="center">

# OpenYida

**面向 AI 编程工具的宜搭低代码 CLI。**

OpenYida 把 Codex、Claude Code、Cursor、QwenWork（千问办公）、Qoder 等 AI 编程助手连接到宜搭低代码平台，让开发者可以通过自然语言和命令行完成应用创建、表单建模、流程审批、自定义页面、报表、连接器和发布配置。

[快速开始](#快速开始) · [帮助网站&文档](https://demo.aliwork.com/o/openyida/helpCenter) · [核心能力](#核心能力) · [完整功能列表](https://demo.aliwork.com/o/openyida/helpCenter?openyidaPath=capabilities) · [案例展示](https://demo.aliwork.com/o/openyida/helpCenter?openyidaRoute=showcase) · [自定义页面开发](#自定义页面开发) · [常用命令](https://demo.aliwork.com/o/openyida/helpCenter?openyidaPath=features/skills) · [开发与校验](#开发与校验) · [搭建效果](#搭建效果) · [贡献](./CONTRIBUTING.md)

[![npm version](https://img.shields.io/npm/v/openyida?color=brightgreen&label=npm)](https://www.npmjs.com/package/openyida)
[![npm downloads](https://img.shields.io/npm/dm/openyida?color=blue)](https://www.npmjs.com/package/openyida)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

[English README](./README.md) · [简体中文 README](./README_zhCN.md)
</div>

---

## OpenYida 是什么

OpenYida 是 AI 编程工具和宜搭之间的桥接层。AI Agent 不需要直接猜测宜搭接口或页面运行时细节，而是通过稳定的 `openyida` CLI 完成资源创建、Schema 查询、源码生成、编译发布和诊断。

最终产物仍是原生宜搭应用：团队可以继续在宜搭设计器中编辑，沿用组织权限、安全和部署体系。

## 搭建效果

以下是主题的示例搭建效果，点击图片可查看大图。示例内容不代表一键安装的业务成品；实际页面、数据、品牌色和布局会按你的需求设计。

<table>
  <tr>
    <td width="50%" align="center"><strong>深色侧栏 · 白底细线</strong><br><a href="https://img.alicdn.com/imgextra/i1/O1CN01oFp7XMYEjSI5r31K_!!6000000006946-2-tps-2884-1794.png"><img src="https://img.alicdn.com/imgextra/i1/O1CN01oFp7XMYEjSI5r31K_!!6000000006946-2-tps-2884-1794.png" alt="深色侧栏 · 白底细线搭建效果示例" width="100%"></a></td>
    <td width="50%" align="center"><strong>柔灰嵌白</strong><br><a href="https://img.alicdn.com/imgextra/i3/O1CN01UEEmuLlMF3I5pHky_!!6000000006290-2-tps-2870-1798.png"><img src="https://img.alicdn.com/imgextra/i3/O1CN01UEEmuLlMF3I5pHky_!!6000000006290-2-tps-2870-1798.png" alt="柔灰嵌白搭建效果示例" width="100%"></a></td>
  </tr>
  <tr>
    <td width="50%" align="center"><strong>自然绿意</strong><br><a href="https://img.alicdn.com/imgextra/i1/O1CN01NiHI4pBsbOK5qIC4_!!6000000007377-2-tps-2878-1798.png"><img src="https://img.alicdn.com/imgextra/i1/O1CN01NiHI4pBsbOK5qIC4_!!6000000007377-2-tps-2878-1798.png" alt="自然绿意搭建效果示例" width="100%"></a></td>
    <td width="50%" align="center"><strong>青绿协作</strong><br><a href="https://img.alicdn.com/imgextra/i2/O1CN01hLAdOTwuEWF5qXno_!!6000000004848-2-tps-2880-1796.png"><img src="https://img.alicdn.com/imgextra/i2/O1CN01hLAdOTwuEWF5qXno_!!6000000004848-2-tps-2880-1796.png" alt="青绿协作搭建效果示例" width="100%"></a></td>
  </tr>
  <tr>
    <td width="50%" align="center"><strong>终端像素</strong><br><a href="https://img.alicdn.com/imgextra/i3/O1CN01PPHEYDv6nMB5qXnq_!!6000000004777-2-tps-2880-1798.png"><img src="https://img.alicdn.com/imgextra/i3/O1CN01PPHEYDv6nMB5qXnq_!!6000000004777-2-tps-2880-1798.png" alt="终端像素搭建效果示例" width="100%"></a></td>
    <td width="50%" align="center"><strong>铂金商务</strong><br><a href="https://img.alicdn.com/imgextra/i2/O1CN01eDGhh1WCtFI5soHi_!!6000000007333-2-tps-2898-1792.png"><img src="https://img.alicdn.com/imgextra/i2/O1CN01eDGhh1WCtFI5soHi_!!6000000007333-2-tps-2898-1792.png" alt="铂金商务搭建效果示例" width="100%"></a></td>
  </tr>
</table>

支持**应用主题选择和自由创意**。你可以描述喜欢的风格，也可以提供参考网站或设计图，定制应用外观。[查看更多应用案例](https://demo.aliwork.com/o/openyida/helpCenter?openyidaRoute=showcase)。

## 核心能力

| 领域 | 能力 |
|------|------|
| 应用交付 | 创建、更新、导出、导入宜搭应用 |
| 表单建模 | 创建表单、更新字段、查询 Schema、配置权限 |
| 自定义页面 | 生成 Code Canvas / 普通 JSX 页面、检查、编译、发布 |
| 流程自动化 | 创建流程表单、配置审批流、预览流程实例 |
| 数据管理 | 查询/新增/更新表单、流程、任务、子表数据 |
| 连接器与集成 | 管理 HTTP 连接器、鉴权账号、连接器动作和集成自动化 |
| 运营与诊断 | 登录态、组织上下文、环境诊断、页面分享、CDN 素材上传 |

## 从需求到交付

1. **说明目标**：告诉 AI 谁会使用、要处理什么业务，以及已有应用或参考材料。
2. **说明需求与偏好**：补充必要的业务信息和外观要求；有喜欢的配色、网站或设计图，可以一起提供。
3. **选择搭建方式**：Fast 适合范围清楚、希望直接推进的任务；Plan 先生成可查看的完整方案，经你确认后再创建资源。
4. **检查并继续完善**：交付后查看应用和常用操作，继续提出页面、字段或流程调整。风格选定后会沿用，只有你主动要求更换才重新选型。

美化已有应用同样先确认方案，再按范围备份和实施。不满意时按备份恢复；页面和主题需分别备份，恢复范围会在实施前说明。

## 最近更新

**2026.10.14-1** 改善应用外观定制体验，更好地结合风格描述、参考网站和设计图完成应用设计。[查看完整更新日志](./CHANGELOG.md#20261014-1---2026-10-14)。

## 快速开始

### 1. 安装

```bash
npm install -g openyida
```

OpenYida 要求 Node.js 18 或更高版本。安装后会提供 `openyida` 和 `yida` 两个命令。

通过 npm 全局安装后，OpenYida 至多每天检查一次新版本并自动更新。也可以运行 `openyida update` 手动更新；需要固定版本时，设置 `OPENYIDA_NO_AUTO_UPDATE=1` 关闭自动更新。

<details>
<summary>自动更新的环境与开发配置</summary>

本地终端和 AI 工具使用相同策略；托管云端 Agent 跳过自动更新。开发和测试可使用 `OPENYIDA_AUTO_UPDATE_SECS` 调整检查间隔。

</details>

如果本机已安装 Codex，OpenYida 会在安装后尝试导入本地 Codex 插件。重启 Codex 后，在输入框中输入 `@宜搭` 或 `@openyida` 即可挂载 OpenYida 上下文。

<details>
<summary>可选：安装钉钉 Workspace CLI（dws）</summary>

需要钉钉侧 A2UI 卡片编写、校验或消息操作时，可独立安装官方 [DingTalk Workspace CLI](https://github.com/DingTalk-Real-AI/dingtalk-workspace-cli#installation)：

```bash
npm install -g dingtalk-workspace-cli
dws version
```

也可运行 `openyida dws install` 查看当前平台的官方安装指引；该命令只显示说明。安装后可使用 `openyida dws <command> [args]` 调用系统中的 dws。

OpenYida 不内置或自动安装 dws，其版本、升级和登录由 dws 独立管理。需要访问钉钉业务时使用 `dws auth login`，并核对目标组织与账号。宜搭原生酷卡片的创建、读取和编辑器链接无需安装 dws；dws 当前的聊天卡片更新能力不等同于宜搭模板保存。其他平台安装方式见上述官方说明，具体卡片命令以已安装版本的 `--help` 为准。

</details>

### 2. 检查环境

在 AI 编程工作区中运行：

```bash
openyida agent-capabilities --summary-json
```

该命令会返回紧凑的 OpenYida 版本、登录态、工作区和命令清单摘要。需要完整诊断时再使用 `openyida agent-capabilities --json`；旧版本也可以降级使用：

```bash
openyida env --json
openyida login --check-only --json
```

### 3. 登录

```bash
openyida login
```

OpenYida 默认使用 OAuth token 模式：打开钉钉 OAuth 授权页，通过本地 loopback 回调接收授权码，再由宜搭服务换取并缓存 `access_token` / `refresh_token`。Agent 不需要提取浏览器 Cookie，也不需要手写 `.cache/cookies.json`。

AI 工具中建议登录后用下面任一命令确认 token session 可用：

```bash
openyida login --check-only --json
openyida auth status
```

在千问办公网页态中，`openyida login --qwenwork --json`（或普通 `login`）直接把当前沙箱的 Agent Token 与网关 URL 提交给选定宜搭环境的认证接口。宜搭通过受信任网关的 `/api/agent-gw/yida/user_info` 取得钉钉关联身份，再签发宜搭短期会话；CLI 不再调用旧的 exchange 或 `/user/info`。准备过程静默，失败停止且不回退浏览器 OAuth。桌面与其他宿主保持各自登录路径。

在千问办公云端诊断宿主身份时，可执行 `openyida auth qwenwork user-info --json`。命令读取沙箱注入的 Agent 凭证，兑换用户凭证后查询同一网关的 `/user/info`，仅输出身份与 scope 等元信息，不打印或保存凭证，也不生成宜搭登录态。千问组织 ID 需要通过绑定关系映射，不能直接当作宜搭 `corpId`。原有 OAuth 和 profile 流程保持不变。

如果当前项目要复用已有共享登录 profile，先切换已有 profile，不要直接发起新的 OAuth 登录：

```bash
openyida auth profiles
openyida auth profile switch <auth_profile>
```

目标 profile 不在列表中时，再执行 `openyida login` 新增登录态，随后切到新增 profile。

如果用户给出明确的宜搭入口 URL，需要把 URL 传给登录命令：

```bash
openyida login https://yida-group.alibaba-inc.com/
openyida login --alibaba
```

海外 / Global YiDA 场景使用：

```bash
openyida login --intl
```

### 4. 让 AI Agent 构建应用

可以直接向 AI 编程助手提出业务目标：

```text
帮我创建一个 CRM 应用，包含客户、联系人、商机、跟进记录表单和首页看板。
帮我用 Plan 模式搭建采购管理应用，包含采购申请、审批和看板，先给我看方案。
帮我搭建乌龙茶品牌前台和订单管理后台，用导航分组区分业务入口。
美化这个已有应用，先给我看方案，只改 UI，保留业务逻辑，修改前做好备份。
```

Agent 会读取 `yida-skills/` 中的技能说明，调用 OpenYida CLI 创建应用、表单、页面、流程和报表，并返回最终访问链接。

## 语言包

CLI 默认内置 `zh` 和 `en` 两个核心语言包，以中文为主、英文兜底。其他语言包按需启用：将 `ja.js`、`fr.js` 等文件放到一个外部目录，设置 `OPENYIDA_LOCALE_DIR` 指向该目录，再设置 `OPENYIDA_LANG=ja`。如果目标语言包不可用，OpenYida 会按 `en -> zh` 回退，不影响命令执行。

## 项目结构

```text
openyida/
├── bin/yida.js          # CLI 入口和命令路由
├── lib/                 # 应用、表单、登录、连接器、流程、报表等实现
├── project/             # 默认宜搭项目工作目录模板
├── yida-skills/         # Agent 技能源码和宜搭 API 参考
├── docs/                # 能力说明和补充文档
└── scripts/             # CI、技能打包、E2E 和 eval 工具
```

## 自定义页面开发

OpenYida 当前有两条自定义页面链路，先选链路再写页面：

| 场景 | 推荐链路 |
|------|---------|
| 现代 React、hooks、可视化、官网、看板、工作台、列表、详情、AI 首次生成页面 | Code Canvas，使用 `.canvas.jsx` |
| 明确要求普通自定义页面 JSX/Jsx 组件链路 | 普通 JSX，使用 `.oyd.jsx` |
| 页面强依赖 `this.$(fieldId)`、`this.utils.yida.*`、`this.dataSourceMap`、表单提交或字段双向绑定 | 普通 JSX，使用 `.oyd.jsx` |
| 已有普通 `.oyd.jsx` 页面需要升级 | `yida-canvas-upgrade` |

### Code Canvas 默认链路

```bash
openyida create-page APP_XXX "首页看板" --mode dashboard
openyida check-page pages/src/dashboard.canvas.jsx --json
openyida compile pages/src/dashboard.canvas.jsx
openyida publish pages/src/dashboard.canvas.jsx APP_XXX FORM_XXX
```

页面源码直接基于 PRD 和 design.md 编写。默认使用 Code Canvas 的 `.canvas.jsx`；只有明确需要普通自定义页面 JSX/Jsx 组件链路时才使用 `.oyd.jsx`。


### 成员 / 部门 / 上传组件怎么用

需要成员、部门、附件上传、图片上传时，先确认当前页面链路：

支持清单：[AI 自定义页面支持的宜搭原生组件](https://demo.aliwork.com/o/openyida/sample/canvas-native-components)。

| 页面链路 | 做法 |
|----------|------|
| Code Canvas | 使用 `yida-canvas-custom-page`，按 `native-components-bridge.md` 做运行态组件探测、fallback 和值归一化 |
| 普通 JSX / Jsx 组件链路 | 使用 `yida-custom-page`，读取 `references/component-jsx-guide.md`；涉及上传时同时读取 `references/attachment-upload-guide.md` |

使用原则：

- 先验证运行态是否存在 `EmployeeField`、`DepartmentSelectField`、`AttachmentField`、`ImageField` 等组件。
- 原生组件只负责交互输入；业务状态保存归一化后的成员、部门、文件结构。
- 组件不可用时提供 fallback，页面不能白屏。
- 上传类能力需要验证 OSS 签名、权限、预览、删除和失败提示。

普通 JSX 链路：

```bash
openyida check-page pages/src/employee-upload.oyd.jsx
openyida compile pages/src/employee-upload.oyd.jsx
openyida publish pages/src/employee-upload.oyd.jsx APP_XXX FORM_XXX
```

## 表单、流程、数据与报表

### 表单建模

```bash
openyida sample yida-design app-theme --output .cache/openyida/crm/app-theme.css
openyida create-form create APP_XXX "客户表" .cache/openyida/forms/customer-fields.json
openyida create-form update APP_XXX FORM_XXX .cache/openyida/forms/customer-changes.json
openyida sample openyida-page-template form-fields --output .cache/openyida/forms/customer-fields.json
openyida sample openyida-page-template canvas-form-drawer --output project/pages/src/customer-entry.canvas.jsx --var APP_TYPE=APP_XXX --var FORM_UUID=FORM_XXX
openyida get-schema APP_XXX FORM_XXX
```

表单采用组件树：业务字段负责数据采集，Tab 负责内容切换，操作按钮组执行业务动作，图片建立视觉焦点，状态区提供反馈，`Divider` 和 `ColumnContainer` 组织层级与分栏。`create-form` 字段定义可创建 19 种业务字段、`Divider` 和 `ColumnContainer`，更新表单时保留其他已有组件。

### 流程审批

```bash
openyida create-process APP_XXX "采购申请" .cache/openyida/process/fields.json .cache/openyida/process/process.json
openyida configure-process APP_XXX FORM_XXX .cache/openyida/process/process.json
openyida process preview APP_XXX PROC_INST_XXX --output .cache/openyida/process/process.html
```

加签、转交通过流程定义的 `nodes[].actions.normalActions/appendActions` 配置，`create-process` 和 `configure-process` 共用编译器，生成一致的设计器和运行配置。完整 JSON 示例、默认值及验收边界见 [操作权限配置](yida-skills/skills/yida-flow-node-config/references/actions.md)。

`configure-process` 在发现已有已发布流程或已保存草稿时要求显式传入 `--replace`；如果无法证明目标流程属于指定表单，则不会执行任何写入。草稿创建、保存和发布均按 one-shot 执行，认证或网络异常导致结果未知时不会自动重试。

发布成功后，CLI 会精确回读 `PUBLISHED` 版本及 `getProcessById` 的平台可见视图，校验节点、组件、名称、顺序、审批模式及按钮权限和加签参数。只有完整通过才返回 `PLATFORM_VIEW_VERIFIED`；无法完整验证时返回 `PUBLISHED_UNVERIFIED`，不得把本地 `processJson` 当作平台已验证结果。

### 数据管理

```bash
openyida data query form APP_XXX FORM_XXX --page 1 --size 20
openyida data query process APP_XXX FORM_XXX --current-approver USER_ID --count
openyida data create form APP_XXX FORM_XXX --data-file .cache/openyida/data-import/record.json
openyida data query subform APP_XXX FORM_XXX --inst-id FORM_INST_XXX --table-field-id tableField_xxx
```

`--current-approver` 传真实 userId，不按显示名匹配。命令完整分页查询运行中的实例及当前 TODO 记录，每条流程只计数一次；去掉 `--count` 可返回匹配实例数据。查询沿用当前登录人的平台数据权限，不额外要求管理员角色；结果仅代表当前账号可见范围。分页不完整或权限失败会报错，不能当作 0 条或全应用统计。

录入或更新数据前先用 `openyida get-schema` 获取真实 fieldId。`DateField` / `CascadeDateField` 使用 13 位毫秒时间戳，例如 `1719705600000`。

### 报表和 ECharts

```bash
openyida create-report APP_XXX "销售统计报表" .cache/openyida/reports/charts.json
openyida append-chart APP_XXX REPORT_XXX .cache/openyida/reports/chart.json
```

普通“报表 / 统计”默认使用原生报表 `yida-report`。高级视觉、ECharts、大屏等场景先创建或复用原生报表数据源，再由 `yida-chart` 或 Code Canvas 页面承载展示层。

## 连接器与集成

```bash
openyida connector smart-create --curl "curl https://api.example.com/users"
openyida connector list
openyida integration create APP_XXX FORM_XXX "同步客户数据"
# 仅检测 capability；当前在认证、读取 spec 和远端写入前 fail-closed
openyida integration update APP_XXX FORM_XXX LPROC_XXX \
  --spec .cache/openyida/integration/desired-spec.json
openyida integration enable APP_XXX FORM_XXX PROC_CODE
```

连接器鉴权信息通过宜搭连接器配置管理，不写入页面源码。`--operations`、`--action`、`--spec` 等 JSON 文件放到 `.cache/openyida/<项目名或任务名>/` 下。

自动化 spec 的 `sendMessage` 节点支持 `toRoles: [{"roleCode":"真实角色ID","roleName":"财务"}]`，可与成员、成员字段共同接收 NORMAL 消息。流程的审批、办理、抄送也可指定角色；“指定角色”与“按条件选择不同审批人”分别配置，后者当前尚无完整的 CLI 简化配置。共用配置说明见 `yida-flow-node-config` 技能。

已有动作的 Query 默认值必须通过窄命令安全更新：`openyida connector update-action --connector-id <id> --action <operationId> --query-json '{"currentPage":"1"}' --confirm`。命令先完整回读连接器和全部动作，只修改 `inputs` / `parameters` 中唯一且已声明的同名 Query 默认值，再一次性提交完整动作集合；回读必须证明连接器 fingerprint、动作数量、非目标动作和稳定 ID 均未变化。参数缺失、空值、未知参数、重复 ID、平台详情不完整或写入结果未知都会 fail-closed，且不会自动重试。`add-action` 不再覆盖既有动作 ID。

真实回归入口为 `OPENYIDA_E2E=1 OPENYIDA_E2E_CONNECTOR_ACTION_UPDATE=1 node scripts/e2e-real/connector/action-update-runner.js`。它只创建一个 owned、NONE-auth 测试连接器（含目标动作和 preservation sentinel），逐项验证 `currentPage`、`pageSize`、`userLanguage`、`searchFieldJson`、动态 `_stamp` 并恢复 baseline；证据仅记录响应结构、数量和 SHA-256，不保存真实响应行值、Cookie/token/profile/corpId。由于没有已证明的删除 API，连接器保留为 `cleanup_blocked` residual。

`integration create --process-code` 是整图替换，必须显式传 `--replace`，不能当作安全更新。`integration update` 当前只做 capability 检测：由于平台完整 `processJson` + `viewJson` readback 契约尚未证明，它只写入脱敏的本地 probe artifact，并在认证、读取 spec 或远端写入之前返回 `PLATFORM_PROBE_REQUIRED`。当前不会编辑逻辑流，禁止猜测接口或降级成整图替换。

## CLI 命令参考

运行 `openyida --help` 或 `openyida <command> --help` 查看详细用法。

### 遇到问题与贡献修复

直接告诉 AI：“OpenYida 反复报错，帮我分析原因并整理反馈”。无需 GitHub 账号或本地源码，即可生成脱敏报告和复现步骤；生成材料不代表已提交。

```bash
openyida feedback report --input summary.json --output-dir feedback-draft-001
```

报告摘要由 AI 根据当前证据整理，也可加入用户明确选择的复现截图；PR 附修复前后测试对比。提交前会展示最终正文和图片，确认有无敏感信息或不想公开的内容，允许删改后再提交。输入格式见 [反馈报告说明](yida-skills/skills/yida-feedback/references/report-input.md)。分享前请检查业务信息。有 GitHub 账号时，可授权 AI 帮助提交 Issue；修复公开 OpenYida 代码或技能时，通过你自己的 Fork 提交 PR。无账号时先引导创建 GitHub 账号；实在不行，反馈到AI开发者群。

需要配置提交工具时，AI 可先执行 `openyida feedback github setup --json`，检测 gh 和当前账号；用户同意安装计划后再执行 `openyida feedback github setup --install --confirm --json`。macOS/Linux 复用已有 Homebrew，Windows 复用已有 WinGet；没有支持的包管理器时提供官方说明或网页方式。安装后单独引导用户在浏览器授权，不自动登录、不获取密码或 Token，安装同意也不代替公开内容确认。工具就绪后继续原草稿，详见[账号与工具准备](yida-skills/skills/yida-feedback/references/github-setup.md)。

准备 PR 需核实个人 Fork，或用户主动询问支持项目时，反馈 Skill 可通过 `openyida feedback github status --json` 检查当前账号的 Star 和个人 Fork 状态。Star/Fork 均为可选项，明确选择后才执行 `feedback github star --confirm` 或 `feedback github fork --confirm`，已有操作直接复用。检查不在安装或自动更新中触发，两项操作都不是提交 Issue 的前提。

<!-- OPENYIDA_COMMANDS_START -->
<!-- 本节由 `npm run docs:commands` 自动生成，请勿手动编辑命令行。 -->

### 环境 & 认证

| 命令 | 说明 |
|------|------|
| `openyida login [--qwenwork] [target-url] [--env <name>\|--intl\|--overseas\|--global\|--yidaapps\|--alibaba] [--client-id <clientId>] [--endpoint <url>] [--no-browser]` | 登录（OAuth token 模式） |
| `openyida logout` | 退出登录 / 解绑当前项目登录态 |
| `openyida auth <status\|login\|refresh\|logout\|profiles\|profile switch\|qwenwork user-info> [--json]` | token 登录态与 profile 管理 |
| `openyida org <list\|switch> [--json] [--corp-id <corpId>]` | 组织管理（列表 / 优先按已有 profile 切换） |
| `openyida env [--json\|setup\|list\|show\|switch\|add\|remove] [options]` | 检测 AI 工具环境和 token 登录态 |

### 应用管理

| 命令 | 说明 |
|------|------|
| `openyida app-settings <appType> [--section theme\|basic\|data-card\|cool-card] [--json]` | 获取主题、业务前后台、原生数据卡片和酷卡片管理入口 |
| `openyida cool-card <list\|templates\|create\|get> <appType> [cardPageCode] [--type im\|onebox] [--name <title>] [--page <n>] [--size <n>] [--search <text>] [--out <file>] [--json]` | 创建和读取宜搭原生酷卡片（交互卡片与置顶卡片） |
| `openyida data-card <list\|create\|get\|save\|publish\|probe\|release-get\|release-save\|release-check\|release-test\|refs> <appType> [cardCode] [--name <title>] [--description <text>] [--schema <file>\|--config <file>] [--expected-hash <hash>] [--backup <file>] [--out <file>] [--published\|--version <version>] [--page <n>] [--size <n>] [--search <text>] [--allow-send] [--json]` | 创建、配置、发布原生数据卡片并管理投放播报 |
| `openyida plugin <dev-list\|get\|version-list\|version-get\|extensions\|installed-list\|installed-get\|runtime-list\|probe\|create\|create-version\|save-dev\|configure\|enable\|disable\|upgrade\|uninstall> [pluginId] [version] [options]` | 管理宜搭平台插件开发版本、安装状态与运行时注册 |
| `openyida app-entry get <appType> [--json]` | 读取应用前台和业务工作台入口 |
| `openyida app-entry set <appType> [--frontend <url>\|--frontend-page <formUuid>] [--management <url>\|--management-page <formUuid>] [--clear-frontend] [--clear-management] [--json]` | 登记应用访问入口（局部更新并回读） |
| `openyida app-list [--type managed\|created] [--page N] [--size N]` | 分页查询我管理的或我创建的应用 |
| `openyida solution-template <search\|detail\|prepare\|ai-build\|enable\|status> [templateId\|requestId] [options] [--json]` | 独立本地 Agent 的方案模板查询、云端 AI 搭建入口与直接启用 |
| `openyida corp-efficiency [overview\|details\|detail\|groups\|notify] [options] [--open\|--no-open]` | 查询企业效能概览和明细报表 |
| `openyida create-app "<name>"\|--name <name> [options] [--locale zh_CN\|en_US\|ja_JP] [--open\|--no-open]` | 创建宜搭应用 |
| `openyida design-plan catalog [--json]` | 查询规划可用的主题与页面模式 |
| `openyida design-plan init <requirement-brief.json> [--theme-id <id>] [--output-dir <dir>] [--json]` | 从已确认需求初始化计划草稿 |
| `openyida design-plan preview <build-plan.json> --part-file <module.json> [--json]` | 按模块更新方案草稿 |
| `openyida design-plan materialize <build-plan.json> [--from-preview \| --business-file <json> --visual-file <json>] [--output-dir <dir>] [--rebase-parts] [--check] [--json]` | 生成或更新方案文档和主题，并校验一致性 |
| `openyida design-plan patch <build-plan.json> --set <path=value> [--set <path=value> ...] [--materialize] [--output-dir <dir>] [--json]` | 按字段修改方案，按需同步文档和主题 |
| `openyida update-app <appType> [--name "..."] [--desc "..."] [--icon <name>] [--icon-color <color>] [--colour <key>] [--theme-color <color>] [--theme-file <css>] [--confirm-legacy-app-style] [--disable-custom-theme] [--nav-theme light\|dark\|white\|gray] [--logo-source appIcon\|customImage] [--layout side\|top\|l_shape] [--hide-app-nav\|--show-app-nav]` | 更新应用信息 |
| `openyida data-manage-style guide [--json]` | 查询数据管理 UI 改造方向、token 与 CSS 定位方法 |
| `openyida data-manage-style list [--json]` | 列出可选的数据管理样式配方参考 |
| `openyida data-manage-style generate --app <appType> --form <formUuid> --style <id> --base-css <theme.css> --output <new.css> [--focus balanced\|actions] [--field-id <actualId>]... [--emphasize-field <actualId>]... [--tag-field <selectFieldId>]... [--follow-shell] [--json]` | 按可选配方生成数据管理 CSS（仅本地） |
| `openyida app-theme snapshot <appType> --output-dir <new-dir> [--json]` | 保存应用主题配置与 CSS 快照（只读） |
| `openyida app-theme restore <appType> --snapshot <before.json> --expected-current <after.json> [--check \| --confirm --output-dir <new-dir>] [--json]` | 检查或恢复应用主题快照（仅支持可精确恢复的配置） |
| `openyida upgrade-app-theme <appType> --explicit-request [--confirm \| --prepare --output-dir <dir>] [--json]` | AI 老应用升级新版主题（明确要求并经 ask_human 确认） |
| `openyida app-online <appType> [--to-ding-app-center] [--show-app-center]` | 启用宜搭应用 |
| `openyida app-offline <appType> [--to-ding-app-center] [--show-app-center]` | 停用宜搭应用 |
| `openyida nav-group <list\|create\|rename\|delete\|move\|order\|auto-order\|hide\|show> <appType> ...` | 管理应用左侧导航分组 |
| `openyida app-permission <get\|set\|add\|remove\|search-user> ...` | 管理应用主管理员、数据管理员和开发成员 |
| `openyida i18n <overview\|config\|languages\|list\|upsert\|delete\|translate\|translate-all\|upgrade> <appType> ...` | 管理应用多语言文案和语言配置 |
| `openyida export <appType> [output]` | 导出应用（生成迁移包） |
| `openyida import <file> [name]` | 导入迁移包，重建应用 |

### 表单 & 页面

| 命令 | 说明 |
|------|------|
| `openyida create-form batch <appType> <plan.json> [--concurrency 1..4] [--check] [--json]` | 按依赖并行创建表单 |
| `openyida create-form create <appType> "<formTitle>" <fieldsJsonFile> [--layout single\|double\|card\|section] [--theme default\|compact\|comfortable] [--label-align top\|left\|right] [--icon auto\|<iconName>] [--locale zh_CN\|en_US\|ja_JP] [--open\|--no-open]` | 创建表单页面 |
| `openyida create-form icons [--json]` | 列出可用的表单导航图标 |
| `openyida create-form validate-fields <fieldsJsonOrFile> [--json]` | 本地校验表单字段 JSON |
| `openyida create-form update <appType> <formUuid> (<changesJsonOrFile> \| --data-file <changesJsonOrFile>) [--locale zh_CN\|en_US\|ja_JP] [--open\|--no-open]` | 更新表单页面 |
| `openyida create-form resume <appType> <formUuid> <fieldsJsonOrFile> [--json]` | 更新表单页面 |
| `openyida create-form patch <appType> <formUuid> <patchJsonOrFile> [--open\|--no-open]` | 更新表单页面 |
| `openyida create-form rule <appType> <formUuid> <rulesJsonOrFile> [--open\|--no-open]` | 更新表单页面 |
| `openyida create-form validation <appType> <formUuid> <validationsJsonOrFile> [--open\|--no-open]` | 更新表单页面 |
| `openyida add-validation <appType> <formUuid> --field <labelOrId> --type <phone\|regex\|idCard\|email\|...> [--message <text>]` | 更新表单页面 |
| `openyida create-form bind-datasource <appType> <formUuid> <fieldLabelOrId> <dataSourceJsonOrFile> [--open\|--no-open]` | 更新表单页面 |
| `openyida create-form add-option <appType> <formUuid> <fieldLabel> <option1> [option2] ...` | 更新表单页面 |
| `openyida list-forms <appType> [--keyword <text>]` | 列出应用下的表单/页面 |
| `openyida aggregate-table <list\|create-empty\|inspect\|preview\|save\|publish\|status> <appType> ...` | 管理聚合表（virtualView） |
| `openyida print-template <list\|inspect\|fields\|build\|create\|copy\|save\|restore\|settings\|status\|order\|render\|files> <appType> <formUuid> [templateId] [--config <file>] [--scene <order\|quotation\|delivery\|receipt\|approval\|codes>] [--bindings <file>] [--name <title>] [--expected-hash <hash>] [--backup <file>] [--out <file>] [--status START\|STOP] [--instance <id>] [--page <n>] [--size <n>] [--allow-permission-change] [--json] \| print-template <list\|render> --detail-url <url> [--template-id <id>] [--json]` | 管理宜搭原生打印模板、按字段生成多种单据、备份恢复与生成PDF |
| `openyida form-view <list\|inspect\|save\|create\|order> <appType> <formUuid> [viewUuid] [--config <file>] [--name <title>] [--with-config] [--expected-hash <hash>] [--backup <file>] [--replace] [--json]` | 原生表单视图：查询、检查并配置显示列、列宽、冻结列和筛选 |
| `openyida custom-button <list\|inspect\|options\|create\|update\|delete> <appType> <formUuid> [buttonUuid] [--config <file>] [--expected-hash <hash>] [--backup <file>] [--yes] [--json]` | 原生自定义按钮：查询、配置填写表单、自动化流及页面跳转 |
| `openyida form-message <list\|inspect\|options\|create\|update\|delete> <appType> <formUuid> [messageId] [--config <file>] [--expected-hash <hash>] [--backup <file>] [--yes] [--json]` | 原生表单消息通知：查询触发、接收对象与模板并安全维护配置 |
| `openyida get-schema <appType> <formUuid\|--all> [--summary-json\|--field-map-json\|--analysis-json]` | 获取单个或全部表单 Schema |
| `openyida check-prd-completeness <prd.md> --app-type <appType> [--build-manifest <file>] [--json]` | 检查资源数量、前台菜单隐藏及应用主题同步 |
| `openyida check-design <design.md> [--prd <prd.md>] [--base-dir <dir>] [--json]` | 检查设计文档、主题变量与 PRD 交接 |
| `openyida er <appType> [--format mermaid\|json] [--output file] [--include-system] [--include-pages]` | 导出应用实体关系图 |
| `openyida create-page <appType> "<name>" [--mode dashboard] [--hide-nav] [--locale zh_CN\|en_US\|ja_JP] [--open\|--no-open]` | 创建自定义展示页面 |
| `openyida build-page <sourceFile> [--output file\|--write]` | 构建宜搭兼容页面源码 |
| `openyida check-page <src> [--compat] [--json]` | 检查自定义页面规范 |
| `openyida compile <src> [--canvas] [--compat] [--skip-lint] [--strict-theme\|--allow-fixed-brand] [--json]` | 本地编译自定义页面 |
| `openyida publish <src> <appType> <formUuid> [--health-check] [--force] [--canvas] [--compat] [--skip-lint] [--fix-theme] [--strict-theme] [--allow-fixed-brand] [--auto-nav-order] [--open\|--no-open] [--json]` | 编译并发布自定义页面 |
| `openyida update-form-config <appType> <formUuid> <true\|false\|keep> "<title>" [--locale zh_CN\|en_US\|ja_JP]` | 更新表单配置 |
| `openyida get-form-config <appType> <formUuid> [--json]` | 查询表单配置 |

### 数据 & 权限

| 命令 | 说明 |
|------|------|
| `openyida data <query\|get\|create\|update\|transfer> <resource> ... \| delete form <appType> <formUuid> --inst-id <id> --expect-form-name <name> --expect-form-type receipt --confirm [--json]` | 统一数据管理（表单/流程/任务/子表单） |
| `openyida task-center <todo\|created\|done\|cc\|proxy\|capabilities\|link\|scaffold\|options\|inspect\|count> [--spec <file.json> --output <file.canvas.jsx>] [options]` | 全局任务中心（待办/已处理/抄送等） |
| `openyida basic-info <overview\|commodity\|grant\|capacity\|quota\|abs-path\|dataflow\|i18n\|domain>` | 查询组织基本信息、容量、额度和域名设置 |
| `openyida read-dingtalk-doc <docUrl> [--output <file>] [--json]` | 获取钉钉文档的 Markdown 内容 |
| `openyida read-dingtalk-tingji <taskUuid> [--json]` | 按任务 UUID 获取钉钉听记详情 |
| `openyida get-permission <appType> <formUuid> [--package-uuid <packageUuid>] [--package-type <FORM_PACKAGE_VIEW\|FORM_PACKAGE_START>] [--check-matrix] [--json]` | 查询表单权限配置 |
| `openyida save-permission <appType> <formUuid> [--package-type <FORM_PACKAGE_VIEW\|FORM_PACKAGE_START>] [--package-uuid <packageUuid>\|--create --name <name>] [--data-permission <json>] [--action-permission <json>] [--field-permission <json>] [--members <userIds>\|--roles <roleIds>\|--all-members\|--matrix <json>] [--confirm-member-replace] [--conditions-file <conditions.json>] [--owner-field <fieldId>] [--field-access <fieldId:view\|edit\|hidden\|encrypt>] [--field-default <access>] [--dry-run]` | 保存表单权限配置 |
| `openyida permission-manage <copy\|rename\|delete> <appType> <formUuid> <packageUuid> [--name <name>] [--package-type <type>] [--dry-run] [--confirm]` | 复制、重命名或删除权限组 |
| `openyida matrix <list\|detail\|references\|rows\|create\|update\|delete\|upsert-rows\|delete-rows> [matrixId] [--file config.json] [--page 1] [--limit 20] [--expect hash] [--dry-run] [--confirm]` | 管理权限矩阵定义、引用及数据行 |
| `openyida corp-manager <search-user\|list\|add\|remove\|address-book> ...` | 管理平台管理员与通讯录权限 |
| `openyida agent-center <list\|create\|update\|cancel\|range\|search-user> ...` | 管理流程代理和离职代理 |

### 流程

| 命令 | 说明 |
|------|------|
| `openyida configure-process <appType> <formUuid> <definition> [processCode] [--replace]` | 配置并发布流程规则; 支持加签/转交，配置位于 JSON nodes[].actions.normalActions/appendActions |
| `openyida create-process <appType> <formTitle> <fieldsJsonFile> <processDefinitionFile> [--replace] \| create-process <appType> --formUuid <formUuid> <processDefinitionFile> [--replace]` | 创建流程表单（一体化）; 支持加签/转交，配置位于 JSON nodes[].actions.normalActions/appendActions |
| `openyida ai-form-setting <get\|fields\|models\|enable\|disable\|save> <appType> ...` | 管理流程表单 AI 审批提示 |
| `openyida process preview <appType> ...` | 预览流程实例（可视化流程图） |
| `openyida process fields <appType> <formUuid> [--json]` | 检查流程设计器字段加载和子表字段路径 |

### 页面配置 & 分享

| 命令 | 说明 |
|------|------|
| `openyida verify-short-url <appType> ...` | 验证短链接 URL |
| `openyida save-share-config <appType> ...` | 保存公开访问 / 分享配置 |
| `openyida get-page-config <appType> <formUuid>` | 查询页面公开访问配置 |
| `openyida externalize-form <appType> <formUuid> [--schema-file file]` | 生成外部开放安全评估和镜像字段方案 |

### 报表

| 命令 | 说明 |
|------|------|
| `openyida create-report <appType> "<name>" ... [--json] [--open\|--no-open]` | 创建宜搭报表 |
| `openyida append-chart <appType> <reportId> ... [--json] [--open\|--no-open]` | 向已有报表追加图表 |
| `openyida report inspect <appType> <reportId> --json` | 只读检查报表运行时绑定摘要 |
| `openyida report configure <appType> <reportId> <cid> --hide-zero-values <true\|false> [--hide-zero-categories <true\|false>] [--hide-zero-legends <true\|false>] [--dry-run] [--json]` | 配置原生柱状图动态隐藏零值（需显式开启） |

### 连接器

| 命令 | 说明 |
|------|------|
| `openyida connector list` | 列出 HTTP 连接器 |
| `openyida connector create "name" "domain" ...` | 创建连接器 |
| `openyida connector detail <id>` | 查看连接器详情 |
| `openyida connector delete <id> [--force]` | 显示平台手工删除指引（CLI 不执行删除） |
| `openyida connector add-action --operations <file> --connector-id <id>` | 添加执行动作 |
| `openyida connector update-action --connector-id <id> --action <operationId> --query-json JSON --confirm` | 安全更新动作 Query 默认值 |
| `openyida connector list-actions <id>` | 列出执行动作 |
| `openyida connector delete-action <id> <operation-id>` | 删除执行动作 |
| `openyida connector test --connector-id <id> --action <actionId> [--path-json JSON] [--query-json JSON] [--header-json JSON] [--body-json JSON] [--account-id <id>] [--system-token-app <appType>] [--ignore-defaults]` | 测试执行动作 |
| `openyida connector list-connections <id>` | 列出鉴权账号 |
| `openyida connector create-connection <id> <name> [--interactive]` | 创建鉴权账号 |
| `openyida connector smart-create --curl "..."` | 从 cURL 生成脱敏动作草稿（不创建远端资源） |
| `openyida connector parse-api [options]` | 解析接口信息 |
| `openyida connector gen-template [output]` | 生成接口文档模板 |

### 集成 & 钉钉

| 命令 | 说明 |
|------|------|
| `openyida integration create <appType> <formUuid> <flowName> [--spec file.json] [--publish] [--connector-system-token-app <appType>]` | 创建集成自动化逻辑流 |
| `openyida integration update <appType> <formUuid> <processCode> --patch <patch.json> [--dry-run] [--expect <fingerprint>] [--publish]` | 基于已核对双定义基线增量修改自动化 |
| `openyida integration copy <appType> <formUuid> <processCode> --name <name> [--dry-run]` | 复制自动化，默认停用 |
| `openyida integration rename <appType> <formUuid> <processCode> --name <name> [--dry-run]` | 重命名自动化 |
| `openyida integration delete <appType> <formUuid> <processCode> --confirm [--dry-run]` | 删除已停用的自动化 |
| `openyida integration monitor <appType> [--file monitor.json] [--dry-run] [--json]` | 查询或保存自动化异常监听 |
| `openyida integration list <appType> [--flow-types 1,2,3,5,6] [--form-uuid <uuid>] [--status y\|n] [--json]` | 列出集成自动化逻辑流 |
| `openyida integration enable <appType> <formUuid> <processCode>` | 启用集成自动化逻辑流 |
| `openyida integration disable <appType> <formUuid> <processCode>` | 停用集成自动化逻辑流 |
| `openyida integration check <appType...>` | 检查集成自动化异常运行日志 |
| `openyida integration detail-log <appType> <procInstId> [--json] [--include-params]` | 查看集成自动化运行日志详情 |
| `openyida integration diagnose (--text <text>\|--file <path>\|--rules) [--json]` | 诊断集成自动化故障文本和常见配置坑 |
| `openyida dws <command> [args]` | 钉钉 CLI（通讯录/日历/待办/审批等） |
| `openyida dws contact user search --keyword <text>` | 钉钉 CLI（通讯录/日历/待办/审批等） |
| `openyida dingtalk-link <url> [--target fullScreen] [--legacy-scheme] [--json]` | 生成钉钉 AppLink / 兼容 dingtalk:// 跳转链接 |

### 工具

| 命令 | 说明 |
|------|------|
| `openyida commands [--json]` | 输出机器可读命令清单 |
| `openyida agent-capabilities [--json] [--summary-json\|--compact]` | 输出 Agent 一次性能力快照 |
| `openyida agent <doctor\|diagnose\|status\|connect\|run\|disconnect\|logout\|logs> [options]` | 连接本地 Agent（Go runtime，开发预览） |
| `openyida a2a <serve\|agent-card> [options]` | 启动本地只读 A2A Adapter 或输出 Agent Card |
| `openyida bridge start [--token <pair-token>] [--port 6736] [--origin https://demo.aliwork.com] [--open\|--no-open]` | 启动 OpenYida 本地网页桥接服务 |
| `openyida copy [--force]` | 复制 project 工作目录 |
| `openyida sample [--list] [<skill> <name>] [--output <file-or-directory>] [--var KEY=VALUE ...] [--design-file <design.md>] [--style-id <themeId\|free-creative>] [--theme-ids <id,...>] [--pop-art-context <explicit-request\|showcase>]` | 输出代码模板 |
| `openyida doctor [--fix]` | 环境诊断与自动修复 |
| `openyida db-seq-fix [--fix]` | PostgreSQL Sequence 漂移检测与修复 |
| `openyida formula evaluate <formula\|file> [--schema file] [--contract field-value\|validation-rule\|business-action\|node-expression] [--context form\|validation\|automation\|business] [--target-type NumberField] [--metadata file] [--strict] [--json]` | 静态检查宜搭公式语法和字段引用 |
| `openyida formula check <formula\|file> [--schema file] [--contract field-value\|validation-rule\|business-action\|node-expression] [--context form\|validation\|automation\|business] [--target-type NumberField] [--metadata file] [--strict] [--json]` | 检查公式的写法、字段、参数和类型 |
| `openyida formula contracts [--json]` | 查看公式保存方式和检查范围 |
| `openyida formula functions <appType> [--name IF] [--context form\|validation\|automation\|business] [--output file] [--json]` | 查询宜搭公式函数及参数说明 |
| `openyida formula types <appType> [--component NumberField] [--json]` | 查询公式组件支持的值类型 |
| `openyida formula inspect <appType> <formUuid> [--field fieldId] [--json]` | 查看表单字段已配置的公式 |
| `openyida formula test <appType> <formUuid> [formula\|file] [--data-file file \| --cases file] [--field fieldId] [--timezone-offset minutes] [--context form\|validation] [--binding platform\|numeric-literals] [--expect JSON] [--json]` | 带入数据在宜搭试算公式并核对结果 |
| `openyida update` | 检查并更新到最新版本 |
| `openyida export-conversation [options]` | 导出 AI 对话记录 |
| `openyida feedback <report\|github\|setup\|url\|dismiss\|status> [options]` | 整理本地问题报告、配置反馈表单与提醒 |
| `openyida batch <file>\|--commands "cmd1 ; cmd2" [--stop-on-error] [--json]` | 批量执行 OpenYida 命令 |
| `openyida flash-to-prd --file <path> --name "<project>"` | 闪记 / 会议纪要转 PRD prompt |
| `openyida ai <text\|image> [options]` | 调用 AI 文生文和识图能力 |
| `openyida asset <status\|resolve\|sources> [options]` | 检测素材能力 / 解析回填素材 |
| `openyida cdn-config [options]` | 配置 CDN / OSS 上传 |
| `openyida cdn-upload <image-path>` | 上传图片到 CDN |
| `openyida cdn-refresh [options]` | 刷新 CDN 缓存 |

<!-- OPENYIDA_COMMANDS_END -->

### 个人任务与流程进度

通过 `openyida data query tasks <appType> --type todo --normalized` 查询应用内个人待办；`created`、`done`、`cc` 分别查询我创建的、我已处理和抄送我的。执行 `openyida task-center capabilities --json` 查看支持的筛选和页面配置示例。

默认 `app-v1` 保留原查询行为。显式选择 `--transport app-query` 可使用更多服务端筛选，查询始终限定目标应用：`--originators '["USER_ID"]'` 支持一位发起人，`--process-codes '["PROCESS_CODE"]'` 选择流程，日期端点使用毫秒时间戳。各任务类别可用字段以能力查询为准，不支持的字段在请求前报错。通过 `openyida task-center options <appType> --type originators|processes|forms --keyword 关键词 --json` 查询可读候选项，不会静默退回无筛选查询。

明确选择自定义待办页面后，执行 `openyida task-center scaffold --spec <配置.json> --output <新文件.canvas.jsx>`。配置需要记录该选择并引用应用现有设计文件。生成页面沿用应用主题，读取当前访问者的任务，办理时打开原生页面；`embedded` 模式可作为既有工作台中的任务区块。生成后按常规流程编译和发布。

页面配置可显式设置 `transport: "app-query"` 与分类初始筛选，如 `filters: { "todo": { "originators": ["USER_ID"] } }`。生成页面包含与 CLI 相同的 `filterSchema`、`normalizeFilters`、任务加载及候选项查询辅助函数。

`task-center count <appType> --type todo --transport app-query --filters-json '{"keyword":"采购"}' --json` 只读取一页一条及匹配条件的服务端总数，未知总数保留为 `null`。`task-center inspect <appType> --process-inst-id <id> [--form-uuid <id>] [--history] [--task-id <id>] --json` 读取有权查看的关联流程及可选历史，区分本人处理、指定任务及流程最终结果。只读命令不创建自定义页面，也不要求选择自定义实现。

装配只选择所需任务类别、`fields` 和 `filterFields`，默认单个待办列表；`view: "progress", mode: "embedded"` 提供既有业务详情的审批进度组件，传入真实关联 `processInstanceId`。审批历史和行展开按需启用，配置与接入示例见[流程任务能力](yida-skills/skills/yida-canvas-data-binding/references/workflow-capabilities.md)。

### 连接本地 Agent

在宜搭网页中使用本机已安装的 Qoder 或 Codex CLI 执行任务。目前支持 macOS 和 Windows；普通 OpenYida CLI 仍支持 Linux。

先检查本机环境，再按宜搭网页提示完成连接：

```bash
openyida agent doctor --json
```

连接成功后服务会在后台运行，可通过 `openyida agent status` 查看状态、`openyida agent logs` 查看日志，使用 `openyida agent disconnect` 断开连接。电脑重启后，执行 `openyida agent run` 重新上线。

## Agent Skills

`yida-skills/` 是 OpenYida 的 Agent 技能源码目录：

| 路径 | 说明 |
|------|------|
| `yida-skills/SKILL.md` | 技能入口和路由索引 |
| `yida-skills/skills/<skill-name>/SKILL.md` | 每个子技能的独立说明 |
| `yida-skills/references/` | 跨技能共享参考文档 |

QwenWork（千问办公）使用用户级全局 skill 目录：`~/.qwenworkcn/skills/yida-skills/`；未检测到 `~/.qwenworkcn` 时跳过。

新 Qoder 与 Qoder IDE 共享用户级 `~/.qoder/skills/yida-skills/` 目录；QoderWork 是独立产品，继续使用 `~/.qoderwork/skills/yida-skills/`。

## 开发与校验

```bash
npm test
npm run check:skills
npm run check:ci
```

真实环境 E2E 需要明确打开：

```bash
OPENYIDA_E2E=1 npm run test:e2e:real
OPENYIDA_E2E=1 npm run test:e2e:real:full
```

Skill 路由和生成质量评测：

```bash
npm run eval:routing
OPENYIDA_E2E=1 npm run eval:e2e -- --skill yida-dashboard --screenshot
OPENYIDA_E2E=1 npm run eval:generate -- --screenshot
npm run eval:replay -- --report <generation-report.json> --scenario <scenario.json> --app-type APP_XXX
npm run eval:dashboard
```

## 贡献

新增 CLI 命令时，同步更新命令路由、README 命令说明和相关 skill。修改技能结构后运行：

```bash
npm run check:skills
```

更多说明见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 许可证

[MIT](./LICENSE)
