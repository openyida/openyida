---
name: Yida
description: >
  宜搭 AI 应用开发总入口技能。通过有 AI Coding 能力的智能体（悟空/Claude/Open Code 等）+ 宜搭低代码平台，实现一句话生成完整应用。
  包含应用创建、表单设计、自定义页面开发、页面发布、登录态管理等完整开发流程。
  当用户提到"宜搭"、"yida"、"低代码"、"创建应用"、"创建表单"、"发布页面"、"搭建"、"系统"、等关键词时，使用此技能。
license: MIT
compatibility:
  - opencode
  - claude-code
  - qoder
  - wukong
metadata:
  audience: developers
  workflow: yida-development
  version: 3.0.0
  tags:
    - yida
    - low-code
    - app
    - form
    - custom-page
---

# 宜搭 AI 应用开发指南

## 概述

本技能通过有 AI Coding 能力的智能体（悟空/Claude/Open Code 等） + 宜搭低代码平台，实现一句话生成完整应用。涵盖从应用创建、表单设计、自定义页面开发到页面发布的完整链路。

所有操作通过 **`openyida`** 命令行工具统一执行，无需关心脚本路径或运行环境差异。

**登录态说明**：所有命令自动读取 `.cache/cookies.json`，首次运行或 Cookie 失效时自动触发登录流程，无需手动执行登录命令。

---

## 环境依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| Node.js | ≥ 16 | 运行 openyida |

```bash
# 安装 openyida（首次使用前执行）
npm install -g openyida

# 更新 openyida 到最新版本
npm install -g openyida@latest
```

---

## 更新 openyida

**手动更新**：
```bash
npm install -g openyida@latest
```

**让 AI 帮你更新**：

执行 `openyida` 命令出现报错时，直接告诉 AI：

> "openyida 命令出错了，请帮我更新 openyida"

AI 会自动执行以下命令完成更新：
```bash
npm install -g openyida@latest
```

更新完成后重新执行出错的命令即可。

---

## ⚡ 首要步骤：检测运行环境（必须先执行）

**在执行任何宜搭操作前，必须先运行环境检测命令**，确认当前 AI 工具环境和登录态：

```bash
openyida env --json
openyida login --check-only --json
```

`openyida env --json` 用于确认当前 AI 工具、项目根目录、配置文件和登录态拆解项；`openyida login --check-only --json` 只读取本地登录缓存，不触发登录、不打开浏览器、不创建任何资源。

**悟空（Wukong）降级规则**：如果在悟空环境中本地命令执行入口连续失败，不要继续重试，也不要判断为 OpenYida 登录失败。进入人工协同诊断模式，请用户在可用终端执行以下低风险命令并贴回输出：

```bash
openyida -v
openyida env --json
openyida login --check-only --json
```

在拿到上述输出并确认 `loggedIn/can_auto_use`、`csrf_token_found`、`corp_id_found`、`base_url_found` 等关键项前，禁止创建应用、页面、表单或发布页面等会产生真实宜搭资源的操作。

**输出解读**：

| 字段 | 说明 |
|------|------|
| AI 工具检测 | 显示当前活跃的 AI 工具（悟空/OpenCode/Aone Copilot 等） |
| 当前生效环境 | 显示项目根目录路径 |
| 登录态检测 | 显示是否已登录、域名、组织 ID |

> **若显示"未登录"，先执行 `openyida login` 获取 browser handoff 登录 URL；完成浏览器登录后，必须再次执行 `openyida login --check-only --json` 验证缓存写入。不要在只读验证通过前执行真实资源创建。**

---

## 🔧 初始化 project 工作目录

**如果当前工程目录下没有 `project/` 目录**（例如切换了 AI 工具、或在新工程中首次使用），需要手动执行初始化：

```bash
openyida copy
```

### 复制目标说明

| AI 工具 | project 目录位置 | 说明 |
|---------|-----------------|------|
| **悟空（Wukong）** | `~/.real/workspace/project` | 悟空有专属 workspace，与工程目录无关 |
| **其他工具**（Aone Copilot、Cursor、Claude Code、OpenCode 等） | `<当前工程目录>/project` | 以项目为单位，需在工程根目录下执行 |

### AI 执行规则

**在执行任何宜搭操作前，先检查 project 目录是否存在**：

