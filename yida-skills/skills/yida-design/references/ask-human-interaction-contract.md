# 用户交互与可见表达契约

## 用途

需求分析、业务规划、视觉设计及应用编排输出进度消息，或需要用户选择、补充和确认时，执行本契约。内部执行保持技术字段精确，用户可见内容使用业务语言。

## 用户可见表达

用户可见内容只说明三件事：已经理解或完成什么、接下来做什么、用户现在需要决定什么。

1. 进度消息使用业务结果和下一步动作。结构化问题紧随其后时，不额外发送内部分析结论；多个问题确需共同背景时，只在整组交互的引导中说明一次，不写入每个问题的 `title` 或 `prompt`。
2. `title`、`prompt`、`label`、`description` 和普通对话只使用用户能直接理解的业务词。
3. `interactionId`、`questionType`、`value`、`writeBackPath`、`reason`、状态字段和文件路径仅供内部执行，不进入用户可见内容。
4. `title` 只写确认主题，`prompt` 只写用户当前需要回答的问题；搭建模式和导航类型保持中性，不标记“推荐”或“默认”，不预选、不按偏好排序，也不在引导或描述中推荐；其他问题存在合理默认值时可标记。只有某个选择会产生重要且难以撤销的影响时，才在对应选项的 `description` 中说明影响。
5. 用户已经提供的信息直接写入内部事实，不重复总结成“缺口分析”或再次追问。
6. PRD 的业务说明、HTML、进度消息和交付总结使用功能、体验和验收结果描述配置。接口参数、配置键值、内部 ID 和 CLI 选项保留在 Agent 实施交接中；访问链接使用业务名称，链接目标保留必需参数。用户明确询问实现细节时，再解释对应技术内容。
7. 规划写预期行为，进度写正在进行的动作，完成总结依据实际验证结果。导航方案写“采用自定义导航，支持各业务页面间切换”；完成配置并验证跳转后写“已启用自定义导航，可在各业务页面间切换”。

内部表达按下表转换为用户可见表达：

| 内部表达 | 用户可见表达 |
| --- | --- |
| 技能名、执行身份、加载技能或交互契约 | 按当前动作表述为“需求分析”“业务规划”或“视觉设计”，说明正在处理的业务内容 |
| 读取视觉规则、查找主题模板、生成候选 | 准备期间说明当前应用正在设计的配色、界面风格及业务用途；方案就绪后直接邀请用户选择应用风格 |
| Gate、选择设计模式、`designMode` | 选择搭建方式 |
| Fast Design | Fast（直接搭建） |
| Plan Design | Plan（先确认方案） |
| 进入 Step、加载分支、返回上层流程 | 说明下一项业务动作；没有用户价值时省略 |
| 缺口、阻塞项、对焦 | 还需要确认的关键信息 |
| `required`、`missingSlots`、`writeBackPath`、`reason` | 仅内部使用，不展示 |
| `meta.revision`、`meta.status`、`planState` | 当前这版方案或第 N 版方案 |
| `hideAppNav=y`、`isRenderNav=false` | 隐藏平台导航，使用自定义导航或独立页面入口；按当前导航方案描述 |
| `appType`、`formUuid`、接口参数、CLI 选项 | 使用应用名、页面名及对应业务动作描述 |

发送用户可见内容或执行 `ask_human` 前检查：展示字段不包含 Skill 名、Gate、Fast Design、Plan Design、`ask_human`、Step、交互契约、状态字段、缺口、阻塞项、对焦、加载分支或写回路径。

Plan / Fast 是面向用户的模式名称，可以展示。模式问题固定提供这两个选项；说明只写是否先确认方案，不列技能、工具、命令、内部文件或历史项目经历，也不提供跳过业务规划和视觉设计的搭建选项。

## 逻辑动作与宿主适配

技能文档统一使用 `ask_human` 表示“向用户提问并等待回答”的逻辑动作。宿主按当前可用能力完成适配：

1. 宿主提供结构化提问工具时，必须实际调用该工具并等待结果；文字说明、Markdown 选项、JSON 问题对象都不能替代工具调用。
2. 宿主没有结构化提问工具，或工具调用失败时，使用普通对话展示相同问题和选项，并停止后续执行直到用户回答。
3. 宿主工具名称由运行环境决定。技能不固定写死 `request_user_input`、`AskUserQuestion` 或其他实现名称。
4. 用户回答后，将结果写入问题声明的 `writeBackPath`，再继续当前阶段。

