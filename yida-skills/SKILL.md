---
name: yida
description: >
  宜搭低代码平台 AI 开发入口。一句话生成完整应用：创建应用、表单设计、自定义页面、流程配置、数据管理。
  当用户提到"宜搭"、"yida"、"低代码"、"创建应用"、"创建表单"、"发布页面"、"搭建"、"系统"时触发。
---

# 宜搭 AI 应用开发指南

## 概述

通过 AI 智能体（悟空/Claude/OpenCode 等）+ 宜搭低代码平台，一句话生成完整应用。所有操作通过 **`openyida`** CLI 统一执行。

- **登录态**：所有命令自动读取 `.cache/cookies.json`，Cookie 失效时自动触发登录
- **环境要求**：Node.js ≥ 18，安装命令 `npm install -g openyida`

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

## ⚡ 首要步骤：检测运行环境（必须先执行）

**在执行任何宜搭操作前，必须先运行环境检测命令**，确认当前 AI 工具环境和登录态：

```bash
# 1. 检测 AI 工具环境和登录态
openyida env

# 2. 确认 project/ 目录存在，不存在则初始化
openyida copy
```

---

## 开发流程

```
[Step 1] 创建应用 → openyida create-app          → 获得 appType
              ↓
[Step 2] 需求分析 → 写入 prd/<项目名>.md
              ↓
[Step 3] 创建自定义页面 → openyida create-page    → 获得 formUuid（自定义页面）
              ↓
[Step 4]（按需）创建/更新表单 → openyida create-form → 获得 formUuid（表单）
              ↓
[Step 5]（⚠️ 需求含「审批」「流程」「申请」「审核」「工单」等关键词时必须执行）
          配置流程 → 读取 skills/yida-create-process/SKILL.md → openyida create-process / configure-process
              ↓
[Step 6] 编写自定义页面代码 → yida-custom-page 规范 → pages/src/<项目名>.js
              ↓  （⚠️ 列表/表格类页面：参考 yida-density 技能选择合适的信息密度）
              ↓
[Step 7] （可选）预检语法 → openyida compile <源文件路径>   # 仅编译，不发布，快速验证语法
              ↓
[Step 8] 发布页面 → openyida publish <源文件路径> <appType> <formUuid>
              ↓
[Step 9] 输出访问链接，用系统浏览器打开
```

> 完整流程编排详见 [`skills/yida-app/SKILL.md`](skills/yida-app/SKILL.md)。

### ⚠️ 重要：使用模板文件确保一次性成功

为避免生成错误代码，**必须**使用各技能的模板文件：

| 技能 | 模板文件 | 用途 |
|------|---------|------|
| yida-custom-page | [templates/custom-page-template.js](skills/yida-custom-page/templates/custom-page-template.js) | 自定义页面完整模板 |
| yida-data-management | [templates/form-field-template.js](skills/yida-data-management/templates/form-field-template.js) | 表单字段定义和数据插入 |
| yida-create-app | [templates/ipd-app-template.js](skills/yida-create-app/templates/ipd-app-template.js) | 完整应用创建示例 |

**⚠️ 代码生成前必须**：
1. 读取对应的模板文件
2. 以模板为基础进行扩展
3. 验证所有参数名称与 CLI 一致

---

## 子技能速查

> 每个子技能均有独立的 SKILL.md，执行前请仔细读取对应文档获取详细参数说明。

