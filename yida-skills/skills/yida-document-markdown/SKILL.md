---
name: yida-document-markdown
description: 读取钉钉文档或知识库文档的完整 Markdown。用户要求读取、提取或总结文档内容时使用。
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
3. 仅在用户要求保存文件，或下一步命令需要读取文件时使用 `--output`，并明确告知写入路径。
4. 检查命令成功结果，再按用户要求处理 Markdown。

## 异常处理

| 场景 | 处理方式 |
|------|----------|
| 未登录或登录失效 | 运行 `openyida auth status`，必要时执行 `openyida login` |
| 400 | 检查 `docUrl` 是否为空或格式错误 |
| 文档无权限或不存在 | 请用户确认当前钉钉账号权限与链接有效性 |
| 请求超时 | 稍后重试；文档转换最长可能等待 300 秒 |

## 完成标准

命令成功返回非推测的 Markdown 内容，或成功写入用户指定文件。
