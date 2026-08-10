# 表单创建与更新规则

## 选择目标

1. 用户本轮明确指定的表单优先于已绑定表单和本地缓存。
2. 已有 `formUuid`、表单 URL 或唯一匹配的表单时，使用 update、patch、rule、validation、bind-datasource 或 add-option。
3. 只有目标表单不存在，并且用户允许新增数据收集入口时，才使用 create。
4. 同级候选无法唯一确定时先询问用户，不创建同名表单绕过歧义。

## 创建命令

```bash
openyida create-form create <appType> "<formTitle>" <fieldsJsonFile> \
  [--layout single|double|card] \
  [--theme default|compact|comfortable] \
  [--label-align top|left|right] \
  [--locale zh_CN|en_US|ja_JP] \
  [--open|--no-open]
```

创建成功后保存命令返回的真实 `formUuid`。不要从表单名称推导 ID。

## 创建失败后的处理

创建命令失败后，不要立即重复执行同一条命令：

1. 检查字段文件存在、JSON 完整，并且内容是 create 所需的字段定义。
2. 执行 `openyida list-forms <appType> --keyword "<formTitle>"`。
3. 如果远端已经出现本轮创建的表单，保留该表单并使用 update 或 patch 继续，不再创建同名表单。
4. 只有远端不存在目标表单，并且已经修正字段文件、参数、登录态或组织后，才重试 create。
5. 仍然失败时停止，保留完整 stdout、stderr、字段文件路径、`appType`、表单名称和已经发现的 `formUuid`。

后续示例数据写入失败时保留已经创建的表单。示例数据由 `yida-data-management` 处理，不通过重新建表恢复。

## 字段定位

update、add-option、bind-datasource、validation 和 rule 支持以下目标写法：

- 唯一字段名称：`label`
- 子表内字段：`tableLabel + label`
- 已知真实字段 ID：`fieldId`

CLI 会读取当前 Schema 并返回精简结果：

- 成功：读取 `resolved` 和 `updatedProps`，确认实际字段和修改内容。
- 失败或重名：读取 `diagnostics[].candidates`，补充 `tableLabel`、修正名称或改用候选中的完整 `fieldId`。

字段级操作通常不需要先获取完整 Schema。以下情况再使用 `yida-get-schema`：

- 候选仍然无法唯一确定。
- patch 需要底层 Schema 路径。
- 页面、公式或流程需要多字段映射。
- 需要人工核对完整字段结构。

## 完成检查

- create 返回真实 `formUuid`；更新命令返回真实 `resolved` 字段证据。
- Schema 回读与输入的字段、分组、校验和规则一致。
- 创建阶段部分成功时复用远端表单，没有产生重复表单。
