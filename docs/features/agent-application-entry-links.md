# Agent 应用交付物与入口契约

## 1. 目标

完整应用搭建结束时同时解决两个问题：

1. 不再把内部设计文件、资源清单和每个表单/流程/报表分别显示成用户交付物；
2. 按入口用途提供真实 URL，完整应用默认同时包含访问态与开发者管理态。展示方式统一由宿主负责。

最多提供三类真实入口，依次为“访问态前台”“业务后台”“开发者后台”。只有一类业务访问入口时默认提供两类入口；前后台都有时提供三类。用户显式排除、单页任务和相同 URL 去重按实际范围处理。

## 2. 用户可见交付边界

### 2.1 内部 artifact

以下文件只用于 Agent 编排、join 和完整性验收，默认不得登记为用户可见 artifact、附件或下载卡片：

- `.cache/openyida/<project>/requirement-brief.json`；
- `prd/<project>/prd.md`；
- `prd/<project>/design.md`；
- `prd/<project>/build-manifest.json`；
- Schema、资源清单、页面源码、编译产物和中间配置。

### 2.2 业务资源

表单、流程、报表和页面是应用内部资源，最终结果按业务能力或数量概述，例如“已完成 4 张业务表单、1 条审批流程和 1 个经营看板”。

只有用户明确要求排障、迁移、复制配置或查看技术 ID 时，才补充资源明细。

### 2.3 应用入口

完整应用每次提供按用途命名的真实入口与简短业务结果。千问办公负责链接、文件和交付结果的展示，OpenYida 不指定卡片形态、尺寸、数量、专用展示工具或更新标识。其他宿主使用其实际交付能力，不虚构工具或结果。

同一应用在后续 run 中被用户再次请求时，应复用已有资源和已验证 URL，提供适用入口；不得为了重新展示入口而重建、更新或重新发布资源。入口未提供完整时保留已成功项并说明缺项，不能把单项成功当作全部完成。

## 3. 入口选择

先按本轮业务范围选择入口，完整应用默认包含开发者后台，登录方式不改变该默认值：

| 有效范围 | 交付入口 |
| --- | --- |
| 仅前台 | 已验证的独立业务入口、开发者后台两类入口 |
| 统一工作区或仅业务管理 | 已验证的业务管理入口、开发者后台两类入口；统一工作区可命名为“系统入口” |
| 前后台双入口 | 独立业务入口和业务管理入口、开发者后台三类入口 |
| 单页创建、修改或发布 | 只交付当前页面，不扩展为完整应用入口矩阵 |

业务管理入口可以是 `/workbench`，也可以是已规划、已验证的 `/workbench/{formUuid}?viewUuid=...` 任务视图。默认落点应让用户直接办理目标业务，原生管理视图满足任务时直接复用。

以 `openyida agent-capabilities --summary-json` 返回的 `application_entry_policy` 为准：

- `entries.admin=include`：完整应用默认交付开发者后台，无论 `builder_path.auth.auth_runtime=env_token_bootstrap` 且 `can_auto_use=true`，还是其他认证方式；用户明确排除时遵从；
- `delivery_unit=application_entries`、`entry_delivery.max_count=3`：最多三类入口；`entry_delivery.by_scope` 给出各业务范围的默认用途，`presentation=host_managed` 表示展示由宿主负责；
- `entries.workbench=when_workspace_in_scope`：仅交付范围内的管理工作区。

URL 取自 CLI 成功结果或必要的只读回查。`appUrl` 是应用工作台，`formUrl` 和兼容字段 `url` 是表单入口。

## 4. 独立业务入口判定

PRD 的每个 display page 使用：

```yaml
entryMode: platform-shell | standalone
```

满足以下任一条件时可以使用 `standalone`：

- 页面已经实现完整页面导航壳；
- 页面能够独立完成员工自助或轻量业务任务；
- 页面不依赖宜搭工作台导航即可完成主要业务闭环。

对于未规划为独立前台的内容页，以下情况使用 `platform-shell`：

- 页面只有 tab、筛选、分段或卡片切换；
- 页面仍依赖平台导航进入核心表单、流程或管理页面；
- 页面只是普通工作台或看板，没有独立业务闭环；
- 现有信息不足以证明页面能够独立工作。

