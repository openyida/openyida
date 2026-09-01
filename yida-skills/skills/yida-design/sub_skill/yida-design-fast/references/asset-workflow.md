# 素材工作流：官网 / 品牌页的真实图片如何落地

> 官网、品牌首页、活动落地页需要**大 Hero 图和真实产品/场景图**才好看。但绝不能编造图片 URL。
> 本文档告诉本地智能体（Claude / 千问办公等）：**怎么拿到真实图片、怎么校验、怎么回填进页面**，以及拿不到时怎么诚实标注草稿。

---

## 核心原则（先记住）

1. **图片由智能体来源，不由 CLI 凭空生成**：`openyida ai` 只有文生文 / 识图，**没有文生图**。图片要么你自己生成，要么去免费素材库检索真实图片。
2. **未经校验的 URL 不得写进页面**：任何候选图片 URL 必须先过 `openyida asset verify-url` 确认真实可达且确为图片。
3. **区分生产交付与离线展示**：生产页面没有 CDN 时只能用已校验外链或**标注缺口的草稿**，不能假装“已上传”；离线展示为了原样发布稳定，可使用受控压缩的 JPEG/WebP data URI，但必须遵守本文的体积上限，且不能把这种方式当作生产资源方案。
4. **拿不到素材就诚实标注草稿**：既不能生成又找不到可校验素材时，用文字排版 / 数据图示 / 插画替代，并在交付说明里标注"素材缺口"，页面会自动打上「素材草稿」水印。

---

## 决策与执行流程

```
需要真实图片？（官网 Hero / 产品图 / 场景图 → 是）
        │
        ▼
┌───────────────────────────────────────────────┐
│ Step 0  openyida asset status                  │  ← 看 CDN 是否可用、推荐策略
├───────────────────────────────────────────────┤
│ Step 1  取图（二选一）                          │
│   A. 你自己能生成图片 → 生成并存本地             │
│   B. 到免费可商用素材库检索真实图片直链          │
│      （Unsplash / Pexels / Pixabay / unDraw）   │
├───────────────────────────────────────────────┤
│ Step 2  openyida asset verify-url <url>        │  ← 每个候选都要校验，只留 ok=true
├───────────────────────────────────────────────┤
│ Step 3  写进 spec.assets（heroImage/productImages）│
├───────────────────────────────────────────────┤
│ Step 4  页面实现时回填 + 定级：                  │
│   校验素材并写回 spec / 页面源码                  │
│   （有 CDN 时转存稳定 URL）                       │
└───────────────────────────────────────────────┘
        │
        ▼
materialStatus = final | draft | none
   final → 可对外交付             （有 Hero 且素材已校验/上传）
   draft → 页面带「素材草稿」水印   （部分素材缺口）
   none  → 官网无 Hero 素材        （必须补素材或标注为文字主导草稿）
```

---

## 命令速查（`openyida asset`）

| 子命令 | 作用 | 关键参数 |
|---|---|---|
| `openyida asset status` | 检测 CDN 是否配置、能否上传、推荐素材策略 | `--online`（若走线上实例）`--json` |
| `openyida asset verify-url <url>` | 校验单个图片 URL 真实可达且为图片 | `--min-bytes` `--timeout` `--json`；任一失败退出码 1 |
| `openyida asset resolve` | 解析 hero/product 候选 → 校验外链 / 上传本地 → 回填并定级 | `--hero <url\|path>` `--product <url\|path>`（可重复）`--require-hero` `--upload`(需 CDN) `--offline` `--json`；`materialStatus!=final` 退出码 2 |
| `openyida asset generate` | 输出素材来源引导（免费库清单 + 纪律），检测生成能力 | `--json` |

> 页面实现阶段复用同一套回填口径：先校验候选素材，能上传 CDN 时转存稳定 URL，离线展示只做非网络的轻量定级。

---

## 免费可商用素材库（优先从这里取真实图片）

| 库 | 授权 | 最适合 | 图片直链形态 |
|---|---|---|---|
| **Unsplash** | 免费可商用，无需署名 | 摄影级 Hero 大图、生活方式/场景图 | `images.unsplash.com/photo-...` |
| **Pexels** | 免费可商用，无需署名 | 产品/办公/团队/自然主题图与短视频 | `images.pexels.com/photos/...` |
| **Pixabay** | 免费可商用 | 插画/矢量/照片综合库 | `cdn.pixabay.com/photo/...` |
| **unDraw** | 免费可商用，可改色 | 扁平品牌插画、空状态/引导插画（SVG 可着色） | 导出 SVG 或官方 CDN SVG 直链 |

**取图纪律**：拿到的必须是**图片直链**（能直接放进 `<img src>`），不是页面链接；直链拿到后立即 `openyida asset verify-url` 校验；授权不确定就改用 unDraw 插画或文字/数据图示替代。

---

## 典型用法示例

### 1. 有 CDN，走完整"最终版"链路
```bash
openyida asset status --json                     # 确认 cdnConfigured / canUpload
openyida asset verify-url "https://images.unsplash.com/photo-xxxx"   # 校验
openyida asset resolve --hero "https://images.unsplash.com/photo-xxxx" --upload --json  # 校验+上传+回填→final
```

### 2. 无 CDN，用已校验外链交付（可接受，但非"已上传"）
```bash
openyida asset verify-url "https://images.unsplash.com/photo-xxxx"
openyida asset resolve --hero "https://images.unsplash.com/photo-xxxx" --json           # 外链校验通过→final（未上传）
```

### 3. 暂无素材，诚实标注草稿
```bash
openyida asset resolve --offline --require-hero --json                  # 官网无 hero → materialStatus=none/draft
# 页面自动带「素材草稿·待接入真实图片」水印；交付说明须标注素材缺口，不得声称最终版
```

---

## 与去 AI 味的关系

有了这套工作流，官网**默认就应该做大 Hero + 真实图片**——这不再与"禁编造图"冲突。
「没有真实素材时用文字排版/数据图示替代」只是素材缺口处理方式，不是首选：先跑素材工作流拿真实图片，确实拿不到才标注草稿，且必须说明缺口。

真实图片也不能只解决 Hero：强视觉官网至少需要“场景 Hero + 产品/服务 + 过程/空间”三类素材组成一条可理解的品牌故事。完整方法写入当前项目 `design.md.assetStrategy`。

## 离线展示的无 CDN 方案

离线展示应用没有 CDN、但需要保证源码原样发布后图片稳定时，可内嵌压缩后的 JPEG/WebP data URI：

- 建议 3-5 张关键图，长边约 1600-2000 px、质量 70-82。
- 单张尽量不超过 250 KB，图片总量尽量不超过 800 KB。
- 发布前检查源码与 `runtimeCode` 体积，接受 CLI 的大文件提示但不能超过宜搭 Schema 可稳定发布的范围。
- 生产项目应迁移到 CDN；禁止把 data URI 规则扩展成“所有图片都 base64”。
