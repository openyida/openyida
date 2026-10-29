# API Matrix

## 表单实例

| 接口 | 方法 | 路径 | 必填参数 | 常用可选参数 |
| --- | --- | --- | --- | --- |
| `searchFormDatas` | GET | `/dingtalk/web/{appType}/v1/form/searchFormDatas.json` | `appType`, `formUuid` | `searchFieldJson`, `currentPage`, `pageSize`, `originatorId`, `createFrom`, `createTo`, `modifiedFrom`, `modifiedTo`, `dynamicOrder` |
| `searchFormDataIds` | GET | `/dingtalk/web/{appType}/v1/form/searchFormDataIds.json` | `appType`, `formUuid` | `searchFieldJson`, `currentPage`, `pageSize`, `originatorId`, `createFrom`, `createTo`, `modifiedFrom`, `modifiedTo`, `dynamicOrder` |
| `getFormDataById` | GET | `/dingtalk/web/{appType}/v1/form/getFormDataById.json` | `appType`, `formInstId` | - |
| `queryOperatePermission` | GET | `/dingtalk/web/{appType}/query/formdata/queryOperatePermission.json` | `formUuid`, `formInstId` | 普通表单更新前校验当前记录编辑权 |
| `getFormEditSchema` | GET | `/dingtalk/web/{appType}/query/formdata/getFormEditSchema.json` | `formUuid`, `formInstId` | 普通表单更新前读取实时字段行为 |
| `saveFormData` | POST | `/dingtalk/web/{appType}/v1/form/saveFormData.json` | `appType`, `formUuid`, `formDataJson` | `deptId` |
| `updateFormData` | POST | `/dingtalk/web/{appType}/v1/form/updateFormData.json` | `appType`, `formInstId`, `updateFormDataJson` | `useLatestVersion` |
| `listTableDataByFormInstIdAndTableId` | GET | `/dingtalk/web/{appType}/v1/form/listTableDataByFormInstIdAndTableId.json` | `appType`, `formUuid`, `formInstanceId`, `tableFieldId`, `currentPage`, `pageSize` | - |

`data update form` 在字段别名转换和关联表单值校验后，读取上述两个原生只读接口再决定是否发送 `updateFormData`。编辑 Schema 的 `instanceData.flowData.behaviors` 必须能对应目标表单及字段；仅明确可编辑的字段允许写入。权限或结构无法确认时停止，不回退到无字段校验的更新。该校验是 CLI 的写前约束，不替代服务端授权。

## 流程实例

| 接口 | 方法 | 路径 | 必填参数 | 常用可选参数 |
| --- | --- | --- | --- | --- |
| `startProcessInstance` | POST | `/dingtalk/web/{appType}/v1/process/startInstance.json` | `appType`, `processCode`, `formUuid`, `formDataJson` | `deptId` |
| `getInstanceIds` | GET | `/dingtalk/web/{appType}/v1/process/getInstanceIds.json` | `appType`, `formUuid` | `searchFieldJson`, `taskId`, `instanceStatus`, `approvedResult`, `currentPage`, `pageSize`, `originatorId`, `createFrom`, `createTo`, `modifiedFrom`, `modifiedTo` |
| `getInstances` | GET | `/dingtalk/web/{appType}/v1/process/getInstances.json` | `appType`, `formUuid` | `searchFieldJson`, `taskId`, `instanceStatus`, `approvedResult`, `currentPage`, `pageSize`, `originatorId`, `createFrom`, `createTo`, `modifiedFrom`, `modifiedTo` |
| `getInstanceById` | GET | `/dingtalk/web/{appType}/v1/process/getInstanceById.json` | `appType`, `processInstanceId` | - |
| `updateInstance` | POST | `/dingtalk/web/{appType}/v1/process/updateInstance.json` | `appType`, `processInstanceId`, `updateFormDataJson` | - |
| `getOperationRecords` | GET | `/dingtalk/web/{appType}/v1/process/getOperationRecords.json` | `appType`, `processInstanceId` | - |
| `executeTask` | POST | `/dingtalk/web/{appType}/v1/task/executeTask.json` | `appType`, `taskId`, `procInstId`, `outResult`, `remark` | `formDataJson`, `noExecuteExpressions` |

## 任务中心

| 接口 | 方法 | 路径 | 必填参数 | 常用可选参数 |
| --- | --- | --- | --- | --- |
| `getMySubmitInApp` | GET | `/dingtalk/web/{appType}/v1/process/getMySubmitInApp.json` | `appType`, `currentPage`, `pageSize` | `keyword` |
| `getTodoTasksInApp` | GET | `/dingtalk/web/{appType}/v1/task/getTodoTasksInApp.json` | `appType`, `currentPage`, `pageSize` | `keyword` |
| `getDoneTasksInApp` | GET | `/dingtalk/web/{appType}/v1/task/getDoneTasksInApp.json` | `appType`, `currentPage`, `pageSize` | `keyword` |
| `getNotifyMeTasksInApp` | GET | `/dingtalk/web/{appType}/v1/task/getNotifyMeTasksInApp.json` | `appType`, `currentPage`, `pageSize` | `keyword`, `processCodes`, `instanceStatus` |

## 常见返回字段

### 表单实例

- 列表：`content.totalCount`, `content.currentPage`, `content.data[]`
- 详情：`result.formInstId`, `result.formUuid`, `result.formData`, `result.originator`

### 流程实例

- 列表：`result.totalCount`, `result.currentPage`, `result.data[]`
- 详情：`result.data.processInstanceId`, `result.data.processCode`, `result.data.instanceStatus`, `result.data.data`

### 任务中心

- 列表：`result.totalCount`, `result.currentPage`, `result.data[]`, `result.data[].taskId`
