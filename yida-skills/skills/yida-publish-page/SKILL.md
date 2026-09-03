---
name: yida-publish-page
description: 自定义页面编译发布技能；发布 YidaCodeCanvas 页面时会写入 runtimeCode/importedModules，并自动注入 yida/utils window 桥。
---

# 发布自定义页面

> 资源边界：本技能只处理普通 OpenYida 页面发布；目标不明时先只读确认或询问用户。

## 执行边界

本技能负责三件事：确认发布目标、执行 `openyida publish`（包含必要编译和 Schema 写入）、给出 final 证据。新建或默认自定义页面源码先由 `yida-canvas-custom-page` 产出。缺少自定义页面容器时，先交给 `yida-create-page` 创建后再回来发布。

## 发布目标确认

发布前必须先解析目标页面 context；本技能优先服务已有页面：

- 用户说“优化这个页面 URL / 修改这个页面 / 重新发布 / 覆盖现有页面”并提供页面 URL、`formUuid`、bound page 或 workspace 中可确认的 display page 时，直接把该页面作为发布目标。
- bound page 是默认发布候选，不是强制目标；如果当前会话绑定页面 A，而用户本轮明确指定页面 B，必须先解析 B。B 有唯一 URL / display `formUuid` 时发布到 B；B 只有名称或描述且无法唯一匹配时先问用户。
- 只有无法解析目标页面，且用户明确要新增页面容器时，才回到 `yida-create-page`。
- 发布目标必须是 `formType=display` 的自定义页面；普通表单、流程表单、数据底表的 `formUuid` 不能作为 `openyida publish` 第三个参数。
- 多个页面候选按根技能来源优先级选择；同级冲突或无法判断页面类型时才问用户或执行只读 `list-forms` 确认。

## 严格禁止 (NEVER DO)

- 不要在未加载对应页面开发技能的情况下临时编写页面源码；使用 `YidaCodeCanvas` 组件实现的页面先看 `yida-canvas-custom-page`。
- 不要把普通 React / Next / Vite 项目源码直接发布；可发布源码必须是 OpenYida 页面源码，并放在 `project/pages/src/*.{canvas.jsx,canvas.tsx,oyd.jsx,jsx,tsx}`
- 不要混用预检命令：`.canvas.jsx` / `.canvas.tsx` 不走 `openyida check-page` / `openyida compile`；`.oyd.jsx` / `.jsx` / `.tsx` 不要当成 `YidaCodeCanvas` 页面发布，除非已明确确认源码就是 `YidaCodeCanvas` 组件源码并使用 `--canvas`
- 不要在平台 `renderJsx` / `didMount` 形态里手写 React Hooks；需要 Hooks 的页面应交回对应页面开发技能改成可编译的源码形态
- 不要编造 appType 和 formUuid，必须从已有记录或命令返回中获取
- 不要把普通表单、流程表单或数据底表的 `formUuid` 当作发布目标；除非已确认目标是自定义展示页面，否则不要用 `--force` 绕过保护

## 严格要求 (MUST DO)

