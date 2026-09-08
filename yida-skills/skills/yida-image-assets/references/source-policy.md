# 图片来源与落地规则

选定来源时读取。许可和 API 条款可能变化；实际集成或上线前重新核对来源官方条款。

| 来源 | 搜索/使用规则 | 页面落地 |
| --- | --- | --- |
| 用户提供 | 确认用户有权使用；保留原始文件与用途说明 | 优先上传项目 CDN；不改变真实商品/人物含义 |
| Agent 生成 | 仅用于背景、抽象视觉、空态和明确的示意图；记录提示词摘要和生成工具 | 保存本地文件，查看质量后通过 `asset resolve` 上传；标记 `isIllustrative=true` |
| Unsplash API | 使用 API 返回的 `photo.urls` 热链；显示摄影师和 Unsplash 署名；用户选用图片时请求 `download_location` | 保留官方热链，直接交给 `asset resolve` 校验 |
| Pexels API | API 请求需要服务端或宿主安全持有 Key；搜索结果显著链接 Pexels，并尽可能署名摄影师 | 可按当前官方条款使用返回图片；记录摄影师与来源页，Key 不进入页面 |

## 通用门禁

- 每项素材记录 `provider/sourcePage/creator/license/attribution`，并按当前官方条款使用。
- 自动搜索与采集使用 `source=search`，只接受 `provider=unsplash|pexels`；其他第三方图库不进入候选集。
- 用户明确提供并确认有权使用的外链可使用 `openyida asset resolve --source user`，并记录授权依据。
- 通过官方 API 或来源页获取素材，生产 URL 使用来源允许的稳定地址。
- 品牌、人物和敏感场景素材保留清晰的授权与真实关系说明。
- 背景图必须检查文字区域对比度；商品图优先 `contain`，摄影场景图通常使用 `cover` 并记录焦点位置。
- 外部 URL 通过 `openyida asset resolve` 验证来源和可达性；需要自托管时以 CDN URL 作为 final 交付条件。
