---
name: yida-theme
description: 宜搭应用主题色与全局主题变量配置技能。用于应用级换肤、主题 token 设计、style#yida-global-theme 注入、Divider/布局/看板/数据管理等跨模块主题一致性处理。
---

# 宜搭应用主题色与全局主题变量

## 适用场景

当用户提到以下诉求时使用本技能：

- 应用主题色、品牌色、换肤、整体视觉风格、全局颜色策略
- `--color-brand1-*`、`--color-brand-*`、`--color-group`
- `style#yida-global-theme`、主题 CSS 注入、普通应用缺少主题变量
- Divider 分割线、布局容器、看板、数据管理、门户、移动端主题不一致
- 讨论是否使用 `useCustomStyle`、`enableCustomThemeStyle`
- 需要在 Tianshu / yc-utils / yida-shell / yida-app / yida-next 中设计主题配置链路

如果只是创建字段结构，不涉及颜色策略，回到 `yida-create-form-page`。如果只是自定义页面视觉方向，先用 `yida-page-uiux` 定方向；涉及应用级主题 token 或注入时再读本技能。

## 严格禁止

- 不要只为了“好看”在 Schema 或 JSX 中随机硬编码品牌色。
- 不要把主题色能力理解成表单专用。shell、应用布局、工作台、数据管理、门户、看板、基础组件都会消费主题变量。
- 不要改写未知的主题字段名。短期配置可叫 `useCustomStyle`，长期推荐 `enableCustomThemeStyle` / `customThemeStyle`。
- 不要把黑色、深灰、灰黑中性色作为普通应用的默认主题色；只有用户明确要求暗色模式、高对比、奢侈品牌或极简黑色视觉时才选择。

## 核心原则

1. 应用级主题优先。用户说“整个应用/全局/系统整体/左侧导航/菜单/顶部壳层一起换色”时，按应用主题处理，不只改某个页面或表单。
2. 页面级主题次之。用户只说“这个页面/首页/看板美化或换色”时，优先在页面内控制，不污染应用全局。
3. 表单与流程表单只消费主题。Divider、ColumnContainer、PageSection 等组件应跟随应用主题变量；普通分组不要单独硬编码色值。
4. 注入位置越早越好。长期应由 Tianshu 在 layout head 注入 `style#yida-global-theme`；运行时脚本注入只能作为短期兜底。
5. 保持 `style#yida-global-theme` 的 id 和 `:root { ... }` 结构。`yc-data-manage` 等代码会读取这个 style 节点解析变量。
6. 普通应用主题色优先选有明确品牌识别度的蓝、青、绿、紫、橙等色相；黑灰只适合作为文字、分割线、背景层或明确暗色场景的辅助色。

## `--theme` 预置值与自定义主题边界

`openyida create-app --theme <key>` / `openyida update-app --theme <key>` 只能填写平台预置主题 key，不能填 AI 自己设计的任意主题名或色值。

允许值：

| key | 颜色倾向 |
| --- | --- |
| `deepBlue` | 深蓝 |
| `podBlue` | 蓝色 |
| `royalBlue` | 皇家蓝 |
| `lightBlue` | 浅蓝 |
| `teal` | 青色 |
| `podGreen` | 绿色 |
| `deepPurple` | 深紫 |
| `purple` | 紫色 |
| `podOrange` | 橙色 |
| `yellow` | 黄色 |
| `magenta` | 玫红 |
| `red` | 红色 |
| `greyBlue` | 灰蓝 |
| `coffee` | 咖啡 |
| `black` | 黑色 |

如果设计的是“活力橙”“深玫红”“高级暗黑金”“自定义蓝紫渐变”等非预置视觉，处理方式是：

1. **不要把自定义名字传给 `--theme`**。应用 `colour` 仍使用最接近的预置 key 作为 fallback，例如通用展示应用用 `podBlue`。
2. **每个自定义页面都要注入主题变量**：在 Canvas / 普通自定义页中注入或输出 `style#yida-global-theme`，至少包含 `--color-brand1-6`、`--color-brand1-9`、`--color-brand1-2`、`--color-brand-1` ~ `--color-brand-4`、`--color-group`。
3. **页面级 sample 默认独立主题**：官方 sample 展示应用、模板画廊、演示页必须在每个页面里带自己的页面级主题 token；否则宿主应用如果是 `black`，所有页面会被全局黑灰变量染黑。
4. **应用级自定义主题才写全局 token**：只有用户明确要整个应用统一自定义品牌色时，才规划 `enableCustomThemeStyle/customThemeStyle.tokens` 或 Tianshu head 注入；否则保持页面级注入，避免污染其他页面。

## 主题变量语义

这些变量是设计语义，不要求每次都直接写入字段 JSON；它们用于指导颜色选择和避免乱用硬编码色值。

