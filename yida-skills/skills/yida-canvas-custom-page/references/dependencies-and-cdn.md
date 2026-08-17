# 自定义页面可用资源

使用 `YidaCodeCanvas` 组件实现的页面只从下表资源 import。编译阶段会把这些资源写入 `importedModules`，运行时由 `YidaCodeCanvas` 组件按资源表加载。

## 可用前端资源

编译阶段会把下列资源的 `import` 计入 `importedModules`，运行时按资源表加载。带 `${cdn}` 的资源前缀由平台运行时按当前环境决定。

| 包名 / 资源 | 推荐用途 | 页面源码写法 | 运行时资源 |
| --- | --- | --- | --- |
| `react` | React18 运行时 | `import React from 'react'` | g.alicdn.com react 18.3.1 |
| `react-dom` | React DOM 运行时 | `import ReactDOM from 'react-dom'` | g.alicdn.com react-dom 18.3.1 |
| `antd` | 表格、表单控件、按钮、弹窗、Tabs、Tag、Dropdown、分页 | `import { Button, Table } from 'antd'` | g.alicdn.com antd **5.23.3** `antd-with-locales.js` |
| `@ant-design/icons` | Ant Design 图标 | `import { SearchOutlined } from '@ant-design/icons'` | g.alicdn.com ant-design-icons 5.5.1 |
| `ahooks` | 防抖、请求状态、定时器、列表状态等 hooks | `import { useMemoizedFn } from 'ahooks'` | `${cdn}/platform/yida-assets/ahooks.js`（运行时默认追加） |
| `recharts` | 折线、柱状、面积、饼图等 React 图表 | `import { LineChart, Line } from 'recharts'` | g.alicdn.com recharts 2.15.0 |
| `d3` | 自定义关系图、力导向、桑基、特殊坐标系 | `import * as d3 from 'd3'` | g.alicdn.com d3 7.9.0 |
| `@radix-ui/themes` | 少量轻量主题组件 | `import { Button } from '@radix-ui/themes'` | `${cdn}/.../radix.js` + `radix.css` |
| `lucide-react` | 线性功能图标 | `import { Search, RefreshCw } from 'lucide-react'`；动态配置用页面内图标映射表 | `${cdn}/.../lucideReact.js` |
| `framer-motion` | 抽屉、折叠、局部状态切换动效 | `import { motion } from 'framer-motion'` | `${cdn}/.../framerMotion.js` |
| `yida-plugin-markdown` | PRD、公告、帮助文档、AI 输出内容展示 | `import Markdown from 'yida-plugin-markdown'` | moduleFederation 0.0.4 |

## 资源使用约定

- 页面源码只从上表资源 import；第三方资源加载交给 YidaCodeCanvas runtime。
- React、antd、Ant Design Icons、Recharts、ahooks、d3、dayjs、Radix、lucide-react、framer-motion 等包依赖必须写标准 import，例如 `import { ConfigProvider, Button } from 'antd'`、`import { Search, Plus } from 'lucide-react'`。不要在源码里写 `const { Drawer } = antd`、`const { Search } = lucideReact`、`const { ConfigProvider } = window.antd`、`const React = window.React` 或 `window.icons`；这类写法不会正确进入 `importedModules`，运行时会出现 `antd is not defined`、`lucideReact is not defined` 或依赖资源未加载。
- 平台运行态组件和平台能力通过 `window.Deep`、`window.DeepYida`、`window.YidaNativeComponents` 等页面对象探测。
- 真实表单数据绑定使用页面内本地 `useYidaData(binding)`、`DataBridge` 与同源 `fetch` 实现。
- 组件库选型见 [component-library-guide.md](component-library-guide.md)。

## 编译与运行方式

OpenYida CLI **本地用 Babel** 把源码转译为 `runtimeCode` + `importedModules`，不调用在线编译服务。运行时由 `YidaCodeCanvas` 物料按 `importedModules` 加载上表资源，再用 `new Function` 执行 `runtimeCode` 并取回 `YidaComp`。
