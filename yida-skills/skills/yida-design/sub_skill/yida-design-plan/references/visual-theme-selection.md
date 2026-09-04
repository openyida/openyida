# `ask_human` 完整视觉方向候选规则

## 用途

在 Step 2 生成、展示和回写完整视觉方向时读取。视觉方向是面向当前项目的一组完整决策；主题模板只是内部实现基底，不作为用户选择对象。

## 核心关系

```text
应用场景与视觉证据
  → AI 定义项目视觉方向
  → 绑定主题索引中的可落地基底
  → 用户选择一套完整方向
  → 四组已选视觉事实
  → Step 4 只读取一份完整模板并物化 design.md
```

执行顺序是“先定义方向，再匹配模板”，但方向必须受主题索引的可落地能力约束。索引中没有核心视觉 DNA 匹配项的方向，不得展示给用户。

应用导航类型在候选生成前由需求分析与应用编排确定。视觉方向决定跨页面共享的视觉气质、主题色、导航明暗、表面层级和形状语言，不改变页面内容、首屏重点、页面模式、信息密度或操作优先级。

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

CRM 与采购管理可以产生不同推荐方向，但依据不是行业名本身：CRM 更可能强调关系上下文、跟进节奏和信息浏览；采购更可能强调流程状态、批量处理、异常识别和高频执行。实际输入中的模块和任务始终优先于这种常见倾向。

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
2. `directionLabel`、`description` 和 `recommendationReason` 由 AI 根据项目生成，不直接复制主题索引的标签或摘要。
3. `themeId` 必须来自索引，三项绑定不同记录；模板路径由索引在选择后确定性补齐。
4. 候选保持已确认的导航类型；通过主题基底、主题色、导航明暗形成差异，优先至少两项不同。用户约束固定的部分保持不变。
5. “企业内部、专业、稳重”不能单独成为蓝色 + 浅色侧边导航的依据。
6. 用户明确品牌色时保留该颜色，通过主题基底、材质和组件表达形成差异。
7. 项目色彩和已确定导航可覆盖模板默认变量；表面层级、形状语言、组件机制等核心视觉 DNA 与模板冲突时必须换一个基底。
8. 未找到匹配模板的方向在展示前丢弃并重新生成，不能用运行时模板拼接补救。

平台顶部或侧边导航候选沿用对应结构；平台L型的最终布局由 `navigationType` 决定，候选不得将其改为单一顶部或侧边导航。自定义导航内部的顶部或侧边形态可由视觉设计细化，保持隐藏平台导航的决策。

## 用户可见边界

进度围绕当前应用的用户、主要功能和界面效果说明，不播报读取规则、查找模板或生成候选等内部步骤。需要等待时可说“正在为萌宠社交应用设计配色和界面风格，让宠物动态和互动入口更清晰”，应用名与功能必须来自当前需求。方案准备好后直接询问“萌宠社交应用的这三种界面风格，你更喜欢哪一种？”，紧接选择问题时省略额外进度说明。

用户只看到：

- `directionLabel`；
- `description`；
- `recommendationReason`；
- 第一项的“推荐”标记。

用户不看到主题索引标签、`themeId`、`templatePath`、模板来源和内部匹配过程。

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

未选中的候选只保留在 `ask_human` 问答历史，不保存到最终 `build-plan.json`。

## 直接选择与自定义输入

- 用户已明确主题色、导航结构和导航明暗，或要求严格继承可信品牌/模板时，AI 匹配一个有效基底并直接写入，`source=user_explicit | material_extracted`。
- 用户明确采用推荐方案或不再提问时，选择第一项，`source=ai_inferred`。
- 用户自由描述新方向时，先匹配核心视觉 DNA 最近且不违反硬约束的模板。能够匹配则记录原文为 `customText` 并写入项目覆盖项。
- 所有模板都不支持时，只问一次：采用最接近的可用基底，或返回三套方向重新选择。未确认前不生成 `design.md`。

## 运行时读取边界

- Step 2 只读取本规则和完整主题索引，不打开任何主题 Markdown。
- Step 2 不生成三份设计稿或 `design.md`。
- 用户选择后只保存选中方向和内部主题绑定。
- Step 4 只打开内部 `selectedTheme.themeId` 对应的一份完整模板。
