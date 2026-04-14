---
name: yida-skills
description: "宜搭低代码平台 AI 开发助手。适用于一切业务数字化需求：创建登记表/申请表/信息收集表、设计审批流程、搭建数据报表/数据大屏、开发自定义页面、管理表单数据、闪记转PRD/会议纪要提取需求/需求文档生成、导出对话记录、编写公式/计算字段、配置连接器/外部API接入、设置权限/公开分享、集成自动化。当用户想要创建任何形式的表单、系统、页面、流程、报表，或提到员工管理、客户管理、费用报销、考勤打卡、项目管理等业务场景时触发。也适用于「宜搭」「yida」「低代码」「创建应用」「发布页面」「搭建系统」「PRD」「闪记」「会议记录」「对话导出」「公式」「连接器」「权限」「分享」「集成自动化」等关键词场景。"
metadata:
  version: 2026.04.02
---

# 宜搭 AI 应用开发指南

通过 `openyida` CLI 驱动宜搭低代码平台，一句话生成完整应用。

## 严格禁止 (NEVER DO)

- 不要编造 appType、formUuid、fieldId 等标识符，必须从命令返回或 Schema 中提取
- 不要在未读取子技能 SKILL.md 的情况下执行操作，参数格式必须以文档为准
- 不要在 corpId 不一致时强行创建应用，必须先询问用户
- 不要将临时文件写在项目根目录，统一写入 `.cache/` 文件夹

## 严格要求 (MUST DO)

- 执行任何操作前，必须先运行 `openyida env` 检测环境和登录态
- 每个子技能执行前，必须完整读取其 SKILL.md，不得凭记忆猜测参数
- 业务语义信息写入 `prd/<项目名>.md`，Schema ID 写入 `.cache/<项目名>-schema.json`
- 超过 100 行的大文件写入，使用 `large-file-write` 技能，禁止用 heredoc
- 在悟空环境中（`AGENT_WORK_ROOT` 包含 `.real`），执行任何 npm/node/npx 命令前，必须先设置 `export PATH="$HOME/.real/.bin/node/bin:$PATH"`，确保使用悟空自带的 node 环境

---

## ⚡ 首要步骤（每次必须先执行）

**macOS / Linux：**

```bash
# 0. 悟空环境：确保使用悟空自带的 node/npm（避免权限问题）
if [ -n "$AGENT_WORK_ROOT" ] && echo "$AGENT_WORK_ROOT" | grep -q '.real'; then
  export PATH="$HOME/.real/.bin/node/bin:$PATH"
fi

# 1. 确保 openyida 已安装（未安装则自动安装，已安装则跳过）
openyida -v 2>/dev/null || npm install -g openyida@latest

# 2. 一键诊断并自动修复：环境检测 + project 目录初始化
openyida doctor --fix
```

**Windows (PowerShell)：**

```powershell
# 0. 悟空环境：确保使用悟空自带的 node/npm（避免权限问题）
if ($env:AGENT_WORK_ROOT -and $env:AGENT_WORK_ROOT -match '\.real') {
  $env:PATH = "$env:USERPROFILE\.real\.bin\node\bin;$env:PATH"
}

# 1. 确保 openyida 已安装（未安装则自动安装，已安装则跳过）
try { openyida -v } catch { npm install -g openyida@latest }

# 2. 一键诊断并自动修复：环境检测 + project 目录初始化
openyida doctor --fix
```

---

## 意图判断决策树

根据用户描述，快速定位应使用的子技能：

用户提到"查询应用列表/我的应用/有哪些应用" → `openyida yida-app-list`（直接执行，无需子技能）
用户提到"创建应用/新建系统/搭建平台" → 先读 `yida-app` 了解全流程，再用 `yida-create-app`
用户提到"创建表单/新增字段/更新表单" → `yida-create-form-page`
用户提到"自定义页面/JSX/React/可视化大屏" → `yida-custom-page` + `yida-publish-page`
用户提到"审批流程/流程表单/审批节点" → `yida-create-process` 或 `yida-process-rule`
用户提到"数据查询/数据管理/表单实例" → `yida-data-management`
用户提到"报表/图表/ECharts/数据大屏" → `yida-report`（原生报表）或 `yida-chart`（ECharts 高级）
用户提到"连接器/外部接口/HTTP 接入" → `yida-connector`
用户提到"权限/字段权限/数据权限" → `yida-form-permission`
用户提到"公开访问/分享链接/外部访问" → `yida-page-config`
用户提到"集成/自动化/触发通知" → `yida-integration`
用户提到"登录/Cookie 失效/切换账号" → `yida-login` 或 `yida-logout`
用户提到"公式/计算字段/函数" → `yida-formula`
用户提到"闪记/会议纪要/PRD" → `yida-flash-note-to-prd`
用户提到"Sequence/主键冲突/自增ID错误" → `yida-db-seq-fix`

