---
name: yida-design-plan
description: Plan 模式的视觉设计分支。基于需求选择视觉方向，再结合业务页面规划维护 build-plan.json 的 visualStyle，供 CLI 派生 design.md。
---

# Plan 视觉设计

负责 Plan 的视觉候选与页面视觉应用。选型遵守 [共享主题规则](../../references/theme-selection.md)，与 Fast 和单页共用上层主题库。首轮仅保留整体风格或可调整建议，主题映射在规划准备补齐；需求确认后由 [Plan 流程](../../../yida-app/workflow/plan/workflow.md) 启动页面视觉设计。

已有方案的配色、布局或页面设计调整，直接按 [局部调整](../../../yida-app/workflow/plan/step-4-deliver.md#4-处理调整) 修改相关视觉字段，跳过下面的首版流程。

## 阶段一：提供视觉候选

输入为共享的 `.cache/openyida/<项目名>/requirement-brief.json`。

已有明确的完整视觉方向时直接采用；无明确偏好且不影响业务范围时，由 AI 按[设计方向比较](../../references/theme-selection.md#设计方向比较)完成一次内部比较，选定方向并记录依据；保持原有首轮提问范围。用户明确要求比较或选择风格时，按 [视觉方向选择](references/visual-theme-selection.md) 准备两个具体方向和一个独立的自由创意选项，交给 `yida-app` 统一呈现。用户确认主题前只读主题索引中的精简风格摘要，不读取候选模板全文；确认后写入一致的 `visualDirection`、`selectedTheme`、`colorStrategy` 和 `navigationStyle`，模板路径再读取选中的一份完整模板；自由创意按业务独立编写设计决策和 Token，不要求匹配模板。

## 阶段二：完成页面视觉应用

规划准备补齐视觉方向后，CLI 将基础主题、主题色和导航样式预填为标准 Plan 输入；模型仍须在业务页面确定后完成每个真实自定义页的具体视觉决定。按 CLI 返回的任务补齐，可以在同一轮业务规划中完成；两个片段分别保存。

1. 读取 CLI 返回的 `authoring-context.md` 与 [紧凑计划契约](references/build-plan-compact-schema.md)，沿用 pageId 和 sceneKey。
2. 为每个真实自定义页填写 `firstScreenFocus`、`layout`、`primaryAction`、`responsive` 与 `acceptanceChecks`；前四项为具体非空说明，验收为非空字符串数组。公共主题不能代替这些决定。纯原生表单应用不增加虚构页记录。
3. 按实际内容补 `visualMemoryApplications`、页面局部差异与素材策略。完整主题由 CLI 注入，复杂组件定制时再读模板对应章节。
4. 全局和局部 token 遵守 [基础变量契约](../../templates/design-themes/basic-tokens.json)，明确项目差异写 `visualStyle.tokens`，主色写 `forUser.colorStrategy.primaryColor`；沿用主题的字号、间距和组件圆角。
5. CLI 按 [公共输出契约](../../workflow/output-design.md) 生成 frontmatter、anchor 索引和五章正文，并调用同一 `check-design` 校验。缺少逐页决定时只保留可预览草稿，补齐后再生成最终产物；旧计划同样不得以继承主题套话补过门槛。

用户选择整体暗色或黑色主题时，按 [暗色主题浮层适配](../../references/theme/theme-token-presets.md#暗色主题浮层适配) 补齐 `visualStyle.tokens`；导航明暗保持独立。

首版提交前，将基础视觉与 `pageApplications` 一次补齐到已有 `visual.json`。仅超大需求需要中间展示时才按 [按模块更新方案](../../../yida-app/workflow/incremental-preview.md) 提交。主流程负责生成方案、展示和确认，主题 CSS 使用 CLI 返回的 `outputs.theme`。
