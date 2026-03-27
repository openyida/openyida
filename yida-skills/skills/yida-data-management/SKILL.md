---
name: yida-data-management
description: 宜搭数据管理。表单实例/流程实例/任务中心的查询、新增、更新。表单走 /v1/form/，流程走 /v1/process/，不能混用。
---

# 数据管理

> 表单与流程是两套独立接口，主键、参数、返回结构都不同，不能混用。

## 命令

### 表单实例

```bash
openyida data query form <appType> <formUuid> [--page 1 --size 20]
openyida data get form <appType> --inst-id <formInstId>
openyida data create form <appType> <formUuid> --data-json '<json>'
openyida data update form <appType> --inst-id <formInstId> --data-json '<json>'
openyida data query subform <appType> <formUuid> --inst-id <formInstId> --table-field-id <fieldId>
```

### 流程实例

```bash
openyida data query process <appType> <formUuid> [--instance-status RUNNING]
openyida data get process <appType> --process-inst-id <processInstanceId>
openyida data create process <appType> <formUuid> --process-code <processCode> --data-json '<json>'
openyida data update process <appType> --process-inst-id <processInstanceId> --data-json '<json>'
openyida data query operation-records <appType> --process-inst-id <processInstanceId>
openyida data execute task <appType> --task-id <taskId> --process-inst-id <processInstanceId> --out-result AGREE --remark '同意'
```

### 任务中心

```bash
openyida data query tasks <appType> --type todo|done|submitted|cc [--page 1 --size 20]
```

## 接口总览

### 表单实例

| 接口 | 方法 | 说明 |
|------|------|------|
| `searchFormDatas` | GET | 查询列表 |
| `searchFormDataIds` | GET | 查询 ID 列表 |
| `getFormDataById` | GET | 查询详情 |
| `saveFormData` | POST | 新增 |
| `updateFormData` | POST | 更新 |
| `listTableDataByFormInstIdAndTableId` | GET | 查询子表数据 |

### 流程实例

| 接口 | 方法 | 说明 |
|------|------|------|
| `startProcessInstance` | POST | 发起流程 |
| `getInstanceIds` | GET | 查询 ID 列表 |
| `getInstances` | GET | 查询列表 |
| `getInstanceById` | GET | 查询详情 |
| `updateInstance` | POST | 更新 |
| `getOperationRecords` | GET | 审批记录 |
| `executeTask` | POST | 执行任务 |

### 任务中心

| 接口 | 说明 |
|------|------|
| `getTodoTasksInApp` | 待办 |
| `getDoneTasksInApp` | 已完成 |
| `getMySubmitInApp` | 已提交 |
| `getNotifyMeTasksInApp` | 抄送 |

## 数据格式

### 查询条件 `searchFieldJson`

必须传**字符串**：

```json
[{"key":"textField_xxx","value":"测试","type":"TEXT","operator":"eq","componentName":"TextField"}]
```

### 保存/更新数据

```json
{"textField_xxx":"文本","numberField_xxx":10,"employeeField_xxx":["userId"]}
```

### 常见字段格式

| 组件类型 | 查询格式 | 保存格式 |
|---------|---------|----------|
| 文本 | `"文本"` | `"文本"` |
| 数字 | `["1","10"]` 或单值 | `1` |
| 单选 | `"选项一"` | `"选项一"` |
| 多选 | `["选项一"]` | `["选项一","选项二"]` |
| 日期 | `[开始时间戳,结束时间戳]` | `时间戳` |
| 成员 | `["userId"]` | `["userId"]` |
| 部门 | `["deptId"]` | `["deptId"]` |
| 子表 | `"模糊搜索"` | `[{"textField_xxx":"值"}]` |
| 关联表单 | 不支持直接查询 | `[{"appType":"xxx","formUuid":"xxx","instanceId":"xxx"}]` |

### 关联表单字段

关联表单字段保存时必须使用数组对象格式，包含三个必填字段：

```bash
# 示例：创建带关联客户的商机
openyida data create form APP_xxx FORM-商机表 --data-json '{
  "textField_xxx": "商机名称",
  "associationFormField_xxx": [{"appType":"APP_xxx","formUuid":"FORM-客户表","instanceId":"FINST-xxx"}]
}'
```

> 注意：字段名是 `instanceId`（不是 formInstId），三个字段缺一不可

## 注意事项

- `pageSize` 最大 100，QPS 限制约 40 次/秒
- `searchFieldJson` 和 `dynamicOrder` 必须传字符串
- 字段 ID 通过 `openyida get-schema` 获取，不要手写猜测