- **悟空**：检查 `~/.real/workspace/project` 是否存在
- **其他工具**：检查当前工程目录下的 `project/` 是否存在

若不存在，执行初始化：
```bash
openyida copy
```

> ⚠️ 对于非悟空工具，必须先 `cd` 到工程根目录再执行 `openyida copy`。

---

## 何时使用

当用户提出以下需求时，使用本技能并按照完整开发流程执行：
- 创建宜搭应用、表单、自定义页面
- 发布或更新宜搭页面
- 配置页面公开访问/组织内分享
- 查询表单 Schema 或字段 ID
- 管理宜搭登录态（登录/退出）

---

## 完整开发流程

```
[Step 1] 创建应用 → openyida create-app          → 获得 appType
              ↓
[Step 2] 需求分析 → 写入 prd/<项目名>.md
              ↓
[Step 3] 创建自定义页面 → openyida create-page    → 获得 formUuid（自定义页面）
              ↓
[Step 4]（按需）创建/更新表单 → openyida create-form → 获得 formUuid（表单）
              ↓
[Step 5] 编写自定义页面代码 → yida-custom-page 规范 → pages/src/<项目名>.js
              ↓
[Step 6] 发布页面 → openyida publish
              ↓
[Step 7]（按需）配置公开访问 → openyida verify-short-url / save-share-config
              ↓
[Step 8] 输出访问链接，用系统浏览器打开
```

---

## 子技能速查

> 每个子技能均有独立的 SKILL.md。执行时先选定一个最匹配的子技能，只读取该子技能文档；references 按文档提示按需读取，避免一次性加载全量文档。

| 技能 | SKILL.md 路径 | 用途 | 典型命令 |
|------|--------------|------|---------|
| `yida-app` | `skills/yida-app/SKILL.md` | 完整应用开发编排 | 详见 SKILL.md |
| `yida-login` | `skills/yida-login/SKILL.md` | 登录态管理（通常自动触发） | `openyida login` |
| `yida-logout` | `skills/yida-logout/SKILL.md` | 退出登录 / 切换账号 | `openyida logout` |
| `yida-create-app` | `skills/yida-create-app/SKILL.md` | 创建应用，获取 appType | `openyida create-app "<名称>"` |
| `yida-create-page` | `skills/yida-create-page/SKILL.md` | 创建自定义页面，获取 formUuid | `openyida create-page <appType> "<页面名>"` |
| `yida-create-form-page` | `skills/yida-create-form-page/SKILL.md` | 创建/更新表单页面 | `openyida create-form create <appType> "<表单名>" <字段JSON>` |
| `yida-create-process` | `skills/yida-create-process/SKILL.md` | 创建流程表单并配置流程 | `openyida create-process <appType> "<表单名>" <字段JSON> <流程JSON>` |
| `yida-get-schema` | `skills/yida-get-schema/SKILL.md` | 获取单个/全部表单 Schema，确认字段 ID | `openyida get-schema <appType> <formUuid>` |
| `yida-custom-page` | `skills/yida-custom-page/SKILL.md` | 编写自定义页面 JSX 代码规范 | 详见 SKILL.md |
| `yida-publish-page` | `skills/yida-publish-page/SKILL.md` | 编译并发布自定义页面 | `openyida publish <源文件路径> <appType> <formUuid>` |
| `yida-page-config` | `skills/yida-page-config/SKILL.md` | 页面公开访问/组织内分享配置 | `openyida verify-short-url <appType> <formUuid> <url>` |
| `yida-form-permission` | `skills/yida-form-permission/SKILL.md` | 表单权限查询与保存 | `openyida get-permission <appType> <formUuid>` |
| `yida-data-management` | `skills/yida-data-management/SKILL.md` | 表单/流程/任务数据查询与变更 | `openyida data query form <appType> <formUuid>` |
| `yida-table-form` | `skills/yida-table-form/SKILL.md` | 表格形态批量录入页面 | 详见 SKILL.md |
| `yida-process-rule` | `skills/yida-process-rule/SKILL.md` | 配置流程规则、审批节点和字段权限 | `openyida configure-process <appType> <formUuid> <流程JSON>` |
| `yida-integration` | `skills/yida-integration/SKILL.md` | 集成自动化逻辑流 | `openyida integration create <appType> <配置JSON>` |
| `yida-connector` | `skills/yida-connector/SKILL.md` | HTTP 连接器创建、测试与动作管理 | `openyida connector smart-create <配置>` |
| `yida-chart` | `skills/yida-chart/SKILL.md` | 报表可视化（ECharts 图表 + 数据聚合） | 详见 SKILL.md |
| `yida-report` | `skills/yida-report/SKILL.md` | 宜搭原生报表创建（标准报表） | `openyida create-report <appType> "<名称>" <配置>` |
| `yida-density` | `skills/yida-density/SKILL.md` | 列表/表格页面信息密度选择 | 详见 SKILL.md |
| `yida-formula` | `skills/yida-formula/SKILL.md` | 公式字段和赋值规则配置 | 详见 SKILL.md |
| `yida-formula-evaluate` | `skills/yida-formula-evaluate/SKILL.md` | 静态检查公式语法和字段引用 | `openyida formula evaluate <公式或文件>` |
| `yida-voc` | `skills/yida-voc/SKILL.md` | 需求/故障/性能反馈 VOC 信息整理 | 详见 SKILL.md |
| `yida-db-seq-fix` | `skills/yida-db-seq-fix/SKILL.md` | PostgreSQL sequence 漂移修复 | `openyida db-seq-fix <配置>` |
| `yida-export-conversation` | `skills/yida-export-conversation/SKILL.md` | 导出 AI 对话记录 | `openyida export-conversation` |
| `yida-flash-note-to-prd` | `skills/yida-flash-note-to-prd/SKILL.md` | 闪记/会议纪要转 PRD prompt | `openyida flash-to-prd <文件>` |
| `yida-ppt-slider` | `skills/yida-ppt-slider/SKILL.md` | 宜搭全屏幻灯片页面 | 详见 SKILL.md |
| `yida-ppt` | `skills/yida-ppt/SKILL.md` | 已废弃，改用 `yida-ppt-slider` | 详见 SKILL.md |
| `large-file-write` | `skills/large-file-write/SKILL.md` | 大文件可靠写入辅助技能 | 详见 SKILL.md |

