---
name: yida-cool-card
description: 仅在用户明确要求宜搭原生酷卡片（交互卡片、置顶卡片），或继续该上下文时使用。集团版不支持酷卡片搭建，先核对认证环境。提供创建、读取、查询模板、导出配置和样式设计。样式限于钉钉原生组件，不能运行任意 HTML/CSS/React；超出能力时说明限制并提供替代方案。返回官方编辑器链接，由用户配置保存；CLI 不保存、发布或发送。原生数据卡片、Canvas 展示卡片及泛称卡片不触发。
---

# 宜搭原生酷卡片

用户明确选择宜搭原生酷卡片（交互卡片、置顶卡片），或继续已明确的酷卡片上下文时使用。通用“卡片”“指标卡”“向群发送”不自动选择本能力，完整应用搭建也不自动创建酷卡片。

先按实际资源确认类型：

| 对象 | 标识和入口 | 处理方式 |
| --- | --- | --- |
| 原生酷卡片 | `cardPageCode`（如 `form...`）、`cardTemplateId`；`coolCardManage`；钉钉卡片编辑器 `scene=yida_card` | 本技能；`im` 交互卡片，`onebox` 置顶卡片 |
| 原生数据卡片 | `CARD-...`；`dataCardManage`、`dataCardDesigner.html?cardCode=...` | `yida-data-card`，独立数据集、图表、保存发布和播报 |
| 自定义页面的展示卡片 | 页面源码中的 React/Canvas 指标卡或卡片引用外层 | 页面开发、数据绑定或外观改造；不能因此修改源原生卡片 |

用户名称与链接不一致时说明链接的实际资源，核对目标后操作，不能将两个原生接口互换。ID 只是核对线索：数据卡片也引用 FORM 数据源，页面也可能引用 CARD。

## 操作

先用 `openyida login --check-only --json` 核对目标组织、用户和环境，再复用用户指定的应用。用户要求读取已有卡片时不新建；已有标识不明时先列出核对。

**集团版不支持酷卡片搭建。** 用户要求创建或搭建酷卡片时，先依据认证连接的实际 `baseUrl` 判断环境；复用 CLI 的环境识别语义，`alibaba` 为集团版（包括 `yida-group.alibaba-inc.com` 及已识别的内网宜搭环境）。已确认集团版时，直接告知“集团版不支持酷卡片搭建”，结束搭建流程，不创建应用或卡片、不查询模板或提供编辑器链接，也不引导安装 dws 绕过限制。环境不明时先查登录状态，不凭应用名称、组织名称或公有云付费版本猜测。CLI 的 `COOL_CARD_UNSUPPORTED_ENVIRONMENT` 同样按此处理。

```bash
openyida app-settings APP_XXX --section cool-card --json
openyida cool-card list APP_XXX --type im --json
openyida cool-card templates APP_XXX --type onebox --json
openyida cool-card create APP_XXX --type im --name '订单交互卡片' --json
openyida cool-card create APP_XXX --type onebox --name '订单群置顶卡片' --json
openyida cool-card get APP_XXX form真实标识 --out .cache/cool-card/snapshot.json --json
```

`list` 可省略类型查看全部；`templates` 必须指定类型，只查询模板目录，不会实例化模板。分页参数为 `--page`、`--size`，搜索为 `--search`。`get` 保留完整 `card.cardSchema`，另外解析 `template`、`editorData`、变量及组件类型；`--out` 导出带应用和卡片标识的完整快照，已有文件拒绝覆盖。不能把快照传给 `data-card save`。

`create` 只新建资源，回读校验应用、名称和类型。`readbackVerified=true` 只代表资源元数据回读成功；当平台尚未创建模板时返回 `completion=resource-only`、`schemaReadbackVerified=false` 及原始 `schemaReadbackError`，不把失败伪装成空配置。空壳不是卡片搭建完成，`configurationVerified`、`deliveryVerified` 均为 false。超时或创建后回读失败时先按 `cardPageCode` 或列表核查，不自动再次创建。

## 设计与默认视觉质量

