---
name: yida-custom-page
description: 宜搭自定义页面开发技能，包含宜搭表单 JS API 调用（增删改查/流程/工具类共 27 个）、React 16 JSX 组件开发规范、状态管理模式与编码约束。
license: MIT
compatibility:
  - opencode
  - claude-code
metadata:
  audience: developers
  workflow: yida-development
  version: 1.0.0
  tags:
    - yida
    - low-code
    - react
    - custom-page
---

# 宜搭自定义页面开发技能

## 概述

本技能提供在阿里宜搭低代码平台上开发**自定义页面**的完整能力，涵盖从编码到部署的全流程：

| 能力 | 说明 |
| --- | --- |
| **表单数据操作** | 通过宜搭前端 JS API（`this.utils.yida.*`）对表单数据进行增删改查 |
| **JSX 组件开发** | 编写 React 16 兼容的 JSX 代码，实现个性化定制页面 |
| **AI 能力集成** | 调用大模型 AI 接口（`/query/intelligent/txtFromAI.json`）实现智能文本生成 |
| **自动编译部署** | 通过工具链将源码编译、压缩，并自动合并到宜搭 Schema 中保存 |

## 何时使用

当以下场景发生时使用此技能：
- 用户需要开发自定义展示页面（非表单）
- 用户需要实现复杂的页面交互逻辑
- 用户需要调用宜搭 JS API 进行数据操作
- 已有自定义页面，需要编写或修改 JSX 代码

---

## 快速开始

### 1. 创建自定义页面

```bash
openyida create-page <appType> <页面标题>
```

### 2. 编写代码

在 `project/pages/src/` 下创建 `.js` 文件，按照 [编码指南](../../reference/coding-guide.md) 中的文件结构模板编写代码。

### 3. 编译 + 发布

```bash
openyida publish <源文件路径> <appType> <formUuid>
```

**处理流程**：
1. 通过内置 `babel-transform` 将 JSX 转换为 ES5 + UglifyJS 压缩
2. 通过代码动态构建完整的 Schema JSON，将 `source` 和 `compiled` 填入 `actions.module`
3. 调用 `yida-login` 获取登录态（Cookie 持久化，首次需扫码登录）
4. 通过 HTTP POST 调用 `saveFormSchema` 接口保存 Schema

---

## 核心约束速查

> 完整编码规范详见 [编码指南](references/coding-guide.md)，以下仅列出最关键的约束。

| # | 约束 | 说明 |
|---|------|------|
| 1 | **React 16** | 禁止使用 Hooks（`useState`、`useEffect` 等），必须兼容类组件模式 |
| 2 | **单文件** | 所有代码写在一个 `.js` 文件中 |
| 3 | **`export function`** | 所有需要 `this` 的方法必须用 `export function` 定义 |
| 4 | **事件绑定** | 必须用箭头函数包裹：`onClick={(e) => { this.handleClick(e) }}`，严禁 `onClick={this.handleClick}` |
| 5 | **非受控输入** | `<input>` 使用 `defaultValue`，`onChange` 中写入 `_customState` 而非 `setCustomState` |
| 6 | **内联样式** | 所有样式通过 JS 对象 + `style` 属性，不使用外部 CSS |
| 7 | **pageSize ≤ 100** | 分页接口 `pageSize` 最大 100，超过会报错 |
| 8 | **ES2015** | JavaScript 版本不能高于 ES2015，禁止 `import/require` |
| 9 | **定时器清理** | `didUnmount` 中必须清理所有 `setInterval` / `setTimeout` |
| 10 | **错误处理** | 所有 API 调用必须 `.catch()` 并 `toast` 提示用户 |

---

## API 速查

### 表单数据操作

通过 `this.utils.yida.<方法名>(params)` 调用，所有接口返回 Promise。

| 方法 | 说明 | 必填参数 |
| --- | --- | --- |
| `saveFormData` | 新建表单实例 | `formUuid`, `appType`, `formDataJson` |
| `updateFormData` | 更新表单实例 | `formInstId`, `updateFormDataJson` |
| `deleteFormData` | 删除表单实例 | `formUuid` |
| `getFormDataById` | 根据实例 ID 查询详情 | `formInstId` |
| `searchFormDatas` | 按条件搜索表单实例详情列表 | `formUuid` |
| `searchFormDataIds` | 按条件搜索表单实例 ID 列表 | `formUuid` |
| `getFormComponentDefinationList` | 获取表单定义 | `formUuid` |

完整参数说明和调用示例请参考 [yida-api.md](../../reference/yida-api.md) 的「表单数据操作」章节。

### 流程操作

