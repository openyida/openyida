# Landing 素材工作流

官网页需要真实视觉素材。优先顺序：

1. 用户提供素材。
2. 已有官网/品牌图，验证可访问。
3. 智能体生成图片，若有 CDN 配置则上传。
4. 免费可商用图库直链，验证后使用。
5. 无素材时降级为草稿并标注缺口。

## 写入 spec

```json
{
  "assets": {
    "heroImage": "https://...",
    "heroImageAlt": "品牌主视觉",
    "productImages": [
      { "url": "https://...", "alt": "明星产品" }
    ]
  }
}
```

没有 `heroImage` 的强视觉官网只能算低保真草稿。
