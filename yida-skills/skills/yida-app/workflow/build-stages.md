# 完整应用阶段

本文件用于阶段 1-8。按顺序执行，每个阶段只加载当前需要的子技能。

| 阶段 | 子技能 | 必做动作 | doneWhen |
|------|--------|----------|----------|
| 1. 设计前上下文 | 无 | 确认本轮复用已有 `appType`，或允许在 PRD 完成后创建新应用；外部工具预创建 app 只复用 `appType`，不自动修改应用名 | PRD 所需的目标组织、应用名称候选和资源复用边界明确 |
| 2. 产品设计 | `yida-design` | 生成 `prd/<项目名>/prd.md` 与 `prd/<项目名>/design.md`；记录两份文件路径、项目名和 `.cache/<项目名>-schema.json` 的 ID 映射位置 | 业务设计、视觉契约、资源顺序、页面顺序和导航顺序可执行 |
| 3. create/reuse app | `yida-create-app` 仅在 app 缺失且允许创建时加载 | 已有 `appType`、应用 URL 或已绑定 app 时直接复用；否则按 PRD 创建应用并提取真实 `appType` | 拿到真实目标 `appType`，且没有重复创建同类 app |
| 4. resolve forms/processes | `yida-form-detail`、`yida-create-form-page`；PRD 命中审批/流程时加载 `yida-create-process` | 已有目标表单时 update/patch/rule/bind-datasource；缺少核心业务表单且允许创建时才 create；原生表单输入写 `.form.json`，只扩展字段、Divider 分组、校验和规则；需要多字段映射时，每个目标表单最多一次性获取完整 `--field-map-json` 并合并写回 `.cache/<项目名>-schema.json` | 拿到或确认表单/流程表单 `formUuid`，字段结构和必要 ID 映射可供页面阶段使用 |
| 5. seed records | `yida-data-management` | 默认给本轮新建或页面数据源依赖的核心普通表单写入 1-3 条业务化 seed records，并 query 抽查至少 1 条；用户明确不要造数、表单是配置字典/权限表、或字段缺少可安全构造值时跳过并说明原因 | 核心表单有真实示例记录，或有明确跳过原因和空态方案 |
| 6. reserve main page | `yida-create-page` 仅在主页面缺失且允许创建时加载 | 已有页面 URL、`formUuid` 或已绑定页面时直接作为主页面；缺少首页/工作台/门户页且允许创建时，在表单/流程和 seed records 完成后创建 display page 占位 | 拿到真实主页面 `formUuid`，且没有重复创建页面 |
| 7. 编写/更新页面 | `yida-canvas-custom-page` | 每个页面实现前读取 `prd.md` 与 `design.md`；新建自定义页面从 `canvas.canvas.jsx` 扩展，写 `.canvas.jsx` / `.canvas.tsx`；需要生成器时从两份文件派生 `page-spec.json`，可直接手写时跳过 spec 写最终源码；展示列表、看板或详情记录时，优先接本轮真实表单数据 | Canvas 源码通过基础校验；未发布时仍是“源码已修改，尚未发布” |
| 8. 发布页面 | `yida-publish-page` | 发布本轮修改过的主页面源码到已确认 display page；发布成功后，PRD 写明导航顺序时执行轻量导航排序，缺少明确页面清单时用 `--auto-nav-order` / `nav-group auto-order` 兜底 | 发布成功、获得可访问 URL，且导航排序已执行或给出明确 warning |

## 默认阶段

完整应用默认执行以下动作：

1. 创建或复用核心普通表单和流程表单；
2. 为核心普通表单写入 1-3 条业务化示例记录并抽查；
3. 创建或复用主 display page；
4. 实现主页面并发布；
5. 执行轻量导航排序。

## 可选阶段

以下动作只在用户明确要求或 PRD 验收标准命中时追加：

1. 公开访问配置；
2. 截图验收；
3. 数据桥深度接入；
4. 报表或大屏；
5. 精细导航分组。

## page-spec 关系

`page-spec.json` 是实现 handoff / 生成器输入。它只保存 PRD/design.md 的指针、主题摘要和当前页面业务参数；冲突时以 `prd.md + design.md` 为准。
