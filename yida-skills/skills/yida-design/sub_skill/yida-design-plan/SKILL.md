---
name: yida-design-plan
description: Plan 模式的视觉设计分支。基于需求选择视觉方向，再结合业务页面规划维护 build-plan.json 的 visualStyle，供 CLI 派生 design.md。
---

# Plan 视觉设计

负责 Plan 的视觉候选与页面视觉应用。首轮仅保留整体风格或可调整建议，主题映射在规划准备补齐；需求确认后由 [Plan 流程](../../../yida-app/workflow/plan/workflow.md) 启动页面视觉设计。

## 阶段一：提供视觉候选

输入为共享的 `.cache/openyida/<项目名>/requirement-brief.json`。

已有明确的完整视觉方向时直接采用；无明确偏好且不影响业务范围时，由 AI 按[设计方向比较](../../references/style-design-selection.md#设计方向比较)完成一次内部比较，选定方向并记录依据；保持原有首轮提问范围。用户明确要求比较或选择风格时，按 [视觉方向选择](references/visual-theme-selection.md) 准备三套应用风格方案，交给 `yida-app` 统一呈现。候选阶段只读主题索引，收到选择后写入一致的 `visualDirection`、`selectedTheme`、`colorStrategy` 和 `navigationStyle`。

## 阶段二：完成页面视觉应用

规划准备补齐视觉方向后，CLI 已将基础主题、主题色和导航样式预填为标准 Plan 输入，并通过主题模板补齐页面通用视觉。普通首版不再启动独立视觉模型任务；存在品牌稿、参考图、页面级特殊风格或用户明确要求视觉精修时，才在业务页面确定后执行本阶段，补充项目差异。

1. 读取 CLI 返回的 `authoring-context.md` 与紧凑计划契约，补齐页面视觉应用和素材策略。完整主题由 CLI 注入；具体组件需要定制时再读取模板对应章节。
2. 主题按 [基础变量契约](templates/design-themes/basic-tokens.json) 生成，组件直接引用基础变量；字体、间距和 Tooltip 配色采用固定值。用户明确的项目定制写入 `visualStyle.tokens`，主色写入 `forUser.colorStrategy.primaryColor`。
3. 沿用草稿中的 pageId 与 sceneKey，逐页匹配实际任务和区块；默认设计引用由 CLI 生成和校验。

用户选择整体暗色或黑色主题时，按 [暗色主题浮层适配](../../references/theme/theme-token-presets.md#暗色主题浮层适配) 补齐 `visualStyle.tokens`；导航明暗保持独立。

需要精修时一次更新完整 `visual.json`，避免先提交基础视觉、再提交 `pageApplications` 形成两段等待。仅超大需求需要中间展示时才按 [按模块更新方案](../../../yida-app/workflow/incremental-preview.md) 提交。主流程负责生成完整方案、展示和确认，主题 CSS 使用 CLI 返回的 `outputs.theme`。