用户要求设计、搭建效果或美化时，先读取 [默认设计、模板与数据契约](references/design.md)。优先选择匹配业务的信息布局与原生模板，结合头部、指标/循环区块、标签、富文本、折叠面板和真实动作；不把连续基础文本和大量背景框作为默认设计。组件按需要选，不以数量判断复杂度或美观。

用户要求“样式完全不一样”时，按以下规则处理：

- **原生组件能实现**：重做布局、配色和信息层级，不因用户说“自定义”就拒绝。
- **部分效果超出能力**：明确告知“受限于钉钉端内交互卡片的组件和样式能力，不能直接运行任意 HTML、CSS 或 React”，指出具体受限的效果，再提供原生近似设计、图片补充静态视觉、卡片链接打开独立页面等方案。
- **要求所有效果留在消息卡片内，原生组件又无法实现**：直接说明该部分效果无法实现，不承诺写代码或安装 dws 就能解决。

保留用户选择的原生卡片类型。改成静态图片或新增独立页面前，说明对展示和交互的影响；沿用用户已有的明确选择，没有授权时只提供方案。配置保存成功不代表自定义样式已生效，具体判断见 [代码与样式边界](references/configuration.md#代码与样式边界)。

## 交付链接，由用户配置保存

CLI 负责创建、读取、模板查询及返回链接；官方编辑器中的配置、模板选择和保存交给用户操作。`create/get` 返回 `nextAction`，包含操作人、入口及保存后的 `verificationCommand`。给用户输出可点击的 Markdown 链接，不只展示 JSON 字段或笼统地说“不支持”。

- 新建成功：使用 `nextAction.url` 提供“打开酷卡片编辑器”，说明“资源已创建，请在官方编辑器中配置并点击保存”。没有直接编辑器地址时，该字段退回当前租户的管理入口。
- 修改已有卡片：使用 `nextAction.url` 提供“打开酷卡片管理”，引导找到对应名称的卡片 → 编辑 → 配置 → 保存。平台的编辑操作会准备模板版本，不直接拿读取结果的旧模板链接代替该流程。
- 用户确认已保存后：执行返回的 `verificationCommand` 回读同一卡片的配置和状态；不重新创建。回读成功只证明配置可读，不证明发送或客户端效果已验收。
- 新建后模板暂不存在或为空：仍交付已验证资源的入口，明确“资源已创建，待用户配置保存”；不把这一状态说成配置失败后需要重建，也不宣称搭建完成。

`capabilities.save/publish/send=false` 表示 CLI 不执行这些操作，并不妨碍交付官方入口。链接不携带登录凭证；用户使用自己的平台登录态，服从官方权限和权益判断。无需为这个交付流程继续索取编辑器源码或额外申请权限。协议研究见 [配置协议与验证](references/configuration.md)。浏览器可用于接口分析及最终验收，不用浏览器拖拽后宣称完成 CLI 搭建。

## 可选外部 dws

钉钉 Workspace CLI 是独立产品，不是 OpenYida 内部模块，也不是当前酷卡片流程的必需依赖。用户需要钉钉侧卡片能力时，按 [外部工具安装与调用边界](references/configuration.md#外部-dws-安装与调用) 检查已有安装、给出官方安装指引及核对所需命令。不要把仓库、二进制、SDK 或整套 Skill 复制进 OpenYida，不在 OpenYida 安装脚本中静默安装、升级或改写 dws 的路径与登录配置。

只有命令确实支持目标模板及宜搭场景时，才能将它接入同一 `cardTemplateId` 的保存流程。现有 A2UI 的消息 `bizId` 更新不是模板保存；不能调用发送命令来替代保存验收。缺少所需能力时继续交付官方编辑器链接，不让用户安装 dws 后误以为就能自动保存宜搭模板。

权限和权益由服务端裁决，保留平台错误码和提示。禁止修改版本、额度、授权、应用标记、可见范围或官方卡片开关来绕过限制。数据卡片数量/播报权益不等于酷卡片权益，不复用其硬编码额度或角色矩阵。创建、保存、发布配置与实际发送分开授权；配置需求不等于允许给群或人员发测试消息。
