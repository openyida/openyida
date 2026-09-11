# 素材清单契约

## 设计槽位

Fast 和 Plan 都在 `design.md` 的 frontmatter 中写一行 JSON 格式的 `assetStrategy`。例如：

```yaml
---
assetStrategy: {"pages":[{"pageId":"home","imageNeed":"required","slots":[{"slotId":"home.hero","usage":"hero","minSize":"1600x900","required":true,"generationAllowed":true}]}]}
---
```

实际文件保留原有主题等 frontmatter 字段。CLI 的 `--design` 读取这行 JSON；不要改成多行 YAML 对象。

- 每页必须有唯一 `pageId`、`imageNeed` 和 `slots` 数组；每个槽位必须有唯一 `slotId` 和 `usage`。
- 一个槽位对应一张图。`count` 默认 `1`；若为 `3`，CLI 展开为 `slotId[0]`、`slotId[1]`、`slotId[2]`，草稿使用展开后的 ID。`count` 支持 1–100。
- `required` 默认 `true`。仅在设计允许无图布局时设为 `false`。
- `minSize` 格式为 `宽x高`，如 `1600x900`；也可写非负整数 `minWidth/minHeight`。草稿不能降低设计的最小尺寸。
- `generationAllowed=false` 的槽位不接受 `source=generated`。
- `imageNeed=none` 的页面写空 `slots`；`required` 页面没有槽位时保持 `draft`。

## 输入草稿

根字段为 `assets` 数组。用户图片和生成图片只需基础字段；图库图片还要填写来源信息。

```json
{
  "assets": [{
    "slotId": "home.hero",
    "usage": "hero",
    "input": "./assets/home-hero.png",
    "source": "user",
    "alt": "团队在会议室讨论方案"
  }]
}
```

`input` 可用本地路径或 HTTP(S) 图片 URL。本地相对路径相对于运行命令的工作目录；跨目录重跑使用绝对路径。不要写搜索结果页、网页地址或未生成的文件路径。

| source | 额外字段 |
| --- | --- |
| `user` | 用户提供的图片；保留实际用途 |
| `generated` | `isIllustrative=true`；查看实际生成结果 |
| `search` | `provider` 仅 `unsplash` 或 `pexels`；填写 `sourcePage`、`creator`、`license`、`attribution` |
| Unsplash 搜索结果 | 另填 `downloadLocation`、`downloadTracked=true`；只有真实完成下载动作记录后才能写 true |

```bash
openyida asset resolve --input manifest-draft.json --manifest asset-manifest.json --design design.md --app-type <真实appType> --json
```

完整应用始终带 `--design`，以最新设计为准。独立检查单张图片可以省略 `--design`，但它只证明传入素材的状态，不证明应用槽位齐备。`--slot home.hero=<路径或URL> --source user` 适合快速检查，缺少用途、alt 等元数据时仍为 `draft`。

图片默认下载后上传宜搭 `ImageField` 附件，再换取公开链接；下载前后和上传后均不额外发送 URL 探测请求。`input` 始终保留原图，`url` 是页面使用的最终链接；上传不改变 `source` 的来源分类。超过 20 MiB 的外链直接保留 `input`，不用上传；20 MiB 整仍上传。`--upload-assets` 仅兼容旧命令，已无需手动指定。

## 输出和重跑

输出 `schemaVersion=2`：

| 字段 | 含义 |
| --- | --- |
| `materialStatus` | 全部素材的总状态：`final` / `draft` / `none` |
| `assetStrategy` | 本次设计要求；重跑时保留。再次传 `--design` 时以设计文件覆盖 |
| `pages[]` | 每页的 `pageId`、`imageNeed`、`slotIds`、`materialStatus`、`gaps` |
| `assets[]` | 每张图的原始 `input`、页面/槽位 ID、尺寸要求、来源信息、实际宽高、落地 URL、`materialStatus`、`gaps` |
| `assets[].delivery` | CLI 生成的交付记录，用于内容比较和宜搭附件复用；`source=yida-attachment` 表示上传，`source=external` 且 `reason=ASSET_TOO_LARGE` 表示超限保留原链接；保留原样，不手工构造 |
| `gaps` | 全部缺口，按 `pageId/slotId` 定位 |
| `capabilityEvidence` | 宿主能力声明、`uploadTarget`、`maxUploadBytes` 和本次联网开关；旧 `cdnConfigured` 仅兼容字段，不决定上传能力 |

每张图取得公开 URL（或超限时保留原链接）、实际尺寸及所需元数据齐全时才为 `final`。不支持解析的格式或无法读取尺寸的图片保持 `draft`，应换成可验证的 PNG、JPEG、WebP 等格式。

页面必需槽位全部为 `final` 时页面可继续；可选槽位失败仍记录缺口，但不阻塞页面。根状态保留 `draft`，便于继续补图。

缺图后可以直接编辑输出清单，再把它同时作为 `--input` 和 `--manifest`。失败项保留原始 `input` 和尺寸要求；成功项在原图内容未变时直接复用附件链接。旧版清单仍可作为输入，但缺失的原始输入需人工补齐，首次重跑不保证复用旧上传结果。

| 缺口/错误 | 处理方式 |
| --- | --- |
| `EMPTY` / `NOT_FOUND` | 补正确的图片输入路径或 URL |
| `INVALID_IMAGE_CONTENT` / `NOT_IMAGE_FILE` / `DIMENSIONS_UNAVAILABLE` | 换成可读取格式与尺寸的真实图片；不要手填宽高绕过 |
| `WIDTH_TOO_SMALL` / `HEIGHT_TOO_SMALL` | 换更大图片 |
| `MISSING_METADATA` | 按缺失字段补用途、alt 或真实来源记录 |
| `ASSET_APP_TYPE_REQUIRED` | 传入真实 `--app-type`，或在当前项目配置 appType |
| `ASSET_TOO_LARGE_NO_ORIGINAL_URL` | 本地图超过 20 MiB，补原始图片 URL 或换小图 |
| `ASSET_ATTACHMENT_URL_INVALID` | 上传接口未返回 HTTP(S) 公开链接，排查转换接口；不使用签名下载地址 |
| `ASSET_DUPLICATE_SLOT` / `ASSET_UNDECLARED_SLOT` | 修正槽位 ID，使其与设计一致 |
| `MISSING_PAGE_SLOTS` / `ASSET_DESIGN_INVALID` | 回到设计阶段补齐或修正 `assetStrategy` |
| 下载错误（如 `HTTP_404`、`TIMEOUT`） | 本次跳过，不上传、不使用原链接；需要该图时换 `input` |
| 登录、上传、离线错误 | 恢复相应能力后，用保留的原始输入重跑 |
