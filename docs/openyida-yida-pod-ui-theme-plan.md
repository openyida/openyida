# OpenYida 自定义页面 UI 主题与宜搭应用主题风格生成方案

## 1. 背景

当前 OpenYida 生成的自定义页面已经切到 Code Canvas 默认链路，但页面视觉仍然容易出现以下问题：

| 问题 | 表现 | 影响 |
| --- | --- | --- |
| 业务页 landing 化 | 大标题、大留白、大按钮、卡片堆叠 | 看起来不像宜搭业务系统，像通用 AI 生成页 |
| 主题色割裂 | 页面硬编码蓝色或自定义色，未充分跟随宜搭主题变量 | 与左侧导航、Deep 组件、数据管理页不统一 |
| 圆角和阴影泛用 | 8px/12px/16px 到处使用，缺少层级 | 页面显得软、散、缺乏业务工具感 |
| Canvas 依赖不稳定 | lucide-react 等 CDN 全局导出不确定 | 容易触发 React #130 等线上渲染错误 |
| 门户组件边界不清 | 希望在自定义页复用门户组件，但 Canvas 不能直接 import VisualEngine 组件 | 生成策略不稳定，容易依赖运行时私有能力 |

目标不是单个页面美化，而是把宜搭自定义页面的视觉生成沉淀为一套可配置、可复用、可测试的主题与布局能力。

## 2. 参考结论

本方案参考了以下代码与线上页面：

| 来源 | 关键结论 |
| --- | --- |
| `yida-shell` 应用主题配置 | 好看的核心不是主色更鲜艳，而是主色、overlay、圆角、壳层背景、内容容器一起工作 |
| `vc-deep-yida` 门户组件 | 门户组件走 VisualEngine / 插件扩展点，不是普通 React 包，Code Canvas 不能直接稳定 import |
| `yc-data-manage` 数据管理页 | 表格、筛选、列表页应保持紧凑，边框浅、表头灰、单元格 12px padding、圆角克制 |
| 线上页面 HTML | 线上主题通过 `:root` CSS 变量注入，如 `--color-brand1-6`、`--color-brand1-2`、`--color-brand1-9` |
| `yida-shell` 换肤入口 | `window.__YIDA__.updateShellConfig` 可接收 `themeConfig`，带 `themeColor` 时会生成并注入全局主题 |

## 3. 总体方案

方案分四层落地：

| 层级 | 要做什么 | 解决什么问题 |
| --- | --- | --- |
| 平台主题层 | 统一读取和覆盖宜搭主题变量，支持页面级和应用级两种作用域 | 页面与壳层、导航、Deep 组件颜色一致 |
| 宜搭应用主题 Profile | 新增用户侧 `yida-app-theme` 主题配置，并保留旧配置兼容 | 让默认生成页继承宜搭业务应用的高级感和系统感 |
| OpenYida 生成模板 | 按工作台、看板、列表、详情、门户首页分别生成不同骨架 | 避免所有页面都长成大 hero + 卡片 |
| Canvas 运行时兜底 | 避免不稳定依赖，增强 CDN/windowAlias 校验 | 降低线上 React 渲染错误 |

## 4. 主题策略

### 4.1 默认主题 Profile

新增默认用户侧主题 profile：`yida-app-theme`。

```js
{
  name: 'yida-app-theme',
  themeColor: '#6B7CAB',
  navTheme: 'light',
  mode: 'color_color',
  colorMode: 'gradient',
  density: 'business-compact',
  radius: {
    shell: 12,
    panel: 8,
    control: 6,
    table: 4
  }
}
```

这组颜色偏低饱和蓝灰，更接近宜搭业务系统气质，适合作为 AI 生成默认风格。

### 4.2 主题变量

OpenYida 模板统一使用语义变量，不直接硬编码主色：

```css
.oy-page {
  --oy-brand: var(--color-brand1-6, #6b7cab);
  --oy-brand-deep: var(--color-brand1-9, #435480);
  --oy-brand-soft: var(--color-brand1-2, #f3f5fb);
  --oy-brand-tint: var(--color-brand1-3, rgba(107, 124, 171, 0.2));

  --oy-panel: #fff;
  --oy-panel-soft: #f7f8fa;
  --oy-line: #e5e6e8;
  --oy-line-soft: #f1f2f3;
  --oy-text: #171a1d;
  --oy-muted: #747677;
  --oy-subtle: #878f95;

  --oy-radius-shell: var(--pod-md-border-radius, 12px);
  --oy-radius-panel: var(--pod-sm-border-radius, 8px);
  --oy-radius-control: 6px;
  --oy-radius-table: 4px;
}
```

