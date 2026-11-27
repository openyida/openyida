---
name: yida-code-workspace
description: 开发宜搭全码工作台（WORKSPACE）或维护普通应用的多文件代码工作区。支持初始化、批量保存、构建、测试和指定版本发布。
---

# 多文件代码工作区

全码工作台与普通宜搭应用是平行的搭建路径。明确指定全码工作台、WORKSPACE 或本技能时，直接执行下方全码流程，不先加载 `yida-app`。已有应用核实 `appTag`，WORKSPACE 使用应用级源码，不额外创建普通自定义页面或 Canvas。普通应用的表单、流程和 Canvas 搭建仍由 `yida-app` 编排；明确维护其多文件代码工作区时使用本文普通应用章节。

先确认目标应用、组织与当前登录环境。需要服务端开放工作区及应用开发权限。普通单文件 Canvas 页面继续使用原发布流程。

## 全码工作台（WORKSPACE）

当用户明确要求全码工作台时使用以下流程。确认目标应用、组织和已登录账号。已有应用直接使用其应用 ID。仅在用户要求创建新全码应用时执行：

```bash
openyida create-app --workspace --name "我的待办工作台" --json
```

核对回执 `appTag=WORKSPACE`。正式地址为 `workspaceUrl`。用 `adminUrl` 查看代码和版本。全码应用以应用级源码和产物为入口。

### 每轮开发与测试

首次在新目录拉取工程。之后在同一个目录修改并同步测试：

```bash
openyida code-workspace pull APP_ID ./workspace --init-if-empty --json
# 生成或修改代码后，在本轮回复用户前执行一次。
openyida code-workspace sync-test APP_ID ./workspace --json
```

`sync-test` 保存源码、编译上传，创建或复用测试版本，从版本接口确认 DRAFT 标识，保存并回读测试构建绑定。成功后返回服务端实际测试地址，当前为 `/{APP_ID}/preview`。源码已在测试生效时直接返回测试地址；已正式发布的同一源码返回正式 `/workspace` 地址及 `testSource=online`。失败时保留源码目录，核实已保存状态，修复后在同一个目录重跑；匹配的已上传构建可复用。收到修订冲突时保留本地改动，将当前源码拉到新目录再比较。成功后把回执中的 `testUrl` 交给用户，并用这个地址验证挂载。仅构建成功不代表已送测或可预览；正式 `/workspace` 加载已发布的构建。

在 `src/main.tsx` 默认导出 React 根组件。保留模板的工具链和锁文件。通过相对路径或 `@/` 导入工程内 JavaScript、TypeScript、JSON 和 CSS。运行时提供 React 和 ReactDOM 16.13.1。

“我的宜搭待办”用 `window.YidaWorkspace.getMyTodos({ page: 1, pageSize: 20, keyword })` 读取当前访问人在当前组织的待处理任务。成功回执包含 `items`（每项为 `id`、`title`、`appName`、`createdAt`）和 `total`。在组件中分别处理加载中、空列表和错误。测试时用真实环境对照本人待办。操作范围为读取任务列表。

发布前检查回执 `testSource`。值为 `online` 时告知用户当前版本已正式发布。值为 `draft` 时，向发布人展示测试版本、构建 ID 和发布标识，并在管理页确认发布。若发布人通过管理页签发代发布确认，把服务器返回的确认令牌保存在源码目录外的本地临时文件中交给 Agent，然后执行：

```bash
openyida code-workspace publish-tested APP_ID --draft-version ACTUAL_DRAFT --build-id SAVED_BUILD_ID --publish-id STABLE_PUBLISH_ID --confirmation-token-file /path/to/private/confirmation.token --json
```

代发布使用 `sync-test` 回读的当前测试构建的三项标识。候选变化或令牌失效时，重新展示候选并取得确认。发布后用正式地址验证挂载。回滚在管理页选择历史正式版本，线上产物和当前源码一起恢复。之后重新把当前源码拉取到新目录继续开发。后续改动继续用 `sync-test` 送测。

## 普通应用的代码工作区

## 页面与导航归属

创建资源前按业务用途确定承载方式，再声明 entries 和创建页面：

| 承载方式 | 实际自定义页面 | 源码与构建入口 | 导航 |
| --- | --- | --- | --- |
| 平台导航、多页面 | 每个独立业务页面一个 | 每页声明独立入口，仅引用公共组件和本页业务 | 宜搭负责跨页导航；页面只渲染内容 |
| 自绘导航、单页面 | 整个应用只创建一个 | 一个应用入口，组合多个内部视图模块 | 应用壳负责本地状态/hash 路由 |

多页面的 Schema 结构可以相似，但 codeBundle.entryId 必须指向相应页面入口；不能在每页重复挂载完整应用，再靠初始导航值区分。公共组件、数据访问与样式留在应用代码中复用，运行清单只引用公共资源和当前页资源。

```bash
openyida sample yida-code-workspace native-pages --output ./new-workspace/src/shared/PageLayout.jsx
openyida sample yida-code-workspace single-page --output ./new-workspace/src/app/WorkspaceApplication.jsx
```

按选定方式只提取对应模板。native-pages 提供无应用导航的内容布局；跨页上下文操作复用 Canvas 的平台路由工具。single-page 提供同一页面内的 hash 路由及前进后退，只挂载当前视图；routes 在组件外声明。整个应用采用后者时保存并回读隐藏平台导航，页面管理仍只保留一个自定义页面；内部视图不另建平台页面。

