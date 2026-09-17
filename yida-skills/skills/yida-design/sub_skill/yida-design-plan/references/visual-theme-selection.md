# `ask_human` 完整视觉方向候选规则

## 用途

- 用户已说明想要的风格，就按要求设计。
- 用户想比较几种风格时，读取本文，准备配色、菜单明暗和组件样式等方案供用户选择。
- 用户选界面风格，AI 负责匹配实现用的主题模板。

## 核心关系

```text
应用场景与视觉证据
  → AI 定义项目视觉方向
  → 绑定主题索引中的可落地基底
  → 用户选择一套完整方向
  → 四组已选视觉事实
  → CLI 读取所选完整模板并生成 design.md
```

先按[设计方向比较](../../../references/style-design-selection.md#设计方向比较)根据项目需求发展风格，再匹配主题索引中的模板。匹配成功后，将方案提供给用户选择。

应用编排先根据业务需求确定导航方式。视觉设计沿用该结果，设计各页面共用的配色、菜单明暗、背景、圆角和组件样式。页面内容、布局和操作顺序按业务规划执行。

用户选择整体色彩氛围时，设置 `colorStrategy.surfaceTone=brand-tinted`，将配色应用到页面背景和容器。用户明确仅改强调色或保留参考配色时，设置为 `theme`。由 AI 根据用户的风格要求填写该字段。

## 输入与优先级

候选生成读取已确定导航类型的共享 brief、应用场景事实、视觉证据和 [主题索引](../templates/design-themes/index.json)。视觉证据优先级：

```text
用户明确视觉要求
> 品牌规范、Logo、官网、参考图和已有模板
> 业务场景特征
> AI 补齐
```

AI 需要综合判断：

- 关系经营 / 流程执行；
- 协作 / 执行 / 分析 / 服务；
- 使用频率、信息密度和主要终端；
- 产品气质和品牌强度；
- 已有品牌色、禁止项和参考素材。

根据实际模块和任务推荐风格。例如，CRM 可突出客户信息和跟进记录，采购管理可突出流程状态、批量操作和异常提醒。

## 候选结构与约束

生成恰好三套候选，每套包含：

```json
{
  "directionId": "relationship-context",
  "directionLabel": "关系洞察型",
  "description": "以客户上下文和跟进节奏为视觉主线，层级柔和但关键动作清晰。",
  "themeId": "<有效索引记录，仅内部>",
  "primaryColor": "#6F4E37",
  "primaryColorName": "暖咖啡棕",
  "navigationStructure": "side",
  "navigationTone": "dark",
  "recommendationReason": "适合需要持续查看关系历史和推进状态的日常工作。"
}
```

规则：

1. 第一项为推荐项。
2. `directionLabel`、`description` 和 `recommendationReason` 由 AI 根据项目的用户、任务和界面效果编写。
3. `themeId` 必须来自索引，三项绑定不同记录；模板路径由索引在选择后确定性补齐。
4. 候选保持已确认的导航类型；通过主题基底、主题色、导航明暗形成差异，优先至少两项不同。用户约束固定的部分保持不变。
5. 配色和菜单明暗应依据品牌素材、用户偏好和实际使用场景选择，并写清理由。
6. 用户明确品牌色时保留该颜色，通过主题基底、材质和组件表达形成差异。
7. 项目色彩和已确定导航可覆盖模板默认变量；表面层级、形状语言、组件机制等核心视觉 DNA 与模板冲突时必须换一个基底。
8. 方案缺少匹配模板时，重新设计并匹配，完成后再展示。

平台导航沿用 `navigationType` 对应的顶部、侧边或 L 型布局。自定义导航由视觉设计细化顶部、侧边等菜单样式，按该入口已确定的配置范围实施。

## 用户可见边界

进度说明当前应用正在设计的界面效果。例如：“正在为萌宠社交应用设计配色和界面风格，让宠物动态和互动入口更清晰。”应用名与功能使用当前需求中的内容。方案准备好后，直接提问：“萌宠社交应用的这三种界面风格，你更喜欢哪一种？”

风格确定后，写“设计主题风格为{风格名称}，适合{业务场景}”。名称取项目的视觉方向，场景取当前业务用途；建议阶段使用“建议采用……风格”。

用户只看到：

- `directionLabel`；
- `description`；
- `recommendationReason`；
- 第一项的“推荐”标记。

`themeId`、`templatePath` 和模板匹配结果保存在内部实施记录中。

```json
{
  "interactionId": "plan_visual_direction_r{revision}",
  "id": "visual_direction",
  "questionType": "single_choice",
  "title": "选择整体视觉方向",
  "prompt": "{应用名称}的这三种界面风格，你更喜欢哪一种？",
  "options": [
    {
      "value": "<first.directionId>",
      "label": "<first.directionLabel>（推荐）",
      "description": "<first.description> <first.recommendationReason>"
    },
    {
      "value": "<second.directionId>",
      "label": "<second.directionLabel>",
      "description": "<second.description> <second.recommendationReason>"
    },
    {
      "value": "<third.directionId>",
      "label": "<third.directionLabel>",
      "description": "<third.description> <third.recommendationReason>"
    }
  ],
  "allowCustom": true,
  "aiDefault": "<first.directionId>"
}
```

## 选择后的原子写入

选中一套方向后，一次写入四组事实：

```json
{
  "forUser": {
    "visualDirection": {
      "label": "关系洞察型",
      "description": "以客户上下文和跟进节奏为视觉主线，层级柔和但关键动作清晰。",
      "source": "user_selected"
    },
    "colorStrategy": {
      "source": "user_selected",
      "primaryColor": "#6F4E37",
      "primaryColorName": "暖咖啡棕",
      "usage": "用于主操作、关键焦点和选中状态",
      "confidence": "high"
    },
    "navigationStyle": {
      "structure": "side",
      "tone": "dark",
      "source": "user_selected",
      "selectionReason": "持续工作场景需要稳定入口，深色导航加强模块边界。"
    }
  },
  "internal": {
    "selectedTheme": {
      "themeId": "<selected.themeId>",
      "source": "user_selected",
      "customText": ""
    }
  }
}
```

`build-plan.json` 保存选中方案；完整候选保留在 `ask_human` 问答历史中。

## 直接选择与自定义输入

- 用户已明确主题色、导航结构和导航明暗，或要求严格继承可信品牌/模板时，AI 匹配一个有效基底并直接写入，`source=user_explicit | material_extracted`。
- 用户明确采用推荐方案或不再提问时，选择第一项，`source=ai_inferred`。
- 用户自由描述新方向时，先匹配核心视觉 DNA 最近且不违反硬约束的模板。能够匹配则记录原文为 `customText` 并写入项目覆盖项。
- 所有模板都不支持时，只问一次：采用最接近的可用基底，或返回三套方向重新选择。收到选择后继续规划。

## 运行时读取边界

- Step 2 读取本规则和完整主题索引。
- 候选阶段只提供方向名称、配色与体验说明。
- 用户选择后只保存选中方向和内部主题绑定。
- 规划时读取 CLI 返回的主题上下文；CLI 按 selectedTheme.themeId 读取完整模板生成文档。
