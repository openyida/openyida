---
name: yida-image-assets
description: >
  宜搭页面图片准备：每个位置一张图，最多两轮，按页并发采集和交接。
---

# 准备页面图片

按 `design.md.assetStrategy` 准备图片，每页输出 `prd/<项目名>/asset-manifests/<pageId>.json`。

搜索、生图、看图使用当前宿主工具；链接检查、必要的上传和写清单使用 `asset resolve`。Plan 确认后按 `materialize.assetTasks` 启动；Fast 设计就绪即启动。启动前读取已有页面清单，复用符合当前用途与尺寸要求的 final 图片，其余位置接着原轮次处理。

## 后台启动与接收

**先判宿主能力，再决定执行方式，不能把同步 Agent 调用当成后台任务。** 复用 `agent-capabilities --summary-json` 的 `asset_capabilities.background_agent/background_shell/execution`，对照本轮真实工具参数和结果接收能力；宿主名称、任务标题和“并行”话术都不是证据。

| 当前实际能力 | 执行方式 |
| --- | --- |
| Agent 支持非阻塞后台派发，立即返回可查询任务编号 | 后台采集该页素材，主流程立即继续业务 |
| Agent 只有同步调用，但 Bash 支持后台执行 | 可脚本化步骤用后台 Bash；宿主专有搜图、生图、看图判断留在前台分批处理，不整包交给同步 Agent |
| 两种后台能力均不可用或未能验证 | 先做已获授权的应用/表单创建或复用、范围内种子数据、无图页面及有图页面布局交互，再分批素材；批次间继续独立工作，记录限制 |

QwenWork 优先检查实际 Bash 工具是否提供 `run_in_background`；支持时这是 **Bash 工具参数**，不是 `openyida` CLI 参数。用它后台执行已具备命令入口的搜索、允许的下载上传、`asset resolve`。从 `assetTasks.resolve.argv` 构造命令，路径按实际 shell 正确引用；上传填真实 appType。保存工具返回的任务编号、日志/清单路径和派发返回时间后立刻继续主流程，不紧接着调用等待工具。到所属页面接图时再读取任务状态、退出码和清单；退出码 2 表示仍有素材缺口，不能当成功。宿主若只有轮询就按需查询，不承诺自动通知。

Bash 不能直接执行仅 Agent 可用的搜图/生图/看图工具。后台 shell 只证明可脚本化部分异步，不能据此宣称整条采集链都在后台。普通命令末尾加 `&` 或看到 PID 不足以证明任务能跨工具调用存活、收取结果和取消。只有真实工具核实后才设置 `OPENYIDA_AGENT_BACKGROUND_AGENT` / `OPENYIDA_AGENT_BACKGROUND_SHELL` 为 1/0；未知保持 unknown，CLI 不凭 QwenWork 名称自动放行。


1. **启动**：应用编排按上述能力决策选择后台工具或业务优先的同步批次，传入当前页设计、`searches`、`draft`、`manifest` 和时间预算。收到真实任务编号后，立即继续创建应用、表单和页面；有图页面先做布局、文字、真实数据绑定和交互。
2. **记录**：编排负责维护 `taskState`，记录 `taskKey`、`pageId`、`hostTaskId`、`executionMode`、`toolName`、`backgroundOption`、`dispatchReturnedAt`、`status`、`startedAt`、`endedAt`、`firstSearchAt`、`deadlineAt`、各位置已用轮次及输出路径。状态使用 `pending/running/completed/partial/failed`；真实启动后才记为 `running`。executionMode 使用 background_agent/background_shell/synchronous；同步时记录 fallbackReason，复用 final 图片记录 reused 和 reuseEvidence。主流程另外记录 businessWork 的真实 startedAt/endedAt（含时区），收尾汇总至 build-manifest.assetExecution。采集任务独占该页草稿和清单，每轮开始及结束时向编排报告轮次和进度，编排统一保存任务记录。Fast 使用同样规则，任务记录位于页面清单旁的 `<pageId>.task.json`，`taskKey` 使用清单绝对路径。
3. **复用**：按 `taskKey` 找已有任务，结合宿主状态核对是否仍在运行；运行中接收原任务，已完成则读取清单。恢复中断任务时沿用已用轮次和原截止时间，并核对图片用途、尺寸和当前设计。设计变化时先终止旧任务，确认退出后再交接文件写入权。
4. **接收**：主流程在当前页接图前读取一次结果；仍在运行时先完成其他独立工作，确需结果时使用宿主等待工具。按该页清单验收真实图片，再发布页面。`completed` 表示清单检查通过，`partial` 表示仍有必需图片缺口；宿主任务结束后由编排回读清单再更新状态。

CLI 的 `assetTasks` 是派发输入，后台执行能力来自宿主。仅支持同步工具时先推进独立业务，再批量调用搜索和检查，完成一批后继续独立业务工作，并记录实际等待；禁止把整包素材放在应用创建之前。用户待办沿用简短阶段名称，图片任务显示为“准备页面图片”，“创建应用”保持独立待办。仅在素材与业务执行区间实际重叠时，进度描述才使用“素材采集&应用创建”；单独采集时写“素材采集”。图片数量、子任务、槽位、编号、轮次和耗时写入内部执行记录。

## 1. 确定哪些页面需要图片

按 `assetStrategy.pages[].pageId` 找页面，按 `slotId` 找图片位置。

| imageNeed | 怎么做 |
| --- | --- |
| `required` | 准备设计要求的图片；缺必需图片时该页保持草稿 |
| `beneficial` | 有图片位置就准备，没有则跳过 |
| `none` | 直接使用图标、图表和排版 |

