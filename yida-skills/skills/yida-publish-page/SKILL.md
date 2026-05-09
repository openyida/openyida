---
name: yida-publish-page
description: 将 JSX 源码编译发布到宜搭自定义页面。Babel 转 ES5 + UglifyJS 压缩 + Schema 构建 + saveFormSchema 接口部署。不适用于：发布原生表单页面（无需此命令），或代码尚未编写完成时（必须先完成 yida-custom-page 规范的代码编写）。
---

# 发布自定义页面

## 严格禁止 (NEVER DO)

- 不要在未读取 `yida-custom-page` SKILL.md 的情况下编写 JSX 源码
- 不要把 AI 生成的普通 React 项目代码直接发布；源码应使用 OpenYida 页面源码格式（推荐 `.oyd.jsx`）并通过 `check-page` / `compile` 预检
- 不要在宜搭原生 `export function renderJsx()` 页面里手写 Hooks；如确需 `useState/useEffect`，必须使用 `.oyd.jsx` 的 `export default function Page()` authoring 模式，让 OpenYida 兼容编译器降级
- 不要编造 appType 和 formUuid，必须从已有记录或命令返回中获取

## 严格要求 (MUST DO)

- 发布前确认 JSX 源码已通过 `yida-custom-page` 规范编写
- 发布前优先执行 `openyida check-page <源文件路径>` 和 `openyida compile <源文件路径>`；`.oyd.jsx` 会先自动构建为宜搭兼容源码，再执行 lint/Babel/UglifyJS
- 推荐源码放在 `project/pages/src/<页面名>.oyd.jsx`；编译器会把兼容产物写到 `project/pages/build/<页面名>.yida.jsx`，最终发布产物写到 `project/pages/dist/<页面名>.yida.js`
- 发布前注意 CLI 会检查 `<workspace>/project/pages/src/` 与 `<workspace>/projects/<id>/artifacts/` 中同名源码是否内容不一致；出现警告时必须确认实际要发布哪一份
- 发布前确认 `openyida env` 检测通过，登录态有效
- corpId 不匹配时，必须询问用户是否切换组织，不得强行发布
- **本技能不读写 memory**：发布操作通过 CLI 命令写入宜搭平台，不依赖跨会话的 memory 状态

## 适用场景

编写完自定义页面 JSX 代码后，执行此技能将代码编译发布到宜搭平台。
通常在 `yida-custom-page`（编写代码）之后执行。

## 触发条件

**正向触发**：
- "发布页面"、"上线页面"、"部署页面"
- `yida-custom-page` 代码编写完成后的下一步
- "编译发布"、"把代码发布到宜搭"

**不适用场景（不要触发）**：
- 发布原生表单页面（无需此命令，表单创建即生效）
- 代码尚未编写完成（必须先完成 `yida-custom-page` 规范的代码编写）

---


## 命令