### 4.3 主题作用域

提供两个模式：

| 模式 | 作用范围 | 推荐场景 |
| --- | --- | --- |
| `themeScope: page` | 只影响当前自定义页根节点 | 默认模式，安全，不影响应用导航 |
| `themeScope: app` | 影响当前应用页面的 `:root` 或调用 shell 换肤接口 | 需要导航、顶部壳层、页面整体统一换肤 |

页面级示例：

```css
.oy-page {
  --color-brand1-6: rgba(107, 124, 171, 1);
  --color-brand1-2: rgba(243, 245, 251, 1);
  --color-brand1-9: rgba(67, 84, 128, 1);
}
```

应用级示例：

```js
React.useEffect(function () {
  window.__YIDA__?.updateShellConfig?.({
    themeConfig: {
      theme: 'light',
      colorMode: 'gradient',
      mode: 'color_color',
      themeColor: '#6B7CAB',
      mobileNavStyle: 'top'
    }
  });
}, []);
```

## 5. 从宜搭应用主题学习的设计规则

### 5.1 不把主色当背景乱铺

宜搭应用主题的视觉更稳，是因为主色主要控制：

- 导航背景
- 激活态文字
- 少量关键按钮
- focus ring
- hover/active overlay 的基础色

OpenYida 生成页应避免大面积主色渐变和大面积彩色卡片。

### 5.2 overlay 比直接主色更高级

建议在模板中补充应用主题风格 overlay：

```css
.oy-page {
  --oy-overlay: rgba(83, 88, 97, 0.1);
  --oy-overlay-hover: rgba(83, 88, 97, 0.16);
  --oy-overlay-active: rgba(83, 88, 97, 0.24);
}
```

深色模式可切换为：

```css
.oy-page[data-theme='dark'] {
  --oy-overlay: rgba(207, 218, 229, 0.12);
  --oy-overlay-hover: rgba(255, 255, 255, 0.12);
  --oy-overlay-active: rgba(255, 255, 255, 0.16);
}
```

### 5.3 圆角分层

| 对象 | 建议圆角 | 说明 |
| --- | --- | --- |
| 壳层主内容容器 | 12px | 对齐应用壳层的大圆角层级 |
| 普通卡片 / 面板 | 8px | 对齐应用内容区的面板圆角 |
| 搜索框 / 按钮 / 筛选项 | 6px | 对齐 Deep 和表单控件 |
| 表格内元素 / 标签 / 图片缩略图 | 4px | 对齐数据管理页 |
| 头像 / 圆形图标 | 50% | 仅限真正圆形元素 |

### 5.4 信息密度

默认使用 `business-compact`：

- 页面 padding：16px / 24px
- 卡片 padding：16px / 20px
- 模块间距：12px / 16px
- 表格单元格 padding：12px
- 标题字号：页面标题 18px - 22px，卡片标题 15px - 16px

不要默认生成 48px 以上大标题，除非页面明确是官网/落地页。

## 6. 页面类型生成策略

| 页面类型 | 默认骨架 | 不推荐 |
| --- | --- | --- |
| 工作台 `workbench` | 紧凑标题区 + 指标条 + 快捷入口 + 待办/动态/常用应用 | 大 hero、大按钮、营销文案 |
| 看板 `dashboard` | KPI 条 + 主图表 + 明细列表 + 异常洞察 | 大面积单色卡片、装饰图形 |
| 列表 `list` | 筛选条 + 表格 + 状态标签 + 批量操作 | 卡片流替代表格 |
| 详情 `detail` | 摘要区 + 分组信息 + 时间线 + 关联数据 | 表单控件重写 |
| 门户 `portal` | 应用主题风格 banner + quick entry + 分组应用卡 + 公告 | 直接 import 门户组件 |

## 7. 门户组件支持策略

### 7.1 当前边界

`vc-deep-yida` 中的门户组件，如 `PortalQuickEntry`、`PortalTopBanner`，是 VisualEngine 组件或插件扩展点组件。

Code Canvas 当前运行模式是：

