# Step 1：读取整理后的用户需求

只读取 `.cache/openyida/<项目名>/requirement-brief.json`，不重新分析一套与视觉设计不同的需求。

## 检查

1. 文件存在且 JSON 可解析，`schemaVersion=1`。
2. `projectName` 与目标产物目录一致。
3. `businessGoals`、`targetUsers`、`coreFunctions`、`businessObjects` 和 `pageScenes` 足以形成 PRD。
4. `explicitScope` 非空时原样保留，不添加用户未要求的同级资源。
5. `openQuestions` 中存在会改变范围的事项时，暂停生成 PRD 并交回 `yida-app` 处理。

## 产出

形成 PRD 输入摘要：项目与应用类型、角色和任务、业务对象、资源上下文、明确范围、约束和验收方向。该步骤不写 `prd.md`。
