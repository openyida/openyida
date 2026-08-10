---
name: yida-nav-group
description: 查询和设置宜搭应用左侧导航，包括分组、移动、排序、隐藏和显示。
---

# 应用导航分组

## 严格要求

- 操作前必须已知 `appType`；不要编造。
- 完整应用使用 PRD 的导航分组和顺序，不使用 `auto-order` 覆盖 PRD。
- 完整应用只执行一条 `order --plan` 命令，不让 Agent 逐条拼接 `create`、`move` 和普通 `order`。
- 导航计划只放本轮已经创建或复用的资源。以后才实现的页面不创建、不放入计划。
- 计划项优先使用真实 `formUuid` 或 `navUuid`；同时写资源名，用于检查 ID 是否映射正确。
- 命令只有在回读结果 `verification.matched=true` 时才算成功。
- 删除分组默认只删除空分组；非空分组必须先移动子项，除非用户明确要求 `--force`。
- 分组节点是 `navType: "NAV"`，普通页面是 `navType: "PAGE"`，外链是 `navType: "LINK"`，系统节点不要移动或删除。

## 完整应用

所有本轮资源拿到真实 ID 后，把 PRD 导航顺序转换为 `.cache/openyida/<项目名>/navigation-plan.json`：

```json
{
  "version": 1,
  "items": [
    { "ref": "PAGE_HOME_UUID", "name": "经营工作台" },
    {
      "group": "业务办理",
      "items": [
        { "ref": "PROCESS_FORM_UUID", "name": "采购审批" }
      ]
    },
    {
      "group": "数据管理",
      "items": [
        { "ref": "NORMAL_FORM_UUID", "name": "商品管理" }
      ]
    }
  ]
}
```

然后执行：

```bash
openyida nav-group order <appType> --plan .cache/openyida/<项目名>/navigation-plan.json
```

命令会先检查全部资源，再创建非空分组、移动和排序，最后回读导航树。必填资源不存在、ID 与名称不匹配、名称重复或回读不一致时直接失败。`--dry-run` 只检查和展示计划，不修改线上导航。

## 单点命令

### 查询导航树

```bash
openyida nav-group list <appType>
openyida nav-group list <appType> --flat
```

输出为 JSON。树形结果中 `type=group` 的节点即分组；`navUuid` 是后续重命名、删除、移动的稳定标识。

### 创建分组

```bash
openyida nav-group create <appType> "分组名"
openyida nav-group create <appType> "子分组名" --parent <groupNavUuid>
```

分组只能创建在根目录或一级分组下。

### 重命名分组

```bash
openyida nav-group rename <appType> <groupNavUuid|groupName> "新分组名"
```

同名分组可能歧义，优先使用 `navUuid`。

### 移动页面或分组

```bash
openyida nav-group move <appType> <formUuid|navUuid|name> --to <groupNavUuid|groupName|root>
openyida nav-group move <appType> <formUuid> --to <groupNavUuid> --before <siblingNavUuid>
openyida nav-group move <appType> <formUuid> --to root --after <siblingNavUuid>
```

常见场景：把新建表单放入已有分组：

```bash
openyida nav-group list APP_XXX --flat
openyida nav-group move APP_XXX FORM_XXX --to NAV_XXX
```

### 手动整理根导航

```bash
openyida nav-group order <appType> <formUuid|navUuid|name> [more items...]
openyida nav-group auto-order <appType>
```

不带 `--plan` 的 `order` 只调整根导航，适合用户明确要求移动少量导航项的单点任务。完整应用使用 `order --plan`。

`auto-order` 只用于没有 PRD 导航计划的单点任务。它按门户/首页/工作台、自定义页面、流程表单、普通表单排序根导航，不处理 PRD 分组。

### 删除分组

```bash
openyida nav-group delete <appType> <groupNavUuid>
```

非空分组会报错，先把子页面移动到其他分组或 `root`。

### 隐藏 / 显示导航项

```bash
openyida nav-group hide <appType> <navUuid|formUuid|name>
openyida nav-group show <appType> <navUuid|formUuid|name>
```

隐藏会同时设置 PC 与移动端导航隐藏。

## 接口事实

- 查询：`/dingtalk/web/{appType}/query/formnav/getFormNavigationListByOrder.json`
- 创建：`/dingtalk/web/{appType}/query/formnav/saveFormNavigation.json`
- 重命名：`/dingtalk/web/{appType}/query/formnav/updateNavigationTitle.json`
- 移动排序：`/dingtalk/web/{appType}/query/formnav/updateFormNavigationOrderNew.json`
- 删除：`/dingtalk/web/{appType}/query/formnav/deleteFormNavigation.json`

`ROOT` 分组的后端标识是 `NAV-SYSTEM-PARENT-UUID`，命令中可用 `root` 代替。
