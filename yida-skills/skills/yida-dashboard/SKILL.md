---
name: yida-dashboard
description: "宜搭 Dashboard / 经营看板 / 管理驾驶舱 / 数据大屏专项技能。把表单、流程、报表或业务数据沉淀成可直接交付给高管汇报的组织内看板页面，默认包含真实数据接入、日期/财年/维度筛选、多端友好布局、卡片截图、组织内短链接、隐藏导航，以及按需打通「saveFormData → 集成自动化 → 待办2.0 连接器」的真实钉钉待办闭环。当用户提到「dashboard」「Dashboard」「看板」「经营看板」「业务看板」「管理驾驶舱」「经营驾驶舱」「数据大屏」「领导驾驶舱」「高层汇报」「指标卡截图」「组织内短链」「隐藏导航」「钉钉待办」等场景时，优先使用此技能；具体 ECharts 图表实现按需调用 yida-chart。"
license: MIT
metadata:
  audience: developers
  workflow: yida-development
  version: 1.0.0
  tags:
    - yida
    - dashboard
    - executive-report
    - data-visualization
---

# 宜搭 Dashboard 经营看板技能

## 定位与分工

本技能负责**完整 Dashboard 产品化交付**——不只是一个图表，而是一个可以直接给高管看、可以通过「saveFormData → 集成自动化 → 待办2.0 连接器」创建真实钉钉待办、可以截图发群、可以隐藏导航并生成组织内短链的**单屏经营驾驶舱**。

| 技能 | 定位 | 输出物 |
|------|------|-------|
| `yida-dashboard`（本技能） | 看板整体结构 + 交互闭环 + 视觉主题 + 发布链路 | 一个可交付的看板页面 |
| `yida-chart` | 单个 ECharts 图表的实现细节（CDN/setOption/原地更新等） | 图表代码片段 |
| `yida-report` | 宜搭原生报表（作为数据源） | REPORT-xxx 页面 |
| `yida-integration` | 集成自动化 + 连接器调用节点（派单闭环后端） | LPROC-xxx 已发布流 |
| `yida-custom-page` | 自定义页面基础规范（_customState/forceUpdate/var 兼容等） | JSX 代码规范 |

**依赖关系**：`yida-dashboard` → 调用 `yida-chart` 出图 → 依赖 `yida-report` 提供聚合数据 → 全部落在 `yida-custom-page` 的运行时之内。

---

## 何时触发

用户说以下任一关键词，直接用本技能（不要回退到 yida-chart 或 yida-report 做单图）：

- 看板 / 驾驶舱 / 大屏 / Dashboard / 数据大屏
- 经营看板 / 业务看板 / 管理驾驶舱 / 经营驾驶舱 / 领导驾驶舱
- 高层汇报 / 高管汇报 / 给老板看 / 给集团汇报
- 指标卡截图 / 卡片截图分享
- 组织内短链 + 隐藏导航 + 钉钉待办 组合出现

**反例（不用本技能）**：
- 只想美化一个单独图表 → `yida-chart`
- 只想出一个统计报表 → `yida-report`
- 批量录入数据 → `yida-table-form`

---

## 核心交付物（默认包含，缺一项算不合格）

1. **单屏控制塔结构**（见 `references/structure-and-layout.md`）
2. **真实数据接入**：KPI 走 `getDataAsync.json`，明细走 `searchFormDatas`，禁止前端聚合
3. **视觉主题选型**：深色紫蓝科技风 / 金蓝奢华风 / 白底商务风（见 `references/theme-presets.md`）
4. **每元素可派单闭环**：任何 KPI/图表/风险/动作项都能一键触发看板「派单触发表」的 saveFormData，由预先配置好的集成自动化自动调用「待办2.0 / 创建待办任务」连接器生成真实钉钉待办。前端只管写表，鉴权和连接器调用全部交给集成自动化在后端托管。不得把「工作通知」包装成待办（见 `references/interaction-patterns.md`）
5. **卡片截图分享**：html2canvas 1.4.1，每个核心卡片右上角有"截图"按钮
6. **多端响应**：PC 三列 / 平板两列 / 手机一列，断点 768 / 1024
7. **组织内短链 + 隐藏导航**：发布后配置 `isRenderNav=false` + 组织内分享 URL
8. **AI 快讯 marquee**（可选）：底部滚动字幕展示最新动态

---

## 完整交付流程

