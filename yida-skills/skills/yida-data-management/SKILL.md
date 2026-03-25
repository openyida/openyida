---
name: yida-data-management
description: 宜搭数据管理技能，覆盖表单实例、流程实例、任务中心的查询、新增、更新能力，并明确区分普通表单与流程实例的不同请求路径。
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
    - data
    - form
    - process
    - task
    - api
---

# 宜搭数据管理技能

## 概述

本技能用于整理宜搭数据层接口，覆盖：
- 表单实例
- 流程实例
- 任务中心

支持操作：
- 查询
- 新增
- 更新

不包含删除。

> 关键点：普通表单与流程实例不是同一套接口。表单走 `/v1/form/...`，流程走 `/v1/process/...`，主键、参数、返回结构都不同，不能混用。

## 前置依赖

- Node.js >= 18
- 项目根目录存在 `.cache/cookies.json`
- 项目根目录存在 `config.json`，或默认域名为 `https://www.aliwork.com`

登录态说明：
- Cookie 失效时自动触发登录
- CSRF Token 从 `tianshu_csrf_token` 提取

## 何时使用

- 查询表单实例列表或详情
- 新增或更新表单实例
- 查询流程实例列表或详情
- 发起或更新流程实例
- 查询审批记录或执行任务
- 查询待办、已办、已提交、抄送任务

## 使用方式

建议统一命令入口：

```bash
openyida data <action> <resource> [args] [options]
```

### 表单实例

```bash
openyida data query form <appType> <formUuid> [options]
openyida data get form <appType> --inst-id <formInstId>
openyida data create form <appType> <formUuid> --data-json '<json>'
openyida data update form <appType> --inst-id <formInstId> --data-json '<json>'
openyida data query subform <appType> <formUuid> --inst-id <formInstId> --table-field-id <fieldId>
```

### 流程实例

```bash
openyida data query process <appType> <formUuid> [options]
openyida data get process <appType> --process-inst-id <processInstanceId>
openyida data create process <appType> <formUuid> --process-code <processCode> --data-json '<json>'
openyida data update process <appType> --process-inst-id <processInstanceId> --data-json '<json>'
openyida data query operation-records <appType> --process-inst-id <processInstanceId>
openyida data execute task <appType> --task-id <taskId> --process-inst-id <processInstanceId> --out-result AGREE --remark '同意'
```

### 任务中心

```bash
openyida data query tasks <appType> --type todo --page 1 --size 20
openyida data query tasks <appType> --type done --page 1 --size 20
openyida data query tasks <appType> --type submitted --page 1 --size 20
openyida data query tasks <appType> --type cc --page 1 --size 20
```

## 必填参数校验

只校验必填参数是否填写，不做值合法性深校验。

| 命令 | 必填参数 |
| --- | --- |
| `query form` | `appType`, `formUuid` |
| `get form` | `appType`, `instId` |
| `create form` | `appType`, `formUuid`, `dataJson` |
| `update form` | `appType`, `instId`, `dataJson` |
| `query subform` | `appType`, `formUuid`, `instId`, `tableFieldId` |
| `query process` | `appType`, `formUuid` |
| `get process` | `appType`, `processInstanceId` |
| `create process` | `appType`, `formUuid`, `processCode`, `dataJson` |
| `update process` | `appType`, `processInstanceId`, `dataJson` |
| `query operation-records` | `appType`, `processInstanceId` |
| `execute task` | `appType`, `taskId`, `processInstanceId`, `outResult`, `remark` |
| `query tasks` | `appType`, `type` |

建议报错：

```text
参数校验失败：缺少必填参数 --process-code
```

## 接口总览

### 一、表单实例

| 接口 | 方法 | 路径 | 说明 |
| --- | --- | --- | --- |
| `searchFormDatas` | GET | `/dingtalk/web/{appType}/v1/form/searchFormDatas.json` | 查询表单实例详情列表 |
| `searchFormDataIds` | GET | `/dingtalk/web/{appType}/v1/form/searchFormDataIds.json` | 查询表单实例 ID 列表 |
| `getFormDataById` | GET | `/dingtalk/web/{appType}/v1/form/getFormDataById.json` | 查询单个表单实例详情 |
| `saveFormData` | POST | `/dingtalk/web/{appType}/v1/form/saveFormData.json` | 新增表单实例 |
| `updateFormData` | POST | `/dingtalk/web/{appType}/v1/form/updateFormData.json` | 更新表单实例 |
| `listTableDataByFormInstIdAndTableId` | GET | `/dingtalk/web/{appType}/v1/form/listTableDataByFormInstIdAndTableId.json` | 查询子表单数据 |

常用参数：
- 列表：`formUuid`, `searchFieldJson`, `currentPage`, `pageSize`
- 详情：`formInstId`
- 新增：`formUuid`, `appType`, `formDataJson`
- 更新：`formInstId`, `updateFormDataJson`

常见返回字段：
- 列表：`content.totalCount`, `content.currentPage`, `content.data[]`
- 详情：`result.formInstId`, `result.formUuid`, `result.formData`

### 二、流程实例

| 接口 | 方法 | 路径 | 说明 |
| --- | --- | --- | --- |
| `startProcessInstance` | POST | `/dingtalk/web/{appType}/v1/process/startInstance.json` | 发起流程 |
| `getInstanceIds` | GET | `/dingtalk/web/{appType}/v1/process/getInstanceIds.json` | 查询流程实例 ID |
| `getInstances` | GET | `/dingtalk/web/{appType}/v1/process/getInstances.json` | 查询流程实例详情列表 |
| `getInstanceById` | GET | `/dingtalk/web/{appType}/v1/process/getInstanceById.json` | 查询单个流程实例详情 |
| `updateInstance` | POST | `/dingtalk/web/{appType}/v1/process/updateInstance.json` | 更新流程实例 |
| `getOperationRecords` | GET | `/dingtalk/web/{appType}/v1/process/getOperationRecords.json` | 获取审批记录 |
| `executeTask` | POST | `/dingtalk/web/{appType}/v1/task/executeTask.json` | 执行单个任务 |

