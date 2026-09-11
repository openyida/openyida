/** 悬浮导航；内容区预留底部空间，窄屏菜单可横向滚动。 */
function CanvasNav({ items = [], activeKey, onSelect, title, logo, actions, children }) {
  return <div className="oy-canvas-nav oy-nav-dock">
    <style>{CANVAS_NAV_CSS + `
      .oy-nav-dock .oy-nav-header { display: flex; align-items: center; justify-content: space-between; padding: var(--pod-nav-top-header-padding, 8px 16px); }
      .oy-nav-dock .oy-nav-content { padding-bottom: calc(var(--pod-nav-menu-item-height, 40px) + 64px + env(safe-area-inset-bottom)); }
      .oy-nav-dock .oy-nav-menu { position: fixed; z-index: 10; left: 50%; bottom: calc(16px + env(safe-area-inset-bottom)); transform: translateX(-50%); display: flex; gap: var(--pod-nav-slide-collapsed-menu-gap, 4px); max-width: calc(100% - 32px); overflow-x: auto; padding: 6px; border: 1px solid var(--pod-nav-sub-divider-color, var(--color-line1-1, #ddd)); border-radius: var(--pod-nav-platform-action-radius, 999px); box-shadow: var(--pod-nav-popup-shadow, 0 8px 24px rgba(0,0,0,.12)); }
    `}</style>
    <header className="oy-nav-header oy-nav-surface"><div className="oy-nav-brand">{logo}<span>{title}</span></div>{actions}</header>
    <main className="oy-nav-content" aria-label={items.find(item => item.key === activeKey)?.label}>{children}</main>
    <nav className="oy-nav-menu oy-nav-surface" aria-label="应用导航">{items.map(item => <CanvasNavItem key={item.key} item={item} activeKey={activeKey} onSelect={onSelect} />)}</nav>
  </div>;
}
