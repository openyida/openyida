# yida-app 执行细节参考

本文件只记录完整应用落地时的执行细节。完整应用阶段表见 `../workflow/build-stages.md`；`prd.md` 与 `design.md` 由 `yida-design` 生成。

## PRD / design.md / page-spec 关系

| 文件 | 输出方 | `yida-app` 如何使用 |
| --- | --- | --- |
| `prd/<项目名>/prd.md` | `yida-design` | 读取业务对象、资源关系、页面顺序、导航顺序和验收要求 |
| `prd/<项目名>/design.md` | `yida-design` | 读取页面实现必须遵守的视觉契约 |
| `page-spec.json` | 页面实现阶段按需派生 | 仅作为实现 handoff / 生成器输入；冲突时以 `prd.md + design.md` 为准 |

真实 `formUuid`、`fieldId`、`pageId` 等 ID 写入 `.cache/<项目名>-schema.json`；业务语义不写入 ID 映射文件，ID 不写入 PRD 正文。

## 路径口径

| 场景 | 路径 |
| --- | --- |
| 从 workspace 根执行命令 | `project/.cache/openyida/<项目名>/xxx-fields.json` |
| 从 `project/` 工作目录执行命令 | `.cache/openyida/<项目名>/xxx-fields.json` |
| Schema ID 映射 | `.cache/<项目名>-schema.json` |
| 页面源码（仓库根） | `project/pages/src/<页面名>.canvas.jsx` |
| 页面源码（`project/` 内） | `pages/src/<页面名>.canvas.jsx` |

## 字段文件样例

字段配置文件写到 `.cache/openyida/<项目名>/xxx-fields.json`，再把路径传给表单命令。

```json
[
  { "type": "TextField", "label": "访客姓名", "required": true },
  { "type": "PhoneField", "label": "联系电话" },
  { "type": "DateField", "label": "到访时间" },
  { "type": "SelectField", "label": "访问状态", "options": ["预约中", "已到访", "已离开"] }
]
```

命令成功后，把真实 ID 汇总到 `.cache/<项目名>-schema.json`：

```json
{
  "appType": "APP_XXXXXX",
  "pages": {
    "访客登记表": {
      "formUuid": "FORM-XXXXXX",
      "fields": {
        "访客姓名": "textField_xxxxxxxx"
      }
    }
  }
}
```

## 常用 URL

| 页面类型 | URL 格式 |
|---------|---------|
| 应用首页 | `{base_url}/{appType}/workbench` |
| 表单提交页（默认隐藏导航） | `{base_url}/{appType}/submission/{formUuid}?isRenderNav=false` |
| 自定义页面 | `{base_url}/{appType}/custom/{formUuid}` |
| 自定义页面隐藏导航 | `{base_url}/{appType}/custom/{formUuid}?isRenderNav=false` |
| 表单详情页（抽屉/隐藏导航） | `{base_url}/{appType}/formDetail/{formUuid}?formInstId={formInstId}&navConfig.layout=1180&isRenderNav=false` |

建议在链接末尾拼接 `corpid={corpId}`，便于切换到正确组织。

## seed records 规则

完整应用默认写入核心普通表单示例记录；用户明确不要造数、目标是配置字典/权限表、敏感个人数据表、纯附件表或字段缺少可安全构造值时跳过并说明原因。

- 每个核心普通表单写入 1-3 条；列表/工作台通常 2 条，看板/排行/状态分布通常 3 条。
- 示例记录必须是当前业务语义，不写“测试1 / demo / mock”。
- 先用 `openyida get-schema <appType> <formUuid> --field-map-json` 获取真实字段 ID。
- `DateField` / `CascadeDateField` 使用 13 位毫秒时间戳。
- 每条记录单独执行 `openyida data create form`，不要把多条实例作为顶层数组传入。
- 写入后执行 query 抽查至少 1 条，确认 `formData` 非空。

## 最终输出口径

完整应用 final 先写 2-3 句业务语言总结交付内容，再给一个主入口链接。不要默认列资源 ID 表格、资源清单或长列表。

推荐写法：

已完成订单、客户和商品等核心业务表单，并发布首页、订单管理和库存看板等入口页面。当前应用已支持订单录入、库存预警、销售统计、表单提交入口和详情查看，示例记录、轻量导航排序与表单详情样式也已就绪。

主入口：`{base_url}/{appType}/workbench`

只有用户明确要求排障、复盘资源 ID、迁移或复制配置时，才补充技术 ID。

## 删除应用确认

删除应用不可逆。执行前必须展示应用名称、应用 ID、影响范围，并等待用户回复“确认删除”或同等明确确认；模糊回复不能执行。

## 故障处理

| 场景 | 处理 |
|------|------|
| 发布提示登录失效 | 重新登录后再发布，不无修改重试 |
| corpId 不一致 | 询问重新登录或当前组织继续 |
| 不知道字段 ID | 使用 `yida-get-schema` 或 `.cache/<项目名>-schema.json` |
| 页面校验失败 | 依据页面技能的报错修源码，再重新校验 |
| 创建应用/表单失败 | 检查登录态、组织、参数、输入文件 |
