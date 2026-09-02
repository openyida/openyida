---
name: yida-page-design
description: 宜搭单页设计子流程。用于已有应用里的单个自定义页面美化、页面重构、视觉升级、表单入口体验优化和主题证据读取。
---

# page-design

单页设计子流程。用于已有自定义页面的美化或设计：页面美化、视觉升级、官网首页、列表、看板、大屏、详情、工作台和表单入口体验优化。

## Step 1：读取应用主题与功能契约

单页设计和页面重构先确认当前应用主题，同时记录现有功能契约。页面美感提升默认属于 UI-only 改造：调整布局、密度、间距、视觉层级、素材和图标表达，业务功能保持原样；页面使用运行容器加载的应用主题。

| 证据来源 | 读取内容 | 写入 PRD |
| --- | --- | --- |
| 用户给出的应用 URL、`appType`、页面 URL、resource context | 目标应用、目标页面、页面所处业务上下文 | `appType`、`pageFormUuid`、`themeEvidence.source` |
| `project/config.json`、`.cache/<项目名>-schema.json`、`.openyida-page.json` | 已记录的 app/page/form、themeProfile、页面视觉摘要 | `themeEvidence.source=workspace` |
| 本轮或历史命令输出中的 `colour`、`themeColor`、`navTheme`、`customThemeStyle.cssUrl` | 当前应用主题 key/主色、导航明暗、应用主题文件 | `currentAppTheme` |
| 已有 Page Spec / 页面源码中的 `themeProfile`、应用主题消费方式 | 页面正在消费的应用主题 token | `currentPageTheme` |
| 已有 Page Spec / 页面源码 / 用户描述中的按钮、筛选、数据源、表单入口、跳转、权限、状态 | 当前页面功能契约和业务动作 | `functionContract` |

主题证据齐全时，页面重构、局部美化、列表/看板/详情优化沿用当前应用 `colour` / `themeColor`。主题证据缺失时，记录 `themeEvidence.status=missing`，根据行业、品牌、业务情绪和视觉目标选择平台预置主题或生成应用自定义主题文件，不固定回到 `podBlue` / #1677ff，也不套用行业刻板配色。用户给出新品牌色或要求完全不同风格时，将主题变更交给应用级主题配置，由运行容器在各页面上下文加载。

## 完整步骤

| 步骤 | 复用文件 | 单页执行重点 |
| --- | --- | --- |
| 1 | 本文件：读取应用主题与功能契约 | 获取 `currentAppTheme`、`currentPageTheme`、`themeEvidence`、`functionContract` |
| 2 | [分析需求和资源](../../workflow/step-1-positioning.md) | 聚焦当前页面的用户、任务、业务对象和 UI-only 改造目标 |
| 3 | [选择主题色和 token](../../workflow/step-2-theme-system.md) | 基于 Step 1 的应用主题；需要换色时生成或更新应用主题文件 |
| 4 | [规划页面和导航](../../workflow/step-3-information-architecture.md) | 只补当前页与平台导航、上游入口、下钻页面、原生表单/流程的关系 |
| 5 | [页面结构和交互设计](../../workflow/step-4-wireframe-interaction.md) | 明确布局骨架、主操作、详情抽屉、表单提交入口和 PC/移动端差异 |
| 6 | [UI 视觉和状态设计](../../workflow/step-5-visual-states.md) | 细化当前页视觉、素材、图标、空态、加载态、错误态和业务化自检 |
| 7 | [写入 prd.md 和 design.md](../../workflow/step-6-handoff.md) | 输出单页 PRD 章节，交给 `yida-canvas-custom-page` 实现 |

## 主题决策口径

- 当前应用主题清楚：`themeDecision=follow-app` 或 `page-enhance`，`themeProfile.name` 使用当前应用主题 key，`themeColorSource=application-theme`，页面按业务需要调整构图、密度、素材和辅助视觉。
- 当前页面存在历史页面级主题 token：将其主色和语义变量迁移到应用主题文件，再由运行容器统一加载。
- 页面重构/局部美化：以当前应用主题为基准，使用运行容器加载的品牌色阶和语义变量。
- 页面美感提升/改 UI：`functionContract` 保持稳定，现有数据源、字段映射、按钮动作、筛选逻辑、提交 URL、权限和业务状态按原有实现交付。
- 用户明确要很不一样、独立品牌页、活动页、沉浸页或应用导航隐藏后的自绘壳：通过布局、材质、素材和构图实现差异；需要换主色时生成应用主题 CSS 并配置 `themeColor` 和 `navTheme`。
- 用户明确要全应用换肤：将诉求回到 `yida-design` 的主题色和 token 分支，输出应用主题 CSS、`themeColor` 和 `navTheme`。
- 单页只做局部美化：保持平台导航和应用主题稳定，直接使用运行容器加载的主题变量。

## 输出补充字段

在 [PRD 输出格式](../../workflow/output-prd.md) 和 [design.md 输出格式](../../workflow/output-design.md) 基础上补充：

```markdown
- themeEvidence：<source/status/currentAppTheme/currentPageTheme>
- currentAppTheme：<colour/navTheme/config.COLOUR 或 missing>
- currentPageTheme：<themeProfile/customThemeStyle.cssUrl 或 missing>
- themeDecision：<follow-app / page-enhance / app-theme-update>
- functionContract：<保留的数据源/字段映射/按钮动作/筛选逻辑/提交 URL/权限/状态>
- changeScope：<UI-only：颜色/布局/密度/间距/视觉层级/素材/图标>
```
