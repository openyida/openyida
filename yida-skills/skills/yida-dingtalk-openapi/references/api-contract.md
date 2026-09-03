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
    "idempotency": "x-client-token"
  }]
}
```

- `x-acs-dingtalk-access-token` 只用于识别 DingAuth，不写入 action 默认值。
- 每个 `operation.sourceUrl` 必须是该动作对应的精确官方接口页；同一文件包含多个动作时逐项记录，不能只依赖顶层 `sourceUrl`。
- path 参数必须保留在 URL 占位符及参数 Schema 中。
- 官方文档声明的权限、应用类型限制、分页和幂等字段必须保留。
- 文档不明确的字段标为 `unknown` 并停止相关动作创建，不自行猜测。