常用参数：
- 列表：`formUuid`, `searchFieldJson`, `instanceStatus`, `approvedResult`, `currentPage`, `pageSize`
- 详情：`processInstanceId`
- 发起：`processCode`, `formUuid`, `formDataJson`
- 更新：`processInstanceId`, `updateFormDataJson`

常见返回字段：
- 列表：`result.totalCount`, `result.currentPage`, `result.data[]`
- 详情：`result.data.processInstanceId`, `result.data.processCode`, `result.data.instanceStatus`, `result.data.data`

> 流程发起接口也按 `/dingtalk/web/...` 口径整理，便于与其他流程接口保持一致。

### 三、任务中心

| 接口 | 方法 | 路径 | 说明 |
| --- | --- | --- | --- |
| `getMySubmitInApp` | GET | `/dingtalk/web/{appType}/v1/process/getMySubmitInApp.json` | 已提交任务 |
| `getTodoTasksInApp` | GET | `/dingtalk/web/{appType}/v1/task/getTodoTasksInApp.json` | 待办任务 |
| `getDoneTasksInApp` | GET | `/dingtalk/web/{appType}/v1/task/getDoneTasksInApp.json` | 已完成任务 |
| `getNotifyMeTasksInApp` | GET | `/dingtalk/web/{appType}/v1/task/getNotifyMeTasksInApp.json` | 抄送我的任务 |

## 数据格式

### 查询条件 `searchFieldJson`

必须传**字符串**，不能直接传对象。

```bash
--search-json '[{"key":"textField_xxx","value":"测试","type":"TEXT","operator":"eq","componentName":"TextField"}]'
```

### 保存 / 更新数据

`formDataJson`、`updateFormDataJson` 也应传字符串：

```json
{
  "textField_xxx": "文本",
  "numberField_xxx": 10,
  "employeeField_xxx": ["2212173665758008"]
}
```

### 排序 `dynamicOrder`

也必须传字符串：

```json
{"numberField_1ac":"+"}
```

### 常见字段格式速查

| 组件类型 | 查询格式 | 保存 / 更新格式 |
| --- | --- | --- |
| 单行 / 多行文本 | `"文本"` | `"文本"` |
| 数字 | `["1","10"]` 或单值 | `1` |
| 单选 | `"选项一"` | `"选项一"` |
| 多选 | `["选项一"]` | `["选项一","选项二"]` |
| 日期 | `[开始时间戳,结束时间戳]` | `时间戳` |
| 成员 | `["userId"]` | `["userId"]` |
| 部门 | `1123456` 或 `["1123456"]` | `["1123456"]` |
| 子表单 | `"模糊搜索文本"` | `[{"textField_xxx":"值"}]` |

## 常用示例

```bash
# 查询表单列表
openyida data query form "APP_XXX" "FORM_XXX" --page 1 --size 20

# 查询流程列表
openyida data query process "APP_XXX" "FORM_XXX" --instance-status RUNNING

# 新增表单实例
openyida data create form "APP_XXX" "FORM_XXX" --data-json '{"textField_xxx":"测试"}'

# 发起流程
openyida data create process "APP_XXX" "FORM_XXX" --process-code "TPROC--XXX" --data-json '{"textField_xxx":"123"}'

# 查询任务
openyida data query tasks "APP_XXX" --type todo --page 1 --size 10
```

## 与其他技能配合

- `yida-login`：登录态管理
- `yida-get-schema`：获取字段 ID
- `yida-create-form-page`：创建 / 更新表单结构
- `yida-create-process`：获取 `processCode` 并配置流程

## 详细参考

- 接口矩阵：`reference/api-matrix.md`
- 数据格式：`reference/data-format-guide.md`
- 实测可用接口：`reference/verified-endpoints.md`

## 文件结构

```text
yida-data-management/
├── SKILL.md
└── references/
    ├── api-matrix.md
    ├── data-format-guide.md
    └── verified-endpoints.md

CLI:
├── bin/yida.js
└── lib/data-management.js
```

## 注意事项

1. Cookie 建议优先从项目根目录 `.cache/` 查找
2. 请求应自动附带 `_csrf_token` 和 `_stamp`
3. `pageSize` 最大值建议不超过 `100`
4. 宜搭接口 QPS 限制约为 **40 次/秒**
5. `searchFieldJson` 和 `dynamicOrder` 传字符串
6. 表单和流程的接口路径不能混用
7. 字段 ID 不要手写猜测，优先通过 `openyida get-schema` 获取

## 常见问题

**Q：为什么 `query form` 和 `query process` 不能复用一套模板？**

A：因为接口域、主键、返回结构都不同。表单围绕 `formInstId` / `formData`，流程围绕 `processInstanceId` / `data`。

**Q：为什么这里统一使用 `/dingtalk/web/...`？**

A：为保证 skill 内容简洁一致，这里统一按 `/dingtalk/web/...` 整理表单与流程接口路径，便于后续脚本实现和参数组织。

**Q：为什么这里只做必填参数校验？**

A：本技能主要用于统一调用规范，先保证命令入口稳定，细节错误交给脚本或接口返回处理。
