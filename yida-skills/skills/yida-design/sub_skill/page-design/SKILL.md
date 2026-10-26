---
name: yida-page-design
description: 宜搭单页设计子流程。用于已有应用里新增单个自定义页面、页面美化、重构、视觉升级和主题范围确认。
---

# page-design

已有应用单独新增自定义页也先形成页面设计说明，再交给页面开发；不要求完整应用规划。已有页面美化先由 [ui-improve](../ui-improve/SKILL.md) 确认方案、备份并限定业务保留范围，再使用本流程。

## Step 1：读取应用主题与功能契约

单页设计和页面重构先确认当前应用主题，记录目标 app/page 与现有功能。

- 从 `project/config.json`、`.cache/<项目名>-schema.json`、`.openyida-page.json` 读取资源与设计记录；核对页面 `themeProfile`、应用主题消费方式。
- 用 `openyida app-theme snapshot <appType> --output-dir <新的本地目录> --json` 核对应用身份、主色、导航及服务端主题能力；`appThemeEnable=y` 且 `appThemeMode=modern` 为新版，`n` 或 `legacy` 为旧版，其余为未知。不凭版本或存储的主题名推断。
- 保留数据源、字段、事件、筛选、提交/详情入口、权限和业务状态，写入 `functionContract`。页面美感提升/改 UI：`functionContract` 保持稳定。
- 页面重构/局部美化：以当前应用主题为基准。证据缺失记为 `themeEvidence.status=missing`，先只读核对能力，不因缺失自动上传主题。

新版主题应用的自定义页必须遵循应用层风格和主题，复用其 `design.md`、配色和组件规则；页面可调整布局与信息层级，不提供脱离应用主题的选项。需要换风格时走应用级设计。

## 旧主题应用新增页面的风格范围

用户已明确沿用应用风格或仅本页独立设计时直接复用。没有明确方向时，通过 `ask_human` 确认一次：“新增页面沿用现有应用风格，还是保留现有导航和其他页面，仅把新增页设计得更现代、更独立？”能力未知时先说明未知，仍保留应用配置。等待答复可核对业务与数据，不实施依赖选择的样式。

- **沿用应用**：`themeDecision=follow-app`，使用已验证的应用变量；按页面任务设计布局、层级和密度。
- **仅本页独立**：`themeDecision=page-enhance`，将局部颜色、字体、表面、圆角、密度和状态写入当前页设计。变量使用页面命名空间，声明与选择器均限定到本页根容器；控件和浮层也检查实际作用域。保留导航、其他页面和主题模式，不改 `:root`、`html`、`body`、父容器或应用主题变量，不将局部变量提升到应用层。

页面独立风格的选择不包含隐藏导航、主题升级或全应用换肤。不写 `customThemeStyle`；确需应用层覆盖时另按 [旧主题注入规则](../../references/application-style-library.md#旧主题应用的样式作用域与确认) 核查并取得该范围确认。不能将整份应用 CSS 包入页面根节点冒充局部实现。

## 设计与交接

读取当前 `design.md`；旧主题需要选风格时按 [共享主题选择规则](../../references/theme-selection.md) 复用目录，不另建主题库。旧主题独立页不执行应用主题同步。

| 步骤 | 复用文件 | 单页执行重点 |
| --- | --- | --- |
| 1 | 本文件：读取应用主题与功能契约 | 获取 `currentAppTheme`、`currentPageTheme`、`themeEvidence`、`functionContract` |
| 2 | [需求](../../workflow/step-1-read-brief.md) | 当前页用户、任务与业务范围 |
| 3 | [选择主题色和 token](../../workflow/step-2-theme-system.md) | 按已确认范围设计；独立页面仅交付局部样式 |
| 4 | [结构与交互](../../workflow/step-4-wireframe-interaction.md) | 首屏焦点、布局、主操作、入口和响应式 |
| 5 | [视觉与状态](../../workflow/step-5-visual-states.md) | 卡片密度、层级、图标、加载/空/错状态 |
| 6 | [设计交接](../../workflow/step-6-handoff.md) | 写当前页设计，交给 `yida-canvas-custom-page` 实现；业务变化交回 PRD |

按 [输出格式](../../workflow/output-design.md) 补充 `themeEvidence`、`currentAppTheme`、`currentPageTheme`、`themeDecision`、`functionContract`、`changeScope`，并在当前页正文记录用户选择及来源、根选择器、变量/浮层作用域和保留范围。沿用应用时颜色来源为 `application-theme`；独立页面按实际设计记录来源，不据此更新应用主色。

两种选择均需设计及视觉验收，覆盖焦点、密度、状态、响应式和真实入口；数据或跳转通过不能代替视觉验收。