- 发布前确认页面源码已通过对应页面开发技能编写：`.canvas.jsx` / `.canvas.tsx` 发布为 `YidaCodeCanvas` 组件；`.oyd.jsx` / `.jsx` / `.tsx` 发布为平台 `Jsx` 组件
- 平台 `Jsx` 组件 / `oyb.jsx` / `renderJsx` 维护源码发布前优先执行 `openyida check-page <源文件路径>` 和 `openyida compile <源文件路径>`；本技能只把它们作为发布前 guard
- 使用 `YidaCodeCanvas` 组件实现的页面不单独运行普通 JSX 编译命令；执行 `openyida publish <源文件> <appType> <displayPageFormUuid> --canvas --health-check`，由发布流程校验并写入 `runtimeCode + importedModules`
- 使用 `YidaCodeCanvas` 组件实现的页面发布时，发布流程会在外层页面 `didMount` 注入 `window.__OPENYIDA_YIDA_API__` 和 `window.__OPENYIDA_UTILS__`；不要在 Canvas 源码内补写 `this.utils.yida.*` 或根级 `this.utils.*`
- 推荐源码放在 `project/pages/src/`：使用 `YidaCodeCanvas` 组件实现的页面用 `<页面名>.canvas.jsx` / `<页面名>.canvas.tsx`；平台 `Jsx` 组件维护源码用 `<页面名>.oyd.jsx` / `<页面名>.jsx` / `<页面名>.tsx`
- 发布前注意 CLI 会检查 `<workspace>/project/pages/src/` 与 `<workspace>/projects/<id>/artifacts/` 中同名源码是否内容不一致；出现警告时必须确认实际要发布哪一份
- 发布前确认 `openyida env` 检测通过，登录态有效
- corpId 不匹配时，必须询问用户是否切换组织，不得强行发布
- 重新发布已有自定义页面时，`openyida publish` 会自动读取目标页面现有 Schema 并合并页面级 `dataSource`；不要靠 Agent 口头承诺“保留数据源”，必须使用新版 CLI 的默认保护能力
- 如果源码包含 `this.dataSourceMap.`，而发布输出包含 `No custom page data sources to preserve`，本次发布不能视为完成；说明源码依赖设计器数据源但目标页没有可保留数据源。必须回到对应页面开发技能修复源码并重新发布，或先通过 `yida-data-source-connectors` 创建并绑定数据源后重新发布
- **发布证据闭环**：本轮只要 Write/Edit/Create 了 `project/pages/src/*.{canvas.jsx,canvas.tsx,oyd.jsx,jsx,tsx}`，final 证据只认真实执行成功的 `openyida publish <source> <appType> <displayPageFormUuid>` 命令结果；本地文件编辑、diff、`check-page`、`compile`、`compileCanvasLocal` 或口头声明都不能证明远端页面已更新
- **本技能不读写 memory**：发布操作通过 CLI 命令写入宜搭平台，不依赖跨会话的 memory 状态

## 适用场景

编写完自定义页面源码后，执行此技能将源码发布到宜搭平台。已有页面 URL / `formUuid` / bound page 时，默认发布到该已有页面。

## 触发条件

**正向触发**：
- "发布页面"、"上线页面"、"部署页面"
- "优化这个页面 URL"、"修改现有页面后重新发布"
- 页面源码编写完成后的下一步
- "编译发布"、"把代码发布到宜搭"

> ⚠️ 代码必须先完成对应页面技能规范的编写，再执行发布。原生表单页面无需此命令，创建即生效。

---


## 命令

```bash
openyida publish <源文件路径> <appType> <formUuid> [--compat] [--canvas] [--health-check] [--auto-nav-order] [--force]
```

路径口径：从仓库根执行时，源文件用 `project/pages/src/...`；如果 Bash cwd 已经是 `<workspace>/project`，源文件用 `pages/src/...`，不要传 `project/pages/src/...` 导致查找 `project/project/pages/src/...`。发布失败提示源文件不存在时，先按该规则切换路径，不要自动发布另一份文件。

> `openyida publish` 会按源码扩展名选择发布模式：`.canvas.jsx` / `.canvas.tsx` 写入 `YidaCodeCanvas`，并注入 yida/utils window 桥；`.oyd.jsx` / `.jsx` / `.tsx` 写入平台 `Jsx` 组件。
> 发布前确认源码已由对应页面开发技能完成并通过相应本地检查；本技能只把真实成功的 `openyida publish` 作为远端完成证据。

| 参数 | 必填 | 说明 |
|------|------|------|
| `源文件路径` | 是 | 页面源码路径；`.canvas.jsx` / `.canvas.tsx` 写入 `YidaCodeCanvas` 组件，`.oyd.jsx` / `.jsx` / `.tsx` 写入平台 `Jsx` 组件 |
| `appType` | 是 | 应用 ID |
| `formUuid` | 是 | 自定义页面 ID，必须是 `openyida list-forms <appType>` 返回的 `formType=display` 目标，不要使用数据底表或流程表单 ID |
| `--compat` / `--modern` | 否 | 兼容构建开关；仅在确认源文件属于平台 JSX 组件页面且扩展名不规范时使用；`.oyd.jsx` 默认自动启用 |
| `--canvas` | 否 | 显式写入 `YidaCodeCanvas` Schema；`.canvas.jsx` / `.canvas.tsx` 扩展名已自动启用，仅当扩展名不规范但确认为 `YidaCodeCanvas` 组件源码时需要 |
| `--health-check` | 否 | 发布成功后用 token 读回目标页面 Schema，校验 `YidaCodeCanvas.runtimeCode` 或平台 `Jsx + actions.module.compiled` 与本次发布内容匹配；不请求页面 HTML，不依赖 Cookie |
| `--auto-nav-order` | 否 | 发布成功后立刻执行轻量导航排序；PRD 已写明导航顺序时优先用 `openyida nav-group order <appType> <页面/表单...>`，PRD 缺少明确页面清单时才用本参数兜底；排序失败只警告，不回滚已发布页面 |
| `--force` | 否 | 显式绕过发布目标类型保护；只有确认目标是自定义页面但导航接口暂时无法识别时才使用 |

