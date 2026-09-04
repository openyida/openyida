# Step 8：发布页面并排序导航

发布本轮修改过的页面源码到真实 display 页面，并执行轻量导航排序。

## 输入

- 本轮修改过的页面源码路径；
- 真实 `appType`；
- 主页面 display `formUuid`；
- PRD 中的导航顺序；
- PRD 主页面的 `entryMode`。

## 操作

1. 执行 `use_skill("yida-publish-page", "发布主页面")`。
2. `<source>` 使用本轮修改过的源码，`<displayPageFormUuid>` 使用已解析的 display 自定义页面。
3. 根据 PRD 只选择一个互斥分支：

PRD 写明页面/表单清单顺序：

```text
openyida publish <source> <appType> <displayPageFormUuid> --canvas --health-check
openyida nav-group order <appType> <页面/表单...>
```

存量平台 JSX 页面去掉 `--canvas`。发布命令不得带 `--auto-nav-order`，显式排序只执行一次。

PRD 缺少明确页面清单：

```text
openyida publish <source> <appType> <displayPageFormUuid> --canvas --health-check --auto-nav-order
```

存量平台 JSX 页面去掉 `--canvas`。此分支不再执行 `nav-group order` 或 `nav-group auto-order`。

4. 同一搭建 Run 不得同时执行显式排序与自动排序，不生成逐项 `move` 的 Bash/Python 循环。
5. 兜底顺序为：门户/首页/工作台入口、业务办理、数据管理、经营分析、系统配置。
6. 本步骤配置宜搭平台导航，不要求页面源码实现侧边栏或顶部应用导航；除非用户显式要求页面内自绘导航，否则不要回头在自定义页面中补导航壳。
7. 主页面 `entryMode=standalone` 时，发布和健康检查通过后执行一次 `openyida update-form-config <appType> <displayPageFormUuid> false "<页面标题>"`，再执行 `openyida get-form-config <appType> <displayPageFormUuid> --json`。只有回读明确为 `isRenderNav=false` 时，才把干净的 `{base_url}/{appType}/custom/{displayPageFormUuid}` 交给 Step 9 作为独立业务入口；写入或回读失败时只保留工作台入口，不用 `?isRenderNav=false` 猜测成功。
8. 主页面 `entryMode=platform-shell` 或缺失时，不修改页面导航配置，也不输出独立业务入口。

## 产出

- 成功的 `openyida publish` 命令结果；
- 可访问主页面 URL；
- 导航排序的结构化结果；失败时保留发布结果和可恢复诊断；
- `standalone` 页面导航配置的写后回读结果，或明确未启用独立入口。

## Checklist

- [ ] 发布 source 是本轮修改过的源码；
- [ ] 发布目标是已解析的 display 页面；
- [ ] Canvas 发布结果为 `publishMode=canvas`，且 `healthCheck.ok=true`、`healthCheck.readback.hasYidaCodeCanvas=true`、`runtimeCodeBytes>0`；
- [ ] 已获得可访问 URL；
- [ ] 显式排序和自动排序只执行其一；成功结果 `readbackVerified=true`。
- [ ] `standalone` 主页面已回读确认 `isRenderNav=false`；否则没有声明独立业务入口。

## 下一步

→ [Step 9：输出与收尾](step-9-output-finish.md)
