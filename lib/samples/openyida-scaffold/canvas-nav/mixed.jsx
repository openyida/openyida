/** 两级导航；顶层 items.children 为子菜单，activeKey 使用当前叶子项 key。 */
function CanvasNav({ items = [], activeKey, onSelect, title, logo, actions, children, sidebarWidth, defaultCollapsed = false }) {
  const group = items.find(item => item.key === activeKey || (item.children || []).some(child => child.key === activeKey)) || items[0];
  return <div className="oy-canvas-nav oy-nav-mixed">
    <style>{CANVAS_NAV_CSS + `
      .oy-nav-mixed { display: flex; flex-direction: column; }
      .oy-nav-mixed .oy-nav-header { display: flex; flex-wrap: wrap; align-items: center; gap: var(--pod-nav-l-header-gap, 24px); padding: var(--pod-nav-l-header-padding, 8px 16px); border-bottom: 1px solid var(--pod-nav-sub-divider-color, var(--color-line1-1, #ddd)); }
      .oy-nav-mixed .oy-nav-groups { display: flex; flex: 1; min-width: 0; overflow-x: auto; }
      .oy-nav-mixed .oy-nav-body { display: flex; flex: 1; }
      .oy-nav-mixed .oy-nav-content { flex: 1; }
      .oy-nav-mixed .oy-nav-menu { display: flex; flex-direction: column; gap: var(--pod-nav-slide-aside-gap, 12px); }
      .oy-nav-mixed .oy-nav-item[aria-current="page"] { box-shadow: inset 0 -2px var(--pod-nav-tab-line-selected-color, var(--color-brand1-6, #1677ff)); }
      @media (max-width: 767px) {
        .oy-nav-mixed .oy-nav-groups { flex-basis: 100%; }
        .oy-nav-mixed .oy-nav-body { display: block; }
        .oy-nav-mixed .oy-nav-menu { flex-direction: row; overflow-x: auto; border-right: 0; border-bottom: 1px solid var(--pod-nav-sub-divider-color, var(--color-line1-1, #ddd)); }
      }
    `}</style>
    <header className="oy-nav-header oy-nav-surface">
      <div className="oy-nav-brand">{logo}<span>{title}</span></div>
      <nav className="oy-nav-groups" aria-label="业务分组">{items.map(item => {
        const target = item.children?.length ? item.children.find(child => !child.disabled) : item;
        return <CanvasNavItem key={item.key} item={{ ...item, disabled: item.disabled || !target, href: target?.href }} activeKey={group?.key} onSelect={onSelect && target ? () => onSelect(target) : undefined} />;
      })}</nav>
      {actions}
    </header>
    <div className="oy-nav-body">
      <CanvasSidebar activeKey={activeKey} defaultWidth={sidebarWidth} defaultCollapsed={defaultCollapsed}>
        <nav className="oy-nav-menu oy-nav-surface" aria-label={group?.label || '模块导航'}>{(group?.children || []).map(item => <CanvasNavItem key={item.key} item={item} activeKey={activeKey} onSelect={onSelect} />)}</nav>
      </CanvasSidebar>
      <main className="oy-nav-content" aria-label={group?.children?.find(item => item.key === activeKey)?.label || group?.label}>{children}</main>
    </div>
  </div>;
}
