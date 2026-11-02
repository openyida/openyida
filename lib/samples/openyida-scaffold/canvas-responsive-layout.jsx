import React from 'react';

const DEFAULT_BREAKPOINTS = Object.freeze({ compact: 600, stacked: 768, wide: 1024 });

function getLayout(width, breakpoints) {
  if (width < breakpoints.compact) return 'compact';
  if (width < breakpoints.wide) return 'regular';
  return 'wide';
}

/**
 * Observe the actual content container instead of assuming it equals the browser viewport.
 * Updates are coalesced with requestAnimationFrame and only committed when width/bucket changes.
 */
function useContainerLayout(breakpoints = DEFAULT_BREAKPOINTS) {
  const rootRef = React.useRef(null);
  const frameRef = React.useRef(0);
  const [measurement, setMeasurement] = React.useState({ width: 0, layout: 'regular' });

  React.useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let active = true;
    const measure = () => {
      if (!active) return;
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = 0;
        if (!active) return;
        const width = Math.round(root.getBoundingClientRect().width);
        const layout = getLayout(width, breakpoints);
        setMeasurement(current => current.width === width && current.layout === layout
          ? current
          : { width, layout });
      });
    };
    measure();
    const observer = window.ResizeObserver ? new window.ResizeObserver(measure) : null;
    if (observer) observer.observe(root);
    else window.addEventListener('resize', measure);
    return () => {
      active = false;
      if (observer) observer.disconnect();
      else window.removeEventListener('resize', measure);
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    };
  }, [breakpoints.compact, breakpoints.wide]);

  return { rootRef, ...measurement };
}

/**
 * A reusable content shell for filters, primary/secondary panels, charts and wide tables.
 * Business state stays above this shell, so crossing a breakpoint never remounts it.
 */
function ResponsiveLayout({ filters, actions, primary, secondary, chart, table, breakpoints = DEFAULT_BREAKPOINTS }) {
  const { rootRef, width, layout } = useContainerLayout(breakpoints);
  return (
    <section ref={rootRef} className="oy-responsive-root" data-layout={layout} data-container-width={width || undefined}>
      <style>{`
        .oy-responsive-root { container: oy-content / inline-size; min-width: 0; display: grid; gap: var(--oy-section-gap, 16px); color: var(--color-text1-4, #1f2329); }
        .oy-responsive-root, .oy-responsive-root * { box-sizing: border-box; }
        .oy-responsive-filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 12px; align-items: end; min-width: 0; }
        .oy-responsive-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .oy-responsive-panels { display: grid; grid-template-columns: minmax(0, 2fr) minmax(240px, 1fr); gap: 16px; align-items: stretch; min-width: 0; }
        .oy-responsive-panel { min-width: 0; overflow-wrap: anywhere; }
        .oy-responsive-chart { min-width: 0; min-height: 240px; }
        .oy-responsive-table { min-width: 0; max-width: 100%; overflow-x: auto; overscroll-behavior-inline: contain; }
        .oy-responsive-table > table { width: 100%; min-width: 720px; border-collapse: collapse; }
        .oy-responsive-drawer-body { min-width: 0; container-type: inline-size; }
        @container oy-content (max-width: ${breakpoints.stacked - 1}px) {
          .oy-responsive-panels { grid-template-columns: minmax(0, 1fr); }
        }
        @container oy-content (max-width: ${breakpoints.compact - 1}px) {
          .oy-responsive-filters { grid-template-columns: minmax(0, 1fr); }
          .oy-responsive-actions > * { flex: 1 1 auto; min-width: 0; }
          .oy-responsive-chart { min-height: 200px; }
        }
      `}</style>
      <div className="oy-responsive-filters">{filters}<div className="oy-responsive-actions">{actions}</div></div>
      <div className="oy-responsive-panels">
        <div className="oy-responsive-panel">{primary}</div>
        <aside className="oy-responsive-panel">{secondary}</aside>
      </div>
      <div className="oy-responsive-chart" data-chart-width={width || undefined}>{chart}</div>
      <div className="oy-responsive-table" tabIndex={0} aria-label="可横向滚动的数据表格">{table}</div>
    </section>
  );
}

/** Example keeps filter state while the observed container crosses every breakpoint. */
export default function ResponsiveLayoutExample() {
  const [keyword, setKeyword] = React.useState('');
  return <ResponsiveLayout
    filters={<label>关键词<input value={keyword} onChange={event => setKeyword(event.target.value)} /></label>}
    actions={<><button type="button">查询</button><button type="button">清空</button></>}
    primary={<div>主内容面板</div>}
    secondary={<div>辅助信息与超长编号：OPENYIDA-RESPONSIVE-CONTAINER-CONTENT-IDENTIFIER</div>}
    chart={<div role="img" aria-label="图表区域">图表应按 data-chart-width 调用自身 resize</div>}
    table={<table><thead><tr><th>名称</th><th>状态</th><th>负责人</th><th>操作</th></tr></thead><tbody><tr><td>示例记录</td><td>进行中</td><td>当前用户</td><td><button type="button">查看</button></td></tr></tbody></table>}
  />;
}

export { DEFAULT_BREAKPOINTS, ResponsiveLayout, getLayout, useContainerLayout };
