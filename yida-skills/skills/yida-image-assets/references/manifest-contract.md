# 素材清单契约

草稿包含 `assets` 数组。每项至少写清槽位、用途、输入、来源和替代文本：

```json
{
  "assets": [{
    "slotId": "home.hero",
    "usage": "hero",
    "input": "https://images.pexels.com/photos/123/example.jpeg",
    "source": "search",
    "provider": "pexels",
    "sourcePage": "https://www.pexels.com/photo/example-123/",
    "creator": "摄影师名称",
    "license": "Pexels License",
    "attribution": "Photo by 摄影师名称 on Pexels",
    "alt": "首页主视觉",
    "minSize": "1600x900"
  }]
}
```

运行：

```bash
openyida asset resolve --input manifest-draft.json --manifest asset-manifest.json --json
```

快速检查单个槽位可用 `--slot home.hero=<路径或URL>`；缺少来源元数据时结果保持 `draft`。
