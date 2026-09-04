# Plan：生成方案并确认

由 `yida-app` 在 Step 2 选择 Plan 后进入。按顺序调用下列技能，确认当前方案后进入资源创建。

## 执行顺序

| 阶段 | 负责技能与入口 | 输入与输出 |
| --- | --- | --- |
| 1. 整理需求 | `yida-requirement-analysis`，见 [整理需求](step-1-understand.md) | 用户来源与资源上下文 → 共享 `requirement-brief.json`、范围问题 |
| 2. 确认范围与视觉 | `yida-app`，见 [统一确认](step-2-confirm.md) | 需求分析的范围问题、视觉技能的候选 → 已确认需求与视觉选择 |
| 3. 规划业务 | `yida-prd`，见 [Plan 业务规划](../../../yida-prd/workflow/plan-business.md) | 已确认需求 → 业务、数据、流程、页面和执行顺序 |
| 4. 完成视觉并交付 | `yida-design` 补齐视觉，`yida-app` 执行 [生成与确认](step-4-deliver.md) | 业务页面与视觉选择 → 同版本产物及用户确认 |

`yida-app` 按 [紧凑计划契约](../../../yida-design/sub_skill/yida-design-plan/references/build-plan-compact-schema.md) 初始化 `schemaVersion=2.0` 和版本状态。业务字段由 `yida-prd` 维护，`visualStyle` 由 `yida-design` 维护；编排负责交接校验、物化、展示和确认。

## 产物与交接

全部产物位于 `prd/<项目名>/`：

```text
build-plan.json（业务和视觉的源事实）
  ├─ prd.md（业务与搭建执行契约）
  ├─ design.md（视觉契约）
  └─ build-plan.html（用户确认视图）
```

CLI 从同一版本生成三份派生产物。调整由对应技能更新源事实，再由编排重新生成并确认，具体命令与版本条件见 [生成与确认](step-4-deliver.md)。

用户交互按 [可见表达契约](../../../yida-design/references/ask-human-interaction-contract.md) 执行。当前展示版本确认后，将 `prd.md` 和 `design.md` 交给应用主流程 Step 3。
