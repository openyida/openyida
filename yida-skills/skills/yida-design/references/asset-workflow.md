# 图片素材落地

`yida-design` 定义页面等级和槽位，`yida-image-assets` 准备素材，`asset resolve` 生成清单。

## 规则

方案确认后与应用、表单及无图页面同时推进，各页及同页图片位置并发搜索；每个位置一张图、最多两轮；第二轮只补失败的必需位置。各页通过 `--page-id` 写入独立的 `asset-manifests/<pageId>.json`，就绪后立即交给页面开发。

1. 先用用户素材，再从 Unsplash/Pexels 搜图，仍有缺口时使用宿主生图。
2. 图片统一写入 manifest 草稿并通过 `asset resolve`。
3. 按 `pages[].materialStatus` 判断当前页：`final` 可继续，`draft` 要补必需素材，`none` 无需图片。只使用该页 `assets[].materialStatus=final` 的 URL；总状态 `draft` 不阻塞其他页面。

## 命令

| 命令 | 作用 |
| --- | --- |
| `openyida asset status --json` | 检测宿主和 CDN 能力 |
| `openyida asset sources --json` | 查看来源规则 |
| `openyida asset resolve --input <草稿> --manifest <页面清单> --design <design.md> --page-id <pageId> --json` | 并发处理当前页槽位并写清单 |
| `openyida asset resolve --slot <slotId>=<路径或URL> --json` | 快速检查单个槽位 |

`--offline` 仅做离线检查；默认上传宜搭附件，`--upload-assets` 兼容旧命令。尺寸和来源规则见 [素材技能](../../yida-image-assets/SKILL.md)。
