# Code Canvas 开源组件库选型

本文件回答「Code Canvas 还能用哪些开源组件库」以及生成页面时该怎么选。结论先行：**只推荐已经在 Code Canvas 依赖白名单内、且 OpenYida 本地编译能映射到 windowAlias 的库**。白名单外的开源库即使 npm 上可用，也不能在 Canvas 源码里直接 `import`，否则运行时依赖加载不了。

依赖白名单、版本和 windowAlias 以 [dependencies-and-cdn.md](dependencies-and-cdn.md) 为准；本文件只做产品化选型建议。

## 推荐组合

| 场景 | 推荐库 | 何时使用 | 注意事项 |
| --- | --- | --- | --- |
| B 端业务界面 | `antd` | 表格、表单控件、按钮、弹窗、Tabs、Tag、Dropdown、分页 | 最外层包 `ConfigProvider`，主色用 `readBrandColor` 注入；线上环境注意 antd/dayjs 加载顺序问题 |
| 图表看板 | `recharts` | 折线、柱状、面积、饼图、简单仪表盘 | 容器必须有稳定高度；颜色用品牌色和语义色，不硬编码默认蓝 |
| 复杂可视化 | `d3` | 自定义关系图、力导向、桑基、特殊坐标系 | 只在 Recharts 覆盖不了时使用；自己管理 DOM/cleanup |
| 图标 | 内联 SVG 语义集 | 按钮、操作、状态、导航等功能性图标 | 默认方案，零依赖且不会出现运行时组件 undefined |
| 交互动效 | `framer-motion` | 抽屉、轻量过渡、局部状态切换 | B 端页面保持克制，避免大面积入场动画和炫技动效 |
| Hooks 工具 | `ahooks` | 防抖、请求状态、定时器、列表状态等 | 用来简化状态逻辑，不要替代数据源治理 |
| 轻量主题组件 | `@radix-ui/themes` | 需要更原子化、更少 antd 味的按钮、卡片、布局控件 | 与 antd 混用时要统一圆角、字体、色彩和弹层层级 |
| Markdown 展示 | `yida-plugin-markdown` | PRD、公告、帮助文档、AI 输出内容展示 | 只用于展示可信内容；不要把用户输入的 HTML 当可信内容渲染 |

## 默认选型规则

1. **普通业务页默认 `antd + ahooks + 内联 SVG 图标`**：这是最稳的 B 端组合，适合列表、工作台、详情、审批辅助页。
2. **看板默认 `antd + recharts + ahooks + 内联 SVG 图标`**：KPI、筛选、图表和明细表都能覆盖；只有 Recharts 做不了的图才引入 `d3`。
3. **需要去 antd 味时，少量使用 `@radix-ui/themes`**：适合展示页、门户页、较轻的工具页；不要和 antd 两套视觉语言平均混用。
4. **动效只作为状态反馈**：`framer-motion` 用在抽屉、折叠、局部切换，不用于整页炫酷入场。
5. **图标只作功能用途**：默认内联 SVG；`lucide-react` 只有在当前租户环境最小验证通过后才可使用，不进入默认模板。

## lucide-react 特别说明

`lucide-react` 在依赖白名单内，但不同运行时打包形态可能只暴露 `window.DynamicIcon`，不一定稳定提供 `RefreshCw`、`TrendingUp` 等 named exports。若页面直接写 `<RefreshCw />` 而运行时该导出为 `undefined`，React 会报 `Minified React error #130`。

因此默认模板和 AI 生成默认策略**不要 import `lucide-react`**。需要使用时先创建最小验证页，确认目标图标组件确实存在；未验证时用内联 SVG。

## 不推荐直接使用

以下库虽然开源常见，但当前 Code Canvas 白名单未承诺加载，不要在页面源码里直接 `import`：

- `@mui/material` / MUI
- `@mantine/core`
- `chakra-ui`
- `semantic-ui`
- `element-plus` / `naive-ui` / `arco-design`
- `echarts`（普通自定义页面可通过 `loadScript` 用 ECharts；Canvas 当前白名单优先用 `recharts` / `d3`）
- 任意未在 [dependencies-and-cdn.md](dependencies-and-cdn.md) 出现的 npm 包

如果确实要新增库，必须先补齐三件事：OpenYida `canvas-compile.js` 的 alias 映射、Code Canvas 物料运行时依赖白名单和 CDN 资源、样式资源加载验证。缺一项都不能进入生成默认推荐。

## 生成页面时的组合示例

| 页面类型 | 推荐组合 |
| --- | --- |
| 工作台 / 门户 | `antd` + `ahooks` + 内联 SVG，需要轻动效时加 `framer-motion` |
| 数据看板 / 驾驶舱 | `antd` + `recharts` + `ahooks` + 内联 SVG，复杂图再加 `d3` |
| 列表 / 管理页 | `antd` + `ahooks` + 内联 SVG |
| 详情 / 展示页 | `antd` 或 `@radix-ui/themes` + 内联 SVG，时间线/折叠区域可少量动效 |

可直接输出推荐组合示例：

```bash
openyida sample yida-canvas-custom-page dashboard-starter --output project/pages/src/dashboard-starter.canvas.jsx
node -e "const fs=require('fs'); const {compileCanvasLocal}=require('./lib/app/canvas-compile'); const src=fs.readFileSync('project/pages/src/dashboard-starter.canvas.jsx','utf8'); console.log(compileCanvasLocal(src).importedModules)"
```

## 自查清单

- 所有 `import` 都在白名单内，并能出现在 `importedModules`。
- 页面视觉方向已经先走 `yida-page-uiux`，不是靠组件库默认样式堆页面。
- antd 主色通过 `ConfigProvider` 跟随 App 品牌色。
- 图表和图标服务于信息层级，不做装饰性堆叠；图标默认内联 SVG，不默认依赖 `lucide-react`。
- 白名单外库没有被写进默认模板、示例或 agent 推荐话术。