---

## 关键规则

### 1. 执行子技能前必须读取其 SKILL.md

每个子技能的详细参数、注意事项、示例均在其 SKILL.md 中。**执行任何子技能前，必须先读取对应的 SKILL.md**，不要凭记忆猜测参数格式。

### 2. 执行成功率与性能规则（必须遵守）

- **只读必要文档**：先根据用户意图选定 1 个主技能；只有该技能明确要求时，才读取对应 `references/` 文档，禁止一次性读取全部技能文档。
- **优先复用缓存**：已创建的 `appType`、`formUuid`、`fieldId`、`reportId` 优先从 `.cache/<项目名>-schema.json` 读取；缺失或不确定时再执行 `openyida get-schema`。
- **先本地校验再发布**：自定义页面发布前运行 `openyida check-page <源文件路径>` 和 `openyida compile <源文件路径>`；JSON 配置写入文件后先做 JSON 解析校验，再调用平台命令。
- **避免无效重试**：同一命令失败后，先根据错误信息检查登录态、组织、参数和字段 ID；不要无修改地连续重试超过 1 次。
- **数据性能优先**：统计/聚合类需求优先使用 `yida-report` 原生报表服务端聚合；不要在自定义页面前端分页拉取大量表单数据后自行聚合。
- **模板优先**：自定义页面、表单字段、报表配置等复杂产物优先使用 `openyida sample` 或现有示例生成骨架，再做最小改动。

### 3. corpId 一致性检查（必须遵守）

在创建页面前，**必须对比 prd 文档中的 corpId 与 `.cache/cookies.json` 中的 corpId 是否一致**：

- **一致** → 继续执行
- **不一致** → 询问用户：重新登录到正确组织，还是在当前组织新建应用？

### 4. 配置信息分两处存储

| 信息类型 | 存储位置 | 内容示例 |
|---------|---------|---------|
| 业务语义信息 | `prd/<项目名>.md` | 字段名称、字段类型、字段说明 |
| Schema ID | `.cache/<项目名>-schema.json` | `appType`、`formUuid`、`fieldId` |

> **prd 文档不记录 `formUuid`、`fieldId` 等 ID**，这些写入 `.cache/` 临时文件。

### 5. 临时文件规范

