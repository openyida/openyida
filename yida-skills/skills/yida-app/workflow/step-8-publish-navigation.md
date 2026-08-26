# Step 8：发布页面并排序导航

发布本轮修改过的页面源码到真实 display 页面，并执行轻量导航排序。

## 输入

- 本轮修改过的页面源码路径；
- 真实 `appType`；
- 主页面 display `formUuid`；
- PRD 中的导航顺序。

## 操作

1. 执行 `use_skill("yida-publish-page", "发布主页面")`。
2. 新建主页面或本轮使用 `YidaCodeCanvas` 实现页面时执行：

```text
openyida publish <source> <appType> <displayPageFormUuid> --canvas --health-check --auto-nav-order
```

3. 已确认是存量平台 JSX 页面维护时执行 `openyida publish <source> <appType> <displayPageFormUuid> --health-check --auto-nav-order`。
4. `<source>` 使用本轮修改过的页面源码。
5. `<displayPageFormUuid>` 使用已解析的 display 自定义页面。
6. PRD 写明页面/表单清单顺序时，执行 `openyida nav-group order <appType> <页面/表单...>`。
7. PRD 缺少明确页面清单时，用 `--auto-nav-order` / `nav-group auto-order` 兜底。
8. 兜底顺序为：门户/首页/工作台入口、业务办理、数据管理、经营分析、系统配置。
9. 本步骤配置宜搭平台导航，不要求页面源码实现侧边栏或顶部应用导航；除非用户显式要求页面内自绘导航，否则不要回头在自定义页面中补导航壳。

## 产出

- 成功的 `openyida publish` 命令结果；
- 可访问主页面 URL；
- 导航排序结果或明确 warning。

## Checklist

- [ ] 发布 source 是本轮修改过的源码；
- [ ] 发布目标是已解析的 display 页面；
- [ ] Canvas 发布结果为 `publishMode=canvas`，且 `healthCheck.ok=true`、`healthCheck.readback.hasYidaCodeCanvas=true`、`runtimeCodeBytes>0`；
- [ ] 已获得可访问 URL；
- [ ] 导航排序已执行，或已有明确 warning。

## 下一步

→ [Step 9：输出与收尾](step-9-output-finish.md)
