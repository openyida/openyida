# 自定义页面附件与图片上传

有真实上传需求时，使用 OpenAPI 文件接口；不要仅提供链接输入、静态上传按钮或模拟成功。附件和图片共用同一链路，原生上传组件只作为已验证的可选交互。

## 接入入口

Canvas 发布层在外层 `didMount` 注册 `window.__OPENYIDA_FILE_API__`。旧页面需要重新发布才会获得此桥。复制控件并合并到业务源码：

```bash
openyida sample openyida-page-template canvas-file-upload --output .cache/samples/canvas-file-upload.jsx
```

旧 JSX 页面、或确需页面内调用客户端时，提取共享浏览器函数并合并，调用 `createYidaFileClient(window)`，不要 import 本地文件或引入 npm SDK：

```bash
openyida sample openyida-page-template file-upload-client --output .cache/samples/file-upload-client.jsx
```

客户端仅使用页面当前用户的同源登录态（`credentials: 'include'`）；不使用 CLI OAuth token，不读取或要求用户导出 Cookie。新的 CLI Token 鉴权无需 CSRF；页面使用浏览器会话，已有部署仍可能校验 CSRF，此时客户端自动复用平台已注入的 `window.g_config._csrf_token`，仅带给同源文件接口。缺少该上下文也照常发请求，不据此误判未登录或前端阻断；登录、组织和权限由服务端校验。旧文档的 Cookie/CSRF 前置要求不作为当前生成代码的硬校验。接口仍不支持 Open 免登/匿名上传，公开页需提示登录后上传，不调用匿名提交网关绕过限制。

## 请求与状态契约

`binding` 的 `appType`、`formUuid` 来自目标真实资源；`procInstId`、`fileSource`、`businessType` 可选。不猜 objectName 或实例 ID。

| 方法 | 返回 / 行为 |
| --- | --- |
| `upload(binding, file, { maxBytes?, signal? })` | 上传、确认、获取地址，返回 `{ name, size, type, objectName, fileUuid, fileUploadId, url, downloadUrl, previewUrl }` |
| `getDownloadUrl(binding, objectName, { instId?, type?, signal? })` | 刷新下载/预览地址，返回 `{ url, downloadUrl, previewUrl }`；地址转换为当前平台同源绝对 URL |
| `bindFiles(binding, savedInstId, files, { signal? })` | 将已确认文件绑定到保存成功的实例；files 可为返回对象或 objectName 数组，binding.formUuid 必填 |

上传实现严格遵守以下顺序：

1. POST `/{appType}/openapi/file/getUploadCredential.json`，JSON body 含 appType、fileName、fileSize 和可选字段；`credentials: 'include'`，请求头 `Content-Type: application/json` 和 `Accept: application/json`，确保平台异常也返回 JSON。若平台注入了浏览器会话 CSRF 则自动携带，否则不要求。接口重定向直接报错，不跟随跨域登录/错误页导致上传一直等待。
2. POST 返回的 HTTPS `host`，FormData 包含 `key=objectName`、policy、OSSAccessKeyId、signature、`success_action_status=200`、`Content-Disposition=attachment; filename={fileName}`，最后追加二进制 file。不要手写 multipart Content-Type，Content-Disposition 必须作为表单字段。
3. `headerEnabled=y` 时透传返回的网关 headers；不向 OSS 发送 Cookie、平台 Authorization 或 CSRF，`credentials: 'omit'`。使用服务端返回的 host/objectName，兼容私网网关域名。
4. OSS HTTP 成功后 POST `confirmUpload.json`，JSON body 必须带同一凭证的 objectName/uploadToken 和同一文件信息。确认失败不能显示成功。
5. POST `getDownloadUrl.json` 获取私有文件地址。不要拼公开 OSS URL，uploadToken、签名和 File 对象不写入字段或持久化状态。
6. 保存业务表单/流程成功后，使用真实返回的实例 ID 调用 `bindFiles.json`，JSON body 含 appType、formUuid、instId、`fileNames: objectName[]`。保存字段不替代绑定。