| 变量 | 语义 | 典型影响 |
| --- | --- | --- |
| `--color-brand1-1` | hover / 高亮辅助色 | hover、outline、辅助强调、部分 shell 渐变 |
| `--color-brand1-2` | 浅背景 / 导航浅色 | Divider light 背景、工作台浅背景、顶部 Banner、轻量容器底色 |
| `--color-brand1-3` | 背景层 / 空间浅色 | 空间主题背景层、弱背景渐变 |
| `--color-brand1-6` | 主品牌色 | Divider 主色、主按钮、激活文字、重点边框 |
| `--color-brand1-9` | 深选中态 | pressed/active 深色、深色强调文字、深色选中背景 |
| `--color-brand1-10` | 禁用 / 弱化主题色 | disabled、半透明主题色、弱化背景 |
| `--color-brand-1` ~ `--color-brand-4` | 移动端/旧版 token 桥接 | 移动表单、数据管理、旧组件主题色 |
| `--color-group` | 多色序列 | 图表、多色标签、分组色板 |

常用设计判断：

- 主操作、激活状态、Divider 主线条：优先跟随 `--color-brand1-6`。
- 浅色分组底、轻提示背景、Divider light 背景：优先跟随 `--color-brand1-2`。
- 深色 active/pressed/选中：优先跟随 `--color-brand1-9`。
- 图表、多色标签、业务状态色板：优先使用 `--color-group` 或平台图表色板。

## 推荐配置结构

长期建议把“是否启用自定义主题”和“具体 token”拆开：

```json
{
  "enableCustomThemeStyle": "true",
  "customThemeStyle": {
    "source": "openyida",
    "themeKey": "deepBlue",
    "version": 1,
    "tokens": {
      "--color-brand1-1": "rgba(116, 135, 236, 1)",
      "--color-brand1-2": "rgba(232, 235, 252, 1)",
      "--color-brand1-3": "rgba(57, 84, 228, 0.2)",
      "--color-brand1-6": "rgba(57, 84, 228, 1)",
      "--color-brand1-9": "rgba(42, 61, 159, 1)",
      "--color-brand1-10": "rgba(57, 84, 228, 0.3)",
      "--color-brand-1": "rgba(57, 84, 228, 0.3)",
      "--color-brand-2": "rgba(116, 135, 236, 1)",
      "--color-brand-3": "rgba(57, 84, 228, 1)",
      "--color-brand-4": "rgba(42, 61, 159, 1)",
      "--color-group": "rgba(57, 84, 228, 1),rgba(0, 122, 255, 1),rgba(138, 92, 253, 1),rgba(30, 41, 128, 1),rgba(255, 107, 53, 1),rgba(0, 200, 255, 1)"
    }
  }
}
```

字段说明：

| 字段 | 作用 |
| --- | --- |
| `enableCustomThemeStyle` | 是否启用自定义主题 style 注入 |
| `customThemeStyle.themeKey` | 预置主题 key，如 `deepBlue`、`podBlue`、`coffee` |
| `customThemeStyle.tokens` | 最终注入到 `style#yida-global-theme` 的 token map |
| `customThemeStyle.source` | 来源追踪，如 `openyida`、`ai-agent`、`manual`，不控制能力 |
| `customThemeStyle.version` | token 结构版本，便于兼容升级 |

渲染优先级建议：

1. `enableCustomThemeStyle=true` 且 `customThemeStyle.tokens` 非空：直接注入 tokens。
2. 有 `customThemeStyle.themeKey` 但没有 tokens：从统一主题矩阵按 themeKey 取 tokens。
3. 有 `themeConfig.themeColor`：用 `generateTheme(themeColor)` 兜底。
4. 只有 `colour`：按旧逻辑加载 `${colour}.min.css`，并可从主题矩阵生成 CSS var。
5. 都没有：使用平台默认主题。

## colour/theme 与自定义 token 的关系

只注入自定义 CSS token 但不改 `colour` / `theme` 会形成混合状态：

- 会生效：使用 CSS var 的组件，如 Divider、部分 shell active/hover、数据管理操作色、移动端若干组件。
- 不完全生效：`${colour}.min.css`、图标颜色、应用设置展示、导航预览、应用卡片、旧 CSS class 或 Sass 编译变量。
- 风险：配置显示仍是旧主题，但运行态视觉是新主题；应用复制、导出、导入或模板化时，如果没有持久化 `customThemeStyle`，主题可能丢失。

处理建议：

- 如果自定义主题对应已有平台主题，同步 `colour` 为最接近的主题 key，让配置展示、图标、预览更一致。
- 如果是任意品牌色，保留 `colour` 作为 legacy fallback，同时写入 `customThemeStyle.tokens` 作为运行态真实主题。
- UI 上应显示“当前启用自定义主题”，避免用户看到 `colour=orange` 但页面实际是另一套颜色。

## 主题注入方案

### 长期方案：Tianshu head 注入

推荐由 Tianshu 在页面 layout head 阶段注入：

