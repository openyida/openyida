# 宜搭原生附件上传协议参考

## 协议链路

```text
OpenYida OAuth session
  → GET /ossSign?scene=AttachmentField
  → POST multipart/form-data to signInfo.host
  → POST /query/attach/uploadCallBack.json
  → POST /dingtalk/web/<appType>/v1/form/updateFormData.json
  → GET /dingtalk/web/<appType>/v1/form/getFormDataById.json
```

该命令只更新已有普通表单实例。流程表单、新建记录、ImageField 和附件删除不在首版范围内。

## 签名请求

`GET /ossSign` 的核心参数包括：

| 参数 | 值 |
| --- | --- |
| `scene` | `AttachmentField` |
| `appType` | 目标应用 ID |
| `fileName` | 原始文件名 |
| `fileSize` | 字节数字符串 |
| `contentType` | MIME 类型 |
| `objectName` | `<appType>/<year>/<month-day>/<UUID><ext>` |
| `isOpen` / `newContext` / `accelerate` | `n` / `y` / `y` |

成功响应必须包含 `host`、`objectName`、`policy`、`accessid`、`signature`、`url`、`downloadUrl`、`previewUrl`。这些签名材料属于短期敏感数据，只能在内存中使用。

## OSS 上传与回调

向 `signInfo.host` 发送 multipart POST：`key`、`policy`、`OSSAccessKeyId`、`signature`、`success_action_status=200`、policy 中签名的 `Content-Disposition` 和 `file`。HTTP 200 或 204 视为成功，并读取 `x-oss-request-id`。

`Content-Disposition` 必须从 Base64 UTF-8 policy 的 `conditions` 中提取；缺失或无法解析时停止上传。随后调用 `/query/attach/uploadCallBack.json`，提交 `appType`、`formUuid`、`fileName`、`fileSize`、`objectName`、`ossRequestId` 和 `businessType=inst`。

## 表单更新与验收

附件字段值必须是对象数组：

```json
[
  {
    "name": "contract.pdf",
    "size": 12345,
    "fileUuid": "APP_...pdf",
    "url": "/ossFileHandle?...",
    "downloadUrl": "/ossFileHandle?...type=download",
    "previewUrl": "/inst/preview?..."
  }
]
```

更新接口提交 `formInstId` 和 `updateFormDataJson`。默认只写本次上传数组；`--append` 会先读取实例并将旧数组与新数组合并。该读改写过程不是原子操作，不要对同一表单实例并发执行多个追加命令，否则后写请求可能覆盖先写结果。更新后必须再次读取实例，验证数量、必需字段和本次 `fileUuid`。

## 失败语义

- 签名失败：不上传，检查 OAuth 组织、appType 和文件信息。
- OSS 失败：停止该文件并汇总所有并发结果，不更新表单。
- OSS 成功但回调失败：报告对应 `fileUuid/objectName` 可能是孤儿对象。
- 任一文件失败：不执行表单更新；已成功上传的文件也作为潜在孤儿对象报告。
- 更新失败：报告全部新上传对象，保留非零退出码。
- 更新成功但回读失败：返回 verification 失败，明确说明远端可能已更新但尚未验收。
- 命令不自动删除、回滚或覆盖其它表单字段。
