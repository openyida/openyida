import React, { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, Brush, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Refresh icon: Lucide (ISC), https://lucide.dev/license
// One chart component. Rename YidaComp to AnalysisChart when composing.
// rows: chronological aggregate points for trend, grouped aggregate rows otherwise.
// onRangeChange is local-window selection, NOT a server query. Parent owns cross-card state.
export default function YidaComp({ rows = [], labelKey = 'label', valueKey = 'value',
  title = '趋势分析', kind = 'trend', appearance = 'light', height = 280,
  selectedKey, onSelect, range, onRangeChange, loading, error, onRefresh, actions, style }) {
  const [localRange, setLocalRange] = useState(null);
  const points = useMemo(() => rows.map((row, index) => ({ raw: row, index,
    label: String(row[labelKey] ?? '—'), value: Number.isFinite(row[valueKey]) ? row[valueKey] : null,
  })), [rows, labelKey, valueKey]);
  const signature = JSON.stringify(points.map(point => [point.label, point.value]));
  useEffect(() => { setLocalRange(null); }, [signature]);
  const activeRange = range === undefined ? localRange : range;
  const updateRange = next => {
    if (next?.startIndex == null || next?.endIndex == null) return;
    const startIndex = Math.max(0, Math.min(points.length - 1, next.startIndex));
    const endIndex = Math.max(startIndex, Math.min(points.length - 1, next.endIndex));
    const window = { startIndex, endIndex };
    setLocalRange(window);
    onRangeChange?.(window, points.slice(startIndex, endIndex + 1).map(point => point.raw));
  };
  const resetRange = () => { setLocalRange(null); onRangeChange?.(null, rows); };
  const color = index => ['var(--ch-accent)', 'var(--ch-second)', '#7199b5', '#a693c6'][index % 4];
  const choose = point => { const item = point?.payload || point; if (item?.raw) onSelect?.(item.raw); };
  const format = value => Number.isFinite(value) ? value.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : '—';
  const compact = value => new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  const valid = points.filter(point => point.value !== null);
  const shareable = valid.length && valid.every(point => point.value >= 0) && valid.some(point => point.value > 0);
  const tooltip = <Tooltip formatter={format} contentStyle={{ background: 'var(--ch-bg)', color: 'var(--ch-ink)', border: '1px solid var(--ch-line)', borderRadius: 8 }} itemStyle={{ color: 'var(--ch-ink)' }} />;
  const cells = points.map(point => <Cell key={point.index} fill={color(point.index)} fillOpacity={selectedKey == null || selectedKey === point.raw[labelKey] ? 1 : .25} />);
  return <article className={'oy-chart ' + appearance} style={style} aria-busy={!!loading}>
    <style>{`
      .oy-chart{--ch-bg:var(--analysis-surface,var(--pod-card-bg-color,#fff));--ch-ink:var(--analysis-ink,var(--color-text1-4,#203b38));--ch-muted:var(--analysis-muted,#667d79);--ch-line:var(--analysis-line,#dce8e4);--ch-accent:var(--analysis-accent,var(--color-brand1-6,#148979));--ch-second:var(--analysis-series-2,#e6a04b);min-width:0;padding:22px;border-radius:var(--analysis-radius,12px);background:var(--ch-bg);color:var(--ch-ink);font:13px/1.6 system-ui,sans-serif}
      .oy-chart.dark{color-scheme:dark;--ch-bg:var(--analysis-surface,#192c46);--ch-ink:var(--analysis-ink,#edf5ff);--ch-muted:var(--analysis-muted,#a4b6ce);--ch-line:var(--analysis-line,#2b415d);--ch-accent:var(--analysis-accent,#41c6d4);--ch-second:var(--analysis-series-2,#efb86b)}
      .oy-chart header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.oy-chart h3{color:var(--ch-ink);font-size:15px;margin:0;border-left:3px solid var(--ch-accent);padding-left:8px}.oy-chart p{font-size:12px;color:var(--ch-muted);margin:6px 0 16px}.oy-chart button{font:inherit;color:inherit;background:transparent;border:1px solid var(--ch-line);border-radius:6px;padding:5px 10px;cursor:pointer}.oy-chart .ch-refresh{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:0;opacity:.65}.oy-chart .ch-refresh:hover{background:var(--ch-line);opacity:1}.oy-chart .ch-refresh:disabled{opacity:.35;cursor:wait}.oy-chart button:focus-visible{outline:2px solid var(--ch-accent);outline-offset:2px}.oy-chart .recharts-cartesian-axis-tick-value,.oy-chart .recharts-brush-texts text{fill:var(--ch-muted);font-size:11px}.oy-chart .recharts-cartesian-axis-line,.oy-chart .recharts-cartesian-axis-tick-line{stroke:var(--ch-line)}
    `}</style>
    <header><h3>{title}</h3><div>{actions} {onRefresh && <button className="ch-refresh" type="button" title="刷新数据" aria-label="刷新数据" aria-busy={!!loading} disabled={loading} onClick={onRefresh}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
  <path d="M21 3v5h-5" />
  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
  <path d="M8 16H3v5" /></svg></button>}</div></header>
    {kind === 'trend' && <p>拖动缩略图两端或选区 · 仅缩放当前返回结果 {activeRange && <button onClick={resetRange}>重置区间</button>}</p>}
    {error ? <p role="alert">数据加载失败：{String(error)}</p> : loading ? <p role="status">正在更新…</p>
      : !valid.length ? <p>当前条件下暂无数据</p> : kind === 'donut' && !shareable ? <p>负值或全零结果不展示份额</p>
      : <ResponsiveContainer width="100%" height={height} minWidth={1}>
        {kind === 'donut' ? <PieChart><Pie data={points} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="84%" paddingAngle={3} onClick={choose} isAnimationActive={false}>{cells}</Pie>{tooltip}</PieChart>
          : kind === 'ranking' ? <BarChart data={points} layout="vertical"><CartesianGrid horizontal={false} stroke="var(--ch-line)" strokeDasharray="3 4"/><XAxis type="number" tickFormatter={compact}/><YAxis type="category" dataKey="label" width={88}/>{tooltip}<Bar dataKey="value" name={title} maxBarSize={28} radius={[0,4,4,0]} onClick={choose} isAnimationActive={false}>{cells}</Bar></BarChart>
          : <AreaChart data={points}><CartesianGrid vertical={false} stroke="var(--ch-line)" strokeDasharray="3 4"/><XAxis dataKey="label"/><YAxis width={60} tickFormatter={compact}/>{tooltip}<Area dataKey="value" name={title} stroke="var(--ch-accent)" fill="var(--ch-accent)" fillOpacity={.14} isAnimationActive={false}/>
            <Brush dataKey="label" height={40} travellerWidth={9} stroke="var(--ch-accent)" fill="var(--ch-bg)" startIndex={activeRange?.startIndex ?? 0} endIndex={activeRange?.endIndex ?? points.length - 1} onChange={updateRange}>
              <AreaChart data={points}><Area dataKey="value" stroke="var(--ch-accent)" fill="var(--ch-accent)" fillOpacity={.15} isAnimationActive={false}/></AreaChart>
            </Brush></AreaChart>}
      </ResponsiveContainer>}
  </article>;
}
