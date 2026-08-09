---
name: yida-app
description: 完整应用编排。用于从零搭建或补齐一个宜搭应用。读取 yida-design 的 prd.md/design.md，按依赖加载子技能，发布主页面，返回主入口链接。
---

# yida-app — 完整应用统一编排

本技能负责完整应用和补齐应用。它先确认目标资源，再按依赖加载子技能，最后发布主页面并输出一个主入口链接。表单/字段映射完成后，示例数据写入和自定义页面创建/实现可以并行。

## 触发条件

| 用户诉求 | 是否进入本技能 | 动作 |
| --- | --- | --- |
| 从零创建、搭建、生成一个完整宜搭应用/系统/平台/管理工具 | 是 | 执行完整应用统一编排阶段 |
| 已有 app/page 需要补齐成完整业务系统 | 是 | 复用已有资源，补齐缺口并发布主入口 |
| 只加字段、改公式、查数据、发布已有页面、改权限、配流程 | 否 | 回到根入口单点技能路由 |
| 目标 app/page/form/process 不明确 | 暂停 | 先只读确认或询问用户 |

## 预检

遵循根入口的只读预检结果。当前会话还没做预检时，先按根入口执行一次只读校验。登录态可用后，才执行会创建、修改或发布宜搭资源的命令。

## 核心边界

1. **设计产物**：`prd.md` 与 `design.md` 由 `yida-design` 定义、产出和验收；本技能只读取这两份文件。
2. **页面实现**：`page-spec.json` 是页面阶段按需派生的产物；Code Canvas 实现规则交给 `yida-canvas-custom-page`。
3. **资源优先**：已有 app/page/form/process 默认复用；目标缺失且本次意图允许创建时，才加载 create 类子技能。
4. **发布要求**：本轮修改页面源码后，final 前必须看到成功的 `openyida publish <source> <appType> <displayPageFormUuid>`。
5. **最终输出**：最终回复先写 2-3 句业务交付总结，再给一个主入口链接。

## 执行流程

执行到每个阶段前，先读取该阶段对应的 workflow 文件。

| 阶段 | 子技能 | 必做动作 | doneWhen |
|------|--------|----------|----------|
| 0. 确认目标资源 | 无 | 读取 [确认目标资源](workflow/resolve-context.md)，判断复用、创建缺口或询问用户 | 目标 app/page/form/process 的处理方式明确 |
| 1-7. 创建、补齐、实现和发布 | 按依赖加载 | 读取 [完整应用阶段](workflow/build-stages.md)，按依赖创建或复用资源；表单/字段映射完成后并行写入示例记录和实现页面 | 主页面发布成功，导航排序已处理，seed records 有证据或跳过原因 |
| 9. 输出结果 | 无 | 读取 [最终输出](workflow/final-output.md)，写业务总结和主入口链接 | 用户能理解交付内容并打开主入口 |

## 子技能短引用

| 子技能 | 何时加载 |
| --- | --- |
| `yida-design` | 阶段 2 加载，生成 `prd.md` 与 `design.md` |
| `yida-create-app` | app 缺失且本次意图允许创建时加载 |
| `yida-form-detail` / `yida-create-form-page` | 创建或更新原生表单字段结构时加载；字段、分组、校验和规则写 `.form.json` |
| `yida-create-process` | PRD 命中审批、流程、申请、审核或工单对象时加载 |
| `yida-data-management` | 完整应用默认写入核心普通表单示例记录时加载 |
| `yida-create-page` | 主 display page 缺失且允许创建时加载 |
| `yida-canvas-custom-page` | 完整应用页面实现链路 |
| `yida-publish-page` | 本轮修改页面源码后发布主页面时加载 |
| `yida-nav-group` | 用户明确要求精细导航整理，或轻量排序需要单独命令时加载 |

公开访问、截图验收、数据桥深度接入、报表/大屏、精细导航分组只在用户明确要求或 PRD 验收标准命中时追加。seed records、表单详情页 formDetail CSS 注入和轻量导航排序属于默认完整应用阶段。

## 存储约定

| 内容 | 存放位置 |
| --- | --- |
| 设计产物 | `prd/<项目名>/prd.md`、`prd/<项目名>/design.md` |
| 真实 ID | `.cache/<项目名>-schema.json` |
| 临时配置、导入数据、脚本 | `.cache/openyida/<项目名或任务名>/` |
| 页面派生产物 | 需要时由页面实现阶段生成 `page-spec.json` |

## 完成条件

完整应用默认完成条件见 [最终输出](workflow/final-output.md)。本轮修改过页面源码但没有成功发布时，只能交付本地源码修改说明和未发布原因。

## 错误处理

- 不编造 `appType`、`formUuid`、`fieldId`、`reportId`。
- OpenYida CLI 不加 `2>/dev/null`；失败时保留 stdout/stderr 诊断。
- 同一命令失败后，必须改变登录态、组织、参数、输入文件或字段 ID 后才能重试。
- corpId 与目标组织不一致时先停下，让用户选择重新登录或在当前组织继续。
- 已有目标 app/page/form/process 时默认复用；只有用户明确要求新建另一个同类资源，或目标缺失且本次意图允许创建时，才加载 create 类子技能。
- 当前轮用户明确指定的资源优先于已绑定资源上下文。
- 输入 JSON/YAML/CSV/JSX 等业务文件必须用结构化文件写入工具创建，不用 shell heredoc、`cat`、`echo`、`printf`、`tee` 或重定向。
- 用户要求删除应用时，必须展示应用名称、应用 ID、影响范围，并等待用户明确回复“确认删除”后才可执行。

## 参考

- [确认目标资源](workflow/resolve-context.md)：阶段 0，选择目标 app/page/form/process。
- [完整应用阶段](workflow/build-stages.md)：阶段 1-7，按依赖加载子技能，seed records 与页面实现可并行。
- [最终输出](workflow/final-output.md)：阶段 9，判断完成并输出主入口。
- [详细编排参考](references/app-build-contract.md)：排障、URL 规则、字段文件样例、seed records 细则、删除应用确认和故障处理。
- `use_skill("yida-design", "完整应用产品设计")`：生成 `prd.md` 与 `design.md`。
- `use_skill("yida-canvas-custom-page", "实现 Code Canvas 页面")`：完整应用页面实现链路。
