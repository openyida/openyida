import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// Editable content, shared by report renderCard.source and YidaAnalysisCard renderContent.
// Set temporal only after binding a chronological date dimension. Export scope is explicit.
// Icons based on Lucide (ISC): https://lucide.dev/license
function AnalysisAction({ label, kind, onClick, disabled }) {
  return <button type="button" className="oy-analysis-icon" aria-label={label} title={label}
    onClick={onClick} disabled={disabled}>
    <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {kind === 'refresh' ? <path d="M20 7v5h-5M4 17v-5h5m-5 0a8 8 0 0 1 14-5l2 5M4 12l2 5a8 8 0 0 0 14-5" />
        : kind === 'image' ? <path d="M4 4h16v16H4zM4 16l5-5 4 4 2-2 5 5" />
        : <path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" />}
    </svg>
  </button>;
}

export default function YidaComp({
  analysis = {},
  temporal = false,
  variant = 'overview',
  appearance = 'light',
}) {
  const {
    rows = [],
    displayRows = rows,
    columns = [],
    title = '项目预算分析',
    loading,
    error,
    refresh,
    select,
    canDrill = !!select,
    details,
    back,
    drillPath = [],
  } = analysis;
  const [tab, setTab] = useState('chart');
  const [selected, setSelected] = useState(null);
  const [range, setRange] = useState(null);
  const [notice, setNotice] = useState('');
  const root = useRef(null);
  const dimension = columns.find((c) => !c.numeric);
  const metrics = columns.filter((c) => c.numeric);
  const [metricKey, setMetricKey] = useState('');
  const metric = metrics.find((c) => c.key === metricKey) || metrics[0];
  const format = (value) =>
    value == null
      ? '—'
      : typeof value === 'number'
      ? value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
      : String(value);
  const compact = (value) =>
    value == null
      ? '—'
      : new Intl.NumberFormat('zh-CN', {
          notation: 'compact',
          maximumFractionDigits: 1,
        }).format(value);
  const data = useMemo(
    () =>
      rows.map((raw, i) => ({
        raw,
        i,
        label: dimension
          ? format((displayRows[i] || raw)[dimension.key])
          : '汇总',
        value:
          metric &&
          typeof raw[metric.key] === 'number' &&
          Number.isFinite(raw[metric.key])
            ? raw[metric.key]
            : null,
      })),
    [rows, displayRows, dimension?.key, metric?.key]
  );
  const signature = JSON.stringify(data.map((d) => [d.label, d.value]));
  useEffect(() => {
    setSelected(null);
    setRange(null);
  }, [signature]);
  const ranged = range
    ? data.slice(range.startIndex, range.endIndex + 1)
    : data;
  const visible =
    selected === null ? ranged : ranged.filter((d) => d.i === selected);
  const valid = visible.filter((d) => d.value !== null);
  const allValid = ranged.filter((d) => d.value !== null);
  const top = valid.reduce((a, b) => (!a || b.value > a.value ? b : a), null);
  const shareable =
    allValid.length > 0 &&
    allValid.every((d) => d.value >= 0) &&
    allValid.some((d) => d.value > 0);
  const sum = valid.reduce((n, d) => n + d.value, 0);
  const total = allValid.reduce((n, d) => n + d.value, 0);
  const chosen = data.find((d) => d.i === selected);
  const colors = [
    'var(--accent)',
    'var(--series-2)',
    'var(--series-3)',
    'var(--series-4)',
  ];
  const tooltipStyle = { background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 8 };
  const choose = (item) => {
    const d = item?.payload || item;
    if (d && Number.isInteger(d.i))
      setSelected((old) => (old === d.i ? null : d.i));
  };
  const download = (contents, type, suffix) => {
    const url = window.URL.createObjectURL(
      new window.Blob([contents], { type })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analysis-current.' + suffix;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  };
  const csvCell = value => {
    const text = String(value ?? '');
    const safe = typeof value !== 'number' && /^[\s]*[=+@-]|^[\t\r\n]/.test(text) ? "'" + text : text;
    return '"' + safe.replace(/"/g, '""') + '"';
  };
  const exportCsv = () => {
    const lines = [
      columns.map((c) => csvCell(c.title || c.key)).join(','),
      ...visible.map((d) =>
        columns.map((c) => csvCell(d.raw[c.key])).join(',')
      ),
    ];
    download('\uFEFF' + lines.join('\r\n'), 'text/csv;charset=utf-8', 'csv');
    setNotice('已导出当前可见结果，共 ' + visible.length + ' 行');
  };
  const exportSvg = () => {
    const svg = root.current?.querySelector('[data-export-chart] svg');
    if (!svg) {
      setNotice('当前没有可下载的图形');
      return;
    }
    const clone = svg.cloneNode(true);
    [svg, ...svg.querySelectorAll('*')].forEach((node, i) => {
      const target = [clone, ...clone.querySelectorAll('*')][i];
      const style = window.getComputedStyle(node);
      [
        'fill',
        'stroke',
        'font-family',
        'font-size',
        'font-weight',
        'color',
        'opacity',
      ].forEach((key) =>
        target.style.setProperty(key, style.getPropertyValue(key))
      );
    });
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    background.setAttribute('width', '100%');
    background.setAttribute('height', '100%');
    background.setAttribute('fill', window.getComputedStyle(svg.closest('[data-export-chart]')).backgroundColor);
    clone.insertBefore(background, clone.firstChild);
    download(
      new window.XMLSerializer().serializeToString(clone),
      'image/svg+xml;charset=utf-8',
      'svg'
    );
    setNotice('已下载当前主图 SVG');
  };
  return (
    <section
      ref={root}
      className={'oy-explorer ' + variant + ' ' + appearance}
      aria-busy={!!loading}
    >
      <style>{`
      .oy-explorer .actions button.oy-analysis-icon{display:inline-grid;place-items:center;min-width:36px;min-height:36px;padding:0;border:0;border-radius:8px;background:transparent;color:inherit;cursor:pointer;touch-action:manipulation}.oy-explorer .actions button.oy-analysis-icon:hover:not(:disabled),.oy-explorer .actions button.oy-analysis-icon:focus-visible{background:var(--color-fill1-2,#f2f5f5)}.oy-explorer .actions button.oy-analysis-icon:focus-visible{outline:2px solid var(--color-brand1-6,#147d73);outline-offset:2px}.oy-explorer .actions button.oy-analysis-icon:disabled{opacity:.45;cursor:default}@media(pointer:coarse){.oy-explorer .actions button.oy-analysis-icon{min-width:44px;min-height:44px}}
      .oy-explorer{container-type:inline-size;--accent:var(--analysis-accent,var(--color-brand1-6,#148979));--series-2:var(--analysis-series-2,#e6a04b);--series-3:var(--analysis-series-3,#7199b5);--series-4:var(--analysis-series-4,#9b8abf);--surface:var(--analysis-surface,var(--pod-card-bg-color,#fff));--canvas:var(--analysis-canvas,#edf3f2);--ink:var(--analysis-ink,var(--color-text1-4,#203b38));--muted:var(--analysis-muted,#667d79);--line:var(--analysis-line,#dce8e4);--soft:var(--analysis-soft,#e5f1ed);--radius:var(--analysis-radius,12px);color:var(--ink);font:14px/1.6 system-ui,sans-serif;min-width:0;background:var(--canvas);padding:24px;border-radius:16px}
      .oy-explorer.dark{color-scheme:dark;--accent:var(--analysis-accent,#41c6d4);--series-2:var(--analysis-series-2,#efb86b);--series-3:var(--analysis-series-3,#7396ef);--series-4:var(--analysis-series-4,#b29ae7);--surface:var(--analysis-surface,#192c46);--canvas:var(--analysis-canvas,#101e33);--ink:var(--analysis-ink,#edf5ff);--muted:var(--analysis-muted,#a4b6ce);--line:var(--analysis-line,#2b415d);--soft:var(--analysis-soft,#233c54)}
      .oy-explorer *{box-sizing:border-box}.oy-explorer h2,.oy-explorer h3,.oy-explorer p{margin:0}.oy-explorer h2{color:var(--ink);font-size:24px;letter-spacing:-.6px}.oy-explorer h3{color:var(--ink);font-size:15px;display:flex;align-items:center;gap:8px}.oy-explorer h3:before{content:'';width:3px;height:14px;border-radius:2px;background:var(--accent)}.oy-explorer .eyebrow{font-size:10px;letter-spacing:2.5px;color:var(--accent);font-weight:700}.oy-explorer .muted{font-size:12px;color:var(--muted)}
      .oy-explorer .head,.oy-explorer .toolbar,.oy-explorer .row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.oy-explorer .head{padding:4px 0 8px}.oy-explorer .actions{display:flex;gap:6px;flex-wrap:wrap}.oy-explorer button,.oy-explorer select{font:inherit;font-size:12px;padding:7px 12px;border:1px solid var(--line);border-radius:7px;background:var(--surface);color:inherit;cursor:pointer}.oy-explorer button:hover{border-color:var(--accent)}.oy-explorer button:disabled{opacity:.4;cursor:not-allowed}.oy-explorer button[aria-pressed=true]{background:var(--soft);color:var(--ink);border-color:var(--accent)}.oy-explorer button:focus-visible,.oy-explorer select:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
      .oy-explorer .kpis{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:16px;margin:20px 0}.oy-explorer .kpi{position:relative;overflow:hidden;min-width:0;padding:22px 24px;background:var(--surface);border-radius:var(--radius);box-shadow:0 3px 14px #0b342b05}.oy-explorer .kpi:first-child{background:linear-gradient(115deg,var(--analysis-hero-start,#126c61),var(--analysis-hero-end,#279b87));color:#fff}.oy-explorer.dark .kpi:first-child{background:linear-gradient(115deg,var(--analysis-hero-start,#235aa7),var(--analysis-hero-end,#198794))}.oy-explorer .kpi:first-child .muted{color:#ffffffd9}.oy-explorer .kpi:nth-child(2){border-top:3px solid var(--series-2)}.oy-explorer .kpi:nth-child(3){border-top:3px solid var(--series-3)}.oy-explorer .number{position:relative;font-size:36px;letter-spacing:-1px;font-weight:650;font-variant-numeric:tabular-nums;margin:12px 0;line-height:1.2}.oy-explorer .decor{position:absolute;right:-20px;bottom:-25px;width:170px;height:170px;color:#fff;opacity:.12;pointer-events:none}.oy-explorer .split{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:16px;margin-top:16px}.oy-explorer .panel{min-width:0;background:var(--surface);padding:22px;border-radius:var(--radius)}.oy-explorer .panel>p{margin:4px 0 18px}.oy-explorer .toolbar{padding:10px 12px;background:var(--surface);border-radius:var(--radius)}.oy-explorer .foot{margin-top:16px;padding:14px 16px;background:var(--surface);border-left:3px solid var(--accent);border-radius:0 8px 8px 0;font-size:12px;color:var(--muted)}.oy-explorer .legend{display:flex;flex-wrap:wrap;gap:6px}.oy-explorer .legend button{display:flex;align-items:center;gap:6px}.oy-explorer .dot{height:7px;width:7px;border-radius:50%}.oy-explorer .table{overflow:auto;background:var(--surface);margin-top:16px;padding:12px;border-radius:var(--radius)}.oy-explorer table{width:100%;border-collapse:collapse;font-size:12px}.oy-explorer td,.oy-explorer th{padding:12px;border-bottom:1px solid var(--line);white-space:nowrap;text-align:left}.oy-explorer th{color:var(--muted);font-weight:500}.oy-explorer .num{text-align:right;font-variant-numeric:tabular-nums}.oy-explorer .state{padding:28px 0}.oy-explorer .breadcrumb{display:flex;gap:6px;margin-top:12px}.oy-explorer.structure .split{grid-template-columns:minmax(0,1fr) minmax(0,1.4fr)}.oy-explorer .recharts-cartesian-axis-tick-value{fill:var(--muted);font-size:11px}.oy-explorer .recharts-cartesian-axis-line,.oy-explorer .recharts-cartesian-axis-tick-line{stroke:var(--line)}.oy-explorer .recharts-brush-texts text{fill:var(--ink)}
      @container(max-width:640px){.oy-explorer .kpis{grid-template-columns:1fr}.oy-explorer .split,.oy-explorer.structure .split{grid-template-columns:1fr}.oy-explorer .number{font-size:28px}.oy-explorer .panel{padding:16px}}
    `}</style>
      <header className="head">
        <div>
          <div className="eyebrow">
            {temporal
              ? 'TREND EXPLORER'
              : variant === 'structure'
              ? 'PORTFOLIO INSIGHTS'
              : 'BUDGET OVERVIEW'}
          </div>
          <h2>{title}</h2>
          <p className="muted">
            服务端聚合 · 当前返回结果{range ? ' · 已缩放' : ''}
          </p>
        </div>
        <div className="actions">
          {refresh && (
            <AnalysisAction kind="refresh" label="刷新数据" disabled={loading} onClick={refresh} />
          )}
          <AnalysisAction kind="download" label="导出当前结果 CSV"
            disabled={loading || !!error || !columns.length || !visible.length} onClick={exportCsv} />
          <AnalysisAction kind="image" label="下载主图 SVG"
            disabled={loading || !!error || tab !== 'chart' || !valid.length} onClick={exportSvg} />
        </div>
      </header>
      {!!drillPath.length && (
        <nav className="breadcrumb" aria-label="下钻路径">
          <button onClick={() => back?.(0)}>全部</button>
          {drillPath.map((d, i) => (
            <button key={i} onClick={() => back?.(i + 1)}>
              {format(d.value)}
            </button>
          ))}
        </nav>
      )}
      {notice && (
        <p role="status" className="muted">
          {notice}
        </p>
      )}
      {error ? (
        <div role="alert" className="state">
          数据加载失败：{String(error)}{' '}
          {refresh && <button onClick={refresh}>重试</button>}
        </div>
      ) : loading ? (
        <div role="status" className="state">
          正在更新分析数据…
        </div>
      ) : !valid.length ? (
        <div className="state">
          当前条件下没有可分析的数值。
          <button
            onClick={() => {
              setSelected(null);
              setRange(null);
            }}
          >
            重置视图
          </button>
        </div>
      ) : (
        <>
          <div className="kpis">
            <div className="kpi">
              <svg className="decor" viewBox="0 0 160 160" aria-hidden="true">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="14"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="43"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M0 125L60 65L92 86L160 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                />
              </svg>
              <p className="muted">
                当前可见值合计 · {metric?.title || metric?.key}
              </p>
              <div className="number" title={format(sum)}>
                {compact(sum)}
              </div>
              <p className="muted">仅合计当前返回的 {valid.length} 个分组</p>
            </div>
            <div className="kpi">
              <p className="muted">最高分组</p>
              <div className="number">{compact(top?.value)}</div>
              <p className="muted">{top?.label}</p>
            </div>
            <div className="kpi">
              <p className="muted">
                {chosen ? '选中分组份额' : '最高分组份额'}
              </p>
              <div className="number">
                {shareable && total > 0
                  ? (
                      ((chosen ? chosen.value : top?.value || 0) / total) *
                      100
                    ).toFixed(1) + '%'
                  : '—'}
              </div>
              <p className="muted">分母：当前返回区间合计</p>
            </div>
          </div>
          <div className="toolbar">
            <div className="actions">
              <button
                aria-pressed={tab === 'chart'}
                onClick={() => setTab('chart')}
              >
                图表
              </button>
              <button
                aria-pressed={tab === 'table'}
                onClick={() => setTab('table')}
              >
                数据表
              </button>
              {metrics.length > 1 && (
                <select
                  aria-label="分析指标"
                  value={metric?.key}
                  onChange={(e) => setMetricKey(e.target.value)}
                >
                  {metrics.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.title || c.key}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="actions">
              {(selected !== null || range) && (
                <button
                  onClick={() => {
                    setSelected(null);
                    setRange(null);
                  }}
                >
                  清除选择
                </button>
              )}
              {chosen && canDrill && select && (
                <button onClick={() => select(chosen.raw)}>下钻所选分组</button>
              )}
              {chosen && details && (
                <button onClick={() => details(chosen.raw)}>查看明细</button>
              )}
            </div>
          </div>
          {tab === 'table' ? (
            <div className="table">
              <table>
                <thead>
                  <tr>
                    {columns.map((c) => (
                      <th key={c.key} className={c.numeric ? 'num' : ''}>
                        {c.title || c.key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((d) => (
                    <tr key={d.i}>
                      {columns.map((c) => (
                        <td key={c.key} className={c.numeric ? 'num' : ''}>
                          {format((displayRows[d.i] || d.raw)[c.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="split">
              <div className="panel" data-export-chart>
                <h3>
                  {temporal ? '周期趋势' : (metric?.title || '指标') + '对比'}
                </h3>
                <p className="muted">
                  {temporal
                    ? '拖动底部选区缩放当前返回区间'
                    : '选择图形或图例，联动指标与数据表'}
                </p>
                <ResponsiveContainer width="100%" height={300} minWidth={1}>
                  {temporal ? (
                    <AreaChart data={data}>
                      <CartesianGrid
                        vertical={false}
                        stroke="var(--line)" strokeDasharray="3 4"
                      />
                      <XAxis dataKey="label" />
                      <YAxis tickFormatter={compact} width={55} />
                      <Tooltip formatter={format} contentStyle={tooltipStyle} itemStyle={{color:"var(--ink)"}} cursor={{ fill: "var(--soft)" }} />
                      <Area
                        dataKey="value"
                        name={metric?.title || metric?.key}
                        stroke={colors[0]}
                        fill={colors[0]}
                        fillOpacity={0.12}
                        isAnimationActive={false}
                      />
                      <Brush
                        dataKey="label"
                        height={40}
                        stroke={colors[0]}
                        fill="var(--surface)"
                        travellerWidth={9}
                        startIndex={range?.startIndex ?? 0}
                        endIndex={range?.endIndex ?? data.length - 1}
                        onChange={(next) => {
                          if (
                            next?.startIndex != null &&
                            next?.endIndex != null
                          ) {
                            setRange(next);
                            setSelected(null);
                          }
                        }}
                      >
                        <AreaChart data={data}>
                          <Area dataKey="value" stroke={colors[0]} fill={colors[0]} fillOpacity={0.15} isAnimationActive={false} />
                        </AreaChart>
                      </Brush>
                    </AreaChart>
                  ) : (
                    <BarChart
                      data={allValid}
                      layout="vertical"
                      margin={{ right: 20 }}
                    >
                      <CartesianGrid
                        horizontal={false}
                        stroke="var(--line)" strokeDasharray="3 4"
                      />
                      <XAxis type="number" tickFormatter={compact} />
                      <YAxis type="category" dataKey="label" width={92} />
                      <Tooltip formatter={format} contentStyle={tooltipStyle} itemStyle={{color:"var(--ink)"}} cursor={{ fill: "var(--soft)" }} />
                      <Bar
                        dataKey="value"
                        name={metric?.title || metric?.key}
                        radius={[0, 4, 4, 0]}
                        maxBarSize={32}
                        onClick={choose}
                        isAnimationActive={false}
                      >
                        {allValid.map((d, i) => (
                          <Cell
                            key={d.i}
                            fill={colors[d.i % colors.length]}
                            fillOpacity={
                              selected === null || selected === d.i ? 1 : 0.25
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
              <div className="panel secondary">
                <h3>{(metric?.title || '指标') + '结构'}</h3>
                <p className="muted">
                  {chosen ? chosen.label + ' · 已联动' : '当前返回分组的构成'}
                </p>
                {shareable ? (
                  <ResponsiveContainer width="100%" height={230} minWidth={1}>
                    <PieChart>
                      <Pie
                        data={allValid}
                        dataKey="value"
                        nameKey="label"
                        innerRadius="62%"
                        outerRadius="84%"
                        paddingAngle={3}
                        onClick={choose}
                        isAnimationActive={false}
                      >
                        {allValid.map((d, i) => (
                          <Cell
                            key={d.i}
                            fill={colors[d.i % colors.length]}
                            fillOpacity={
                              selected === null || selected === d.i ? 1 : 0.25
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={format} contentStyle={tooltipStyle} itemStyle={{color:"var(--ink)"}} cursor={{ fill: "var(--soft)" }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="state">负值或全零结果不展示份额。</p>
                )}
                <div className="legend">
                  {allValid.map((d, i) => (
                    <button
                      key={d.i}
                      aria-pressed={selected === d.i}
                      onClick={() => choose(d)}
                    >
                      <span
                        className="dot"
                        style={{ background: colors[d.i % colors.length] }}
                      />
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <footer className="foot">
            {top
              ? `当前可见范围内，${top.label} 为最高分组，值为 ${format(
                  top.value
                )}。`
              : ''}{' '}
            此处份额和合计仅解释当前返回结果，不代表未查询的数据。
          </footer>
        </>
      )}
    </section>
  );
}
