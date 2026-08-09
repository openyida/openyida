---
name: yida-flash-note-to-prd
description: 把已有钉钉闪记、会议记录或需求文档整理为 prd/<项目名>/prd.md 会议需求稿。
---

# 闪记转会议需求稿

## 何时使用

- 用户提供闪记文本、会议记录、会议纪要、截图或需求文档，并要求整理需求。
- 用户只提供 `taskUuid` → 先加载 `yida-tingji` 读取听记内容。
- 用户只要求读取听记，不生成需求稿 → 使用 `yida-tingji`。

## 输入

- 文本或文件 → 直接读取完整内容。
- 图片 → 识别标题、正文、表格、列表和重点标记。
- 钉钉闪记链接 → 使用可用的登录态读取；无法读取时请用户提供正文。
- `taskUuid` → 先由 `yida-tingji` 返回完整听记内容。

## 执行步骤

1. 识别输入类型并取得完整内容。
2. 提取会议标题、时间、参会人、决策、待办和分歧。
3. 删除时间戳、重复语句和无意义口语，保留业务事实。
4. 按 [会议需求稿模板](references/flash-note-prd-template.md) 生成内容。
5. 未确认的信息写入“待确认事项”，不自行补全。
6. 写入 `prd/<项目名>/prd.md`。
7. 输出项目名、功能数量和待确认事项数量，请用户确认。

可选 CLI：

```bash
openyida flash-to-prd --file <path> --name "<项目名>"
```

## 与完整应用的关系

本技能只生成会议需求稿。继续搭建完整应用时，`yida-requirement-analysis` 读取会议需求稿并生成共享需求简报，`yida-prd` 和 `yida-design` 再分别生成正式 PRD 和视觉设计文件。

## 完成条件

- `prd/<项目名>/prd.md` 已写入。
- 需求稿包含来源事实和待确认事项。
- 最终回复说明文件路径和待确认事项数量。

## 参考文件

| 文件 | 何时读取 |
|------|----------|
| [会议需求稿模板](references/flash-note-prd-template.md) | 生成需求稿时 |
| [内容提取提示](references/flash-note-prompt.md) | 长会议或信息混乱时 |
| [示例](references/examples.md) | 需要核对输入输出格式时 |
| [字段类型](references/yida-field-types.md) | 需求稿涉及宜搭字段类型时 |
