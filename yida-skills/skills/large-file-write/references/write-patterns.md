# 大文件写入模式参考

本文档提供三种大文件写入模式的完整代码示例，供 AI Agent 直接参考使用。

## 模式一：创建内容脚本后执行（推荐）

适用于一次性写入大块内容（>100 行）。

### Step 1：用 `create_file` 工具创建临时内容脚本

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

### Step 2：执行脚本

```bash
node /tmp/content-payload.js
```

### Step 3：验证写入结果

```bash
wc -l /path/to/target.js
tail -5 /path/to/target.js
```

---

## 模式二：追加内容到已有文件

适用于向已有文件末尾追加大块内容。

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

执行：

```bash
node /tmp/append-payload.js
```

---

## 模式三：使用通用写入脚本（stdin 模式）

适用于通过管道传入内容的场景。

```bash
node ~/.agents/skills/large-file-write/scripts/write.js \
  --file /path/to/target.js \
  --mode write   # 或 append
```

然后通过 stdin 输入内容（Ctrl+D 结束）。

---

## 分段写入大文件（>300 行）

当单次内容超过 300 行时，拆分为多个脚本分段写入：

```js
// /tmp/part1-payload.js — 写入第一段（文件头 + 前半部分）
const fs = require('fs');
const part1 = `
// === 第一段内容 ===
const CONSTANTS = { ... };
export function functionA() { ... }
`;
fs.writeFileSync('/path/to/target.js', part1, 'utf8');
console.log('第一段写入完成');
```

```js
// /tmp/part2-payload.js — 追加第二段
const fs = require('fs');
const part2 = `
// === 第二段内容 ===
export function functionB() { ... }
export function functionC() { ... }
`;
fs.appendFileSync('/path/to/target.js', part2, 'utf8');
console.log('第二段追加完成');
```

验证最终结果：

```bash
wc -l /path/to/target.js
head -5 /path/to/target.js
tail -5 /path/to/target.js
```

---

## 常见错误与修复

| 错误现象 | 原因 | 修复方式 |
|---------|------|---------|
| 文件为空 | 模板字符串反引号未闭合 | 检查 `` ` `` 是否成对，特殊字符是否转义 |
| 内容截断 | 单次 create_file 超过 token 限制 | 拆分为多个脚本分段写入 |
| 权限拒绝 | 目标路径无写权限 | 改用 `/tmp/` 路径，或检查目录权限 |
| node 命令未找到 | Node.js 未安装 | 先安装 Node.js ≥ 16 |
