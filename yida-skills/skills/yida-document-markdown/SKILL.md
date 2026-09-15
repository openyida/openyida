---
name: yida-document-markdown
description: 获取钉钉文档、钉钉在线文档或知识库文档的完整 Markdown 内容。用户提供文档链接并要求读取、提取、总结或继续处理文档内容时使用。
---

# 获取钉钉文档 Markdown

## 严格要求 (MUST DO)

- 使用 `openyida read-dingtalk-doc "<docUrl>"` 读取文档内容
- 将用户提供的钉钉文档 URL 原样传给 `docUrl` 参数
- 仅基于命令返回的 Markdown 执行总结、转 PRD 或其他下游任务

## 命令

```bash
openyida read-dingtalk-doc "<docUrl>"
openyida read-dingtalk-doc "<docUrl>" --json
openyida read-dingtalk-doc "<docUrl>" --output ./document.md
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `docUrl` | 是 | 可访问的钉钉文档 HTTP(S) 链接 |
| `--json` | 否 | 输出包含原始链接和 Markdown 的 JSON |
| `--output`, `-o` | 否 | 将 Markdown 写入指定文件；若文件已存在则覆盖 |

## 执行流程

1. 确认用户已提供文档链接。
2. 默认运行 `openyida read-dingtalk-doc "<docUrl>"` 获取纯 Markdown；需要结构化结果时使用 `--json`。
3. 仅在用户要求保存文件或后续任务需要文件输入时使用 `--output`，并明确告知写入路径。
4. 检查命令成功结果，再按用户要求处理 Markdown。

## 异常处理

### 宜搭网页关联的本地 Agent（托管任务）

当 `OPENYIDA_MANAGED_RUN=1` 时，使用任务上下文所选的 `ding_doc/docUrl` 原值执行 `openyida read-dingtalk-doc "<docUrl>" --json`。只允许读取本轮选中的文档；续聊需要重新读取时，应请用户重新添加该文档。不要使用 `--output`，需要派生工作文件时在任务工作目录通过本地工具保存返回内容。

托管读取使用注入的 Task Grant；失败时不得执行 `login`、普通 RefreshToken 或个人登录态兜底。报告权限、链接或任务授权问题，由用户在网页重新选择/提交。下表登录指引仅适用于用户直接在本地使用 OpenYida 的非托管场景。

| 场景 | 处理方式 |
|------|----------|
| 未登录或登录失效 | 运行 `openyida auth status`，必要时执行 `openyida login` |
| 400 | 检查 `docUrl` 是否为空或格式错误 |
| 文档无权限或不存在 | 请用户确认当前钉钉账号权限与链接有效性 |
| 请求超时 | 稍后重试；文档转换最长可能等待 300 秒 |

## 完成标准

命令成功返回非推测的 Markdown 内容，或成功写入用户指定文件。
