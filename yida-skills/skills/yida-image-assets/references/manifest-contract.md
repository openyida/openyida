# 素材清单契约

## 设计槽位

Fast 和 Plan 在 `design.md` 的 frontmatter 保留主题等字段，并用一行 JSON 写 `assetStrategy`：

```yaml
---
assetStrategy: {"pages":[{"pageId":"home","imageNeed":"required","slots":[{"slotId":"home.hero","usage":"hero","minSize":"1600x900","required":true,"generationAllowed":true}]}]}
---
```

- 每页有唯一 `pageId`、`imageNeed` 和 `slots`，每个位置有唯一 `slotId` 和 `usage`。
- 每个位置一张图，`count` 省略或填 `1`。旧计划的 count>1 仍展开为独立位置。
- `required` 默认 true；设计允许无图布局时可设 false。
- `minSize` 为 `宽x高`，也可填非负整数 `minWidth/minHeight`。CLI 使用设计和草稿中较高的尺寸要求。
- `generationAllowed=false` 只接受真实素材。
- `imageNeed=none` 省略 slots 时 CLI 补空数组；required/beneficial 页面显式填写 slots。Plan 生成方案时即校验位置、用途和尺寸；required 页面空 slots 时保持 draft。

## 输入草稿

```json
{"assets":[{"slotId":"home.hero","usage":"hero","input":"./assets/home.png","source":"user","alt":"团队讨论方案"}]}
```

`input` 使用实际本地文件或 HTTP(S) 图片地址。相对路径基于命令工作目录，跨目录处理使用绝对路径。NOT_FOUND 返回 resolvedPath 与 baseDir，核对实际查找位置后修正 input；这类文件路径修正直接重跑该页素材任务。

| source | 来源字段 |
| --- | --- |
| user | 保留用户图片的用途 |
| generated | isIllustrative=true，查看实际图片 |
| search | provider=unsplash 或 pexels，填写 sourcePage、creator、license、attribution |
| Unsplash 搜索结果 | 实际完成下载动作记录后填写 downloadLocation、downloadTracked=true |

### 来源与授权留证

在每张图片的 `assets[]` 记录中填写下列信息，通过 `--input` 传入。CLI 将它们保留在输出清单和 JSON 结果中；图片检查失败、离线执行或用清单重试时也会保留。

| 字段 | 填写内容 |
| --- | --- |
| assetId | 来源网站的图片 ID；用户素材使用已有内部编号，无编号留空。与页面位置 slotId 区分。 |
| creator | 作者或权利人，沿用已有字段 |
| sourcePage | 对应图片的官方详情页或用户提供的来源页，沿用已有字段 |
| license | 许可名称或已取得的授权说明，沿用已有字段 |
| licenseUrl | 实际核对的许可条款 HTTP(S) 链接 |
| licenseCheckedAt | 实际核对许可的日期，格式 YYYY-MM-DD；CLI 不自动填今天 |
| authorizationEvidence | 必要授权凭证的链接或文件路径数组，如购买凭证、人物或场地产权授权；本地凭证建议使用项目内可持续保留的绝对路径 |

例如，已取得用户图片授权时，可在该图片记录中补充以下字段（示例值需替换为真实记录）：

```json
{
  "assetId": "company-team-001",
  "creator": "公司摄影团队",
  "sourcePage": "https://example.com/media/company-team-001",
  "license": "公司授权用于本项目官网",
  "licenseUrl": "https://example.com/media/usage-terms",
  "licenseCheckedAt": "2026-09-18",
  "authorizationEvidence": ["/project/assets/licenses/company-team-001.pdf"]
}
```

未取得的信息留空：文本字段为 `""`，凭证列表为 `[]`；不要编造图片 ID、核对日期或凭证。换图时同步更新这些记录，不能沿用上一张图的授权信息。CLI 检查新增字段的类型、许可链接格式和日期格式，不访问凭证或判断授权是否有效。`final` 仍表示图片满足现有素材就绪检查，不代表已认证可商用。

## 按页面执行

```bash
openyida asset resolve --input asset-manifests/home.draft.json --manifest asset-manifests/home.json --design design.md --page-id home --json
```

