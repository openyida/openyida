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

自绘应用级导航前先执行：

```bash
openyida update-app <appType> --hide-app-nav
```

自定义导航必须对 PRD 本轮范围内全部普通表单、流程表单、自定义页面及其他支持页面配置的资源逐页执行；使用已解析的真实 `formUuid` 和原页面标题：

```bash
openyida update-form-config <appType> <formUuid> false "<页面标题>"
openyida get-form-config <appType> <formUuid> --json
```

每页回读 `isRenderNav=false` 才完成；失败时修复该页配置并重读。表单在业务资源创建或复用后配置，自定义页在发布后配置，最终按 PRD 清单逐项核对。`create-page --hide-nav` 可用于新建页初始配置，仍需回读；URL 参数不能代替持久化设置。

## 实现要点

- 形态按场景选：模块多用左侧栏；模块少用顶部导航；两级结构用顶部 + 侧边；大屏/沉浸页用浮动 Dock；同模块视图切换用标签。
- 只在当前页切视图用 `React.useState`；需要分享、刷新恢复、前进后退时用 URL hash。
- `hashchange`、`matchMedia` 等监听必须 cleanup。
- 导航项保存 `type`、`formUuid`、`params`，不要只存 `formUuid`。
- 跨自定义页用 `/{appType}/custom/{formUuid}`；应用导航隐藏靠 `hideAppNav`，不要给自定义页 URL 拼 `isRenderNav=false`。
- 表单列表 iframe 用 `/{appType}/workbench/{formUuid}?iframe=true`。
- 原生提交页/详情页需要隐藏页面导航时，才使用 `submission/{formUuid}?isRenderNav=false` 或 `formDetail/{formUuid}?formInstId=...&isRenderNav=false`。
- 用 `URL` / `URLSearchParams` 构造地址，保留 `corpid`、`locale` 和业务参数。
- 需要代码骨架时读 [导航壳形态目录](references/nav-shell-patterns.md)。

## UI 和验收

- 选中态必须明显，不能只靠很淡的颜色。
- 图标只用 `lucide-react` 或 `@ant-design/icons` 的具体组件；不要 emoji、字母占位、CSS 画图标。
- 移动端要收敛：侧边栏变抽屉，顶部导航变汉堡，浮动导航变底部胶囊。
- 应用配置已开启 `hideAppNav='y'`，本轮全部页面已回读确认 `isRenderNav=false`。
- 当前视图、选中态、内容区一致。
- hash 深链、刷新恢复、前进后退可用。
- 跨页参数不丢，PC 和移动端都能操作。
