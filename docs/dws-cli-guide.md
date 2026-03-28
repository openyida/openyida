# 钉钉 CLI 集成使用指南

## 简介

OpenYida 已集成钉钉官方 CLI 工具（dws），您现在可以通过 `openyida dws` 命令直接使用钉钉工作台的所有功能。

## 安装钉钉 CLI

### 方法一：通过 openyida 安装（推荐）

```bash
openyida dws install
```

### 方法二：手动安装

**macOS / Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/DingTalk-Real-AI/dingtalk-workspace-cli/main/scripts/install.sh | sh
```

**Windows (PowerShell):**
```bash
irm https://raw.githubusercontent.com/DingTalk-Real-AI/dingtalk-workspace-cli/main/scripts/install.ps1 | iex
```

## 快速开始

### 1. 配置钉钉应用凭证

```bash
export DWS_CLIENT_ID="<your-app-key>"
export DWS_CLIENT_SECRET="<your-app-secret>"
```

或在命令中直接指定：
```bash
openyida dws auth login --client-id <your-app-key> --client-secret <your-app-secret>
```

### 2. 登录认证

```bash
openyida dws auth login
```

### 3. 使用钉钉 API

#### 通讯录管理
```bash
# 搜索联系人
openyida dws contact user search --keyword "悟空"

# 列出部门
openyida dws contact department list

# 查询用户详情
openyida dws contact user get --userid <userId>
```

#### 日历管理
```bash
# 列出日历事件
openyida dws calendar event list

# 创建日程
openyita dws calendar event create --title "团队会议" --start-time "2026-03-29T10:00:00Z"

# 查询闲忙状态
openyida dws calendar free-busy query --userids <userId1>,<userId2>
```

#### 待办任务
```bash
# 创建待办
openyida dws todo task create --title "准备季度汇报材料" --executors "<userId>"

# 列出待办
openyida dws todo task list

# 更新待办状态
openyida dws todo task update --taskid <taskId> --status completed
```

#### 审批流程
```bash
# 列出审批实例
openyida dws approval instance list

# 创建审批实例
openyida dws approval instance create --processCode <processCode> --formData <json>

# 获取审批详情
openyida dws approval instance get --instanceId <instanceId>
```

#### 考勤打卡
```bash
# 查询考勤记录
openyida dws attendance record list

# 查询排班信息
openyida dws attendance shift list

# 获取考勤统计
openyida dws attendance statistics list
```

#### 群聊与机器人
```bash
# 发送机器人消息
openyida dws chat robot send --content "大家好！"

# 列出群成员
openyida dws chat member list --chatid <chatId>
```

## 输出格式

所有命令支持多种输出格式：

```bash
# 表格输出（默认，适合人类阅读）
openyida dws contact user search --keyword "悟空" -f table

# JSON 输出（适合 AI Agent）
openyida dws contact user search --keyword "悟空" -f json

# 原始 API 响应
openyida dws contact user search --keyword "悟空" -f raw
```

## 高级用法

### 预览操作（不执行）
```bash
openyida dws todo task list --dry-run
```

### 输出到文件
```bash
openyida dws contact user search --keyword "李明" -o result.json
```

### 查看帮助
```bash
# 查看 dws 总帮助
openyida dws help

# 查看特定服务帮助
openyida dws contact --help

# 查看特定命令帮助
openyida dws contact user search --help
```

## 支持的服务

| 服务 | 命令前缀 | 功能 |
|------|---------|------|
| 通讯录 | `contact` | 用户/部门管理 |
| 群聊 | `chat` | 群管理/机器人消息 |
| 日历 | `calendar` | 日程/会议室/闲忙查询 |
| 待办 | `todo` | 任务管理 |
| 审批 | `approval` | 审批流程 |
| 考勤 | `attendance` | 打卡/排班/统计 |
| DING | `ding` | DING 消息 |
| 日志 | `report` | 日志管理 |
| 工作台 | `workbench` | 应用查询 |
| 开发者文档 | `devdoc` | 文档搜索 |

更多服务请运行 `openyida dws --help` 查看。

## 环境变量

常用的环境变量：

| 变量 | 说明 |
|------|------|
| `DWS_CLIENT_ID` | 钉钉应用 Client ID (AppKey) |
| `DWS_CLIENT_SECRET` | 钉钉应用 Client Secret (AppSecret) |
| `DWS_CONFIG_DIR` | 自定义配置目录 |
| `DWS_TRUSTED_DOMAINS` | Bearer token 允许的域名列表 |

## 注意事项

1. **企业管理员授权**: 本工具涉及钉钉企业数据访问，需企业管理员授权后方可使用
2. **凭证安全**: 不要将凭证提交到版本控制系统，建议使用环境变量
3. **输出格式**: AI Agent 场景建议使用 `-f json` 格式输出
4. **错误处理**: 所有错误均以结构化 JSON 返回，便于程序处理

## 参考资料

- [钉钉 CLI GitHub](https://github.com/DingTalk-Real-AI/dingtalk-workspace-cli)
- [钉钉开放平台](https://open.dingtalk.com/)
- [OpenYida 文档](../README.md)

## 常见问题

### Q: 提示未找到 dws 命令？
A: 运行 `openyida dws install` 安装钉钉 CLI，或手动执行安装脚本。

### Q: 如何获取 Client ID 和 Secret？
A: 在钉钉开放平台创建企业内部应用后，在应用详情页获取。

### Q: 如何切换账号？
A: 运行 `openyida dws auth logout` 退出当前账号，然后重新登录。
