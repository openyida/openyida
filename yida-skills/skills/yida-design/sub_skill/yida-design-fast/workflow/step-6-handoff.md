# Step 6：写入 prd.md 和 design.md

> 本流程把业务设计结果分别写入 `prd/<项目名>/prd.md` 和 `prd/<项目名>/design.md`。这里不写 JSX/TSX，也不直接输出 `page-spec.json`；页面实现阶段由 `yida-app` 同时读取 PRD 与 design.md，只有走页面生成器或需要稳定交接时才派生 `page-spec.json`。

## 写 prd.md

| 模块 | 必填内容 |
| --- | --- |
| 应用基本信息 | 应用名称、应用类型、业务目标、核心用户、使用场景、核心对象、主题色、权限口径 |
| 应用配置 | `appType`、`corpId`、`baseUrl`；已有应用填真实值，从零创建时写待创建/待确认 |
| 数据结构 | 普通表单、流程表单、字段语义、Divider 分组、流程节点 |
| 页面与功能设计 | 按页面逐节写清页面类型、页面定位、页面目标、页面关系、关联表单/流程/报表/详情页、需要设计的区块、布局骨架、核心组件、主操作、PC/移动端差异；自定义页面逐区块写清目的、数据来源、主操作和状态 |
| 应用主题与风格摘要 | 只写 design.md 引用、应用主题色、风格关键词和业务理由；完整 UI 设计系统放在 `design.md` |
| 业务逻辑与状态 | 表单提交后行为、新增/提交入口、详情查看、权限、空/载/错态 |
| 资源蓝图 | 应用、表单、流程、自定义页面、报表等资源清单和创建策略 |
| 资源创建顺序 | 先应用，再表单/流程，再自定义页面，再报表/数据源，最后发布与导航排序 |
| 页面实现交付顺序 | 按页面开发和验收顺序排列，主页面先交付，核心业务页随后，辅助页靠后 |
| 导航顺序 | 按用户入口排序，主入口靠前，业务办理/数据管理/经营分析/系统配置分组明确，并写清导航呈现方式 |
| 验收标准 | 主页面访问、数据录入、数据查看、权限/流程、视觉一致性、导航可用 |

## 写三种顺序

| 顺序类型 | 含义 | 默认规则 |
| --- | --- | --- |
| 资源创建顺序 | `yida-app` 真正创建资源的依赖顺序 | 应用 → 表单/流程 → 自定义页面 → 报表/数据源 → 发布/导航 |
| 页面实现交付顺序 | 页面开发和验收的先后顺序 | 主页面 / 工作台 / 官网首页 → 核心列表/管理页 → 详情/看板/大屏 → 辅助页 |
| 导航顺序 | 用户在应用导航中看到的展示顺序 | 门户/首页 → 业务办理 → 数据管理 → 经营分析 → 系统配置 |

## 写 design.md

| 模块 | 必填内容 |
| --- | --- |
| frontmatter | version、design_id、baseDesignSource、styleDesignSelection、themeProfile、themeAdaptationResult、yidaThemeRuntime、tokens、visual_dna、scenes、density、layout、tone |
| 总览 / 设计风格选择依据 / 主题色与换肤结果 / 适用场景 / 视觉氛围 | 可复用设计意图、选中风格和排除风格、主题色来源、换肤策略、适合与不适合场景、密度、气质和页面组织方式 |
| 视觉 DNA / 设计母体 | 所有页面都必须保留的 2-5 个视觉 DNA，每个包含证据、规则、实现钩子、失败表现和置信度 |
| 色彩角色 / 字体 / 布局 / 深度 / 形状 | token、字体栈、字号、网格、间距、层级、圆角和材质规则 |
| 组件样式 / 快捷入口区域 | 按组件写 default、hover、active、focus、disabled、loading、selected、error；工作台等必须写快捷入口区域 |
| 页面结构配方 | 中性槽位、`visualScaffold`、`surfaceMap`、`componentRecipe` |
| 状态与交互 / 响应式 / 可访问性 | loading、empty、error、mobile、reduced motion、焦点和对比度 |
| 实现适配 | CSS 变量、Yida / YidaCodeCanvas 容器重置、`Yida Global Theme Runtime Contract`、YidaCodeCanvas / 平台 JSX 组件 helper 使用规则 |
| 包含项 / 禁止项 / 错误 vs 正确 / Agent 使用提示 / 交付自检 | 保护视觉 DNA、contentBlocks 推荐 8-10 个区块以上、禁大白卡、自定义色 token 注入、实现前读取双文件 |

## 写文件前检查

1. 读取 [PRD 输出格式](output-prd.md)。
2. 读取 [design.md 输出格式](output-design.md)。
3. 读取 [页面质量门禁](../references/page-quality-gates.md)，确认每个 display 页面都有薄 `pageSpecHandoff`，并且 `design.md` 视觉契约完整。
4. 用 Step 1-4 的产物填充 `prd.md`，只写业务、资源、页面结构和 design 引用。
5. 用 Step 2 和 Step 5 的产物填充 `design.md`，写完整视觉系统、场景配方、组件规则和状态规则。
6. 将 PRD 写入 `prd/<项目名>/prd.md`，将设计契约写入 `prd/<项目名>/design.md`。
7. 确认 PRD 已写应用级上下文 `appType/corpId/baseUrl`；表单、字段、页面等创建后的细节 ID 由实现阶段写入 `.cache/<项目名>-schema.json`。

## 完成标准

- `prd/<项目名>/prd.md` 包含 PRD 必填内容。
- `prd/<项目名>/design.md` 包含 design.md 必填内容。
- 表单/流程在资源创建顺序中位于自定义页面之前。
- 页面实现交付顺序写清每个页面的实现重点、依赖资源和验收点。
- 导航顺序写清分组和页面展示顺序。
- 表单提交入口保留原生表单能力，并说明 PC/移动端打开方式。
- 每个 display 页面都有 `pageSpecHandoff`，包含 `pageStructure`、`scene`、`contentBlocks`、`themeProfile`、`designFile`、`designRefs`、数据来源和主操作。
- 页面实现交付说明明确：创建或更新页面前必须同时读取 `prd.md` 与 `design.md`。
