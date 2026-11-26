# 应用迁移与表单别名

`openyida export <appType> <file>` 导出迁移包，`openyida import <file> [name]` 在当前登录组织创建新应用。导入先创建全部空表，再使用完整 UUID 映射保存 Schema，支持前向引用和循环关联。已有不含 alias 的迁移包仍可使用。

迁移包中的每个 `forms[]` 可声明唯一的 `alias`（字母开头，允许字母、数字、下划线、点和连字符）。导出默认以原表单 UUID 作为 alias，可在迁移包中调整为业务名称。例如：

```json
{
  "sourceAppType": "APP_SOURCE",
  "forms": [
    {"formUuid": "FORM_CUSTOMER", "alias": "customer", "name": "客户", "schema": {"pages": []}},
    {"formUuid": "FORM_ORDER", "name": "订单", "schema": {"pages": [{"id": "FORM_ORDER", "children": [{"componentName": "AssociationFormField", "props": {"associationForm": {"formAlias": "customer"}, "mainFieldId": "textField_name"}}]}]}}
  ]
}
```

`formAlias` 在保存前替换为目标应用的 `appType/formUuid`，不会传给平台。`mainFieldId` 等字段标识保持不变。别名缺失、重复或与同时提供的 `formUuid` 冲突时，导入在创建应用之前失败。alias 只属于迁移包及报告，不是 `publish/get-schema/data` 的独立参数语法。

运行期间持续更新当前目录的 `yida-migration-report.json`，记录 `alias/oldFormUuid/newFormUuid` 和每一步状态。中断或部分失败返回非零退出码：

- `created`：空表已创建，尚未保存 Schema。
- `create_pending/create_unknown`：可能已经创建，先查询应用页面列表，不要重复创建。
- `save_pending/save_unknown`：可能已经保存，先回读目标表单 Schema。
- `read_failed/save_failed`：读取失败或保存被拒绝；此前成功的表单仍保留。
- `verify_pending/verify_failed`：保存已接受，但关键标识引用的回读核对尚未完成或不一致；只回读排查，不重放保存。
- `success`：Schema 已保存，页面、应用、表单引用和字段标识回读一致，不代表关联业务数据、流程执行或自定义页面运行已验证。

存在未完成报告时拒绝直接重跑。先根据报告检查已有资源，在这些资源上修正或手动恢复；报告不能作为自动重试写入的依据。确认需要重新创建整个副本时，归档旧报告后再导入。导入不回滚、删除残留资源，也不迁移业务数据或保证跨组织成员权限有效。

## 真实回归

`scripts/e2e-real/issue-560-479.js` 提供隔离真实用例，使用已明确选定的测试组织。需设置 `OPENYIDA_E2E=1`、`OPENYIDA_E2E_ISSUES_560_479=1`、`OPENYIDA_E2E_CORP_ID`；可用 `OPENYIDA_E2E_ISSUE_CASES=479` 单独执行迁移。资源和逐步结果记录在 `project/.cache/e2e-real/issues-560-479/<runId>/`，不提交仓库。

用例新建 A/B 双向关联表，分别以 UUID 和 alias 导入两个新应用，核对字段及新表标识，再为每个副本写入两条互相关联记录并真实回读。重用相同 `OPENYIDA_E2E_ISSUE_RUN_ID` 时复用已确认的创建结果，不自动重放失败或未知写入；先核实对应报告。测试应用和记录保留用于审阅，不自动删除。