```
[Step 1] 澄清业务范围 → 5~8 个经营维度 + 核心指标清单
           ↓
[Step 2] 数据源就绪检查：
   - 有原生报表 → 记录 REPORT-xxx + 提取 cid/componentClassName
   - 没有原生报表 → 先调用 yida-report 技能创建数据源
   - 需要派单闭环 → **固定双件套**：
       (a) 用 `yida-create-form-page` 建一张「看板派单触发表」（TodoTrigger），最少 5 个字段：
            subject(TextField) / executor(EmployeeField) / description(TextareaField) /
            dueTime(DateField) / priority(RadioField 10/20/30/40 固定值)
       (b) 用 `openyida integration create <appType> <formUuid> "<看板名>-派单" --events create
            --connector-id G-CONN-1016B8AEBED50B01B8D00009
            --action-id G-ACT-1016B8B1911A0B01B8D0000I
            --connector-name "待办2.0"
            --connector-assignment unionId:processVar:<executor字段ID>
            --connector-assignment subject:processVar:<subject字段ID>
            --connector-assignment creatorId:processVar:form_inst_modifier
            --connector-assignment description:processVar:<description字段ID>
            --connector-assignment dueTime:processVar:<dueTime字段ID>
            --connector-assignment priority:literal:10         // ⚠ 必须 literal 数字
            --connector-assignment executorIds:processVar:<executor字段ID>
            --publish` 一键生成并发布
   - 需要审计台账 → 可以复用上面这张「派单触发表」，它本身就是最小审计表；也可以再加一张独立审计表记录 dingTodoId 回写
           ↓
[Step 3] 创建看板自定义页面（必须用 dashboard 模式）
   openyida create-page <appType> "<看板名>" --mode dashboard
           ↓
[Step 4] 选定视觉主题（见 references/theme-presets.md）
   默认：深色紫蓝（制造/物流/供应链/政务）
   金蓝奢华：酒店/零售高端/金融高净值
   白底商务：日常业务看板、财务报表
           ↓
[Step 5] 按照 references/structure-and-layout.md 的 5 层结构写 renderJsx
   header → filterBar → carbonBar(指标条) →
   控制塔(健康指数+4模块+今日动作+风险水位) →
   5 KPI → 2×3 图表 → 审批+数字化 → marquee → 派单弹窗
           ↓
[Step 6] 按 references/interaction-patterns.md 接入钉钉派单
   searchUser 真实路径 data.data.content + 前端 `self.utils.yida.saveFormData` 写入派单触发表 + 集成自动化后端自动调用待办连接器
           ↓
[Step 7] 本地校验 + 发布
   源码默认保存为 pages/src/<看板名>.oyd.jsx
   openyida check-page <源文件>
   openyida compile <源文件>
   openyida publish <源文件> <appType> <formUuid> --health-check
           ↓
[Step 8] 组织内短链 + 隐藏导航 + 卡片截图验证
   openyida verify-short-url <appType> <formUuid> <url>
   openyida save-share-config ... --hide-nav
```

---

## 严格禁止（NEVER DO）

1. **禁止前端聚合**：KPI/趋势/占比必须走 `getDataAsync.json`，不要用 `searchFormDatas` 拉完明细再 `reduce` 算总数
2. **禁止使用 onMouseEnter / onMouseLeave**：宜搭 Recore 引擎不支持，用 CSS `:hover` 伪类或 React state toggle
3. **禁止 class 组件**：本技能只用 `export function` + `_customState` 单例状态（见 `yida-custom-page`）
4. **禁止硬编码 userId 为 number**：EmployeeField 必须 `[String(userId)]` 数组格式
5. **禁止猜测 searchUser 返回路径**：真实路径是 `data.data.content`，见 `references/pitfalls.md`
6. **禁止把「工作通知」当作钉钉待办**：集成自动化里不允许只配「发送钉钉工作通知」节点就声称已打通待办；派单链路必须有一个 **ConnectorCall 节点**调用「待办2.0 / 创建待办任务」连接器。工作通知只能作为降级提醒，交付时必须写明"非真实待办"
7. **禁止在看板内直接 fetch 钉钉 OpenAPI 或写 accessToken**：必须通过集成自动化后端托管连接器鉴权
8. **禁止 cdnjs.cloudflare.com**：宜搭环境被拦截，ECharts / html2canvas 统一用 `g.alicdn.com`
9. **禁止缺少 `.sl-no-capture` 标记**：截图时"截图"按钮本身要被 html2canvas 排除
10. **禁止 2300 行一口气写到单个 create_file**：超过 1000 行用 `large-file-write` 技能或分批 append
11. **禁止集成自动化 priority 入参用 processVar 透传 RadioField/SelectField 的选项值**：连接器要求 Number(10/20/30/40)，必须 `priority:literal:10` 字面量赋值，否则执行记录会报"一方连接器异常：接口参数异常"

---

## 强制要求（MUST DO）

1. **先 explore 两个成品样本**：
   - `project/pages/src/supply-chain-dashboard.js`（历史深色紫蓝标杆，2356 行）
   - `project/pages/src/shangri-la-executive-dashboard.js`（历史金蓝奢华样本，1796 行）
   - 读取关键段学结构，不要凭空设计；新交付源码仍保存为 `.oyd.jsx`，并按 `yida-custom-page` 规范修正旧样本里的事件/数组回调写法
