---
name: yida-tingji
description: 按 taskUuid 获取钉钉听记、会议录音转写、会议纪要或 AI 听记的完整详情；只负责读取内容。若用户要求转 PRD，先用本技能取内容，再交给 yida-flash-note-to-prd。
---

# 获取钉钉听记详情

## 严格要求 (MUST DO)

- 使用 `openyida read-dingtalk-tingji "<taskUuid>"` 读取听记详情
- 将用户提供的 `taskUuid` 原样传入，不自行转换或校验其格式
- 读取成功后，根据用户要求提取会议摘要、关键决策或行动项；若要生成 PRD，切换到 `yida-flash-note-to-prd` 处理已有内容
- 默认不要在回复中展示带签名参数的资源 URL；用户明确要求原始结果时再输出完整 JSON

## 命令

```bash
openyida read-dingtalk-tingji "<taskUuid>"
openyida read-dingtalk-tingji "<taskUuid>" --json
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `taskUuid` | 是 | 钉钉听记任务 ID，按原值传入 |
| `--json` | 否 | 显式声明 JSON 输出；当前命令默认即为 JSON |

## 执行流程

1. 从用户输入或听记链接上下文中取得准确的 `taskUuid`；无法确定时请用户补充。
2. 运行 `openyida read-dingtalk-tingji "<taskUuid>" --json`。
3. 检查成功结果，再按用户要求提取会议摘要、发言内容、决策或待办。
4. 如果用户要求转 PRD，将听记正文作为输入加载 `yida-flash-note-to-prd`；本技能不直接生成 PRD。

## 异常处理

| 场景 | 处理方式 |
|------|----------|
| 未登录或登录失效 | 运行 `openyida auth status`，必要时执行 `openyida login` |
| 400 | 检查 `taskUuid` 是否为空 |
| 听记无权限或不存在 | 请用户确认当前钉钉账号权限和 `taskUuid` |
| 请求超时 | 稍后重试；接口最长可能等待 300 秒 |

## 完成标准

命令成功返回指定 `taskUuid` 对应的真实听记详情；转 PRD 场景已把内容交给 `yida-flash-note-to-prd`。
