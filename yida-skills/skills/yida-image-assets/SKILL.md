---
name: yida-image-assets
description: >
  评估宜搭页面的图片素材需求，并为品牌展示、营销活动、商品目录、内容封面及用户指定的搜图或生图任务，
  准备可追溯的 Hero、背景、商品、场景、封面和空态素材。
---

# yida-image-assets

读取 `prd.md` 与 `design.md` 中已确定的页面和素材槽位，检查当前 Agent 的真实工具能力，获取或生成素材，并写入内部 `prd/<项目名>/asset-manifest.json` 供页面实现消费。业务规划与视觉设计继续由对应技能维护，本技能聚焦图片素材交付。

## 适用分级

按页面用途确定素材等级：

| 等级 | 页面或系统特征 | 默认动作 |
| --- | --- | --- |
| `required` | 品牌官网、活动/营销落地页、旅游/酒店/餐饮/地产展示、作品集、案例展示、商品目录、菜单、课程封面、资讯封面、空间/车辆/设备图库 | 加载本技能；素材就绪后进入页面实现，素材缺口记录为 draft |
| `beneficial` | 门户、工作台、客户/员工档案、知识库、项目展示、数据故事、引导页和空态；图片能明显提高辨识度但不是完成业务的前提 | 设计明确了图片槽位时加载；否则使用图标、图表或排版 |
| `none` | 纯表单、审批流、财务记账、权限设置、系统配置、普通 CRUD 台账、工单列表、库存流水、内部统计表 | 使用图标、图表、数据和排版完成页面；出现明确图片槽位时重新分级 |

商品、房源、人员、客户案例等代表真实对象的图片属于业务事实。优先使用用户提供或来源可验证的真实素材；生成素材统一标记为“示意图/待补图”。

## 工作流

1. 读取 PRD 页面场景与 `design.md.assetStrategy`，逐页列出 `slotId`、用途、数量、比例、最小尺寸、主体位置、文字安全区、`object-fit`、是否允许生成图。
2. 运行 `openyida agent-capabilities --summary-json`，读取 `asset_capabilities`。显式能力声明优先于运行时默认值；若能力为 `unknown`，检查当前宿主实际可调用工具。
3. 按“用户已有素材 → Unsplash/Pexels 图片搜索 → 宿主图片生成 → 中性占位”的顺序选择来源。自动图片采集仅使用 Unsplash 与 Pexels；真实人物、商品、房源、证件和案例使用来源可验证的真实素材。
4. 搜索时从业务、对象、场景、构图、色调和留白方向生成查询词；每个关键槽位比较候选图，实际查看图片及来源元数据后再选择。
5. 使用图库或外链时读取 [来源与落地规则](references/source-policy.md)。宿主图片搜索必须限定到 Unsplash/Pexels 官方来源，不使用其他第三方图库结果。
6. Unsplash/Pexels 搜索图交给默认的 `openyida asset resolve --source search`；用户明确提供并确认有权使用的外链使用 `--source user`；本地生成图直接解析。Unsplash API 图保留官方热链并记录选用动作。
7. 写入 `asset-manifest.json`，再把 `design.md.assetStrategy.materialStatus` 和缺口同步为真实状态。只有相关必需槽位全部可用时才是 `final`。

## 能力判断

`asset_capabilities.online_search`、`image_search`、`image_generation` 都是独立三态：`available`、`unavailable`、`unknown`。

当 `asset_capabilities.requires_host_tool_inventory_check=true` 时，必须查看本轮宿主工具清单后再决定；这不是能力不可用的结论。

- `host.class=non_cloud`：默认具备联网搜索与图片搜索能力，可直接进入素材检索。
- `host.tool=qwenwork`：默认具备图片生成能力；生成后查看结果并经过 `asset resolve`。
- `image_search=available`：可以使用宿主的图片搜索工具。
- 只有 `online_search=available`：用于查询官网和授权说明；取得真实候选图片和来源元数据后再进入选图。
- `image_generation=available`：只为允许生成的槽位生成本地图片；生成后仍需查看结果并经过 `asset resolve`。
- cloud 或无法识别的运行时能力为 `unknown` 时，检查本轮工具清单；仍无法确认就按 unavailable 降级。
- `agent_browser=true` 只描述浏览器交互能力；素材能力使用显式声明、上述运行时默认值或本轮工具清单。

宿主可通过 `OPENYIDA_AGENT_ONLINE_SEARCH`、`OPENYIDA_AGENT_IMAGE_SEARCH`、`OPENYIDA_AGENT_IMAGE_GENERATION` 覆盖运行时默认值；值为 `1/true/available` 或 `0/false/unavailable`。API Key 保存在宿主安全凭据环境中。

## 输出契约

`asset-manifest.json` 至少包含：

```json
{
  "schemaVersion": 1,
  "materialStatus": "final",
  "capabilityEvidence": {
    "onlineSearch": {"status": "available", "source": "host_tool_inventory", "tool": "web.search_query"},
    "imageSearch": {"status": "available", "source": "host_tool_inventory", "tool": "web.image_query"},
    "imageGeneration": {"status": "unavailable", "source": "host_tool_inventory"}
  },
  "assets": [
    {
      "slotId": "home.hero",
      "usage": "hero",
      "url": "https://...",
      "localPath": null,
      "source": "user|search|generated|placeholder",
      "provider": "unsplash|pexels",
      "sourcePage": "https://...",
      "creator": "...",
      "license": "...",
      "attribution": "...",
      "width": 1920,
      "height": 1080,
      "alt": "...",
      "isIllustrative": false
    }
  ],
  "gaps": []
}
```

manifest、页面源码和 `design.md` 只记录能力证据与公开来源元数据；密钥、下载凭据和宿主内部工具参数保存在宿主安全环境中。

## 完成条件

- 每个触发页面都得到 `required/beneficial/none` 判定。
- 能力结论包含本轮宿主工具或显式声明证据。
- 已选图片经过实际查看、URL 校验与来源规则检查。
- `source=search` 的每项素材都来自 Unsplash 或 Pexels，且 `provider` 与来源页一致。
- manifest 的 URL、替代文本、来源、授权、尺寸与示意图标记完整。
- 必需槽位有缺口时状态保持 `draft/none`，占位图保留清晰的示意标记。
