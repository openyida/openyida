---
name: yida-get-schema
description: 获取宜搭表单 Schema、真实 fieldId 和子表字段路径。涉及字段 ID 时先使用本技能。
---

# 获取表单 Schema

## 必须遵守

1. 任何 `fieldId`、子表路径或字段选项都必须来自本命令或已确认的新鲜缓存，不能按字段名称、前缀或终端截断文本猜测。
2. 只复制 JSON 返回的完整 `appType`、`formUuid` 和 `fieldId`。Canvas 发布会再次与线上 Schema 精确核对。
3. 页面开发默认使用 compact 输出，只读取需要的字段，不内联完整 Schema。
4. `missingFields` 或 `ambiguousFields` 非空时停止；使用完整 `labelPath`、稳定 `path` 或已返回的 `fieldId` 重新查询。
5. Schema 获取失败、输出不完整或表单结构已变时停止后续写操作并重新获取。
6. 同一阶段同一 `formUuid` 默认只拉取一次字段映射。需要新字段或表单已修改时才重新查询。
7. 不用 shell 重定向、`head`、`tail`、`grep`、`sed` 或 `awk` 保存或截取 Schema 作为字段证据。
8. 录入或更新数据后，执行 `openyida data query --size 1` 抽查；字段值全空时重新核对 `fieldId`。

## 何时使用

- 新增、更新或查询表单数据。
- 更新表单字段结构。
- 配置流程字段权限、公式或报表。
- Code Canvas 或已有普通 JSX 页面引用字段 ID。
- 查看表单结构、字段选项或子表路径。

## 最短路径

只需要少量字段时：

```bash
openyida get-schema <appType> <formUuid> --compact --resolve-fields "<字段1,字段2>"
```

读取唯一命中的 `fields[]`。同名字段不能默认取第一个。

需要一个表单的大部分字段或跨表单建立映射时：

```bash
openyida get-schema <appType> <formUuid> --field-map-json
```

每个目标表单执行一次，把完整 JSON 中需要的 `appType`、`formUuid`、`fieldId`、`label`、`componentName` 和 `options` 写入 `<projectRoot>/.cache/<项目名>-schema.json`。

需要多个表单时：

```bash
openyida get-schema <appType> --all --summary-json --output-dir .cache/openyida/<任务名>/schemas
```

只有需要完整组件 props、布局结构、字段数据源或排障时，才读取完整 Schema。

## 命令

```bash
openyida get-schema <appType> <formUuid> --compact [--resolve-fields <labelOrFieldId,...>]
openyida get-schema <appType> <formUuid> [--summary-json|--field-map-json]
openyida get-schema <appType> --all [--summary-json] [--output-dir <dir>] [--keyword <text>] [--concurrency N] [--retries N]
```

| 参数 | 说明 |
| --- | --- |
| `--compact` | 输出字段解析 contract，不输出完整 Schema |
| `--resolve-fields` | 按 label、fieldId、alias、稳定路径或 `子表/字段` 精确筛选 |
| `--summary-json` / `--field-map-json` | 输出字段摘要和选项 |
| `--all` | 获取应用下多个表单或页面 |
| `--output-dir` | 写入独立 JSON 文件并生成 `index.json` |
| `--keyword` | 按名称、UUID、类型或路径缩小范围 |
| `--concurrency` | 批量并发数，范围 1-10，默认 3 |
| `--retries` | 单项重试次数，范围 0-5，默认 1 |

## 缓存规则

- 简短 ID 映射写入 `<projectRoot>/.cache/<项目名>-schema.json`。
- 完整 Schema 写入 `<projectRoot>/.cache/openyida/<任务名>/<表单名>-schema.json`。
- 使用结构化文件工具写缓存；CLI 的进程内状态不是跨调用缓存。
- 目标字段缺失、重名、表单已修改或缓存新鲜度不明时，重新查询。

完整输出字段见 [输出 contract](references/output-contracts.md)。命令失败、字段缺失或批量部分失败时读取 [排障规则](references/troubleshooting.md)。

## 完成条件

- 需要的字段都唯一命中。
- 后续操作只使用完整返回值或已确认的缓存值。
- 没有使用截断输出或手工补全 ID。

## 参考文件

| 文件 | 什么时候读 |
| --- | --- |
| [输出 contract](references/output-contracts.md) | 需要解析 compact、摘要或批量输出字段时 |
| [排障规则](references/troubleshooting.md) | 命令失败、字段缺失、重名、输出过大或批量部分失败时 |
