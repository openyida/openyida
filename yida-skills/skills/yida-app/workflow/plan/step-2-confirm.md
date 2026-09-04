# Step 2：确认应用范围与视觉方向

本步骤由 `yida-app` 统一呈现问题，并把回答交回对应技能。计划生成前原则上只确认一次，最多包含两个逻辑问题。

## 准备输入

1. 接收 `yida-requirement-analysis` 输出的共享 brief 和范围问题；来源不可读时先交回该技能处理。
2. 调用 [Plan 视觉分支](../../../yida-design/sub_skill/yida-design-plan/SKILL.md)，基于 brief 生成三套视觉候选。候选字段、差异要求、主题匹配和加载规则统一见 [视觉方向选择](../../../yida-design/sub_skill/yida-design-plan/references/visual-theme-selection.md)。

## 统一呈现

| 当前情况 | 本次交互 |
| --- | --- |
| 范围有待确认 | 同时呈现范围问题与视觉候选 |
| 范围已明确 | 只选择视觉方向 |
| 已指定完整视觉方向或明确继承可信品牌/模板 | 直接采用该方向，只处理未决范围问题 |
| 用户要求采用推荐方案或不再提问 | 使用推荐方向，记录 `source=ai_inferred`；范围缺口按需求分析的澄清规则处理 |

视觉选项向用户展示名称、体验说明和推荐原因，第一项为推荐项。具体提问与工具回退按 [用户交互契约](../../../yida-design/references/ask-human-interaction-contract.md) 执行；需要回答时等待用户回复再继续。

## 写回并交接

- 需求回答交给 `yida-requirement-analysis` 更新 brief。
- 视觉回答交给 `yida-design`，一致地写入 `visualDirection`、`selectedTheme`、`colorStrategy`、`navigationStyle`。最终计划只保存选中方向。
- 范围变化时，视觉技能按最终范围复核主题绑定；保留用户所选方向。自定义方向缺少可用模板时，按视觉方向选择规则处理。

完成后，`yida-prd` 基于确认范围规划业务；视觉技能在页面规划完成后补齐逐页视觉应用。
