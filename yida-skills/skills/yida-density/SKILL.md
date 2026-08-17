---
name: yida-density
description: 自定义页面信息密度设计规范。提供紧凑、舒适、宽松三种模式、切换 UI 和响应式降级；平台 JSX 组件页面的 didMount/this.utils.isMobile 仅作存量维护示例。
---

# 宜搭自定义页面信息密度设计规范

## 核心定位

信息密度是页面密度配置。`DENSITY_CONFIG`、场景选择、移动端降级和无障碍要求对自定义页面都适用；实现示例使用 React hooks。

维护已检测到的 `.oyd.jsx` / `.oyb.jsx` / `renderJsx` / 平台 `Jsx` 组件页面时，才参考 `didMount` / `this.utils.isMobile()` 的平台 JSX 组件写法。

## 严格要求

- 每次生成列表/表格类自定义页面时都考虑密度，无需用户主动提及。
- PC 列表/表格默认 `comfortable`，可提供紧凑/舒适切换。
- 移动端固定 `spacious`，不显示密度切换 UI。
- 固定展示大屏使用 `spacious`，不显示密度切换 UI。
- 表单填写页交原生表单；若只讨论密度，固定 `comfortable`，不提供切换。
- 间距、字号、行高、控件高度统一从密度 token 派生，避免散落魔法值。
- 密度状态是页面本地状态，不依赖跨会话 memory。

## 场景选择

| 场景 | 默认密度 | 切换 UI |
| --- | --- | --- |
| 专业后台、运营列表、大数据表格 | `compact` 或 `comfortable` | PC 提供 |
| 常规任务管理、审批列表 | `comfortable` | PC 提供 |
| 引导页、展示页、固定大屏 | `spacious` | 不提供 |
| 移动端 | `spacious` | 不提供 |
| 原生表单填写 | `comfortable` | 不提供 |

用户明确说“紧凑/密集/一屏更多”时选 `compact`；说“宽松/大字体/更易读”时选 `spacious`。用户未指定时按页面类型和设备选择。

## 密度 token

同一页面可以把数值映射成 CSS variables、antd token 或 inline style；关键是所有相关组件都消费同一个配置。

```javascript
const DENSITY_CONFIG = {
  compact: {
    cardPadding: '8px 12px',
    fontSize: 12,
    lineHeight: 1.4,
    tableRowHeight: 32,
    controlHeight: 24,
    sectionGap: 8,
  },
  comfortable: {
    cardPadding: '16px 20px',
    fontSize: 14,
    lineHeight: 1.6,
    tableRowHeight: 48,
    controlHeight: 32,
    sectionGap: 16,
  },
  spacious: {
    cardPadding: '24px 28px',
    fontSize: 16,
    lineHeight: 1.8,
    tableRowHeight: 64,
    controlHeight: 40,
    sectionGap: 24,
  },
};
```

## React Hooks 实现

在 Canvas 中用 `matchMedia` + hooks 管设备变化。不要在首次渲染时读一次宽度后永不更新。

```jsx
import React, { useEffect, useMemo, useState } from 'react';

function useIsMobile() {
  const query = '(max-width: 767px)';
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia(query).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const handleChange = (event) => setIsMobile(event.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
}

function DensityAwareList() {
  const isMobile = useIsMobile();
  const [desktopDensity, setDesktopDensity] = useState('comfortable');
  const density = isMobile ? 'spacious' : desktopDensity;
  const tokens = useMemo(() => DENSITY_CONFIG[density], [density]);

  return (
    <section style={{ '--row-height': `${tokens.tableRowHeight}px` }}>
      {!isMobile && (
        <DensitySwitch value={desktopDensity} onChange={setDesktopDensity} />
      )}
      <BusinessTable density={density} tokens={tokens} />
    </section>
  );
}
```

如果目标使用 antd `Table` / `ConfigProvider`，把密度映射到 `size` 和组件 token，同时保留业务级 `DENSITY_CONFIG` 作为唯一来源；不要一部分走 `size="small"`、另一部分继续写固定 padding。

## 响应式纪律

- 移动端自动使用 `spacious`，回到桌面后恢复用户先前选择的桌面密度。
- 切换密度不能清空筛选、分页、选中行和数据。
- 触控目标仍需满足可点击尺寸；`compact` 只用于桌面高密度场景。
- 系统字体缩放、长中文、英文和大数值下均不得截断关键字段。
- 虚拟表格行高、骨架屏行高和真实行高必须使用同一密度 token。

## 平台 JSX 组件维护注意事项

已有普通自定义页面可以继续使用：

```javascript
export function didMount() {
  if (this.utils.isMobile()) {
    _customState.density = 'spacious';
    this.forceUpdate();
  }
}
```

这段只用于平台 JSX 组件页面或 native 页面维护。React hooks 实现不得使用 `didMount`、`this.utils.isMobile()`、`_customState` 或 `forceUpdate`；应使用上面的 `matchMedia` hook 并 cleanup。

现有普通页面只能作为 native 兼容参考，不能据此改变当前页面的实现事实。

## 异常处理

| 场景 | 处理 |
| --- | --- |
| 切换后局部样式没变 | 检查是否仍有硬编码 padding/height，统一消费 token |
| 移动端还显示切换 UI | 由 `isMobile` 派生 UI 和最终 density，不只改样式 |
| 回桌面后丢失用户选择 | 分开保存 `desktopDensity` 与派生 `density` |
| 字体放大后内容裁切 | 避免固定内容高度，允许行高/单元格扩展 |
| 配置缺失 | 回退 `comfortable`，同时暴露开发期错误 |

## 写操作边界

本技能负责生成规范，不自动授权发布。真实发布前必须展示代码/配置摘要并获得用户确认；发布后提供页面 URL 与 PC/移动端验证结果。

## 验收清单

- 页面类型与默认密度匹配。
- Canvas 示例优先；普通页生命周期只出现在 legacy 小节。
- PC 切换真实改变表格/卡片/控件密度，不丢业务状态。
- 移动端固定 `spacious` 且隐藏切换 UI。
- 所有密度相关值来自统一 token。
- `matchMedia` 监听或其他响应式副作用有 cleanup。
