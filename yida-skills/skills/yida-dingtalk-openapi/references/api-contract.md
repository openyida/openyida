# 钉钉 OpenAPI 文档入口与契约

## 官方文档入口

Agent 先按业务域进入官方目录，再打开目标接口页。目录页只用于发现接口；生成的每个 Action 必须记录自己的精确接口页 URL。

| 业务域 | 官方文档 |
| --- | --- |
| 通讯录管理 | [组织架构与成员信息管理](https://open.dingtalk.com/document/development/contacts-overview) |
| 考勤 | [员工上下班打卡与考勤统计](https://open.dingtalk.com/document/development/attendance-overview) |
| 日程 | [个人与团队日程安排管理](https://open.dingtalk.com/document/development/dingtalk-event-overview) |
| 公告 | [企业内部通知与公告发布](https://open.dingtalk.com/document/development/blackboard-announcement-overview) |
| 签到 | [外勤定位签到与轨迹记录](https://open.dingtalk.com/document/development/sign-check-overview) |
| 日志 | [员工工作汇报与总结提交](https://open.dingtalk.com/document/development/report-log-overview) |
| 宜搭 | [低代码应用搭建与管理平台](https://open.dingtalk.com/document/development/overview-yida) |
| Agoal | [企业目标设定与进度追踪](https://open.dingtalk.com/document/development/agoal-overview) |
| 音视频 | [在线会议与音视频通话服务](https://open.dingtalk.com/document/development/create-and-close-video-meetings) |
| AI 表格 | [智能数据分析与表格处理](https://open.dingtalk.com/document/development/data-structure) |
| OA 审批 | [企业各类流程在线审批](https://open.dingtalk.com/document/development/workflow-overview) |
| 文档 | [团队文档协作与云盘存储](https://open.dingtalk.com/document/development/knowledge-base-overview) |
| 即时通信 | [企业内部实时消息沟通](https://open.dingtalk.com/document/development/development-robot-overview) |
| 待办任务 | [个人待办事项集中管理](https://open.dingtalk.com/document/development/dingtalk-todo-task-overview) |
| 专属钉钉 | [企业定制化钉钉专属版本](https://open.dingtalk.com/document/development/dedicated-dingtalk-overview) |
| 应用管理 | [企业内部应用配置与管理](https://open.dingtalk.com/document/development/get-a-list-of-all-applications-inside-the-enterprise) |
| 应用市场 | [第三方应用发现与安装](https://open.dingtalk.com/document/development/application-market-overview) |
| 智能人事 | [员工全生命周期人事管理](https://open.dingtalk.com/document/development/intelligent-personnel-call-description) |
| 智能招聘 | [企业招聘流程智能化管理](https://open.dingtalk.com/document/development/smart-recruitment-overview) |
| 智能填表 | [在线表单快速创建与收集](https://open.dingtalk.com/document/development/intelligent-form-filling-overview) |

用户提供精确官方接口 URL 时直接使用该 URL。用户只给业务目标时，从上表对应目录查找；上表没有对应业务域时使用文档中心搜索。无法定位唯一官方接口页时停止，不根据博客、示例代码或接口路径猜文档。

## 契约格式

每个动作只保存公开接口元数据，不保存任何凭据或真实 token：

```json
{
  "sourceUrl": "https://open.dingtalk.com/document/...",
  "host": "api.dingtalk.com",
  "authType": "DingAuth",
  "operations": [{
    "operationId": "calendarCreateEvent",
    "sourceUrl": "https://open.dingtalk.com/document/development/create-schedule",
    "method": "POST",
    "path": "/v1.0/calendar/users/{userId}/calendars/{calendarId}/events",
    "pathParams": ["userId", "calendarId"],
    "query": [],
    "header": ["x-client-token"],
    "body": {},
    "permission": [],
    "idempotency": "x-client-token",
    "fixedInputs": {
      "path.calendarId": "primary"
    },
    "inputDependencies": [{
      "target": "path.userId",
      "semanticType": "unionId",
      "sourceUrl": "https://open.dingtalk.com/document/development/query-user-details",
      "sourceInput": "body.userid",
      "sourceOutput": "result.unionid"
    }]
  }]
}
```

- `x-acs-dingtalk-access-token` 只用于识别 DingAuth，不写入 action 默认值。
- 每个 `operation.sourceUrl` 必须是该动作对应的精确官方接口页；同一文件包含多个动作时逐项记录，不能只依赖顶层 `sourceUrl`。
- path 参数必须保留在 URL 占位符及参数 Schema 中。
- 官方文档声明的权限、应用类型限制、分页和幂等字段必须保留。
- 文档不明确的字段标为 `unknown` 并停止相关动作创建，不自行猜测。

## 入参依赖

读取每个必填参数的完整描述。描述中出现“固定为”“调用某接口获取”或官方链接时，把来源写入契约，不能只按参数名猜值：

- 固定值写入 `fixedInputs`。
- 页面或业务数据已经提供且语义一致的值，记录为运行态输入。
- 需要其他接口返回值时，写入 `inputDependencies`，并保存前置接口的精确 `sourceUrl`、输入字段和输出路径。
- 每个前置接口都按同一流程生成宜搭自定义连接器 Action；设计态用 `connector test` 调用，页面运行态用 `window.__OPENYIDA_CONNECTOR_API__` 调用。不能用 `curl`、`fetch`、临时 Node/Python 脚本或其他底层 HTTP 请求绕过连接器。
- 前置接口与主接口的 Host 或鉴权不同，分别创建或复用连接器；不能把完整外部 URL 塞进主连接器 Action，也不能假设鉴权账号可以跨连接器复用。
- 前置输入、输出路径或鉴权方式不能确认时停止，不用相似字段名代替。
- `fixedInputs` 和 `inputDependencies` 只用于 Agent 编排；生成平台 Action JSON 时转成对应的参数默认值和页面调用顺序，不把这两个元数据字段原样提交给平台。

### 创建日程示例

[创建日程](https://open.dingtalk.com/document/development/create-schedule) 的路径参数名虽然是 `userId`，企业内部应用和第三方企业应用实际必须传日程组织者的 `unionId`：

```text
已知通讯录 userId
  → 调用查询用户详情（body.userid）
  → 读取 result.unionid
  → 写入创建日程 path.userId
```

- 前置接口：[查询用户详情](https://open.dingtalk.com/document/development/query-user-details)。
- `calendarId` 固定传 `primary`。
- 第三方个人应用按创建日程文档链接改用[获取用户通讯录个人信息](https://open.dingtalk.com/document/development/dingtalk-retrieve-user-information)，不能套用企业应用链路。
- 如果 EmployeeField 或已有业务数据已经返回经过验证的 `unionId`，可以直接使用；只有普通 `userId` 时必须先转换。