- 编译 JSX 为 `runtimeCode`
- 注入 `importedModules`
- 在宿主 window 内执行 `YidaComp`
- 只支持白名单 CDN 依赖

因此 Code Canvas 不能稳定地直接：

```js
import { PortalQuickEntry } from '@ali/vc-deep-yida';
```

### 7.2 推荐路线

| 阶段 | 方案 | 优点 |
| --- | --- | --- |
| 短期 | OpenYida 生成门户风格 React/CSS 组件，如 `QuickEntry`、`TopBanner`、`NoticePanel` | 稳定、无需改运行时 |
| 中期 | 发布 schema 时支持 `YidaCodeCanvas` 与原生门户组件混排 | 复用 VisualEngine 组件能力 |
| 长期 | `vc-deep-yida` 为 Code Canvas 暴露安全组件桥接白名单 | Canvas 可消费部分平台组件 |

## 8. Canvas 运行时与依赖建议

### 8.1 lucide-react 问题

当前 `lucide-react` 在 `vc-deep-yida` 中映射为全局 `DynamicIcon`。如果页面写：

```js
import { Search } from 'lucide-react';
```

但 CDN 没有暴露 `DynamicIcon.Search`，React 会拿到 `undefined` 组件，线上就可能报：

```text
Minified React error #130
```

因此默认模板不应生成 lucide-react 命名导入。

### 8.2 运行时增强

建议在 `vc-deep-yida` 的 Code Canvas factory 中增加：

| 增强点 | 说明 |
| --- | --- |
| 依赖 assetUrl 空值过滤 | 避免 `dayjs` 这类特殊依赖推入 `undefined` |
| windowAlias 校验 | CDN 加载后检查全局变量是否存在 |
| 错误提示可读化 | 把 `React #130` 前置转换成“组件依赖未加载或导出不存在” |
| Tailwind 条件注入 | 不要所有 Canvas 页面都无条件注入 Tailwind runtime |

## 9. OpenYida 改造清单

| 模块 | 改造内容 |
| --- | --- |
| `lib/app/page-ir.js` | 增加 `themeProfile` / `themeScope` / `visualProfile` 标准化字段 |
| `lib/app/generate-page.js` | 新增用户侧 `--theme-profile yida-app-theme`，并设为默认 |
| Canvas 模板 | 引入应用主题 token、overlay、圆角分层和页面类型骨架 |
| Native 模板 | 与 Canvas 使用同一套视觉 token，避免两条链路风格不一致 |
| `yida-skills` | 更新自定义页默认 UI 规范：默认 Code Canvas + 宜搭应用主题风格 |
| 测试 | 增加生成源码断言：不出现 lucide 命名导入、不出现默认大 hero、包含主题 token |

## 10. 推荐排期

| 阶段 | 工作 | 验收 |
| --- | --- | --- |
| P0 | 先改默认模板和视觉 profile | 新生成页面明显贴近宜搭业务页，不再像 landing |
| P1 | 增加 `themeScope` 和 shell 换肤桥接 | 已落地：`page` 默认页面级变量注入，`app` 可调用 `window.__YIDA__.updateShellConfig` 请求壳层换肤 |
| P2 | 增强 Canvas 依赖校验 | lucide/dayjs/CDN 异常能提前暴露为可读错误 |
| P3 | 探索 schema 混排门户组件 | Canvas 页面可稳定组合原生门户组件 |

## 11. 验收标准

1. 新建一个多页面应用，默认页面全部走 Code Canvas。
2. 页面主色跟随 `--color-brand1-*`，不硬编码亮蓝。
3. 页面圆角层级符合 12 / 8 / 6 / 4 的分层规则。
4. 工作台页面不再生成大 hero。
5. 列表页更接近数据管理页密度。
6. 默认模板不使用 lucide-react 命名导入。
7. 线上发布后无 React #130。
8. 可选开启应用级主题覆盖，使左侧导航和内容区域整体换肤。

## 12. 决策建议

建议采用：

> OpenYida 默认使用 `yida-app-theme` 用户侧主题 profile，主题作用域默认 `page`，保留 `app` 级换肤选项；短期用 React/CSS 生成门户风格组件，中期再做 schema 混排平台门户组件。

这样可以最快解决“默认生成页不好看”的问题，同时不会把 Code Canvas 绑到不稳定的内部组件 import 上。
