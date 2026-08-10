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
- 导航默认可见并优先与宜搭运行态融合；页面内导航不自动隐藏平台导航，只有用户明确要求隐藏平台导航、无导航或独立全屏体验时，页面才进入隐藏导航策略。

## resourceBlueprint

`resourceBlueprint` 描述应用需要的资源。每个资源必须有唯一、稳定的 `resourceKey`；运行后由实现阶段把 `resourceKey` 映射到真实 ID。

```json
{
  "pages": [
    {
      "resourceKey": "home",
      "name": "经营工作台",
      "resourceType": "display-page",
      "scene": "workbench",
      "isMain": true,
      "purpose": "应用第一入口、今日概览、快捷入口"
    }
  ],
  "forms": [
    {
      "resourceKey": "product_form",
      "name": "商品管理",
      "formKind": "normal-form",
      "purpose": "维护商品基础资料",
      "fields": ["商品名称", "商品分类", "售价", "商品状态"]
    },
    {
      "resourceKey": "purchase_process",
      "name": "采购审批",
      "formKind": "process-form",
      "purpose": "采购申请与审批流转",
      "process": ["发起", "主管审批", "采购执行"]
    }
  ],
  "reports": [
    {
      "resourceKey": "sales_report",
      "name": "销售趋势报表",
      "purpose": "汇总订单金额和销量趋势"
    }
  ]
}
```

`resourceKey` 在同一项目内不能重复，资源改名时保持不变。字段写业务名、字段类型、必填、默认值、Divider 分组等语义；真实 `formUuid`、`fieldId`、`processCode` 由实现阶段创建后写入 `.cache/<项目名>-schema.json`。
