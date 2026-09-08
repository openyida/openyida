---
name: yida-image-assets
description: >
  按页面判断宜搭图片需求，检查 Agent 素材能力，准备并验证图片，输出可追溯的素材清单。
---

# yida-image-assets

读取 `design.md.assetStrategy`，准备图片并写入 `prd/<项目名>/asset-manifest.json`。不修改业务和视觉方案。

## 适用分级

按页面用途确定素材等级：

| 等级 | 页面或系统特征 | 默认动作 |
| --- | --- | --- |
| `required` | 品牌、营销、商品目录、菜单、封面、作品和场景展示页 | 准备素材；缺口保持 `draft` |
| `beneficial` | 门户、工作台、档案、知识库、引导页和空态 | 有图片槽位时准备素材 |
| `none` | 表单、审批、财务、权限、设置、CRUD 台账和统计页 | 使用图标、图表和排版 |

商品、房源、人员和案例图属于业务事实。使用可验证的真实素材；生成图标记为示意图。

## 工作流

1. 读取页面等级和图片槽位。
2. 运行 `openyida agent-capabilities --summary-json`。能力为 `unknown` 或 `requires_host_tool_inventory_check=true` 时，检查当前宿主工具。
3. 按“用户素材 → Unsplash/Pexels → 宿主生成 → 中性占位”准备图片。
4. 比较候选图，查看图片及来源信息。来源规则见 [source-policy.md](references/source-policy.md)。
5. 按 [manifest-contract.md](references/manifest-contract.md) 写草稿，再运行 `openyida asset resolve --input <草稿> --manifest <asset-manifest.json> --json`。
6. 仅当 `materialStatus=final` 时，页面才使用 manifest 中的图片。

## 能力判断

- `online_search`、`image_search`、`image_generation` 分别使用 `available`、`unavailable`、`unknown`。
- 非 cloud 宿主默认可联网和搜图；`qwenwork` 默认可生成图片。
- 显式环境声明优先。`unknown` 时检查宿主工具；仍无法确认则按 `unavailable` 处理。
- API Key 只存于宿主安全凭据。

## 输出契约

- 根字段：`schemaVersion`、`materialStatus`、`capabilityEvidence`、`assets`、`gaps`。
- 素材字段：`slotId`、`usage`、`url/localPath`、`source`、`provider`、`sourcePage`、`creator`、`license`、`attribution`、`width/height`、`alt`、`isIllustrative`。
- Unsplash API 素材还要记录 `downloadLocation` 和 `downloadTracked`。
- `source=search` 时，`provider` 只允许 `unsplash|pexels`。
- manifest 不记录密钥和宿主内部参数。

## 完成条件

- 页面分级和能力证据完整。
- 图片已查看并通过来源、URL 和尺寸检查。
- manifest 字段完整，图库来源仅为 Unsplash/Pexels。
- 有槽位缺口时保持 `draft`；无图片需求时使用 `none`。