优先按页面/视图边界组织源码。多页面按入口下载；单页面的小型视图可合并为一个有界入口，避免 iframe 嵌套与重复初始化。大模块需要懒加载时，先核实构建器、批准资源清单和运行时是否共同支持分块，不能输出运行清单之外的 chunk 或直接拼下载 URL。

从实际工作台和管理预览分别验收：导航归属一致、内容与当前页面一致、刷新和返回正常；切换时不额外创建页面或重新编译。不同内部视图的前端隐藏不构成独立页面权限。

## 读取与修改

```bash
openyida code-workspace limits APP_ID --json
openyida code-workspace current APP_ID --json
openyida code-workspace pull APP_ID ./new-workspace --json
openyida code-workspace check APP_ID ./new-workspace --json
```

pull 只写入不存在的新目录，逐文件核验字节数及 SHA-256，不覆盖已有编辑。`--snapshot ID` 可导出历史快照，历史导出不能直接作为当前编辑基线提交。

源码 project.json 须明确声明 toolchainRef、lockfilePath、lockfileHash、runtimeAbi、entries。锁文件摘要必须匹配真实文件；entries 是入口 ID 到源码路径的映射。当前元数据不回传冻结配方，缺少配置时报告缺口，不猜工具链。check 只检查目录及配置，不编译或执行源码。

## 一轮修改应用一次

```bash
openyida code-workspace push APP_ID ./new-workspace --json
```

首次提交未拉取的目录须显式传 `--expected-revision 0`；已有编辑头使用真实 revision。pull 的本地状态位于 .openyida/workspace.json，不上传。push 在一次请求内合并变化文件和删除路径，校验源码回读；冲突先拉取比较，不盲目覆盖。

上传响应丢失时，push 只回读一次：仅当 revision 恰好前进一版且所有文件大小/摘要一致时恢复本地状态并返回 `responseRecovered:true`，不会再次上传。未能确认时保留原错误，先查询 current 再处理，不将超时当作未保存。

单文件编辑、保存及编译预览只在本地完成，不得每改一个文件就 push 或登记构建。源码保存不要求编译成功。

## 登记与正式发布

自定义页面仍是实际访问入口；代码工作区不是页面。每个页面的 `YidaCodeCanvas.props.codeBundle` 引用一个构建入口：`{"version":"2","workspaceId":"...","entryId":"home"}`。entryId 必须在 project.json 和登记后的构建清单中存在，实际 JS/CSS 由批准的运行清单解析，不在 Schema 内复制源码或构建代码。

```bash
openyida code-workspace start-test APP_ID --json
openyida code-workspace bind APP_ID ./new-workspace --form-uuid FORM_ID --entry home --canvas-node-id NODE_ID --json
```

先在应用设置中开启测试环境；start-test 不代替用户修改该开关。start-test 复用已有活跃测试版本，缺失时创建，并仅把当前登录用户加入测试参与者，回读测试状态，不新增其他参与者。仅对刚创建的空自定义页面，可用 `--create-canvas` 代替节点选择。bind 保留原 Schema、数据源及并发版本，删除所选 Canvas 的 code/runtimeCode，保存后回读绑定；不登记构建、不发布应用。bind 先确认服务端 inTestEnvironment，或使用 getPreviewUrl 下发的有效测试上下文；均不可用时停止写入并报告 `CODE_WORKSPACE_TEST_CONTEXT_UNAVAILABLE`，不降级改写线上页面。测试上下文只保留在命令进程内，不保存 Cookie 登录态。

新建一轮测试版本时，其资源清单最初为空。publish 沿用现有 startTest 接口，收集尚未修改的线上资源引用到 DRAFT，保留本轮已有测试修改；不重写原页面 Schema。新建页面或变更入口绑定时才执行 bind，已有页面不使用 `--create-canvas`。

```bash
openyida code-workspace register APP_ID ./new-workspace --build-dir ./frozen-output --json
openyida code-workspace publish APP_ID ./new-workspace --draft-version ACTUAL_DRAFT --publish-id STABLE_PUBLISH_ID --json
```

register 接收与冻结配方一致的外部构建器输出：runtime.manifest.json 及 files/ 下的运行文件。CLI 校验工作区、源码、ABI 和文件摘要后上传，不内置多文件编译器，不保证任意外部产物能由 FC 重建。缺少兼容构建器时止于源码保存。

publish 使用本地已登记且匹配源码的 buildId，先取得测试版本身份，将固定构建保存到指定 DRAFT 并回读，再通过现有版本接口发布同一构建；不会在发布时重新编译，也不批量改写页面 Schema。测试环境关闭、DRAFT 已变化或回读不一致时停止发布。保存、登记、正式发布分别报告；返回发布状态不代表真实浏览器运行已验收。超时或结果不明先查原应用发布状态，重试保留原 publish-id，不自动另发一版。

## 恢复源码编辑头

仅在用户明确要求恢复时执行：

```bash
openyida code-workspace restore APP_ID ./new-workspace --snapshot SOURCE_ID --json
```

恢复不改变线上版本，不覆盖本地文件；完成后 pull 到新目录再编辑。旧目录保持原基线，不能用它覆盖恢复结果。
