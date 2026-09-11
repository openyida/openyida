---
name: yida-aggregate-table
description: 宜搭聚合表（virtualView）管理。用于列出、创建空聚合表、读取/预览设计配置、保存草稿、发布配置和查询构建状态；严格区分 stash 与 live revision，并在写入前校验固定前端已确认的六数组契约。
---

# 宜搭聚合表技能

## 触发条件

用户明确提到“聚合表”“虚拟视图”“virtualView”，或要检查、预览、保存、发布已有聚合表时使用本技能。普通统计报表使用 `yida-report`；自定义看板使用 `yida-dashboard` / `yida-rechart`，不要混用。

本技能只编排 `openyida aggregate-table` 已有的确定性窄命令，不生成通用高层 DSL，不复刻聚合公式引擎，不调用前端 AI authoring 接口。

## 安全边界

- 写操作前必须从当前资源上下文取得精确 `appType` 和聚合表 `formUuid`，不得按名称猜 ID。
- `preview` 是远端计算请求但不持久化；`save` 写草稿；`publish` 写 live 配置并触发构建。
- `save` 的并发轴是 `stashGmtModified`，`publish` 的并发轴是 `gmtModified`。对应 GET readback 轴必须存在且前进；响应包含 revision 时还必须与该 readback 轴一致，不能用响应替代回读证据。
- 设计 JSON 的六个顶层数组是 `relationForms`、`relationships`、`aggregatedFields`、`auxFields`、`formulaFields`、`validators`。显式错误类型必须失败，不能改成空数组继续写。
- 不实现或猜测整表 delete。当前没有固定前端证据证明删除 API；物理 cleanup 必须报告 `remote_cleanup_unsupported`，不能声称删除成功。域内真实 E2E 只能在 exact runId/name ownership 证明成立后写入，并以 live revision 条件恢复至写前 canonical 配置；并发或归属证据变化时必须 `restore_blocked`，不得覆盖。
- 动态租户 limits、真实公式语法、stash/live 可见性延迟、published runtime 查询和删除协议均为 `PLATFORM_PROBE_REQUIRED`。

## 工作流

### 1. 读取目标与现状

```bash
openyida aggregate-table list <appType> --json
openyida aggregate-table inspect <appType> <formUuid> --json
```

需要新建资源且用户已授权时，才执行：

```bash
openyida aggregate-table create-empty <appType> "<名称>" --no-open
```

### 2. 准备设计 JSON

设计 JSON 放在 `<projectRoot>/.cache/openyida/<任务名>/aggregate-design.json`，通过结构化文件写入工具创建。不要用 shell heredoc、`cat`、`echo`、`printf`、`tee` 或重定向生成。

发布前至少满足：

- 每个 relationship 的 `relationshipInfos` 数量与 `relationForms` 数量一致。
- `relationId` 唯一，并与 `aggregatedFields[].id` 一一对应。
- 指标包含唯一 `id`、非空 `name` 和 `formula`。
- validator 同时包含 `formula` 与非空 `text.zh_CN`。
- filter rules 不超过固定前端默认上限 10，且每条 rule 有 `operator`。
- aux field 包含唯一 `id` 与非空 `name`。

以上只做结构与引用完整性校验，不在本地判断聚合公式业务语义。

### 3. 预览、保存与发布

```bash
openyida aggregate-table preview <appType> <formUuid> <design.json> --json
openyida aggregate-table save <appType> <formUuid> <design.json> --json --no-open
openyida aggregate-table publish <appType> <formUuid> <design.json> --json --no-open
openyida aggregate-table status <appType> <formUuid> --json
```

不要跳过 preview 后直接发布未经平台计算验证的复杂配置。发布成功只证明配置持久化；构建状态还必须精确读取到 `SUCCESS`。`FAIL` 时保留 `errorMsg`，不要无修改重复发布。

## 完成契约

- 只读任务：返回精确 `appType/formUuid`、当前六数组摘要与 revision 状态。
- 草稿任务：`revisionAxis=stashGmtModified`、stash readback revision 已前进且六数组 canonical readback 一致；响应 revision 存在时须与 stash readback 一致。
- 发布任务：`revisionAxis=gmtModified`、live readback revision 已前进且六数组 canonical readback 一致；响应 revision 存在时须与 live readback 一致，并读取构建终态。
- 真实运行态结果与物理 cleanup 在平台协议未探明前必须明确标注 `PLATFORM_PROBE_REQUIRED` / `remote_cleanup_unsupported`；域内 E2E 的 conditional restore 还必须单独给出 exact readback 证据，不能用命令退出 0 替代。

## WHEN NOT（明确不做）

- 整表 delete、模糊名称清理或跨 run 清理。
- AI 文生聚合表、拖拽设计器复制、每个 UI 动作一个 CLI 子命令。
- 通用 high-level DSL、动态 limits 平台或本地公式引擎。
