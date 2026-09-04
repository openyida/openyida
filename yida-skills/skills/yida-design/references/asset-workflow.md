# 素材工作流：官网 / 品牌页的真实图片如何落地

> 官网、品牌首页、活动落地页需要真实产品或场景图时，由智能体准备素材，再统一交给 `openyida asset resolve` 解析和回填。绝不编造图片 URL。

## 核心原则

1. **图片由智能体来源，不由 CLI 凭空生成**：`openyida ai` 只有文生文 / 识图，没有文生图。图片可以由智能体生成，也可以从免费可商用素材库获取。
2. **素材统一解析**：本地文件和外链都交给 `openyida asset resolve`；已配置 CDN 时可转存为稳定 URL。
3. **区分生产交付与离线展示**：没有 CDN 时不得声称素材已经上传；离线展示可使用受控压缩的 JPEG/WebP data URI，但不能把它当作生产资源方案。
4. **没有素材就诚实标注草稿**：用文字排版、数据图示或插画替代，并在交付说明中标注素材缺口。

## 执行流程

1. 运行 `openyida asset status --json`，了解当前素材能力。
2. 由智能体生成本地图片，或从 Unsplash、Pexels、Pixabay、unDraw 等免费可商用素材库取得图片直链。
3. 使用 `openyida asset resolve` 处理本地文件或外链，并回填 `spec.assets`。
4. 根据结果将 `materialStatus` 设为 `final`、`draft` 或 `none`；素材不足时保留草稿标记。

## 命令速查

| 子命令 | 作用 | 关键参数 |
|---|---|---|
| `openyida asset status` | 检测 CDN、上传和素材生成能力 | `--online`、`--json` |
| `openyida asset resolve` | 解析本地或外链素材，按能力转存并回填 | `--hero <url\|path>`、`--product <url\|path>`、`--require-hero`、`--upload-assets`、`--offline`、`--json` |
| `openyida asset generate` | 输出素材来源引导和免费素材库清单 | `--json` |

## 示例

有 CDN 时：

```bash
openyida asset status --json
openyida asset resolve --hero ./hero.webp --upload-assets --json
```

使用外链时：

```bash
openyida asset resolve --hero "https://images.unsplash.com/photo-xxxx" --json
```

暂无素材时：

```bash
openyida asset resolve --offline --require-hero --json
```

## 设计落地

真实图片应服务于品牌叙事，而不是只填充 Hero。强视觉官网通常需要场景、产品或服务、过程或空间三类素材。完整策略写入当前项目的 `design.md.assetStrategy`。

**严禁事项**：应用主题只在应用级配置，严禁页面代码向原生页面、父页面或平台容器写入主题样式。`YidaCodeCanvas` 的页面背景只在 `YidaComp` 内按 `design.md` 实现并消费应用 token。

## 离线展示

- 建议仅内嵌 3–5 张关键图，长边约 1600–2000 px、质量 70–82。
- 单张尽量不超过 250 KB，图片总量尽量不超过 800 KB。
- 发布前检查源码与 `runtimeCode` 体积。
- 生产项目应迁移到 CDN，禁止把所有图片都转成 base64。
