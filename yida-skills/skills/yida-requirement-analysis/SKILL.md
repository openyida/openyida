---
name: yida-requirement-analysis
description: 宜搭需求剖析。完整应用开始时整理行业、用户、业务目标、核心功能、业务对象、页面场景、品牌和色彩偏好，写入共享需求简报，供 yida-prd 与 yida-design 同时使用。
---

# yida-requirement-analysis

本技能把用户原始需求整理成一份共享需求简报。它不生成 PRD、视觉设计或页面源码。

## 何时使用

| 用户诉求 | 动作 |
| --- | --- |
| 从零搭建或补齐完整应用 | 先生成共享需求简报，再同时加载 `yida-prd` 和 `yida-design` |
| 用户要求分析行业、用户、功能范围或品牌方向 | 生成共享需求简报 |
| 只改字段、流程、页面源码、权限或发布 | 交给对应子技能 |

## 输出

写入 `.cache/openyida/<项目名>/requirement-brief.json`：

| 字段 | 内容 |
| --- | --- |
| `projectName` | 稳定的项目目录名 |
| `appName` | 用户可见的应用名称候选 |
| `industry` | 行业或业务领域 |
| `appType` | 企业管理、经营分析、流程审批、数据采集、客户服务、库存进销存、项目协作、资产设备、教育培训、知识内容、监控指挥、官网门户、活动报名或轻量工具 |
| `targetUsers` | 核心角色和使用场景 |
| `businessGoals` | 应用要解决的问题和成功结果 |
| `coreFunctions` | 1-3 个核心功能和必要辅助功能 |
| `businessObjects` | 客户、订单、项目、工单、商品、设备等核心对象 |
| `pageScenes` | 工作台、列表、详情、看板、大屏、官网等页面场景候选 |
| `brandHints` | 品牌、参考案例、素材和语气要求 |
| `colorHints` | 用户指定颜色、已有应用主题、偏好色和避用色；没有明确要求时写 `null` |
| `constraints` | 组织、已有资源、设备、权限、交付时间等约束 |
| `assumptions` | 无法确认但可采用默认值的事项 |
| `openQuestions` | 会改变业务范围或资源创建结果的未决问题 |

## 执行规则

1. 读取用户原始需求、已确认的会议需求稿和当前资源上下文。
2. 从业务用途判断行业、用户、核心功能、业务对象和页面场景。
3. 用户明确给出品牌色、主题 key、参考页面或已有应用主题时，原样写入 `brandHints` 或 `colorHints`。
4. 用户没有指定颜色时，记录业务气质和视觉目标，`colorHints` 写 `null`；最终主题色由 `yida-design` 决定。
5. 事实不足但不影响资源范围时写入 `assumptions`；会改变应用范围、数据对象或权限时写入 `openQuestions`。
6. 写入共享需求简报后，同时加载 `yida-prd` 和 `yida-design`。两个技能读取同一文件，互不等待。

## 边界

- 业务字段、资源蓝图、页面顺序和验收规则由 `yida-prd` 写入 `prd.md`。
- 主题 token、视觉 DNA、布局、组件和状态由 `yida-design` 写入 `design.md`。
- 真实 `appType`、`formUuid`、`fieldId` 等资源 ID 不写入需求简报。

## 完成条件

- `.cache/openyida/<项目名>/requirement-brief.json` 已写入。
- 行业、用户、业务目标、核心功能、业务对象和页面场景已明确。
- 品牌和色彩信息已记录为明确要求、已有主题或待设计状态。
- 没有生成 `prd.md`、`design.md` 或页面源码。