```bash
openyida publish <源文件路径> <appType> <formUuid> [--compat] [--health-check]
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `源文件路径` | 是 | JSX 源码路径，推荐 `project/pages/src/my-page.oyd.jsx` |
| `appType` | 是 | 应用 ID |
| `formUuid` | 是 | 自定义页面 ID |
| `--compat` / `--modern` | 否 | 对普通 `.jsx` 也强制启用 OpenYida 兼容构建；`.oyd.jsx` 默认自动启用 |
| `--health-check` | 否 | 发布成功后请求页面 URL，回显 HTTP 健康检查结果，避免只看到 200 接口返回但首屏坏掉 |

## OpenYida 兼容编译

发布脚本在 `publish` 前会按以下顺序处理源码：

1. `.oyd.jsx` / `.openyida.jsx` 或显式 `--compat`：先运行 OpenYida compatibility compiler。
2. 如果源码已有 `export function renderJsx()`：视为宜搭原生源码，只做机械修复（例如事件绑定、数组回调）。
3. 如果源码是 `export default function Page()`：支持有限 authoring 模式，当前可降级 `useState` 和 `useEffect(..., [])`。
4. 兼容构建会自动补齐 `renderJsx` return 分支中的隐藏 timestamp 节点，并将直接事件绑定 / `.bind(this)` 机械改成箭头函数包裹。
5. 对构建后的 `.yida.jsx` 执行 `check-page` 规则、Babel 转 ES5、UglifyJS 压缩，再构建 Schema 发布。

这一步是脚本级确定性处理，优先让 lint/fix/build 解决语法和运行时兼容问题，不应把简单机械修改交给 AI 反复重写。

## 输出

```json
{"success":true,"formUuid":"FORM-XXX","version":0,"healthCheck":{"ok":true,"statusCode":200}}
```

## 自动注入的 CSS

发布时自动注入以下样式，覆盖宜搭平台默认 padding/margin：

```css
body { background-color: #f2f3f5; }
.vc-page-yida-page { --yida-form-content-padding: 0; --yida-form-content-margin: 0; --yida-layout-padding: 0; }
.vc-deep-container-entry.vc-rootcontent { padding: 0 !important; margin-top: 0 !important; margin-right: 0 !important; margin-bottom: 0 !important; margin-left: 0 !important; }
```

> 使用展开属性而非 `margin: 0` 简写，因为宜搭平台的展开属性 `!important` 优先级更高。
> 如仍有残留样式，可在 `didMount` 中动态注入 `<style>` 标签覆盖。

## 注意事项

- 发布目标地址由 `.cache/cookies.json` 中的 `base_url` 决定
- 碰到组织 corpId 不匹配时，询问用户是否创建新应用发布
- **编写源码前必须先读取 `yida-custom-page` 的 SKILL.md**；原生 `renderJsx` 写法不要使用 Hooks，现代 authoring 写法必须走 `.oyd.jsx` 兼容编译

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| OpenYida 兼容构建失败 | 查看 `check-page --json` 的 `build.errors`，通常是不支持的 Hook、非空 useEffect deps、未支持 import |
| Babel 编译失败 | 检查 JSX 语法；如果是现代 React authoring，确认文件是 `.oyd.jsx` 或发布时加 `--compat` |
| UglifyJS 压缩失败 | 检查是否有 ES6+ 语法未被 Babel 转译，确认 export function 格式正确 |
| saveFormSchema 接口失败（401） | 执行 `openyida login` 重新登录后重试 |
| corpId 不匹配 | 询问用户是否切换组织或创建新应用，不得强行发布 |
| 发布后页面空白 | 检查 `renderJsx` 函数是否正确导出，检查浏览器控制台报错 |
| 发布接口成功但页面坏了 | 重新执行 `openyida publish <源文件路径> <appType> <formUuid> --health-check`，结合浏览器首屏验证 |
| 发布后功能异常 | 检查 `forceUpdate is not a function` 等常见错误，参考 `yida-custom-page` 规范 |

## Agent 错误处理策略

当 Agent 执行本技能遇到错误时，必须遵循以下默认行为：

| 错误类型 | 默认处理策略 |
|---------|-------------|
| 命令执行失败 | 停止执行，向用户展示错误信息，询问是否重试或调整参数 |
| 参数缺失（appType/formUuid 等） | 主动询问用户补充，不得猜测或编造 |
| 权限不足 / 登录态失效 | 停止执行，提示用户执行 `openyida login` 重新登录 |
| Babel 编译失败 | 停止执行，展示错误详情，引导用户检查 JSX 语法 |
| corpId 不匹配 | 停止执行，询问用户是否切换组织或创建新应用 |
| 网络超时 | 重试 1 次，仍失败则停止并提示用户检查网络 |
| 未知错误 | 停止执行，完整展示错误信息，建议用户反馈问题 |

## 与其他技能配合

本技能在完整开发流程中的位置：

```
yida-create-app → yida-create-page → yida-custom-page → [本技能] yida-publish-page
                                           ↑
                                      编写 JSX 代码
```

| 相关技能 | 关系说明 |
|---------|----------|
| `yida-create-page` | 前置技能，创建自定义页面容器，获取 formUuid |
| `yida-custom-page` | 前置技能，编写 JSX 源码，必须先完成代码编写 |
| `yida-create-form-page` | 无关，用于创建表单页面，不需要本技能发布 |
| `yida-page-config` | 后续技能，发布后可配置页面公开访问/分享 |
| `yida-ppt-slider` | 特殊场景，PPT 幻灯片页面也使用本技能发布 |