**关键区分**：
- `yida-report`（宜搭原生报表页面，16 种内置图表）vs `yida-chart`（ECharts 自定义大屏，依赖 yida-report 作数据源）
- `yida-create-process`（从零创建流程表单一体化）vs `yida-process-rule`（为已有表单配置审批规则）
- `yida-create-form-page`（创建/更新表单结构）vs `yida-data-management`（操作表单中的数据记录）

> 易混淆场景详见各子技能 SKILL.md 的"注意事项"章节。

---

## 危险操作确认

以下操作不可逆，执行前**必须向用户展示操作摘要并获得明确同意**：

| 操作 | 说明 |
|------|------|
| 删除应用 | 含全部表单、页面、数据，不可恢复 |
| 覆盖表单 Schema | 可能导致已有数据字段丢失 |
| 批量删除数据记录 | 数据不可恢复 |
| 切换组织（logout/login） | 会清除当前登录态 |

确认流程：
1. 展示操作摘要（操作类型 + 目标对象 + 影响范围）
2. 等待用户明确回复确认
3. 执行操作

---

## 错误处理

1. 登录失效（401/Cookie 过期）→ 执行 `openyida login` 重新登录
2. corpId 不匹配 → 询问用户是否切换组织，执行 `openyida logout && openyida login`
3. 命令执行失败 → 检查参数格式是否与子技能 SKILL.md 一致，不要猜测参数
4. 发布失败 → 确认 `openyida env` 环境检测通过，检查 Babel 编译产物
5. **技能检索失败（search_skills 未返回预期技能）→ 不得直接输出执行结果或编造执行过程**。必须先查阅上方「意图判断决策树」手动定位子技能路径，再通过 `use_skill` 激活对应技能后执行。若仍无法确定技能，停止执行并向用户说明，询问补充信息。

---

## 子技能索引

> 执行前必须完整读取对应 SKILL.md，不得凭记忆猜测参数格式。

### 应用生命周期

| 技能 | 路径 | 说明 |
|------|------|------|
| **yida-app** | [`skills/yida-app/SKILL.md`](skills/yida-app/SKILL.md) | 完整应用开发全流程编排（从零到一，创建应用前必读） |
| **app-list** | `openyida yida-app-list [--size N]` | 查询我的应用列表，返回 appName / appType / systemLink（直接执行，无需子技能） |
| **sample** | `openyida sample <skill> <name>` | 输出代码示例/模板到 `.cache/samples/<name>.js`，再用 `read_file` 读取（`--list` 查看所有可用示例） |
| **yida-create-app** | [`skills/yida-create-app/SKILL.md`](skills/yida-create-app/SKILL.md) | 创建应用，获取 appType |
| **yida-create-page** | [`skills/yida-create-page/SKILL.md`](skills/yida-create-page/SKILL.md) | 创建自定义展示页面，获取 formUuid |
| **yida-publish-page** | [`skills/yida-publish-page/SKILL.md`](skills/yida-publish-page/SKILL.md) | 编译并发布自定义页面 |

### 表单与数据

| 技能 | 路径 | 说明 |
|------|------|------|
| **yida-create-form-page** | [`skills/yida-create-form-page/SKILL.md`](skills/yida-create-form-page/SKILL.md) | 创建/更新表单（19 种字段类型） |
| **yida-get-schema** | [`skills/yida-get-schema/SKILL.md`](skills/yida-get-schema/SKILL.md) | 获取表单 Schema，确认字段 ID |
| **yida-data-management** | [`skills/yida-data-management/SKILL.md`](skills/yida-data-management/SKILL.md) | 表单/流程实例的查询、新增、更新 |
| **yida-form-permission** | [`skills/yida-form-permission/SKILL.md`](skills/yida-form-permission/SKILL.md) | 表单权限配置（字段/数据/操作权限） |
| **yida-formula** | [`skills/yida-formula/SKILL.md`](skills/yida-formula/SKILL.md) | 公式字段编写规范（函数速查、18 个常见场景示例） |

### 流程

| 技能 | 路径 | 说明 |
|------|------|------|
| **yida-create-process** | [`skills/yida-create-process/SKILL.md`](skills/yida-create-process/SKILL.md) | 一键创建流程表单（创建+转流程+配置） |
| **yida-process-rule** | [`skills/yida-process-rule/SKILL.md`](skills/yida-process-rule/SKILL.md) | 为已有表单配置审批规则（条件分支/审批节点/字段权限） |
| **yida-integration** | [`skills/yida-integration/SKILL.md`](skills/yida-integration/SKILL.md) | 创建集成&自动化逻辑流（触发事件/通知/数据操作） |

