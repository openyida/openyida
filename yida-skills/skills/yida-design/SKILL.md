---
name: yida-design
description: >
  当用户要做完整应用视觉设计、单页 UI 改造、主页面视觉设计、应用主题色或全局换肤时使用。
  完整应用读取共享需求：Fast 并行输出 design.md，Plan 维护视觉事实后由 CLI 生成 design.md。
  将导航、应用框架、表单、记录详情和自定义页面一起设计，在 design.md 写入统一的主题 token、布局、材质、形状、间距与状态规则。
---

# yida-design

宜搭应用和页面视觉设计技能，输出 `design.md`。

宜搭平台基础变量是平台提供的应用主题基础变量框架。项目主题在这套基础变量上按需扩展材质、布局、字体、动效和组件状态变量。先确定设计效果，再写入对应变量和消费位置；见 [主题扩展规则](references/application-theme-consistency.md#平台基础变量是应用主题基础框架)。

设计导航时，把菜单圆角、三态边框、选中阴影、项高、内距和间距一起写入主题，并在访问态的数据管理页与业务页面检查效果，见 [导航形状与密度的案例经验](references/application-theme-consistency.md#导航形状与密度的案例经验)。

确定风格前，按[设计方向比较](references/theme-selection.md#设计方向比较)以第一直觉为参照，发展两个更有表现力的方向，在当前规划轮次内选定。已有明确视觉要求时，在其范围内完善设计。

向用户说明设计时，写风格和适用场景：“设计主题风格为轻盈媒体栅格，适合产品展示型品牌官网。”风格名称与场景按当前项目填写；建议阶段使用“建议采用……风格”。

需要业务规划时调用 `use_skill("yida-prd")`。已有 `prd.md` 时直接读取其中的页面任务、区块和业务规则，再做视觉设计；查询业务字段或格式时，按需读取 `yida-prd` 的参考文件。

Fast、Plan 和单页设计使用相同的 UI 设计规则、主题变量和质量检查；流程只在编写方式与确认时机上有区别。共用 [主题索引](templates/design-themes/index.json)，按 [共享主题选择规则](references/theme-selection.md) 先读摘要、选中后读一份完整主题。

完整应用沿用需求分析阶段确认的模式与风格，按 [设计模式路由](references/design-mode.md) 推进。Fast 使用下方视觉流程；Plan 使用 [视觉分支](sub_skill/yida-design-plan/SKILL.md) 维护视觉事实，由 `yida-app` 生成方案并请用户确认；业务规划始终归 `yida-prd`。单页设计和主题调整直接继续。

---

## 入口快速路由（必读，先做设计对象判断）

进入本技能后，先判断设计对象，并按表中唯一动作执行。

| 用户诉求 | 判定为 | 唯一动作 |
| --- | --- | --- |
| 完整应用、多个角色、多页面、导航分组、首页/入口页、官网 + 看板 + 后台 | 完整应用视觉设计 | Fast 执行下方视觉流程；Plan 执行 [视觉分支](sub_skill/yida-design-plan/SKILL.md) |
| 单个自定义页要求好看、高级、品牌化、去 AI 味、页面太丑、不够惊艳 | 单页设计 | 读 [page-design](sub_skill/page-design/SKILL.md)，确认当前页面和应用主题后输出设计补充 |
| 应用主题色、品牌色、全局换肤、`--color-brand1-*`、自定义主题 CSS、`themeColor`、`navTheme` | 主题色和 token 设计 | 读 `workflow/step-2-theme-system.md` 和 `workflow/step-6-handoff.md`，输出 themeProfile、应用主题文件和 token 契约 |
| 页面 / 主页面 / 首页 / 工作台 UI 设计 | 页面视觉设计 | 读取当前页面上下文，输出或更新 `design.md` |

---

用户选择暗色、黑色或夜间主题时，按 [暗色主题浮层适配](references/theme/theme-token-presets.md#暗色主题浮层适配) 检查浮层；仅导航深色不触发整体暗黑适配。

## Fast 视觉流程

输入为校验通过的共享 `requirement-brief.json`。沿用已确认的风格；业务规划与配色、组件样式同时准备，页面内容确定后补齐各页设计，由 `yida-app` 核对页面范围和设计引用。

| 步骤 | 名称 | 功能描述 | 产出物 |
| --- | --- | --- | --- |
| 1 | [读取整理后的用户需求](workflow/step-1-read-brief.md) | 读取业务对象、页面场景、明确范围、品牌和色彩偏好 | 视觉输入摘要 |
| 2 | [选择主题色和 token](workflow/step-2-theme-system.md) | 确定主色、辅助色、中性色、字体层级、组件基调和宜搭 token 作用域 | `themeProfile` |
| 3 | [页面结构和交互设计](workflow/step-4-wireframe-interaction.md) | 根据用户需求中的页面场景确定布局骨架、区块、主操作、状态和响应式规则 | 低保真结构 + 交互路径 |
| 4 | [UI 视觉和状态设计](workflow/step-5-visual-states.md) | 从业务任务、信息拓扑和视觉特征选择设计风格 | `design.md` 内容草稿 |
| 5 | [写入 design.md](workflow/step-6-handoff.md) | 写入唯一视觉事实源和稳定 `designRefs` | `prd/<项目名>/design.md` |

完整应用输出一份应用级 `design.md`，包含主题、布局、组件、状态和响应式规则，三种流程共用 [唯一输出契约](workflow/output-design.md)：frontmatter 保存机器数据与 anchor 索引，完整规则只写在五章正文。Fast 手写并执行 `check-design`，Plan 使用紧凑契约由 CLI 生成并执行同一校验。页面实现同时读取业务 PRD 和视觉契约。

---

## 核心规则

修改已有设计时，只读取并更新相关章节、页面记录和 token。Plan 统一按 [局部调整](../yida-app/workflow/plan/step-4-deliver.md#4-处理调整) 执行；Fast 直接修改当前 `design.md`，再按主题更新命令同步已有 CSS，保留未改的正文和自定义样式。

1. **平台能力优先**：数据录入、提交、编辑、审批、权限、字段校验走宜搭表单/流程；自定义页负责展示数据、呈现分析结果、放置业务入口、打开详情页，并串联表单、流程、报表和导航入口。
2. **美感提升保持功能契约**：页面美化、视觉升级和页面重构默认只调整颜色、布局、密度、间距、视觉层级、素材和图标表达；现有数据源、字段映射、按钮动作、筛选逻辑、提交 URL、权限和业务状态保持原样。
3. **默认保留平台应用导航**：普通自定义页、页面内 tab、分段、筛选和快捷入口都不触发 `yida-nav-shell`。PRD 的应用工作区选择自定义导航，或用户明确要求自绘应用级导航、隐藏应用导航时，写 `appBlueprint.hideAppNav: 'y'` 并交给 `yida-nav-shell`。独立前台选择自己的菜单时，同样进入 `yida-nav-shell`，但只配置该页独立展示，保留后台应用导航。用户只说全屏、无导航或 `isRenderNav=false` 时，只写页面级隐藏配置。
4. **同应用页面入口归导航**：同应用页面优先放入平台导航或导航分组；自定义页内容区放当前页动作、原生表单新建/查看、外部链接和跨应用资源。
5. **表单入口响应式**：新增/提交页 URL 默认使用页面级隐藏导航的 `submission/{formUuid}?isRenderNav=false`；详情页 URL 默认使用 `formDetail/{formUuid}?formInstId={formInstId}&navConfig.layout=1180&isRenderNav=false`，且 `formInstId` 必须来自真实数据记录并优先取 `row.formInstId`；PC 端默认在侧边抽屉中用 iframe 承载宜搭原生表单，抽屉默认半屏 `50vw`，提交页和详情页使用同一宽度规则；移动端整页或新页打开。
6. **主题文件**：主题目录统一包含设计、CSS、表单布局三个文件，导出和生成参数见 [命令与参数](references/application-style-library.md#命令与参数)。Plan 使用 CLI 返回的 `outputs.theme`；Fast 和已有主题调整按 [主题文件生成与更新](workflow/output-design.md#cli-token-契约fast--plan-共用) 执行。按 [共用主题规则](references/application-theme-consistency.md) 将已选风格落实为 token，并核对生成的 CSS。修改变量要回到设计源后重新生成、上传；仅 CLI 未覆盖且已核实选择器的样式覆盖可在 CSS 末尾小范围追加，不另写脚本生成或重写主题文件。
7. **默认主题先做业务判断**：工作台、门户、列表、详情、普通看板和数据大屏默认都是浅底 / light 模式，但主色不固定为 `podBlue` 或 #1677ff；先根据行业、品牌、业务情绪和视觉目标做创意色彩判断，主题色可以是任意合法 CSS 颜色。只有用户明确说暗色/深色/夜间/高对比时才用深色沉浸。
8. **页面布局要到可实现粒度**：每个页面至少写清顶部/左侧/主体/右侧/底部区域、核心组件、信息密度、主操作位置、PC/移动端差异和空/载/错态。
9. **页面丰富度建议**：工作台、首页、门户、看板、展示页和业务入口页推荐规划 8-10 个有业务目的的区块以上，例如上下文标题、状态摘要、主操作、筛选、任务列表、最近记录、动态流、洞察、提醒、空态行动、右侧上下文和底部辅助信息。区块数量不是硬门槛，窄场景、单任务页面或用户明确要求精简时可以更少，但要写清每个区块的业务目的和取舍原因。计数按“区块组”算，不按子项算：`KPI 卡片: 学生总数, 课程总数, 出勤率, 平均分` 只能算 1 个状态摘要区块，`快捷入口: 录入学生/登记成绩/记录考勤/管理课程` 只能算 1 个动作区块；不能用重复 KPI 卡、重复快捷入口或大空白卡凑数量。
10. **工作台禁低密大卡片套路**：工作台 / 业务首页不能用“标题 + 4 个等宽大 KPI 白卡 + 图标快捷卡 + 大空态白卡”撑首屏。默认改成紧凑状态摘要条、任务/动态列表、最近记录、右侧上下文面板和高频动作；没有真实数据时也展示薄空态行 + 登记入口，不铺大块空白卡片。
11. **按主题保持形状、密度与呼吸感**：`design.md` 正文写清圆角、密度与呼吸节奏的具体消费方式和必要数值，优先采用选中主题的容器/控件形状与内距、组间距、列表行高。通用业务页参考值只补主题未定义项，不能用固定大圆角、padding 或 gap 覆盖主题。呼吸感来自对齐、分组、层级和节奏，不来自超宽空 KPI 框或空白卡。
12. **背景与内容层次清晰**：正文说明主题如何用色差、细边界、共容器、留白或材质区分内容。同色画布与面板可通过明确边界和分组成立；渐变、玻璃、阴影按主题规则启用，不强制添加。
13. **模板与自由创意并列**：始终支持[自由创意](references/application-style-library.md)，根据业务独立推演，不要求从模板选择。使用模板时，先按业务任务、信息拓扑选择风格，再按用户确认的色彩氛围协调页面、卡片、导航、填充、边界和交互。布局、圆角与材质可保留，模板固定灰阶和品牌色面积限制不能覆盖用户要求。“自然绿意”等整体风格不能缩减成只有按钮和 logo 变绿；明确只改强调色或忠实中性参考时才保持原画布。文字保留可读的中性层级，状态保留独立语义。
14. **应用主题统一**：按 [整体主题规则](references/application-theme-consistency.md#导航与应用框架) 一起设计导航、应用框架、提交/编辑表单、记录详情和自定义页面。`app-theme.css` 保存完整主题变量与消费样式。`YidaCodeCanvas` 页面只在 `YidaComp` 内消费 `--color-brand1-*`、`--color-group` 和 `--pod-*`；严禁页面代码修改或向上层注入主题变量。应用包含表单或详情页时，读取 [表单风格规则](references/native-form-styles.md)，将组件布局和只读详情样式写入 `design.md`；视觉值写入应用主题 CSS，结构写入表单配置。
15. **参考转成可执行选择**：参考 Dribbble / 优秀案例时，落到主色、背景素材、首屏构图、信息密度、动线、区块数量和反默认点。
16. **页面文案和图标使用专业表达**：渲染文案使用纯文本；图标只使用 `lucide-react` 或 `@ant-design/icons` 的具体组件，默认选择 `lucide-react`，并在 `design.md` 的 `iconSystem` 中写清业务动作、状态、导航和空态到图标组件的映射。emoji 不能改成 CSS 形状、字母占位、Unicode 符号或临时 SVG；如果需要图标，必须映射到上述两类库的具体组件。
17. **实现交接明确**：设计产物只定义页面结构、视觉系统和验收标准；常规业务图表使用 `yida-rechart`；ECharts 例外只用于用户明确要求复杂 ECharts option 或维护旧图表。
18. **素材按页面分级**：在 `assetStrategy` 中记录图片等级和槽位；需要素材时交给 `yida-image-assets`。

---

## 参考文件

| 文档 | 覆盖范围 | 何时阅读 |
| --- | --- | --- |
| [读取整理后的用户需求](workflow/step-1-read-brief.md) | 业务对象、页面场景、明确范围、品牌和色彩偏好 | 完整应用必读 |
| [选择主题色和 token](workflow/step-2-theme-system.md) | 主题 token、色彩、字体、组件基调 | 涉及主题或视觉 |
| [页面结构和交互设计](workflow/step-4-wireframe-interaction.md) | 布局骨架、内容区块、主操作、抽屉、响应式 | 页面设计 |
| [UI 视觉和状态设计](workflow/step-5-visual-states.md) | 设计风格选择、视觉特征、主题换肤、素材图标、空/载/错态、去 AI 味 | 输出前自检 |
| [写入 design.md](workflow/step-6-handoff.md) | `design.md` 必填内容、稳定引用和完成条件 | 输出前 |
| [page-design 单页设计](sub_skill/page-design/SKILL.md) | 单页主题证据、页面级设计流程、输出补充字段 | 单个自定义页设计 |
| [design.md 输出格式](workflow/output-design.md) | `design.md` 字段示例 | Fast 写入前；Plan 定制时按需 |
| [共享主题选择规则](references/theme-selection.md) | Fast、Plan、单页共用的摘要选型、项目化和读取边界 | 主题选择与生成 |
| [视觉结构配方库](references/visual-scaffold-recipes.md) | 把真实内容组织为可实现的布局、表面与响应式安排 | UI 视觉设计 |
| [页面质量门禁](references/page-quality-gates.md) | 区块数量、源码槽位、低密大卡片、主题一致性和 `pageSpecHandoff` 检查 | 页面结构、视觉与交接阶段 |
| [共享主题索引](templates/design-themes/index.json) | 唯一主题 ID、路径与精简风格摘要 | 选前只读摘要；选后只读对应完整主题 |
| [基础变量契约](templates/design-themes/basic-tokens.json) | 全局基础变量与固定值 | 主题项目化和 token 校验 |
| [应用结构参考](../yida-prd/references/app/blueprint.md) | 应用角色、导航、页面清单、页面/表单/流程资源蓝图 | 完整应用或主页面 |
| [应用主题与 token 参考](references/theme/theme-token-presets.md) | 平台主题 key、候选主题、token profile | 需要主题 key 或 token |
| [应用主题 CSS 模板](references/theme/app-custom-theme-template.css) | AI 可复制修改的品牌、Shell、页面、表格和导航 token | 生成自定义应用主题文件时必读 |
| [yida-canvas-custom-page 样式实现指南](../yida-canvas-custom-page/references/canvas-style-implementation-guide.md) | 将 `design.md` 的 token、背景、圆角、密度和组件规则落到页面源码、antd、CSS、图表和控件状态 | 实现阶段 |
| [字段与 URL 参考](../../references/field-and-url-reference.md) | `isRenderNav=false`、页面 URL、跨页跳转 | 拼接页面/表单 URL |
