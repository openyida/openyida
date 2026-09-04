# Step 2：确定范围、导航与视觉方向

本步骤由 `yida-app` 组织必要确认，把回答交回对应技能。先确定应用范围与导航类型，再选择视觉方向，随后同时准备业务规划与基础视觉。

## 1. 确定范围与导航

接收 `yida-requirement-analysis` 输出的 brief，按 [需求澄清与导航决策](../../../yida-requirement-analysis/workflow/prepare-brief.md) 处理未决项。范围与导航都不明确时可合并询问；已有明确选择时直接复用。

导航问题给出平台L型导航、平台顶部导航、平台侧边导航、自定义导航四种选项，按此固定顺序展示，只说明各类型的布局与行为，不标记推荐或默认，也不预选。自定义导航的选项说明须包含“使用自绘导航，并隐藏应用和各页面的平台导航”。交互文案与工具回退遵守 [用户交互契约](../../../yida-design/references/ask-human-interaction-contract.md)。

需求分析技能将回答更新到 brief，确保 `navigation.type/source/reason` 完整。用户明确授权代为决定或不再提问时，按需求分析规则记录选择及依据。

## 2. 选择视觉方向

范围与导航确定后，调用 [Plan 视觉分支](../../../yida-design/sub_skill/yida-design-plan/SKILL.md) 生成三套候选，遵守 [视觉方向选择规则](../../../yida-design/sub_skill/yida-design-plan/references/visual-theme-selection.md)。候选沿用已确定的导航类型，围绕色彩、材质、组件和导航明暗提供选择。

已有完整视觉要求时直接采用；用户要求推荐方案时使用推荐方向。需要询问时等待回复，视觉技能将选择一致地写入 `visualDirection`、`selectedTheme`、`colorStrategy`、`navigationStyle`。

## 3. 同时交接业务与视觉

将同一 brief 与已选视觉同时交给 `yida-prd` 和 `yida-design`。PRD 将 `navigation.type` 写入 `execution.appConfig.navigationType`，规划业务资源、页面、入口和导航顺序；视觉技能同步准备基础主题、token 和素材策略，收到稳定的页面任务、区块和 sceneKey 后补齐逐页视觉应用。业务与视觉分别返回事实片段，由编排统一写入计划。
