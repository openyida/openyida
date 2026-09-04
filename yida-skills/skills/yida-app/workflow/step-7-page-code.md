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

1. 自定义页面开发执行 `use_skill("yida-canvas-custom-page", "生成当前页面源码")`。根据 PRD 和 `design.md` 直接编写 `.canvas.jsx` / `.canvas.tsx`；允许从空文件实现完整 UI。内置示例按需用于理解数据接入、导航和表单交互，不要求复制整页，也不能用示例默认外观替代已确认的设计。已有符合设计的页面可继续迭代。
2. PRD 或页面名包含看板、工作台、驾驶舱、Dashboard 时，必须执行 `use_skill("yida-dashboard", "实现真实业务看板")`。
3. 页面读取任一表单数据时，必须执行 `use_skill("yida-canvas-data-binding", "为页面接入真实表单数据")`；不得以“页面已经能发布”为由跳过。
4. 页面结构已明确且适合生成器时，从 PRD + `design.md` 派生当前业务自己的 `page-spec.json`。
5. `page-spec.json` 写 `sourceOfTruth`、`prdFile`、`designFile`、`designRefs` 和 `conflictPolicy: "prd-design-win"`。
6. 列表、看板、详情页读取真实表单数据时，写 `dataBinding.mode=form`、真实 `appType/formUuid/fieldId` 和字段映射；禁止静态 0 或 mock 数据作为交付值。
7. 页面代码默认消费发布层自动注入的 `window.__OPENYIDA_YIDA_API__` 和 `window.__OPENYIDA_UTILS__`：表单/流程/表单设计 API 走 yida API 桥，`toast/dialog/openPage/router.push/isMobile` 走 utils 桥；`YidaComp` 内不得直接调用 `this.utils.yida.*` 或 `this.utils.*`。
8. 表单、流程、任务、成员等分页查询一般显式写 `pageSize: 50` 或 `pageSize: '50'`，除非用户明确要求其他页大小。
9. 表单新建/提交/详情入口统一使用 `FormOpenContainer`，PC 端右侧抽屉 iframe，移动端整页或新页打开；详情必须从真实行解析 `formInstId`，缺失时禁用入口或提示。
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
- [ ] 页面没有默认自绘应用级侧边导航 / 顶部导航；如有页面内自绘导航，已有用户显式要求和 `yida-nav-shell` 依据；
- [ ] 页面数据优先接真实表单；
- [ ] 看板/工作台/驾驶舱已加载 `yida-dashboard`，读取表单数据时已加载 `yida-canvas-data-binding`；
- [ ] Canvas 页面消费 `window.__OPENYIDA_YIDA_API__` / `window.__OPENYIDA_UTILS__`，没有直接调用 `this.utils.*`；
- [ ] 表单新建/详情入口使用 `FormOpenContainer`，详情入口不打开空 `formInstId`；
- [ ] 页面源码没有 emoji 和裸中文 JSX 表达式；
- [ ] 页面视觉符合 `design.md`，未把示例默认外观当成设计结论；使用示例时已删除标记、示例数据、模板变量和占位文案；
- [ ] Canvas 本地校验不存在未绑定标识符；辅助函数、Ref、状态和局部变量的声明与全部引用同名；非标准运行时能力通过 `window.<name>` / `parentWindow.<name>` 显式访问并先检查属性是否存在；
- [ ] 本地校验通过，或已有明确错误和修复动作。

## 下一步

→ [Step 8：发布页面并排序导航](step-8-publish-navigation.md)

不同页面的源码和本地检查按 [并行执行](parallel-work.md) 分配独立文件与输出目录，共享导航与组件由主流程维护。
