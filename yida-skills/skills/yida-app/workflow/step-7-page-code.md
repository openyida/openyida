# Step 7：编写或更新页面

按 `prd.md` 和 `design.md` 实现页面。页面源码通过本地校验只表示“可发布”，不表示远端页面已更新。

页面开发消费已确认的设计与 token 契约，不等待主题文件上传或页面导航配置请求。页面创建/复用取得 formUuid 后，页面导航隐藏应由独立配置任务立即执行并回读，与本步骤并行。主题任务应在 CSS 和 appType 就绪时立即更新应用设置；视觉验收前核对其回读结果，不在本步骤结束后才启动主题更新。

无直接依赖的页面按 [页面并行规则](parallel-work.md#页面按实际依赖并行) 同时开发，每页只等待自身需要的资源，不按导航顺序串行。共享主题或同一已就绪表单不构成页面间依赖；当前页就绪即可进入发布步骤，导航排序等待全部页面完成。

## 输入

- `prd/<项目名>/prd.md`；
- `prd/<项目名>/design.md`；
- 真实 `appType`、当前页面 `formUuid`；
- `.cache/<项目名>-schema.json`；
- Step 5 写入的 seed records 或跳过原因。

## 操作

**编码前置条件（MUST）**：新建 Canvas 页面或调整视觉时，执行页面开发的模型必须先完整读取 [canvas-style-implementation-guide.md](../../yida-canvas-custom-page/references/canvas-style-implementation-guide.md)，按 [编码前必读](../../yida-canvas-custom-page/SKILL.md#编码前必读must) 记录适用规则与落点，再写源码。派发页面任务时必须带上这个文件路径和读取要求；不能只传递设计摘要或认为主流程读过就等于页面实现者读过。

先读取 `constraints.prohibitedActions`。命中 `page-source` 时，本步骤只能做 Read、编译/静态检查等只读诊断，不得 Write/Edit/Create 页面源码，也不得用脚本、格式化器或生成器间接改写；输出应明确“源码未修改”并跳过依赖源码变更的发布。未命中时才执行下列源码实现动作。

1. 自定义页面开发执行 `use_skill("yida-canvas-custom-page", "生成当前页面源码")`。根据 PRD 和 `design.md` 直接编写 `.canvas.jsx` / `.canvas.tsx`；允许从空文件实现完整 UI。内置整页示例按需用于理解数据接入和导航；表单抽屉片段必须按第 9 条整体合并，不要求复制整页，也不能用示例默认外观替代已确认的设计。已有符合设计的页面可继续迭代。
2. PRD 或页面名包含看板、工作台、驾驶舱、Dashboard 时，必须执行 `use_skill("yida-dashboard", "实现真实业务看板")`。
3. 页面读取任一表单数据时，必须执行 `use_skill("yida-canvas-data-binding", "为页面接入真实表单数据")`；不得以“页面已经能发布”为由跳过。
4. 页面结构已明确且适合生成器时，从 PRD + `design.md` 派生当前业务自己的 `page-spec.json`。
5. `page-spec.json` 写 `sourceOfTruth`、`prdFile`、`designFile`、`designRefs` 和 `conflictPolicy: "prd-design-win"`。
6. 列表、看板、详情页读取真实表单数据时，写 `dataBinding.mode=form`、真实 `appType/formUuid/fieldId` 和字段映射；禁止静态 0 或 mock 数据作为交付值。
7. 页面代码默认消费发布层自动注入的 `window.__OPENYIDA_YIDA_API__` 和 `window.__OPENYIDA_UTILS__`：表单/流程/表单设计 API 走 yida API 桥，`toast/dialog/openPage/router.push/isMobile` 走 utils 桥；`YidaComp` 内不得直接调用 `this.utils.yida.*` 或 `this.utils.*`。
8. 表单、流程、任务、成员等分页查询一般显式写 `pageSize: 50` 或 `pageSize: '50'`，除非用户明确要求其他页大小。
9. **MUST**：含页面内表单新建/提交/详情打开入口的 Canvas 页面，必须先执行 `openyida sample openyida-page-template form-open-container --output .cache/samples/form-open-container.jsx` 拉取当前模板，整体合并 `CanvasDrawer` / `FormOpenContainer` / `useYidaFormOpen` 及依赖的 import、辅助函数。禁止自绘 fixed 遮罩 + iframe 抽屉壳；以源码及打开后的 DOM 存在 `.openyida-form-drawer` 为必要检查项，不能只加类名。入口统一使用 `FormOpenContainer`，PC 端右侧抽屉 iframe，移动端整页或新页打开；详情必须从真实行解析 `formInstId`，缺失时禁用入口或提示。应用级办理导航在主内容区嵌入提交页的场景仍按导航规范处理，不强制改成抽屉。
10. 页面源码默认不自绘应用级侧边导航、顶部应用导航或同级模块菜单；PRD 的导航顺序交给 Step 8 的平台导航排序处理。PRD 导航类型为自定义导航，或用户显式要求在自定义页面内实现自己的应用级导航、隐藏应用导航或独立全屏应用壳时，执行 `use_skill("yida-nav-shell")`。
11. 没有真实数据时，页面展示空态、表单入口、刷新或登记按钮。
12. 页面源码用 `.canvas.jsx` / `.canvas.tsx`、`YidaComp`、页面生成器或本地快检。
13. 发布前必须删除 `@openyida-page-template-base`、`SAMPLE_ROWS`、`{{APP_TYPE}}` / `{{FORM_UUID}}`、示例数据和占位文案；内部模板名不得出现在页面 UI 或面向用户的 final 中。

## 事实源修正

| 问题类型 | 修改位置 |
| --- | --- |
| 页面目标、业务对象、指标口径、主操作、表单入口、数据来源、空/载/错业务语义不足或错误 | 回写 `prd.md`，再重新派生 `page-spec.json` |
| 主题关系、token、视觉结构、背景、材质、圆角、密度、组件、状态或响应式规则不足或错误 | 回写 `design.md`，再重新派生 `page-spec.json` 或重读 `design.md` 实现 |
| `page-spec.json` 缺少 sourceOfTruth、design 指针、dataBinding，或与 PRD/design.md 不一致 | 丢弃并从最新 PRD + `design.md` 重生成 |
| PRD、design.md 和 spec 都完整，但源码有 className、布局比例、字段映射、响应式、loading/empty/error 或编译错误 | 小范围 patch 源码 |

Plan 模式下，上表涉及 PRD/design 的修正均由对应技能更新 `build-plan.json` 源事实，再物化并重新确认；不得直接编辑派生产物。主题 token 变化后重新运行带 `--design-file` 的 sample 命令生成 CSS。

## 产出

- 本轮修改过的页面源码路径；
- `page-spec.json` 或直接手写实现说明；
- 本地校验结果；
- dataBinding 状态。

## Checklist

- [ ] 页面实现已读取 PRD 和 `design.md`；
- [ ] 新建页面或调整视觉前，实际实现者已完整读取 `canvas-style-implementation-guide.md`；检查记录包含文件路径、适用章节和页面落点，工具读取结果未遗漏截断部分；仅改数据逻辑时说明不适用原因；
- [ ] 页面没有默认自绘应用级侧边导航 / 顶部导航；如有页面内自绘导航，已有用户显式要求和 `yida-nav-shell` 依据；
- [ ] 自定义导航已提取 `canvas-nav-content` 并合并 `CanvasNavigationContent`；源码和 DOM 存在 `.openyida-nav-layout`、`.openyida-nav-content`，且实际测量内容撑满剩余空间、iframe 与视口等高、底部按钮可到达；只加类名不算通过；
- [ ] 自定义应用导航默认只切主内容区；原生提交/管理入口嵌入 iframe，整页跳转仅用于已确认保留同一导航壳的目标，不直接离开到无导航的原生页面；
- [ ] 自定义导航页已明确画布、浮导与卡片搭配；浅色非白或渐变画布默认白色浮导、白色无框卡片，局部背景未修改平台宿主或全局变量；
- [ ] 页面数据优先接真实表单；
- [ ] 看板/工作台/驾驶舱已加载 `yida-dashboard`，读取表单数据时已加载 `yida-canvas-data-binding`；
- [ ] Canvas 页面消费 `window.__OPENYIDA_YIDA_API__` / `window.__OPENYIDA_UTILS__`，没有直接调用 `this.utils.*`；
- [ ] 含页面内表单打开入口时，已成功执行 `openyida sample openyida-page-template form-open-container --output .cache/samples/form-open-container.jsx` 并记录输出路径；没有此类入口时明确标记不适用；
- [ ] 已整体合并 `CanvasDrawer` / `FormOpenContainer` / `useYidaFormOpen`、import 和辅助函数，各保留一份定义；源码搜索命中 `openyida-form-drawer`，入口实际调用 `openForm` 并渲染 `formOpenContainer`，未自绘 fixed 遮罩 + iframe 外壳；
- [ ] 表单容器搜索命中 `contentMode="iframe"`、`oy-drawer-frame`、`oy-drawer-resize`，保留自适应高度和拖拽调宽；header 保留 `ExternalLink`、`Maximize2` / `Minimize2`、`X` 图标及可访问名称；
- [ ] 详情入口不打开空 `formInstId`，关闭后刷新、移动端打开路径已接入；
- [ ] 页面源码没有 emoji 和裸中文 JSX 表达式；
- [ ] 页面视觉符合 `design.md`，未把示例默认外观当成设计结论；使用示例时已删除标记、示例数据、模板变量和占位文案；
- [ ] Canvas 本地校验不存在未绑定标识符；辅助函数、Ref、状态和局部变量的声明与全部引用同名；非标准运行时能力通过 `window.<name>` / `parentWindow.<name>` 显式访问并先检查属性是否存在；
- [ ] 白色或近白背景上的白卡已有主题细边框或清晰投影；浅灰、浅彩背景上的白卡默认无边框并有足够底色对比；方案在 `design.md` 中明确，未给表单 iframe 外层加卡片；
- [ ] 本地校验通过，或已有明确错误和修复动作；若禁止 `page-source`，修复动作只作为建议，未实际改写源码。

上述搜索用于检查必要标记，不证明接入或交互正确。可执行 `rg -n 'openyida-form-drawer|CanvasDrawer|FormOpenContainer|useYidaFormOpen|openForm|formOpenContainer|oy-drawer-frame|oy-drawer-resize|contentMode|ExternalLink|Maximize2|Minimize2' <页面源码>` 辅助核对；注释、未使用的定义或仅类名命中不能勾选通过。发布后的 DOM 与按钮行为由 Step 8 验证。

## 下一步

→ [Step 8：发布页面并排序导航](step-8-publish-navigation.md)

不同页面的源码和本地检查按 [并行执行](parallel-work.md) 分配独立文件与输出目录，共享导航与组件由主流程维护。
