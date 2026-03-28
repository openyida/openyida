---
name: large-file-write
description: Solves the problem of large file content being truncated when using heredoc or shell commands. Use this skill when you need to write large blocks of content (>100 lines) to a file reliably without truncation. Provides a Node.js script that accepts content via stdin or a temp file and writes it atomically.
---

# Large File Write Skill

## 问题背景

在 AI Agent 模式下，使用 heredoc（`<< 'EOF'`）或 shell 命令向文件写入大块内容时，经常出现：
- 内容被截断（工具输出超过 token 限制）
- heredoc 内容未生效（zsh 特殊字符转义问题）
- 多次追加导致重复内容或语法错误

## 解决方案

使用 Node.js 脚本 `scripts/write.js`，将内容作为 JS 字符串变量传入，绕过 shell 截断限制。

## 使用方式

### 方式一：创建内容脚本后执行（推荐）

**Step 1**：用 `create_file` 工具创建一个临时内容脚本：

```js
// /tmp/content-payload.js
const fs = require('fs');
const content = `
// 这里放你要写入的大块内容
// 支持任意长度，不受 heredoc 限制
export function myFunction() {
  // ...
}
`;
fs.writeFileSync('/path/to/target.js', content, 'utf8');
console.log('写入完成，行数：', content.split('\n').length);
```

**Step 2**：执行脚本：

```bash
node /tmp/content-payload.js
```

**Step 3**：验证写入结果：

```bash
wc -l /path/to/target.js
tail -5 /path/to/target.js
```

### 方式二：追加内容到已有文件

```js
// /tmp/append-payload.js
const fs = require('fs');
const appendContent = `
// 追加的内容
export function additionalFunction() {
  // ...
}
`;
fs.appendFileSync('/path/to/target.js', appendContent, 'utf8');
console.log('追加完成');
```

### 方式三：使用通用写入脚本

```bash
node ~/.agents/skills/large-file-write/scripts/write.js \
  --file /path/to/target.js \
  --mode write   # 或 append
```

然后通过 stdin 输入内容（Ctrl+D 结束）。

## 核心原则

1. **永远不要用 heredoc 写大文件** — 改用 `create_file` 工具创建临时 JS 脚本
2. **内容放在 JS 模板字符串里** — 支持任意长度，不受 shell 限制
3. **写完立即验证** — `wc -l` 检查行数，`tail` 检查末尾内容
4. **分段写入大文件** — 超过 300 行的内容，拆分为多个 `create_file` + `node` 执行

## 适用场景

- 宜搭自定义页面代码（通常 500-1500 行）
- Three.js 场景代码
- 任何超过 100 行的代码文件写入
