import React from 'react';

// Copy as MetricCard when composing. Data and comparison periods belong to the caller.
function metricNumber(value) {
  return Number.isFinite(value);
}

function metricSparkline(series) {
  if (!Array.isArray(series) || series.length < 2 || !series.every(metricNumber)) return null;
  const min = Math.min(...series);
  const max = Math.max(...series);
  return series.map((value, index) => [
    2 + index * 156 / (series.length - 1),
    max === min ? 16 : 28 - (value - min) * 24 / (max - min),
  ].join(',')).join(' ');
}

export default function YidaComp({ title = '指标', value, unit = '', prefix = '', note,
  delta, deltaLabel = '较上期', baseline, baselineLabel = '上期', higherIsBetter, target,
  series, seriesLabel = '区间走势', decoration, icon, loading, error, onRetry,
  appearance = 'light', emphasis = false, surface = 'plain', actions, cardAppearance, style }) {
  const valid = metricNumber(value);
  const hasBaseline = metricNumber(baseline);
  const change = hasBaseline
    ? valid && baseline > 0 ? (value - baseline) / baseline : null
    : delta;
  const hasChange = valid && metricNumber(change);
  const roundedChange = hasChange ? Math.round(Math.abs(change) * 1000) / 10 : 0;
  const direction = roundedChange === 0 ? 0 : Math.sign(change);
  const tone = direction && typeof higherIsBetter === 'boolean'
    ? (direction > 0) === higherIsBetter ? 'positive' : 'negative'
    : 'neutral';
  const progress = valid && metricNumber(target) && target > 0 && value >= 0
    ? value / target * 100 : null;
  const sparkline = valid ? metricSparkline(series) : null;
  const format = n => n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  const variant = emphasis ? 'featured' : surface === 'tint' ? 'tint' : 'plain';

  return <article className={'oy-metric ' + appearance + ' ' + variant}
    style={{ ...cardAppearance?.cardStyle, ...style }} aria-busy={!!loading}>
    <style>{`
      .oy-metric {
        --mc-bg:var(--analysis-surface,var(--pod-card-bg-color,#fff));
        --mc-ink:var(--analysis-ink,var(--color-text1-4,#172522));
        --mc-muted:var(--analysis-muted,var(--color-text1-3,#465d56));
        --mc-accent:var(--analysis-accent,var(--color-brand1-6,#148979));
        --mc-radius:var(--analysis-radius,var(--pod-card-border-radius,12px));
        --mc-good-bg:#dcf4e7;--mc-good:#14593e;--mc-bad-bg:#fbe9df;--mc-bad:#8b391e;
        --mc-flat-bg:#e9eeec;--mc-flat:#354842;
        position:relative;isolation:isolate;overflow:hidden;box-sizing:border-box;min-width:0;
        padding:16px 20px;border-radius:var(--mc-radius);background:var(--mc-bg);color:var(--mc-ink);
        font:14px/1.5 system-ui,sans-serif;container-type:inline-size;
      }
      .oy-metric.dark {
        --mc-bg:var(--analysis-surface,#192c46);--mc-ink:var(--analysis-ink,#edf5ff);
        --mc-muted:var(--analysis-muted,#b6c9df);--mc-accent:var(--analysis-accent,#77dbdc);
      }
      .oy-metric.tint {background:color-mix(in srgb,var(--mc-accent) 8%,var(--mc-bg))}
      .oy-metric.featured {
        background:linear-gradient(120deg,var(--analysis-hero-start,color-mix(in srgb,var(--mc-accent) 45%,#102b25)),
          var(--analysis-hero-end,color-mix(in srgb,var(--mc-accent) 55%,#102b25)));
        --mc-ink:#fff;--mc-muted:#edf8f4;
      }
      .oy-metric header,.oy-metric .mc-line,.oy-metric .mc-end {display:flex;align-items:center;gap:8px}
      .oy-metric header,.oy-metric .mc-end {justify-content:space-between}
      .oy-metric h3,.oy-metric p {margin:0}
      .oy-metric h3 {font-size:13px;font-weight:600;color:var(--mc-muted);overflow-wrap:anywhere}
      .oy-metric .mc-icon {
        display:grid;place-items:center;width:28px;height:28px;flex:none;border-radius:8px;
        color:var(--mc-ink);background:color-mix(in srgb,var(--mc-ink) 9%,transparent)
      }
      .oy-metric .mc-line {margin:9px 0 5px;flex-wrap:wrap}
      .oy-metric .mc-value {
        max-width:100%;overflow-wrap:anywhere;font-size:30px;font-weight:700;letter-spacing:-.045em;
        line-height:1.15;font-variant-numeric:tabular-nums
      }
      .oy-metric small,.oy-metric p {font-size:12px;color:var(--mc-muted);letter-spacing:0;font-weight:400}
      .oy-metric .mc-unit {white-space:nowrap}
      .oy-metric .mc-badge {
        display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:6px;
        background:var(--mc-flat-bg);color:var(--mc-flat);font-weight:650;font-size:12px;white-space:nowrap
      }
      .oy-metric .mc-badge.positive {background:var(--mc-good-bg);color:var(--mc-good)}
      .oy-metric .mc-badge.negative {background:var(--mc-bad-bg);color:var(--mc-bad)}
      .oy-metric .mc-end {margin-top:7px;flex-wrap:wrap}
      .oy-metric .mc-spark {width:100%;height:32px;color:var(--mc-accent);display:block;margin:4px 0}
      .oy-metric.featured .mc-spark {color:#b4efdb}
      .oy-metric progress {width:100%;height:6px;accent-color:var(--mc-accent)}
      .oy-metric .mc-decoration {
        position:absolute;z-index:-1;right:0;top:0;width:min(42%,144px);height:auto;
        color:var(--mc-accent);opacity:.12;pointer-events:none
      }
      .oy-metric.featured .mc-decoration {color:#d6fff2}
      .oy-metric .mc-retry {font:inherit;color:inherit;background:transparent;border:1px solid currentColor;border-radius:6px;padding:4px 8px;cursor:pointer}
      @container (max-width:185px) {.oy-metric .mc-value {font-size:24px}}
    `}</style>
    <header><h3>{title}</h3>{(icon || actions) && <span className="mc-line" style={{margin:0}}>
      {icon && <span className="mc-icon" aria-hidden="true">{icon}</span>}{actions}
    </span>}</header>
    {error ? <p role="alert">{String(error)} {onRetry && <button type="button" className="mc-retry" onClick={onRetry}>重试</button>}</p>
      : loading ? <p role="status">正在更新…</p>
      : <><div className="mc-line">
        <div className="mc-value">{valid ? prefix + format(value) : '—'} {valid && unit && <small className="mc-unit">{unit}</small>}</div>
        {hasChange && <span className={'mc-badge ' + tone} aria-label={deltaLabel + (direction > 0 ? '上升 ' : direction < 0 ? '下降 ' : '持平 ') + roundedChange.toFixed(1) + '%'}>
          <span aria-hidden="true">{direction > 0 ? '↑' : direction < 0 ? '↓' : '–'}</span>{roundedChange.toFixed(1)}%
        </span>}
      </div>
      {(hasChange || hasBaseline) && <p>{hasChange ? deltaLabel + (hasBaseline ? ' · ' : '') : ''}{hasBaseline ? baselineLabel + ' ' + prefix + format(baseline) + (unit ? ' ' + unit : '') : ''}
        {!hasChange && hasBaseline && baseline <= 0 && ' · 基准非正，无法计算变化率'}</p>}
      {sparkline && <svg className="mc-spark" viewBox="0 0 160 32" preserveAspectRatio="none" role="img" aria-label={seriesLabel}>
        <polygon points={'2,31 ' + sparkline + ' 158,31'} fill="currentColor" opacity=".12"/>
        <polyline points={sparkline} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
      </svg>}
      {progress !== null && <><progress value={Math.min(100, progress)} max={100} aria-label="目标完成进度"/>
        <p>目标 {prefix}{format(target)}{unit} · 实际完成 {progress.toFixed(1)}%</p></>}
      {note && <div className="mc-end"><small>{note}</small></div>}</>}
    {(decoration === 'contour' || (decoration === undefined && emphasis)) && <svg className="mc-decoration" viewBox="0 0 144 112" aria-hidden="true">
      <path d="M52 -26A75 75 0 0 0 168 70M64 -26A66 66 0 0 0 168 58M76 -26A57 57 0 0 0 168 46M88 -26A48 48 0 0 0 168 34M100 -26A39 39 0 0 0 168 22"
        fill="none" stroke="currentColor" strokeWidth="2"/>
    </svg>}
  </article>;
}
