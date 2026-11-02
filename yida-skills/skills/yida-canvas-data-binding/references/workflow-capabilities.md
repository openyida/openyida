# 个人任务与业务审批进度

按业务含义选能力，再沿用当前布局。首页的本人待办使用个人任务查询；采购单详情的审批进度使用该业务记录关联的流程实例；订单待发货等业务状态仍查询业务表单。只读查询不要求选择自定义实现，也不创建页面。新增自定义展示仍须用户显式要求或经 ask_human 明确同意。

## 数量卡片与原生入口

范围不明确时先 `ask_human` 确认当前应用或本组织所有应用；数量和入口共用同一范围。只需卡片数量与原生入口时，复用下列能力，不必装配自定义任务列表。

```bash
openyida task-center count APP_REPLACE --scope app --type todo --json
openyida task-center count --scope corp --type todo --json
openyida task-center link APP_REPLACE --scope app --type todo --base-url https://example.aliwork.com --json
openyida task-center link --scope corp --type cc --base-url https://example.aliwork.com --json
```

`link` 只生成可检查的原生地址，`opened=false`；不打开本机浏览器。默认 `mode=auto`，生成普通页面 URL，由页面运行时按访问环境选择打开方式；CLI 本身不推断目标访客环境。显式 `--mode dingtalk` 时 URL 含 `ddtab=true`。另返回 `dingtalkUrl`，仅在用户明确要求从浏览器唤起钉钉时绑定为跨端点击入口。传 `--base-url` 可离线生成；否则读取当前登录组织。受应用约束的 managed run 不允许组织范围查询或覆盖组织域名，不绕过该约束。

页面发布层提供以下共用接口（必须用包含此能力的 OpenYida 编译发布）：

```js
const utils = window.__OPENYIDA_UTILS__;
const selection = { scope: 'app', appType: 'APP_REPLACE', kind: 'todo' };
const count = await utils.taskCenterCount(selection);
// count.available=false 时显示“未知”；请求报错显示失败，不能显示成 0。
await utils.openTaskCenter(selection); // 默认跟随浏览器/钉钉环境；放在点击事件中并捕获错误
// 组织范围：{ scope: 'corp', kind: 'todo' }，不要传 appType。
```

`taskCenterCount` 固定同源 `app-query`、实际访问者身份与服务端总数，只读一页一条；可选 `filters` 与 CLI app-query 支持的条件一致，不扫描全历史或嵌入 CLI 身份。`taskCenterLink(selection)` 可读取同一地址。应用范围固定 `appKeys=[appType]`，组织范围固定 `appKeys=[]`。旧版不带 scope 的 CLI count 保留原 transport 默认值；新卡片应显式指定 scope，使 CLI 核查与页面采用同一口径。

`openTaskCenter` 默认 `mode:'auto'`：浏览器内直接打开浏览器新页签，钉钉内添加唯一 `ddtab=true` 并调用端内打开接口。浏览器默认打开不能因缺少钉钉环境而报错，也不应默认唤起钉钉。钉钉内接口缺失、调用失败或超时仍须报错，不静默跨到系统浏览器。显式 `mode:'dingtalk'` 是仅限端内的严格模式；跨端唤起用用户明确选择的 `dingtalkUrl` 入口。`mode:'browser'` 显式使用浏览器打开方式。不得用浏览器验证结果宣称钉钉新窗口或免登已验收。四类入口分别使用应用系统导航或平台任务中心原生页签，无需猜测 DOM。

## CLI 能力与读取

先执行 `openyida task-center capabilities --json`。固定接口、范围校验和返回格式由 CLI 维护，不在页面重新实现请求。以下标识均为待替换占位符，实例必须来自真实业务关联，不能按标题猜测。

```bash
# 当前访问者在目标应用中的个人待办
openyida data query tasks APP_REPLACE --type todo --transport app-query --normalized --page 1 --size 5

# 同一筛选条件下的服务端总数，只读取一页一条，不扫描全历史
openyida task-center count APP_REPLACE --type todo --transport app-query --filters-json '{"keyword":"采购"}' --json

# 业务记录关联的流程详情；不默认读取操作历史
openyida task-center inspect APP_REPLACE --process-inst-id INSTANCE_REPLACE --form-uuid FORM_REPLACE --json

# 用户需要审批时间线时才读取历史；可核对指定任务的处理结果
openyida task-center inspect APP_REPLACE --process-inst-id INSTANCE_REPLACE --history --task-id TASK_REPLACE --json
```

