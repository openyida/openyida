---
name: yida-design-plan
description: Plan 模式的视觉设计分支。基于需求选择视觉方向，再结合业务页面规划维护 build-plan.json 的 visualStyle，供 CLI 派生 design.md。
---

# Plan 视觉设计

负责 Plan 的视觉候选与页面视觉应用，由 [yida-app Plan 流程](../../../yida-app/workflow/plan/workflow.md) 分两次调用。

## 阶段一：提供视觉候选

输入为共享的 `.cache/openyida/<项目名>/requirement-brief.json`。

已有明确的完整视觉方向时直接采用；需要用户选择风格时，按 [视觉方向选择](references/visual-theme-selection.md) 准备三套应用风格方案，交给 `yida-app` 统一呈现。候选阶段只读主题索引，收到选择后写入一致的 `visualDirection`、`selectedTheme`、`colorStrategy` 和 `navigationStyle`。

## 阶段二：完成页面视觉应用

与 `yida-prd` 并行启动，读取同一需求和已选视觉方向，先准备基础主题、token 与素材策略；页面任务、区块、sceneKey、页面模式和信息密度确定后完成逐页视觉绑定。

1. 只读取选中的一份完整主题模板，按 [视觉事实](references/visual-design.md) 补齐 `visualStyle` 的页面视觉应用和素材策略，保持页面业务事实。
2. 具体 token 差异写入 `visualStyle.tokens`；主色写入 `forUser.colorStrategy.primaryColor`。JSON 保存项目事实与差异，标准规则由模板提供。
3. 按 [视觉输出契约](../../workflow/output-design.md) 核对稳定的 `sceneRecipes.<sceneKey>` 引用，与实际页面逐一对应。

用户选择整体暗色或黑色主题时，按 [暗色主题浮层适配](../../references/theme/theme-token-presets.md#暗色主题浮层适配) 补齐 `visualStyle.tokens`；导航明暗保持独立。

视觉事实以独立片段返回 `yida-app`，由其与业务事实合并写入计划，再按 [生成与确认](../../../yida-app/workflow/plan/step-4-deliver.md) 输出同版本产物。确认后执行 [公共主题 CLI 流程](../../references/theme/theme-token-presets.md)，复制公共 CSS 并按 `design.md` 应用 token。
