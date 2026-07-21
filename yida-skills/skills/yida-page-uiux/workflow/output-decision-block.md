# 输出：视觉方向决策块

> Step 6 自检通过后，输出如下结构（**纯方向，不含代码**），然后按页面实现链路落地：Code Canvas 交给 `yida-canvas-custom-page`；普通自定义页面 JSX/Jsx 组件链路或强依赖普通自定义页实例桥时交给 `yida-custom-page`。

```markdown
### 【视觉方向决策】

- **导航形态**：<导航可见（跟品牌融合）/ 导航隐藏 isRenderNav=false（视觉自立 + 自带导航壳，说明壳型）>
- **页面类型**：<workbench / dashboard / screen / list / detail / landing>（判定依据一句话）
- **researchLevel**：<none / light / enhanced / deep；官网默认 light，业务页默认 none>
- **appBlueprint**：<多页面应用写角色、导航分组、入口页、页面组合；来自应用体验蓝图时只摘当前页相关信息；单页写当前页作为 entry>
- **archetype**：<dashboard: overview/analysis/monitor/report/compare/operation；其他场景写 profile/table-management/operation/brand-home 等>
- **interactionProfile**：<primaryAction、detailMode(drawer/page/iframe/none)、bulkActions、empty/loading/error 状态>
- **insights**：<看板/报告/工作台写 1-3 条“结论 + 证据 + 建议”；无洞察则空数组>
- **dataBinding**：<真实数据来源；有表单写 mode=form + appType/formUuid/fields；有连接器写同源 endpoint；无真实数据的完整交付页写 mode=none/空态策略，只有 sample/离线预览可写 mode=seed 并标注演示数据>
- **气质关键词**：<2-3 个>
- **项目特定设计原则**：<3-5 条，具体到业务>
- **布局骨架**：<来自 scene 文件的骨架，按本页信息调整>
- **信息密度**：<紧凑 / 均衡 / 宽松 + 一句理由>
- **视觉焦点**：<这页唯一的主角是什么>
- **场景专项策略**：<landing 写 Section 构图 + 素材锚点 + 转化动作；dashboard 写 Shell + Archetype + 数据洞察落点；screen 写 full-bleed + 中心态势 + 左右信息塔；其他场景按需写导航壳/多视图>

### 【差异化 5 维】

1. 辅助/强调色：<取法 + 从哪个气质推导>
2. 中性冷暖偏色：<冷灰 / 中性 / 暖灰 + 理由>
3. 圆角性格：<直角 / 微圆 / 大圆，全页统一>
4. 排版性格：<字重对比 / 字号跨度 / 字间距 / tabular-nums 用法>
5. 装饰母题（视觉 DNA）：<2-3 个贯穿全页的视觉基因>

### 【反默认说明】

<一句话：本方案与「统一灰白底 + 8px 圆角卡片 + 系统字体 + 蓝色强调」的默认脸在哪 ≥3 个维度不同>

### 【图标策略】

<内联 SVG 语义集（默认）/ 用户提供的 iconfont URL（opt-in）；描边风格；只作功能用途>

---
> 下一步：Code Canvas 链路交 `yida-canvas-custom-page`，按 `canvas-design-system.md` 的 token/组件落地；普通自定义页面 JSX/Jsx 组件链路交 `yida-custom-page`，读取 `design-system.md`。
> 具体色值、圆角像素、间距、组件样式一律以 `design-system.md` 为准；本决策块只定方向与差异。
```

## 可执行 Page Spec 对齐

把上述决策交给 OpenYida CLI 时，必须尽量写入结构化 spec，避免只留在自然语言里：

```json
{
  "template": "dashboard-overview",
  "scene": "dashboard",
  "researchLevel": "none",
  "archetype": "overview",
  "appBlueprint": {
    "appName": "应用名称",
    "entry": "首页",
    "shell": "side_nav",
    "roles": ["运营", "主管"],
    "navigation": ["工作台", "数据看板", "基础配置"],
    "pages": [
      { "name": "首页", "scene": "workbench", "template": "workbench-home" }
    ]
  },
  "interactionProfile": {
    "primaryAction": "查看详情",
    "detailMode": "drawer",
    "bulkActions": ["导出"],
    "states": ["empty", "loading", "error"]
  },
  "insights": [
    { "conclusion": "华东区贡献 43%", "evidence": "环比 +5.2pp", "suggestion": "优先补货高增长门店" }
  ],
  "dataBinding": {
    "mode": "form",
    "appType": "APP_xxx",
    "formUuid": "FORM_xxx",
    "fields": {
      "code": "textField_xxx",
      "status": "selectField_xxx"
    }
  }
}
```

`generate-page` 会把这些字段标准化进 `.openyida-page.json` manifest；模板当前可通过 `OPENYIDA_APP_BLUEPRINT_JSON`、`OPENYIDA_INTERACTION_PROFILE_JSON`、`OPENYIDA_INSIGHTS_JSON`、`OPENYIDA_DATA_BINDING_JSON` 等变量消费。

## P2 模板 primitive 对齐

输出决策块时要顺手点名当前页应命中的 UI primitives，便于后续 Code Canvas 模板消费：

- `dashboard-overview`：KPI primitive、Chart panel、Rank list、Insight callout、Freshness badge。
- `workbench-home`：Workbench metric、Quick entry、Task feed、Insight strip。
- `business-list`：Filter bar、State badge、Bulk action bar、Detail preview。
- `detail-profile`：Object hero、Meta stack、Timeline primitive、Insight callout。
- `split-pane-detail`：Split queue、Filter bar、Detail pane、Timeline card、Insight card。
- `portal-shell-home`：Portal nav、Hero panel、Entry card、Dynamic card、Update feed。
- `official-homepage`：Hero visual、Proof strip、Service grid、Case visual，并优先填 `assets.heroImage`。
- `data-screen`：Command map、Metric grid、Rank panel、Screen insight header。

如果页面类型命中但 primitive 不足，应在“场景专项策略”里写清缺口，而不是回退到 `product-homepage` 或通用卡片布局。
