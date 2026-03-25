---
name: yida-app
description: 宜搭完整应用开发全流程编排。从零到一：创建应用 → 需求分析 → 创建页面 → 创建表单 → 编写代码 → 发布部署。
---

# 完整应用开发流程

## 流程总览

```
[1] openyida create-app "<应用名>"              → appType
[2] 需求分析 → 写入 prd/<项目名>.md
[3] openyida create-page <appType> "<页面名>"    → formUuid
[4] openyida create-form create <appType> ...   → formUuid（按需）
[5] openyida create-process <appType> ...       → processCode（需求含审批时）
[6] 按 yida-custom-page 规范编写 JSX
[7] openyida publish <源文件> <appType> <formUuid>
[8] 输出访问链接，用系统浏览器打开
```

## ⚠️ 前置检查：corpId 一致性

创建页面前，必须对比 prd 中的 `corpId` 与 `.cache/cookies.json` 中的 `corpId`：

- **一致** → 继续
- **不一致** → 询问用户：重新登录到 prd 中的组织，还是在当前组织新建应用？
- **prd 中无 corpId** → 直接新建应用

## 步骤详解

### Step 1：创建应用

```bash
openyida create-app "<应用名称>"
```

输出 `appType`（如 `APP_XXXXXX`），记录到 prd 文档。

### Step 2：需求分析

写入 `prd/<项目名>.md`，包含：

- **应用配置**：appType、corpId、baseUrl
- **功能需求**：核心功能、交互逻辑、隐含期望
- **页面与表单配置**：每个页面/表单的字段信息
- **UI 设计**：页面风格、布局、响应式要求

> prd 只记录业务语义信息，Schema ID（formUuid、fieldId）写入 `.cache/<项目名>-schema.json`。

### Step 3：创建自定义页面

```bash
openyida create-page <appType> "<页面名>"
```

输出 `formUuid`，记录到 prd 文档。

### Step 4：创建表单（按需）

```bash
openyida create-form create <appType> "<表单名>" fields.json
```

输出 `formUuid` 和各字段 `fieldId`，写入 `.cache/<项目名>-schema.json`。

### Step 5：配置流程（按需）

```bash
openyida create-process <appType> --formUuid <formUuid> process-definition.json
```

### Step 6：编写页面代码

**编写前必读**：`yida-custom-page` 的 SKILL.md。

代码文件：`pages/src/<项目名>.js`

### Step 7：发布

```bash
openyida publish pages/src/<项目名>.js <appType> <formUuid>
```

### Step 8：输出访问链接

| 页面类型 | URL 格式 |
|---------|----------|
| 应用首页 | `{base_url}/{appType}/workbench` |
| 表单提交页 | `{base_url}/{appType}/submission/{formUuid}` |
| 自定义页面 | `{base_url}/{appType}/custom/{formUuid}` |
| 隐藏导航 | 追加 `?isRenderNav=false` |
| 切换组织 | 追加 `&corpid={corpId}` |

## 配置存储

| 信息类型 | 存储位置 |
|---------|----------|
| 业务语义（应用名、字段名、字段类型） | `prd/<项目名>.md` |
| Schema ID（appType、formUuid、fieldId） | `.cache/<项目名>-schema.json` |

## 常见问题

- **发布提示登录失效**：`openyida logout` 后重新发布
- **一直登录失败**：直接提示用户联系开发同学
- **查看已有表单字段 ID**：`openyida get-schema <appType> <formUuid>`
- **页面代码更新后重新发布**：直接重新执行 `openyida publish`
