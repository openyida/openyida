# 完整应用阶段

本文件用于阶段 1-8。按依赖执行，每个阶段只加载当前需要的子技能。

阶段 4 拿到表单、流程和字段映射后，seed records 和页面源码实现可以同时开始。页面源码必须先通过 Canvas 编译，才能创建对应页面容器；不要批量创建空页面。最终输出前汇合 seed 写入证据或跳过原因即可。

| 阶段 | 子技能 | 必做动作 | doneWhen |
|------|--------|----------|----------|
| 1. 需求剖析 | `yida-requirement-analysis` | 读取用户需求和资源上下文，写入 `.cache/openyida/<项目名>/requirement-brief.json` | 行业、用户、业务目标、核心功能、业务对象、页面场景、品牌和色彩偏好明确 |
| 2A. PRD 生成（并行） | `yida-prd` | 读取共享需求简报，生成 `prd/<项目名>/prd.md`；记录项目名和 `.cache/<项目名>-schema.json` 的 ID 映射位置 | PRD 可执行 |
| 2B. design.md 生成（并行） | `yida-design` | 读取共享需求简报，生成 `design.md`、`design-runtime.json` 和项目表单/Canvas 脚手架；不等待或读取本轮 PRD | 设计文件和两份项目脚手架可用 |
| 2C. PRD/design 对齐 | `yida-canvas-custom-page` | 等 2A 和 2B 都完成后，校验 PRD 页面场景、`prdRefs` 与 design.md 的 `designRefs`。业务冲突交给 `yida-prd` 修正，视觉冲突交给 `yida-design` 修正 | 当前页面的 PRD/design 引用存在且无冲突 |
| 3. create/reuse app | `yida-create-app` 仅在 app 缺失且允许创建时加载 | 已有 `appType`、应用 URL 或已绑定 app 时直接复用；否则按 PRD 创建应用并提取真实 `appType` | 拿到真实目标 `appType`，且没有重复创建同类 app |
| 4. resolve forms/processes | `yida-form-detail`、`yida-create-form-page`；PRD 命中审批/流程时加载 `yida-create-process` | 已有目标表单时 update/patch/rule/bind-datasource；缺少核心业务表单且允许创建时才 create；从项目 `scaffolds/form.form.json` 扩展业务字段；需要多字段映射时，每个目标表单最多一次性获取完整 `--field-map-json` 并合并写回 `.cache/<项目名>-schema.json` | 拿到或确认表单/流程表单 `formUuid`，字段结构和必要 ID 映射可供页面阶段使用 |
| 5A. seed records（并行） | `yida-data-management` | 阶段 4 后立即启动；默认给本轮新建或页面数据源依赖的核心普通表单写入 1-3 条业务化 seed records，并 query 抽查至少 1 条；用户明确不要造数、表单是配置字典/权限表、或字段缺少可安全构造值时跳过并说明原因 | 最终输出前拿到真实示例记录证据，或有明确跳过原因和空态方案 |
| 5B. 实现本轮页面源码（并行） | `yida-canvas-custom-page` | 读取 PRD“页面实现交付顺序”，只处理“本轮交付=是”的页面。每页写入薄 page-spec，记录 `prdRefs`、`designRefs`、真实 `appType/formUuid/fieldId`、数据绑定和源码路径；复制项目 Canvas 脚手架，按引用读取 PRD/design.md 的当前页章节，完成源码并执行 `openyida compile <source> --json`。本阶段禁止调用 `create-page` | 每个本轮交付页面都有完整源码，编译返回 `mode=canvas`；后续页面没有源码要求，也没有线上空容器 |
| 5C. 逐页创建并发布 | `yida-create-page`、`yida-publish-page` | 按 PRD 交付顺序逐页执行。已有页面直接发布；页面缺失时执行 `openyida create-page <appType> <pageName> --source <source>`，取得真实 `formUuid` 后立即执行返回的 `delivery.requiredNextCommand`，再回读确认 `YidaCodeCanvas`。上一页未发布成功前不得创建下一页；创建后发布失败时立即 `nav-group hide` 隐藏该空导航项并停止 | 所有“本轮交付=是”的页面都已发布并回读成功；不存在 `container_created_unpublished` 页面 |
| 6. 应用导航 | `yida-nav-group` | 所有本轮页面发布成功并拿到真实 ID 后，必须根据 PRD 的 `resourceKey` 和 `.cache/<项目名>-schema.json` 写入 `.cache/openyida/<项目名>/navigation-plan.json`，再执行 `openyida nav-group order <appType> --plan <file>`。未发布页面和后续页面不写入计划；`resourceKey` 没有真实 ID 时先修正映射，不得跳过导航 | 计划文件存在，命令返回 `verification.matched=true`，回读分组和顺序与 PRD 的本轮已发布资源一致 |
| 7. 汇合默认证据 | 无 | 汇合 seed records、页面发布和导航执行结果；seed 失败时保留空态入口和失败原因，不回滚已发布页面。缺少导航计划、命令结果或回读证据时停止，不进入最终输出 | 导航证据完整；seed records 有证据或明确跳过原因 |

## 默认阶段

完整应用默认执行以下动作：

1. 创建或复用核心普通表单和流程表单；
2. 为核心普通表单写入 1-3 条业务化示例记录并抽查；
3. 实现并编译 PRD 中所有“本轮交付=是”的自定义页面源码；
4. 按交付顺序逐页复用或创建容器，并立即发布、回读；
5. 应用导航计划并回读确认。

第 2 项和第 3 项在表单字段映射完成后并行执行；第 4 项必须在对应页面源码编译成功后执行。最终输出前汇合结果。

## 可选阶段

以下动作只在用户明确要求或 PRD 验收标准命中时追加：

1. 公开访问配置；
2. 截图验收；
3. 数据桥深度接入；
4. 报表或大屏。

## page-spec 关系

`prd.md` 保存完整业务要求，`design.md` 保存完整视觉要求。`page-spec.json` 只索引当前页面要读取的章节和真实资源，不保存两份文件的摘要。字段和读取规则归 `yida-canvas-custom-page`。
