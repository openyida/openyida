---
name: yida-app
description: 从零搭建或补齐一个宜搭应用。生成需求和设计文件，创建所需资源，发布本轮页面并返回应用入口。
---

# yida-app - 完整应用构建

本技能负责完整应用和补齐应用。它先确认目标资源并生成共享需求简报，再同时生成 `prd.md` 和 `design.md`，最后按依赖创建资源、逐页发布本轮页面并输出一个主入口链接。表单/字段映射完成后，示例数据写入和页面源码实现可以并行；页面容器只能在对应源码编译成功后创建。

## 触发条件

| 用户诉求 | 是否进入本技能 | 动作 |
| --- | --- | --- |
| 从零创建、搭建、生成一个完整宜搭应用/系统/平台/管理工具 | 是 | 执行完整应用阶段 |
| 已有 app/page 需要补齐成完整业务系统 | 是 | 复用已有资源，补齐缺口并发布主入口 |
| 只加字段、改公式、查数据、发布已有页面、改权限、配流程 | 否 | 回到根入口单点技能路由 |
| 目标 app/page/form/process 不明确 | 暂停 | 先只读确认或询问用户 |

## 预检

遵循根入口的只读预检结果。当前会话还没做预检时，先按根入口执行一次只读校验。登录态可用后，才执行会创建、修改或发布宜搭资源的命令。

## 核心边界

1. **设计产物**：`yida-prd` 和 `yida-design` 读取同一份共享需求简报，同时生成 `prd.md` 和 `design.md`；本技能在两份文件完成后校验一致性。
2. **页面实现**：`page-spec.json` 只记录 PRD/design.md 章节引用、真实资源 ID、数据绑定和源码路径。页面技能按引用读取原文，并使用 `yida-design` 准备的项目脚手架。
3. **资源优先**：已有 app/page/form/process 默认复用；目标缺失且本次意图允许创建时，才加载 create 类子技能。
4. **发布要求**：本轮修改页面源码后，PRD 中所有“本轮交付=是”的页面都必须在 final 前成功执行 `openyida publish <source> <appType> <displayPageFormUuid>`；不能用已创建的空容器代替页面交付。
5. **最终输出**：最终回复先写 2-3 句业务交付总结，再给一个主入口链接。

## 执行流程

执行到每个阶段前，先读取该阶段对应的 workflow 文件。

| 阶段 | 子技能 | 必做动作 | 完成条件 |
|------|--------|----------|----------|
| 0. 确认目标资源 | 无 | 读取 [确认目标资源](workflow/resolve-context.md)，判断复用、创建缺口或询问用户 | 目标 app/page/form/process 的处理方式明确 |
| 1-8. 需求、设计、创建、实现和发布 | 按依赖加载 | 读取 [完整应用阶段](workflow/build-stages.md)，先生成共享需求简报，再并行生成 PRD 和 design.md；之后先实现页面源码，再逐页创建和发布 | 本轮页面全部发布成功，导航计划回读一致，seed records 有证据或跳过原因 |
| 9. 输出结果 | 无 | 读取 [最终输出](workflow/final-output.md)，写业务总结和主入口链接 | 用户能理解交付内容并打开主入口 |

## 子技能短引用

| 子技能 | 何时加载 |
| --- | --- |
| `yida-requirement-analysis` | 阶段 1 加载，生成共享需求简报 |
| `yida-prd` | 阶段 2A 与 `yida-design` 同时加载，生成 `prd.md` |
| `yida-design` | 阶段 2B 与 `yida-prd` 同时加载，生成 `design.md` 和项目视觉脚手架 |
| `yida-create-app` | app 缺失且本次意图允许创建时加载 |
| `yida-form-detail` / `yida-create-form-page` | 创建或更新原生表单时加载；输入和实现规则见 `yida-create-form-page` |
| `yida-create-process` | PRD 命中审批、流程、申请、审核或工单对象时加载 |
| `yida-data-management` | 完整应用默认写入核心普通表单示例记录时加载 |
| `yida-create-page` | 本轮页面源码已通过 Canvas 编译、目标 display page 缺失且允许创建时加载 |
| `yida-canvas-custom-page` | 实现完整应用页面 |
| `yida-publish-page` | 逐页发布本轮已完成源码时加载 |
| `yida-nav-group` | 阶段 6 应用并验证 PRD 导航计划时加载；单点导航任务也可直接加载 |

公开访问、截图验收、数据桥深度接入、报表/大屏只在用户明确要求或 PRD 验收标准命中时追加。seed records、表单详情页 formDetail CSS 注入和按 PRD 应用导航计划属于默认完整应用阶段。

## 存储约定

| 内容 | 存放位置 |
| --- | --- |
| 设计产物 | `prd/<项目名>/prd.md`、`prd/<项目名>/design.md` |
| 共享需求简报 | `.cache/openyida/<项目名>/requirement-brief.json` |
| 项目视觉配置 | `.cache/openyida/<项目名>/design-runtime.json` |
| 项目脚手架 | `.cache/openyida/<项目名>/scaffolds/form.form.json`、`canvas.canvas.jsx` |
| 真实 ID | `.cache/<项目名>-schema.json` |
| 临时配置、导入数据、脚本 | `.cache/openyida/<项目名或任务名>/` |
| 页面索引 | `.cache/openyida/<项目名>/page-specs/<pageKey>.json`；只记录原文引用和真实资源 |
| 导航执行计划 | `.cache/openyida/<项目名>/navigation-plan.json` |

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
- [完整应用阶段](workflow/build-stages.md)：阶段 1-8，PRD 与 design.md 并行，seed records 与页面实现并行。
- [最终输出](workflow/final-output.md)：阶段 9，判断完成并输出主入口。
- [详细执行参考](references/app-build-contract.md)：排障、URL 规则、字段文件样例、seed records 细则、删除应用确认和故障处理。
- `use_skill("yida-requirement-analysis", "生成完整应用共享需求简报")`：生成 PRD 和 design.md 的共同输入。
- `use_skill("yida-prd", "完整应用 PRD 生成")`：生成 `prd.md`。
- `use_skill("yida-design", "完整应用视觉设计")`：生成 `design.md`。
- `use_skill("yida-canvas-custom-page", "实现 Code Canvas 页面")`：实现完整应用页面。
