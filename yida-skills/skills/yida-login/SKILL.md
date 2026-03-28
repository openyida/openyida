---
name: yida-login
description: 宜搭登录态管理。支持标准环境扫码登录和悟空环境 CDP 提取 Cookie，Cookie 持久化到 .cache/cookies.json。
---

# 宜搭登录态管理

> 通常无需手动调用，其他命令在 Cookie 失效时会自动触发登录。

## 命令

### 标准环境

```bash
openyida login
```

### 悟空环境

> ⚠️ 悟空环境必须按以下步骤操作，不能直接运行脚本。

1. 读取 `config.json` 获取 `loginUrl`
2. 用悟空内置浏览器打开登录页面，等待用户完成扫码
3. 扫码完成后执行：

```bash
openyida login --wukong
```

## 输出

```json
{"csrf_token":"b2a5d192-xxx","corp_id":"dingxxx","user_id":"1955225xxx","base_url":"https://abcd.aliwork.com"}
```

> `base_url` 取自登录后浏览器实际跳转到的域名，可能与 `config.json` 中的 `loginUrl` 不同。后续所有 API 请求使用此值。

## 错误处理

各命令通过响应体 `errorCode` 自动处理登录态异常：

| errorCode | 含义 | 标准环境 | 悟空环境 |
|-----------|------|---------|----------|
| `TIANSHU_000030` | CSRF Token 过期 | 自动无头刷新 | `openyida login --wukong` |
| `307` | Cookie 失效 | 自动重新登录 | `openyida login --wukong` |
