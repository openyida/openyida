---
name: openyida-cross-platform-release-guard
description: OpenYida 跨端发布风险守卫。当改动涉及浏览器/URL 拉起（openyida login、bridge 页面唤起、resolveBrowserLauncher、openBrowser、spawn 打开浏览器）、或在 macOS 上开发但需要发布给 Windows/Linux 用户、或准备打 tag 发布新版本时使用。用于在发布前静态扫描并拦截「cmd /c start 截断 URL」「open -n 假装开新窗口」等只在非 macOS 端暴露的历史坑，并输出跨端人工验证清单。
---

# OpenYida 跨端发布风险守卫

macOS 本地测试跑通 ≠ 发布安全。浏览器/URL 拉起这类代码在 macOS 上正常，却可能在
Windows/Linux 用户侧直接炸掉——因为每个平台的浏览器拉起命令、URL 转义规则、默认浏览器
标识（bundle id / ProgId / .desktop）完全不同，而 CI 只跑纯函数单测，覆盖不到真实系统拉起。

## 触发条件

- 改动 `lib/auth/oauth-loopback.js`、`lib/bridge/bridge.js`，或任何 `resolveBrowserLauncher` /
  `openBrowser` / `spawn(...浏览器...)` 相关逻辑。
- 在 macOS 开发、发布对象包含 Windows / Linux 用户。
- 准备打 tag、bump 版本、发布新的 openyida。

## 第一步：跑发布风险静态扫描（必做）

```bash
npm run check:release-risks
```

- **HARD 反模式 → exit 1，阻断发布**（已纳入 `check:ci` 第 10 步）：
  - `cmd-c-start-url` / `cmd-c-start-argv`：`cmd /c start <url>` 会把 URL 里的 `&` 当命令
    分隔符截断，丢失 `client_id`/`state`（登录）或 `oy_bridge_url`/`oy_bridge_token`（bridge）。
    → 改用 `rundll32 url.dll,FileProtocolHandler`，并复用 `resolveBrowserLauncher`。
  - `open-n-url-new-tab`：`open -n <url>` 在 macOS 不会开新窗口，只在默认浏览器开新标签页
    （假装开窗口）。→ 要真开新窗口须指定浏览器 App 并传其 `--new-window`/`-new-window`；
    检测不到默认浏览器时回退纯 `open <url>`。
- **SOFT 提示 → 不阻断**：列出涉及浏览器/URL 拉起的文件，提醒补人工跨端验证。

扫描逻辑见 `scripts/check-release-risks.js`（纯静态扫描 `lib/`，会跳过注释，并正确识别字符串中的
`//` / `/*` 不是注释；命令字符串仍会保留扫描，确保能抓到 `spawn('cmd', ...)` 这类真实反模式）；
契约由 `tests/check-release-risks.test.js` 锁定。

## 第二步：跨端人工验证清单

CI 通过只代表纯逻辑没问题，浏览器真实拉起必须在目标 OS 各自实测：

| 平台 | 拉起方式 | 默认浏览器标识 | 必测 |
|------|---------|---------------|------|
| macOS | `open`（新标签页）/ `open -b <bundle> -n --args --new-window`（新窗口） | LaunchServices bundle id（`com.google.chrome`） | `openyida login` 弹出浏览器且回调页自动关闭；bridge 页面能唤起 |
| Windows | `rundll32 url.dll,FileProtocolHandler`（默认）/ 浏览器 exe `--new-window` | 注册表 ProgId（`ChromeHTML`/`MSEdgeHTM`/`FirefoxURL`） | 登录 URL 的 `client_id`/`state` **不被 `&` 截断**；bridge 参数不丢 |
| Linux | `xdg-open`（默认）/ 浏览器 exe `--new-window` | `.desktop` 文件名（`google-chrome.desktop`） | `openyida login` 能拉起浏览器 |

要点：
- 三端「默认浏览器标识」互不通用，各自独立分类；**未知/不支持的默认浏览器一律回退**到
  系统默认浏览器新标签页 + 回调页自动关闭，**绝不假装开新窗口**。
- URL 必须作为**单个 argv 元素**传递，任何经过 shell（`cmd /c`、`sh -c`）的路径都要确认
  `&` 不被解释。

## 第三步：发布收尾

1. 确认 `package.json` version 与 CHANGELOG 顶部版本一致（日期格式 `vYYYY.MM.DD`，同日多次
   发布用 `-1`/`-2` 后缀）。
2. `npm run check:ci` 全绿（含发布风险扫描）。
3. CHANGELOG 记录本次改动，浏览器/登录/bridge 类改动务必写明**受影响平台**。

## 反哺

发现新的「只在某平台暴露」的拉起坑时，在 `scripts/check-release-risks.js` 的 `HARD_RULES`
增加一条规则 + 在 `tests/check-release-risks.test.js` 补对应用例，让守卫随坑增长。