### 自定义页面开发

| 技能 | 路径 | 说明 |
|------|------|------|
| **yida-custom-page** | [`skills/yida-custom-page/SKILL.md`](skills/yida-custom-page/SKILL.md) | JSX 编码规范、API 调用、状态管理（必须完整学习） |
| **yida-density** | [`skills/yida-density/SKILL.md`](skills/yida-density/SKILL.md) | 信息密度设计规范（紧凑/舒适/宽松） |
| **yida-table-form** | [`skills/yida-table-form/SKILL.md`](skills/yida-table-form/SKILL.md) | 表格形式批量表单提交 |
| **yida-ppt-slider** | [`skills/yida-ppt-slider/SKILL.md`](skills/yida-ppt-slider/SKILL.md) | PPT 幻灯片页面开发（演讲/路演/培训） |

### 连接器与报表

| 技能 | 路径 | 说明 |
|------|------|------|
| **yida-connector** | [`skills/yida-connector/SKILL.md`](skills/yida-connector/SKILL.md) | HTTP 连接器管理（创建/测试/智能生成） |
| **yida-report** | [`skills/yida-report/SKILL.md`](skills/yida-report/SKILL.md) | 创建宜搭原生报表（16 种图表/表格/筛选器，可作为 yida-chart 数据源） |
| **yida-chart** | [`skills/yida-chart/SKILL.md`](skills/yida-chart/SKILL.md) | ECharts 高级报表（定制化数据大屏） |

### 配置与认证

| 技能 | 路径 | 说明 |
|------|------|------|
| **yida-login** | [`skills/yida-login/SKILL.md`](skills/yida-login/SKILL.md) | 登录态管理（通常自动触发） |
| **yida-logout** | [`skills/yida-logout/SKILL.md`](skills/yida-logout/SKILL.md) | 退出登录 / 切换账号 |
| **yida-page-config** | [`skills/yida-page-config/SKILL.md`](skills/yida-page-config/SKILL.md) | 页面公开访问 / 组织内分享配置 |

### 工具

| 技能 | 路径 | 说明 |
|------|------|------|
| **yida-flash-note-to-prd** | [`skills/yida-flash-note-to-prd/SKILL.md`](skills/yida-flash-note-to-prd/SKILL.md) | 钉钉闪记转高质量 Prompt |
| **yida-export-conversation** | [`skills/yida-export-conversation/SKILL.md`](skills/yida-export-conversation/SKILL.md) | 导出 AI 对话记录 |
| **yida-db-seq-fix** | [`skills/yida-db-seq-fix/SKILL.md`](skills/yida-db-seq-fix/SKILL.md) | PostgreSQL Sequence 自动修复（检测并修复主键冲突问题） |
| **large-file-write** | [`skills/large-file-write/SKILL.md`](skills/large-file-write/SKILL.md) | 大文件写入（解决 heredoc 截断问题） |

### 共享参考文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 宜搭 JS API | [`references/yida-api.md`](references/yida-api.md) | 31 个 API（表单操作/流程操作/设计/工具类） |
| 大模型 AI 接口 | [`references/model-api.md`](references/model-api.md) | AI 文本生成接口参数与示例 |
| 查询条件指南 | [`references/query-condition-guide.md`](references/query-condition-guide.md) | searchFieldJson 条件构造规范 |

---

## URL 规则

| 页面类型 | URL 格式 |
|---------|---------|
| 应用首页 | `{base_url}/{appType}/workbench` |
| 表单提交页 | `{base_url}/{appType}/submission/{formUuid}` |
| 自定义页面 | `{base_url}/{appType}/custom/{formUuid}` |
| 表单详情页 | `{base_url}/{appType}/formDetail/{formUuid}?formInstId={formInstId}` |

> 拼接 `&corpid={corpId}` 切换组织，拼接 `&isRenderNav=false` 隐藏导航。

---

## 常见问题

**Q：发布时提示登录失效？**
执行 `openyida login` 重新登录后再发布。

**Q：如何查看已有表单的字段 ID？**
使用 `openyida get-schema <appType> <formUuid>` 获取 Schema，详见 `yida-get-schema` 技能。

**Q：如何更新已有表单字段？**
使用 `yida-create-form-page` 的 update 模式：
```bash
openyida create-form update <appType> <formUuid> '[{"action":"add","field":{"type":"TextField","label":"新字段"}}]'
```

**Q：发布时提示 corpId 不匹配？**
询问用户是否在当前组织创建新应用，或重新登录到正确组织：
```bash
openyida logout
openyida login
```

**Q：如何在表单/页面中调用外部接口？**
参考 `references/connector-datasource.md`，通过 `--datasource` 参数注入连接器数据源，在 JS 中通过 `this.dataSourceMap.<名称>.load()` 调用。