| 技能 | SKILL.md 路径 | 用途 | 典型命令 |
|------|--------------|------|---------|
| `yida-login` | `skills/yida-login/SKILL.md` | 登录态管理（通常自动触发） | `openyida login` |
| `yida-logout` | `skills/yida-logout/SKILL.md` | 退出登录 / 切换账号 | `openyida logout` |
| `yida-create-app` | `skills/yida-create-app/SKILL.md` | 创建应用，获取 appType | `openyida create-app "<名称>"` |
| `yida-create-page` | `skills/yida-create-page/SKILL.md` | 创建自定义页面，获取 formUuid | `openyida create-page <appType> "<页面名>" [--datasource <json>]` |
| `yida-create-form-page` | `skills/yida-create-form-page/SKILL.md` | 创建/更新表单页面 | `openyida create-form create <appType> "<表单名>" <字段JSON> [--datasource <json>]` |
| `yida-get-schema` | `skills/yida-get-schema/SKILL.md` | 获取表单 Schema，确认字段 ID | `openyida get-schema <appType> <formUuid>` |
| `yida-custom-page` | `skills/yida-custom-page/SKILL.md` | 编写自定义页面 JSX 代码规范。子目录包含：`SKILL.md`（编译规范）、`yida-assets-guide.md`（素材资源）、`examples/`（示例代码） | **必须完整学习 `skills/yida-custom-page/SKILL.md`** |
| `yida-compile` | `skills/yida-custom-page/SKILL.md` | 仅编译 JSX 源码（Babel + UglifyJS），不发布，无需登录，用于本地预检语法 | `openyida compile <源文件路径>` |
| `yida-publish-page` | `skills/yida-publish-page/SKILL.md` | 编译并发布自定义页面 | `openyida publish <源文件路径> <appType> <formUuid>` |
| `yida-page-config` | `skills/yida-page-config/SKILL.md` | 页面公开访问/组织内分享配置 | `openyida verify-short-url <appType> <formUuid> <url>` |
| `yida-form-permission` | `skills/yida-form-permission/SKILL.md` | 表单权限配置（字段/数据/操作权限） | `openyida get-permission <appType> <formUuid>` |
| `yida-data-management` | `skills/yida-data-management/SKILL.md` | 数据管理（表单实例/流程实例/任务中心的查询、新增、更新） | `openyida data query form <appType> <formUuid>` |
| `yida-create-report` | `skills/yida-create-report/SKILL.md` | 创建报表页面，支持 9 种图表和筛选器联动 | `openyida create-report <appType> "<报表名>" <图表JSON>` |
| `yida-connector` | `skills/yida-connector/SKILL.md` | 宜搭 HTTP 连接器管理（创建/编辑/测试/智能生成） | `openyida connector list` |
| `yida-app` | `skills/yida-app/SKILL.md` | 完整应用开发全流程（从零到一，含创建/表单/页面/发布） | 详见技能文档 |
| `yida-chart` | `skills/yida-chart/SKILL.md` | ECharts 高级可视化大屏（依赖 yida-report 作为数据源） | 详见技能文档 |
| `yida-density` | `skills/yida-density/SKILL.md` | 自定义页面信息密度规范（紧凑/舒适/宽松三种模式） | 详见技能文档 |
| `yida-integration` | `skills/yida-integration/SKILL.md` | 集成&自动化（逻辑流）：表单事件触发 → 消息通知/数据操作 | `openyida integration create <appType> <formUuid> "<名称>"` |
| `yida-process-rule` | `skills/yida-process-rule/SKILL.md` | 为已有流程表单配置审批流程规则（条件分支/嵌套分支/字段权限） | `openyida configure-process <appType> <formUuid> <定义文件>` |
| `yida-table-form` | `skills/yida-table-form/SKILL.md` | 表格形式批量表单提交（动态增删行/Excel 粘贴导入/批量提交） | 详见技能文档 |
| `yida-ppt-slider` | `skills/yida-ppt-slider/SKILL.md` | PPT 幻灯片页面开发（演讲/路演/培训，仅限宜搭平台内） | 详见技能文档 |
| `yida-formula` | `skills/yida-formula/SKILL.md` | 公式字段编写规范（函数速查、字段引用、18 个常见场景示例） | 详见技能文档 |

> **执行任何子技能前，必须先完整读取其 SKILL.md**，不要凭记忆猜测参数格式。

### 应用生命周期

| 技能 | 路径 | 说明 |
|------|------|------|
| **yida-app** | [`skills/yida-app/SKILL.md`](skills/yida-app/SKILL.md) | 完整应用开发全流程编排（从零到一） |
| **yida-create-app** | [`skills/yida-create-app/SKILL.md`](skills/yida-create-app/SKILL.md) | 创建应用，获取 appType |
| **yida-create-page** | [`skills/yida-create-page/SKILL.md`](skills/yida-create-page/SKILL.md) | 创建自定义展示页面 |
| **yida-publish-page** | [`skills/yida-publish-page/SKILL.md`](skills/yida-publish-page/SKILL.md) | 编译并发布自定义页面 |

### 表单与数据

| 技能 | 路径 | 说明 |
|------|------|------|
| **yida-create-form-page** | [`skills/yida-create-form-page/SKILL.md`](skills/yida-create-form-page/SKILL.md) | 创建/更新表单（19 种字段类型） |
| **yida-get-schema** | [`skills/yida-get-schema/SKILL.md`](skills/yida-get-schema/SKILL.md) | 获取表单 Schema，确认字段 ID |
| **yida-data-management** | [`skills/yida-data-management/SKILL.md`](skills/yida-data-management/SKILL.md) | 表单/流程实例的查询、新增、更新 |
| **yida-form-permission** | [`skills/yida-form-permission/SKILL.md`](skills/yida-form-permission/SKILL.md) | 表单权限配置（字段/数据/操作权限） |

### 流程

### 1. 编写自定义页面代码前必须完整学习 `skills/yida-custom-page/SKILL.md`

### 2. 生成表单 schema 前必须完整学习 `skills/yida-create-form-page/SKILL.md`

### 3. corpId 一致性检查（必须遵守）
| 技能 | 路径 | 说明 |
|------|------|------|
| **yida-create-process** | [`skills/yida-create-process/SKILL.md`](skills/yida-create-process/SKILL.md) | 一键创建流程表单（创建+转流程+配置） |
| **yida-process-rule** | [`skills/yida-process-rule/SKILL.md`](skills/yida-process-rule/SKILL.md) | 流程规则配置（条件分支/审批节点/字段权限） |
| **yida-integration** | [`skills/yida-integration/SKILL.md`](skills/yida-integration/SKILL.md) | 创建集成&自动化逻辑流（触发事件/通知/数据操作） |

### 自定义页面开发

