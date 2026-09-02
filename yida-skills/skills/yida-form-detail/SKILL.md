---
name: yida-form-detail
description: >
  表单页视觉引导与表单详情页 formDetail 样式优化。表单页开发默认加载本技能做视觉引导，合并 Divider 分割线语义分组；拿到真实 formUuid 后必须使用 openyida form-detail-style 写入表单 Schema JS，在 componentDidMount 中注入全局主题和详情页条件样式。
license: MIT
compatibility:
  - opencode
  - claude-code
  - qoder
metadata:
  audience: developers
  workflow: yida-development
  version: 1.4.0
  tags:
    - yida
    - low-code
    - form-detail
    - css
    - style
---

# 宜搭表单页视觉引导与详情页样式优化

## 目标

为宜搭表单页开发提供默认视觉引导，并默认优化 `formDetail` 的视觉效果。

- 表单字段结构阶段：输出表单视觉引导，要求用 `Divider` 做语义分组，字段密度、分组标题、局部多列和说明字段都服务于真实业务填写路径。
- 表单详情页样式阶段：拿到真实 `formUuid` 后必须把 formDetail CSS 写入表单 Schema JS。运行时 `openyidaThemeDidMount` 判断当前文档是否为 `formDetail`，是详情页才注入 `style#yida-form-detail-style`，否则不注入详情页结构样式。
- 表单运行态主题阶段：提交页和详情页必须消费同一个 `style#yida-global-theme`；`openyida create-form create/update/...` 和 `openyida form-detail-style apply` 都必须执行公共注入脚本，把 `openyida:theme` 区块写入表单 Schema 的 `actions.module.source`，并让根节点 `componentDidMount` 指向 `openyidaThemeDidMount`。自定义页抽屉 iframe 再通过 `FormOpenContainer` 的 iframe `onLoad` 同步父页面 tokens。

## 何时使用

- 表单页开发默认加载本技能作为视觉引导和详情页样式默认注入策略：创建表单、更新表单结构、设计字段分组、设计流程表单字段时都适用。
- 完整应用已有 `prd/<项目名>/design.md` 时，表单视觉引导必须读取 design.md 的 `themeProfile`、表单/详情页场景规则和状态规则；PRD 只提供表单业务目的、填写路径和字段语义。
- 用户说“表单详情页美化”“详情页优化”“formDetail 样式”“字段详情页不好看”。
- 新建应用包含表单，默认统一详情页风格。
- 只调整表单详情页，不改自定义展示页面、不改数据记录。

## 不要这样做

- 不要用 `RichTextField` 承载样式，设计器可能提示组件未找到。
- 不要用 `openyida publish` 发布这个样式；它不是自定义页面源码。
- 不要编造 `appType`、`formUuid` 或 `fieldId`。缺失时先从命令输出、缓存或 `openyida get-schema` 获取。
- 未拿到真实目标 `formUuid` 前，不要执行 formDetail CSS Schema 注入；拿到 `formUuid` 后必须执行幂等注入。
- 不要用 `GroupContainer` / `PageSection` 代替普通业务分组；表单页视觉引导必须合并 `Divider` 分割线规则。

## 表单视觉引导（默认）

表单页开发时，先输出一段简短决策，再交给 `yida-create-form-page` 落地字段 JSON：

```markdown
### 【表单视觉引导】
- 表单场景：<普通表单 / 流程表单 / 数据维护表 / 申请表>
- 填写路径：<用户按什么顺序完成填写>
- 分组结构：<每个分组名称；每组开头必须用 Divider，包括第一组>
- Divider 策略：<默认 bold-with-thin；同一张表单保持同一种 dividerType；标题跟随应用主题>
- 字段密度：<单列为主；短字段成对时局部 ColumnContainer>
- 详情页策略：<拿到 formUuid 后必须注入 formDetail CSS；如需自定义品牌色，说明 CSS 变量调整点>
```

视觉引导阶段的 `Divider` 规则必须和 `yida-create-form-page` 合并执行：字段较多时每个语义分组开头都放 `Divider`，第一个分组也要放；`Divider` 不放在字段列表末尾；普通业务分组不使用 `GroupContainer` / `PageSection`。

## 落地方案

### 表单结构视觉引导

由 `yida-form-detail` 决定分组、密度、Divider 策略和详情页样式注入策略；由 `yida-create-form-page` 写入结构化字段 JSON 并执行 `openyida create-form create/update/...`。表单保存时必须补齐 `openyida:theme` 区块和 `openyidaThemeDidMount`。

### formDetail 样式注入

优先使用 CLI 落地，不要手写接口请求：

```bash
openyida form-detail-style check <appType> <formUuid> --json
openyida form-detail-style apply <appType> <formUuid> --preset clean-card --json
openyida form-detail-style remove <appType> <formUuid> --json
```

`apply` 会完成表单 Schema JS 写入，缺一不可：

1. 在 `actions.module.source` 写入 `openyida:theme` 区块。
2. 在根节点生命周期补齐 `openyidaThemeDidMount`，供提交页和同源父级文档消费 `style#yida-global-theme`。
3. 将详情页 CSS 内置到同一个区块；运行时只有检测到 `formDetail` 页面才注入 `style#yida-form-detail-style`。

- `style#yida-global-theme` 不区分提交页和详情页，始终注入。
- `style#yida-form-detail-style` 只在 `location.href` 或 DOM 命中 `formDetail` 时注入；提交页不注入详情页结构 CSS。

完整步骤见 [注入流程](references/injection-guide.md)，用于理解和排障；默认 CSS 见 [默认样式](references/form-detail-css.md)，`--preset clean-card` 默认读取这份样式。

## 执行流程

1. 确认当前登录态和组织：
   ```bash
   openyida env --json
   openyida login --check-only --json
   ```
2. 确认目标 `appType` 与表单 `formUuid`。如果用户只给了表单名，先用应用表单列表或 `openyida get-schema <appType> --all` 辅助定位。
3. 先执行 `openyida form-detail-style check <appType> <formUuid> --json`，确认当前是否已注入。
4. 需要改色、改圆角或只优化局部时，读取 [默认样式](references/form-detail-css.md)，只调整对应变量或 CSS 分区。
5. 使用 `openyida form-detail-style apply <appType> <formUuid> --preset clean-card --json` 写入默认样式；如有自定义 CSS，使用 `--css <file>`。
6. 保存后再次执行 `openyida form-detail-style check <appType> <formUuid> --json`，确认 `globalThemeActionFound: true` 且 `formDetailStyleActionFound: true`。如果 `globalThemeActionFound` 为 `false`，说明表单提交页不会自己写入 `style#yida-global-theme`，必须重新执行 `apply`。

## 决策规则

- 创建或更新表单结构：默认加载本技能做视觉引导，必须合并 Divider 分割线分组；拿到真实 `formUuid` 后必须注入或补齐 formDetail CSS。
- 完整应用表单：先读取 `prd.md` 的表单业务目标和字段语义，再读取 `design.md` 的主题、密度、Divider、详情页策略；不要从 PRD 复制视觉规则。
- 用户要求完整美化或未指定特殊样式：使用默认 CSS 全量注入。
- 用户只要求某一区域：从默认 CSS 中截取对应分区，仍写入同一个 `openyida:theme` 区块。
- 用户有品牌色：优先改 CSS 顶部变量，不要大面积改选择器。
- 新建应用完成后如包含表单：表单结构阶段默认使用视觉引导，并必须完成表单全局主题和详情页优化样式注入；跳过注入只能来自明确技术阻塞并在 final 说明。
