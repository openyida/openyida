# 图片来源与落地规则

选图时使用；上线前核对官方条款。

| 来源 | 搜索/使用规则 | 页面落地 |
| --- | --- | --- |
| 用户提供 | 确认使用权，保留用途说明 | 上传项目 CDN，不改变真实对象含义 |
| Agent 生成 | 用于背景、抽象视觉、空态和示意图 | 查看后上传；标记 `isIllustrative=true` |
| [Unsplash API](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines) | 使用 API 热链并署名；选用时请求 `download_location` | 保留官方热链 |
| [Pexels API](https://www.pexels.com/api/documentation/) | 保留 Pexels 链接，尽可能署名摄影师 | 校验后使用或转存 |

## 通用门禁

- 记录 `provider/sourcePage/creator/license/attribution`；Unsplash 另记 `downloadLocation/downloadTracked`。
- 搜索素材使用 `source=search`，只接受 `provider=unsplash|pexels`；用户授权外链使用 `--source user`。
- 品牌、人物和敏感场景记录授权与真实关系。
- 背景图检查文字对比度；商品图用 `contain`；场景图用 `cover` 并记录焦点。
- Unsplash 保留 API 热链；其他已授权素材需要稳定托管时上传 CDN。
