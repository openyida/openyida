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

## 接入步骤

1. 按 PRD 确定菜单数量、名称、顺序、分组和用途，通常将工作台放在第一位。
2. `getAccessableNavs.json` 用来判断“工作台”“活动报名”等应用菜单是否可见；菜单数量、名称和顺序按 PRD 设计。按 [导航数据来源](references/nav-shell-patterns.md#导航数据来源) 接入 `canvas-nav-data`。
3. 按 [导航模板](references/nav-shell-patterns.md) 复制所需形态，例如 `openyida sample openyida-page-template canvas-nav-side --output .cache/samples/canvas-nav.jsx`，合并到当前 Canvas，接入过滤后的菜单、选中状态和业务内容；侧栏调宽与收起由模板提供。
4. 按 [入口用途与嵌入页面](references/nav-shell-patterns.md#入口用途与嵌入页面) 配置提交、查询和管理入口；按 [菜单契约](references/nav-shell-patterns.md#菜单契约) 接入页面切换。
5. 按 [验证清单](references/nav-shell-patterns.md#验证) 检查权限、跳转、主题和移动端显示，再通过 `yida-publish-page` 发布。
