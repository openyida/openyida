# Step 1：页面类型判定

> 第一优先，决定后续所有决策。不同页面类型的信息架构、密度、焦点完全不同，**必须先锁类型再定风格**。

只读命中的那一个 scene 文件（遵循「只读必要文档」原则，不要一次读全部）：

| 页面类型 | 路由到 | 布局骨架 | 信息密度 | 焦点元素 |
|---|---|---|---|---|
| 工作台 / 门户首页 | `references/scenes/workbench.md` | 欢迎区 + 核心指标 + 快捷入口 + 我的待办 | 中 | 指标 + 快捷入口 |
| 页面内门户壳 / 多入口门户 | `references/scenes/workbench.md` + `portal-shell-home` 模板 | 自绘导航壳 + 角色入口 + 常用应用 + 动态摘要 | 中 | 入口导航 |
| 数据看板 / 驾驶舱 | `references/scenes/dashboard.md` | KPI 卡组 + 图表 + 排行/明细 | 高 | 关键 KPI |
| 列表 / 管理页 | `references/scenes/list.md` | 筛选栏 + 表格/卡片 + 分页 + 详情抽屉 | 高 | 数据表 |
| 详情 / 展示页 | `references/scenes/detail.md` | 单对象深度展示，叙事编排 | 低-中 | 主图/主对象 |
| 官网 / 落地页 / 品牌展示页 | `references/scenes/landing.md` | Hero + 差异化 Sections + 素材锚点 + CTA | 低-中 | 品牌/产品主张 |
| 数据大屏 / 监控大屏 | `references/scenes/screen.md` + `data-screen` 模板 | full-bleed 中心态势 + 左右信息塔 | 高 | 态势图/风险 |
| 主从分栏 / 工单处理台 | `references/scenes/list.md` + `split-pane-detail` 模板 | 左列表 + 右详情/处理区 | 高 | 当前选中对象 |
| Kanban / 阶段看板 | `references/scenes/list.md` 起步 | 阶段列 + 卡片 + 拖拽/状态流转 | 中-高 | 阶段列 |
| 日历 / 排期 / 预约 | `references/scenes/list.md` 起步 | 时间轴/日历格 + 事件详情 | 中 | 时间与资源冲突 |
| 地图 / 区域运营 | `references/scenes/dashboard.md` 起步 | 地图/区域分布 + 指标侧栏 | 高 | 地理态势 |
| 设置 / 配置中心 | `references/scenes/workbench.md` 起步 | 分类导航 + 配置项 + 保存反馈 | 中 | 当前配置组 |
| 知识库 / 帮助中心 | `references/scenes/landing.md` 或 `list.md` 起步 | 分类入口 + 文档列表 + 搜索 | 中 | 搜索/目录 |
| 打印 / 报告页 | `references/scenes/detail.md` 起步 | 报告封面 + 分节图表/正文 + 打印布局 | 中 | 报告结论 |

**判定信号**：看用户诉求里的核心动作——「进来先看什么、干什么」。综合门户/首页/工作台 → workbench；看数据趋势/大屏/驾驶舱 → dashboard；管理一批记录/搜索筛选 → list；深看某一个对象/展示单品 → detail；面向外部传播、品牌介绍、产品官网、活动/招商/方案落地页 → landing。信号冲突时按「用户明示 > 主数据形态 > 最典型场景」取默认，并在决策块里标注假设。

专项变体先归入最接近的五大 scene，避免模板误选：

- Kanban、日历、日志监控 → list 变体；主从分栏/处理台直接使用 `split-pane-detail`。
- 地图运营、区域态势、对比分析 → dashboard 变体；投屏/监控大屏改 `screen`。
- 设置中心、知识门户、AI 助手入口 → workbench 变体；页面内门户壳/多入口门户直接使用 `portal-shell-home`。
- 报告、打印单、客户画像、项目履约 → detail 变体。
- 公开 H5、活动页、招商页、品牌官网 → landing 变体。

> **边界提醒**：自定义页不做表单/录入 UI，所以没有「表单页」类型。需要录入/提交一律走原生表单（见 SKILL.md「重要边界」）。landing 也只负责展示与跳转，线索收集表单应跳/嵌入原生表单。

## 产出

在决策块「页面类型」一行记录：workbench / dashboard / list / detail / landing + 判定依据一句话。

## 下一步

→ [Step 2：意图解码](step-2-intent-decode.md)
