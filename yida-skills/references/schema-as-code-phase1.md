# Schema-as-Code Phase 1 Manifest

这是 OpenYida Phase 1 唯一的 Manifest 编写与执行指南。Phase 1 管理 `app`、`form`、`process` 和 `native/default` 展示页；State 是资源 identity bindings 的唯一持久化权威，但 State 不是远端真相。

## Canonical Manifest

页面源码必须是 workspace 内的相对路径。下面的流程节点、字段和资源都使用稳定 semantic key；不要把真实 `appType`、`formUuid`、`fieldId` 或 `processCode` 写进 Manifest。

```json
{
  "kind": "openyida_app_manifest",
  "schemaVersion": 1,
  "app": {
    "key": "visitorSystem",
    "name": "访客管理系统"
  },
  "forms": {
    "visitorRegistration": {
      "title": "访客登记",
      "mode": "process",
      "fields": {
        "visitorName": {
          "type": "TextField",
          "label": "访客姓名",
          "required": true
        },
        "visitReason": {
          "type": "TextareaField",
          "label": "来访原因"
        }
      }
    }
  },
  "processes": {
    "visitorApproval": {
      "form": "visitorRegistration",
      "nodes": [
        {
          "key": "frontdeskReview",
          "type": "approval",
          "name": "前台初审",
          "approver": "originator"
        }
      ]
    }
  },
  "pages": {
    "visitorHome": {
      "title": "访客工作台",
      "source": "pages/visitor-home.oyd.jsx"
    }
  }
}
```

上例不是单文件即跑：先在 workspace 内创建或替换 companion source `pages/visitor-home.oyd.jsx`，再执行 `validate`。例如文件内容可以是：

```jsx
export default function Page() {
  return <div>访客工作台</div>;
}
```

更新页面时也先替换同一个 workspace-relative source 文件，再重新 `plan`；不要把 inline source、绝对路径或真实页面 ID 写进 Manifest。

## Review Then Apply

```bash
openyida schema validate app.yida.json --json --quiet
openyida schema plan app.yida.json --state .cache/openyida/state.v1.json --json --quiet
openyida schema apply app.yida.json --state .cache/openyida/state.v1.json --plan-id '<reviewed-planId>' --json --quiet
```

1. `validate` 只做本地校验。
2. `plan` 使用 `remote_read` 权限读取线上真实状态。人工检查 changes 和 `planId`。
3. 对任何正常 create/update，首次 `apply` 都必须由用户审阅本次 `planId` 后显式批准，才以 `mixed/write` 权限执行。baseline plan、State、缓存、成功的 validate/plan 或错误 action 都不能激活写权限。
4. form/page 保存使用本次 apply JIT exact read 得到的 `gmtModified`；app/process 没有同类条件写，继续使用 identity/version/JIT/reconciliation 门禁。

## Actions

- 正常结果不触发错误恢复型 `ask_human`；但任何 create/update 的 plan 完成后都必须独立暂停，等待用户对当前 `planId` 的显式批准，才可执行首次 `apply`。
- `stale_replanned` 只展示 replacement plan，等待用户重新审阅并显式 apply；绝不自动 apply 或重试 save。
- `nextAction=ask_human` 时使用宿主 ask_human；没有工具时原样展示安全的 `blockText` 和 `choices`。
- `nextAction`、`ask_human` 和 `choices` 只用于错误恢复或业务取舍，不构成首次或后续 `apply` 的写授权。
- reconciliation、uncertain create/write、managed conflict/missing 时停止。禁止自动 retry、按标题 discover/adopt、猜 ID、cleanup 或重建。

## Phase 1 Boundary

| Resource or operation | Phase 1 |
| --- | --- |
| app/form/process/native-default display page create/update/noop | Supported |
| report、integration automation | `SCHEMA_RESOURCE_TYPE_UNSUPPORTED` |
| page config、delete、pull、adopt | Deferred; not Manifest v1 properties |
| Canvas、dashboard、raw Schema、inline page source | Deferred/unsupported |

Standalone、明确 unmanaged 且用户明确要求 legacy 命令的资源仍可使用原 CLI。SAC Manifest 或 State 已拥有资源身份时，不得 fallback 到 legacy 直写。

- SAC-owned Manifest 中的 report、automation、page config、delete 和 pull 在 Phase 1 停止或延期，不 fallback 到 legacy。
- 明确 standalone/unmanaged 的 report、integration automation 和 page config 仍可路由现有 `yida-report`、`yida-integration`、`yida-page-config`；delete/pull 当前没有 Phase 1 live Manifest 或 standalone routing contract。
