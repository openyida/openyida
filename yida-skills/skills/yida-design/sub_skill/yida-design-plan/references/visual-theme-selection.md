# `ask_human` 完整视觉方向候选规则

## 用途

- 用户已说明想要的风格，就按要求设计。
- 用户想比较几种风格时，读取本文，准备配色、菜单明暗和组件样式等方案供用户选择。
- 用户选界面风格，AI 负责匹配实现用的主题模板。

## 核心关系

```text
应用场景与视觉证据
  → AI 定义项目视觉方向
  → 选择命名模板，或自由创意独立推演
  → 用户选择一套完整方向
  → 风格、配色、导航和主题选择
  → CLI 读取所选完整模板并生成 design.md
```

先按[设计方向比较](../../../references/theme-selection.md#设计方向比较)根据项目需求发展风格，可匹配主题索引中的模板，也可独立推演。按[应用风格与自由创意](../../../references/application-style-library.md)交付。

应用编排先根据业务需求确定导航方式。视觉设计沿用该结果，设计各页面共用的配色、菜单明暗、背景、圆角和组件样式。页面内容、布局和操作顺序按业务规划执行。

主色按所选主题的公式推导，其他颜色沿用主题。已选方向承诺的画布、卡片、填充、字体或辅助色与模板不同时，将具体差异写入 `visualStyle.tokens`，不等待用户逐个指定色值。`description` 和 `colorStrategy.usage` 只说明用途，不会被编译成配色。按 [共用主题规则](../../../references/application-theme-consistency.md) 完成变量后再交接页面；渐变和图片按公共输出契约处理。Fast 与 Plan 使用相同规则。

## 公共选型规则

输入证据优先级、摘要匹配和读取边界统一按 [共享主题选择规则](../../../references/theme-selection.md) 执行。候选使用 [公共主题索引](../../../templates/design-themes/index.json) 或 `openyida design-plan catalog --json` 的 `themes[].styleSummary`；选中后才读取对应的一份完整模板。本文件只规定 Plan 的三套候选、用户可见内容和选择事实写入，不另设评分或主题库。

## 候选结构与约束

生成三项选择：两个具体视觉方向，加一项“自由创意：根据业务重新推演”。用户已明确风格时直接沿用，无需重选。具体方向包含：

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
3. 具体模板方向使用目录记录；自由创意使用 catalog.creativeOption，并填写独立设计决策和 Token，不绑定命名模板。
4. 候选保持已确认的导航类型；通过主题基底、主题色、导航明暗形成差异，优先至少两项不同。用户约束固定的部分保持不变。
5. 配色和菜单明暗应依据品牌素材、用户偏好和实际使用场景选择，并写清理由。
6. 用户明确品牌色时保留该颜色，通过主题基底、材质和组件表达形成差异。
7. 项目色彩和已确定导航可覆盖模板默认变量；核心特征冲突时可换基底，也可进入自由创意。
8. 没有匹配模板时走自由创意，不把原创方向改造成模板。

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
      "value": "free-creative",
      "label": "自由创意",
      "description": "根据这项业务重新推演构图、材质和表单布局，不从现成模板选取。"
    }
  ],
  "allowCustom": true,
  "aiDefault": "<first.directionId>"
}
```

## 一次保存选择结果

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

`build-plan.json` 保存选中方案；完整候选保留在 `ask_human` 问答历史中。上例只展示选择事实，已选方向需要的画布、字体、辅助色等差异还须写入同级 `tokens`，见 [共用主题示例](../../../references/application-theme-consistency.md#先把风格落到变量)。

## 直接选择与自定义输入

- 用户已明确主题色、导航结构和导航明暗，或要求严格继承可信品牌/模板时，AI 匹配一个有效基底并直接写入，`source=user_explicit | material_extracted`。
- 用户明确采用推荐方案或不再提问时，选择第一项，`source=ai_inferred`。
- 用户自由描述新方向时，先匹配核心视觉特征最近且不违反硬约束的模板。能够匹配则记录原文为 `customText` 并写入项目覆盖项。
- 所有模板都不支持时，只问一次：采用最接近的可用基底，或返回三套方向重新选择。收到选择后继续规划。

## 运行时读取边界

- Step 2 读取本规则和主题索引中的精简风格摘要，不读取候选模板全文。
- 候选阶段只提供方向名称、配色与体验说明。
- 用户选择后保存选中方向、内部主题绑定和实现该方向所需的 token 差异。
- 用户确认主题后，规划时读取 CLI 返回的主题上下文；CLI 仅按已确认的 selectedTheme.themeId 读取选中的完整模板生成文档。
