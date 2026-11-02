---
name: yida-design-plan
description: Plan 模式的视觉设计分支。基于需求选择视觉方向，再结合业务页面规划维护 build-plan.json 的 visualStyle，供 CLI 派生 design.md。
---

# Plan 视觉设计

负责 Plan 的视觉候选与页面视觉应用。选型遵守 [共享主题规则](../../references/theme-selection.md)，与 Fast 和单页共用上层主题库。首轮仅保留整体风格或可调整建议，主题映射在规划准备补齐；需求确认后由 [Plan 流程](../../../yida-app/workflow/plan/workflow.md) 启动页面视觉设计。

已有方案的配色、布局或页面设计调整，直接按 [局部调整](../../../yida-app/workflow/plan/step-4-deliver.md#4-处理调整) 修改相关视觉字段，跳过下面的首版流程。

## 阶段一：识别意向并确定视觉方向

输入为共享的 `.cache/openyida/<项目名>/requirement-brief.json`。

先按[已选风格只确认一次](../../references/theme-selection.md#已选风格只确认一次)读取原始需求、最新补充、视觉参考与已保存选择。已有风格意向直接推演；参考网站或设计图按[视觉 DNA 提取](../../references/reference-visual-dna.md)实际读取后生成设计与 CSS，不再询问主题风格。缺少主题 ID 或设计细节由 AI 补齐。

用户显式要求“预览效果辅助风格选择”时，先匹配 catalog 中的模板原图，以对话内 HTML 卡片与 `ask_human` 同轮展示；该请求优先于 Fast 内部选型，不能只返回链接或替用户选定。仅查看效果不重新提问。

仅在没有风格意向、视觉参考或可复用选择时，按[设计方向比较](../../references/theme-selection.md#设计方向比较)生成恰好三套完整方向（两个模板方向和一个独立自由创意选项），并按[视觉方向选择](references/visual-theme-selection.md)交给 `yida-app` 按[宿主展示规则](../../references/theme-selection.md#选择时展示名称与效果图)统一呈现（所有环境使用 `ask_human`，用户明确要求时将效果 HTML 卡片与该选择同轮展示）；用户已委托 AI 决定时内部选定，不反问。候选阶段只读主题索引中的精简风格摘要，不读取候选模板全文；直接推演或获得选择后写入一致的 `visualDirection`、`selectedTheme`、`colorStrategy` 和导航结构，再读取选中的一份完整模板；模板方向的导航明暗由模板 `navTheme` 派生；自由创意按业务独立编写设计决策、导航明暗和 Token，不要求匹配模板。

## 阶段二：完成页面视觉应用

规划准备补齐视觉方向后，CLI 将基础主题、主题色和导航样式预填为标准 Plan 输入；模型仍须在业务页面确定后完成每个真实自定义页的具体视觉决定。按 CLI 返回的任务补齐，可以在同一轮业务规划中完成；两个片段分别保存。

1. 读取 CLI 返回的 `authoring-context.md` 与 [紧凑计划契约](references/build-plan-compact-schema.md)，沿用 pageId 和 sceneKey。
2. 工作台沿用 PRD 的业务内容和表现建议。为每个真实自定义页填写 `firstScreenFocus`、`layout`、`primaryAction`、`responsive` 与 `acceptanceChecks`；前四项为具体非空说明，验收为非空字符串数组。公共主题不能代替这些决定。纯原生表单应用不增加虚构页记录。
   按[响应式决策与字段映射](../../references/responsive-layout.md#写入已有设计字段)在这五个字段内写清：宽屏、窄容器和触屏各展示什么、怎样操作、何时重排、保留哪些状态，以及选择依据。Fast 与单页设计写入相同的 `design.md` 要点。
3. 按 [整体主题规则](../../references/application-theme-consistency.md#导航与应用框架) 核对导航、应用框架、原生表单、记录详情与自定义页面的配色、形状、文字、间距和状态。每项必须保留 `visualMemoryApplications` 数组；没有匹配的主题记忆点时填写 `[]`，不要省略或写成字符串。按实际内容补页面局部差异与素材策略。完整主题由 CLI 注入，复杂组件定制时再读模板对应章节。
4. 全局和局部 token 遵守 [基础变量契约](../../templates/design-themes/basic-tokens.json)，明确项目差异写 `visualStyle.tokens`，主色写 `forUser.colorStrategy.primaryColor`；沿用主题的字号、间距和组件圆角。
5. CLI 按 [公共输出契约](../../workflow/output-design.md) 生成 frontmatter、anchor 索引和五章正文，并调用同一 `check-design` 校验。缺少逐页决定时只保留可预览草稿，补齐后再生成最终产物；旧计划同样不得以继承主题套话补过门槛。

逐页按 [阅读无障碍门禁](../../references/page-quality-gates.md#阅读无障碍门禁) 将实际要求写入已有 `layout`、`responsive` 和 `acceptanceChecks`，覆盖文字可读、放大重排及完整信息获取；不新增重复字段，不将 CLI 校验通过视为读屏或真实页面验收通过。

用户选择整体暗色或黑色主题时，按 [暗色主题浮层适配](../../references/theme/theme-token-presets.md#暗色主题浮层适配) 补齐 `visualStyle.tokens`；内容界面明暗与导航明暗分别描述，导航明暗仍由所选主题模板确定。

首版提交前，将基础视觉与 `pageApplications` 一次补齐到已有 `visual.json`。仅超大需求需要中间展示时才按 [按模块更新方案](../../../yida-app/workflow/incremental-preview.md) 提交。主流程负责生成方案、展示和确认，主题 CSS 使用 CLI 返回的 `outputs.theme`。

## 校验失败时定点修复

遇到 `DESIGN_PLAN_PAGE_BINDINGS_REQUIRED` 时，保留现有计划和预览，按以下顺序修复：

1. **定位**：读取错误 `details.issues` 中每项的 `sourcePath`、`path` 和 `code`，修改对应源文件。若问题来自 `business.json`，先按已确认需求修正页面事实，再核对视觉绑定。
2. **修改**：以 `business.json` 的 `facts.pages.customPageDetails` 为准，让 `visual.json` 的 `facts.visualStyle.forUser.pageApplications` 与自定义页一一对应；原生表单和数据模型不加入。按 `missing_page` 补项、`unexpected_page` 移除多余绑定、`duplicate_page` 合并重复项；按 `expected_array`、`expected_object`、`expected_nonempty_string` 修正指定字段。每项 `visualMemoryApplications` 必须为数组，无适用内容填 `[]`。
3. **回读并重试**：确认修改已写入源文件，再重试原 `materialize` 命令。写入失败、跳过或结果未知时，先回读核实，不能仅凭发起过工具调用认定修复完成。

修复仅涉及错误字段，保留 `build-plan.json`、`business.json`、`visual.json` 和已有预览；不因字段校验失败删除目录、重新 `init`、重写整份 PRD 或扩大需求范围。

本地校验失败统一按[本地校验修复](../../../../references/source-repair.md)处理：先修正并回读源文件，未变化不重跑，连续两次修复无进展时保留产物并报告阻塞。
