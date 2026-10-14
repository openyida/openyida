# 流程任务查询与管理员转交

现有 `data query form/process` 列表接口保持不变。以下接口属于管理员任务操作，不使用浏览器 Cookie 或抓包中的 CSRF token；复用 CLI token session、环境 baseUrl 和受管任务授权。`byManager=true` 不授予管理员权限，平台仍校验当前身份。

## 查询指定流程任务

`openyida data query process-tasks <appType> --process-inst-id <processInstanceId> --json`

- GET `/dingtalk/web/<appType>/query/formProcInstData/getInstTaskDatas.json`
- `_api=DataManage.getInstTasks`，`procInstId=<processInstanceId>`。
- 成功响应 `content` 为任务数组，空数组表示未查到任务；查询失败不能当成无任务。
- 每条任务 `processInstanceId` 必须等于目标实例，`id` 必须是正整数，重复 ID 或不合法结构停止操作。
- CLI 保留原始任务字段，并新增字符串 `taskId`，由 `id` 转换；不会解析任务 URL。

| 返回字段 | 含义 |
| --- | --- |
| `id` / `taskId` | 转交目标任务 ID |
| `status` | 仅 `RUNNING` 可转交 |
| `activityCode` / `groupName` | 所属节点 / 节点名称 |
| `actualActionerId` / `actualActionerDisplayName` | 当前实际处理人 |
| `originalActionerId` | 原始处理人，不用于验证转交后的接收人 |
| `taskGroupId` | 任务组标识，不是任务 ID |

## 管理员转交

```bash
openyida data transfer task APP_xxx --process-inst-id <processInstanceId> --form-uuid FORM-xxx --to-user-id <真实接收人userId> --expect-form-name <真实表单名称> --expect-form-type process --task-id <taskId> [--remark '用户说明的理由'] --json
```

- POST `/dingtalk/web/<appType>/query/instance/redirectTask.json`。
- `_api=DataManage.redirectTask`；表单编码参数为 `taskId`、`procInstId`、`nowActionerId`（接收人）、`remark`、`byManager=true`。
- 用户未说明理由时，省略可选参数 `--remark`，CLI 默认备注为“转交”；用户说明理由时，原样传入 `--remark`，不添加前缀或自行编写理由。显式空备注或只有 `--remark` 没有值属于参数错误。
- 写前校验资源名称、类型及实例归属，再重查任务。只有一个运行任务时可省略 taskId；多个运行任务必须明确选择，禁止默认选择第一条。
- 不修改业务字段，不需要为转交准备 data-json/data-file 或字段映射；接收人必须来自用户明确指定或真实通讯录解析，不得编造。
- 接收人已是该任务的实际处理人时，返回 `ALREADY_ASSIGNED`、`mutationPerformed=false`，不提交转交。
- 单次提交，不因登录刷新、网络超时或空响应自动重放。`success=true/content=null` 是正常受理响应。

## 回读与结果

受理后立即重新查该流程任务。以下证据才算转交已验证：

1. 原 taskId 仍为 RUNNING，且 `actualActionerId` 等于接收人；或
2. 原任务不再运行，且同 `activityCode/taskGroupId` 出现唯一新增 RUNNING 任务，实际处理人为接收人。已有并行任务、仅 originalActionerId 匹配、旧任务消失但无新任务，都不足以证明成功。

| 结果 | 行为 |
| --- | --- |
| `TRANSFERRED` | `transferred=true`、`mutationAccepted=true`、`readbackVerified=true`；输出原 taskId 与 currentTaskId |
| `ALREADY_ASSIGNED` | `transferred=false`、`readbackVerified=true`，无需转交写入 |
| `REJECTED` | 平台明确拒绝，报告错误，核对权限与任务状态 |
| `RESULT_UNKNOWN` | 提交超时、鉴权异常、非 JSON 等；仅按 details.nextStep 只读回查，禁止自动重放 |
| `UNVERIFIED` | 已受理但回读失败或不能确认接收人；仅按 details.nextStep 只读回查，禁止自动重放 |

不得把命令退出成功、旧任务消失、列表 actionerId 为空或仅接口受理当作转交验收通过。不能证明结果时如实报告，不改用一次性脚本或浏览器请求绕过 CLI。
