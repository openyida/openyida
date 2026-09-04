import { Menu } from 'lucide-react';

/** 顶部导航；复用页面选中状态和跳转函数，窄屏通过按钮展开菜单。 */
function CanvasNav({ items = [], activeKey, onSelect, title, logo, actions, children }) {
  const [expanded, setExpanded] = React.useState(false);
  const menuId = React.useId();
  React.useEffect(() => setExpanded(false), [activeKey]);
  return <div className="oy-canvas-nav oy-nav-top">
    <style>{CANVAS_NAV_CSS + `
      .oy-nav-top .oy-nav-header { display: flex; flex-wrap: wrap; align-items: center; gap: var(--pod-nav-top-header-gap, 24px); padding: var(--pod-nav-top-header-padding, 8px 16px); border-bottom: 1px solid var(--pod-nav-sub-divider-color, var(--color-line1-1, #ddd)); }
      .oy-nav-top .oy-nav-menu { display: flex; flex: 1; min-width: 0; overflow-x: auto; }
      .oy-nav-top .oy-nav-item[aria-current="page"] { box-shadow: inset 0 -2px var(--pod-nav-tab-line-selected-color, var(--color-brand1-6, #1677ff)); }
      .oy-nav-top .oy-nav-toggle { display: none; margin-left: auto; }
      @media (max-width: 767px) {
        .oy-nav-top .oy-nav-header { gap: var(--pod-nav-logo-gap, 8px); }
        .oy-nav-top .oy-nav-toggle { display: flex; }
        .oy-nav-top .oy-nav-menu { order: 1; flex-basis: 100%; flex-direction: column; }
        .oy-nav-top .oy-nav-menu:not(.is-expanded) { display: none; }
      }
    `}</style>
    <header className="oy-nav-header oy-nav-surface">
      <div className="oy-nav-brand">{logo}<span>{title}</span></div>
      <button className="oy-nav-item oy-nav-toggle" type="button" aria-label={expanded ? '收起导航' : '展开导航'} aria-controls={menuId} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><Menu aria-hidden="true" /></button>
      <nav id={menuId} aria-label="应用导航" className={'oy-nav-menu' + (expanded ? ' is-expanded' : '')}>{items.map(item => <CanvasNavItem key={item.key} item={item} activeKey={activeKey} onSelect={onSelect ? (selected) => { setExpanded(false); onSelect(selected); } : undefined} />)}</nav>
      {actions}
    </header>
    <main className="oy-nav-content" aria-label={items.find(item => item.key === activeKey)?.label}>{children}</main>
  </div>;
}
