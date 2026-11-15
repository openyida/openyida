---
name: yida-create-portal
description: 创建或配置宜搭原生门户。仅在用户明确选择宜搭原生门户、明确排除用自定义页面开发门户，或继续维护已确认的原生门户时使用。
---

# 宜搭原生门户

明确目标应用、页面名称和创建意图。先查询是否已有匹配的原生门户，已有目标时用 `portal inspect` 读取并复用。用户说“做一个门户”“创建首页”或“搭一个工作台”，以及明确要求用自定义页面实现门户时，走 `use_skill("yida-create-page", "创建自定义门户页面")` 和 Canvas 开发。

```bash
openyida create-portal <appType> "<pageName>" [--locale zh_CN|en_US|ja_JP] [--open|--no-open]
```

创建后回读 `formType=portal`，输出 `pageId`、`readbackVerified`、`designerUrl` 和 `workbenchUrl`。记录真实 `pageId`，在 `designerUrl` 编辑和发布。遇到 `CREATE_PAGE_PORTAL_NOT_VERIFIED` 时，使用输出的 `recovery` 核对已创建页面，避免重复新建。

按[原生门户组件与磁贴布局](references/native-portal.md)用 `portal inspect` 读取磁贴和版本，并用 `portal configure` 配置组件、数据绑定和双端布局。在设计器和工作台检查实际显示及权限。

### 原生门户沿用应用主题

- 门户首屏优先展示来自已发布数据卡片的业务指标，再配快捷入口和经营提示。按[看板布局](../yida-dashboard/references/structure-and-layout.md#多卡页面排布)组织指标、主分析、快捷入口，手机按相同顺序纵向排列。指标卡设为「跟随门户主题」，发布后核对真实数值、入口跳转及双端顺序。

- 开发前读取目标应用的主题模式、品牌色和已启用的主题 CSS。可在应用主题设置中查看，或使用 `openyida app-theme snapshot <appType> --output-dir <new-dir> --json` 只读获取应用主题配置和 CSS。
- 应用已启用新版主题样式时，以现有应用配色为准。在门户设计器中将支持绑定的属性设为「跟随主题」，使用 `--color-brand1-6` 作为强调色，页面底色和背景图使用 `--pod-page-bg-color`、`--pod-page-bg-image`，卡片底色和圆角使用 `--pod-card-bg-color`、`--pod-card-border-radius`。布局和间距沿用应用主题值。
- 新版样式由 `isUseNewAppThemeStyle()` 决定，应用仍是旧版主题但启用了 Pod Premium 时也走新版样式。保留既有门户的自定义值，移动端页边距跟随 `--pod-page-mobile-margin`。在门户设计器核对可用绑定，再分别检查 PC 和移动端的品牌色、背景和卡片文字对比度。
