# 图片来源与落地规则

选图时使用；上线前核对官方条款。

| 来源 | 搜索/使用规则 | 页面落地 |
| --- | --- | --- |
| 用户提供 | 确认使用权，保留用途说明 | 本地图直接上传宜搭附件；授权外链下载后上传，不改变真实对象含义 |
| Agent 生成 | 用于背景、抽象视觉、空态和示意图 | 查看后上传；标记 `isIllustrative=true` |
| [Unsplash API](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines) | 保留署名；API 选用时请求 `download_location`，遵守对应获取方式的使用条款 | 选取允许下载和转存的素材，再上传宜搭附件 |
| [Pexels API](https://www.pexels.com/api/documentation/) | 保留 Pexels 链接，尽可能署名摄影师 | 下载后上传宜搭附件 |

## 通用门禁

- 记录 `provider/sourcePage/creator/license/attribution`；Unsplash 另记 `downloadLocation/downloadTracked`。
- 搜索素材使用 `source=search`，只接受 `provider=unsplash|pexels`；用户授权外链使用 `--source user`。
- 品牌、人物和敏感场景记录授权与真实关系。
- 背景图检查文字对比度；商品图用 `contain`；场景图用 `cover` 并记录焦点。
- 默认上传宜搭图片附件；外链超过 20 MiB 才保留原链接。下载失败直接跳过并记录缺口；上传失败保持草稿。
- API 或具体授权要求热链且不允许转存时，改选允许转存的素材；不要把更换托管地址当作取得授权。
