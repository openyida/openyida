# 图片来源与落地规则

选图时使用；上线前核对官方条款。

| 来源 | 搜索/使用规则 | 页面落地 |
| --- | --- | --- |
| 用户提供 | 确认使用权，保留用途说明 | 上传项目 CDN，不改变真实对象含义 |
| Agent 生成 | 用于背景、抽象视觉、空态和示意图 | 查看后上传；标记 `isIllustrative=true` |
| Unsplash API | 使用 API 热链，记录摄影师和署名；选用时请求 `download_location` | 保留官方热链并校验 |
| Pexels API | Key 由宿主安全保管；记录摄影师和来源页 | 按官方条款使用并校验 |

## 通用门禁

- 记录 `provider/sourcePage/creator/license/attribution`。
- 搜索素材使用 `source=search`，只接受 `provider=unsplash|pexels`；用户授权外链使用 `--source user`。
- 品牌、人物和敏感场景记录授权与真实关系。
- 背景图检查文字对比度；商品图用 `contain`；场景图用 `cover` 并记录焦点。
- 外链通过 `asset resolve` 校验；需要自托管时以 CDN URL 交付。
