---
name: yida-app-permission
description: 应用级管理员设置。查询和维护单个宜搭应用的应用主管理员、数据管理员、开发成员。适用于调整某个应用的管理员角色分配。
---

# 应用级管理员设置

## 适用范围

用户要求维护某一个 appType 的应用主管理员、数据管理员或开发成员时使用本技能。

`app-permission main` 是单个应用内的 `MAIN` 应用主管理员。`corp-manager app` 是组织级 `applicationCreateRole` 应用管理员。两者接口、作用域和成员列表不同，不能互换。

## 铁律

1. **人员身份必须明确**：添加成员前运行 `search-user`；同名人员用 userId 和部门路径区分。
2. **main 必须保留成员**：`MAIN` 是单应用最高管理员角色，after 至少包含一个 userId。
3. **set 是整组替换**：执行前展示完整 before/after；`--clear` 只用于 data 或 dev。
4. **平台状态是真相源**：每次修改都查询、确认并重查；本技能不使用 memory 保存管理员状态。

## 标准流程

1. **查询**：运行 `openyida app-permission get <appType>`，记录目标角色的 userIds。
2. **差异预览**：根据 add、remove、set 或 clear 计算并输出明确的 before/after。
3. **确认**：向用户确认 appType、角色、人员身份和完整 after；修改 main 时再次确认最高权限变化。
4. **写入**：只执行一次目标命令。
5. **重查验证**：再次运行 get，比较实际 userIds 与 after；输出 expected/actual，不一致时报告失败。

## 命令

查询应用角色：

```bash
openyida app-permission get <appType>
```

搜索人员：

```bash
openyida app-permission search-user "姓名或关键词" --dept "部门关键词"
```

增量添加或移除：

```bash
openyida app-permission add <appType> <main|data|dev> --users <userId1,userId2>
openyida app-permission remove <appType> <main|data|dev> --users <userId1,userId2>
```

整组替换或清空：

```bash
openyida app-permission set <appType> <main|data|dev> --users <userId1,userId2>
openyida app-permission set <appType> <data|dev> --clear
```

| CLI 角色 | 单应用含义 | 接口 adminType |
|----------|------------|----------------|
| `main` | 应用主管理员 | `MAIN` |
| `data` | 数据管理员 | `DATA` |
| `dev` | 开发成员 | `DEV` |

写命令的 JSON 输出包含写入结果和 `currentRole`。Agent 仍以独立 get 结果作为最终验证证据。

## 失败处理

| 结果 | 动作 |
|------|------|
| 搜索到同名人员 | 展示 userId 和部门路径，由用户确认目标 |
| main after 为空 | 零写入；要求至少保留一个主管理员 |
| 查询或登录态失败 | 零写入；运行 `openyida auth status` 并处理账号/组织 |
| 写入失败 | 停止；保留 before 和错误响应，不自动重复写入 |
| 重查不一致 | 输出 expected/actual，不宣称完成 |
| 网络超时 | 先运行 get 判断实际状态；无法证明时停止 |
