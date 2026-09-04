import { Menu } from 'lucide-react';

/** 侧边导航；items 为扁平菜单，children 为现有业务内容，窄屏折叠为页内菜单。 */
function CanvasNav({ items = [], activeKey, onSelect, title, logo, actions, children }) {
  const [expanded, setExpanded] = React.useState(false);
  const menuId = React.useId();
  React.useEffect(() => setExpanded(false), [activeKey]);
  return <div className="oy-canvas-nav oy-nav-side">
    <style>{CANVAS_NAV_CSS + `
      .oy-nav-side { display: grid; grid-template-columns: var(--shell-dark-aside-width, 216px) minmax(0, 1fr); }
      .oy-nav-side .oy-nav-sidebar { border-right: 1px solid var(--pod-nav-sub-divider-color, var(--color-line1-1, #ddd)); padding: var(--pod-nav-l-aside-padding, 8px); }
      .oy-nav-side .oy-nav-brand { min-height: var(--pod-nav-platform-header-height, 48px); }
      .oy-nav-side .oy-nav-menu { display: flex; flex-direction: column; gap: var(--pod-nav-slide-aside-gap, 12px); }
      .oy-nav-side .oy-nav-item[aria-current="page"] { box-shadow: inset 3px 0 var(--pod-nav-tab-line-selected-color, var(--color-brand1-6, #1677ff)); }
      .oy-nav-side .oy-nav-toggle { display: none; margin-left: auto; }
      @media (max-width: 767px) {
        .oy-nav-side { display: block; }
        .oy-nav-side .oy-nav-sidebar { border-right: 0; border-bottom: 1px solid var(--pod-nav-sub-divider-color, var(--color-line1-1, #ddd)); }
        .oy-nav-side .oy-nav-toggle { display: flex; }
        .oy-nav-side .oy-nav-menu:not(.is-expanded) { display: none; }
      }
    `}</style>
    <aside className="oy-nav-sidebar oy-nav-surface">
      <div className="oy-nav-brand">{logo}<span>{title}</span><button className="oy-nav-item oy-nav-toggle" type="button" aria-label={expanded ? '收起导航' : '展开导航'} aria-controls={menuId} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><Menu aria-hidden="true" /></button></div>
      <nav id={menuId} aria-label="应用导航" className={'oy-nav-menu' + (expanded ? ' is-expanded' : '')}>
        {items.map(item => <CanvasNavItem key={item.key} item={item} activeKey={activeKey} onSelect={onSelect ? (selected) => { setExpanded(false); onSelect(selected); } : undefined} />)}
      </nav>
      {actions}
    </aside>
    <main className="oy-nav-content" aria-label={items.find(item => item.key === activeKey)?.label}>{children}</main>
  </div>;
}
