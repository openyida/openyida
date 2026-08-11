---
name: yida-publish-page
description: 检查、编译并发布宜搭自定义页面源码。
---

# 发布自定义页面

## 何时使用

- Code Canvas 页面源码完成后发布。
- 修改已有非 Code Canvas 的 `Jsx`、`renderJsx`、`.oyd.jsx` 或 `.jsx` 页面后重新发布。
- 用户要求上线、部署或覆盖已有自定义页面。

原生表单创建后直接生效，不使用本技能。

## 先确认目标

1. 用户提供页面 URL、display `formUuid` 或可唯一确认的 bound page 时，发布到该页面，不创建新 app 或 page。
2. 用户本轮明确指定的页面优先于会话 bound page；目标不明时先只读确认或询问用户。
3. 只有目标 display page 缺失且用户允许新增时，才使用 `yida-create-page`。
4. 发布目标必须是 `formType=display`。普通表单、流程表单和数据底表不能作为第三个参数。

```bash
openyida list-forms <appType> --keyword <页面名>
```

## 必须遵守

1. 新建或修改 `YidaCodeCanvas` 页面先加载 `yida-canvas-custom-page`；修改已有非 Code Canvas 页面才加载 `yida-custom-page`。
2. Code Canvas 使用 `.canvas.jsx` / `.canvas.tsx`；已有普通页面使用 `.oyd.jsx` / `.jsx`。
3. 新 Code Canvas 页面从 `openyida sample yida-canvas-custom-page canvas` 输出的唯一脚手架扩展。
4. 不编造 `appType` 或 `formUuid`，不把数据表 ID 当发布目标。
5. 发布前确认登录态和组织。corpId 不匹配时询问用户是否切换组织，不强行发布。
6. 本轮修改 `project/pages/src/*.{canvas.jsx,canvas.tsx,oyd.jsx,jsx,tsx}` 后，必须成功执行 `openyida publish <source> <appType> <displayPageFormUuid>`。本地编辑、diff、`check-page`、`compile` 或 `compileCanvasLocal` 只证明源码通过本地检查。
7. 发布结果以 CLI 返回值和线上回读为准。
8. 源码包含 `this.dataSourceMap.` 且输出包含 `No custom page data sources to preserve` 时，本次发布不能视为完成；按 [数据源保留](references/data-source-preservation.md) 修复后重发。
9. Code Canvas 发布后 CLI 自动执行基础导航排序并回读验证，保证自定义页面排在流程表单和普通表单前。执行失败或回读顺序不一致时发布命令失败；完整应用随后仍按 PRD 执行 `nav-group order --plan` 完成精确分组。

## 发布命令

```bash
openyida publish <源文件路径> <appType> <formUuid> [--compat] [--canvas] [--health-check] [--auto-nav-order] [--force]
```

从仓库根执行时使用 `project/pages/src/...`；从 `<workspace>/project` 执行时使用 `pages/src/...`。源文件不存在时先修正路径，不自动改发另一份文件。

| 参数 | 用途 |
| --- | --- |
| `--compat` | 普通 `.jsx` 强制使用兼容构建；`.oyd.jsx` 默认启用 |
| `--canvas` | 明确使用 Canvas 编译；`.canvas.jsx` 默认启用 |
| `--health-check` | 发布后检查页面 URL |
| `--auto-nav-order` | 普通 JSX 页面需要基础导航排序时使用；Code Canvas 已默认执行。完整应用仍使用 `nav-group order --plan` 落实 PRD 分组 |
| `--force` | 仅在已确认目标是 display page、但导航接口暂时无法识别时绕过类型保护；不会绕过 Code Canvas 的 `appType/formUuid/fieldId` 绑定校验 |

Code Canvas 发布时如果提示 `CANVAS_BINDING_*`，必须回到 `get-schema --field-map-json` 的真实结果修正源码。不要用 `--force` 绕过字段绑定错误。

普通页面发布前运行：

```bash
openyida check-page <源文件路径>
openyida compile <源文件路径>
openyida publish <源文件路径> <appType> <displayPageFormUuid> --health-check
```

Code Canvas 不使用普通页面的 `check-page` / `compile` 作为预检，直接由 `publish` 检查组件导入、交互事件和 `runtimeCode + importedModules`。

## 发布证明

- final 中“页面已更新、已重新发布或已上线”的依据只能是本轮成功的 `openyida publish` 结果。
- `<source>` 必须是本轮修改的源码，`<displayPageFormUuid>` 必须是已确认的目标页面。发布其他文件或其他页面，不满足本轮任务的完成条件。
- publish 未执行、失败或目标不明时，只能说明“源码已修改，尚未发布”，并写明命令或阻塞原因。
- 结果优先保留 URL、`formUuid`、`success:true` 和 health-check 摘要。

## 完成条件

- 发布目标是用户要求的 display page。
- CLI 返回发布成功。
- 发布后的页面可访问，必要时通过 `--health-check` 或浏览器验证。
- Code Canvas 发布结果包含成功的 `navOrder`，自定义页面排在流程表单和普通表单前。
- 普通页面依赖的设计器数据源仍存在。

## 参考文件

| 文件 | 什么时候读 |
| --- | --- |
| [数据源保留](references/data-source-preservation.md) | 重新发布已有普通页面，或源码包含 `this.dataSourceMap.*` 时 |
| [编译与排障](references/compile-and-troubleshoot.md) | 兼容构建、Babel、UglifyJS、Canvas 编译或发布后页面异常时 |

## 相关技能

| 技能 | 关系 |
| --- | --- |
| `yida-create-page` | 本轮要实现并发布的目标 display page 缺失且允许新增时创建页面 |
| `yida-canvas-custom-page` | 编写 Code Canvas 页面 |
| `yida-custom-page` | 维护已有普通 JSX 页面 |
| `yida-page-config` | 发布后配置公开访问或分享 |
| `yida-ppt-slider` | 编写特殊的全屏幻灯片页面 |
