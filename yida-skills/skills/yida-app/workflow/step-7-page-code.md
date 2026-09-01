# Step 7：编写或更新页面

按 `prd.md` 和 `design.md` 实现页面。页面源码通过本地校验只表示“可发布”，不表示远端页面已更新。

## 输入

- `prd/<项目名>/prd.md`；
- `prd/<项目名>/design.md`；
- 真实 `appType`、主页面 `formUuid`；
- `.cache/<项目名>-schema.json`；
- Step 5 写入的 seed records 或跳过原因。

## 操作

1. 自定义页面开发执行 `use_skill("yida-canvas-custom-page", "生成主页面源码")`。
2. PRD 或页面名包含看板、工作台、驾驶舱、Dashboard 时，必须执行 `use_skill("yida-dashboard", "实现真实业务看板")`。
3. 页面读取任一表单数据时，必须执行 `use_skill("yida-canvas-data-binding", "为页面接入真实表单数据")`；不得以“页面已经能发布”为由跳过。
4. 页面结构已明确且适合生成器时，从 PRD + `design.md` 派生当前业务自己的 `page-spec.json`。
5. `page-spec.json` 写 `sourceOfTruth`、`prdFile`、`designFile`、`designRefs` 和 `conflictPolicy: "prd-design-win"`。
6. 列表、看板、详情页读取真实表单数据时，写 `dataBinding.mode=form`、真实 `appType/formUuid/fieldId` 和字段映射；禁止静态 0 或 mock 数据作为交付值。
7. 页面源码默认不自绘应用级侧边导航、顶部应用导航或同级模块菜单；PRD 的导航顺序交给 Step 8 的平台导航排序处理。只有用户显式要求在自定义页面内实现自己的应用级导航、隐藏应用导航或独立全屏应用壳时，才执行 `use_skill("yida-nav-shell")`。
8. 没有真实数据时，页面展示空态、表单入口、刷新或登记按钮。
9. 页面源码用 `.canvas.jsx` / `.canvas.tsx`、`YidaComp`、页面生成器或本地快检。

## 事实源修正

| 问题类型 | 修改位置 |
| --- | --- |
| 页面目标、业务对象、指标口径、主操作、表单入口、数据来源、空/载/错业务语义不足或错误 | 回写 `prd.md`，再重新派生 `page-spec.json` |
| 主题关系、token、视觉脚手架、背景、材质、圆角、密度、组件、状态或响应式规则不足或错误 | 回写 `design.md`，再重新派生 `page-spec.json` 或重读 `design.md` 实现 |
| `page-spec.json` 缺少 sourceOfTruth、design 指针、dataBinding，或与 PRD/design.md 不一致 | 丢弃并从最新 PRD + `design.md` 重生成 |
| PRD、design.md 和 spec 都完整，但源码有 className、布局比例、字段映射、响应式、loading/empty/error 或编译错误 | 小范围 patch 源码 |

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
- [ ] 页面源码没有 emoji 和裸中文 JSX 表达式；
- [ ] Canvas 本地校验不存在未绑定标识符；辅助函数、Ref、状态和局部变量的声明与全部引用同名；非标准运行时能力通过 `window.<name>` / `parentWindow.<name>` 显式访问并先检查属性是否存在；
- [ ] 本地校验通过，或已有明确错误和修复动作。

## 下一步

→ [Step 8：发布页面并排序导航](step-8-publish-navigation.md)
