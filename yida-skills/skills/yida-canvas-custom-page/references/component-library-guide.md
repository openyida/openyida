# 自定义页面组件库选型

使用 `YidaCodeCanvas` 组件实现的页面从 [dependencies-and-cdn.md](dependencies-and-cdn.md) 的可用前端资源中选择组件库。组件库服务 `yida-design` 已确认的页面场景、区块、主题和交互，资源版本、import 写法和运行时加载方式以资源清单为准。

## 推荐组合

| 场景 | 推荐库 | 何时使用 | 使用要点 |
| --- | --- | --- | --- |
| B 端业务界面 | `antd` | 表格、表单控件、按钮、弹窗、Tabs、Tag、Dropdown、分页 | 最外层包 `ConfigProvider`，主色用 `readBrandColor` 注入；资源加载交给 YidaCodeCanvas runtime |
| 图表看板 | `recharts` | 折线、柱状、面积、饼图、简单仪表盘 | 容器必须有稳定高度；颜色用品牌色和语义色，不硬编码默认蓝 |
| 复杂可视化 | `d3` | 自定义关系图、力导向、桑基、特殊坐标系 | 只在 Recharts 覆盖不了时使用；自己管理 DOM/cleanup |
| 图标 | `lucide-react`，必要时 `@ant-design/icons` | 按钮、操作、状态、导航等功能性图标 | 默认使用 `lucide-react` named import；antd 语境可使用 `@ant-design/icons` Outlined 图标 |
| 交互动效 | `framer-motion` | 抽屉、轻量过渡、局部状态切换 | B 端页面使用克制、局部、服务状态理解的动效 |
| Hooks 工具 | `ahooks` | 防抖、请求状态、定时器、列表状态等 | 用来简化状态逻辑；数据读写仍走明确数据桥 |
| 轻量主题组件 | `@radix-ui/themes` | 展示页、门户页、轻工具页需要更轻的按钮、卡片、布局控件 | 与 antd 混用时统一圆角、字体、色彩和弹层层级 |
| Markdown 展示 | `yida-plugin-markdown` | PRD、公告、帮助文档、AI 输出内容展示 | 用于展示可信 Markdown 内容；用户输入内容先清洗再展示 |

## 默认选型规则

1. **普通业务页默认 `antd + ahooks + lucide-react 图标`**：这是最稳的 B 端组合，适合列表、工作台、详情、审批辅助页。
2. **看板默认 `antd + recharts + ahooks + lucide-react 图标`**：KPI、筛选、图表和明细表都能覆盖；只有 Recharts 做不了的图才引入 `d3`。
3. **展示页可少量使用 `@radix-ui/themes`**：适合展示页、门户页、较轻的工具页；同一页面选一个主视觉语言，另一套组件只做局部补充。
4. **动效服务状态反馈**：`framer-motion` 用在抽屉、折叠、局部切换，服务用户理解状态变化。
5. **图标只使用可加载图标库**：默认按下方 `lucide-react` 用法 named import；页面已采用 Ant Design 图标语言、或 antd 组件语境需要 Outlined 图标时，使用 `@ant-design/icons`。emoji 被编译门禁拦截时，按业务语义替换为这两类图标组件，不得改成 CSS 绘制图形、字母占位、Unicode 符号或临时 SVG。

## lucide-react 用法

YidaCodeCanvas 支持在页面源码中使用 `lucide-react`。页面默认从常用图标列表里选择具体组件，用 named import 引入：

```jsx
import { Search, RefreshCw, ChevronDown, Settings, Plus } from 'lucide-react';

function Toolbar() {
  return (
    <div>
      <Search size={16} />
      <RefreshCw size={16} />
      <ChevronDown size={16} />
      <Settings size={16} />
      <Plus size={16} />
    </div>
  );
}
```

图标名称来自数据或配置时，在页面内写映射表，映射值仍然是 named import 得到的组件：

```jsx
import { AlertCircle, Check, Clock, Search } from 'lucide-react';

const ICONS = {
  alert: AlertCircle,
  check: Check,
  clock: Clock,
  search: Search,
};

function StatusIcon(props) {
  const Icon = ICONS[props.type] || Search;
  return <Icon size={16} />;
}
```

常用图标可以选：`Search`、`RefreshCw`、`ChevronDown`、`ChevronUp`、`Settings`、`Plus`、`Download`、`Upload`、`Edit3`、`Trash2`、`Eye`、`Calendar`、`Clock`、`User`、`Users`、`Building2`、`FileText`、`Check`、`X`、`AlertCircle`、`Info`、`BarChart3`、`TrendingUp`。

## @ant-design/icons 用法

Ant Design 图标用于 antd 组件语境或页面已经采用 Outlined 图标语言的场景。按需 named import 具体组件：

```jsx
import { SearchOutlined, PlusOutlined, EyeOutlined } from '@ant-design/icons';
```

同一页面选择一套主图标语言。默认主图标语言是 `lucide-react`；选择 `@ant-design/icons` 时，快捷入口、按钮、状态和导航仍然使用具体组件映射。

## emoji 报错时的图标修复

OpenYida 禁止页面源码和 page-spec 中出现 emoji。遇到 `contains emoji` 时，先判断该符号是否承担图标语义：

- 新增、搜索、刷新、查看、上传、下载、组织、用户、日历、告警、成功等图标语义：改成 `lucide-react` named import，或在 Ant Design 图标语言页面中改成 `@ant-design/icons` named import。
- 状态标记：用图标组件 + 语义色 Tag / 文本文案，不用 emoji。
- 纯装饰符号：直接删除，不补 CSS 图形。

禁止为了通过编译把 emoji 改成 CSS 画出的圆点、三角、方块、首字母、单字符按钮或临时 inline SVG。CSS 只负责图标容器的尺寸、颜色、背景和交互态，图标本体必须是 `lucide-react` 或 `@ant-design/icons` 组件。

## 实现页面时的组合示例

| 页面类型 | 推荐组合 |
| --- | --- |
| 工作台 / 门户 | `antd` + `ahooks` + `lucide-react`，需要轻动效时加 `framer-motion` |
| 数据看板 / 驾驶舱 | `antd` + `recharts` + `ahooks` + `lucide-react`，复杂图再加 `d3` |
| 列表 / 管理页 | `antd` + `ahooks` + `lucide-react` |
| 详情 / 展示页 | `antd` 或 `@radix-ui/themes` + `lucide-react`，时间线/折叠区域可少量动效 |

可直接按推荐组合编写页面并执行本地快检：

```bash
node -e "const fs=require('fs'); const {compileCanvasLocal}=require('./lib/app/canvas-compile'); const src=fs.readFileSync('project/pages/src/dashboard-starter.canvas.jsx','utf8'); console.log(compileCanvasLocal(src).importedModules)"
```

## 自查清单

- 所有 `import` 都在可用前端资源清单内，并能出现在 `importedModules`。
- 页面视觉方向来自 `yida-design`，组件库服务于既定视觉方向。
- antd 主色通过 `ConfigProvider` 跟随 App 品牌色。
- 图表和图标服务于信息层级；图标默认使用 `lucide-react`，antd 组件语境可使用 `@ant-design/icons`。
- 页面依赖和推荐话术只包含当前已验证可用资源能力。
