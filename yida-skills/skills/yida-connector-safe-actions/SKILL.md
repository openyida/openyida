---
name: yida-connector-safe-actions
description: 从前端 API 或后端 Controller 代码提取接口，为已有宜搭连接器添加可执行动作。
---

# 宜搭连接器动作生成

## 何时使用

以下情况使用本技能：

- 已有连接器，需要添加执行动作。
- 用户提供前端 API 文件和后端 Controller 或接口定义文件。
- 连接器测试后动作列表为空，需要重建动作。

只创建连接器、配置鉴权或管理连接器账号时，使用 `yida-connector`。

## 必须遵守

1. 同时读取前端 API 和后端接口定义。前端文件决定要暴露哪些接口，后端文件决定 method、route、参数和默认值。
2. 不编造接口路径、参数、`action-id` 或响应字段。
3. 默认只生成前端实际调用的接口；用户明确要求时才覆盖后端全部接口。
4. 未确认响应结构时，输出只保留根对象 `Response`。
5. 动作 JSON 使用结构化文件工具写入 `.cache/openyida/<任务名>/connector-actions/`，不用 shell 重定向或 heredoc。
6. 测试动作时，`--action` 使用 `operationId`，不使用 `operation-1` 这类顺序 ID。
7. 动作曾被清空时，重建完整动作列表，不只追加缺失动作。

## 执行步骤

1. 读取前端 API 与后端接口定义。
2. 查询连接器和现有动作：

```bash
openyida connector detail <connector-id>
openyida connector list-actions <connector-id>
```

3. 按 [动作 JSON 规则](references/action-json-guide.md) 生成完整动作文件。
4. 添加动作：

```bash
openyida connector add-action --operations .cache/openyida/<任务名>/connector-actions/<业务名>-actions.json --connector-id <connector-id> --confirm
```

5. 查询动作列表，确认数量和 `operationId`。
6. 测试至少一个动作：

```bash
openyida connector test --connector-id <connector-id> --action <operationId>
```

7. 再次查询动作列表，确认测试没有清空动作。

动作列表为空或测试面板异常时，按 [动作恢复流程](references/action-recovery-guide.md) 重建并验证。

## 完成条件

- 生成的动作都能追溯到用户提供的源码。
- `list-actions` 返回预期动作和 `operationId`。
- 至少一个动作通过 CLI 测试。
- 测试后动作列表仍完整。

## 参考文件

| 文件 | 什么时候读 |
| --- | --- |
| [动作 JSON 规则](references/action-json-guide.md) | 生成动作文件、映射 Controller 或处理 Windows 中文 JSON 时 |
| [动作恢复流程](references/action-recovery-guide.md) | 动作列表为空、测试面板异常或历史动作需要重建时 |