2. **审计表单字段 ID 在 FORM_CONFIG 常量集中声明**，便于一次性替换；`FORM_CONFIG.todoTrigger` 必须标注出 subject/executor/description/dueTime/priority 5 个字段 ID 与集成自动化 `--connector-assignment` 的映射完全一致
3. **前端派单统一走 `self.utils.yida.saveFormData`** 写入派单触发表，禁止引用已不存在的 `this.dataSourceMap.createDingTodo`。没有配置集成自动化时前端要 toast "派单触发表未配置集成自动化"，不要静默降级
4. **每次数据请求必写 catch + 降级渲染**，不要静默失败
5. **发布前用 `openyida check-page` 跑一次规范扫描**
6. **发布前用 `openyida compile` 做本地 Babel/UglifyJS 校验**；`.oyd.jsx` 会先执行 OpenYida 兼容构建
7. **首次发布必带 `--health-check`** 做首屏 HTTP 健康检查
8. **交付物验收必须包含组织内短链 URL**，纯 aliwork.com 链接不算交付

---

## 参考文档导航

| 文档 | 何时读 |
|------|-------|
| `references/structure-and-layout.md` | 写 renderJsx 之前，对齐 5 层结构 + 响应式断点 + 样式对象 |
| `references/theme-presets.md` | 澄清业务类型后选主题，直接 copy 完整配色常量 |
| `references/pitfalls.md` | 遇到报错先查这里；发布前也过一遍避坑清单 |
| `references/interaction-patterns.md` | 做派单/搜人/截图/marquee/短链时读 |

**实战样本**（直接读源码比读文档快）：
- `project/pages/src/supply-chain-dashboard.js` — 深色紫蓝 · 供应链/物流/制造标杆
- `project/pages/src/shangri-la-executive-dashboard.js` — 金蓝奢华 · 酒店/零售高端样本

> 注意：历史样本只参考布局、视觉和截图结构；其中早期 `页面数据源 createDingTodo` 直连连接器的写法已不再推荐（该方案依赖宜搭设计器手动绑定，Agent 无法通过 CLI 闭环）。新看板必须按 `interaction-patterns.md` 的「saveFormData → 集成自动化 → ConnectorCall」方案实现。

---

## 与 yida-chart 的协作边界

当你在本技能里实现某个具体图表（比如地图、桑基图、雷达图）遇到**图表级技术问题**（渲染不出来、数据结构怎么映射到 series、setOption 闪烁）时，**读 yida-chart 的 SKILL.md**，不要重复造轮子。

本技能只负责：
- 6 个图表应该画什么（区域营收 / 品牌矩阵 / 客群分布 / 渠道贡献 / NPS / 趋势）
- 2×3 网格布局
- 图表之间的联动筛选

本技能不负责：
- ECharts CDN 加载细节（由 yida-chart 规定）
- prdId 动态获取（由 yida-chart 规定）
- `getDataAsync.json` 参数细节（由 yida-chart 规定）

---

## 常见问题

**Q：客户没有真实数据，能不能先做 Demo 数据看效果？**

可以。在 `_customState` 里放 mock 数据数组，用注释清晰标注 `/* TODO: 接入真实报表 */`，交付时告诉用户"当前是演示数据，下一步接入 REPORT-xxx"。**禁止**把 mock 数据当作成品交付不告知。

**Q：看板发布后移动端打开卡顿？**

1. 检查是否每次 setState 都在重新 `init` 图表（应该用 `setOption(option, true)` 原地更新）
2. 检查是否加载了全量 `echarts.min.js`（5.6.0 完整版 ~900KB，移动端弱网慢），可考虑 `echarts-core` + 按需模块
3. 检查是否 marquee 用了大量 DOM 节点（用 CSS animation，不要 setInterval）

**Q：派单后钉钉没有出现真实待办？**

核对五件事（按优先级）：
1. 派单触发表是否挂了集成自动化：`openyida integration list <appType>` / 或直接去设计器看流程状态 `y`
2. 集成自动化执行记录是否有"执行异常 / 一方连接器异常：接口参数异常"：若是 → **95% 是 priority 没用 literal**，必须 `--connector-assignment priority:literal:10`（10=较低/20=普通/30=较高/40=最高）
3. `FORM_CONFIG.todoTrigger.fields` 的字段 ID 是否与集成自动化 `--connector-assignment <column>:processVar:<字段ID>` 完全一致
4. EmployeeField 在 saveFormData 里是否传成 `[String(userId)]` 数组（连接器会从数组自动取 unionId）
5. 钉钉应用 / 宜搭版本是否具备「待办2.0」连接器权限；无权限须向用户说明只能降级为工作通知

**Q：卡片截图里把"截图"按钮也拍进去了？**

给截图按钮加 class `sl-no-capture`，并在 `html2canvas` 调用时传 `ignoreElements: el => el.classList.contains('sl-no-capture')`。

**Q：看板要支持 3 个品牌/产品线/BU 切换视图，怎么做？**

在 `filterBar` 最左侧加一个"视图"下拉，切换时改 `_customState.viewKey` → 触发 `refreshAllData()` → 各图表 setOption 原地刷新。不要为每个视图复制一份页面。
