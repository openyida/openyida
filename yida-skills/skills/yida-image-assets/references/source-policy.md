# 图片来源规则

采集前核对来源的使用条件，优先选允许外链展示的图片；需要托管时选允许转存的图片。

| 来源 | 记录与使用 |
| --- | --- |
| 用户图片 | 保留用途和授权信息 |
| 生成图片 | 用于背景、空态、示意图，查看后标记 isIllustrative=true |
| [Unsplash API](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines) | 使用 API 返回的 photo.urls 图片直链并保留署名，实际请求 download_location 后记录选用动作 |
| [Pexels API](https://www.pexels.com/api/documentation/) | 使用 API 返回的图片直链，保留来源页和摄影师署名 |

搜索图片填写 `source=search`、`provider=unsplash|pexels`，记录 sourcePage、creator、license、attribution；Unsplash 另记 downloadLocation、downloadTracked。用户外链使用 source=user。

失败来源按 [失败后立即切换](../SKILL.md#失败后立即切换) 记录，所有页面共用。换来源、恢复服务仍计入两轮上限。

查看实际图片：背景保证文字清晰，商品图用 contain，场景图用 cover 并确认主体位置；品牌、人物和真实业务对象保留授权及真实关系。

链接检查和上传见 [清单契约](manifest-contract.md#链接检查与上传)。Unsplash API 图片按[官方规则](https://help.unsplash.com/en/articles/2511271-guideline-hotlinking-images)直接展示；另行获得转存许可时才填写 `rehostAllowed=true`。用户和生成的外链，核实允许公开展示且地址长期可用后填写 `hotlinkAllowed=true`；仅允许转存时填写 `hotlinkAllowed=false`，明确禁止转存时填写 `rehostAllowed=false`。
