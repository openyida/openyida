---
name: yida-exclusive-domain
description: 宜搭专属域名（如 your-company.aliwork.com）环境下的登录、Cookie、应用创建等常见问题诊断与修复指南。当遇到登录死循环、base_url 错误、"全局配置有更新"、Cookie 域名冲突、组件ID重复等问题时使用。
license: MIT
compatibility:
  - opencode
  - claude-code
metadata:
  audience: developers
  workflow: yida-troubleshoot
  version: 1.0.0
  tags:
    - yida
    - troubleshoot
    - exclusive-domain
    - login
    - cookie
---

# 宜搭专属域名环境问题诊断与修复

## 背景

宜搭支持企业专属域名（如 `your-company.aliwork.com`），与标准域名 `www.aliwork.com` 行为存在差异。
在专属域名环境下，`openyida` 的多个模块可能出现问题，本文档记录了所有已知问题及修复方案。

---

## 问题一：登录死循环（waitForURL 永不匹配）

### 症状
- `openyida login` 打开浏览器后，用户扫码成功，但程序一直等待，最终超时退出
- 日志显示一直在等待 URL 跳转，但实际已登录成功

### 根因
`login.js` 中使用 `waitForURL` 检测登录成功，判断条件为：
```javascript
hostname === loginDomain && url.includes('workPlatform')
```
但专属域名账号登录后会跳转到 `your-company.aliwork.com`（而非 `www.aliwork.com`），导致条件永不满足。

### 修复方案
将 URL 检测改为 **Cookie 轮询**，检测 `tianshu_csrf_token` 是否出现：

```javascript
// 替换 waitForURL 逻辑
let loginSuccess = false;
const deadline = Date.now() + 600000; // 10分钟超时
while (Date.now() < deadline) {
  await new Promise(r => setTimeout(r, 2000));
  const cookies = await context.cookies();
  if (cookies.some(c => c.name === 'tianshu_csrf_token' && c.value)) {
    loginSuccess = true;
    break;
  }
}
if (!loginSuccess) throw new Error('登录超时');
```

**原理**：无论跳转到哪个域名，登录成功后 `tianshu_csrf_token` 必然出现在 Cookie 中，与域名无关。

---

## 问题二：base_url 保存错误（域名缺字符）

### 症状
- `.cache/cookies.json` 中 `base_url` 为 `https://ungrow.aliwork.com`（缺少 's'）
- 所有 API 请求失败，提示域名无法解析

### 根因
`login.js` 从 `yida_user_cookie` 的 `domain` 字段提取 base_url，但 Cookie domain 格式为 `.your-company.aliwork.com`（带前导点），
原代码 `domain.replace(/^\./, '')` 在某些情况下未正确处理，导致截取错误。

### 修复方案
使用更健壮的提取逻辑：

```javascript
// 从 yida_user_cookie 的 domain 提取 base_url
const yidaCookie = cookies.find(c => c.name === 'yida_user_cookie');
if (yidaCookie && yidaCookie.domain && yidaCookie.domain.includes('aliwork.com')) {
  baseUrl = 'https://' + yidaCookie.domain.replace(/^\./, '');
}
```

**备用方案**：若 Cookie 提取失败，从当前页面 URL 提取：
```javascript
const currentUrl = page.url();
const parsedUrl = new URL(currentUrl);
baseUrl = parsedUrl.origin; // https://your-company.aliwork.com
```

**手动修复**：直接编辑 `.cache/cookies.json`，将错误的 `base_url` 改为正确值：
```json
{
  "base_url": "https://your-company.aliwork.com",
  "cookies": [...]
}
```

---

## 问题三："检测到组织全局配置有更新" 导致创建应用失败

### 症状
- `openyida create-app` 报错：`检测到组织全局配置有更新，请在浏览器中刷新宜搭页面后重新导出 cookies 再试`
- 即使重新登录也无法解决

### 根因
该组织开启了独占数据库（`forceExclusiveDb: "y"`）和物理列（`forcePhysicalColumn: "y"`）策略，
但 `create-app.js` 硬编码了 `openExclusive: "n"` 和 `openPhysicColumn: "n"`，
导致 `registerApp` 接口返回 HTML 错误页而非 JSON。

### 修复方案
在调用 `registerApp` 前，先查询组织配置：

```javascript
// 在 create-app.js 中，registerApp 调用前添加
let openExclusive = "n";
let openPhysicColumn = "n";
try {
  const corpConfig = await httpPost(
    authRef.baseUrl,
    `/query/exclusive/queryCorpAppConfig.json?_api=Global.queryCorpAppConfig&_mock=false&_csrf_token=${authRef.csrfToken}&_locale_time_zone_offset=28800000&_stamp=${Date.now()}`,
    "",
    authRef.cookies
  );
  if (corpConfig && corpConfig.content) {
    if (corpConfig.content.forceExclusiveDb === "y") openExclusive = "y";
    if (corpConfig.content.forcePhysicalColumn === "y") openPhysicColumn = "y";
  }
} catch (e) {
  // ignore, use defaults
}

// 然后在 registerApp 的 postData 中使用变量
const postData = querystring.stringify({
  // ...
  openExclusive: openExclusive,
  openPhysicColumn: openPhysicColumn,
  // ...
});
```

