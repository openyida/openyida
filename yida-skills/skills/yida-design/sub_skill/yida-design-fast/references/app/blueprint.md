# 应用结构字段

用于单个页面需要感知完整应用时，承接 `yida-design` 的输出。

## 必填字段

| 字段 | 说明 |
| --- | --- |
| `appName` | 应用名 |
| `entry` | 首页或入口页 |
| `shell` | `side_nav/top_nav/l_shaped/fullbleed-screen/split-pane/single_page` |
| `roles` | 用户角色 |
| `navigationGroups` | 导航分组和页面列表 |
| `pages` | 页面清单，含 `name/scene/targetRole/purpose/blocks` |
| `resourceBlueprint` | 页面、普通表单、流程表单、报表等资源清单 |

## 使用规则

- 页面 PRD 章节只引用与当前页有关的应用结构信息，不展开整个应用 PRD。
- 多页面应用的首页不一定是工作台：外部传播可用 landing，管理决策可用 dashboard，投屏可用 screen。

导航字段按下表写，不能混用：

| 需求 | 字段 | 后续技能/命令 |
| --- | --- | --- |
| 常规应用导航、导航分组、页面排序 | `navigationGroups` | `yida-nav-group` |
| 自定义页自绘应用级顶部/侧边/导航壳 | `hideAppNav='y'` | `yida-nav-shell` + `openyida update-app <appType> --hide-app-nav` |
| 页面隐藏导航、无导航、`isRenderNav=false` | 页面级隐藏配置 | `yida-page-config` / `update-form-config` |

默认导航可见并优先与宜搭运行态融合；普通页面内 tab、分段筛选和快捷入口不隐藏平台导航。用户只要求页面隐藏导航、无导航或 `isRenderNav=false` 时，记录页面级隐藏配置，不自动写 `hideAppNav`。

## resourceBlueprint

`resourceBlueprint` 对齐 `yida-app` 的页面与表单设计，描述“应该有什么资源”，运行后 ID 由实现阶段记录。

```json
{
  "pages": [
    {
      "name": "经营工作台",
      "resourceType": "display-page",
      "scene": "workbench",
      "isMain": true,
      "purpose": "应用第一入口、今日概览、快捷入口"
    }
  ],
  "forms": [
    {
      "name": "商品管理",
      "formKind": "normal-form",
      "purpose": "维护商品基础资料",
      "fields": ["商品名称", "商品分类", "售价", "商品状态"]
    },
    {
      "name": "采购审批",
      "formKind": "process-form",
      "purpose": "采购申请与审批流转",
      "process": ["发起", "主管审批", "采购执行"]
    }
  ],
  "reports": [
    {
      "name": "销售趋势报表",
      "purpose": "汇总订单金额和销量趋势"
    }
  ]
}
```

字段写业务名、字段类型、必填、默认值、Divider 分组等语义；真实 `formUuid`、`fieldId`、`processCode` 由实现阶段创建后写入 `.cache/<项目名>-schema.json`。
