# 自动化维护与运行排查

| 要做什么 | 读取位置 |
| --- | --- |
| 修改已有节点的名称、说明或通知内容 | [修改已有自动化](#修改已有自动化) |
| 查询、启用或停用 | [查询与启停](#查询与启停) |
| 查运行错误、节点输入输出 | [运行日志](#运行日志) |
| 设置异常提醒 | [异常监听](#异常监听) |
| 复制、重命名或删除 | [日常管理](#日常管理) |

## 修改已有自动化

修改前先确认目标应用、表单和自动化，再查看创建结果的 `updateSupport`。CLI 在创建成功后保存原配置记录，包含执行用的运行定义、编辑用的完整设计图、节点别名和远端版本指纹。这份记录称为双定义基线，保存在本地私有文件中。不能把只含设计图的 getProcess 返回值当运行定义。

例如只把已有提醒改名并修改正文：先写下方 `patch.json`，保留创建时返回的 `notify` 节点别名；随后按顺序停用、预览、保存。

```bash
openyida integration list APP_XXX --json
openyida integration disable APP_XXX FORM_XXX LPROC_XXX
openyida integration update APP_XXX FORM_XXX LPROC_XXX --patch .cache/openyida/task/integration/patch.json --dry-run
openyida integration update APP_XXX FORM_XXX LPROC_XXX --patch .cache/openyida/task/integration/patch.json --expect <预览指纹>
```

patch 是增量修改，不能传完整创建 spec。`--spec` 仅为 patch 文件参数的兼容别名：

```json
{
  "nodes": [
    {
      "id": "notify",
      "name": "库存预警",
      "message": {
        "title": "库存提醒",
        "content": "库存已低于阈值，请处理。"
      }
    }
  ]
}
```

`id` 使用新建返回的别名或真实节点 ID。支持节点名称 `name`、描述 `description`、消息标题和正文 `message.title/content`，其余字段、节点 ID、图结构及全局配置原样保留；不支持修改的键会拒绝。消息接收人不会因修改正文被重建。新增／删除节点、修改触发或数据映射暂不在增量 patch 范围。

实际写入前自动化必须已停用。CLI 读取两次远端设计图和版本，校验基线及 `--expect`；先写私有备份和恢复日志，再做单次草稿保存，精确回读整张设计图并更新基线。普通保存时，相同补丁已生效会返回 `changed:false,remoteWrites:0`。默认不发布；用户明确要求发布本次改动时追加 --publish，并核对启用状态。

`<预览指纹>` 填上一步返回的 `fingerprint`，不是 `processCode`。只改名称或说明时，节点对象写成 `{"id":"notify","name":"库存预警","description":"库存不足时提醒负责人"}` 即可。

| 这次要做什么 | 保存命令与预期 |
| --- | --- |
| 只修改草稿 | 用上面的保存命令，回读成功但仍停用 |
| 修改并发布本次配置 | 在保存命令末尾加 `--publish`，核对 `published:true` 和启用状态，再实际触发 |
| 重复保存已生效的相同补丁 | 普通保存返回 `changed:false,remoteWrites:0` |
| 将已有停用草稿发布 | 相同补丁加 `--publish` 仍会执行发布并回读；不要把“无内容变化”等同于“无需发布” |

`enable` 只切换开关；发布本次草稿使用 `update --publish`。远端有变化时重新读取、核对。

- 历史自动化没有可靠运行基线，或网页已修改设计图／版本时，停止写入并报告 `INTEGRATION_BASELINE_UNSAFE`。不得通过手写基线、复制设计图冒充运行定义来解除保护。
- 客户端两次读取不是服务端 CAS，存在最后一次读取至保存之间的并发窗口。协调其他编辑者停止修改后再操作。
- 写入超时、返回不明或回读失败时保留 journal，报告未知／部分结果；先检查远端与日志，不重复提交，不自动回滚覆盖新版本。
- 停用／启用是单独操作，修改后先检查草稿、测试实际业务，再按用户要求以 --publish 发布。配置回读不证明运行结果。

## 查询与启停

```bash
openyida integration list APP_XXX --json
openyida integration enable APP_XXX FORM_XXX LPROC_XXX
openyida integration disable APP_XXX FORM_XXX LPROC_XXX
```

盘点应用先读取未筛选的列表，默认覆盖触发类型 1/2/3/5/6。按表单和 processCode 核对唯一目标；启停后回读状态。目标不明确时先查询。

## 运行日志

```bash
openyida integration check APP_XXX --json
openyida integration check APP_XXX --status success --json
openyida integration detail-log APP_XXX <真实procInstId> --json
openyida integration detail-log APP_XXX <真实procInstId> --json --include-params
openyida integration diagnose --text "<异常信息>" --json
```

`check` 默认只查询异常运行。验收成功调用时用 `--status success`，从目标流程的 `logs` 中取得真实 `procInstId`，再用 `detail-log --json --include-params` 核对节点和接口实际收到的值；按触发记录的 `formInstId` 精确匹配，不用 `processCode`、记录 ID 或裁剪后的片段代替运行实例 ID。检查运行中记录可用 `--status running`。不要把默认异常列表为空当作成功运行证据。

`check` 按所选状态分页读取日志，可加 `--output result.xlsx`。为兼容旧输出，JSON 中的流程集合仍名为 `abnormalFlows`；使用 `--status success` 时，其中的 `logs` 是成功记录。`diagnose` 离线分析文本。

`detail-log` 返回节点顺序、名称、类型、耗时和输入输出参数名；需要参数值时同时加 `--json --include-params`。Token、Cookie、密码等已知凭证字段会自动隐藏，业务字段值保留。命令按总数翻页，超过 100 页或 10,000 个节点、分页不完整时明确失败。空结果不证明运行 ID 无效，也不代表自动化运行成功。分享前检查业务数据；读取失败不能当作“没有异常”。

## 异常监听

```bash
openyida integration monitor APP_XXX --json
openyida integration monitor APP_XXX --file .cache/openyida/task/integration/monitor.json --dry-run
```

监听配置：

```json
{
  "processCodes": [
    "<真实processCode>"
  ],
  "intervalTime": 60,
  "receiverIds": [
    "<真实userId>"
  ],
  "status": "n"
}
```

`intervalTime` 单位分钟，至少 5；停用 status=n 会按平台语义解绑 processCodes，回读的关联列表为空。新建先 status=n，实际启用才会发送提醒。更新携带查询到的 uuid，并显式提供完整配置。CLI 查询当前监听与数量限制，不改用户权益或额度。按 CLI 的拒绝／未知结果处理。保存后独立回读 processCodes、receiverIds、intervalTime、status；没有回读确认不能宣称配置生效。通知实际送达需另测，测试中不要向无关人员发送。

配置文件确认后，去掉 `--dry-run` 保存，再运行 `integration monitor APP_XXX --json` 独立查询。上例预期为关闭、间隔 60 分钟、接收人不变、关联列表为空。

启用已有监听时，从查询结果复制真实 `uuid`，将完整配置写成：

```json
{
  "uuid": "<查询返回的真实监听uuid>",
  "processCodes": ["<真实processCode>"],
  "intervalTime": 60,
  "receiverIds": ["<真实userId>"],
  "status": "y"
}
```

先用同一 `--file` 命令预览，按用户明确要求启用后保存。此时预期 `status:y`、关联自动化和接收人均与文件一致；提醒实际送达另行核对。

## 日常管理

```bash
openyida integration copy APP_XXX FORM_XXX LPROC_SOURCE --name 副本名称 --dry-run
openyida integration copy APP_XXX FORM_XXX LPROC_SOURCE --name 副本名称
openyida integration rename APP_XXX FORM_XXX LPROC_COPY --name 副本新名称
```

`LPROC_SOURCE` 是原自动化，`LPROC_COPY` 填复制结果 `content.processCode`。预期副本为新 ID 且保持停用，改名只改副本。需要删除这个副本时，先核对其 ID 和停用状态，再执行 `integration delete APP_XXX FORM_XXX LPROC_COPY --confirm`。

仅可复制已发布过的流程，不能复制从未发布的草稿。复制限当前应用、同一表单，不做跨应用 ID 迁移，复制后验证保持停用。重命名和删除先校验绑定归属；删除仅接受已停用流，必须确有删除意图才传 --confirm。所有写入均单次提交，未知结果先查询，禁止盲目重试。真实测试只操作当前任务新建的测试资源。
