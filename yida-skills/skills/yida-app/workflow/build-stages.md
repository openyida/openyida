# 完整应用阶段

本文件用于阶段 1-8。按依赖执行，每个阶段只加载当前需要的子技能。

阶段 4 拿到表单、流程和字段映射后，seed records 和页面创建/实现可以同时开始。不要等示例数据写完才创建或编写自定义页面；最终输出前汇合 seed 写入证据或跳过原因即可。

| 阶段 | 子技能 | 必做动作 | doneWhen |
|------|--------|----------|----------|
| 1. 需求剖析 | `yida-requirement-analysis` | 读取用户需求和资源上下文，写入 `.cache/openyida/<项目名>/requirement-brief.json` | 行业、用户、业务目标、核心功能、业务对象、页面场景、品牌和色彩偏好明确 |
| 2A. PRD 生成（并行） | `yida-prd` | 读取共享需求简报，生成 `prd/<项目名>/prd.md`；记录项目名和 `.cache/<项目名>-schema.json` 的 ID 映射位置 | PRD 可执行 |
| 2B. design.md 生成（并行） | `yida-design` | 读取共享需求简报，生成 `design.md`、`design-runtime.json` 和项目表单/Canvas 脚手架；不等待或读取本轮 PRD | 设计文件和两份项目脚手架可用 |
| 2C. 设计产物对齐 | `yida-canvas-custom-page` | 等 2A 和 2B 都完成后，校验 PRD 页面场景与 design.md 的 `sceneRecipes`；为本轮页面派生 `page-spec.json`。业务冲突交给 `yida-prd` 修正，视觉冲突交给 `yida-design` 修正 | 两份事实源无冲突，page-spec 引用有效且包含本轮页面实现所需的业务与视觉摘要 |
| 3. create/reuse app | `yida-create-app` 仅在 app 缺失且允许创建时加载 | 已有 `appType`、应用 URL 或已绑定 app 时直接复用；否则按 PRD 创建应用并提取真实 `appType` | 拿到真实目标 `appType`，且没有重复创建同类 app |
| 4. resolve forms/processes | `yida-form-detail`、`yida-create-form-page`；PRD 命中审批/流程时加载 `yida-create-process` | 已有目标表单时 update/patch/rule/bind-datasource；缺少核心业务表单且允许创建时才 create；从项目 `scaffolds/form.form.json` 扩展业务字段；需要多字段映射时，每个目标表单最多一次性获取完整 `--field-map-json` 并合并写回 `.cache/<项目名>-schema.json` | 拿到或确认表单/流程表单 `formUuid`，字段结构和必要 ID 映射可供页面阶段使用 |
| 5A. seed records（并行） | `yida-data-management` | 阶段 4 后立即启动；默认给本轮新建或页面数据源依赖的核心普通表单写入 1-3 条业务化 seed records，并 query 抽查至少 1 条；用户明确不要造数、表单是配置字典/权限表、或字段缺少可安全构造值时跳过并说明原因 | 最终输出前拿到真实示例记录证据，或有明确跳过原因和空态方案 |
| 5B. 创建本轮主页面（并行） | `yida-create-page` 仅在本轮主页面缺失且允许创建时加载 | 阶段 4 后即可执行；已有页面 URL、`formUuid` 或已绑定页面时直接复用；缺少本轮要实现并发布的首页、工作台或门户页时创建该页面，不等待 seed records 完成。下一步或以后才实现的其他页面只保留在 PRD，不执行 `create-page` | 拿到本轮主页面的真实 `formUuid`，且没有创建未实现页面或重复页面 |
| 5C. 编写/更新页面（并行） | `yida-canvas-custom-page` | 阶段 4 后即可执行；从项目 `scaffolds/canvas.canvas.jsx` 扩展，读取阶段 2C 的 `page-spec.json` 和真实 `appType/formUuid/fieldId`。只有设计变化或 spec 冲突时才回读 PRD/design.md 并重新派生 | Canvas 源码通过基础校验；未发布时仍是“源码已修改，尚未发布” |
| 6. 发布并应用导航 | `yida-publish-page`、`yida-nav-group` | 发布本轮修改过的主页面。所有本轮资源拿到真实 ID 后，根据 PRD 的 `resourceKey` 和 `.cache/<项目名>-schema.json` 生成 `.cache/openyida/<项目名>/navigation-plan.json`，执行 `openyida nav-group order <appType> --plan <file>`。后续才实现的页面不写入执行计划 | 页面发布成功；导航命令返回 `verification.matched=true`，回读分组和顺序与 PRD 的本轮资源一致 |
| 7. 汇合默认证据 | 无 | 汇合 seed records 结果、页面发布结果和导航结果；seed 失败时保留空态入口和失败原因，不回滚已发布页面 | 完整应用默认证据齐全，或每项缺失都有明确原因 |

## 默认阶段

完整应用默认执行以下动作：

1. 创建或复用核心普通表单和流程表单；
2. 为核心普通表单写入 1-3 条业务化示例记录并抽查；
3. 创建或复用本轮要实现并发布的主 display page；
4. 实现主页面并发布；
5. 应用导航计划并回读确认。

第 2 项和第 3-4 项在表单字段映射完成后并行执行；最终输出前汇合结果。

## 可选阶段

以下动作只在用户明确要求或 PRD 验收标准命中时追加：

1. 公开访问配置；
2. 截图验收；
3. 数据桥深度接入；
4. 报表或大屏；
5. 精细导航分组。

## page-spec 关系

`prd.md` 保存业务事实，`design.md` 保存视觉事实，`page-spec.json` 是当前页面的派生交接。生成、字段和修复规则归 `yida-canvas-custom-page`。