## 确认命令

发布前先确认目标页面，避免把 JSX 覆盖到数据底表：

```bash
openyida list-forms <appType> --keyword <页面名>
```

只选择 `formType=display` 的 `formUuid` 作为发布目标。源码里用于 `this.utils.yida` 读写数据的普通表单常量（如 `FORM_SKILL`、`FORM_DATA`、`FORM_TABLE`）通常是数据底表，不能作为 `openyida publish` 的第三个参数。

## Final 证据契约

- final 中“Canvas 页面已更新 / 已重新发布 / 已上线”的依据是成功的 `openyida publish <source> <appType> <displayPageFormUuid> --canvas --health-check`，且结果包含 `publishMode=canvas`、`healthCheck.ok=true`、`healthCheck.readback.hasYidaCodeCanvas=true` 和 `runtimeCodeBytes>0`。
- `<source>` 必须是本轮实际 Write/Edit/Create 过的页面源码；`<displayPageFormUuid>` 必须是已解析的 display 自定义页面。发布了其他文件或其他目标页面，不满足本轮源码修改的 doneWhen。
- 若 publish 没执行、执行失败、目标不明、登录态/组织不一致或用户要求先暂停，final 只能说“源码已修改，尚未发布”，并给出下一步需要执行的 publish 命令或阻塞原因。
- 平台 JSX 组件页面的 `check-page` / `compile`、使用 `YidaCodeCanvas` 组件实现页面的 `compileCanvasLocal` 都是发布前 guard，不是远端完成证据。

## 数据源保留

`openyida publish` 默认是非破坏式发布：保存新 JSX Schema 前会调用 `getFormSchema` 读取目标自定义页面已有 Schema，提取 Page 组件上的 `dataSource`，再与发布脚本内置的 `urlParams`、`timestamp` 数据源合并。用户在宜搭设计器里手工创建的 HTTP / VALUE / URI 等页面级数据源会随新源码一起保留。

如果读取旧 Schema 失败，发布会停止，避免在无法确认的情况下把已有数据源清空。遇到用户明确要求“保留原有数据源”时，不需要手写额外合并脚本，直接运行新版 `openyida publish` 即可。

发布后判定：

- 源码不含 `this.dataSourceMap.`，发布输出 `No custom page data sources to preserve` 是正常情况，说明没有设计器数据源需要保留。
- 源码含 `this.dataSourceMap.`，发布输出 `No custom page data sources to preserve` 不是完成态。不要把 API 发布成功等同于页面可用，必须补数据源或改源码后重新发布。

## 发布前编译口径

`openyida publish` 会在保存 Schema 前执行确定性编译；Agent 不要把这一步改成口头检查：

1. `.canvas.jsx` / `.canvas.tsx`：执行 `YidaCodeCanvas` 页面编译，产出并写入 `runtimeCode` 与 `importedModules`。该类源码不使用 `openyida check-page` / `openyida compile` 作为预检。
2. `.oyd.jsx` / `.openyida.jsx` 或显式 `--compat`：先运行 OpenYida compatibility compiler，输出宜搭平台 `Jsx` 组件可执行源码。
3. 普通 `.jsx` / `.tsx` 源码如果已有 `export function renderJsx()`：视为平台 `Jsx` 组件源码，执行 lint、Babel、UglifyJS 后构建 Schema。
4. 普通 `.jsx` / `.tsx` 源码如果没有 `renderJsx` 但存在 `export default function Page()`：只允许走有限 authoring 降级；Hooks、生命周期和运行态限制以`yida-custom-page` 为准。
5. 兼容构建会补齐 `renderJsx` 所需基础运行时导出，并修复事件绑定、数组回调等机械问题；这些是编译器职责，不要让 Agent 手写反复改。
6. `check-page` 会硬拦截生命周期大小写错误、小写 `onclick`、渲染时直接执行事件函数、箭头函数只引用不调用方法、可见 `<button>` 没有事件等按钮不可点击问题。
7. 构建后的平台 `Jsx` 组件源码会继续执行 Babel 转 ES5、UglifyJS 压缩，再构建 Schema 发布。

