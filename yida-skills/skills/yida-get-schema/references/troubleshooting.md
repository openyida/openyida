# get-schema 排障规则

| 问题 | 处理 |
| --- | --- |
| 命令返回失败 | 核对 `appType`、`formUuid` 和登录态，修复后重新执行 |
| 输出过大或终端截断 | 改用 `--compact`、`--summary-json` 或 `--output-dir`，不用 shell 截断输出 |
| 找不到字段 | 查看 `missingFields`，确认字段已创建后重新查询 |
| 同名字段无法唯一确定 | 查看 `ambiguousFields[].matches[].labelPath` 和稳定 `path`，用完整路径或 fieldId 重查 |
| 需要多个表单字段 | 使用 `--all --summary-json --output-dir`，或每个目标表单执行一次 `--field-map-json` |
| 批量部分失败 | 查看 `failedCount` 和 `forms[].errorMsg`，调整 `--retries` 或 `--keyword` |
| Schema 为空 | 表单可能没有字段，先用 `yida-create-form-page` 创建字段 |
| 缓存与线上不一致 | 表单结构变化后重新查询并覆盖缓存 |

Schema 查询失败或字段没有唯一命中时，不继续数据写入、页面绑定、流程规则或报表配置。