---

## 问题四：Cookie 域名冲突（JSESSIONID 混淆）

### 症状
- API 请求返回 401 或登录失效
- 同时存在 `www.aliwork.com` 和 `your-company.aliwork.com` 的 Cookie
- 两个域名各有一个 `JSESSIONID`，发送时互相覆盖

### 根因
`utils.js` 的 `httpPost` 和 `httpGet` 将所有 Cookie 拼接发送，未按域名过滤，
导致 `www.aliwork.com` 的 `JSESSIONID` 被发送到 `your-company.aliwork.com`，服务端拒绝。

### 修复方案
在 `httpPost` 和 `httpGet` 中添加域名过滤：

```javascript
// 在构建 cookieHeader 前添加过滤
const parsedUrl = new URL(baseUrl);
const requestHost = parsedUrl.hostname;
const filteredCookies = cookies.filter(c => {
  const cd = (c.domain || "").replace(/^\./, "");
  return requestHost === cd || requestHost.endsWith("." + cd);
});
const cookieHeader = filteredCookies.map((c) => `${c.name}=${c.value}`).join("; ");
```

---

## 问题五：create-form.js 缺少 isLoginExpired 等函数导入

### 症状
- `openyida create-form` 报错：`isLoginExpired is not defined`
- 或 `isConfigUpdateRequired is not defined`

### 根因
`create-form.js` 的 `require('./utils')` 未包含所有需要的函数。

### 修复方案
确保 `create-form.js` 顶部的 require 包含所有必要函数：

```javascript
const {
  findProjectRoot,
  loadCookieData,
  triggerLogin,
  refreshCsrfToken,
  resolveBaseUrl,
  isLoginExpired,
  isCsrfTokenExpired,
  isConfigUpdateRequired,  // 必须包含
} = require("./utils");
```

同时确保 `utils.js` 的 `module.exports` 导出了 `isConfigUpdateRequired`：

```javascript
module.exports = {
  // ...
  isConfigUpdateRequired,  // 确保已导出
  // ...
};
```

---

## 问题六：组件 ID 重复（FormContainer fieldId 冲突）

### 症状
- `openyida create-form` 报错：`组件ID不允许重复`
- 表单创建失败

### 根因
`create-form.js` 中两个嵌套的 `FormContainer` 都使用 `Date.now().toString(36)` 生成 fieldId，
在同一毫秒内执行时生成相同的 ID。

### 修复方案

**方案 A**：添加后缀区分：
```javascript
// 外层 FormContainer
fieldId: "formContainer_" + Date.now().toString(36) + "a",
// 内层 FormContainer
fieldId: "formContainer_" + Date.now().toString(36) + "b",
```

**方案 B**：使用带计数器的 ID 生成函数：
```javascript
let fieldIdCounter = 1;
function generateFieldId(componentName) {
  const prefix = componentName.charAt(0).toLowerCase() + componentName.slice(1);
  const timePart = Date.now().toString(36).slice(-4);
  const counterPart = (fieldIdCounter++).toString(36).padStart(2, '0');
  const randomPart = Math.random().toString(36).substring(2, 4);
  return prefix + "_" + timePart + counterPart + randomPart;
}
```

---

## 问题七：__needConfigRefresh 无限循环

### 症状
- 某些 API 请求返回 `__needConfigRefresh: true`
- 程序陷入无限重试

### 修复方案
在 `requestWithAutoLogin` 中对 `__needConfigRefresh` 只重试一次：

```javascript
if (result && result.__needConfigRefresh) {
  console.error("全局配置有更新，正在自动重试...");
  result = await requestFn(authRef);
  if (result && result.__needConfigRefresh) {
    // 重试后仍失败，返回错误而非继续循环
    return { success: false, errorMsg: "全局配置有更新，请刷新页面后重试" };
  }
}
```

---

## 快速诊断流程

```
遇到宜搭操作失败
       ↓
1. 检查 .cache/cookies.json 中 base_url 是否正确
   → 错误域名（如 ungrow.aliwork.com）→ 手动修正或重新登录
       ↓
2. 检查是否登录死循环
   → 扫码后程序不退出 → 检查 login.js 是否使用 Cookie 轮询
       ↓
3. 检查 create-app 是否报"全局配置有更新"
   → 检查 create-app.js 是否查询了 queryCorpAppConfig
       ↓
4. 检查 API 请求是否返回 401/登录失效
   → 检查 utils.js 是否有 Cookie 域名过滤
       ↓
5. 检查 create-form 是否报"组件ID不允许重复"
   → 检查 FormContainer fieldId 是否有唯一性保证
```

---

## 受影响的文件

| 文件 | 问题 | 修复 |
|------|------|------|
| `lib/login.js` | 登录死循环、base_url 错误 | Cookie 轮询 + yida_user_cookie 域名提取 |
| `lib/utils.js` | Cookie 域名冲突、isConfigUpdateRequired 未导出 | 域名过滤 + 导出函数 + __needConfigRefresh 单次重试 |
| `lib/create-app.js` | "全局配置有更新" | 查询 queryCorpAppConfig 获取 org 参数 |
| `lib/create-form.js` | 缺少导入、Cookie 冲突、组件ID重复 | 完整导入 + 域名过滤 + 唯一 ID 生成 |
