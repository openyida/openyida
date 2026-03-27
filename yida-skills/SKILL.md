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

## 首要步骤（每次必须先执行）

```bash
# 1. 检测 AI 工具环境和登录态
openyida env

# 2. 确认 project/ 目录存在，不存在则初始化
openyida copy
```

---

## 开发流程

```
[1] 创建应用    → openyida create-app           → 获得 appType
[2] 需求分析    → 写入 prd/<项目名>.md
[3] 创建页面    → openyida create-page           → 获得 formUuid
[4] 创建表单    → openyida create-form（按需）    → 获得 formUuid
[5] 配置流程    → openyida create-process（需求含审批/流程时必须执行）
[6] 编写代码    → 按 yida-custom-page 规范编写 JSX
[7] 发布部署    → openyida publish
[8] 输出链接    → 用系统浏览器打开
```

> 完整流程编排详见 [`skills/yida-app/SKILL.md`](skills/yida-app/SKILL.md)。

---

## 子技能索引

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

| 技能 | 路径 | 说明 |
|------|------|------|
| **yida-create-process** | [`skills/yida-create-process/SKILL.md`](skills/yida-create-process/SKILL.md) | 一键创建流程表单（创建+转流程+配置） |
| **yida-process-rule** | [`skills/yida-process-rule/SKILL.md`](skills/yida-process-rule/SKILL.md) | 流程规则配置（条件分支/审批节点/字段权限） |

### 自定义页面开发

| 技能 | 路径 | 说明 |
|------|------|------|
| **yida-custom-page** | [`skills/yida-custom-page/SKILL.md`](skills/yida-custom-page/SKILL.md) | JSX 编码规范、API 调用、状态管理 |
| **yida-density** | [`skills/yida-density/SKILL.md`](skills/yida-density/SKILL.md) | 信息密度设计规范（紧凑/舒适/宽松） |
| **yida-table-form** | [`skills/yida-table-form/SKILL.md`](skills/yida-table-form/SKILL.md) | 表格形式批量表单提交 |

### 连接器与报表

| 技能 | 路径 | 说明 |
|------|------|------|
| **yida-connector** | [`skills/yida-connector/SKILL.md`](skills/yida-connector/SKILL.md) | HTTP 连接器管理（创建/测试/智能生成） |
| **yida-report** | [`skills/yida-report/SKILL.md`](skills/yida-report/SKILL.md) | 创建报表、追加图表 |

### 配置与认证

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

> 拼接 `&corpid={corpId}` 切换组织，拼接 `&isRenderNav=false` 隐藏导航。