## 交互类型

| 场景             | 类型                                           | 必填内容                     | 回写位置                      |
| ---------------- | ---------------------------------------------- | ---------------------------- | ----------------------------- |
| Fast / Plan Gate | `single_choice`                                | Plan（先确认方案）、Fast（直接搭建） | 当前会话的 `designMode`       |
| 应用范围确认     | `multi_choice`                                 | 场景化模块、推荐范围、自定义 | `overview.moduleScope`        |
| 应用导航类型 | `single_choice` | 平台L型、平台顶部、平台侧边、自定义导航及功能说明 | brief 的 `navigation` |
| 完整视觉方向     | `single_choice`                                | 三套完整方向、推荐理由       | 四组已选视觉事实              |
| 来源补齐         | `free_text`                                    | 可读正文、链接或附件         | `meta.source`                 |
| 最新搭建计划确认 | `confirm`                                      | 当前版本、确认生成、继续调整 | `meta.planState`              |

每个逻辑问题至少包含：

- `interactionId`：当前交互唯一标识。
- `questionType`：交互类型。
- `title`：选择 UI 的短标题。
- `prompt`：用户当前需要回答的问题。
- `options`：选择项；自由输入时为空数组。
- `allowCustom`：是否允许用户补充自定义答案。
- `writeBackPath`：答案写回位置。

模式选择使用以下逻辑问题，固定按 Plan / Fast 排列，平等说明两种模式，等待用户选择：

```json
{
  "interactionId": "design_mode_gate",
  "questionType": "single_choice",
  "title": "选择搭建方式",
  "prompt": "你希望用哪种模式搭建这个应用？",
  "options": [
    {
      "value": "plan",
      "label": "Plan（先确认方案）",
      "description": "先确认功能、流程和页面结构，再开始搭建，可减少后续调整。"
    },
    {
      "value": "fast",
      "label": "Fast（直接搭建）",
      "description": "根据需求完成业务规划和视觉设计后直接搭建，不单独等待方案确认。"
    }
  ],
  "allowCustom": false,
  "writeBackPath": "session.designMode"
}
```

Gate 执行前先处理以下情况：

- 用户只提供了当前不可读取的文档、听记、模板或附件 → 先执行来源补齐 `ask_human`，拿到可读需求后再展示 Gate。
- 用户明确要求直接生成或跳过计划 → 写入 `session.designMode=fast`，不重复展示 Gate。
- 用户明确要求先出计划、先对焦或先确认 → 写入 `session.designMode=plan`，不重复展示 Gate。
- 模式不明确 → 根据需求范围生成一句上下文说明，再展示 Gate 并等待回答；首次搭建无 appType 或已有 appType 但无页面都适用。只复用同一次搭建中用户已明确的选择，说明可以区分简单应用、多模块内部应用和前后台复合应用，但不能替用户选择。

可使用以下用户可见上下文文案：

- 多模块内部应用：这个系统包含多个相互关联的功能。
- 简单应用：当前需求范围比较清晰。
- 前后台复合应用：这个系统同时包含用户端和管理端。

Gate 同时记录 `session.gateReason`，说明模式来自用户明确表达还是 Gate 选择。兼容旧字段时，原“进入搭建计划”和 `userSelectedMode=build_plan` 映射为 `session.designMode=plan`；原“直接执行”和 `userSelectedMode=direct_execute` 映射为 `session.designMode=fast`。模式选择不写入 `build-plan.html`。

## Plan 计划前确认

Plan 先确定应用范围与导航类型，再选择视觉方向，最后开始 PRD 规划。只询问影响决策的未决项，已有明确选择直接复用。

1. 范围不足时询问业务模块；对象、字段和一般流程细节由业务规划完善。
2. 不清楚用户需要哪种应用导航时，按平台L型、平台顶部、平台侧边、自定义导航的固定顺序询问，平等说明各类型的布局与行为。自定义导航须说明会隐藏应用及各页面的平台导航。
3. 范围与导航问题可合并；待导航确定后，再生成遵守该类型的视觉候选。按依赖分步确认，不为压缩提问轮次跳过导航决策。
4. 用户已明确完整视觉方向、采用推荐方案或要求不再提问时直接采用；推断选择记录依据。
5. 确认后的导航类型约束 PRD 和视觉设计。后续调整由需求分析更新同一份 brief，再同步相关产物。

