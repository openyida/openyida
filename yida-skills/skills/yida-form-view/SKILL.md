---
name: yida-form-view
description: 宜搭原生数据管理视图配置。读取视图，配置列、筛选和表格操作列，新建、重命名和排序视图。
---

# 原生表单视图

用于原生数据管理页的配置；仅换颜色、边框和密度用 `yida-data-manage-ui`，修改表单字段用 `yida-create-form-page`，查询记录用 `yida-data-management`。

## 步骤

1. 按根技能核验登录和 app/form 上下文，复用已有表单。不要创建同名表单或用自定义页面替换原生列表。
2. 执行 `openyida form-view list <appType> <formUuid> --with-config --json`，读取全部视图及 `staticConfig/defaultConfig`。选择返回的真实 `viewUuid`，不要猜测或把 `formUuid` 当作视图 ID。
3. 执行 `openyida form-view inspect <appType> <formUuid> <viewUuid> --json`。消费 `fields[].id/operatorMap`、`config` 和 `configHash`；需要业务字段身份时同时使用 `get-schema --compact --resolve-fields`。操作符大小写与平台返回一致，不猜测 `eq/EQ`。
4. 将本轮最小配置写到项目缓存 JSON 文件；执行 `openyida form-view save <appType> <formUuid> <viewUuid> --config <file> --expected-hash <configHash> --json`。CLI 先备份，再保存并回读；仅 `readbackVerified=true` 为配置成功。
5. 打开真实数据管理页，验证列顺序、宽度、冻结、筛选、横向滚动及记录。个人浏览器视图偏好可能覆盖管理员默认配置，不能仅凭 API 回读宣称浏览器验收通过。

## 配置映射

| 配置 | 原生字段 |
| --- | --- |
| 默认显示列及顺序 | `defaultConfig.showFields`，真实字段 ID 数组；`"all"` 为全部；不能传空数组 |
| 列宽 | `defaultConfig.widths`，字段 ID 到正数像素宽度的对象；`null` 清空宽度设置 |
| 冻结列 | `defaultConfig.lockFieldIds`，已显示字段 ID 数组；`[]` 取消冻结 |
| 默认筛选 | `defaultConfig.filter`，`values/operationValues/conditionType` 原生对象；`{}` 清空 |
| 默认排序 | `defaultConfig.sort`，`[{"id":"真实字段ID","isAsc":"y"}]`；`n` 降序 |
| 可用字段 | `staticConfig.columnFilter`，字段 ID 数组，平台 `['all']` 表示全部；它不是数据权限 |
| 视图数据范围 | `staticConfig.dataRange`，使用现有原生规则结构；`{}` 清空，验收实际查询结果 |

示例（必须替换为 inspect 返回的真实字段 ID）：

```json
{
  "defaultConfig": {
    "showFields": ["textField_REAL", "selectField_REAL"],
    "widths": {"textField_REAL": 280, "selectField_REAL": 160},
    "lockFieldIds": ["textField_REAL"]
  }
}
```

对象递归合并，数组替换；`filter` 和 `dataRange` 整体替换。未指定的配置保留；不要提交从空对象重造的整套设置。服务端自动更新 `latestUpdateTime`，不能把它当成用户配置。

## 多视图

```bash
openyida form-view create <appType> <formUuid> --name "待处理订单" --json
openyida form-view order <appType> <formUuid> --config <order.json> --json
openyida form-view rename <appType> <formUuid> <viewUuid> --name "待处理订单" --json
```

create 只新建 table 视图，成功后复用返回 UUID 再配置。order 文件是包含当前全部视图 UUID 的数组（包括 form 视图），每项恰好一次，首项为默认入口。rename 使用平台返回的视图 UUID，名称去除首尾空格后限 20 字符，用于中文、英文和日文显示。save 写配置支持 table 视图。

## 向表格操作列添加按钮

用 `custom-button list` 查找数据所属表单的按钮 UUID。需要新按钮时，先用 `use_skill("yida-custom-button", "创建并回读表单自定义按钮")` 创建定义。再将该按钮追加到目标表格视图的操作列：

```bash
openyida form-view add-button <appType> <formUuid> <viewUuid> --button <buttonUuid> --expected-hash <configHash> --json
```

hash 来自目标视图的 inspect。已有同一引用时返回 `changed=false`。按钮按现有顺序追加，空按钮清单使用平台面板的系统按钮顺序。检查 `readbackVerified=true`，再在目标表格的操作列核对显示。

## 输出

重命名回读 `view.name`。添加按钮回读 `config.staticConfig.buttonList`。新增写入时保留 `backupPath`，用 `changed` 区分本次实际写入和已经生效的配置。

## 失败与恢复

- `FORM_VIEW_CONFLICT`：重新 inspect 后合并本轮修改；平台没有原子条件写入，避免多人同时编辑。
- 平台版本或权限拒绝：保留平台错误，停止写入；不修改版本、授权或额度。
- 写入传输错误或回读不一致时，保留 `backupPath`，先用 list 或 inspect 核对线上结果再决定是否重试。
- save 的备份文件包含原配置 `config.staticConfig/defaultConfig`。恢复时提取这两个对象写入恢复文件，重新 inspect 后使用 `save --replace --expected-hash <当前哈希>`；全量恢复必须提供两个完整配置对象，删除备份后新增的设置；其他资源和记录不在视图备份范围内。
