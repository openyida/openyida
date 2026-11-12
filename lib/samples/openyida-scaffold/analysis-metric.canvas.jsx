import React from 'react';

// A single editable metric, not a page. Rename YidaComp to MetricCard when composing.
// value/delta/target must come from an authorized aggregate result; missing is not zero.
export default function YidaComp({ title = '指标', value, unit = '', note,
  delta, deltaLabel = '较上期', target, loading, error, onRetry,
  appearance = 'light', emphasis = false, actions, cardAppearance, style }) {
  const valid = typeof value === 'number' && Number.isFinite(value);
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const progress = valid && Number.isFinite(target) && target > 0 && value >= 0
    ? Math.min(100, value / target * 100) : null;
  return <article className={'oy-metric ' + appearance + (emphasis ? ' emphasis' : '')}
    style={{ ...cardAppearance?.cardStyle, ...style }} aria-busy={!!loading}>
    <style>{`
      .oy-metric{--mc-bg:var(--analysis-surface,var(--pod-card-bg-color,#fff));--mc-ink:var(--analysis-ink,var(--color-text1-4,#203b38));--mc-muted:var(--analysis-muted,#667d79);--mc-accent:var(--analysis-accent,var(--color-brand1-6,#148979));position:relative;isolation:isolate;overflow:hidden;min-width:0;padding:22px 24px;border-radius:var(--analysis-radius,12px);background:var(--mc-bg);color:var(--mc-ink);font:14px/1.6 system-ui,sans-serif}
      .oy-metric.dark{--mc-bg:var(--analysis-surface,#192c46);--mc-ink:var(--analysis-ink,#edf5ff);--mc-muted:var(--analysis-muted,#a4b6ce);--mc-accent:var(--analysis-accent,#41c6d4)}
      .oy-metric.emphasis{background:linear-gradient(115deg,var(--analysis-hero-start,#126c61),var(--analysis-hero-end,#279b87));--mc-ink:#fff;--mc-muted:#ffffffd9;--mc-accent:#fff}.oy-metric.dark.emphasis{background:linear-gradient(115deg,var(--analysis-hero-start,#235aa7),var(--analysis-hero-end,#198794))}
      .oy-metric header{display:flex;align-items:center;justify-content:space-between;gap:12px}.oy-metric h3{margin:0;font-size:13px;font-weight:500;color:var(--mc-muted)}.oy-metric .mc-value{margin:14px 0 8px;font-size:36px;font-weight:650;letter-spacing:-1px;line-height:1.2;font-variant-numeric:tabular-nums}.oy-metric small{font-size:12px;color:var(--mc-muted);letter-spacing:0;font-weight:400}.oy-metric p{margin:6px 0 0;font-size:12px;color:var(--mc-muted)}.oy-metric progress{width:100%;height:5px;accent-color:var(--mc-accent)}.oy-metric svg{position:absolute;z-index:-1;right:-24px;bottom:-35px;width:160px;color:var(--mc-accent);opacity:.12;pointer-events:none}.oy-metric button{font:inherit;color:inherit;background:transparent;border:1px solid currentColor;border-radius:6px;padding:4px 8px;cursor:pointer}
    `}</style>
    <header><h3>{title}</h3>{actions}</header>
    {error ? <p role="alert">{String(error)} {onRetry && <button onClick={onRetry}>重试</button>}</p>
      : loading ? <p role="status">正在更新…</p>
      : <><div className="mc-value">{valid ? value.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : '—'} <small>{unit}</small></div>
        {hasDelta && <p>{deltaLabel} {delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)}% · 请按指标口径解读</p>}
        {progress !== null && <><progress value={progress} max={100} aria-label="目标完成进度" /><p>目标 {target.toLocaleString('zh-CN')} · 实际完成 {(value / target * 100).toFixed(1)}%</p></>}
        {note && <p>{note}</p>}</>}
    {emphasis && <svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="65" fill="none" stroke="currentColor" strokeWidth="16"/><path d="M0 140L60 70L100 90L160 20" fill="none" stroke="currentColor" strokeWidth="3"/></svg>}
  </article>;
}