这部分不是技能路由说明；它只是发布命令对不同源码扩展名的真实编译行为。

## 输出

```json
{"success":true,"formUuid":"FORM-XXX","version":0,"publishMode":"canvas","healthCheck":{"ok":true,"mode":"publish_readback","expectedPublishMode":"canvas","displayComponentPresent":true,"publishedContentMatched":true,"readback":{"hasYidaCodeCanvas":true,"runtimeCodeBytes":1024}}}
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

- 发布目标地址由当前环境配置和 auth snapshot（本地 OAuth token session 或 snapshot 明确返回的运行环境注入 env token）中的 `base_url` 决定
- 碰到组织 corpId 不匹配时，询问用户是重新登录到目标组织，还是确认在当前组织继续发布到已解析页面；不要通过新建应用规避不匹配
- **源码格式必须匹配目标运行时**：格式、Hooks 降级和兼容构建细则由对应页面开发技能处理，发布时不要临时改写源码

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| 源码构建或发布前校验失败 | 回到对应页面开发技能修复源码格式、语法或运行时兼容问题，再重新执行 `openyida publish` |
| 发布目标不是自定义展示页面 | 运行 `openyida list-forms <appType> --keyword <页面名>`，改用 `formType=display` 的页面 ID；不要对数据底表追加 `--force` |
| saveFormSchema 接口失败（401） | 执行 `openyida login` 重新登录后重试 |
| corpId 不匹配 | 询问用户是否切换组织或创建新应用，不得强行发布 |
| 发布后页面空白 | `YidaCodeCanvas` 页面检查 `YidaComp` 是否正确导出和依赖是否可加载；平台 JSX 组件页面检查 `renderJsx` 是否正确导出；同时查看浏览器控制台报错 |
| 发布接口成功但页面坏了 | 重新执行 `openyida publish <源文件路径> <appType> <formUuid> --health-check` 先确认远端 Schema 已读回且内容匹配；首屏渲染、控制台报错和体验问题仍结合浏览器验证 |
| 发布后功能异常 | `YidaCodeCanvas` 页面优先查依赖白名单、`YidaComp` 导出、hooks 副作用清理；平台 JSX 组件页面检查 `forceUpdate is not a function` 等常见错误，参考 `yida-custom-page` 平台 JSX 组件页面规范 |

## Agent 错误处理策略

当 Agent 执行本技能遇到错误时，必须遵循以下默认行为：

| 错误类型 | 默认处理策略 |
|---------|-------------|
| 命令执行失败 | 停止执行，向用户展示错误信息，询问是否重试或调整参数 |
| 参数缺失（appType/formUuid 等） | 主动询问用户补充，不得猜测或编造 |
| 权限不足 / 登录态失效 | 停止执行，提示用户执行 `openyida login` 重新登录 |
| 源码构建失败 | 停止执行，展示错误详情，引导用户回到对应页面开发技能修复源码 |
| corpId 不匹配 | 停止执行，询问用户是否切换组织或创建新应用 |
| 网络超时 | 重试 1 次，仍失败则停止并提示用户检查网络 |
| 未知错误 | 停止执行，完整展示错误信息，建议用户反馈问题 |

## 与其他技能配合

本技能在完整开发流程中的位置：

```
resolve existing page or create missing page → yida-canvas-custom-page → [本技能] yida-publish-page
```

| 相关技能 | 关系说明 |
|---------|----------|
| `yida-create-page` | 可选前置技能，仅在目标 display page 缺失且允许新增时创建页面容器，获取 formUuid |
| `yida-canvas-custom-page` | 前置技能，编写 `.canvas.jsx` / `.canvas.tsx` 页面源码 |
| `yida-custom-page` | 历史平台 JSX 组件页面维护技能；该技能自身闭环维护 `.oyd.jsx` / `.jsx` / 平台 `Jsx` 组件源码后，可调用本技能发布 |
| `yida-create-form-page` | 无关，用于创建表单页面，不需要本技能发布 |
| `yida-page-config` | 后续技能，发布后可配置页面公开访问/分享 |
| `yida-ppt-slider` | 特殊场景，PPT 幻灯片页面也使用本技能发布 |
