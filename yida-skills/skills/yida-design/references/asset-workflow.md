# 图片素材落地

> `yida-design` 定义槽位，`yida-image-assets` 准备素材，`asset resolve` 负责校验。

## 核心原则

1. 使用宿主生图工具，或只从 Unsplash/Pexels 搜图。
2. 本地图和外链都经过 `asset resolve`。
3. 只有稳定 URL 可标记 `final`；其余保持 `draft/none`。

## 执行流程

1. 运行 `agent-capabilities --summary-json` 和 `asset status --json`。
2. 执行 `yida-image-assets`，准备图片并记录来源。
3. 使用 `asset resolve` 校验和回填。
4. 按结果设置 `materialStatus`。

## 命令速查

| 子命令 | 作用 | 关键参数 |
|---|---|---|
| `openyida asset status` | 检测素材能力 | `--offline`、`--json` |
| `openyida asset resolve` | 校验并回填图片 | `--hero <url\|path>`、`--product <url\|path>`、`--source search\|user`、`--require-hero`、`--upload-assets`、`--offline`、`--json` |
| `openyida asset generate` | 输出素材来源引导和免费素材库清单 | `--json` |

## 示例

有 CDN 时：

```bash
openyida asset status --json
openyida asset resolve --hero ./hero.webp --upload-assets --json
```

Pexels 搜索图：

```bash
openyida asset resolve --hero "https://images.pexels.com/photos/123/example.jpg" --source search --json
```

用户授权外链：

```bash
openyida asset resolve --hero "https://assets.example.com/authorized-photo.jpg" --source user --json
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
