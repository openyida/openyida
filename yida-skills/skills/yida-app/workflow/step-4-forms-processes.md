# Step 4：创建或更新表单/流程

按 PRD 的依赖创建或复用表单和流程。同一轮需要新建两个及以上普通表单时，把独立表单和关联表单写入同一个 `forms.json`，通过 `dependsOn` / `$form` 表达依赖，并且只调用一次 `openyida create-form batch`；由 CLI 内部完成分组、真实 ID 回读和依赖调度，不逐个 create，也不由模型拆成多次 batch。调用前确认实际项目根，让 Write 的绝对路径与 Bash 从项目根使用的 `.cache/openyida/<项目名>/forms.json` 指向同一个物理文件，并用 Read 确认任务文件存在；不要用 batch 探测路径，收到 background pending 后也不要重试 batch。某页所需表单、流程就绪后即可接入该页；不要因其他页面的资源未完成而阻塞无依赖页面开发。

`explicitScope.allowInferredResources=false` 且本轮只有一个普通表单时走最短路径：以 Write 创建字段文件及其父目录，随后调用一次 `openyida create-form create`。成功结果中的 `url`/`formUrl` 是表单入口，`appUrl` 是应用工作台入口。将该表单标记为已完成并计算 `remainingScope`；为空时按用户要求的入口层级交付并完成本轮范围。普通表单保存成功后进入可用状态，自定义展示页遵循页面发布生命周期；验收证据缺失时执行一次针对性只读回查。

拿到真实 `appType` 和已确认的业务契约即可开始本步骤，不等待主题 CSS 上传或应用主题设置回读。主题分支与本步骤并行，按 [主题与业务资源的依赖](parallel-work.md#主题与业务资源的依赖) 汇合。

## 输入

- 真实 `appType`；
- `prd/<项目名>/prd.md`；
- `prd/<项目名>/design.md`；
- Step 1 解析出的 form/process context。

## 操作

1. 执行 `use_skill("yida-create-form-page", "创建或更新核心表单字段结构")`，创建或更新普通表单字段结构。
2. 已有目标表单时，使用 update/patch/rule/bind-datasource。
3. 缺少支撑 MVP 的核心普通表单且允许创建时，按上述单批次契约创建；只有一个新表单或 batch 契约无法表达当前依赖时才使用单表单 create，并说明原因。
4. 字段配置文件写入 `.cache/openyida/<项目名>/`。
5. 拿到真实 `formUuid` 后写入资源上下文。
6. 批量创建返回的字段映射直接复用。其他页面、数据、流程或公式确需多字段映射时，对每个目标表单最多一次性执行 `openyida get-schema <appType> <formUuid> --field-map-json`，合并写回 `.cache/<项目名>-schema.json`。
7. PRD 包含审批、流程、申请、审核、工单等流程对象时，执行 `use_skill("yida-create-process", "创建带审批流程表单")`。
8. 已有流程表单或 `processCode` 时，执行 `use_skill("yida-process-rule", "更新已有流程规则")`。
9. 分析、复刻或迁移已有表单时，执行 `use_skill("yida-get-schema", "读取字段与行为语义")`，对每个核心表单读取一次 `--analysis-json`；把字段结构与 `actions/fieldBehaviors/associationRuleCount` 分开规划，字段事件动作使用 `yida-create-form-page` 的原子 `field-action`，数据源使用 `bind-datasource`。
10. PRD 明确包含原生报表时，执行 `use_skill("yida-report", "按业务统计语义创建原生报表")`；地域分布、日历统计分别使用已支持的 `map`、`calendarHeatmap`，不得无声明退化成柱/饼图。
11. PRD 明确包含集成自动化时，执行 `use_skill("yida-integration", "按业务动作创建自动化")`；已有应用先用全类型 `integration list --json` 盘点，创建时区分通知、数据新增/更新、审批完成、定时和手动触发。CLI 不支持的触发类型输出 capability gap，不得用通知替代。

## 字段配置文件示例

字段配置文件写到 `.cache/openyida/<项目名>/xxx-fields.json`；从 workspace 根执行时传 `project/.cache/openyida/<项目名>/xxx-fields.json`。

```json
[
  { "type": "TextField", "label": "访客姓名", "required": true },
  {
    "type": "TextField",
    "label": "联系电话",
    "validation": [
      {
        "type": "regex",
        "pattern": "^1[3-9]\\d{9}$",
        "message": "请输入正确的 11 位手机号码"
      }
    ]
  },
  { "type": "DateField", "label": "到访时间" },
  { "type": "SelectField", "label": "访问状态", "options": ["预约中", "已到访", "已离开"] }
]
```

电话字段统一使用 `TextField` 加 `regex` 自定义校验。不要创建或 patch `PhoneField`；CLI 会把上述正则规则编译为设计器 `customValidate`，字段值仍按文本持久化和回读。

创建后把返回 ID 汇总到 `.cache/<项目名>-schema.json`：

```json
{
  "appType": "APP_XXXXXX",
  "pages": {
    "访客登记表": {
      "formUuid": "FORM-XXXXXX",
      "fields": {
        "访客姓名": "textField_xxxxxxxx"
      }
    },
    "访客工作台": {
      "formUuid": "FORM-YYYYYY"
    }
  }
}
```

## 业务权限配置

资源 ID 就绪后，按 [访问态入口契约](../references/entry-navigation.md#权限实施) 将菜单 access 和业务角色映射到真实权限。执行 yida-form-permission 的查询、差异、保存与回读流程，保留非目标配置。FORM_PACKAGE_START、视图绑定和页面白名单等未支持项单独记录能力缺口；不得用 app-permission 管理员授权或导航隐藏替代。权限未核验的入口不能宣称业务可用。

## 页面导航配置

只有 PRD 的应用工作区导航 `execution.appConfig.navigationType=custom` 时，对本轮创建或复用的每个表单、流程表单及其他业务页面，按 [导航壳必做配置](../../yida-nav-shell/SKILL.md#必做配置) 调用 `update-form-config` 并回读 `isRenderNav=false`。以 PRD 清单及真实 formUuid 逐项记录结果。

仅前台页面自定义菜单时，不修改这些后台表单、流程或报表的导航；共用数据不等于共用页面显示设置。

## 产出

- 普通表单真实 `formUuid`；
- 流程表单真实 `formUuid` / `processCode`；
- 必要 `fieldId`；
- 表单字段结构校验结论。

## Checklist

- [ ] 字段结构有 Divider 分组；
- [ ] 表单/流程资源在自定义页面之前创建或确认；
- [ ] 必要 `fieldId` 已写入 `.cache/<项目名>-schema.json`；
- [ ] 表单 Schema 只包含字段、布局和业务动作。

`remainingScope` 是 Agent 运行时维护的剩余任务集合，依据已确认范围和成功结果更新。

## 下一步

- `remainingScope` 为空：→ [Step 9：按确认范围输出与收尾](step-9-output-finish.md)
- `remainingScope` 包含 seed records：→ [Step 5：写入初始表单数据](step-5-seed-records.md)
- `remainingScope` 包含自定义页面：→ [Step 6：创建或复用主页面](step-6-main-page.md)
- 其他资源：继续执行本步骤中与该资源类型对应的能力，直到资源集合完成
