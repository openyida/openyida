---
name: yida-corp-manager
description: 宜搭平台权限管理。查询和维护应用管理员、平台管理员、平台子管理员，以及通讯录可见性开关。触发词：「平台权限管理」「corpManager」「平台管理员」「通讯录权限」。
---

# 平台权限管理

## 适用范围

用户要求维护组织级应用管理员、平台管理员、平台子管理员或通讯录可见性时使用本技能。

`corp-manager app` 对应组织级 `applicationCreateRole` 应用管理员。`app-permission main` 对应某个 appType 内的 `MAIN` 应用主管理员。两者不是同一角色；用户只说“应用管理员”时先确认组织级还是单应用级。

## 铁律

1. **人员身份必须明确**：增删管理员前运行 `search-user`；同名人员必须用 userId 和 departmentNamePath 区分。
2. **组织权限必须确认**：写入前展示 roleType、人员、部门范围、管理场景和明确的 before/after。
3. **子管理员范围必须完整**：sub 必须提供非空 deptIds；scenes 未指定时 CLI 使用 `appManage,bulletinBoard`，差异预览必须展示该默认值。
4. **通讯录开关必须保留省略项**：先查询两个开关，after 中未指定的值保持 before。
5. **平台状态是真相源**：每次修改都查询并重查；本技能不使用 memory 保存组织权限。

## 标准流程

1. **查询**：人员先 search-user；角色运行 `list <role> --user <userId>`；通讯录运行 `address-book get`。
2. **差异预览**：输出明确的 before/after。add 展示新增角色及范围，remove 展示将删除的角色，通讯录展示两个开关。
3. **确认**：用户确认 userId、组织角色、deptIds、scenes 或可见性开关。
4. **写入**：执行一次 add、remove 或 address-book set。
5. **重查验证**：使用同一 list 或 address-book get 比较 expected/actual；不一致时报告失败。

## 命令

搜索人员：

```bash
openyida corp-manager search-user "姓名或关键词" --dept "部门关键词"
```

查询组织管理员：

```bash
openyida corp-manager list <app|platform|sub> --user <userId>
```

添加或更新：

```bash
openyida corp-manager add app --user <userId>
openyida corp-manager add platform --user <userId>
openyida corp-manager add sub --user <userId> --dept-ids <id1,id2> --scenes <scene1,scene2>
```

移除：

```bash
openyida corp-manager remove <app|platform|sub> --user <userId>
```

通讯录可见性：

```bash
openyida corp-manager address-book get
openyida corp-manager address-book set --all-visible <y|n> --admin-visible <y|n>
```

| CLI 角色 | 组织级含义 | 接口 roleType |
|----------|------------|---------------|
| `app` | 应用管理员 | `applicationCreateRole` |
| `platform` | 平台管理员 | `corpAdminRole` |
| `sub` | 平台子管理员 | `subCorpAdminRole` |

sub 的 `--dept-ids` 传部门 ID，多个值用逗号分隔。`--scenes` 当前已知值：

| scene | 含义 |
|-------|------|
| `appManage` | 应用管理 |
| `bulletinBoard` | 公告栏定制 |

## 失败处理

| 结果 | 动作 |
|------|------|
| 角色层级不明确 | 零写入；确认 corp-manager app 或 app-permission main |
| 同名人员或部门不明确 | 零写入；展示搜索结果并让用户确认 userId/deptIds |
| sub 缺少部门范围 | 零写入；要求明确 deptIds |
| 查询或登录态失败 | 零写入；运行 `openyida auth status` 并处理账号/组织 |
| 写入失败 | 停止；保留 before 和错误响应，不自动重复写入 |
| 重查不一致 | 输出 expected/actual，不宣称完成 |
| 网络超时 | 先重查实际状态；无法证明时停止 |