多个逻辑问题需要共同背景时，整组交互开头最多使用一句引导，例如：

> 请确认「{应用名称}」的应用范围和导航方式。

没有必要时省略引导。不得把引导语、AI 后续动作、流程说明或“之后可以调整”等内容复制或改写到 `title`、`prompt` 和选项名称中。

Plan 计划前问题使用以下文案边界：

- 应用范围：`title=选择应用范围`；`prompt={应用名称}主要包含哪些业务模块？`
- 导航类型：`title=选择应用导航`；`prompt={应用名称}使用哪种导航方式？`
- 视觉方向：`title=选择整体视觉方向`；`prompt={应用名称}的整体视觉方向，你更喜欢哪一套？`

范围问题必须根据 CRM、采购、项目、访客等当前场景动态生成选项，不得复用固定通用问卷。视觉选项只展示 AI 生成的方向名称、体验说明和推荐理由，不展示主题模板名称、`themeId` 或路径。

完整视觉方向的选中结果必须原子回写：

- `visualStyle.forUser.visualDirection`
- `visualStyle.internal.selectedTheme`
- `visualStyle.forUser.colorStrategy`
- `visualStyle.forUser.navigationStyle`

未选候选只存在于当前交互历史，不写入 `build-plan.json`。

## 搭建计划展示

Plan Design 完成当前版本后，按以下顺序与用户交互：

1. 在会话中使用“当前这版方案”或“第 N 版方案”，给出 3-7 条业务摘要；原始 `meta.revision` 仅用于内部状态绑定。
2. 以宿主支持的文件链接、附件或可打开产物形式展示 `prd/<项目名>/build-plan.html`。
3. 将 `meta.status` 更新为 `awaiting_confirmation`，并令 `meta.planState.presentedRevision` 等于 `meta.revision`。
4. 执行“最新搭建计划确认”类型的 `ask_human`，提供“确认并开始搭建”和“继续调整”两个选择。

`build-plan.html` 不承载对话控件或确认按钮；用户在会话中完成确认。

最终确认使用以下逻辑问题，其中 `{revision}` 替换为当前版本号：

```json
{
  "interactionId": "plan_confirm_r{revision}",
  "questionType": "confirm",
  "title": "确认整体方案",
  "prompt": "是否按当前这版方案开始搭建？",
  "options": [
    {
      "value": "confirm_build",
      "label": "确认并开始搭建",
      "description": "按当前方案创建应用、表单、流程和页面。"
    },
    {
      "value": "continue_editing",
      "label": "继续调整",
      "description": "继续完善当前方案，确认后再开始搭建。"
    }
  ],
  "allowCustom": false,
  "writeBackPath": "meta.planState"
}
```

## 版本与确认状态

`build-plan.json` 使用 `meta.revision`、`meta.status` 和 `meta.planState` 共同记录当前计划状态：

```json
{
  "revision": "2026-08-27-01",
  "status": "draft | awaiting_confirmation | confirmed",
  "planState": {
    "presentedRevision": "2026-08-27-01",
    "confirmedRevision": null,
    "planConfirmed": false,
    "confirmationInteractionId": "",
    "confirmedAt": ""
  }
}
```

状态更新规则：

1. 首次生成计划时创建 `meta.revision`，设置 `meta.status=draft`、`meta.planState.planConfirmed=false`。
2. 每次修改影响搭建计划事实时生成新的 `meta.revision`，并清空旧确认信息。
3. 计划展示完成后设置 `meta.status=awaiting_confirmation` 和 `presentedRevision=meta.revision`。
4. 用户在最终确认交互中选择“确认并开始搭建”时，设置 `meta.status=confirmed`、`planConfirmed=true`、`confirmedRevision=meta.revision`，同时记录交互 ID 和确认时间。
5. 只有 `meta.status=confirmed`、`planConfirmed=true` 且 `meta.revision=presentedRevision=confirmedRevision` 时，Plan Design 才能返回 `yida-app` Step 3。
6. 用户选择“继续调整”时保持在 Plan Design；用户取消或关闭交互时停止执行，不创建应用资源。