所有临时文件（cookies、schema 缓存等）**必须写在项目根目录的 `.cache/` 文件夹中**，不要写在系统其他位置。

### 6. 报表优化/美化提示规则（必须遵守）

当用户提到"优化"、"美化"、"更好看"、"不够漂亮"等与报表视觉效果相关的关键词时，**必须先询问用户**选择以下哪种方案：

| 方案 | 说明 | 适用场景 |
|------|------|---------|
| **方案 A：优化宜搭原生报表** | 调整图表类型、布局、筛选器等，仍使用宜搭原生报表组件 | 快速优化，无需编写代码 |
| **方案 B：创建 ECharts 高级报表** | 使用 ECharts + 自定义页面 JSX，实现高度定制化、更美观的数据可视化 | 需要更精美的视觉效果、复杂交互、数据大屏 |

**提示话术示例**：

> 我可以通过两种方式帮你优化报表：
> 1. **优化原生报表**：调整图表类型组合、布局排列、添加筛选器，快速提升效果
> 2. **创建 ECharts 高级报表**：使用 ECharts 自定义页面，实现更精美的视觉效果和交互体验（如渐变色、动画、自定义主题等）
>
> 你想选择哪种方案？

- 用户选择方案 A → 使用 `yida-report` 技能（`openyida create-report`）
- 用户选择方案 B → 读取 `skills/yida-chart/SKILL.md`，使用 `yida-chart` 技能

---

## 表单字段类型速查

| 类型 | 说明 | 特殊属性 |
|------|------|---------|
| `TextField` | 单行文本 | — |
| `TextareaField` | 多行文本 | — |
| `NumberField` | 数字 | `precision`（小数位）、`innerAfter`（单位） |
| `RadioField` | 单选 | `options` |
| `CheckboxField` | 多选 | `options` |
| `SelectField` | 下拉单选 | `options` |
| `MultiSelectField` | 下拉多选 | `options` |
| `DateField` | 日期 | `format`（如 `"YYYY-MM-DD"`） |
| `CascadeDateField` | 级联日期（范围） | `format` |
| `EmployeeField` | 成员选择 | `multiple` |
| `DepartmentSelectField` | 部门选择 | `multiple` |
| `AddressField` | 地址 | — |
| `AttachmentField` | 附件上传 | — |
| `ImageField` | 图片上传 | — |
| `TableField` | 子表格 | `children`（子字段列表） |
| `AssociationFormField` | 关联表单 | `associationForm` |
| `SerialNumberField` | 流水号 | `serialNumberRule` |
| `RateField` | 评分 | `count`（星级数） |
| `CountrySelectField` | 国家选择 | `multiple` |

---

## 宜搭应用 URL 规则

| 页面类型 | URL 格式 |
|---------|---------|
| 应用首页 | `{base_url}/{appType}/workbench` |
| 表单提交页 | `{base_url}/{appType}/submission/{formUuid}` |
| 自定义页面 | `{base_url}/{appType}/custom/{formUuid}` |
| 自定义页面（隐藏导航） | `{base_url}/{appType}/custom/{formUuid}?isRenderNav=false` |
| 表单详情页 | `{base_url}/{appType}/formDetail/{formUuid}?formInstId={formInstId}` |
| 表单详情页（编辑模式） | `{base_url}/{appType}/formDetail/{formUuid}?formInstId={formInstId}&mode=edit` |

> 所有地址拼接 `&corpid={corpId}` 可自动切换到对应组织。

---

## 常见问题
**Q：发布时提示登录失效？**

重新登录后再发布：
```bash
openyida login
openyida publish <源文件路径> <appType> <formUuid>
```

**Q：如何查看已有表单的字段 ID？**

使用 `yida-get-schema` 技能获取表单 Schema，从中读取各字段的 `fieldId`：
```bash
openyida get-schema <appType> <formUuid>
```

**Q：如何更新已有表单字段？**

使用 `yida-create-form-page` 的 update 模式，详见 `skills/yida-create-form-page/SKILL.md`：
```bash
openyida create-form update <appType> <formUuid> '[{"action":"add","field":{"type":"TextField","label":"新字段"}}]'
```

**Q：发布时提示 corpId 不匹配？**

询问用户是否在当前组织创建新应用发布，或重新登录到正确组织：
```bash
openyida logout
openyida login
```
