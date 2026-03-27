---
name: yida-export-conversation
description: 导出 AI 对话记录，生成结构化的 Markdown 文档。支持 Claude Code 自动检测，其他环境通过 --input 手动指定。
---

# 导出 AI 对话记录

> 将 AI 对话记录导出为结构化的 Markdown 文档，方便分享和存档。

## 命令

```bash
openyida export-conversation [options]
```

| 选项 | 说明 |
|------|------|
| `--output <path>` | 指定输出文件路径（默认 `project/conversation-export.md`） |
| `--input <file>` | 手动指定对话记录文件（覆盖自动检测） |
| `--latest` | 仅导出最近一次对话（默认行为） |
| `--list` | 列出可用的对话记录供选择 |

## 支持的 AI 工具环境

| 环境 | 支持方式 |
|------|---------|
| Claude Code | 自动检测并读取对话记录 |
| 其他环境 | 通过 `--input` 手动指定对话文件 |

## 输出格式

生成的 Markdown 文档包含以下内容：

1. **概要信息**
   - 应用名称
   - AI 工具环境
   - 导出时间
   - 对话轮次
   - 工具调用次数

2. **关键步骤摘要**
   - 从工具调用中自动提取的操作步骤

3. **完整对话记录**
   - 用户消息
   - AI 回复
   - 工具调用及执行结果

## 使用示例

```bash
# 导出最近一次对话（自动检测环境）
openyida export-conversation

# 导出到指定文件
openyida export-conversation --output ./my-conversation.md

# 从指定文件导入对话记录
openyida export-conversation --input ./conversation.jsonl

# 列出可用的对话记录
openyida export-conversation --list
```

## 前置条件

- 无需登录宜搭（对话导出是本地操作）
- Node.js ≥ 18

## 注意事项

1. 目前 MVP 版本主要支持 Claude Code 的对话记录自动检测
2. 其他 AI 工具环境请使用 `--input` 手动指定对话文件
3. 后续版本将支持发布到宜搭社区和钉钉群
