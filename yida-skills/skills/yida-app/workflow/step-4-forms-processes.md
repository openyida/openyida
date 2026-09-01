# Step 4：创建或更新表单/流程

按 PRD 的资源创建顺序创建或复用表单和流程。表单、流程先于自定义页面。

## 输入

- 真实 `appType`；
- `prd/<项目名>/prd.md`；
- `prd/<项目名>/design.md`；
- Step 1 解析出的 form/process context。

## 操作

1. 表单开发先执行 `use_skill("yida-form-detail", "表单视觉引导与详情页样式默认注入")`，明确填写路径、字段密度和 Divider 分组。
2. 执行 `use_skill("yida-create-form-page", "创建或更新核心表单字段结构")`，创建或更新普通表单字段结构。
3. 已有目标表单时，使用 update/patch/rule/bind-datasource。
4. 缺少支撑 MVP 的核心普通表单且允许创建时，创建普通表单。
5. 字段配置文件写入 `.cache/openyida/<项目名>/`。
6. 拿到或确认真实 `formUuid` 后，必须执行表单主题和 formDetail CSS 注入校验：先 `openyida form-detail-style check`，缺失时 `apply`，再 `check`；最终需确认 `globalThemeActionFound: true` 与 `formDetailStyleActionFound: true`，重复执行保持幂等。
7. 页面、数据、流程或公式确需多字段映射时，对每个目标表单最多一次性执行 `openyida get-schema <appType> <formUuid> --field-map-json`，合并写回 `.cache/<项目名>-schema.json`。
8. PRD 包含审批、流程、申请、审核、工单等流程对象时，执行 `use_skill("yida-create-process", "创建带审批流程表单")`。
9. 已有流程表单或 `processCode` 时，执行 `use_skill("yida-process-rule", "更新已有流程规则")`。
10. 分析、复刻或迁移已有表单时，执行 `use_skill("yida-get-schema", "读取字段与行为语义")`，对每个核心表单读取一次 `--analysis-json`；把字段结构与 `actions/fieldBehaviors/associationRuleCount` 分开规划，字段事件动作使用 `yida-create-form-page` 的原子 `field-action`，数据源使用 `bind-datasource`。
11. PRD 明确包含原生报表时，执行 `use_skill("yida-report", "按业务统计语义创建原生报表")`；地域分布、日历统计分别使用已支持的 `map`、`calendarHeatmap`，不得无声明退化成柱/饼图。
12. PRD 明确包含集成自动化时，执行 `use_skill("yida-integration", "按业务动作创建自动化")`；已有应用先用全类型 `integration list --json` 盘点，创建时区分通知、数据新增/更新、审批完成、定时和手动触发。CLI 不支持的触发类型输出 capability gap，不得用通知替代。

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

## 产出

- 普通表单真实 `formUuid`；
- 流程表单真实 `formUuid` / `processCode`；
- 必要 `fieldId`；
- 表单全局主题和详情页 CSS 注入结果，或明确阻塞原因。

## Checklist

- [ ] 字段结构有 Divider 分组；
- [ ] 表单/流程资源在自定义页面之前创建或确认；
- [ ] 必要 `fieldId` 已写入 `.cache/<项目名>-schema.json`；
- [ ] 表单全局主题已注入：`globalThemeActionFound: true`；
- [ ] formDetail CSS 已注入：`formDetailStyleActionFound: true`；
- [ ] 若无法注入，已给出明确阻塞原因。

## 下一步

→ [Step 5：写入初始表单数据](step-5-seed-records.md)
