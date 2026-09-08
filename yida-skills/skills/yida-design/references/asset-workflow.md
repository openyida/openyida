# 图片素材落地

`yida-design` 定义页面等级和槽位，`yida-image-assets` 准备素材，`asset resolve` 生成清单。

## 规则

1. 先用用户素材，再从 Unsplash/Pexels 搜图，仍有缺口时使用宿主生图。
2. 图片统一写入 manifest 草稿并通过 `asset resolve`。
3. `final` 可用于页面；`draft` 表示有缺口；`none` 表示无需图片。

## 命令

| 命令 | 作用 |
| --- | --- |
| `openyida asset status --json` | 检测宿主和 CDN 能力 |
| `openyida asset sources --json` | 查看来源规则 |
| `openyida asset resolve --input <草稿> --manifest <清单> --json` | 校验全部槽位并写清单 |
| `openyida asset resolve --slot <slotId>=<路径或URL> --json` | 快速检查单个槽位 |

`--offline` 禁止外链校验和上传。`--upload-assets` 只转存允许自托管的素材，Unsplash API 图片始终保留热链。
