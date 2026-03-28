# 钉钉 CLI 快速开始指南

## 5 分钟快速上手

### 步骤 1: 安装钉钉 CLI

```bash
openyida dws install
```

或手动安装：
```bash
curl -fsSL https://raw.githubusercontent.com/DingTalk-Real-AI/dingtalk-workspace-cli/main/scripts/install.sh | sh
```

### 步骤 2: 创建钉钉应用

1. 访问 [钉钉开放平台](https://dev.dingtalk.com/)
2. 进入「企业内部应用」→「创建应用」
3. 填写应用基本信息
4. 在「安全设置」中添加重定向 URL：`http://127.0.0.1`
5. 发布应用版本

### 步骤 3: 获取凭证

在应用详情页获取：
- **Client ID** (AppKey)
- **Client Secret** (AppSecret)

### 步骤 4: 配置凭证

**方式一：环境变量（推荐）**
```bash
export DWS_CLIENT_ID="your-client-id"
export DWS_CLIENT_SECRET="your-client-secret"
```

**方式二：命令参数**
```bash
openyida dws auth login --client-id your-client-id --client-secret your-client-secret
```

### 步骤 5: 登录

```bash
openyida dws auth login
```

按照提示完成 OAuth 设备流认证。

## 常用场景示例

### 场景 1: 搜索联系人

```bash
# 基础搜索
openyida dws contact user search --keyword "张三"

# JSON 输出（适合 AI Agent）
openyida dws contact user search --keyword "张三" -f json

# 保存到文件
openyida dws contact user search --keyword "张三" -o contacts.json
```

### 场景 2: 创建待办事项

```bash
# 创建个人待办
openyida dws todo task create --title "准备周报" --executors "your-userid"

# 创建团队待办
openyida dws todo task create --title "项目评审" --executors "userid1,userid2,userid3"

# 列出所有待办
openyida dws todo task list
```

### 场景 3: 查询考勤记录

```bash
# 查询今日打卡记录
openyida dws attendance record list

# 查询指定用户的考勤
openyida dws attendance record list --userids "your-userid"
```

### 场景 4: 管理日历日程

```bash
# 列出今天的日程
openyida dws calendar event list

# 创建会议
openyida dws calendar event create \
  --title "周会" \
  --start-time "2026-03-29T10:00:00+08:00" \
  --end-time "2026-03-29T11:00:00+08:00" \
  --participants "userid1,userid2"

# 查询闲忙状态
openyida dws calendar free-busy query \
  --userids "userid1,userid2" \
  --start-time "2026-03-29T09:00:00+08:00" \
  --end-time "2026-03-29T18:00:00+08:00"
```

### 场景 5: 发送机器人消息

```bash
# 发送文本消息
openyida dws chat robot send --content "大家好，记得提交周报！"

# 发送 Markdown 消息
openyida dws chat robot send --content "## 会议通知\n时间：今天下午 3 点\n地点：会议室 A"
```

### 场景 6: 审批流程管理

```bash
# 列出所有审批实例
openyida dws approval instance list

# 创建请假审批
openyida dws approval instance create \
  --processCode "leave" \
  --formData '{"duration": "3", "reason": "事假"}'

# 查看审批详情
openyida dws approval instance get --instanceId "INSTANCE-123"
```

## AI Agent 集成示例

### 使用 Cursor/Claude Code 自动调用

```javascript
// 在你的代码中直接使用
const { execSync } = require('child_process');

// 搜索联系人
const result = execSync('openyida dws contact user search --keyword "悟空" -f json', {
  encoding: 'utf8'
});
const users = JSON.parse(result);
console.log(users);

// 创建待办
execSync('openyida dws todo task create --title "代码审查" --executors "userId123"', {
  stdio: 'inherit'
});
```

### MCP Server 集成

钉钉 CLI 原生支持 MCP 协议，可以作为 MCP Server 使用：

```json
{
  "mcpServers": {
    "dws": {
      "command": "dws",
      "args": ["mcp"]
    }
  }
}
```

## 调试技巧

### 1. 预览操作（不执行）

```bash
openyida dws todo task list --dry-run
```

### 2. 查看详细日志

```bash
openyida dws contact user search --keyword "张三" --debug
```

### 3. 检查版本

```bash
openyida dws version
```

### 4. 查看配置

```bash
openyida dws config list
```

## 常见问题排查

### Q1: 提示「未找到命令」
```bash
# 检查 dws 是否安装
which dws

# 如果未安装，执行
openyida dws install
```

### Q2: 提示「认证失败」
```bash
# 检查是否已登录
openyida dws auth status

# 重新登录
openyida dws auth login
```

### Q3: 提示「权限不足」
确保：
1. 钉钉应用已发布上线
2. 企业管理员已授权
3. 凭证配置正确

### Q4: JSON 解析失败
始终使用 `-f json` 参数获取结构化输出：
```bash
openyida dws contact user search --keyword "张三" -f json
```

## 下一步

- 查看完整命令列表：`openyida dws help`
- 查看特定服务帮助：`openyida dws contact --help`
- 查看详细文档：`docs/dws-cli-guide.md`
- 访问官方文档：https://github.com/DingTalk-Real-AI/dingtalk-workspace-cli

## 实用小技巧

### 技巧 1: 使用别名简化命令

```bash
# 在 ~/.zshrc 或 ~/.bashrc 中添加
alias dws='openyida dws'

# 然后可以直接使用
dws contact user search --keyword "张三"
```

### 技巧 2: 管道组合命令

```bash
# 搜索联系人并提取 userId
openyida dws contact user search --keyword "张三" -f json | jq '.[0].userId'
```

### 技巧 3: 批量操作

```bash
# 批量创建待办（从文件读取）
cat tasks.json | while read task; do
  openyida dws todo task create --title "$task" --executors "userId"
done
```

### 技巧 4: 定时任务

```bash
# 每天上午 9 点提醒提交日报（crontab）
0 9 * * * openyida dws chat robot send --content "记得提交日报！" >> /tmp/daily-reminder.log
```
