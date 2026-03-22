---
name: yida
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
| Node.js | ≥ 18 | 运行 openyida |

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
openyida env
```

**输出解读**：

| 字段 | 说明 |
|------|------|
| AI 工具检测 | 显示当前活跃的 AI 工具（悟空/OpenCode/Aone Copilot 等） |
| 当前生效环境 | 显示项目根目录路径 |
| 登录态检测 | 显示是否已登录、域名、组织 ID |

> **若显示"未登录"，自动执行 `openyida login`，无需手动操作。**。

---

## 🔧 初始化 project 工作目录

**在执行任何宜搭操作前，先确认 `project/` 目录存在**，不存在则执行初始化：

```bash
openyida copy
```

| AI 工具 | project 目录位置 |
|---------|-----------------|
| **悟空（Wukong）** | `~/.real/workspace/project` |
| **其他工具**（Aone Copilot、Cursor、Claude Code 等） | `<工程根目录>/project`（需在工程根目录下执行） |

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
[Step 4.5]（⚠️ 需求含「审批」「流程」「申请」「审核」「工单」等关键词时必须执行）
          配置流程 → 读取 skills/yida-create-process/SKILL.md → openyida create-process / configure-process
              ↓
[Step 5] 编写自定义页面代码 → yida-custom-page 规范 → pages/src/<项目名>.js
              ↓
[Step 6] 发布页面 → openyida publish
              ↓
[Step 7] 输出访问链接，用系统浏览器打开
```

> ⚠️ **公开访问配置不在主流程中**：若用户明确要求配置公开访问或组织内分享，再执行 `openyida verify-short-url` / `save-share-config`，详见 `skills/yida-page-config/SKILL.md`。

---

## 子技能速查

> 每个子技能均有独立的 SKILL.md，执行前请读取对应文档获取详细参数说明。

| 技能 | SKILL.md 路径 | 用途 | 典型命令 |
|------|--------------|------|---------|
| `yida-login` | `skills/yida-login/SKILL.md` | 登录态管理（通常自动触发） | `openyida login` |
| `yida-logout` | `skills/yida-logout/SKILL.md` | 退出登录 / 切换账号 | `openyida logout` |
| `yida-create-app` | `skills/yida-create-app/SKILL.md` | 创建应用，获取 appType | `openyida create-app "<名称>"` |
| `yida-create-page` | `skills/yida-create-page/SKILL.md` | 创建自定义页面，获取 formUuid | `openyida create-page <appType> "<页面名>"` |
| `yida-create-form-page` | `skills/yida-create-form-page/SKILL.md` | 创建/更新表单页面 | `openyida create-form create <appType> "<表单名>" <字段JSON>` |
| `yida-get-schema` | `skills/yida-get-schema/SKILL.md` | 获取表单 Schema，确认字段 ID | `openyida get-schema <appType> <formUuid>` |
| `yida-custom-page` | `skills/yida-custom-page/SKILL.md` | 编写自定义页面 JSX 代码规范 | **必须完整的学习完 SKILL.md** |
| `yida-publish-page` | `skills/yida-publish-page/SKILL.md` | 编译并发布自定义页面 | `openyida publish <源文件路径> <appType> <formUuid>` |
| `yida-page-config` | `skills/yida-page-config/SKILL.md` | 页面公开访问/组织内分享配置 | `openyida verify-short-url <appType> <formUuid> <url>` |
| `yida-form-permission` | `skills/yida-form-permission/SKILL.md` | 表单权限配置（字段/数据/操作权限） | `openyida get-permission <appType> <formUuid>` |
| `yida-data-management` | `skills/yida-data-management/SKILL.md` | 数据管理（表单实例/流程实例/任务中心的查询、新增、更新） | `openyida data query form <appType> <formUuid>` |
| `yida-create-report` | `skills/yida-create-report/SKILL.md` | 创建报表页面，支持 9 种图表和筛选器联动 | `openyida create-report <appType> "<报表名>" <图表JSON>` |
| `yida-connector` | `skills/yida-connector/SKILL.md` | 宜搭 HTTP 连接器管理（创建/编辑/测试/智能生成） | `openyida connector list` |
| `yida-report` | `skills/yida-report/SKILL.md` | 创建宜搭报表、追加图表 | `openyida create-report APP_XXX "报表名" charts.json` |
| `yida-ppt-slider` | `skills/yida-ppt-slider/SKILL.md` | PPT 幻灯片页面开发（演讲/路演/培训） | 详见技能文档 |

---

## 关键规则

### 1. 执行子技能前必须完整的读取其 SKILL.md

每个子技能的详细参数、注意事项、示例均在其 SKILL.md 中。**执行任何子技能前，必须先完整的读取对应的 SKILL.md**，不要凭记忆猜测参数格式。

### 2. corpId 一致性检查（必须遵守）

在创建页面前，**必须对比 prd 文档中的 corpId 与 `.cache/cookies.json` 中的 corpId 是否一致**：

- **一致** → 继续执行
- **不一致** → 询问用户：重新登录到正确组织，还是在当前组织新建应用？

### 3. 配置信息分两处存储

| 信息类型 | 存储位置 | 内容示例 |
|---------|---------|---------|
| 业务语义信息 | `prd/<项目名>.md` | 字段名称、字段类型、字段说明 |
| Schema ID | `.cache/<项目名>-schema.json` | `appType`、`formUuid`、`fieldId` |

> **prd 文档不记录 `formUuid`、`fieldId` 等 ID**，这些写入 `.cache/` 临时文件。

### 4. 临时文件规范

所有临时文件（cookies、schema 缓存等）**必须写在项目根目录的 `.cache/` 文件夹中**，不要写在系统其他位置。

### 5. Session 启动时引导用户选择组件库

**在新 Session 的第一次对话中**，如果用户提出了宜搭页面开发需求，AI 应主动询问是否需要加载官方组件库文档：

> 是否需要加载宜搭官方组件库文档？
> - ✅ **是，加载官方组件库** — 生成的组件样式将统一规范，推荐用于企业级应用
> - ⬜ **否，不加载** — 完全自定义实现，适合个性化页面

**根据用户选择执行**：

| 用户选择 | AI 行为 |
| --- | --- |
| **是** | 读取 `skills/yida-custom-page/SKILL.md` 中的「设计规范」章节，后续生成代码时优先参考官方组件规范（间距、色彩、字体等） |
| **否** | 跳过，完全根据需求自行实现，不受官方组件库约束 |

**何时触发**：
- 用户首次在本 Session 提出「创建页面」「开发自定义页面」「写页面代码」等需求时
- 若用户已明确说明使用自定义样式或指定了 UI 框架，则跳过询问

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
> 所有地址拼接 `&isRenderNav=false` 可隐藏默认导航。

---

## 常见问题

**Q：发布时提示登录失效？** 执行 `openyida login` 重新登录后再发布。

**Q：如何查看已有表单的字段 ID？** 使用 `openyida get-schema <appType> <formUuid>` 获取 Schema，详见 `yida-get-schema` 技能。

**Q：如何更新已有表单字段？** 使用 `yida-create-form-page` 的 update 模式，详见 `skills/yida-create-form-page/SKILL.md`。

**Q：发布时提示 corpId 不匹配？**

询问用户是否在当前组织创建新应用发布，或重新登录到正确组织：
```bash
openyida logout
openyida login
```
