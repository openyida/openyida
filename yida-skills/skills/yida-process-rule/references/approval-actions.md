# 加签和转交（actions）

适用于 `approval`、`operator` 和 `multiApproval` 节点。加签和转交可以通过 CLI 配置；必须由编译器同时生成设计器配置和运行配置，不能只改 `hidden` 后直接提交原始流程 JSON。

```json
{
  "type": "approval",
  "key": "purchase_approval",
  "name": "采购审批",
  "approver": "originator",
  "actions": {
    "normalActions": [
      { "action": "forward", "hidden": false },
      {
        "action": "append",
        "hidden": false,
        "appendPosition": ["BEFORE_APPEND", "AFTER_APPEND"],
        "appendResult": "valid"
      }
    ],
    "appendActions": [
      { "action": "forward", "hidden": false },
      { "action": "append", "hidden": false }
    ]
  }
}
```

- `normalActions` 是普通审批人的按钮；`appendActions` 是被加签人的按钮，独立配置。数组按 `action` 部分覆盖默认值，不配置时保持历史默认：同意、拒绝显示，保存、转交、加签、退回隐藏。
- 加签位置和结果是节点级规则，在 `normalActions` 的 `append` 动作上设置。`appendPosition` 必须为非空数组，支持 `BEFORE_APPEND`（前加签）、`AFTER_APPEND`（后加签）；省略时默认前加签。`appendResult` 支持 `valid`（参与审批）、`invalid`（不参与审批）；省略时默认 `valid`，与设计器开启加签时一致。
- 编译器同步生成运行配置 `allowTaskAppend`、`moldList`、`isConsiderAppendedAction`、`isNeedEndTaskGroupChain`。转交使用 `forward.hidden`，无需虚构额外的转交范围配置。
- 开启被加签人的再次加签时，也须开启普通审批人的加签，以确保存在节点级加签规则；无效配置会在发布前报错。
- 兼容已有 `approver.processProps.actions/appendActions` 完整数组，并同步到设计器；`node.actions` 对对应数组优先。旧运行字段 `moldList` 和布尔类型 `isConsiderAppendedAction` 可用于补齐省略的加签参数。不要同时提供互相矛盾的两套配置。
- 发布后的回读会核对按钮是否隐藏，以及开启加签时的位置和结果设置。`PLATFORM_VIEW_VERIFIED` 仍不等于真实审批人已完成加签/转交验收；需要在获授权的测试流程中分别验证普通审批人、被加签人和移动端。


## CLI 入口

将以上节点放入完整流程定义的 `nodes` 数组，由同一编译器处理：

```bash
openyida configure-process APP_XXX FORM_XXX .cache/openyida/process/process-with-actions.json
openyida create-process APP_XXX --formUuid FORM_XXX .cache/openyida/process/process-with-actions.json
```

已有流程使用第一条；普通表单首次转流程可使用第二条。配置命令会替换整张流程图，必须保留完整节点与分支；发现已有版本时需按主技能的替换要求使用 `--replace`。本功能不提供 `--append`、`--forward` 等独立开关，也不用于执行某一待办实例的加签或转交操作。

用 `openyida configure-process --help`、`openyida create-process --help` 查看入口；命令发现 JSON 也会返回加签/转交配置提示。发布后若返回 `PROCESS_PLATFORM_VIEW_ACTION_MISMATCH` 诊断，不得将已发布但未验证的流程当作成功，也不要直接重试写入。
