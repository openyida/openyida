# 写入 design.md

本步骤只写入 `prd/<项目名>/design.md`。完整应用的 `prd.md` 由同时运行的 `yida-prd` 生成；本技能不得等待、读取或覆盖本轮 PRD。

## 必填内容

- frontmatter：version、design_id、themeProfile、tokens、visual_dna、scenes、density、layout、tone；
- 设计风格选择依据、主题色与换肤结果、视觉 DNA；
- `visualScaffold`、`backgroundLayer`、`surfaceMaterial`、`surfaceContrast`；
- `colorRoles`、`depthRule`、`roundedRule`、`densityRule`、`breathingRule`；
- 组件 default/hover/active/focus/disabled/loading/selected/error 状态；
- 各 `pageScenes` 对应的 `sceneRecipes` 和稳定 `designRefs`；
- loading、empty、error、mobile、reduced motion、焦点与对比度；
- CSS 变量和 Yida Application Theme Delivery Contract。

## 写入前检查

1. 已读取整理后的用户需求及 [design.md 输出格式](output-design.md)。
2. 已读取 [页面质量门禁](../references/page-quality-gates.md)。
3. 视觉规则只覆盖 `explicitScope` 或需求文件中的页面场景，不添加业务资源。
4. `designRefs` 使用稳定章节 ID，供 `yida-app` 校验和页面实现阶段引用。

## 完成条件

- `prd/<项目名>/design.md` 存在且非空。
- frontmatter 包含 version、design_id、baseDesignSource、styleDesignSelection、themeProfile、themeAdaptationResult、yidaThemeDelivery、tokens、visual_dna、scenes、density、layout、tone。
- 主题、应用主题文件交付、视觉、布局、材质、圆角、密度、呼吸感、组件、状态和响应式契约完整。
- 每个目标 display 页面场景都有 `sceneRecipes` 或可定位 `designRefs`。
- 没有写入 `prd.md`、页面源码或真实资源 ID。
