# 应用蓝图字段

用于单个页面需要感知完整应用时，承接 `yida-app-uiux` 的输出。

## 必填字段

| 字段 | 说明 |
| --- | --- |
| `appName` | 应用名 |
| `entry` | 应用门面页 |
| `shell` | `side_nav/top_nav/l_shaped/fullbleed-screen/split-pane/single_page` |
| `roles` | 用户角色 |
| `navigationGroups` | 导航分组和页面列表 |
| `pages` | 页面清单，含 `name/scene/template/targetRole` |

## 使用规则

- 页面视觉决策块里只引用与当前页有关的蓝图信息，不展开整个应用 PRD。
- 多页面应用的首页不一定是工作台：外部传播可用 landing，管理决策可用 dashboard，投屏可用 screen。
- 导航可见时优先与宜搭运行态融合；隐藏导航时页面需要自带清晰的导航壳或返回路径。
