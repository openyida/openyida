# Plan 视觉规划与项目设计生成

Plan 的源事实保存在 `build-plan.json`，CLI 派生最终 `design.md`。内容构成、frontmatter、五章正文、anchor 与检查只按 [公共输出契约](../../../workflow/output-design.md) 执行；本文件仅规定 Plan 输入如何映射，不重复一份输出格式。

## 运行时输入

1. 当前版本计划：项目、页面、业务约束、已选视觉方向、主色与导航。
2. [共享主题索引](../../../templates/design-themes/index.json) 的已选记录与一份完整主题。选前只读摘要，选后再读全文，不预读候选。
3. 每个实际自定义页的具体视觉决定、局部差异、特色配方绑定及素材需求。

PRD 决定页面任务、操作和内容优先级；主题决定这些内容如何呈现。视觉生成不增删业务资源，不改写页面模式、内容优先级与业务信息密度。正常设计不读取主题库维护说明。

## 逐页输入

`visualStyle.forUser.pageApplications` 与 `pages.customPageDetails[]` 按 pageId 一一对应。最终物化前，每页至少填写：

| 字段 | 类型与内容 |
| --- | --- |
| `pageId` | 对应真实页面的稳定 ID |
| `firstScreenFocus` | 非空字符串，进入页面第一眼关注什么及突出方式 |
| `primaryAction` | 非空字符串，真实主操作、所在位置及触发后的反馈，沿用 PRD 的动作 |
| `layout` | 非空字符串，真实区块的顺序、主次、宽度/比例、列数、对齐与内容增长安排 |
| `responsive` | 非空字符串，窄屏重排、折叠、工具栏与表格处理 |
| `acceptanceChecks` | 非空字符串数组，页面视觉与交互的可检查结果 |

`surface`、`states`、`visualApplication` 可补具体项目差异；公共规则由主题供给，不需要逐页复制。CLI 结合业务页面事实，将这些输入呈现为正文八项要点。没有自定义页时保留空数组，不添加页面。

缺少上述决定的旧计划和新草稿仍可预览；生成最终产物时提示准确缺项，补齐后继续，不用“继承主题”占位替代。仅维护草稿不代表 design.md 已就绪。

### 特色配方

`visualMemoryApplications` 仅在真实内容满足主题配方条件时填写，每项含 name、renderPolicy、target、reason。使用 `adapt_existing_slot` 或 `prd_match_only` 绑定已有内容；会新增业务能力、字段、对象或虚构数据的建议标为 `suggest_only`，不进入默认实现。没有匹配项就保留空数组，页面仍继承完整基础语言。

配方来自主题实际核心特征、适用条件、使用方式与无匹配时规则，不要求旧版固定字段或旧章节。`visualMemories` 从绑定名称派生，不重复维护。

按 [页面与导航连续性](../../../references/page-continuity.md) 在 pageApplications.layout/responsive/states 写明布局和往返状态；materialize 同步规则到 design.md。导航明暗不决定占位/叠加。

`forUser.iconSystem` 可记录图标库和业务到组件映射，初始化沿用 brief 中的选择；没有配置时才默认 lucide-react 与空映射。图标尺寸和描边等实现规则保留在正文，不复制进定位索引。

## 配色与导航

项目主色写 `forUser.colorStrategy.primaryColor`，使用 6 位 HEX；平台变量覆盖与项目扩展变量都写入 `visualStyle.tokens`，不受模板现有变量数量或 `--oyd-*` 前缀限制。`themeProfile` 是输出摘要，不以修改摘要代替 token。CLI 组织 application-global 与 custom-page 分组，两组都会写入主题 CSS 的 `:root`；可引用已声明的共享变量，不能循环引用或依赖只在某个页面内定义的变量。

逐项核对已选方向承诺的画布、面板、文字、字体和特色强调是否有对应变量；差异由设计者补齐，不能只写在 description/usage 中。物化后按 [共用主题规则](../../../references/application-theme-consistency.md) 对照生成的 CSS，再交给页面作者。

颜色推导与 Fast 相同，直接使用所选主题的公式和项目 token，不增加 Plan 专用染色规则。应用根渐变写 `--pod-app-root-bg-image`；单页渐变与装饰在页面设计中说明作用区域，按 [背景规则](../../../workflow/output-design.md#背景颜色渐变与图片) 实现。

整体配色与主题的冲突按公共输出契约处理。导航和内容界面的明暗分别描述，导航明暗采用所选主题模板的 `navTheme`，既定入口范围保持不变；前台与后台可改变表达强度，但共享基础变量、字体、状态和组件语言。无法保留已选主题核心特征时回到主题选择，不在页面阶段另建主题。

## 物化与交接

CLI 校验主题绑定、解析变量与项目覆盖，生成正文五章，将项目总结、配色和导航合入对应章节；作者编写步骤、模板身份与未解析占位符不进入最终文件。具体规则仅保留一份，frontmatter 的 sceneRecipes/components/states 只保存显式 anchor 定位信息。

`build-plan.json`、PRD、设计与 HTML 对应同一 revision。CLI 调用公共 `check-design` 检查格式、变量和引用后，主题 CSS 使用返回的 `outputs.theme`。页面实现只读取最终 PRD 与 design.md；HTML 按 [展示规范](../assets/README.md#需求确认内容范围) 呈现整体风格、主色、导航与需用户补充的素材，详细逐页视觉规则保留在 design.md。

页面任务变化时同步逐页应用，主题差异变化时更新 tokens；旧输出不能手改后假装与当前计划一致。普通页面设计不重新发起一轮视觉选择提问，只有新证据造成已选方向冲突时才回到选择阶段。

自由创意（`free-creative`）没有模板导航默认值：在 `navigationStyle.tone` 明确填写项目设计的 `light` 或 `dark`，CLI 标记 `toneSource=project_defined`；此路径可通过 patch 调整 tone，并同步配套导航 Token。命名模板仍按模板派生导航明暗。