| 技能 | 路径 | 说明 |
|------|------|------|
| **yida-custom-page** | [`skills/yida-custom-page/SKILL.md`](skills/yida-custom-page/SKILL.md) | JSX 编码规范、API 调用、状态管理 |
| **yida-density** | [`skills/yida-density/SKILL.md`](skills/yida-density/SKILL.md) | 信息密度设计规范（紧凑/舒适/宽松） |
| **yida-table-form** | [`skills/yida-table-form/SKILL.md`](skills/yida-table-form/SKILL.md) | 表格形式批量表单提交 |
| **yida-ppt-slider** | [`skills/yida-ppt-slider/SKILL.md`](skills/yida-ppt-slider/SKILL.md) | PPT 幻灯片页面开发（演讲/路演/培训） |

### 4. 配置信息分两处存储
### 连接器与报表

| 技能 | 路径 | 说明 |
|------|------|------|
| **yida-connector** | [`skills/yida-connector/SKILL.md`](skills/yida-connector/SKILL.md) | HTTP 连接器管理（创建/测试/智能生成） |
| **yida-create-report** | [`skills/yida-create-report/SKILL.md`](skills/yida-create-report/SKILL.md) | 创建宜搭报表、追加图表 |
| **yida-chart** | [`skills/yida-chart/SKILL.md`](skills/yida-chart/SKILL.md) | ECharts 高级报表（定制化数据大屏） |

### 配置与认证

### 5. 临时文件规范
| 技能 | 路径 | 说明 |
|------|------|------|
| **yida-login** | [`skills/yida-login/SKILL.md`](skills/yida-login/SKILL.md) | 登录态管理（通常自动触发） |
| **yida-logout** | [`skills/yida-logout/SKILL.md`](skills/yida-logout/SKILL.md) | 退出登录 / 切换账号 |
| **yida-page-config** | [`skills/yida-page-config/SKILL.md`](skills/yida-page-config/SKILL.md) | 页面公开访问 / 组织内分享配置 |

### 工具

| 技能 | 路径 | 说明 |
|------|------|------|
| **yida-export-conversation** | [`skills/yida-export-conversation/SKILL.md`](skills/yida-export-conversation/SKILL.md) | 导出 AI 对话记录 |

### 共享参考文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 宜搭 JS API | [`reference/yida-api.md`](reference/yida-api.md) | 31 个 API（表单操作/流程操作/设计/工具类） |
| 大模型 AI 接口 | [`reference/model-api.md`](reference/model-api.md) | AI 文本生成接口参数与示例 |
| 查询条件指南 | [`reference/query-condition-guide.md`](reference/query-condition-guide.md) | searchFieldJson 条件构造规范 |

---

## 关键规则

1. **读取 SKILL.md 再执行**：每个子技能的参数、注意事项均在其 SKILL.md 中，执行前必须完整读取
2. **corpId 一致性检查**：创建页面前，对比 prd 中的 corpId 与 `.cache/cookies.json` 中的 corpId，不一致时询问用户
3. **配置分离存储**：业务语义信息写入 `prd/<项目名>.md`，Schema ID（appType/formUuid/fieldId）写入 `.cache/<项目名>-schema.json`
4. **临时文件统一存放**：所有临时文件必须写在项目根目录的 `.cache/` 文件夹中

---

## URL 规则

| 页面类型 | URL 格式 |
|---------|---------|
| 应用首页 | `{base_url}/{appType}/workbench` |
| 表单提交页 | `{base_url}/{appType}/submission/{formUuid}` |
| 自定义页面 | `{base_url}/{appType}/custom/{formUuid}` |
| 表单详情页 | `{base_url}/{appType}/formDetail/{formUuid}?formInstId={formInstId}` |

**Q：发布时提示登录失效？** 执行 `openyida login` 重新登录后再发布。

**Q：如何查看已有表单的字段 ID？** 使用 `openyida get-schema <appType> <formUuid>` 获取 Schema，详见 `yida-get-schema` 技能。

**Q：如何更新已有表单字段？** 使用 `yida-create-form-page` 的 update 模式，详见 `skills/yida-create-form-page/SKILL.md`：
```bash
openyida create-form update <appType> <formUuid> '[{"action":"add","field":{"type":"TextField","label":"新字段"}}]'
```

**Q：发布时提示 corpId 不匹配？**

询问用户是否在当前组织创建新应用发布，或重新登录到正确组织：
```bash
openyida logout
openyida login
```

**Q：如何在表单/页面中使用连接器调用外部接口？**

参考 `reference/connector-datasource.md`，了解连接器数据源的定义方式和 JS 调用规范。支持 HTTP 连接器、宜搭内置连接器、第三方连接器等多种类型，在表单页面和自定义页面中均可使用：
- 通过 `--datasource` 参数在创建表单/页面时注入连接器数据源
- 在 JS 中通过 `this.dataSourceMap.<名称>.load({ inputs: JSON.stringify({...}) })` 调用
> 拼接 `&corpid={corpId}` 切换组织，拼接 `&isRenderNav=false` 隐藏导航。