完整应用带 `--design` 校验槽位。`--page-id` 只处理指定页；省略时处理整份清单。各页使用不同的 `--manifest` 文件，同时运行、独立交接。第二轮更新失败项 input，再将页面清单同时作为输入和输出。轮次和并发规则见 [主流程](../SKILL.md#3-最多两轮按页面并发)。

独立图片可用 `--slot home.hero=<图片> --source user` 检查；这只验证传入图片，完整应用仍需设计槽位校验。

## 链接检查与上传

- `deliveryMode=auto`（默认）：允许外链的 HTTP(S) 图片经一次检查后直接使用。检查最多读取 128 KiB，核对真实格式和尺寸；内容、构图与用途由宿主看图确认。
- `hotlinkAllowed`、`rehostAllowed` 为布尔值，分别表示允许外链展示、允许转存。搜索得到的 Unsplash/Pexels 官方图片直链默认允许外链，Unsplash 默认仅用直链。其他来源沿用已核实的转存许可，允许外链时显式填 `hotlinkAllowed=true`；明确禁止转存时填 `rehostAllowed=false`。
- 本地图片上传宜搭附件；`deliveryMode=upload` 或命令 `--upload-assets` 请求上传允许转存的外链。上传最大 20 MiB，需要登录态和真实 appType，可通过 `--app-type` 指定或读取项目配置。
- 上传失败或图片超出上传限制时，只有已验证且允许外链的原地址可以继续使用；其他情况记录缺口。返回验证网页、403、超时或尺寸不足的地址按失败处理。
- input 保留原图，url 保存最终链接，source 保留来源分类；许可和 deliveryMode 随清单保留。原图内容相同时复用已有附件，上传流程直接复用下载内容的检查结果。
- `--offline` 关闭联网和上传，图片保持 draft。

## 输出

`schemaVersion=2`：

| 字段 | 含义 |
| --- | --- |
| materialStatus | 本文件内素材的总状态：final/draft/none |
| assetStrategy | 本次设计要求；重跑保留，传 --design 时以设计文件为准 |
| pages[] | pageId、imageNeed、slotIds、materialStatus、gaps |
| assets[] | input、url、页面/位置 ID、用途、尺寸、来源、alt、materialStatus、gaps |
| assets[].assetId / creator / sourcePage / license / licenseUrl / licenseCheckedAt / authorizationEvidence | 图片编号、作者、来源页、许可名称、许可链接、核对日期和授权凭证记录；未提供的值留空 |
| assets[].delivery | CLI 生成的交付记录；yida-attachment 表示上传，external 表示已验证的直链；reason=OK_DIRECT 表示直接交付，其他 reason 保留上传失败或超限原因 |
| gaps | 缺口及错误码，按 pageId/slotId 定位 |
| capabilityEvidence | 宿主能力、uploadTarget、maxUploadBytes、online；cdnConfigured 是旧兼容字段 |

取得已验证的图片直链或附件公开 URL、实际尺寸和完整来源信息后，图片才为 final。页面必需位置全部 final 即可继续，可选缺口仍保留在 gaps。旧清单可继续使用，缺原始 input 时先补齐。

## 常见缺口

| 错误 | 处理 |
| --- | --- |
| EMPTY / NOT_FOUND | 补实际图片路径或地址 |
| INVALID_IMAGE_CONTENT / NOT_IMAGE_FILE / DIMENSIONS_UNAVAILABLE | 换可读取尺寸的 PNG、JPEG、WebP 等真实图片 |
| WIDTH_TOO_SMALL / HEIGHT_TOO_SMALL | 换更大图片 |
| MISSING_METADATA | 补用途、alt、已取得的来源记录；获取失败则换图 |
| ASSET_APP_TYPE_REQUIRED | 上传时填真实 appType |
| REHOST_NOT_ALLOWED | 使用允许外链的原地址，或换可转存的图片 |
| ASSET_TOO_LARGE | 换小图；允许外链时保留已验证原地址 |
| ASSET_TOO_LARGE_NO_ORIGINAL_URL | 补原始外链或换小图 |
| ASSET_ATTACHMENT_URL_INVALID | 检查公开链接转换结果 |
| ASSET_DUPLICATE_SLOT / ASSET_UNDECLARED_SLOT | 对齐设计位置 ID |
| MISSING_PAGE_SLOTS / ASSET_DESIGN_INVALID | 修正设计槽位 |
| ASSET_PAGE_REQUIRES_DESIGN / ASSET_PAGE_NOT_FOUND | 提供设计并核对 pageId |
| 下载、登录、上传错误 | 在剩余轮次内补必需图片，用尽后保留缺口 |
