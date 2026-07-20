# Step 3：路由到 scene 文件

> 只读 Step 1 命中的那一个 `references/scenes/*.md`，不要一次读全部。

从命中的 scene 文件拿到：

- 场景定位
- 布局骨架 / 信息架构
- 信息密度
- 焦点（hero）元素
- 组件套餐（映射 `design-system.md` / `component-jsx-guide.md`）
- 该场景专属去 AI 味要点
- 视觉方向决策块示例

| 页面类型 | scene 文件 | 可选 reference pack |
|---|---|---|
| workbench | [references/scenes/workbench.md](../references/scenes/workbench.md) | `references/workbench/*` |
| dashboard | [references/scenes/dashboard.md](../references/scenes/dashboard.md) | `references/dashboard/*` |
| screen | [references/scenes/screen.md](../references/scenes/screen.md) | `references/dashboard/*` |
| list | [references/scenes/list.md](../references/scenes/list.md) | `references/list/*` |
| detail | [references/scenes/detail.md](../references/scenes/detail.md) | `references/detail/*` |
| landing | [references/scenes/landing.md](../references/scenes/landing.md) | `references/landing/*` |

## 专项变体路由

| 用户说法 | 先读 scene | 当前模板 | 备注 |
|---|---|---|---|
| 经营看板 / 数据看板 / 管理驾驶舱 | dashboard | `dashboard-overview` | 普通业务看板，不要回落 `product-homepage` |
| 数据大屏 / 实时监控 / 指挥舱 / 态势屏 | screen | `data-screen` | full-bleed 大屏，允许深色沉浸 |
| 工作台 / 运营台 / 任务中心 / 系统首页 | workbench | `workbench-home` | 入口、待办、状态优先 |
| 订单管理 / 客户列表 / 工单池 / 数据管理 | list | `business-list` | 筛选、表格、详情抽屉 |
| 客户档案 / 订单详情 / 商品详情 / 项目详情 | detail | `detail-profile` | 单对象叙事，避免字段墙 |
| 主从分栏 / 左列表右详情 / 处理台 | list | `split-pane-detail` | 保留列表上下文，右侧做对象详情和处理动作 |
| 页面内门户壳 / 多入口门户 / 隐藏导航门户 | workbench | `portal-shell-home` | 自带导航壳、角色入口和动态摘要 |
| Kanban / 阶段看板 / 商机阶段 | list | `business-list` 起步 | 决策块标注 `kanban` 模板缺口 |
| 日历 / 排班 / 预约 / 排期 | list | `business-list` 起步 | 决策块标注 `calendar` 模板缺口 |
| 门店地图 / 区域运营 / 物流分布 | dashboard | `dashboard-overview` 起步 | 决策块标注 `geo-map` 模板缺口 |
| 设置 / 规则配置 / 参数中心 | workbench | `workbench-home` 起步 | 决策块标注 `settings-console` 模板缺口 |
| 知识库 / 帮助中心 / 制度库 | landing 或 list | `official-homepage` 或 `business-list` | 对外展示偏 landing，内部检索偏 list |

## 产出

在决策块记录「布局骨架」「信息密度」「视觉焦点」三行（来自 scene 文件，按本页信息调整）。如果 scene 给出 Shell/Archetype、Section 构图或素材锚点，也写入「场景专项策略」。

需要更细的质量契约时，只读当前场景对应的 reference pack。例如 landing 读 `landing/research-levels.md` 和 `landing/section-patterns.md`，dashboard 读 `dashboard/component-contracts.md` 和 `dashboard/chart-contracts.md`；不要一次读完整 references 目录。

## 下一步

→ [Step 4：视觉方向决策](step-4-visual-decision.md)
