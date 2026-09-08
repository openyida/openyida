# 素材工作流：官网 / 品牌页的真实图片如何落地

> 图片需求与槽位由 `yida-design` 定义；需要素材时加载 `yida-image-assets`，再统一交给 `openyida asset resolve` 解析和回填。所有图片 URL 来自实际素材结果。

## 核心原则

1. **图片由宿主素材工具提供**：使用宿主图片生成能力，或只从 Unsplash/Pexels 搜索采集图片；`openyida ai` 继续提供文生文和识图能力。
2. **素材统一解析**：本地文件和外链都交给 `openyida asset resolve`；搜索素材使用 `--source search`，用户有权使用的自带外链使用 `--source user`。
3. **区分生产交付与离线展示**：CDN 上传成功后记录生产 URL；离线展示可使用受控压缩的 JPEG/WebP data URI，并保持 draft 状态。
4. **素材缺口保持可见**：用文字排版、数据图示或插画承接页面，并在交付说明中记录缺口。

## 执行流程

1. 运行 `openyida agent-capabilities --summary-json` 和 `openyida asset status --json`，读取独立的在线搜索、图片搜索和图片生成三态能力；能力结论以本轮宿主工具清单或显式声明为准。
2. 执行 `yida-image-assets`，由智能体使用本轮真实可用的宿主工具生成图片，或将图片检索域限定为 Unsplash/Pexels，并记录来源元数据。
3. 使用 `openyida asset resolve` 处理本地文件或外链，并回填 `spec.assets`。
4. 根据结果将 `materialStatus` 设为 `final`、`draft` 或 `none`；素材不足时保留草稿标记。

## 命令速查

| 子命令 | 作用 | 关键参数 |
|---|---|---|
| `openyida asset status` | 检测 CDN、上传和素材生成能力 | `--online`、`--json` |
| `openyida asset resolve` | 解析本地或外链素材，按来源白名单校验并回填 | `--hero <url\|path>`、`--product <url\|path>`、`--source search\|user`、`--require-hero`、`--upload-assets`、`--offline`、`--json` |
| `openyida asset generate` | 输出素材来源引导和免费素材库清单 | `--json` |

## 示例

有 CDN 时：

```bash
openyida asset status --json
openyida asset resolve --hero ./hero.webp --upload-assets --json
```

使用 Pexels 搜索结果时（同时在 manifest 记录来源与授权）：

```bash
openyida asset resolve --hero "https://images.pexels.com/photos/123/example.jpg" --source search --json
```

使用用户明确提供并确认有权使用的外链时：

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
