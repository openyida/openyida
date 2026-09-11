import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

/** 侧栏宽度与折叠状态由组件维护；移动端使用独立的菜单展开状态。 */
function CanvasSidebar({ children, title, logo, actions, activeKey, defaultWidth, defaultCollapsed = false }) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [width, setWidth] = React.useState(null);
  const [viewport, setViewport] = React.useState(() => window.innerWidth);
  const [resizing, setResizing] = React.useState(false);
  const [measuredWidth, setMeasuredWidth] = React.useState(216);
  const sidebar = React.useRef(null);
  const drag = React.useRef(null);
  const menuId = React.useId();
  const mobile = viewport < 768;
  const minWidth = 180;
  const maxWidth = Math.min(400, Math.floor(viewport * 0.45));
  const clamp = value => Math.max(minWidth, Math.min(maxWidth, value));
  const expanded = mobile ? mobileOpen : !collapsed;
  const ToggleIcon = mobile ? Menu : collapsed ? PanelLeftOpen : PanelLeftClose;

  function finishResize() {
    const current = drag.current;
    drag.current = null;
    if (current?.handle.hasPointerCapture(current.id)) current.handle.releasePointerCapture(current.id);
    setResizing(false);
  }
  React.useEffect(() => {
    const resize = () => { finishResize(); setViewport(window.innerWidth); };
    window.addEventListener('resize', resize);
    window.addEventListener('blur', finishResize);
    return () => { window.removeEventListener('resize', resize); window.removeEventListener('blur', finishResize); finishResize(); };
  }, []);
  React.useEffect(() => setMobileOpen(false), [activeKey]);
  React.useLayoutEffect(() => {
    const observer = new window.ResizeObserver(() => setMeasuredWidth(Math.round(sidebar.current.getBoundingClientRect().width)));
    observer.observe(sidebar.current);
    return () => observer.disconnect();
  }, []);

  return <aside ref={sidebar} className="oy-nav-sidebar oy-nav-surface" data-collapsed={collapsed} data-mobile-open={mobileOpen}
    onClick={event => { if (mobile && event.target.closest('.oy-nav-menu .oy-nav-item')) setMobileOpen(false); }}
    style={{ '--oy-sidebar-width': width === null ? (typeof defaultWidth === 'number' ? `${defaultWidth}px` : defaultWidth) : `${clamp(width)}px`, '--oy-sidebar-max-width': `${maxWidth}px` }}>
    <style>{`
      .oy-canvas-nav .oy-nav-sidebar { position: relative; box-sizing: border-box; flex: 0 0 auto; min-width: 0; width: clamp(180px, var(--oy-sidebar-width, var(--shell-dark-aside-width, 216px)), var(--oy-sidebar-max-width, 400px)); padding: var(--pod-nav-l-aside-padding, 8px); border-right: 1px solid var(--pod-nav-sub-divider-color, var(--color-line1-1, #ddd)); }
      .oy-canvas-nav .oy-sidebar-toggle { margin-left: auto; flex-shrink: 0; justify-content: center; padding: 0 8px; }
      .oy-canvas-nav .oy-sidebar-items { min-width: 0; }
      .oy-canvas-nav .oy-nav-sidebar .oy-nav-item > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .oy-canvas-nav .oy-sidebar-resize { position: absolute; z-index: 2; top: 0; right: -4px; bottom: 0; width: 8px; cursor: col-resize; touch-action: none; }
      .oy-canvas-nav .oy-sidebar-resize:hover, .oy-canvas-nav .oy-sidebar-resize:focus-visible { background: var(--pod-nav-tab-line-selected-color, var(--color-brand1-6, #1677ff)); outline: 0; }
      .oy-canvas-nav .oy-sidebar-drag-cover { position: fixed; inset: 0; z-index: 9999; cursor: col-resize; user-select: none; }
      @media (min-width: 768px) {
        .oy-canvas-nav .oy-nav-sidebar[data-collapsed="true"] { width: var(--pod-nav-side-collapsed-width, 56px); }
        .oy-canvas-nav .oy-nav-sidebar[data-collapsed="true"] .oy-nav-brand { padding: 0; }
        .oy-canvas-nav .oy-nav-sidebar[data-collapsed="true"] .oy-nav-brand > :not(.oy-sidebar-toggle),
        .oy-canvas-nav .oy-nav-sidebar[data-collapsed="true"] .oy-sidebar-actions,
        .oy-canvas-nav .oy-nav-sidebar[data-collapsed="true"] .oy-nav-item[data-has-icon="true"] > span { display: none; }
        .oy-canvas-nav .oy-nav-sidebar[data-collapsed="true"] .oy-nav-item { justify-content: center; padding: 0 4px; }
      }
      @media (max-width: 767px) {
        .oy-canvas-nav .oy-nav-sidebar { width: 100%; border-right: 0; border-bottom: 1px solid var(--pod-nav-sub-divider-color, var(--color-line1-1, #ddd)); }
        .oy-canvas-nav .oy-nav-sidebar[data-mobile-open="false"] .oy-sidebar-items,
        .oy-canvas-nav .oy-nav-sidebar[data-mobile-open="false"] .oy-sidebar-actions { display: none; }
        .oy-canvas-nav .oy-sidebar-resize { display: none; }
      }
    `}</style>
    <div className="oy-nav-brand">{logo}{title ? <span>{title}</span> : null}
      <button className="oy-nav-item oy-sidebar-toggle" type="button" title={expanded ? '收起导航' : '展开导航'}
        aria-label={expanded ? '收起导航' : '展开导航'} aria-expanded={expanded} aria-controls={menuId}
        onClick={() => mobile ? setMobileOpen(!mobileOpen) : setCollapsed(!collapsed)}><ToggleIcon aria-hidden="true" /></button>
    </div>
    <div id={menuId} className="oy-sidebar-items">{children}</div>
    {actions ? <div className="oy-sidebar-actions">{actions}</div> : null}
    {!mobile && !collapsed ? <div className="oy-sidebar-resize" role="separator" aria-label="调整导航宽度" aria-orientation="vertical"
      aria-valuemin={minWidth} aria-valuemax={maxWidth} aria-valuenow={measuredWidth} tabIndex={0}
      onPointerDown={event => {
        if (event.button !== 0 || drag.current) return;
        event.preventDefault();
        const handle = event.currentTarget;
        drag.current = { handle, id: event.pointerId, x: event.clientX, width: sidebar.current.getBoundingClientRect().width };
        handle.setPointerCapture(event.pointerId);
        setResizing(true);
      }}
      onPointerMove={event => {
        const current = drag.current;
        if (current?.id === event.pointerId) setWidth(clamp(current.width + event.clientX - current.x));
      }}
      onPointerUp={finishResize} onPointerCancel={finishResize} onLostPointerCapture={finishResize}
      onDoubleClick={() => setWidth(null)}
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        setWidth(event.key === 'Home' ? minWidth : event.key === 'End' ? maxWidth : clamp(sidebar.current.getBoundingClientRect().width + (event.key === 'ArrowLeft' ? -24 : 24)));
      }} /> : null}
    {resizing ? <div className="oy-sidebar-drag-cover" aria-hidden="true" /> : null}
  </aside>;
}