| 方法 | 说明 | 必填参数 |
| --- | --- | --- |
| `startProcessInstance` | 发起流程 | `formUuid`, `processCode`, `formDataJson` |
| `updateProcessInstance` | 更新流程实例 | `processInstanceId`, `updateFormDataJson` |
| `deleteProcessInstance` | 删除流程实例 | `processInstanceId` |
| `getProcessInstanceById` | 根据实例 ID 查询流程详情 | `processInstanceId` |
| `getProcessInstances` | 按条件搜索流程实例详情列表 | — |
| `getProcessInstanceIds` | 按条件搜索流程实例 ID 列表 | — |

### 表单设计类 API

以下接口用于表单页面的创建和配置，通过 HTTP 请求调用：

| 方法 | 说明 | 调用方式 |
| --- | --- | --- |
| `saveFormSchemaInfo` | 创建空白表单 | `POST /dingtalk/web/{appType}/query/formdesign/saveFormSchemaInfo.json` |
| `getFormSchema` | 获取表单 Schema | `GET /alibaba/web/{appType}/_view/query/formdesign/getFormSchema.json` |
| `saveFormSchema` | 保存表单 Schema | `POST /dingtalk/web/{appType}/_view/query/formdesign/saveFormSchema.json` |
| `updateFormConfig` | 更新表单配置 | `POST /dingtalk/web/{appType}/query/formdesign/updateFormConfig.json` |

完整参数说明请参考 [yida-api.md](../../reference/yida-api.md) 的「表单设计类 API」章节。

### 大模型 AI 接口

| 方法 | 说明 | 调用方式 |
| --- | --- | --- |
| `txtFromAI` | AI 文本生成 | `POST /query/intelligent/txtFromAI.json` |

**主要参数**：`_csrf_token`（CSRF 令牌）、`prompt`（提示词）、`skill`（技能类型，如 `ToText`）、`maxTokens`（最大返回 token 数）

完整参数说明和示例请参考 [model-api.md](../../reference/model-api.md)。

### 工具类 API 速查

以下工具函数通过 `this.utils.<方法名>()` 调用，无需 `yida` 命名空间：

| 方法 | 用途 | 典型场景 |
| --- | --- | --- |
| `toast` | 轻提示 | 操作成功/失败提示、loading 状态 |
| `dialog` | 对话框 | 确认操作、复杂内容展示 |
| `formatter` | 格式化 | 日期、金额、手机号格式化 |
| `getDateTimeRange` | 获取时间范围 | 按日/月/周筛选数据 |
| `getLoginUserId` / `getLoginUserName` | 获取当前用户 | 记录操作人、数据权限控制 |
| `getLocale` | 获取语言环境 | 多语言适配 |
| `isMobile` | 判断移动端 | 响应式布局适配 |
| `isSubmissionPage` | 判断是否提交页面 | 页面逻辑区分 |
| `isViewPage` | 判断是否查看页面 | 页面逻辑区分 |
| `openPage` | 打开新页面 | 页面跳转、外链打开 |
| `router.push` | 页面路由跳转工具 | 页面路由跳转、避免新开页面 |
| `previewImage` | 图片预览 | 图片查看、多图轮播 |
| `loadScript` | 动态加载脚本 | 引入第三方库（如二维码生成） |

完整参数说明和示例请参考 [yida-api.md](../../reference/yida-api.md) 的「工具类 API」章节。

---

## 工具链

| Skill | 说明 | 用法 |
| --- | --- | --- |
| **yida-login** | 登录态管理（Cookie 持久化 + 扫码登录） | `openyida login` |
| **yida-publish-page** | 编译源码 + 构建 Schema + 发布到宜搭 | `openyida publish <源文件路径> <appType> <formUuid>` |
| **yida-page-config** | 页面配置（URL 验证、公开访问/分享配置） | 详见 `yida-page-config` 技能文档 |

---

## 参考文档

| 文档 | 说明 |
| --- | --- |
| [编码指南](../../reference/coding-guide.md) | 运行环境约束、文件结构模板、状态管理、17 条编码注意事项 |
| [设计规范](../../reference/design-system.md) | 色彩系统、圆角/字体/间距规范、组件样式模板、设计反模式 |
| [素材资源指南](references/assets-guide.md) | 图片/音乐/Icon 素材库推荐、CDN 安全规范 |
| [宜搭 API 参考](../../reference/yida-api.md) | 表单数据操作、流程操作、工具类 API 完整参数说明 |
| [大模型 API](../../reference/model-api.md) | AI 文本生成接口参数说明和示例 |
| [查询条件指南](../../reference/query-condition-guide.md) | searchFieldJson 查询条件构建指南 |
| [关联表单字段](../../reference/association-form-field.md) | 关联表单字段的数据结构和操作方式 |
| [成员字段](../../reference/employee-field.md) | 成员/部门字段的数据格式 |
| [流水号字段](../../reference/serial-number-field.md) | 流水号字段的配置和使用 |
