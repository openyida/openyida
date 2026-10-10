import { Menu } from 'lucide-react';

/** 顶部导航默认贴边通栏；明确选择悬浮样式时传 floating=true。窄屏可展开菜单。 */
function CanvasNav({ items = [], activeKey, onSelect, title, logo, actions, children, floating = false, headerOnly = false, overlay = false }) {
  const [expanded, setExpanded] = React.useState(false);
  const menuId = React.useId();
  React.useEffect(() => setExpanded(false), [activeKey]);
  return <div className={'oy-canvas-nav oy-nav-top' + (floating ? ' is-floating' : '') + (headerOnly ? ' is-header-only' : '') + (overlay ? ' is-overlay' : '')}>
    <style>{CANVAS_NAV_CSS + `
      .oy-nav-top .oy-nav-header { box-sizing: border-box; min-height: var(--pod-nav-platform-header-height, 48px); display: flex; flex-wrap: wrap; align-items: center; gap: var(--pod-nav-top-header-gap, 24px); padding: var(--pod-nav-top-header-padding, 8px 16px); border-bottom: 1px solid var(--pod-nav-sub-divider-color, var(--color-line1-1, #ddd)); }
      .oy-nav-top.is-header-only { min-height: 0; background: transparent; }
      .openyida-nav-layout[data-layout="document"][data-scrolled="false"] .oy-nav-top.is-overlay .oy-nav-header:not(.is-expanded) { background: transparent; color: var(--openyida-navigation-overlay-color, #fff); border-color: transparent; }
      .openyida-nav-layout[data-layout="document"][data-scrolled="false"] .oy-nav-top.is-overlay .oy-nav-header:not(.is-expanded) .oy-nav-brand,
      .openyida-nav-layout[data-layout="document"][data-scrolled="false"] .oy-nav-top.is-overlay .oy-nav-header:not(.is-expanded) .oy-nav-item:not(:disabled) { color: inherit; }
      .openyida-nav-layout[data-layout="document"][data-scrolled="false"] .oy-nav-top.is-overlay .oy-nav-header:not(.is-expanded) .oy-nav-item:is(:hover,[aria-current="page"]):not(:disabled) { background: var(--openyida-navigation-overlay-active-bg, rgba(255,255,255,.16)); }
      .oy-nav-top.is-floating { padding-top: 16px; box-sizing: border-box; }
      .oy-nav-top.is-floating .oy-nav-header { position: sticky; top: 16px; z-index: 10; margin: 0 16px; border: 1px solid var(--pod-nav-sub-divider-color, var(--color-line1-1, #ddd)); border-radius: var(--pod-shell-lshape-border-radius, 16px); box-shadow: var(--pod-nav-popup-shadow, 0 8px 24px rgba(0,0,0,.12)); }
      .oy-nav-top .oy-nav-menu { display: flex; flex: 1; min-width: 0; gap: var(--pod-nav-menu-gap, 8px); padding: calc(var(--pod-nav-menu-gap, 8px) / 2); overflow-x: auto; }
      .oy-nav-top .oy-nav-menu .oy-nav-item { min-height: var(--pod-nav-top-tab-height, 40px); padding: var(--pod-nav-top-tab-item-padding, 0 12px); max-width: var(--pod-nav-top-tab-item-max-width, 240px); }
      .oy-nav-top .oy-nav-menu .oy-nav-item > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .oy-nav-top .oy-nav-toggle { display: none; margin-left: auto; }
      @media (max-width: 767px) {
        .oy-nav-top .oy-nav-header { gap: var(--pod-nav-logo-gap, 8px); }
        .oy-nav-top .oy-nav-toggle { display: flex; }
        .oy-nav-top .oy-nav-menu { order: 1; flex-basis: 100%; flex-direction: column; }
        .oy-nav-top .oy-nav-menu:not(.is-expanded) { display: none; }
      }
    `}</style>
    <header className={'oy-nav-header oy-nav-surface' + (expanded ? ' is-expanded' : '')}>
      <div className="oy-nav-brand">{logo}<span>{title}</span></div>
      <button className="oy-nav-item oy-nav-toggle" type="button" aria-label={expanded ? '收起导航' : '展开导航'} aria-controls={menuId} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><Menu aria-hidden="true" /></button>
      <nav id={menuId} aria-label="应用导航" className={'oy-nav-menu' + (expanded ? ' is-expanded' : '')}>{items.map(item => <CanvasNavItem key={item.key} item={item} activeKey={activeKey} onSelect={onSelect ? (selected) => { setExpanded(false); onSelect(selected); } : undefined} />)}</nav>
      {actions}
    </header>
    {!headerOnly && <main className="oy-nav-content" aria-label={items.find(item => item.key === activeKey)?.label}>{children}</main>}
  </div>;
}
