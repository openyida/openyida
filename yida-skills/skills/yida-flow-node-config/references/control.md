# 流转控制

## 什么时候用

根据条件走不同分支、执行并行分支，或重复处理数据。先区分改变走向的条件分支与同一节点内的条件选人。

## 必填配置

| 节点 | 流程 | 自动化 spec |
| --- | --- | --- |
| 条件分支 | 可直接生成：`route.conditions[]`，分支内用 `rules/childNodes` | 可直接生成：`route.branches[]`，分支内用 `conditions/nodes` |
| 并行分支 | 可直接生成：`parallel.branches[]`，分支内用 `rules/childNodes` | 可直接生成：`parallel.branches[]`，分支内用 `conditions/nodes` |
| 循环容器 | 审批流程使用宜搭设计器查看可用节点 | 支持 `cycle.source/nodes`，保存和启用前检查当前组织权益及节点范围 |
| 拒绝后跳转 | 人工节点的 `routeRules` | 不适用，不是自动化分支 |

比较规则和变量来源只读 [条件与变量](conditions-variables.md)。流程分支按数组顺序生成优先级；自动化指定至多一个 `default: true` 兜底分支。不要手写底层连线或 `conditionNode`。

自动化分支需要计算后判断时，使用完整的 `branches[].expression`，与普通 `conditions` 二选一；读取 [分支按公式判断](../../yida-formula/references/automation-formulas.md#分支按公式判断)，保留执行文本、编辑器原文和显示文字。普通流程条件由编译器生成自己的表达式，沿用流程格式；相同计算目的不代表两种 JSON 可以互换。

自动化并行分支沿用 `conditions/rules` 或 `all: true`；整段 `expression` 当前仅由 route 分支接收。

两层判断直接参照 [包含 events/nodes 的完整嵌套分支](../../yida-formula/references/node-examples.md#嵌套分支先决定是否复核再决定级别)。第二个 route 放在命中分支的 nodes，每层分别配置兜底；公式中的 AND/OR 与流程图的 route 嵌套是两种不同结构。

## 最小示例

流程：金额超过阈值时进入审批，未命中时 CLI 自动补“其他情况”分支。

```json
{
  "type": "route",
  "name": "金额分支",
  "conditions": [
    {
      "name": "金额超过一万",
      "rules": [
        {
          "fieldId": "<真实金额字段ID>",
          "fieldName": "金额",
          "componentType": "NumberField",
          "op": "GreaterThan",
          "value": 10000
        }
      ],
      "childNodes": [
        {
          "type": "approval",
          "name": "财务审批",
          "approver": "originator"
        }
      ]
    }
  ]
}
```

自动化：`self` 是前面已声明的 `getSelf` 节点；命中后更新当前记录。

```json
{
  "type": "route",
  "branches": [
    {
      "name": "已获取记录",
      "conditions": [
        {
          "fieldId": "${self}.form_inst_id",
          "fieldName": "表单实例ID",
          "componentType": "TextField",
          "opCode": "ExistValue"
        }
      ],
      "nodes": [
        {
          "type": "dataUpdate",
          "source": "self",
          "assignments": [
            {
              "column": "<真实处理状态字段ID>",
              "valueType": "literal",
              "value": "待处理"
            }
          ]
        }
      ]
    },
    {
      "name": "其他情况",
      "default": true,
      "nodes": []
    }
  ]
}
```

流程并行时改用 `type: "parallel"` 和 `branches`，每个分支提供 `name/childNodes`；可选 `rules/logic`，不设置条件表示该分支全部进入。

### 并行分支示例

```json
{
  "type": "parallel",
  "name": "并行会审",
  "branches": [
    {
      "name": "第一分支",
      "childNodes": [
        {
          "type": "approval",
          "name": "第一分支审批",
          "approver": "originator"
        }
      ]
    },
    {
      "name": "条件分支",
      "logic": "AND",
      "rules": [
        {
          "fieldId": "<真实金额字段ID>",
          "fieldName": "金额",
          "componentType": "NumberField",
          "op": "GreaterThan",
          "value": 10000
        }
      ],
      "childNodes": [
        {
          "type": "approval",
          "name": "第二分支审批",
          "approver": "originator"
        }
      ]
    }
  ]
}
```

### 流程分支参数

| 位置 | 参数与限制 |
| --- | --- |
| 条件路由节点 | `type: route`，`conditions` 为分支列表 |
| 条件分支 | `name/rules`，可选 `logic/childNodes`；`logic` 默认 `AND`，可用 `OR` |
| 并行节点 | `type: parallel`，`branches` 为分支列表，兼容 `conditions/parallelBranches` |
| 并行分支 | 可选 `name/rules/logic/childNodes`；无规则表示全部进入，不是互斥兜底 |
| 一条规则 | `fieldId/fieldName/componentType/op/value`；使用真实字段及其组件类型 |

别名 `route/branch/ConditionContainer` 归一为条件路由，`parallel/parallelBranch` 归一为并行。按字段类型选择操作符，见 [条件与变量](conditions-variables.md)；不要把自动化的 `opCode/valueType` 直接放进流程条件。

人工节点拒绝后回退的片段：

```json
{
  "routeRules": [
    {
      "when": "disagree",
      "jumpTo": "主管审核"
    }
  ]
}
```

`jumpTo` 用流程中实际目标节点的 `name`，或 `"结束"`。

## 自动化并行与循环

以下都是完整自动化 spec，写入 `spec.json` 后，用 `integration create APP FORM 名称 --spec spec.json` 保存草稿。`APP/FORM` 和 `<…>` 内容从实际查询结果替换；先保存、核对，再按用户要求发布。

### 自动化并行示例

用途：每次触发都执行两条检查，汇合后再继续。两条分支都写 `all:true`：

```json
{
  "events": ["insert"],
  "nodes": [
    {
      "id": "checks", "type": "parallel", "name": "同时检查",
      "branches": [
        {"id": "first", "all": true, "nodes": [{"id": "readFirst", "type": "getSelf", "name": "检查一"}]},
        {"id": "second", "all": true, "nodes": [{"id": "readSecond", "type": "getSelf", "name": "检查二"}]}
      ]
    },
    {"id": "afterChecks", "type": "getSelf", "name": "检查完成后继续"}
  ]
}
```

预期：新增一条记录后，“检查一”“检查二”各执行一次，“检查完成后继续”执行一次。`getSelf` 在此只读当前记录，方便先验证分支结构。

有条件的分支使用 `conditions`；`default:true` 是没有条件命中时的兜底，最多一条。每次都执行的分支用上例的 `all:true`。并行中避免多个分支同时覆盖同一业务字段。

### 循环逐条通知示例

循环仅用于集成自动化的编排。审批完成后需要循环时，使用审批事件触发集成自动化。循环体可配置消息通知、发起审批和条件或并行分支，实际可用节点由平台核对。读取多条数据放在循环前。批量复制使用[批量数据节点](../../yida-integration/references/batch-data.md)。

CLI 在创建、保存或启用循环自动化前检查当前登录组织的权益和节点配置。若确认缺少权益，请让组织管理员在[宜搭官方定价页](https://www.aliwork.com/pricing)查看适用版本并升级。若节点或场景不可用，请在目标应用的宜搭设计器核对可用操作。

循环的 `source` 指向上游批量取数节点，`blockType` 可设为 `continue`（异常后跳过本条）或 `break`（退出循环）。每条自动化可配置一个循环，循环体最多五个计数节点。条件项和并行项本身不计数，分支内的动作仍计数。当前行字段使用 `${循环别名}.字段ID`。

```json
{
  "events": ["insert"],
  "nodes": [
    {
      "id": "rows", "type": "dataRetrieve",
      "formUuid": "<真实来源表单ID>",
      "retrieveType": "batch", "quantity": 3, "filterType": "all"
    },
    {
      "id": "loop", "type": "cycle", "source": "rows", "blockType": "continue",
      "nodes": [
        {
          "id": "notify", "type": "sendMessage",
          "receivers": ["<真实测试接收人ID>"],
          "title": "记录提醒",
          "content": "请查看记录 ${loop}.<真实编号字段ID>"
        }
      ]
    }
  ]
}
```

保存草稿并回读后，用测试接收人核对每轮通知和当前行字段。取到三条来源记录时，预期对应三条通知。


## 特有限制

- 流程嵌套分支不超过 3 层；超过时必须拆分结构。默认“其他情况”由 CLI 生成；排查底层结构时核对最后一个条件为 `conditionType: else`，不猜测或省略兜底。
- 并行分支可能同时执行；不能用多个按优先级选择的条件分支假装并行。
- 节点别名只能引用当前分支的上游。某条分支内查询出的数据不能在无关分支中使用。
- 批量取数再逐行新增不需要额外循环节点，见 [数据](data.md)。
