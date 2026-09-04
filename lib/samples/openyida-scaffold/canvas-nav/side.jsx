/** 侧边导航；items 为扁平菜单，children 为现有业务内容。 */
function CanvasNav({ items = [], activeKey, onSelect, title, logo, actions, children, sidebarWidth, defaultCollapsed = false }) {
  return <div className="oy-canvas-nav oy-nav-side">
    <style>{CANVAS_NAV_CSS + `
      .oy-nav-side { display: flex; }
      .oy-nav-side .oy-nav-content { flex: 1; }
      .oy-nav-side .oy-nav-brand { min-height: var(--pod-nav-platform-header-height, 48px); }
      .oy-nav-side .oy-nav-menu { display: flex; flex-direction: column; gap: var(--pod-nav-slide-aside-gap, 12px); }
      .oy-nav-side .oy-nav-item[aria-current="page"] { box-shadow: inset 3px 0 var(--pod-nav-tab-line-selected-color, var(--color-brand1-6, #1677ff)); }
      @media (max-width: 767px) { .oy-nav-side { display: block; } }
    `}</style>
    <CanvasSidebar title={title} logo={logo} actions={actions} activeKey={activeKey} defaultWidth={sidebarWidth} defaultCollapsed={defaultCollapsed}>
      <nav aria-label="应用导航" className="oy-nav-menu">
        {items.map(item => <CanvasNavItem key={item.key} item={item} activeKey={activeKey} onSelect={onSelect} />)}
      </nav>
    </CanvasSidebar>
    <main className="oy-nav-content" aria-label={items.find(item => item.key === activeKey)?.label}>{children}</main>
  </div>;
}
