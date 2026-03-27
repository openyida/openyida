---
name: yida-logout
description: 退出宜搭登录，清空本地 Cookie 缓存。
---

# 退出登录

## 命令

```bash
openyida logout
```

清空 `.cache/cookies.json` 文件内容，下次调用任意命令时自动触发重新扫码登录。

**适用场景**：切换账号、切换组织、Cookie 失效无法自动刷新。
