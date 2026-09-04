# Step 2：选择搭建方式并生成设计

## 2.0 选择 Fast / Plan

先执行 [设计模式路由](../../yida-design/references/design-mode.md)，本轮只选择一次。

首次搭建（无 `appType`，或已有 `appType` 但无页面）也必须执行此步骤。用户尚未为本次搭建选择方式时，仅展示“Plan（先确认方案） / Fast（直接搭建）”并等待回答，再继续规划。

- Fast：继续下方 2.1–2.3，沿用独立需求分析、PRD 与视觉设计。
- Plan：执行 [Plan 编排](plan/workflow.md)；确认当前版本后校验派生的 `prd.md` 与 `design.md`，完成主题文件交接后进入 Step 3。

Plan 交接同样需要资源蓝图、资源创建顺序、页面实现交付顺序、导航顺序和页面 handoff。缺失时回写计划并重新生成，业务事实交给 `yida-prd`、视觉事实交给 `yida-design` 更新，不直接覆盖派生文件；事实变化后重新确认。

## Fast 流程

先整理一次用户需求，再同时生成 PRD 和视觉设计。`yida-app` 负责检查两份结果，不直接代写。

## 2.1 整理用户需求

执行 `use_skill("yida-requirement-analysis", "整理完整应用的用户需求")`，写入：

- `.cache/openyida/<项目名>/requirement-brief.json`

文件存在、可解析且没有会改变资源范围的未决问题后，才开始生成 PRD 和视觉设计。

`requirement-brief.json`、PRD 和视觉设计都是搭建流程的内部文件，不作为用户交付物；不得为这三个文件调用宿主的用户可见附件或交付工具。

需求文件校验通过后，在本轮搭建中保持不变。后续资源创建产生的 `appType`、`formUuid`、`fieldId` 等真实 ID 只写入 schema 或当前任务资源上下文，不回写该文件，也不因此重新生成 PRD 和视觉设计；只有用户需求或已确认资源范围发生实质变化时，才重新整理需求并生成两份结果。

## 2.2 同时生成 PRD 和视觉设计

需求文件校验通过后，同时启动：

| 内容 | 负责技能 | 输出 | 完成条件 |
| --- | --- | --- | --- |
| Product PRD | `yida-prd` | `prd/<项目名>/prd.md` | 资源蓝图、资源创建顺序、页面实现交付顺序、导航顺序、页面 handoff 和验收标准完整 |
| Visual Design | `yida-design` | `prd/<项目名>/design.md` | 主题 token、视觉 DNA、布局、材质、圆角、密度、组件、状态、响应式和页面场景引用完整 |

两个技能读取同一份需求文件，互不等待，也不修改对方的文件。某一份生成失败时只重跑对应技能，不覆盖已经完成的另一份。

## 2.3 校验两份结果

`yida-app` 必须等待两个文件都生成完成，再执行一致性校验：

- 两个文件路径存在且非空；
- PRD 每个 display 页面的 `designFile` 指向当前 `design.md`；
- PRD 的 `designRefs` 在 `design.md` 中可定位；
- 页面场景、主题摘要和 `explicitScope` 没有冲突；
- 冲突时业务范围交给 `yida-prd` 修正，视觉规则交给 `yida-design` 修正，不由 `yida-app` 猜测覆盖。

校验未通过时 Step 2 未完成，不得进入资源创建。校验通过后，后续页面实现以 `prd.md` 和 `design.md` 为准；`page-spec.json` 只用于把要求传给页面实现阶段。

## 主题文件实现指令

Step 2 只在 `design.md` 中确定主题色、`navTheme`、`logoSource` 和 `layoutDirection`，不传递平台 `--theme` key。进入 Step 3 后：

1. 执行复制命令：

   ```bash
   openyida sample yida-design app-theme --output .cache/openyida/<项目名>/app-theme.css --design-file prd/<项目名>/design.md
   ```

2. CLI 按 `design.md` 定点替换复制文件中的对应 token，保留公共模板的其他规则和作用域。
3. 主色写入 `--color-brand1-6`；保留 `--color-brand1-1/2/3/5/6/9/10`、`--color-brand-1` 至 `--color-brand-4` 和 `--color-group`；严禁补造 `--color-brand1-4/7/8`。
4. 创建应用时传入 `--theme-file`、`--nav-theme`、`--logo-source` 和 `--layout`，在应用级统一配置主题。平台统一作用于原生表单、详情页和自定义页面外层；`YidaCodeCanvas` 页面只在组件内部消费主题 token，严禁向上层注入或同步主题样式。

## 产出

进入 Step 3 前，必须确认：

- `prd.md` 和 `design.md` 路径存在；
- 若选择 Plan Design，`meta.planState` 已确认当前最新搭建计划版本；
- PRD 写明资源创建顺序、页面实现交付顺序、导航顺序或明确兜底策略；
- PRD 写明业务表单、流程表单、主页面和可选报表/大屏/权限等资源蓝图；
- `design.md` 能直接指导后续页面实现，不需要页面技能再反推视觉方向。

## 下一步

→ [Step 3：创建或复用应用](step-3-create-or-reuse-app.md)
