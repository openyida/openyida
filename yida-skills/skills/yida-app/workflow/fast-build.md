# Fast 直接搭建

Fast 从已确认需求直接准备短执行清单，生成 `build-context.json` 和 **`app_theme.css`**。不生成独立 PRD、design.md、Plan HTML、revision 或 page-spec；不调用完整 PRD/长设计文档生成链。Plan 仍按原流程物化、确认并实施。五分钟是少量简单页面的优化目标，以实际墙钟记录验证，不跳过业务、权限或验收。

## 一次准备

先复用已读的能力快照、主题目录和用户选择；只追问影响实际功能的缺失事实。已有明确需求不重复提问。需求分析结果可直接放入短清单的 `intake`、`explicitScope`、`constraints`，不为 Fast 另外写需求文档。

```bash
openyida sample yida-app fast-spec --output .cache/openyida/fast-app.json
# 按真实需求修改 JSON 后执行；示例的主题、页面和文案不是默认选择
openyida sample yida-app fast-build --spec-file .cache/openyida/fast-app.json --output .cache/openyida/build
```

输入复用短视觉字段 `name/themeId/primaryColor/direction/navigation/pages/assetStrategy`，加 `mode: fast`、`resources`、`roles`、`businessRules`、`acceptanceChecks`。视觉字段见 [短输入字段](../../yida-design/references/fast-design-spec.md)，只读字段说明，不执行其中 design.md 生成步骤。每页写真实任务、区块、交互状态、响应式和验收；同一连续官网可用一个页面多个视图，用户要求独立页面/地址时保留独立资源。

`resources` 只列需要保存数据、流程、报表或自动化的资源：`key/name/type`，新普通/流程表单提供 create-form 支持的 `fields`，复用资源写真实 `formUuid`，依赖写 `dependsOn` 的资源 key。展示页面放 `pages`，页面的 `dataSources` 引用资源 key。`roles` 用 `{name, scope, operations: [...]}` 明确服务端数据范围与业务操作；`businessRules` 和 `acceptanceChecks` 是具体字符串数组。不适用时数组写 `[]`，总体验收必须非空。资源、角色与规则声明不是平台落地证据。

仅展示内容不自动增加后台、表单、测试数据或角色。用户要求数据库、提交保存、后台、角色隔离和审批时全部保留，并按既有数据与权限技能实施。明确禁止项保持原义：`theme-file` 禁止时不生成或上传 CSS；`page-source`、`publish` 禁止时不写源码或发布。

CLI 内部复用严格主题、颜色对比和素材结构校验，一次返回 `details.issues`；不让模型拼接长 token 文档。`--check` 只校验不写文件；相同输入可重复执行，已存在的不同输出拒绝覆盖。修改需求或主题时生成新版本目录，核验后切换当前上下文，不覆盖已发布版本的事实记录。

## 直接实施

1. 以生成的上下文作为业务与视觉源，CSS 必须保留并应用。真实 appType 就绪后按 Step 3 及既有主题能力/作用域规则上传 `outputs.theme`，使用返回的 `theme.themeColor/navTheme`，回读核验。CSS 不是发布页面时自动安装的。
2. 无依赖资源、主题配置、各页源码按真实工具能力并行；每页只有一个写入者。资源 ID、字段映射、发布回执、任务编号写独立 build-manifest。权限配置与数据回读不能靠前端隐藏或声明代替。
3. 直接按上下文和应用主题编写 `.canvas.jsx/.canvas.tsx`，执行既有检查、编译和发布。默认不派生 page-spec，不为编译补造 PRD/design.md。需要原生表单抽屉时整体合并 form-open-container 的 import、辅助函数和操作。页面只等待自己需要的真实 ID、字段与素材。
4. 生成结果含 `assetTasks`，按实际宿主能力后台派发后继续业务工作；同步工具先做独立业务再执行有限素材批次。使用任务返回的 `resolve.argv`（含 `--build-spec`）并传真实工具来源。素材整次共用60秒截止、单请求15秒，不 sleep 等重试；缺图只阻塞该页最终图片验收，先交付已有授权的可用首版，补图只改绑定。
5. 页面就绪各自发布，统一处理必要导航与入口。校验失败一次处理结构化问题，只重跑受影响项；未知写入先回读，复用已创建资源及源码，不重新整包生成。
6. 保存真实 build-manifest，收尾运行下列命令。资源、导航与主题回读复用原检查；角色、业务规则、真实数据与交互仍按 Step 9 验收，未验证的如实保留。

```bash
openyida check-prd-completeness --build-spec .cache/openyida/build/build-context.json --app-type <appType> --build-manifest <build-manifest.json> --json
```

## 耗时记录

分别记录准备/契约、资源/主题、页面源码、编译发布、业务验收与素材的真实开始和结束时间；总耗时按墙钟计算，不累加重叠区间。简单展示页参考预算：准备60秒、资源主题45秒、实现发布150秒、验收45秒。完整数据库、角色与审批按实际复杂度记录，不能据此宣称已实现五分钟。超时继续完成授权任务，分别标记推理、权限等待、生成工具和平台请求耗时。