`entryMode` 属于产品和信息架构事实，由 `yida-prd` 负责，不由视觉设计 owner 或实现阶段猜测。

前台用途已经确定的自定义页面默认使用独立入口，无须用户再声明隐藏导航或传入新开关。Plan 根据 `execution.entryRecommendation.entries` 的 `role=service` 与 `sceneKey` 绑定自动补齐缺失的 `entryMode=standalone`；Fast 按相同业务用途执行。单步前台即使不绘制菜单也适用。后台内容页维持平台导航；用户显式的保留导航要求优先，不用页面名称猜测用途。

## 5. 页面导航持久化

页面为 `standalone` 时，创建页面后配置 `isRenderNav=false` 并回读，随后开发、发布和验证页面。交付前汇合发布与导航配置证据，确认入口可用后输出真实 `/custom/{formUuid}` 链接。配置未完成时说明当前缺项，按已验证的有效范围交付。

`publish` 默认读取持久化页面配置，不新增参数。`renderNav=false` 时返回 `standaloneUrl` 并将 `url` 指向同一条干净的 `/custom/{formUuid}`，同时保留 `workbenchUrl`。`get-form-config` 确认页面类型为 display 后也返回这些字段，可在配置修复后读取最新地址，无须重新发布源码。`renderNav` 优先于兼容字段 `isRenderNav`；缺失、无效值或回读失败时不返回独立入口，不能通过 URL 查询参数伪装隐藏导航成功。

前台在交付范围内时，最终结果必须给出已验证的单页面链接。尚未配置成功或验证完成时明确写“前台入口未完成”，不能静默省略，或用工作台、开发后台替代。已有公开或分享地址按实际访问证据保留；隐藏导航不改变公开访问与权限。仅取得 URL 不代表源码发布、真实用户权限或浏览器运行态已通过。

完整规则见 [页面导航配置](../../yida-skills/skills/yida-app/references/entry-navigation.md)。

## 6. 最终输出示例

业务结果包含简短总结、核验结果、剩余事项与按用途命名的入口；宿主负责具体呈现方式。

```markdown
已完成客户档案、联系人和跟进记录等核心业务能力，并发布经营看板。应用已支持客户维护、跟进记录和经营概览。

应用访问入口：

- 访问态前台：https://example.aliwork.com/APP_XXX/custom/FORM_XXX
- 业务后台：https://example.aliwork.com/APP_XXX/workbench
- 开发者后台：https://example.aliwork.com/APP_XXX/admin
```

上例适用于已验证前后台双入口的应用。其他场景按第 3 节的实际交付范围选择入口。

## 7. 验收标准

1. 包含五个以上业务资源的完整应用，最终不出现逐资源交付卡片。
2. requirement brief、PRD、design、build manifest 和资源清单不出现在用户交付物中。
3. 提供适用的真实入口，最多三类，顺序为访问态前台、业务后台、开发者后台；展示由宿主负责。
4. 完整应用默认同时交付适用的访问态入口与开发者后台；按范围提供两类或三类入口，用户显式排除优先。
5. `/custom` 只在 `entryMode=standalone` 且 `isRenderNav=false` 回读通过后存在。
6. 完整应用的开发者入口使用 `create-app` 或 `app-list` 的真实 `adminUrl`，与认证方式无关；缺少权威 URL 时回查并说明未完成，不猜测。
7. 云端和非云端、`platform-shell` 和 `standalone` 的四种组合均有契约测试。
8. 单页创建/修改/发布仍只交付当前页面，不被完整应用入口矩阵扩张。
9. 同一验证 URL 在本轮交付中去重；共用 URL 的用途合并说明。用户在后续 run 再次要求入口时可重新交付，且平台 mutation 为 0。
10. 本轮结果提供全部适用入口，全部处理完成后才结束，部分失败如实说明。

## 8. 非目标

- 不根据员工、管理员或开发者角色猜测入口；
- 不新增角色识别、动态重定向或前端折叠组件；
- 不默认隐藏整个应用的导航；
- 不修改宜搭平台现有 `/workbench`、`/custom`、`/admin` 路由；
- 不把内部 artifact 生命周期等同于用户交付生命周期。
