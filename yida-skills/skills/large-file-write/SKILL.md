---
name: large-file-write
description: 解决 heredoc 或 shell 命令写入大文件内容被截断的问题。当需要可靠地写入超过 100 行的大块内容时使用，通过 Node.js 脚本将内容作为模板字符串写入，绕过 shell 截断限制。不适用于：文件内容少于 100 行（直接使用 create_file 工具），或二进制文件写入。
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

三种写入模式的完整代码示例，详见 [references/write-patterns.md](./references/write-patterns.md)：

- **模式一**：创建内容脚本后执行（推荐）— 用 `create_file` 创建临时 JS 脚本，再 `node` 执行
- **模式二**：追加内容到已有文件 — 用 `fs.appendFileSync` 追加大块内容
- **模式三**：使用通用写入脚本（stdin 模式）— 通过管道传入内容

### 快速示例

```js
// /tmp/content-payload.js
const fs = require('fs');
const content = `// 你的大块内容（支持任意长度）
export function myFunction() { ... }
`;
fs.writeFileSync('/path/to/target.js', content, 'utf8');
console.log('写入完成，行数：', content.split('\n').length);
```

```bash
node /tmp/content-payload.js
wc -l /path/to/target.js   # 验证行数
```

## 核心原则

1. **永远不要用 heredoc 写大文件** — 改用 `create_file` 工具创建临时 JS 脚本
2. **内容放在 JS 模板字符串里** — 支持任意长度，不受 shell 限制
3. **写完立即验证** — `wc -l` 检查行数，`tail` 检查末尾内容
4. **分段写入大文件** — 超过 300 行的内容，拆分为多个 `create_file` + `node` 执行
5. **本技能不读写 memory**：文件写入为纯本地操作，不依赖跨会话的 memory 状态

## 适用场景

- 宜搭自定义页面代码（通常 500-1500 行）
- Three.js 场景代码
- 任何超过 100 行的代码文件写入

## 触发条件

**正向触发**：
- 需要写入超过 100 行的代码文件
- 使用 heredoc 或 shell 命令写文件时出现内容截断
- 写入宜搭自定义页面代码（通常 500-1500 行）

**不适用场景（不要触发）**：
- 文件内容少于 100 行 → 直接使用 `create_file` 工具
- 二进制文件写入 → 不适用
- 仅追加少量内容 → 直接使用 `create_file`

## 异常处理

| 问题 | 原因 | 处理方式 |
|------|------|----------|
| `node: command not found` | Node.js 未安装 | 先安装 Node.js ≥ 16 |
| 脚本执行后文件为空 | 模板字符串语法错误 | 检查反引号是否闭合，特殊字符是否转义 |
| 写入不完整 | 内容超过单次 create_file 限制 | 按「分段写入」方式拆分为多个脚本 |
| 权限拒绝 | 目标路径无写权限 | 检查目录权限，或改用 `/tmp/` 路径 |
