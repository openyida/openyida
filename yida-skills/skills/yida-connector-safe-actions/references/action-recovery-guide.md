# 动作恢复流程

## 需要恢复的信号

- 点击测试后动作消失。
- `openyida connector list-actions <connector-id>` 返回 0 个动作，但连接器仍存在。
- 历史动作只恢复了一部分，Token 或测试动作缺失。

## 常见原因

- 未确认平台兼容就展开复杂 `Code`、`Message`、`Data` 输出字段。
- 输入或输出叶子节点包含不必要的 `label`。
- GET 动作配置了 `Body`。
- `inputs` 与 `parameters.query` 不一致。
- 中文 JSON 没有按 UTF-8 读取或保存。
- 重建时只追加部分动作，遗漏原有动作。

## 恢复步骤

1. 执行 `openyida connector detail <connector-id>`，确认连接器仍存在。
2. 执行 `openyida connector list-actions <connector-id>`，确认当前动作数量。
3. 重新读取前端 API 和后端接口定义，生成完整动作列表。
4. 把原有 Token、测试和业务动作一起写入 JSON。
5. 未确认响应结构时只保留根对象 `Response`。
6. 执行 `connector add-action --confirm` 重建动作。
7. 执行 `list-actions` 验证动作数量。
8. 使用 `connector test --action <operationId>` 测试至少一个无参数动作。
9. 再次执行 `list-actions`，确认动作没有再次消失。
