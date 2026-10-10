# Step 8：发布页面并排序导航

发布本轮修改过的页面源码到真实 display 页面，并执行轻量导航排序。平台导航排序必须等待本轮全部页面开发、发布和相关资源创建完成；逐页发布期间不触发平台排序，主页面先完成也不能提前触发排序。自定义菜单在页面开发时按已确认顺序实现，发布后统一验收。

## 输入

- 本轮修改过的页面源码路径；
- 真实 `appType`；
- 主页面 display `formUuid`；
- PRD 中的导航顺序；
- PRD 主页面的 `entryMode`。

## 自定义导航分支

无论是否分前后台，自定义导航均按 [首页与菜单顺序](../references/entry-navigation.md#每个入口都确定首页与菜单顺序) 实施：发布前核对每个入口菜单数组及分组顺序、`defaultMenuKey` 对应的页面/视图，发布后从实际入口验证首屏。`frontend-only` 不调用平台排序命令，但必须完成上述排序和验收。

PRD 的应用工作区导航 `execution.appConfig.navigationType=custom` 时，页面导航已在 Step 4 / Step 6 创建或复用页面后按 [导航壳必做配置](../../yida-nav-shell/SKILL.md#必做配置) 隐藏并回读，与源码开发并行。本步骤发布并检查本轮全部自定义页面，再回读核对 `renderNav=false`；缺失或被发布改变时才补写修复，不把首次隐藏推迟到发布后。导航顺序由自定义导航实现；汇总 Step 4 / Step 6 的配置结果与发布后回读结果，覆盖 PRD 全部页面后进入 Step 9。下方平台导航排序仅适用于三种平台导航类型。

运行态按 [导航验收](../../yida-nav-shell/references/nav-shell-patterns.md#验证) 检查实际外观与交互：顶部导航形态与首屏/滚动态符合设计，侧导可折叠、恢复宽度和拖拽；管理与填写入口分别落到 workbench/submission，主内容 iframe 与当前标签跨页按规划工作，完整地址没有重复应用前缀，query/hash 保留。抽屉 iframe 同时检查填满剩余高度、外层无重复滚动和内页可滚动性，不能仅凭编译通过验收。

## 操作

若 `constraints.prohibitedActions` 含 `publish`，跳过本步骤的所有 `openyida publish` 写操作并记录“未发布”；不得以历史版本、编译成功或现有 URL 冒充本轮发布。若因 `page-source` 禁止而本轮没有源码变更，也不得用一次无变化发布伪造完成证据。

1. 对本轮各页面执行 `use_skill("yida-publish-page", "发布已完成页面")`；`<source>` 使用本轮修改过的源码，`<displayPageFormUuid>` 使用该页真实 ID。逐页发布不触发导航排序：

```text
openyida publish <source> <appType> <displayPageFormUuid> --canvas --health-check
```

2. 主流程核对本轮全部页面已开发完成并发布成功、表单/流程等导航目标已创建。仍有任务未完成或失败时，继续处理对应任务，暂不排序。
3. 全部页面与资源汇合后，仅需配置平台导航时，根据 PRD 选择下列一个分支；只使用自定义导航的入口继续做页面排序验收，不调用平台排序命令：

PRD 写明页面/表单清单顺序：

```text
openyida nav-group order <appType> <页面/表单...>
```

显式排序只执行一次。

完整应用的 PRD 缺少明确顺序时，先按各角色的首要任务补齐入口 `menu` 和 `defaultMenuKey`，再执行显式排序。不能用页面名称、创建顺序或自动猜测代替首页决定。用户明确要求自动整理平台菜单时可使用：

```text
openyida nav-group auto-order <appType>
```

此分支只执行一次 `auto-order`，不再执行显式 `order`。完整应用逐页发布均不带 `--auto-nav-order`；存量平台 JSX 页面发布去掉 `--canvas`。

4. 同一搭建 Run 不得同时执行显式排序与自动排序，不生成逐项 `move` 的 Bash/Python 循环。
5. 逐入口落实任务顺序与默认页：平台菜单消费 entryRecommendation 派生的 navigationOrder；自定义菜单消费该入口的 menu 和 defaultMenuKey。前台首页不自动进入后台，frontend-only 仍需完成前台菜单排序。
6. 从本轮交付的每个业务入口检查实际菜单顺序、默认页面、具体视图和首屏内容。平台排序 `readbackVerified=true` 不证明首页已正确；根入口仍打开错误任务时，继续处理平台支持的默认页配置，能力未验证时交付明确任务链接并标记根入口待验证。平台导航管理页只保留一套跨模块导航，重复时修正页面源码。
7. 本步骤配置宜搭平台导航，不要求页面源码实现侧边栏或顶部应用导航；只有 PRD 已规划该入口自己的菜单时才实现，不因平台排序再回头补导航壳。
7. 本轮已明确的前台自定义页面默认按 `entryMode=standalone` 处理；不能因 PRD 漏写字段而跳过。Step 6 在取得页面 ID 后隐藏页面导航；发布和健康检查通过后核对 `publish.navigationVerification`，必要时执行 `openyida get-form-config <appType> <displayPageFormUuid> --json`。配置缺失或变化时才执行 `openyida update-form-config <appType> <displayPageFormUuid> false "<页面标题>"` 并再次回读。只有回读明确为 `renderNav=false` 时，才将 CLI 返回的 `standaloneUrl` 交给 Step 9，格式为干净的 `{base_url}/{appType}/custom/{displayPageFormUuid}`；配置失败或结果未知时标记“前台入口未完成”，不能用工作台入口替代交付，也不用 `?isRenderNav=false` 猜测成功。
8. 非前台页面明确采用 `entryMode=platform-shell`，或缺少入口用途依据时，不修改页面导航配置。用户已明确保留平台导航的要求优先；用途与规划冲突时先核对，不覆盖明确选择。

## 无自定义页面的管理端

没有本轮源码时跳过 publish，继续核对真实资源、权限、管理菜单和默认入口。缺少 display 主页面不构成失败，不追加自定义首页。新版双入口按 [访问态入口契约](../references/entry-navigation.md) 处理，显式排序不会删除未列出的导航项；需精简平台菜单时单独规划 hide/show 并回读。

## 混合导航验收

应用保留平台导航、前台单独自定义菜单时：只配置 PRD 标记 standalone 的页面；平台导航排序继续服务后台。逐个核对前台页面 URL 与后台 workbench URL：前台可独立办事、菜单不混入管理任务；后台菜单可见、切换可用。任何一边未验证都不能宣称前后台交付完成。不能为修复前台显示而调用全局隐藏。


## 产出

- 成功的 `openyida publish` 命令结果；
- 可访问主页面 URL；
- 各入口的默认页、菜单顺序与验收结果；平台排序附结构化回读，自定义导航附实际页面验证，失败时保留发布结果和可恢复诊断；
- `standalone` 页面导航配置的写后回读结果，或明确未启用独立入口。

## Checklist

- [ ] 发布 source 是本轮修改过的源码；
- [ ] 发布目标是已解析的 display 页面；
- [ ] Canvas 发布结果为 `publishMode=canvas`，且 `healthCheck.ok=true`、`healthCheck.readback.hasYidaCodeCanvas=true`、`runtimeCodeBytes>0`；
- [ ] 已获得可访问 URL；
- [ ] 本轮每个业务入口都已核对默认页面、菜单及分组顺序和首屏任务；自定义导航没有因跳过平台排序命令而漏验；
- [ ] 自定义导航业务工作区切换后的 main 和 iframe 撑满剩余空间；连续展示页的首屏背景覆盖导航背后，滚动进入第二屏及窄屏展开菜单仍可读；检查短/长内容、窗口高度变化和底部操作可达性，无双滚动、背景断带或意外边距变化；
- [ ] 按 [页面与导航连续性](../../yida-design/references/page-continuity.md) 验证菜单往返、直接链接、刷新、前进后退、重复/快速点击及加载失败；保留约定的筛选、分页、位置和未保存输入，URL、选中态与内容一致；
- [ ] 使用自定义导航时逐项点击，导航仍可见、可操作，选中项与主内容一致且能返回工作台；刷新、前进后退恢复任务，无双导航和双滚动条，不能仅以目标页打开成功验收；
- [ ] 含页面内表单打开入口时，PC 打开后 DOM 存在 `.openyida-form-drawer`；实测新窗口打开、全屏/退出全屏、关闭三个图标按钮、左边缘拖拽调宽及关闭刷新；详情和提交 iframe 填满剩余空间，外层无多余卡片和滚动条。无此类入口时标记不适用；
- [ ] 全部页面开发与发布、相关资源创建均已完成后才执行排序；显式排序和自动排序只执行其一；成功结果 `readbackVerified=true`。
- [ ] `standalone` 主页面已回读确认 `renderNav=false`；否则没有声明独立业务入口。

## 下一步

→ [Step 9：输出与收尾](step-9-output-finish.md)
