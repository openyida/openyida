# Fast 设计文档生成

Fast 完整应用改用 [直接创建与独立主题](../../yida-app/workflow/fast-build.md)，不生成独立 design.md。本文的短视觉字段仍共用；下方 document 命令仅用于单独要求设计文档或已有文档任务。


单独生成设计文档并采用已有主题时，提供项目设计决策，CLI 生成完整 token、五章正文、组件与状态索引、页面 anchor 和八项要点，并执行 `check-design` 校验。已有有效 `design.md` 时继续局部修改。

1. 已有明确主题 ID 时直接复用；需要选型时读取一次 `openyida design-plan catalog --compact`。JSON 的主题数组为 `themes`，唯一标识为 `themeId`；不使用 `head`/`tail` 截断后反复查询。用户要查看完整风格说明时才读取完整 catalog；预览仍需用户明确要求。
2. `openyida sample yida-design fast-spec --output .cache/fast-design.json` 提取输入示例。用本次业务替换示例内容；页面、字段、权限和素材范围沿用已确认需求与 PRD。
3. `openyida sample yida-design document --spec-file .cache/fast-design.json --output prd/<项目名>/design.md` 生成并校验，返回稳定引用和后续 CLI argv。输出已存在时保留原文档，按当前需求局部编辑。
4. 与 PRD 合并时执行一次 `openyida check-design prd/<项目名>/design.md --prd prd/<项目名>/prd.md --json`；页面 `pageId`、`sceneKey` 和 `designRefs` 沿用生成结果。主题 CSS 按返回的 `nextThemeArgv` 生成，可与应用创建及页面源码准备同时推进。

## 输入

必填顶层字段为 `name`、`themeId`、`primaryColor`、`direction: {label, description}`、`navigation: {structure: "top"|"side"}`、`pages` 和 `assetStrategy: {pages: [...]}`。主色用实际 HEX 值；导航支持范围与明暗沿用所选主题，不把导航深色当成内容暗色。

每个物理自定义页写一条 `pages` 记录。必填：

- `pageId`、`name`、`sceneKey`、`primaryTask`：稳定页面身份、场景与用户任务。
- `blocks`：具体业务区块的非空字符串数组。
- `firstScreenFocus`、`layout`、`surface`、`primaryAction`、`states`、`responsive`：本页的具体设计决策。
- `acceptanceChecks`：检查动作和预期结果的非空字符串数组；设计时不声明实际验收已通过。

一个自定义页承载多个已规划视图时，将各视图写入其 blocks/layout/primaryAction，不把同一个 pageId 重复登记为多个物理页。明确要求独立页面或独立地址时分别创建页面记录。

可选字段：顶层 `summary`、`colorSource`、`appConfig`、`tokens`、`iconSystem`、`creativeDirection`；页面 `density`、`entryMode` 与 `navigation` 沿用 PRD 的既有契约。默认不隐藏应用导航；独立前台的页面级隐藏与自身菜单按入口规划实施。自由创意仍需完整自主设计决策与 token，不以示例主题代替用户的视觉要求。

选择 app-pop 时必须有实际的波普指定或展示型任务依据，并在输入写 `popArtContext: "explicit-request"` 或 `"showcase"`；普通官网、看板或“全部风格”不自动满足该条件。

素材按已实现契约填写 `pageId/imageNeed/reason/slots`；槽位用 `slotId/usage/minSize/required`，与页面身份对应。AI 生成素材落地时显式传 `--source generated`，用户提供传 `--source user`，图库搜索传 `--source search`；不根据文件名推断来源。素材不阻塞首版预览，时间预算与回执规则沿用 yida-image-assets。

PRD 的数据保存、角色、审批和服务端权限要求继续完整实施；该命令只生成视觉契约，不创建业务资源，也不提供权限实现。