默认前端校验非空、带 1–20 位字母数字后缀、单文件 ≤100 MiB；可按组织配置显式设置 `maxBytes`，服务端限制仍为最终依据。图片选择器使用 `accept="image/*"`，同时按业务要求校验类型；accept 不是安全校验。

## 业务页面装配

```jsx
const [files, setFiles] = React.useState([]);
const [uploading, setUploading] = React.useState(false);
// 放在真实业务组件内，binding 来自资源回读。
<CanvasFileUpload binding={binding} value={files} onChange={setFiles}
  onUploadingChange={setUploading} disabled={saving} />
// 图片：同一控件加 accept="image/*"。
// 提交按钮 disabled={uploading || saving}；提交函数也检查状态，防止重复提交。
// onUploadingChange 在上传中或已确认但尚待恢复 URL 时为 true，恢复/移除后解除。
```

`AttachmentField` 和 `ImageField` 均提交文件对象数组，保留 name、size、fileUuid、url、downloadUrl、previewUrl。`ImageField` 不接受 URL 字符串数组；后端会把每个元素按文件对象解析，传字符串会导致“参数异常”。字段回读可能是 JSON 字符串，先解析为数组再使用。客户端返回值包含绑定需要的 objectName；在页面状态保留完整文件信息，不能只留下 URL 然后无法绑定。字段 ID 通过 get-schema 确认，不能直接把 File、FormData 或单个文件对象当作数组字段。

提交步骤：检查无上传中任务 → 按真实字段结构保存 → 从实际 API 返回结构读取 formInstId/流程实例 ID → 记录 savedInstId → `bindSavedFiles(binding, savedInstId, files)`。更新已有实例时使用该实例 ID。只有保存与绑定都成功才显示完整成功；保存成功但绑定失败时，提示“记录已保存，附件绑定失败”，保留实例 ID 并提供仅重试 bind 的入口，不重新 save/startProcessInstance。

## 失败与恢复

- OSS 失败：不调用 confirm；提示重试完整上传。
- `FILE_NETWORK_ERROR` / `FILE_OSS_NETWORK_ERROR`：错误包含失败阶段；核对凭证返回的 host 能否解析、网关网络及 CORS，不猜测 bucket、不改写 host 绕过网关。
- 350010/350011：同一凭证校验失败或已过期；重新获取凭证、上传、确认。凭证生成后需在 30 分钟内完成上传和确认。
- 350001：检查目标组织的 `openapi_file_upload` 灰度。部署接口不代表组织已开放；部分部署的错误码翻译可能把“功能未开放”显示为“文件地址参数非法 {0}”，需结合服务端日志核对，不只凭文案判断文件名有误。展示服务端错误，不退回模拟成功或内部 `/ossSign`。
- 非 JSON 响应：返回 `FILE_RESPONSE_INVALID` 和具体请求阶段，检查登录/错误页或服务端响应；不直接显示 JSON 解析器异常、不继续 OSS 上传。
- confirm 成功、URL 获取失败：错误带 `uploadedFile`；示例保留它并提供“重试获取地址”，只调用 getDownloadUrl。
- 保存失败：保留已确认文件，允许用户重试保存。
- 绑定失败：保留真实 savedInstId 和文件，仅重试 bind；不要重复创建业务记录。
- 移除文件：仅移除本次待提交值，不调用管理员预删除接口；已绑定记录按业务编辑权限更新字段。
- 私有签名 URL 过期：按 objectName/instId 重新 getDownloadUrl；不要把临时 URL 当永久图片 CDN。
- confirm 不等于绑定；建议立即绑定，未绑定文件可能在 7 天后不可访问并进入清理流程。

## 验收

本地 compile 验证源码；目标已登录浏览器分别选一个附件和图片，检查凭证→OSS→确认→取地址顺序、中文文件名、预览/下载、移除、多文件部分失败、上传中禁止提交。按真实字段回读保存值和实例 ID，核验 bind 成功；模拟绑定失败后只重试绑定，确认不新增记录。匿名页显示登录提示，接口未开放或无权限显示实际错误。没有真实浏览器证据时明确标记未实测。