设计缺失时交回 `yida-design` 补齐。每个位置一个 `slotId`、一张图，`count` 省略或填 `1`。

## 2. 检查工具

复用当前环境的能力查询结果；尚未查询时运行 `openyida agent-capabilities --summary-json`，查看 `online_search`、`image_search`、`image_generation`。

- `unavailable`：跳过。
- `unknown` 或 `requires_host_tool_inventory_check=true`：查看宿主实际工具清单。
- `available`：使用实际存在的工具；工具缺失则按不可用处理。

工具不可用时复用用户图片，记录剩余缺口，继续其他页面。

## 3. 最多两轮，按页面并发

优先用用户图片，其次搜索 **Unsplash / Pexels**；设计允许示意图时可用宿主生图。来源填写 `source=user|search|generated`，生成图标记 `isIllustrative=true`。

1. **第一轮**：批量找图，每个位置选一张信息齐全的图片，查看合适后交给 CLI 检查，允许外链就直接使用。
2. **第二轮**：只补第一轮失败的必需位置，每个位置换一张；允许示意图时可改用生图。
3. **结束**：可选位置用设计允许的无图布局，必需位置保留缺口。用户后续明确要求补图时再继续。

每页最多两轮，每个位置每轮最多一个候选，同一候选尝试一次。一轮包括选图、看图、来源记录、链接检查和必要的上传。换来源、换工具或恢复上传都接着当前轮次。Agent 记录各页轮次、失败位置和不可用来源。

各页及同页各图片位置同时搜索，整次采集共用最多四个在途请求，完成一个就补下一个；使用宿主批量并发调用或并行任务。每个位置返回选图和来源，由该页唯一写入者组装草稿，CLI 并发检查图片，仅需托管的图片下载上传。记录请求起止时间确认实际重叠。主流程同时创建应用、表单和无图页面；有图页面先做布局与交互，接图和验收时汇合。

调度先处理必需位置，同级优先 `usage=hero`，其余保持设计顺序；首屏其他图片按实际用途由编排优先派发。四个搜索名额由编排统一分配给各页，后台任务按分配额度执行。

默认单次搜索或来源信息查询最多 30 秒，每页从首次实际发起搜索起共用 3 分钟采集预算，排队时间另记。宿主负责传入超时、设置截止时间并在到期时停止采集；恢复任务沿用原截止时间。工具无法中断时记录限制，并让主流程继续独立工作。两轮或时间预算任一耗尽即收口：已取得候选完成检查，可选位置采用设计允许的无图布局，必需位置记录缺口；已验证结果保留。用户明确指定时限时沿用用户要求。

### 失败后立即切换

搜索入口出现 401、403、429、反爬挑战或超时，立即切换可用来源；其他页面和后续轮次复用这份记录。已取得的独立图片直链按自身检查结果处理。图片直链失效、返回验证网页、尺寸不足或来源信息缺失时，在剩余轮次内换图。

查看实际图片的内容、比例、清晰度和主体位置。商品、房源、人员、案例使用真实图片。来源记录和使用条件见 [来源规则](references/source-policy.md)。

## 4. 检查图片并写入清单

按 [清单契约](references/manifest-contract.md) 写每页草稿。每张图片同时记录已取得的图片 ID、作者、来源页、许可链接、实际核对日期及必要授权凭证，字段见[来源与授权留证](references/manifest-contract.md#来源与授权留证)：

```bash
openyida asset resolve --input asset-manifests/<pageId>.draft.json --manifest asset-manifests/<pageId>.json --design design.md --page-id <pageId> --json
```

页面草稿就绪即可执行。直链检查无需登录或等待应用创建；上传时追加 `--app-type <真实appType>`，省略时读取项目配置。

允许外链的图片经格式和尺寸检查后直接使用。用户或生成的外链经核实后填 `hotlinkAllowed=true`；本地图片和需托管的图片在允许转存时上传，最大 20 MiB。上传失败时保留已验证且允许外链的原地址。访问失败的图片记录缺口，按两轮规则换图。

## 5. 处理结果

- 退出码 `0`：清单为 `final` 或 `none`。
- 退出码 `2`、`ASSET_MATERIAL_NOT_FINAL`：清单已保存，按 `gaps` 找缺口。
- 其他错误：按错误修正参数或文件。

第二轮修改失败位置的 `input`，将该页清单同时作为 `--input` 和 `--manifest`。CLI 在原图内容未变时复用附件链接。字段、尺寸及错误处理见清单契约。

## 6. 交给页面使用

素材采集完成后直接继续搭建，沿用已有方案确认。读取该页清单的 `pages[].materialStatus`；已有总清单 `asset-manifest.json` 按 `pageId` 读取。

- `final`：该页可继续，只使用 `assets[].materialStatus=final` 的图片 URL。
- `draft`：该页缺必需图片；剩余轮次内补图，用尽则保留缺口，其他页面继续。
- `none`：该页直接继续。

可选图片失败时采用设计允许的无图布局。根状态只表示当前清单的整体结果。

页面任务只写自己的清单。需要更新 PRD/design 时，由应用编排汇总后统一处理：

- **Plan**：更新 `visualStyle.forUser.assetStrategy.materialStatus` 和 `missingAssets`，执行一次 `design-plan patch --set ... --materialize --json`。CLI 保留 revision 与已有确认，生成的文档直接用于开发。
- **Fast**：直接更新文档中的素材进度。

功能、页面结构或整体风格变化时交回规划技能。交付时说明哪些页面可以继续、哪些页面缺什么图。