- 个人任务仍为 `todo / created / done / cc`；四类条件和人员、流程、表单候选见[任务筛选示例](../../yida-task-center/references/task-filters.md)。不支持的条件直接报错，不静默删条件。
- 如果业务需要“我发起且仍在审批中的报销”，而个人任务接口不支持该状态条件，先确认真实流程表单，再选择既有 `data query process` 的服务端状态和发起人条件，并明确实例查询口径。运行态使用实际访问者身份，不能把 CLI 登录人的 ID 固化到页面；不在加载器中自动换接口。
- `count.total` 是所选范围、访问者及所传条件下的服务端总数；`available=false / total=null` 表示未知。不是当前页长度，也不是全历史审批数量。“我创建的”包含普通表单与流程，不能先排除普通表单再把原总数称作审批数量。
- `inspect` 读取当前访问者有权查看的指定实例，不要求该实例由本人发起。返回 `summary / currentNodes / submittedAt / processFinishedAt / processResult / detailTarget`。范围或实例身份不符直接失败；缺少节点、人员或时间保持未知，不用历史最后一条猜当前环节。
- 页面运行时优先复用发布层可用的流程 JS-API 桥，仅在方法不可用时使用固定同源读取；桥调用报错不切换通道重试。缓存仅限已识别访问者、目标应用及实例，刷新和返回后失效，不缓存失败历史。
- `history.state` 为 `not-requested / ready / error`。历史失败时可保留详情并展示明确错误，不能展示成“暂无历史”；实例和历史归属冲突、登录失败仍整体报错。
- `done.personalResult` 表示当前访问者本人在该任务上的同意或拒绝；`processResult` 表示整个流程的结果，二者不互相补值。`inspect.taskResult` 只匹配指定 `taskId`，本身不证明该任务属于当前访问者；不能直接称为“我的处理结果”。缺失或冲突为 `UNKNOWN`。
- 到达、抄送、本人处理和流程结束时间分别使用 `arrivedAt / notifiedAt / taskFinishedAt / processFinishedAt`，不互相替代；`finishedAt` 保留为已办处理时间的兼容字段。

## 首页个人任务

从 `capabilities.scaffold.specExample` 派生完整配置，替换应用和当前 `designFile`，如实记录用户选择。按需配置：

```json
{
  "view": "tasks",
  "mode": "embedded",
  "kinds": ["todo"],
  "defaultKind": "todo",
  "pageSize": 5,
  "showSearch": false,
  "showPagination": false,
  "transport": "app-query",
  "fields": ["title", "summary", "originator", "time"],
  "filterFields": { "todo": ["originators", "processCodes", "taskCreateFrom", "taskCreateTo"] },
  "expandProcess": false
}
```

这是配置片段，不含必需的真实应用、设计文件和选择记录。`fields` 决定列及顺序；`filterFields` 只填写用户需要且所选传输支持的条件，关键词搜索由 `showSearch` 控制。首页预览可关闭搜索和分页，保留匹配总数。日期控件使用访问者浏览器的本地时区；业务指定其他时区时按设计调整并明确显示时区。条件变化回第 1 页，清空后移除服务端条件。默认只生成待我处理，不增加其他栏目。

需要行内展开进度时设置 `expandProcess=true`；确需审批历史再增加 `history=true`。仅在展开记录时读取该实例，不为整页逐条补查；办理仍通过共享原生详情容器。

## 业务详情的审批进度

从 `capabilities.scaffold.progressSpecExample` 派生完整配置，执行同一装配命令：

```bash
openyida task-center scaffold --spec workflow-spec.json --output project/pages/src/progress.canvas.jsx
```

`view=progress / mode=embedded` 提供 `ProcessProgressSection`；把组件及依赖合并进业务页面后传入真实关联：

```jsx
<ProcessProgressSection
  config={workflowConfig}
  processInstanceId={record.approvalInstanceId}
  formUuid={processFormUuid}
  onOpen={openForm}
/>
```

字段名仅示意，`record.approvalInstanceId` 和 `processFormUuid` 必须按真实 Schema 和实例关系替换。`workflowConfig` 沿用生成配置；复用主页面已有 `openForm / formOpenContainer` 时传 `onOpen`，全页只挂载一份详情容器和应用主题容器。独立使用则组件自带原生详情容器。主页面关闭详情后刷新数据时，把刷新版本作为 `refreshKey` 传入。

未传实例时组件显示待关联提示，不猜 ID、不查询任务列表；实例切换取消旧请求并隔离旧结果。无需增加四类任务页签、设置台账或管理后台。`history` 默认关闭，业务确需时间线才开启。独立整页进度必须在配置中提供真实 `processInstanceId`。

编译发布后，分别核对真实任务列表和真实关联实例；验证筛选、权限错误、实例切换、历史部分失败、返回刷新、移动端与应用主题。离线编译和模拟数据测试不代表目标用户验收完成。
