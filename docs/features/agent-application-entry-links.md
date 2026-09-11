# Agent 应用交付物与入口契约

## 1. 目标

完整应用搭建结束时同时解决两个问题：

1. 不再把内部设计文件、资源清单和每个表单/流程/报表分别显示成用户交付物；
2. 在唯一一组“应用访问入口”中，按运行环境和页面能力输出用途明确的入口。

这里的“唯一一组”是交付单元，不表示只能有一个 URL。入口组最多包含工作台、独立业务入口和开发后台三个有明确名称的 URL。

## 2. 用户可见交付边界

### 2.1 内部 artifact

以下文件只用于 Agent 编排、join 和完整性验收，默认不得登记为用户可见 artifact、附件或下载卡片：

- `.cache/openyida/<project>/requirement-brief.json`；
- `prd/<project>/prd.md`；
- `prd/<project>/design.md`；
- `prd/<project>/build-manifest.json`；
- Schema、资源清单、页面源码、编译产物和中间配置。

### 2.2 业务资源

表单、流程、报表和页面是应用内部资源，不逐项形成最终交付卡片。最终回复按业务能力或数量概述，例如“已完成 4 张业务表单、1 条审批流程和 1 个经营看板”。

只有用户明确要求排障、迁移、复制配置或查看技术 ID 时，才补充资源明细。

### 2.3 应用入口

一次完整应用搭建只产生一组名为“应用访问入口”的用户可见交付。宿主提供 artifact 或交付工具时，也只在 final 调用一次并承载整组入口。

## 3. 入口矩阵

| 运行环境 / 页面能力 | 应用工作台 | 独立业务入口 | 应用开发后台 |
| --- | --- | --- | --- |
| 云端 Agent，`platform-shell` | 必须 | 不输出 | 不输出 |
| 云端 Agent，已验证 `standalone` | 必须 | 输出 | 不输出 |
| 非云端 Agent，`platform-shell` | 必须 | 不输出 | 输出 |
| 非云端 Agent，已验证 `standalone` | 必须 | 输出 | 输出 |

URL：

```text
应用工作台：{base_url}/{appType}/workbench
独立业务入口：{base_url}/{appType}/custom/{formUuid}
应用开发后台：{base_url}/{appType}/admin
```

运行环境不得通过 Agent 名称或自然语言猜测。以 `openyida agent-capabilities --summary-json` 返回的 `application_entry_policy` 为准：

- `entries.admin=omit`：云端 Agent，不输出 `/admin`；
- `entries.admin=include`：非云端 Agent，输出 `/admin`。

## 4. 独立业务入口判定

PRD 的每个 display page 使用：

```yaml
entryMode: platform-shell | standalone
```

满足以下任一条件时可以使用 `standalone`：

- 页面已经实现完整页面导航壳；
- 页面能够独立完成员工自助或轻量业务任务；
- 页面不依赖宜搭工作台导航即可完成主要业务闭环。

以下情况必须使用 `platform-shell`：

- 页面只有 tab、筛选、分段或卡片切换；
- 页面仍依赖平台导航进入核心表单、流程或管理页面；
- 页面只是普通工作台或看板，没有独立业务闭环；
- 现有信息不足以证明页面能够独立工作。

`entryMode` 属于产品和信息架构事实，由 `yida-prd` 负责，不由视觉设计 owner 或实现阶段猜测。

## 5. 页面导航持久化

主页面为 `standalone` 时：

1. 发布页面并完成健康检查；
2. 执行 `openyida update-form-config <appType> <formUuid> false "<页面标题>"`；
3. 执行 `openyida get-form-config <appType> <formUuid> --json`；
4. 只有回读确认 `isRenderNav=false` 后，才输出不带查询参数的 `/custom/{formUuid}`。

写入或回读失败时保留 `/workbench`，不追加 `?isRenderNav=false` 猜测持久配置已经生效，也不修改应用维度的 `hideAppNav` 兜底。

## 6. 最终输出示例

```markdown
已完成客户档案、联系人和跟进记录等核心业务能力，并发布经营看板。应用已支持客户维护、跟进记录和经营概览。

应用访问入口：

- 应用工作台：https://example.aliwork.com/APP_XXX/workbench
- 独立业务入口：https://example.aliwork.com/APP_XXX/custom/FORM_XXX
```

上例只适用于云端 Agent 且主页面已经通过 `standalone` 写后回读。非云端 Agent 再增加“应用开发后台”；`platform-shell` 页面不显示“独立业务入口”。

## 7. 验收标准

1. 包含五个以上业务资源的完整应用，最终不出现逐资源交付卡片。
2. requirement brief、PRD、design、build manifest 和资源清单不出现在用户交付物中。
3. 最终只有一组“应用访问入口”。
4. `/workbench` 始终存在。
5. `/custom` 只在 `entryMode=standalone` 且 `isRenderNav=false` 回读通过后存在。
6. `/admin` 只在 `application_entry_policy.entries.admin=include` 时存在。
7. 云端和非云端、`platform-shell` 和 `standalone` 的四种组合均有契约测试。
8. 单页创建/修改/发布仍只交付当前页面，不被完整应用入口矩阵扩张。

## 8. 非目标

- 不根据员工、管理员或开发者角色猜测入口；
- 不新增角色识别、动态重定向或前端折叠组件；
- 不默认隐藏整个应用的导航；
- 不修改宜搭平台现有 `/workbench`、`/custom`、`/admin` 路由；
- 不把内部 artifact 生命周期等同于用户交付生命周期。
