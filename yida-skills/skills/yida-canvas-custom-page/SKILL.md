---
name: yida-canvas-custom-page
description: 宜搭自定义页面开发规范，使用 `YidaCodeCanvas` 组件实现现代 React18 自定义页面。用于官网、看板、工作台、列表、详情、门户壳、可视化、hooks 交互、表单入口，以及需要门户组件、数据管理视图、成员、部门或上传组件的场景；发布层自动注入 yida/utils window 桥。
---

# 自定义页面开发

## 编码前必读（MUST）

先确认导航归属：使用平台导航的管理端自定义页面默认只实现业务内容，同任务可用页内 Tab，跨模块由平台菜单切换。编码前按[管理页面边界](references/navigation-and-entry-guide.md#平台导航下的管理页面)核对，不把后台任务清单或前台菜单复制为第二套导航。

先确定控件与动作的接入方式，再写业务 JSX：使用 antd 时先读取并合并 [标准主题桥](references/canvas-theme-provider.md)，所有 Button、Tabs、Segmented、链接与弹层放在同一主题子树；普通 DOM 控件直接消费应用 CSS 变量。需要跨页按钮或链接时，先按 [入口契约](references/navigation-and-entry-guide.md#先建立动作与目标清单) 提取 `canvas-navigation`，填写真实资源 ID 和目标类型。本页 Tab 用状态或 hash；按钮点击和链接 href 共用同一个 URL 构造函数。缺少目标资源时保留布局并禁用该入口，不猜地址。

新建页面或调整视觉前，完整读取 [canvas-style-implementation-guide.md](references/canvas-style-implementation-guide.md)，结合当前 PRD 和 `design.md` 实现。读取结果被截断时分段读完；同一任务已读完且文件未变时可复用。仅修改数据逻辑时可跳过，并记录原因。

在现有实现计划中记录适用章节、采用规则和页面位置，覆盖画布与导航、卡片边界、控件主题、密度留白。例如：`客户列表白底白卡 → 主题中性细边框`。交付前核对源码与实际页面，未实测项标为待验证。

有筛选、分页、详情往返或编辑区时，先按[状态恢复规则](references/view-state-recovery.md)明确刷新与返回策略；无现有路由且无未保存编辑拦截需求时，可提取 `canvas-view-state`。有确认、取消、签到等写操作时，同时加载 `yida-canvas-data-binding`，按其业务动作权限清单核对服务端约束，再接入按钮；隐藏按钮不等于授权完成。

## 核心定位

用 React18 函数组件编写 `.canvas.jsx` / `.canvas.tsx` 页面。适用于官网、工作台、列表、详情、门户、看板，以及含图表、表单入口和复杂交互的页面。

从 `yida-prd` 的 `prd/<项目名>/prd.md` 读取业务目标、页面区块、交互和数据要求；从 `yida-design` 的 `prd/<项目名>/design.md` 读取主题、布局、材质、圆角、密度、组件和状态规则。单页任务读取对应 PRD 章节和设计说明。

维护 `.oyd.jsx` / `.oyb.jsx` / `renderJsx` / 平台 `Jsx` 页面时使用 `yida-custom-page`；用户要求转为 Canvas 时，交给 `yida-canvas-upgrade`。

## 运行时事实

- 独立前台需向应用管理员提供业务工作台入口时，按 [管理员入口](references/navigation-and-entry-guide.md#管理员返回业务工作台) 提取 `canvas-admin-entry`。核对当前应用 loginUser.isAppAdmin 的明确允许值，未知时隐藏；目标来自真实管理页资源，不从访客菜单或 CLI 登录身份推断。
- 使用 `YidaCodeCanvas` 组件实现的源码写成 `.canvas.jsx` / `.canvas.tsx`，`openyida publish` 会自动写入 `YidaCodeCanvas` Schema。
- 页面源码路径按 Bash cwd 选择：从工作区根执行命令时用 `project/pages/src/...`；cwd 已是 `<workspace>/project` 时用 `pages/src/...`。
- `runtimeCode` 在运行页面真实 `window` 中执行，入口必须返回 `YidaComp` / `YidaComp.default` / 组件函数。
- 入口推荐写 `function YidaComp(props) { ... }`，也支持 `const App = ...; export default App;`。
- `YidaCodeCanvas` 组件使用 React 函数组件上下文；表单数据通过 yida JS-API 桥读写，平台连接器通过连接器桥调用，自定义同源接口才使用 `fetch`。
- OpenYida 发布层会在外层普通自定义页面 `didMount` 自动注入 `window.__OPENYIDA_YIDA_API__`、`window.__OPENYIDA_UTILS__` 和 `window.__OPENYIDA_CONNECTOR_API__`。前两者暴露表单、流程及根级工具；连接器桥只接受 `Http_*` 内部 `connectorName`、`operationId`、`connectionId` 和结构化业务输入，数字连接器 ID 只用于 CLI 管理。
- 第三方前端资源只从可用资源清单中选择；React、antd、Ant Design Icons、ahooks、d3、recharts、Radix、framer-motion、lucide-react 等必须按规则 import，由编译器写入 `importedModules`。源码严禁出现 `const { Drawer } = antd`、`const { Search } = lucideReact`、`window.antd`、`window.icons` 等手写依赖全局。
- 宜搭运行态组件按“先探测、可用增强、fallback 保底、值统一归一化”接入；以 `window.Deep` / `window.DeepYida` 探测为主，`window.YidaNativeComponents` 作为补充来源。嵌入门户数据管理视图时使用 `DataManageViews`，并显式传入目标表单 `form.value/formUuid`。

> 可用资源清单和运行时细节见 [dependencies-and-cdn.md](references/dependencies-and-cdn.md) 与 [employeefield-verification.md](references/employeefield-verification.md)。

## 实现范围

| 需求 | 推荐做法 |
| --- | --- |
| 官网、看板、工作台、列表、详情、门户壳 | 读取 `yida-prd` 的 prd.md 与 `yida-design` 的 design.md；生成器路径再读取派生 `page-spec.json`，按页面场景实现 `.canvas.jsx` |
| 需要开放 API / 连接器读写数据 | 同时加载 `yida-canvas-data-binding`；开放 API 先配置平台连接器，页面只保存资源 ID 并调用连接器桥 |
| 需要门户 topBanner / quickEntry / 数据卡片 | 使用本技能，按“门户组件桥”接入，必要时 fallback 自绘 |
| 需要成员、部门、附件上传、图片上传 | 使用本技能，按“宜搭组件桥”接入并归一化值 |
| 需要字段结构、公式、联动、权限、报表、流程 | 使用对应配置型技能完成配置，自定义页面展示结果并分发页面事件 |
| 新建页面需要字段、表单入口、成员/部门/上传或数据源 | 使用本技能，用数据桥、连接器或运行态组件桥实现 |

## 两类特殊组件场景

### 1. 门户组件、topBanner 与数据卡片

需要门户展示能力时，先按目标页面 PRD 确定门户区块、数据来源和降级视图；需要确认运行态组件清单时，按 [native-components-bridge.md](references/native-components-bridge.md) 编写探测页。

组件选择建议：

- `PortalTopBanner`、`PortalQuickEntry`：优先接入，适合门户首页的 Banner 和快捷入口。
- `QuickAccessCard`、`RecentlyUsedCard`：先做运行态验证，再用于动态门户卡片。
- `DataCard`、`PortalContainer`：仅在目标门户上下文、数据卡片配置和样式变量都验证通过后启用。

做法：从 `window.Deep`、`window.DeepYida` 探测组件；若环境已有 `window.YidaNativeComponents` 也可兼容读取。探测到组件时渲染原生组件；未探测到时渲染页面自绘卡片，页面保持可用。

### 2. 成员、部门、上传组件

需要数据管理视图、成员、部门、附件上传、图片上传时，使用原生组件桥从页面 `window.Deep` / `window.DeepYida` 探测已挂载组件，并把探测结果写回当前页面实现计划。

组件选择建议：

- `EmployeeField`：优先验证和接入，记录真实 `onChange` 结构。
- `DepartmentSelectField`：验证部门搜索、弹层、权限提示、单选/多选后启用。
- `AttachmentField` / `ImageField`：验证 OSS 签名、上传权限、预览、删除、失败提示后启用。

做法：原生组件处理交互输入；页面业务状态保存归一化后的成员、部门、文件结构；提交通过 yida JS-API 桥、连接器桥或自定义同源接口完成。组件验证通过时使用原生组件；组件条件不足时使用页面自绘输入、搜索或链接录入。

> 详细桥接规则、值结构和验收清单见 [native-components-bridge.md](references/native-components-bridge.md)。

## 核心规则

### 致命规则（FATAL）

1. **YidaComp 入口明确**：源码必须导出或返回 `YidaComp`，并把主组件作为默认导出或 `YidaComp` 暴露。
2. **发布方式正确**：使用 `YidaCodeCanvas` 组件实现的源码写成 `.canvas.jsx` / `.canvas.tsx`，或发布时显式加 `--canvas`。
3. **源码修改发布闭环**：用户要求发布时，本轮 Write/Edit/Create 了 `project/pages/src/*.canvas.jsx` 或 `project/pages/src/*.canvas.tsx` 后，final 前需要成功执行 `openyida publish <source> <appType> <displayPageFormUuid>`。有 publish 成功证据时表述为“页面已发布”；只有本地校验证据时表述为“源码已修改，尚未发布”。
4. **依赖可加载**：普通 import 只使用 `YidaCodeCanvas` 可用资源清单内的前端资源；React、antd、Ant Design Icons、Recharts、ahooks、lucide-react 等包依赖必须写 `import ... from '包名'`。严禁写未声明裸变量依赖或手写 window 依赖，例如 `const { Drawer } = antd`、`const { Search } = lucideReact`、`const { ConfigProvider } = window.antd`、`const React = window.React`、`window.icons`。宜搭运行态组件才通过 `window.Deep`、`window.DeepYida`、`window.YidaNativeComponents` 探测。
5. **使用 `YidaCodeCanvas` 组件契约**：页面代码写 `YidaComp` React 函数组件；数据、生命周期和渲染都通过 hooks、props、外层 yida JS-API 桥或连接器完成。组件内部不能直接写 `this.$(fieldId)`、`this.utils.yida.*` 或 `this.dataSourceMap`。
6. **副作用清理**：`useEffect` 注册事件、定时器、图表实例时必须返回 cleanup。
7. **交互控件必须受控且真正驱动数据**：筛选 `Select`、搜索 `Input`/`Input.Search`、周期切换、`Tabs`/`Segmented`、批量/重置 `Button` 等控件都用 `useState` 建立受控状态，绑定 `onChange`/`onClick`，并让 `Table`/列表/卡片的数据源通过 `useMemo` 按状态派生后渲染。切换筛选后若当前选中项失效，回退选中态（如 `selected < filteredRows.length ? selected : 0`）。
8. **视觉壳层必须消费 design.md**：写页面源码前，通过 `designRefs` 查询 `design.md` frontmatter 的 anchor 索引，读取当前页八项设计与对应共享组件、状态规则。页面外壳、焦点、布局、表面、动作、反馈和响应式都要落实，但不要求旧 `visualScaffold` 等字段。页面背景、组件样式和主题 Provider 只作用于 `YidaComp` 的组件子树，不修改平台容器；新页面的颜色映射由生成的 CanvasThemeProvider 负责。主题和当前页面明确的圆角、padding/gap、密度与分组节奏优先，通用数值只在未定义时兜底；同步到 CSS、antd 和真实布局，不用固定内距或大圆角覆盖已选主题。
9. **按数据来源接入**：表单页面填写 `dataBinding.mode="form"`、真实 `appType/formUuid` 和字段 ID，通过 `useYidaData(binding)` / `DataBridge` 调用 `window.__OPENYIDA_YIDA_API__.searchFormDatas(params)`。每行业务字段位于 `row.formData[fieldId]`；先按 `row.formData || row.data || row` 和真实字段 ID 转为页面行数据，再把表格 `dataIndex` 绑定到转换后的字段。根级工具使用 `window.__OPENYIDA_UTILS__`。连接器填写 `Http_*` 格式的 `connectorName`、`operationId`、`connectionId`，通过 `window.__OPENYIDA_CONNECTOR_API__.invoke(binding, inputs)` 调用，Body 传对象。密钥、Cookie 和签名由平台或后端保存。数据桥、同源接口兜底与字段映射见 [数据接入](references/data-bridge-guide.md)。
10. **表单排序只使用真实业务字段 ID**：`searchFormDatas` 的 `dynamicOrder` key 必须来自当前 `get-schema` 返回的真实业务字段 ID，禁止使用返回记录的元数据名 `gmtCreate`，不得生成 `dynamicOrder: { "gmtCreate": "-" }`。没有可排序的业务日期字段时删除 `dynamicOrder`；如仅需调整当前已取回页的展示顺序，可在响应解包后按 `row.createTime` 排序，但不能声称实现了跨页稳定排序。遇到 `selectListException 无法找到字段:gmtCreate` 时，先移除错误排序参数、重新回读 Schema 并使用真实字段 ID，再重新发布。
11. **分页查询默认写 50**：表单、流程、任务、成员等分页查询参数一般显式写 `pageSize: 50` 或 `pageSize: '50'`。只有用户明确要求小页或大页时才改成其他值，且不得超过平台上限 100。
12. **源码保持零未绑定标识符**：每个 import、辅助函数、Ref、状态、局部变量和函数参数都在同一文件声明后使用。非标准运行时能力通过 `window.<name>` 或 `parentWindow.<name>` 获取，调用前检查目标方法。`compileCanvasLocal` 报 `OPENYIDA_CANVAS_UNBOUND_IDENTIFIER` 时，一次修复 `details.issues` 中的全部名称，再重新编译。

非标准运行时能力使用以下写法：

```jsx
function setNavigationTitle(title) {
  const dingTalk = window.dd;
  if (typeof dingTalk?.biz?.navigation?.setTitle === 'function') {
    dingTalk.biz.navigation.setTitle({ title });
  }
}
```

> 编译通过后仍需检查变量拼写：`name`、`status`、`length`、`event`、`origin`、`top` 是浏览器全局名称，误写成这些名字时编译器也可能放行。

### 重要规则（IMPORTANT）

1. **按数据来源选择接口**：表单使用 yida 数据桥，平台连接器使用连接器桥，自定义同源业务接口使用明确的 endpoint。详见上方“按数据来源接入”。
2. **组件增强可降级**：门户、成员、部门、上传组件都做 feature detect 和 fallback；组件缺失时页面仍展示自绘基线。
3. **值先归一化**：成员、部门、文件的原始返回值保留到 `raw` 用于检查，业务 payload 使用统一结构。
4. **UI 改造保持功能契约**：页面美感提升、页面重构和局部美化只调整颜色、布局、密度、间距、视觉层级、素材和图标表达；已有数据源、字段映射、按钮动作、筛选逻辑、提交 URL、权限和业务状态按原有实现保留。
5. **页面跟随应用主题**：应用设置使用 `app-theme.css`；页面通过 `--color-brand1-*`、`--color-group` 和 `--pod-*` 取色。页面底色使用 `--pod-page-bg-color`，卡片使用 `--pod-card-bg-color`，抽屉整体背景使用 `--pod-shell-theme-bg-color`，正文容器保持透明；自绘导航页按 `design.md` 设置内部画布背景。样式限定在 `YidaComp` 内，应用主题通过 `update-app --theme-file` 更新。根节点使用 `display:flow-root` 或 flex/grid，将导航间距留在根节点内部。宿主背景和局部画布规则见 [样式指南](references/canvas-style-implementation-guide.md)。
6. **先验证再扩展业务**：原生组件、上传、组织搜索、弹层类能力先做 smoke 页面，确认 PC/移动端都可用后再进入复杂业务页面。
7. **按设计编写 UI，示例按需参考**：新建 `.canvas.jsx` / `.canvas.tsx` 时，直接按 PRD、`design.md`、真实数据和页面交互实现，允许从空文件编写。需要参考完整表单交互时，可执行 `openyida sample openyida-page-template canvas-form-drawer --output .cache/samples/form-drawer.canvas.jsx --var APP_TYPE=<appType> --var FORM_UUID=<formUuid>`；整页示例按需参考；含表单打开入口时，必须按下方“表单打开入口统一容器”整体合并抽屉片段，不能裁剪交互能力。页面其余布局、材质、留白、圆角和选中态按设计实现。未改写的示例不得直接发布；页面 UI、业务文案、交付说明和 final 中不出现内部示例名、生成过程或实现代号。使用示例时，发布前删除 `@openyida-page-template-base`、`SAMPLE_ROWS`、`{{APP_TYPE}}` / `{{FORM_UUID}}`、示例数据和占位文案。
8. **用文件编辑工具维护源码**：业务源码使用 Write/Edit/patch 编写，已有 JSX/CSS/JSON 源码只做定点 Edit。主题代码使用 `sample` 提取，或由 `scripts/build-canvas-theme.js` 插入标记处并输出独立文件。修改业务时编辑原始文件，再重新运行主题脚本。
9. **按整页关系配色**：业务列表、协同表、数据管理页、工作台和门户默认使用 light 模式；指标、按钮和选中态按 `design.md` 的颜色角色实现，可用与品牌不同但协调的颜色，不默认黑色或全部使用主色。按[指标卡与按钮配色](../yida-design/references/application-theme-consistency.md#指标卡与按钮配色)检查背景、前景、强调面积和交互状态。用户明确要求暗色大屏/夜间模式/高对比风格时使用深色主视觉。
10. **门户运行态组件要补必需 props 和局部降级**：`QuickAccessCard` / `RecentlyUsedCard` 传 `theme="row-white"` 等必需 props；所有门户/字段/上传增强组件外层加局部 ErrorBoundary，单个组件不兼容时只降级该块，整页保持可用。

11. **选择页面编写方式**：结构明确时直接编写 `.canvas.jsx`；使用生成器时，从 `prd.md + design.md` 整理 `page-spec.json`，填写 `sourceOfTruth.prdFile/designFile/designRefs/conflictPolicy`，生成后读取 CLI 摘要或 `.openyida-page.json`。业务缺漏补 PRD，视觉缺漏补 design.md，再更新 spec；源码中的布局、字段映射或编译问题直接 Edit/patch。详见 [页面生成](references/page-generation-guide.md)。
12. **实现骨架消费业务 spec**：品牌名、行业词、导航、指标、卡片标题、图片 alt、CTA、色彩 profile 和 section 说明来自当前业务 spec。若 CLI 报业务内容不足，补齐/改写 spec 或 patch 源码后重新生成/编译。
13. **页面产物使用纯文本业务文案**：`.canvas.jsx` 源码、`page-spec.json` 中会渲染到页面的文案、JS 注释、数据常量和产物文件路径都使用无 emoji 文本。页面生成、`compileCanvasLocal` 或 `publish` 报 emoji 错误时，先改 spec/源码/路径，再重新校验发布。若 emoji 原本承担图标含义，必须按 `design.md.iconSystem` 改成 `lucide-react` 或 `@ant-design/icons` 的具体组件，默认 `lucide-react`；不得用 CSS 绘制图形、单字母、首字母、标点符号、Unicode 符号或临时 SVG 冒充图标。
14. **JSX 文案只能是文本或字符串**：JSX 文案只能写成纯文本 `所有级别` 或带引号字符串 `{'所有级别'}`；筛选项、按钮、状态、空态和表格列名等中文业务文案都按此规则书写。花括号里只能放真实 JS 变量/表达式，不能把中文文案写成 `{所有级别}`、`{处理中}`；Unicode escape 被工具解码后也必须保留字符串引号。
15. **先区分应用导航与入口菜单**：按 PRD 应用 navigationType 和当前页 pageSpecHandoff.entryMode/navigation 执行。普通页默认保留平台导航，页面内 tab 不触发应用级隐藏；独立前台可有自己的顶部、侧边或底部菜单，执行 `use_skill("yida-nav-shell")` 的页面级分支，只配置当前页。仅整个应用采用自定义导航时才执行 `openyida update-app <appType> --hide-app-nav`；不得因前台 custom 隐藏后台应用菜单。
16. **表单提交必须接入提供的抽屉模板**：前台、后台、Fast、Plan 的页面内新增、报名、申请、预约等普通表单提交，以及表单详情入口，统一使用 `FormOpenContainer`；不能因为页面是全码开发就自绘填写表单并直接调用提交 API，也不能由 AI 自行改成普通链接、新窗口或简化弹层。先执行 `openyida sample openyida-page-template form-open-container --output .cache/samples/form-open-container.jsx`，整体合并 `CanvasDrawer` / `FormOpenContainer` / `useYidaFormOpen` 及其 import 和辅助函数。业务按钮调用 `openForm`，页面 JSX 必须渲染 `formOpenContainer`，接入真实表单、实例 ID 和刷新函数。保留三个标题栏图标操作、拖拽调宽、关闭刷新和 iframe 自适应高度；移动端打开方式由模板处理。只能通过主题变量和现有 props 调整外观，不重写外壳。搜索筛选不是表单提交；已明确的表格批量录入沿用专用技能。应用级导航已确定在主内容区嵌入原生提交页时按 [入口用途](../yida-nav-shell/references/nav-shell-patterns.md#入口用途与嵌入页面) 执行；不能以此绕过页面内按钮的抽屉要求。接入步骤见 [标准容器](references/navigation-and-entry-guide.md#接入示例)。
17. **图标资源固定为可加载库**：页面图标只使用 `lucide-react` 或 `@ant-design/icons`，默认使用 `lucide-react` named import。只有页面已经采用 Ant Design 图标语言、或 antd 组件语境需要 Outlined 图标时，才使用 `@ant-design/icons`。快捷入口、按钮、状态、导航和空态图标在写源码前先建立 `actionIconMap` / `statusIconMap`，按业务语义映射到具体组件，例如 `Plus`、`Upload`、`Download`、`Eye`、`Building2`、`AlertCircle`、`Check`。图标外层可以用 CSS 控制尺寸、颜色、圆角、背景和 hover，但图标本体必须来自上述两类组件，不能用 CSS 形状、字母或 emoji 替代。包名可用不代表任意图标都存在；以宜搭运行时导出为准，不照搬最新版官网名称。`OPENYIDA_CANVAS_ICON_EXPORT_UNAVAILABLE` 必须修正具体 import 后重新编译；动态名称使用显式组件映射并提供可用图标兜底，详见 [运行时图标校验](references/component-library-guide.md#运行时图标校验)。

18. **对话框统一消费主题 token**：新增或改造对话框时，执行 `openyida sample openyida-page-template canvas-dialog --output .cache/samples/canvas-dialog.jsx`，将 `CanvasDialog` 合并到当前页面并接入业务状态，见 [对话框](references/dialog-guide.md)。标题、正文、背景、页脚、关闭按钮和操作按钮均消费应用 token；整体暗色适配与导航明暗分别判断。

19. **Header 工具操作默认用图标按钮**：页面、卡片、弹窗和抽屉标题栏中的刷新、新窗口打开、全屏、关闭等工具操作，默认使用无可见文字的图标按钮，并提供 `title` 提示、`aria-label` 和键盘焦点样式。新增、提交、保存等业务主操作可保留文字。表单抽屉必须保留新窗口打开、全屏/退出全屏、关闭三个图标按钮，不能简化为文字链接或省略全屏；实现与验收见 [标准 FormOpenContainer](references/navigation-and-entry-guide.md#标准-formopencontainer)。

20. **同色页面与卡片要有边界**：白色或近白背景上的白色独立卡片、面板、表格外壳，使用细边框或清晰柔和的投影区分层级；浅灰或浅彩色背景上的白卡默认无边框，利用底色对比形成层级。边框使用主题中性分割线 token，投影沿用应用已确认的阴影规则，不默认叠加边框和投影。无框内容区不强行卡片化，iframe 外层不加卡片。实现及验收见 [同色表面的卡片边界](references/canvas-style-implementation-guide.md#同色表面的卡片边界)。

## 主题实现入口

纯 DOM 页面直接消费平台 CSS 变量，不必引入 antd 或 Provider。按 [共用主题规则](../yida-design/references/application-theme-consistency.md) 引用画布、卡片、文字与特色角色；风格缺项回写设计源，不在页面根复制固定色盘。

antd 页面使用 CanvasThemeProvider，图表通过 useCanvasThemeContext 取色。`sample` 输出的表单抽屉、批量表格和趋势图页面已包含主题与加载遮罩防闪边样式，合并代码时保留 Provider 内的 style；其他页面及旧页面升级按 [主题接入步骤](references/canvas-theme-provider.md) 操作。

页面入口按 `YidaComp → CanvasThemeProvider → PageContent` 组织，主题 hook 放在 PageContent 或其子组件内。编译通过后，打开实际页面检查首屏、主题和交互。

## 接入真实数据

- 完整应用或真实交付页先解析真实 `appType/formUuid/fieldId`，并在 `page-spec.json` 写入 `dataBinding.mode=form`。
- 完整应用默认先用 `yida-data-management` 把 1-3 条业务化 seed records 写入核心普通表单并抽查，再让页面读取；前端静态数据只能用于明确标注的离线演示态。
- 生成后如果 `.openyida-page.json` 的 `dataBinding.enabled !== true`，且页面仍展示列表/看板/详情业务记录，交付状态标为草稿；完整应用 final 只有在真实数据绑定已启用并验证后表述为“已接真实数据”。
- 未接数据的交付页保留真实空态、登记入口、刷新按钮和数据接入提示。

## 开发流程

下面命令从工作区根执行；cwd 已是 `<workspace>/project` 时，把 `project/pages/src/...` 改为 `pages/src/...`。文件内容使用当前工具的 Read / Glob / Grep 读取。

```bash
# 1. 只读检查环境、登录态和可用能力；真实创建资源前必须通过
openyida agent-capabilities --summary-json

# 2. 如需新页面，先创建空白自定义页拿 formUuid
openyida create-page <appType> "<页面名>"

# 3. 按 yida-prd 的 prd.md + yida-design 的 design.md 生成或编写 .canvas.jsx 源码；结构化实现路径再读取派生 page-spec.json
# 结构化实现路径：先从 prd.md + design.md 派生 page-spec.json，生成可编译骨架后基于 manifest/摘要做小范围 patch。
# 手写路径：已明确最终页面结构、数据桥和样式细节时，直接 Write 最终 .canvas.jsx。

# 使用 Provider 标记时，先按主题脚本指南生成 <页面名>.themed.canvas.jsx；以下快检与发布都改用该生成文件。
# 4. 本地快检
openyida compile project/pages/src/<页面名>.canvas.jsx --json

# 5. 发布（本轮修改源码后的远端完成证据）
openyida publish project/pages/src/<页面名>.canvas.jsx <appType> <formUuid>

# 6. 发布后回读字段摘要验收；如需留证，用结构化文件写入工具保存 stdout，不用 shell 重定向
openyida get-schema <appType> <formUuid> --field-map-json
```

导航生成前读取 [页面与导航连续性](../yida-design/references/page-continuity.md)。纯页内展示直接切换本地视图或用 canvas-nav-data 的 local 模式；真实资源才按 platform/independent 过滤。长页提取最新 canvas-nav-content，使用 document 自然高度；顶部模板以 headerOnly 接入，有首屏背景用 overlay。`OPENYIDA_CANVAS_NAVIGATION_INVALID` 按 details.issueType 和源码行修正，禁止删除检查或回退全量菜单；动态数据与宿主滚动仍需实际浏览器验收。

`openyida compile` 会自动识别 `.canvas.jsx` / `.canvas.tsx` 并调用 Canvas 编译器；`--json` 返回可机器读取的 hash 和依赖清单。该命令只读、无需登录、不访问网络、不发布页面，也不写入构建产物。`openyida publish` 仍是远端写入证据。

云端与本地 Agent 都使用同一条 `openyida compile <页面源码.canvas.jsx> --json` 快检命令，不依赖仅云端 Builder 提供的 `run_workspace_script`。

其他确需保存的云端 workspace 脚本放在项目根 `.cache/yida-agent/scripts/...`，不要写 `project/.cache/...`，否则运行时会解析成重复的 `project/project/.cache/...`；Canvas 快检本身不需要创建脚本。

如需保存完整 Schema，使用 create_file / Write / file edit tool 创建 `<projectRoot>/.cache/openyida/<页面名或任务名>/<页面名>-schema.json`；从 workspace 根执行后续 Bash 命令时路径加 `project/` 前缀。

## 参考文档

| 文档 | 覆盖范围 | 何时阅读 |
| --- | --- | --- |
| [page-generation-guide.md](references/page-generation-guide.md) | PRD 到自定义页面实现入口、官网素材、应用主题、Page Spec、primitives | 写页面前必读 |
| [navigation-and-entry-guide.md](references/navigation-and-entry-guide.md) | 应用内页面、表单、外链和跨应用快捷入口的导航职责与跳转方式；含 `FormOpenContainer` 标准容器 | 工作台/门户含快捷入口、表单新增或详情查看时必读 |
| [native-components-bridge.md](references/native-components-bridge.md) | 门户、成员、部门、上传组件桥接和值归一化 | 需要宜搭运行态组件时必读 |
| [dependencies-and-cdn.md](references/dependencies-and-cdn.md) | 可用前端资源、import 写法、运行时加载方式 | 选择或验证前端资源时必读 |
| [employeefield-verification.md](references/employeefield-verification.md) | 运行时事实、原生组件验证、EmployeeField 验收 | 验证成员/字段组件时阅读 |
| [data-bridge-guide.md](references/data-bridge-guide.md) | 表单、平台连接器与自定义同源接口的数据桥 | 接入真实数据时阅读 |
| [canvas-theme-provider.md](references/canvas-theme-provider.md) | 统一主题接入、示例装配、预览与发布 | 编写或调整 antd 页面时必读 |
| [canvas-style-implementation-guide.md](references/canvas-style-implementation-guide.md) | 将 `design.md` 的 App 主题色、antd token、背景层、卡片边界、圆角密度、控件焦点/下拉 reset、图表配色落到 `YidaCodeCanvas` 组件 | MUST：新建页面或调整视觉前完整读取，见顶部编码前必读 |
| [component-library-guide.md](references/component-library-guide.md) | 组件库推荐组合和页面选型建议 | 选择 UI/图表依赖时阅读 |
| [canvas-authoring-examples.md](references/canvas-authoring-examples.md) | 最小组件、hooks、副作用、图表示例 | 手写 `.canvas.jsx` 代码时阅读 |
