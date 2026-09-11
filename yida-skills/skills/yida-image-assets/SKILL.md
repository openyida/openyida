---
name: yida-image-assets
description: >
  宜搭页面需要图片时使用。根据设计槽位选图、上传宜搭图片附件、补齐失败项，输出可按页面使用的 asset-manifest.json。
---

# 准备页面图片

输入是 `design.md.assetStrategy`，输出是 `prd/<项目名>/asset-manifest.json`。按已有设计准备图片，不改业务需求和视觉方案。

`asset resolve` 负责下载和上传图片，不负责搜索或生图。搜索、生图、看图由当前宿主工具完成。

## 1. 确定哪些页面需要图片

读取 `assetStrategy.pages[]`，按 `pageId` 找页面，按 `slotId` 找图片位置。

| imageNeed | 常见页面 | 怎么做 |
| --- | --- | --- |
| `required` | 品牌、营销、商品目录、菜单、封面、作品展示 | 准备设计要求的图片；缺图时该页面保持草稿 |
| `beneficial` | 门户、工作台、知识库、引导页、空态 | 有槽位就准备图片；没有槽位则跳过 |
| `none` | 表单、审批、财务、权限、设置、CRUD 台账、统计 | 跳过素材采集，使用图标、图表和排版 |

完整应用必须有设计槽位。设计缺失时交回 `yida-design` 补齐，不用空清单代替。多个图片位置使用不同的 `slotId`；`count > 1` 的展开规则见 [清单契约](references/manifest-contract.md)。

## 2. 检查当前能用的工具

运行 `openyida agent-capabilities --summary-json`，分别查看 `online_search`、`image_search`、`image_generation`。

- `unavailable`：跳过这项能力。
- `unknown` 或 `requires_host_tool_inventory_check=true`：检查当前宿主工具清单。
- `available`：使用实际存在的对应工具；若工具不存在，按不可用处理。CLI 的运行环境默认值不能代替工具调用结果。

没有搜图或生图能力时，使用用户已提供的素材；仍缺图就记录缺口，继续不依赖这些图片的页面。

## 3. 选图并查看

按以下顺序准备每个槽位：

1. 用户提供的本地图片或图片链接，记录 `source=user`。
2. 从 **Unsplash / Pexels** 搜索，记录 `source=search`。图库采集仅支持这两个网站。
3. 槽位允许生成、且宿主有生图工具时生成图片，记录 `source=generated`、`isIllustrative=true`。
4. 仍无合适图片时保留缺口。可用中性占位说明缺图，但不能把占位记为已完成素材。

查看实际图片，确认内容、比例、清晰度和主体位置适合槽位。商品、房源、人员、案例图片表达业务事实，不能用生成图冒充真实对象。

采集图库素材前读 [来源规则](references/source-policy.md)：图库图片保留来源页、摄影师、许可、署名和真实下载动作记录。只选择允许下载和转存的图片。不编造图片 URL、来源或下载记录。

## 4. 写草稿并上传

按 [清单契约](references/manifest-contract.md) 写 `manifest-draft.json`。每项填写 `slotId`、`input`、`source`、`alt` 和对应来源信息；尺寸由 CLI 实际读取，不靠手填宽高通过校验。

```bash
openyida asset resolve --input <草稿> --manifest <asset-manifest.json> --design <design.md> --app-type <真实appType> --json
```

上传前需要有效宜搭登录态和目标应用 `appType`。已有应用直接使用；尚未创建应用时先选图、保存草稿，等应用创建后再执行上传。不编造 appType。省略 `--app-type` 时 CLI 读取当前项目 `config.json.appType`。

默认按以下规则落地，不需要配置自有 CDN，也不需要加 `--upload-assets`：

1. **不超过 20 MiB（20 × 1024 × 1024 字节）**：外链先下载，本地图直接使用；通过宜搭 `ImageField` 附件上传，取得公开图片链接后直接写入清单，不再额外请求原图或上传地址做可用性校验。
2. **超过 20 MiB**：外链保留原始 `input` 链接，不上传。CLI 检查响应大小和实际下载大小；下载中超过限制立即停止并清理临时文件。
3. **大于限制的本地图**：没有原始外链可回退，保持 `draft`；补原始图片 URL 或换成较小图片。
4. **下载失败**：跳过该素材，不重试、不上传、不回退失败外链；记录缺口，需要时换图。登录或上传失败同样记录缺口，不把临时签名链接当公开链接。

`--design` 核对全部设计槽位、页面归属和最小尺寸。漏项自动成为缺口，重复或未声明的槽位会报错。格式和尺寸从本次下载内容读取，来源从草稿记录读取，不额外联网校验。

## 5. 处理结果和补图

- 退出码 `0`：本次清单为 `final` 或 `none`。
- 退出码 `2`、`ASSET_MATERIAL_NOT_FINAL`：清单已写入，但仍有缺口。读取 `gaps`，只修失败项；其他错误先修参数或输入文件。
- 缺原图就补 `input`，尺寸不够就换图，缺来源信息就补真实记录；不要手动改状态为 `final`。

修改上次清单中的失败项后重跑：

```bash
openyida asset resolve --input asset-manifest.json --manifest asset-manifest.json --design design.md --app-type <真实appType> --json
```

清单保留原始输入和尺寸要求。CLI 在原图内容未变时直接复用已有宜搭附件链接，不额外联网探测。更换素材时修改 `input`，不要只修改输出 `url`。`--offline` 不联网、不上传，离线处理的图片仍保持草稿。

## 6. 交给页面使用

读取 `pages[]` 中当前 `pageId` 的 `materialStatus`：

- `final`：当前页面可继续；只使用该页 `assets[]` 中 `materialStatus=final` 的图片 URL。
- `draft`：当前页面仍缺必需素材，先补图。
- `none`：当前页面没有图片槽位，直接继续。

根级 `materialStatus` 表示全部素材是否齐备。它是 `draft` 时，已为 `final` 的页面仍可继续。`required=false` 的槽位失败不阻塞页面，但该图片不能使用；采用设计允许的无图布局。

交付时说明：哪些页面已就绪、哪些页面缺图、每个缺口需要补什么。上传成功后，仍要确认图片内容适合页面。
