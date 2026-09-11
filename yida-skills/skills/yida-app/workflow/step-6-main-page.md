# Step 6：创建或复用主页面

确定完整应用的主入口 display 页面。已有主页面直接复用；缺少主页面且允许创建时才创建。

## 输入

- 真实 `appType`；
- Step 1 解析出的 page context；
- PRD 中的主页面、首页、工作台或门户门面需求；
- 当前 auth snapshot 的 `corpId`。

## 操作

1. 已有页面 URL、`formUuid` 或已绑定 display 页面 → 直接作为主页面，不执行 `use_skill("yida-create-page")`。
2. 缺少首页、工作台、智能助手或门户门面，且 Step 1 允许创建 → 执行 `use_skill("yida-create-page", "创建主入口自定义页面")`。
3. 创建页面前核对 PRD/resource context 与 auth snapshot 的 `corpId`。
4. `corpId` 不一致 → 先确认重新登录到目标组织，或确认在当前组织继续。
5. 创建 display 页面后记录真实主页面 `formUuid`。
6. PRD 采用自定义导航，或该页已确定 `entryMode=standalone` / 页面隐藏导航时，取得真实 `formUuid` 后立即执行 `openyida update-form-config <appType> <formUuid> false "<页面标题>"` 并 `get-form-config --json` 回读 `isRenderNav=false`；已有页面按同样规则处理，`create-page --hide-nav` 已配置成功时直接回读即可。该任务与 Step 7 的源码开发并行，不等待代码或发布完成。
7. 将页面导航配置结果交给 Step 8 做发布后核对。其余自定义页面同样在各自创建/复用成功后配置，不只处理主页面。

## 产出

- 主页面 display `formUuid`；
- 页面来源：显式页面、绑定页面、workspace cache、会话历史或本轮新建；
- `corpId` 核对结果。

## Checklist

- [ ] 已确认不会重复创建主页面；
- [ ] 已拿到真实 display `formUuid`；
- [ ] 创建或发布前已核对 `corpId`；
- [ ] `corpId` 不一致时已等待用户确认。

## 下一步

→ [Step 7：编写或更新页面](step-7-page-code.md)
