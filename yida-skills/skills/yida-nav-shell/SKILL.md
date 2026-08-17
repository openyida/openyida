---
name: yida-nav-shell
description: >
  宜搭自定义页面「页面内导航壳」形态目录。适用于隐藏应用导航后的侧边、顶部、混合、浮动和标签导航，多视图切换及带参数跨页跳转；默认用 React useState/useEffect/hash，平台 JSX 组件/native 示例仅作对应运行时维护参考。
---

# yida-nav-shell — 页面内自绘导航壳

## 核心定位

自定义页显式隐藏应用导航（`isRenderNav=false`）后，页面需要自己承担应用级导航。本技能负责形态选型、状态机制、URL 纪律和代码骨架；若用户只是要求页面内 tab / 内容区导航但没有说隐藏平台导航，默认仍保留宜搭导航，不进入隐藏导航链路。

本技能不配置宜搭平台真实导航树；平台导航分组由 `yida-nav-group` 处理。

## 前置判定

- 导航未隐藏：通常使用宜搭平台导航，不需要本技能。
- 用户明确隐藏导航、无导航、全屏无框、独立分享页或 `isRenderNav=false`：使用本技能。
- 仅说“门户 / 工作台 / 看板 / 页面内导航”不等于隐藏导航；默认保持平台导航可见。
- 隐藏导航链路下，页面内自绘应用级导航与宜搭原导航不得同时出现。

发布后必须配置并验证：

```bash
openyida update-form-config <appType> <shellFormUuid> false "<页面标题>"
```

## 选型

| 形态 | 何时用 | 移动端 |
| --- | --- | --- |
| 左侧边栏 | 5–12 个模块、常驻导航 | Drawer/汉堡 |
| 顶部导航 | 2–6 个同级模块、内容要宽 | 汉堡菜单 |
| 顶部 + 侧边 | 两级复杂应用 | 顶部收敛 + 侧栏抽屉 |
| 浮动胶囊/Dock | 沉浸、大屏、展示页 | 底部胶囊 |
| 标签页 | 单模块内切同级视图 | 横向滚动 |

详细骨架见 `references/nav-shell-patterns.md`，其中平台 JSX 组件/native 代码只作对应运行时维护参考。

## 状态机制

### 仅需本地切换

用 `useState` 保存 `activeView`；菜单配置与视图组件映射放在组件外，避免条件 JSX 越堆越深。

```jsx
function YidaComp() {
  const [activeView, setActiveView] = React.useState('home');
  const ActiveView = VIEW_COMPONENTS[activeView] || NotFoundView;

  return (
    <AppShell
      items={NAV_ITEMS}
      activeKey={activeView}
      onSelect={setActiveView}
    >
      <ActiveView />
    </AppShell>
  );
}
```

### 需要可分享、前进/后退

用 URL hash 作为真相源：

- 初始化读取 hash。
- `hashchange` 更新 activeView。
- 点击导航更新 hash。
- `useEffect` cleanup 移除监听。
- 未知 hash 回退默认视图，不能渲染空白页。

```jsx
function useHashView(defaultView) {
  const read = () => window.location.hash.replace(/^#\/?/, '') || defaultView;
  const [view, setView] = React.useState(read);

  React.useEffect(() => {
    const handleHashChange = () => setView(read());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [defaultView]);

  const navigate = React.useCallback((next) => {
    window.location.hash = '/' + next;
  }, []);

  return [view, navigate];
}
```

## 跨页 URL 纪律

导航项必须保存 `type`、`formUuid` 和 `params`，而不是只存 `formUuid`。

```javascript
const NAV_ITEMS = [
  { key: 'home', type: 'custom', formUuid: 'FORM-HOME', params: { tab: 'home' } },
  { key: 'orders', type: 'workbench', formUuid: 'FORM-ORDERS', params: { iframe: 'true' } },
];
```

- 跨自定义页：`/{appType}/custom/{formUuid}?isRenderNav=false`。
- 内容区 iframe 表单列表：`/{appType}/workbench/{formUuid}?iframe=true`。
- 合并并白名单保留 `corpid`、`locale` 和业务深链参数。
- 使用 `URL` / `URLSearchParams` 构造地址；不要字符串拼接重复 `?`。
- 不使用可能吞掉 `isRenderNav=false` 的裸 `router.push(formUuid)`。
- 最终至少验证一个跨页 URL 和一个浏览器回退动作。

## 移动端

- Canvas 使用 CSS media query 或带 cleanup 的 `matchMedia` hook。
- 侧边栏收敛为 Drawer，顶部导航收敛为汉堡菜单，浮动导航下沉为底部胶囊。
- 触控目标至少 44px，焦点态和键盘访问不能丢。
- 菜单展开状态与当前 activeView 分离，切换视图后按产品需要关闭移动菜单。

## 平台 JSX 组件维护注意事项

平台 JSX 组件页面或实例桥依赖场景维护时：

- `_customState.activeView` 保存状态。
- `this.setCustomState({ activeView: key })` 更新。
- `renderJsx` 按 activeView 渲染。
- `this.utils.isMobile()` 只用于平台 JSX 组件页面响应式。

跨页 URL 规则与 Canvas 完全相同，不能因为是 legacy 就省略 `isRenderNav=false` 或业务参数。

## 严格要求

1. 自绘导航前先隐藏宜搭原导航。
2. 选中态必须一眼可辨，不能只靠极淡颜色。
3. 导航项必须真正可点击，未知 key 有 fallback。
4. hash/event/matchMedia 等监听必须 cleanup。
5. 图标只使用 `lucide-react` 或 `@ant-design/icons` 的具体组件映射，默认 `lucide-react`；禁 emoji、CSS 绘制图形、字母占位和装饰性图标堆叠。
6. 顶部条保持克制，不做营销 Hero。
7. 平台 JSX 组件示例只能标记为对应运行时维护参考。

## 验收

- 发布配置和最终 URL 均为 `isRenderNav=false`。
- 当前视图、选中态、内容区一致。
- hash 深链、前进/后退、刷新恢复可用。
- 跨页参数不丢，表单工作台 URL 类型正确。
- PC 和移动端导航均可操作。
- 离开页面后无残留监听。

## 参考文档

| 文档 | 用途 |
| --- | --- |
| [导航壳形态目录](references/nav-shell-patterns.md) | 五种形态、默认骨架、平台 JSX 组件/native 示例与自查 |
| `use_skill("yida-design", "判定导航与视觉策略")` | 判定是否隐藏导航及视觉策略 |
| [字段与 URL 参考](../../references/field-and-url-reference.md) | 页面 URL 和参数规范 |
