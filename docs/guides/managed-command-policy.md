# Local Agent 受管命令策略

## 适用范围

只有宜搭网页发起、带有完整 Runtime 注入上下文的受管任务使用该策略。普通 OpenYida CLI 不进入此守卫。Codex、Qoder、OpenCode 共用同一策略，各自原生的操作审批继续有效。

命令守卫在参数全局处理、自动更新和业务模块加载之前运行。业务 HTTP 使用当前任务授权，不回退到个人登录态；身份与绑定应用校验始终保留。支持某个命令不等于绕过平台权限或本地工具审批。

## 唯一声明来源

在 `lib/core/command-manifest.js` 的每个 `command(...)` 定义中填写 `managedRun`。公开命令清单通过 `managed_run_schema.version=1` 描述格式，将每个声明序列化为 `managed_run`，与 `side_effect` 和 `permission` 一同供能力发现使用。

- `lib/core/managed-policy.js` 只解释策略、解析规范命令与别名并校验格式，不包含另一份命令允许列表。
- `lib/agent/managed-run.js` 按声明检查身份、参数、用户选定输入及绑定应用。
- `lib/agent/managed-command-map.js` 是现有调用方的兼容适配器，应用目标与 mutation receipt 均来自同一声明。新命令不再需要修改此适配器中的列表。

审批、副作用、执行范围是三个独立维度。不能仅凭 `local_write` 自动放行：登录、更新、导出等可能触及身份、进程或远程资源。

## 策略类型

| scope | 语义 | 要求 |
| --- | --- | --- |
| `local` | 已审核的本地计算、读取或产物生成 | 不修改远程资源；可用 allowedFlags / requiredFlags 收紧只读变体 |
| `app` | 当前绑定应用内的操作 | appPosition 或已注册的严格 appParser；写操作声明 mutation |
| `selected_input` | 读取用户为任务选定的外部输入 | 校验 inputType / inputField；只允许相同输入及可选 --json |
| `actions` | 主命令包含不同范围的子操作 | 按子操作逐项声明；未声明的子操作拒绝，不回退到允许 |
| `denied` | 尚不支持或不适用于受管任务 | 提供稳定 reason，例如 scope_not_audited；普通 CLI 不受影响 |

命令名与参数按规范路径最长匹配。别名放在同一个命令定义的 `aliases` 中，复用同一策略。`appPosition`、`formUuidPosition`、`sourcePosition` 均相对于主命令之后的完整参数数组，包括子操作。

## 新增命令

1. 注册路由及规范命令定义，沿用现有副作用和审批元数据。
2. 在同一个定义中填写 `managedRun`；缺失、未知 scope 或无效参数位置会导致命令清单检查失败。
3. 本地命令确认没有隐藏的远程写入、身份切换或任意外部执行，再声明 `local`。Plan 的 catalog/init/preview/materialize/patch 均为本地主题读取或文件生成，已全部支持。
4. 应用命令使用明确的目标位置；复杂参数复用命令自己的严格解析器，不能从自然语言、任意 JSON 或 URL 猜测应用范围。新增解析器需在适配层显式注册和测试。
5. 混合命令按实际子操作声明，不允许整个命令默认放行。新增子操作还要补齐策略；未知操作维持阻断。
6. 给不适用于受管任务的命令声明 `denied`，记录 reason。后续支持时在同一声明中改变策略，补齐目标解析及平台授权检查。
7. 运行 `npm run check:commands` 及相关测试。守卫测试应覆盖普通 CLI 不受影响、合法受管调用、身份覆盖、跨应用拒绝、未知操作、实际产物/远程契约及 mutation receipt。

纯本地示例：

```js
command('design-plan.catalog', ['design-plan', 'catalog'], usage, descriptionKey, {
  managedRun: { scope: 'local' },
  requiresLogin: false,
});
```

绑定应用写操作示例：

```js
command('example.update', ['example', 'update'], usage, descriptionKey, {
  managedRun: {
    scope: 'app',
    appPosition: 1, // args = ['update', appType, formUuid, ...]
    mutation: { operation: 'update_form', formUuidPosition: 2 },
  },
});
```

mutation.operation 必须符合现有资源变更协议；新增 operation 时同步核对 Runtime、服务端和 UI 消费方。成功 JSON 结果才产生刷新通知，本地 Plan 产物和失败命令不产生线上资源变更通知。

只读身份状态示例：

```js
managedRun: {
  scope: 'actions',
  actions: { status: { scope: 'local', allowedFlags: ['--json', '--quiet'] } },
}
```

## Ask Human 文本边界

`openyida agent ask-human` 的 `openyida.ask-human.v1` 回执与 Runtime 共用单行文本约束。标题、问题、选项及非空说明必须去掉首尾空白，不能包含换行、制表符或其他 Unicode 控制字符；长度按 UTF-8 字节限制。多段说明放在普通回复中，确认问题保持单行。CLI 必须在落盘前拒绝不合规内容，避免已返回 queued 后 Runtime 拒绝回执并中断整个任务。该协议支持摘要和确认选项，不支持 HTML 附件内嵌展示。

## 校验与发布

`npm run check:commands` 已纳入正常 CI，检查所有命令的策略格式，并拒绝把远程副作用声明为本地范围。新增策略字段、scope 或解析器必须更新校验器和测试。静态元数据不能自动证明命令实现安全，代码审查仍需核对真实 API 行为；平台的任务授权是另一层范围校验。

定向回归：

```bash
npx jest tests/agent-managed-policy.test.js tests/agent-managed-run.test.js \
  tests/agent-managed-help.test.js tests/agent-mutation-receipt.test.js --runInBand
```

此改动属于 OpenYida 主包。源码修改不会改变已经冻结的运行包：需重新构建/发布选定渠道的 OpenYida 包，再按对应流程重连或升级。此次策略改造没有新增 Go Runtime、服务端或 UI 协议字段；既有任务、应用范围与 mutation receipt 契约不变。包发布与四个服务部署仍是独立步骤。
