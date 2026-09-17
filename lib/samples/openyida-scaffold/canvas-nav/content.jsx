import React from 'react';

/**
 * workspace 保持原有剩余高度布局；document 用于首屏背景与导航共享画布的连续长页。
 * document 首屏内容使用 --openyida-navigation-height 留安全区，背景仍从页面顶部开始。
 * preserveScroll 只恢复当前实例内本地视图的位置；筛选、数据、草稿和路由由调用方持有。
 * 导航节点不随 contentKey 重建；不要给整个壳添加随菜单变化的 key。
 */
function CanvasNavigationContent({
  navigation,
  children,
  iframeSrc,
  title = '页面内容',
  contentKey,
  height = '100dvh',
  maxWidth = 1280,
  gutter = 'clamp(12px, 2vw, 24px)',
  radius = 16,
  background = 'transparent',
  layout = 'workspace',
  preserveScroll = false,
  navigationPosition = 'sticky',
  navigationTop = 0,
  utils,
}) {
  const embedded = Boolean(iframeSrc);
  const YidaCanvasIframe = window.YidaCanvasIframe;
  const documentLayout = layout === 'document';
  const rootRef = React.useRef(null);
  const navigationRef = React.useRef(null);
  const contentRef = React.useRef(null);
  const scrollPositions = React.useRef(new Map());

  // 测量真实菜单高度，兼容窄屏换行、字体加载和菜单展开，不猜固定的 80px。
  React.useLayoutEffect(() => {
    if (!documentLayout) return;
    const root = rootRef.current;
    const nav = navigationRef.current;
    if (!root) return;
    const navStyle = nav ? { position: nav.style.position, left: nav.style.left, width: nav.style.width, top: nav.style.top } : null;
    const measure = () => {
      const navHeight = nav?.getBoundingClientRect().height || 0;
      root.style.setProperty('--openyida-navigation-height', `${navHeight}px`);
      const bounds = root.getBoundingClientRect();
      // scroll 事件捕获覆盖宿主内滚动；不假设 window.scrollY 是实际滚动位置。
      let boundary = 0;
      for (let ancestor = root.parentElement; ancestor; ancestor = ancestor.parentElement) {
        if (/(auto|scroll)/.test(window.getComputedStyle(ancestor).overflowY)) {
          boundary = ancestor.getBoundingClientRect().top + ancestor.clientTop;
          break;
        }
      }
      const top = Math.max(0, boundary) + navigationTop;
      root.dataset.scrolled = String(bounds.top < top - 1);
      if (nav && navigationPosition === 'fixed') {
        // 仅覆盖本页宽度，不能盖住平台侧栏；离开页面底部后随本页退出。
        Object.assign(nav.style, { position: 'fixed', left: `${bounds.left}px`, width: `${bounds.width}px`,
          top: `${Math.min(Math.max(bounds.top, top), bounds.bottom - navHeight)}px` });
      }
    };
    measure();
    const observer = nav && window.ResizeObserver ? new window.ResizeObserver(measure) : null;
    if (observer) observer.observe(nav);
    if (observer) observer.observe(root);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      if (navStyle) Object.assign(nav.style, navStyle);
    };
  }, [documentLayout, navigation != null, navigationPosition, navigationTop]);

  React.useLayoutEffect(() => {
    const viewport = contentRef.current;
    if (documentLayout || embedded || !preserveScroll || contentKey == null || !viewport) return;
    const position = scrollPositions.current.get(contentKey);
    viewport.scrollTop = position?.top || 0;
    viewport.scrollLeft = position?.left || 0;
  }, [contentKey, documentLayout, embedded, preserveScroll]);

  if (documentLayout && embedded) throw new Error('CanvasNavigationContent: iframeSrc requires workspace layout');
  if (!['sticky', 'fixed'].includes(navigationPosition)) throw new Error('CanvasNavigationContent: navigationPosition must be sticky or fixed');
  return (
    <div ref={rootRef} className="openyida-nav-layout" data-layout={layout} data-scrolled="true" style={{
      height: documentLayout ? 'auto' : height, minHeight: documentLayout ? 'auto' : 0, minWidth: 0,
      display: documentLayout ? 'grid' : 'flex', flexDirection: 'column',
      // 长页不创建第二层滚动容器；导航和 main 共享网格区域，背景可到达导航背后。
      overflow: documentLayout ? 'visible' : 'hidden', background,
      position: 'relative', isolation: 'isolate',
    }}>
      {navigation != null && <div ref={navigationRef} className="openyida-nav-header" style={{
        flexShrink: 0, minWidth: 0, zIndex: 10,
        ...(documentLayout ? { gridArea: '1 / 1', alignSelf: 'start', position: 'sticky', top: navigationTop } : {}),
      }}>{navigation}</div>}
      <main className="openyida-nav-main" aria-label={title} style={{
        display: documentLayout ? 'block' : 'flex', flexDirection: 'column',
        flex: documentLayout ? undefined : '1 1 0', minHeight: documentLayout ? 'auto' : 0,
        minWidth: 0, overflow: documentLayout ? 'visible' : 'hidden',
        padding: documentLayout ? 0 : gutter, boxSizing: 'border-box',
        ...(documentLayout ? { gridArea: '1 / 1' } : {}),
      }}>
        <div key={contentKey} ref={contentRef} className="openyida-nav-content" onScroll={event => {
          // 卸载后 DOM 的 scrollTop 可能已归零，必须在滚动时保存，不能等 effect cleanup。
          if (!documentLayout && !embedded && preserveScroll && contentKey != null) {
            const viewport = event.currentTarget;
            scrollPositions.current.set(contentKey, { top: viewport.scrollTop, left: viewport.scrollLeft });
          }
        }} style={{
          position: 'relative', flex: documentLayout ? undefined : '1 1 0', minHeight: documentLayout ? 'auto' : 0, minWidth: 0,
          width: '100%', maxWidth: documentLayout ? undefined : maxWidth,
          margin: '0 auto', borderRadius: documentLayout ? 0 : radius,
          overflow: documentLayout ? 'visible' : embedded ? 'hidden' : 'auto',
        }}>
          {embedded ? YidaCanvasIframe ? <YidaCanvasIframe title={title} src={iframeSrc} style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            display: 'block', border: 0,
          }} /> : <div role="status" style={{ padding: 24 }}>
            <p>暂时无法在此处打开。</p>
            <button type="button" onClick={() => {
              const pageUtils = utils || window.__OPENYIDA_UTILS__;
              if (typeof pageUtils?.openPage === 'function') return pageUtils.openPage(iframeSrc);
              return window.open(iframeSrc, '_blank', 'noopener,noreferrer');
            }}>在新窗口打开</button>
          </div> : children}
        </div>
      </main>
    </div>
  );
}
