---
name: yida-nav-shell
description: 自定义页明确要自绘应用级导航时使用；先隐藏应用导航 hideAppNav。页面级 isRenderNav=false 不等于应用导航隐藏。
---

# yida-nav-shell

## 先判断

默认不用本技能。宜搭应用的页面切换优先交给平台导航和 `yida-nav-group`。

| 用户需求 | 怎么处理 |
| --- | --- |
| 导航分组、页面排序、隐藏/显示导航项 | 用 `yida-nav-group` |
| 页面内 tab、分段、筛选、卡片切换 | 当前页内容结构，不用本技能 |
| 自定义页要顶部导航、侧边导航、导航壳、自绘应用级导航 | 用本技能，并先隐藏应用导航 |
| 用户只说隐藏应用导航 | 执行 `update-app --hide-app-nav`；需要自绘导航时再用本技能 |
| 用户只说全屏、无导航、`isRenderNav=false` | 这是页面级隐藏，优先用 `yida-page-config` |

关键区别：

- 应用导航隐藏：`hideAppNav='y'`，通过应用基础设置控制。
- 页面导航隐藏：`isRenderNav=false`，只控制某个页面/表单页的导航显示。
- 不要用 `isRenderNav=false` 代替 `hideAppNav`。
- 不要让平台应用导航和自绘应用级导航同时出现。

## 必做配置

用户确认自定义导航后，就将应用导航隐藏纳入应用基础设置更新：新建应用时，等 `app-theme.css` 生成后，将 `--hide-app-nav` 与主题、Logo、布局等设置合并到同一次 `update-app`，按 [应用设置同步](../yida-app/workflow/step-3-create-or-reuse-app.md) 执行并回读。已有应用只需切换导航时执行：

```bash
openyida update-app <appType> --hide-app-nav
```

自定义导航必须对 PRD 本轮范围内全部普通表单、流程表单、自定义页面及其他支持页面配置的资源逐页执行；使用已解析的真实 `formUuid` 和原页面标题：

```bash
openyida update-form-config <appType> <formUuid> false "<页面标题>"
openyida get-form-config <appType> <formUuid> --json
```

每页回读 `isRenderNav=false` 才完成；失败时修复该页配置并重读。表单及自定义页面在创建或复用并取得真实 `formUuid` 后立即配置，可与页面代码开发并行，不等待页面发布。发布后只回读核对；若发布改变了配置才补写修复，最终按 PRD 清单逐项核对。`create-page --hide-nav` 可用于新建页初始配置，仍需回读；URL 参数不能代替持久化设置。

## 实现要点

- **画布与浮导间距**：无应用导航时，自定义页根背景消费 `--oyd-page-background`（应用主题默认 `transparent`），透出 Shell 品牌背景；`--pod-page-bg-color` 留给原生页面，卡片用 `--pod-card-bg-color`。根节点使用 `display:flow-root` 或 flex/grid，让浮导上边距留在根节点内；仅在 `.yida-code-canvas` 加 flow-root 不足以防止内层根节点下移。完整分层与示例见 [背景与导航的关联](../yida-canvas-custom-page/references/canvas-style-implementation-guide.md#背景与导航的关联)。

- **先选形态，再写 UI**：根据已确认的 PRD、`design.md` 和用户参考确定布局。模块多用侧栏，模块少且内容需要宽度用顶部，两级业务用顶部＋侧边，沉浸展示可用悬浮 Dock，同模块视图用标签。已确认的选择直接沿用，不重新提问。
- 自定义顶部导航默认推荐浮导，可按内容宽度设计为紧凑胶囊或悬浮栏；“顶部导航”不等于贴边通栏。位置、比例、留白、材质和选中态根据业务与设计实现，不由现成组件决定。此推荐只针对顶部样式，“平台导航 / 自定义导航”选项保持中性。
- 需要布局方向和小段代码时读 [导航壳形态目录](references/nav-shell-patterns.md)。按场景设计和手写实现，不强制复制任何导航组件。已有导航符合设计时直接复用，只补缺失功能；不能仅因存在新示例而替换现有外观。
- 自定义侧边导航（含顶部＋侧边）的 PC 端必须支持折叠/展开和拖拽调宽；展开恢复折叠前宽度，宽度变化时内容区同步调整。移动端改为可展开/收起的菜单，详见 [侧栏交互](references/nav-shell-patterns.md#侧栏交互)。
- 菜单数量、名称、顺序、分组和入口用途来自 PRD，通常工作台在首位；用当前访问者的 `getAccessableNavs.json` 过滤可见范围，详见 [导航数据来源](references/nav-shell-patterns.md#导航数据来源)。数据逻辑可直接复用，不要求采用同一套 UI。
- 只在当前页切视图时用 React 状态；需要分享、刷新恢复、前进后退时同步 URL hash。跨真实页面时沿用应用路由与数据桥，详见 [菜单契约](references/nav-shell-patterns.md#菜单契约)。`hashchange`、`matchMedia` 等监听必须 cleanup。
- **当前标签跨页跳转，避免重复应用前缀**：完整的 `/APP_xxx/workbench/FORM_xxx` 地址通过数据桥调用 `router.push(href, params, false, true)`，第三参 `false` 表示不新开标签，第四参 `true` 表示 URL 模式。数据桥已修复省略第四参时的自动识别，但不会覆盖显式传入的 `false`；生成代码仍须明确传 `true`，详见 [路由模式与数据桥兜底](references/nav-shell-patterns.md#路由模式与数据桥兜底)。
- 导航项保存真实资源 ID、入口用途和 `params`；办理任务、数据管理与页面内新增/详情按钮按 [入口用途与嵌入页面](references/nav-shell-patterns.md#入口用途与嵌入页面) 分别处理。用 `URL` / `URLSearchParams` 保留 `corpid`、`locale` 和业务参数。

## UI 和验收

- 导航表达应用身份、业务层级和当前位置；选中态清晰，图标使用 `lucide-react` 或 `@ant-design/icons`，不用 emoji、字母占位或 CSS 拼图标。
- 视觉对照 `design.md` 和用户参考检查，尤其是浮导的容器比例、留白、位置与内容关系。导航消费应用主题 token，不另注一套全局主题。
- 导航选中态已标明当前页时，内容区从业务开始；独立页头只补充对象、任务说明或操作，避免重复菜单标题。
- 侧栏已验证折叠、恢复宽度、拖拽上下限和内容联动；顶部窄屏可展开菜单，Dock 不遮内容和主要操作。
- 应用 `hideAppNav` 与各页 `isRenderNav=false` 均已持久化并回读；菜单可见性、选中态、内容与路由一致，深链、刷新及前进后退正常。
- 完整检查见 [验证清单](references/nav-shell-patterns.md#验证)。本地编译后按 `yida-publish-page` 发布并检查实际页面，编译通过不等于视觉验收通过。