```html
<style id="yida-global-theme">
:root {
  --color-brand1-6: rgba(57, 84, 228, 1);
  --color-brand1-9: rgba(42, 61, 159, 1);
  --color-brand1-2: rgba(232, 235, 252, 1);
  --color-group: rgba(57, 84, 228, 1),rgba(0, 122, 255, 1),rgba(138, 92, 253, 1),rgba(30, 41, 128, 1),rgba(255, 107, 53, 1),rgba(0, 200, 255, 1);
}
</style>
```

Tianshu 改动建议：

- `AppConfigType` 增加 `ENABLE_CUSTOM_THEME_STYLE` 和 `CUSTOM_THEME_STYLE`。
- `AppRegisterVO` / `AppRegisterVoAdapter` 暴露这两个配置。
- `CommonContextBuilder` / `BaseAction` 放入模板上下文。
- `layout/inst/formSubmit.vm`、`formEdit.vm`、`taskDetail.vm`、`pageView.vm`、`instStart.vm` 等 head 中尽量靠前注入。
- `screen/inst/*.vm` 的 `window.pageConfig` / `window.g_config` 透出同名字段，便于前端兜底。

### 短期方案：运行时注入

普通应用尚未在 head 注入时，可以用运行时脚本兜底：

```js
function injectYidaGlobalTheme(tokens) {
  function inject(doc) {
    if (!doc || !doc.head) return;
    var style = doc.getElementById('yida-global-theme');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'yida-global-theme';
      doc.head.insertBefore(style, doc.head.firstChild);
    }
    style.textContent = ':root {' + Object.keys(tokens).map(function (key) {
      return key + ': ' + tokens[key] + ';';
    }).join('') + '}';
  }

  inject(window.document);
  try {
    if (window.top && window.top !== window) {
      inject(window.top.document);
    }
  } catch (e) {
    // cross-origin top cannot be written
  }
}
```

短期方案边界：

- 它晚于页面 head 加载，可能有首屏闪动。
- 跨域 `window.top` 不能写，只能静默跳过。
- 如果更早的 CSS/JS 已解析过 `style#yida-global-theme`，运行时注入可能偏晚。

## OpenYida 使用建议

- 创建完整应用时，如果用户提出品牌色或主题诉求，先判断主题作用域是 `app` 还是 `page`。
- 创建表单或流程表单时，普通分组用 `Divider` 并保持主题模式；不要在每个 Divider 上写随机自定义色。
- 生成自定义页面时，页面局部主题可以使用页面 CSS token；只有要影响 shell、表单、数据管理、门户等全局区域时，才走应用级主题配置。
- 碰到普通应用缺少 Divider 主题变量时，OpenYida 可以注入运行时 `style#yida-global-theme` 兜底，但这不替代长期 Tianshu head 注入。
- 需要跨模块统一主题时，应输出一份 `customThemeStyle.tokens`，并说明是否同步 `colour`。
- 修改已有应用主题时，不要只相信更新接口回包。必须回读 `getAppIncludingAecpInfo`，确认 `colour` 与 `config.COLOUR` 都变为目标主题；页面运行态再刷新检查 `style#yida-global-theme`。
- `updateAppName` 类轻量接口可能返回成功但忽略 `colour/icon/navTheme/layoutDirection`。涉及主题、图标、导航或布局时，应先回读当前应用详情，再用 `updateApp` 携带现有壳层字段保存；其中接口实际接收字段是 `mode`，即使错误文案写的是 `appMode`。
- 官方 sample 展示应用如果只是承载样例库，应用全局主题优先用通用蓝色（如 `podBlue`）作为中性底座；每个 sample 页面再用页面级固定主题形成差异化，避免宿主黑灰主题污染所有样例。

### 官方 sample 主题验收纪律

处理官方 Samples 展示应用或模板画廊时，把“应用主题”和“页面主题”分开验收：

1. 应用壳层需要蓝色或中性底座时，使用平台预置值，例如 `openyida update-app <appType> --theme podBlue`。不要把“活力橙”“深玫红”“暗黑金”等自定义名字传给 `--theme`。
2. 每个 sample 页面必须自带页面级 `style#yida-global-theme` 或等价 scoped tokens，确保页面刷新后不会被宿主应用的 `black` / 灰黑变量污染。
3. 页面级自定义主题要覆盖导航、按钮、标签、图表色板和浅背景，不只改 hero 或几张卡片。
4. 修改应用主题后必须回读应用详情，确认 `colour` 与 `config.COLOUR` 都是目标预置 key；修改页面主题后用 schema / runtimeCode grep 确认 `style#yida-global-theme` 已随页面发布。

## 验证清单

- 普通表单、流程表单、详情页、提交页都能读取主题变量。
- shell 导航、工作台、数据管理、门户组件颜色不串色。
- `style#yida-global-theme` id 保持不变，`yc-data-manage` 可解析。
- 应用编辑态仍可进入，字段配置项没有被 AIOA / Pod Premium 误隐藏。
- 自定义 token 与 `colour` 不一致时，配置 UI 有明确提示或 fallback。
- 已有应用换主题后，详情接口回读 `colour/config.COLOUR/icon/iconUrl/navTheme/layoutDirection`，不要只看 CLI success。
