# Plan：生成方案并确认

由 `yida-app` 在 Step 2 选择 Plan 后进入。需求与选择明确后并行准备业务和视觉事实，统一生成产物；确认当前方案后进入资源创建。

## 执行顺序

| 阶段 | 负责技能与入口 | 输入与输出 |
| --- | --- | --- |
| 1. 整理需求 | `yida-requirement-analysis`，见 [整理需求](step-1-understand.md) | 用户来源与资源上下文 → 共享 `requirement-brief.json`、范围问题 |
| 2. 确定范围、导航与视觉 | `yida-app`，见 [统一确认](step-2-confirm.md) | 先确定范围与应用导航，再选视觉 → 导航决策明确的需求与视觉选择 |
| 3. 同时准备业务与视觉 | `yida-prd` 与 `yida-design` | 同一需求、导航和视觉选择 → 业务规划与基础视觉；页面任务、区块和 sceneKey 确定后补齐逐页视觉绑定 |
| 4. 一次生成并确认 | `yida-app`，见 [生成与确认](step-4-deliver.md) | 合并后的业务与视觉事实 → 同版本三份产物及用户确认 |

`yida-app` 按 [紧凑计划契约](../../../yida-design/sub_skill/yida-design-plan/references/build-plan-compact-schema.md) 初始化 `schemaVersion=2.0` 和版本状态。业务字段由 `yida-prd` 维护，`visualStyle` 由 `yida-design` 维护；编排负责交接校验、物化、展示和确认。

业务与视觉各自返回职责范围内的事实片段，由编排统一写入 `build-plan.json`。基础主题、token、素材策略与业务规划并行；页面任务、区块和 sceneKey 确定后完成逐页视觉绑定。页面变化时只更新受影响的绑定。宿主不支持并行时按此依赖推进，同样只生成一次最终产物。

## 产物与交接

全部产物位于 `prd/<项目名>/`：

```text
build-plan.json（业务和视觉的源事实）
  ├─ prd.md（业务与搭建执行契约）
  ├─ design.md（视觉契约）
  └─ build-plan.html（用户确认视图）
```

CLI 一次读取同一版本的事实，套用预置模板，整批生成三份派生产物。调整由对应技能更新源事实，再由编排重新生成并确认，具体命令与版本条件见 [生成与确认](step-4-deliver.md)。

用户交互按 [可见表达契约](../../../yida-design/references/ask-human-interaction-contract.md) 执行。当前展示版本确认后，将 `prd.md` 和 `design.md` 交给应用主流程 Step 3。
