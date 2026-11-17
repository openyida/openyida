# 历史普通表单记录与新增字段

发布新的表单 Schema 不代表历史记录已升级。普通更新默认保留历史版本；仅更新已有字段时，不必升级。CLI 不批量升级其他历史记录。

需要给指定历史记录写入后来新增的字段时，由用户显式选择：

```sh
openyida data update form <appType> --form-uuid <formUuid> --inst-id <formInstId> \
  --expect-form-name <真实名称> --expect-form-type receipt \
  --data-file .cache/openyida/patch.json --use-latest-version y --json
```

`--use-latest-version` 只接受 `y` 或 `n`。不传或传 `n` 时，不请求升级；若可读的历史实例组件清单明确缺少本次提交的顶层字段或子表叶子字段，CLI 返回 `DATA_FORM_UPGRADE_CHOICE_REQUIRED`，在写入前要求明确选择。已有空字段按组件清单识别，不会仅凭 formData 缺值就认定为新字段。空子表可能在两种历史投影中都被省略：只有记录版本与原生编辑 Schema 版本一致时，才能按当前定义填写其已有字段；子表历史清单不可读且无法确认同版时，返回 `DATA_FORM_UPGRADE_CHOICE_UNVERIFIED`、保持零写入，由用户明确选择是否升级。

选择 `y` 后，CLI 自动开启写前 Schema 校验和写后回读，即使没有额外传 `--verify-write`。写前读取已发布版本，并与当前记录的原生编辑 Schema 版本核对；通过记录与字段权限检查后，用原生单记录编辑接口发送一次 POST，明确指定版本和 `gmtModified` 乐观锁，只传本次补丁。写后必须证明实例版本达到写前观察到的版本、提交字段真实持久化。回读不一致返回非零及 `READBACK_VERSION_MISMATCH` 或字段问题，保留原实例 ID、`mutationAccepted` 和不可自动重试状态。请求升级不等于平台已经升级成功。

原生 DataMap 转换器会跳过 `null`，因此升级补丁含明确 `null` 时，CLI 写前拒绝整次操作，避免把清空意图静默忽略；可按字段支持的格式使用空字符串、空数组，或使用原生编辑器。其他字段值仍须通过既有类型与权限检查。

旧版 `updateFormData` 的 `useLatestVersion=y` 在真实对照中曾出现外层成功但未升级；GET、`true` 或额外 `formUuid` 也不能作为通用修复。不升级的更新沿用旧接口；显式升级采用上述原生单实例契约。并发冲突或失败后不自动重发、不回退旧接口，不调用运维批量迁移接口。版本或数据无法确认时，应先只读核对原记录及表单版本，再决定后续恢复。
